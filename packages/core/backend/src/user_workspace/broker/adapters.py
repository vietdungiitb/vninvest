"""Phase C (v34 upgrade): tầng BrokerAdapter hợp nhất — nền cho Broker Hub.

- Một interface `BrokerAdapter` cho dnse/ssi/tcbs, DTO chuẩn
  (BrokerAccount/BrokerBalance/BrokerPosition/BrokerOrder).
- Chỉ READ-ONLY ở pha này (accounts/balances/positions/holdings/orders);
  write pipeline thuộc plan Broker Hub (G0/P1-P3).
- Mọi import vnbroker lazy + chịu ImportError → BrokerUnavailableError
  (image cũ / lane thiếu không được crash app).
- Mapping field phòng thủ (.get nhiều key) vì schema broker trả về khác nhau.

P1-AUTH-01 (2026-09-26) — vòng đời session:
- Trước đây `SsiBrokerAdapter`/`TcbsBrokerAdapter` tạo client MỚI cho mỗi lệnh read
  (`_new_client()` tại mỗi method) ⇒ không cache token, không giải phóng connection.
  Nay: `authenticate()` / `refresh()` / `close()` + `__enter__/__exit__`,
  cache client theo fingerprint credential.
- Read path SSI bắt buộc đã `authenticate()`; client thiếu capability ⇒ fail-closed.
- TCBS KHÔNG BAO GIỜ báo `connected` khi chưa xác minh OTP (khớp `broker/tcbs.py`
  vốn đã trả `unverified`).

P1-SEC-01: `base_url` của TCBS validate qua egress allowlist (`broker/egress.py`)
ngay lúc DỰNG CLIENT, không chỉ lúc lưu config (defense in depth).

Capability detection: `vnbroker` là package private ngoài repo nên không đọc được
body thư viện. Mọi lời gọi lifecycle đều kiểm `callable`/`inspect.signature` trước,
thiếu capability thì raise `BrokerAdapterError` có `code` thay vì gọi mù.
"""
from __future__ import annotations

import hashlib
import inspect
import json
import logging
from dataclasses import asdict, dataclass, field

from .egress import EgressPolicyError, resolve_base_url

logger = logging.getLogger(__name__)

# Code lỗi lifecycle — dùng để test/UI phân biệt, KHÔNG nhét message upstream vào.
CODE_AUTH_UNSUPPORTED = 'broker_client_auth_unsupported'
CODE_REFRESH_UNSUPPORTED = 'broker_client_refresh_unsupported'
CODE_AUTH_SIGNATURE = 'broker_client_auth_signature_unsupported'
CODE_OTP_REQUIRED = 'broker_otp_required'
# Code TRẠNG THÁI, khớp `broker/tcbs.py` test_connection (error='otp_required').
CODE_OTP_REQUIRED_STATUS = 'otp_required'
CODE_LANE_UNAVAILABLE = 'vnbroker_unavailable'


class BrokerAdapterError(Exception):
    """Lỗi chung tầng adapter. `code` là hằng số để caller/UI không phải parse message."""

    def __init__(self, message: str = '', code: str = 'broker_adapter_error'):
        self.code = code
        super().__init__(message or code)


class BrokerUnavailableError(BrokerAdapterError):
    """Lane broker chưa khả dụng (thiếu lib/credential)."""

    def __init__(self, message: str = ''):
        super().__init__(message, code=CODE_LANE_UNAVAILABLE)


class BrokerEgressError(BrokerAdapterError):
    """Endpoint vi phạm egress allowlist — fail-closed, KHÔNG dùng mặc định."""

    def __init__(self, code: str):
        super().__init__(code, code=code)


def _accepts_no_args(func) -> bool:
    """True nếu `func()` gọi được không tham số. Không đọc được signature ⇒ False."""
    try:
        signature = inspect.signature(func)
    except (TypeError, ValueError):
        return False
    for parameter in signature.parameters.values():
        if parameter.kind in (parameter.VAR_POSITIONAL, parameter.VAR_KEYWORD):
            continue
        if parameter.default is parameter.empty:
            return False
    return True


@dataclass
class BrokerAccount:
    external_id: str
    display_name: str
    account_type: str = '1'
    raw: dict = field(default_factory=dict)


@dataclass
class BrokerBalance:
    cash: float = 0.0
    stock_value: float = 0.0
    debt: float = 0.0
    net_equity: float = 0.0
    buying_power: float = 0.0


@dataclass
class BrokerPosition:
    symbol: str
    quantity: float = 0.0
    avg_price: float = 0.0
    market_price: float = 0.0


@dataclass
class BrokerOrder:
    order_id: str = ''
    symbol: str = ''
    side: str = ''
    price: float = 0.0
    quantity: float = 0.0
    status: str = ''
    placed_at: str = ''


def _to_float(value) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def _first(item: dict, *keys: str, default=''):
    for key in keys:
        if isinstance(item, dict) and item.get(key) not in (None, ''):
            return item[key]
    return default


def _rows(payload) -> list[dict]:
    """Chuẩn hóa DataFrame/list/dict → list[dict]."""
    if payload is None:
        return []
    if hasattr(payload, 'to_dict'):
        try:
            rows = payload.to_dict('records')
            if isinstance(rows, list):
                return [r for r in rows if isinstance(r, dict)]
        except Exception:
            return []
        return []
    if isinstance(payload, list):
        return [r for r in payload if isinstance(r, dict)]
    return []


class BrokerAdapter:
    """Interface chung. Mỗi lane implement read methods, thiếu → BrokerAdapterError.

    P1-AUTH-01: base class nay mang vòng đời session (authenticate/refresh/close)
    để cả 3 lane dùng chung một cơ chế cache + fail-closed.
    """

    provider_id = 'base'
    # Lane này cần OTP để xác minh thì mặc định là `unverified`, không phải connected.
    requires_otp = False

    def __init__(self, **credentials):
        self.credentials = credentials
        self._client = None
        self._session_fingerprint = None
        self._client_builds = 0
        self._verified = False
        self._token_valid = False
        self._unverified_code = ''

    def is_available(self) -> bool:
        raise NotImplementedError

    def list_accounts(self) -> list[BrokerAccount]:
        raise NotImplementedError

    def get_balance(self, account_no: str) -> BrokerBalance:
        raise NotImplementedError

    def get_positions(self, account_no: str) -> list[BrokerPosition]:
        raise NotImplementedError

    def get_orders(self, account_no: str) -> list[BrokerOrder]:
        raise NotImplementedError

    # ------------------------------------------------------------------
    # P1-AUTH-01 — vòng đời session
    # ------------------------------------------------------------------
    def _build_client(self):
        """Dựng client broker. Subclass implement; raise BrokerUnavailableError nếu thiếu lane."""
        raise NotImplementedError

    def session_fingerprint(self) -> str:
        """Hash credential đang dùng — đổi credential ⇒ session cũ không tái dùng được."""
        try:
            material = json.dumps(self.credentials, sort_keys=True, default=str)
        except (TypeError, ValueError):
            material = repr(sorted(self.credentials.items(), key=lambda item: item[0]))
        return hashlib.sha256(material.encode('utf-8')).hexdigest()[:32]

    def client_factory_calls(self) -> int:
        """Số lần đã dựng client — dùng để chứng minh cache hoạt động (test + debug)."""
        return self._client_builds

    def has_open_session(self) -> bool:
        return self._client is not None

    def _session(self):
        """Trả client đã authenticate-được, dựng + cache nếu chưa có."""
        fingerprint = self.session_fingerprint()
        if self._client is not None and self._session_fingerprint == fingerprint:
            return self._client
        if self._client is not None:
            self.close()  # credential đổi ⇒ giải phóng session cũ trước
        self._client = self._build_client()
        self._session_fingerprint = fingerprint
        self._client_builds += 1
        return self._client

    def _release_client(self) -> None:
        """Bỏ session khỏi cache mà không gọi `close()` của client (dùng khi fail-closed)."""
        self._client = None
        self._session_fingerprint = None
        self._verified = False

    def authenticate(self) -> dict:
        """Mở session. Idempotent: session đã xác minh thì không gọi lại lên client."""
        if self._verified and self.has_open_session():
            if self._session_fingerprint == self.session_fingerprint():
                return self.connection_status()
        client = self._session()
        authenticator = getattr(client, 'authenticate', None)
        if not callable(authenticator):
            # Client không có khả năng xác thực ⇒ KHÔNG được gọi read method nào.
            self._release_client()
            raise BrokerAdapterError('client không hỗ trợ authenticate',
                                     code=CODE_AUTH_UNSUPPORTED)
        if not _accepts_no_args(authenticator):
            # authenticate(otp) bắt buộc tham số ⇒ chưa có OTP ⇒ fail-closed.
            self._release_client()
            raise BrokerAdapterError('authenticate cần tham số (otp)',
                                     code=CODE_AUTH_SIGNATURE)
        authenticator()
        self._verified = True
        self._unverified_code = ''
        return self.connection_status()

    def refresh(self) -> dict:
        """Lấy lại token/phiên trên client đang mở. Mở session mới nếu chưa có."""
        client = self._session()
        refresher = getattr(client, 'refresh', None)
        if not callable(refresher) or not _accepts_no_args(refresher):
            self._release_client()
            raise BrokerAdapterError('client không hỗ trợ refresh',
                                     code=CODE_REFRESH_UNSUPPORTED)
        self.authenticate()  # idempotent — chỉ gọi thật khi chưa verified
        refresher()
        return self.connection_status()

    def close(self) -> None:
        """Giải phóng session. Lỗi close KHÔNG được làm hỏng kết quả read đã thành công."""
        client = self._client
        self._release_client()
        if client is None:
            return
        closer = getattr(client, 'close', None)
        if not callable(closer):
            return
        try:
            closer()
        except Exception as exc:
            logger.warning('broker %s session close failed — %s',
                           self.provider_id, type(exc).__name__)

    def connection_status(self) -> dict:
        """Trạng thái phiên. KHÔNG bao giờ trả `connected` khi chưa xác minh.

        Cần đúng 3 trạng thái: `connected` (đã xác minh) / `unverified` (cấu hình hợp lệ
        nhưng thiếu OTP) / `error` (lane thiếu). UI phải phân biệt 3 nhánh này.
        """
        if self._verified:
            return {'provider': self.provider_id, 'state': 'connected',
                    'connected': True, 'unverified': False, 'code': ''}
        return {'provider': self.provider_id, 'state': 'unverified', 'connected': False,
                'unverified': True,
                'code': self._unverified_code or CODE_AUTH_UNSUPPORTED}

    def __enter__(self) -> BrokerAdapter:
        return self

    def __exit__(self, exc_type, exc, traceback) -> bool:
        self.close()
        return False


class DnseBrokerAdapter(BrokerAdapter):
    """Wrap vnbroker_dnse_compat (đã dùng ở production cho sync)."""

    provider_id = 'dnse'

    def __init__(self, client_id: str = '', client_secret: str = '', **kwargs):
        super().__init__(client_id=client_id, client_secret=client_secret, **kwargs)
        self._client = None

    def is_available(self) -> bool:
        try:
            from user_workspace.vnbroker_dnse_compat import build_dnse_client
            build_dnse_client
            return True
        except ImportError:
            return False

    def _client_or_raise(self):
        if self._client is not None:
            return self._client
        try:
            from user_workspace.vnbroker_dnse_compat import (
                build_dnse_client,
                fetch_account_balance,
                fetch_order_history,
                fetch_positions,
                fetch_sub_accounts,
            )
        except ImportError as exc:
            raise BrokerUnavailableError(f'DNSE lane unavailable: {exc}') from exc
        self._client = build_dnse_client(
            client_id=self.credentials.get('client_id', ''),
            client_secret=self.credentials.get('client_secret', ''))
        self._fetch = {
            'balance': fetch_account_balance,
            'orders': fetch_order_history,
            'accounts': fetch_sub_accounts,
            'positions': fetch_positions,
        }
        return self._client

    def list_accounts(self) -> list[BrokerAccount]:
        client = self._client_or_raise()
        out = []
        for item in self._fetch['accounts'](client):
            ext = str(item.get('account_number') or '')
            if not ext:
                continue
            out.append(BrokerAccount(
                external_id=ext,
                display_name=str(item.get('account_name') or f'DNSE {ext}'),
                account_type=str(item.get('account_type') or '1'),
                raw=item,
            ))
        return out

    def get_balance(self, account_no: str) -> BrokerBalance:
        client = self._client_or_raise()
        data = self._fetch['balance'](client, account_no) or {}
        return BrokerBalance(
            cash=_to_float(data.get('cash')),
            stock_value=_to_float(data.get('stock_value')),
            debt=_to_float(data.get('debt')),
            net_equity=_to_float(data.get('net_equity')),
        )

    def get_positions(self, account_no: str) -> list[BrokerPosition]:
        # B1.2 (Wave 1, P0-4): noi endpoint that `DNSEClient.get_positions`
        # (market_type STOCK). Comment cu sai — endpoint co san o 3.7.2.
        client = self._client_or_raise()
        out = []
        for item in self._fetch['positions'](client, account_no):
            symbol = str(item.get('symbol') or '').upper()
            if not symbol:
                continue
            out.append(BrokerPosition(
                symbol=symbol,
                quantity=_to_float(item.get('quantity')),
                avg_price=_to_float(item.get('avg_price')),
                market_price=_to_float(item.get('market_price')),
            ))
        return out

    def get_orders(self, account_no: str) -> list[BrokerOrder]:
        from datetime import date, timedelta
        client = self._client_or_raise()
        today = date.today()
        start = (today - timedelta(days=30)).isoformat()
        out = []
        for item in self._fetch['orders'](client, account_no, start, today.isoformat()):
            out.append(BrokerOrder(
                order_id=str(_first(item, 'order_id', 'orderId', 'id')),
                symbol=str(_first(item, 'symbol', 'ticker')).upper(),
                side=str(_first(item, 'type', 'side', default='')),
                price=_to_float(_first(item, 'price', 'matched_price', default=0)),
                quantity=_to_float(_first(item, 'quantity', 'matched_quantity', default=0)),
                status=str(_first(item, 'status', 'orderStatus', default='')),
                placed_at=str(_first(item, 'date', 'matched_date', 'createdAt', default='')),
            ))
        return out


class SsiBrokerAdapter(BrokerAdapter):
    """Wrap SSIBrokerClient (FastConnect v3). Keyword args bắt buộc (C2).

    P1-AUTH-01: read path đi qua `authenticate()` (SSI `authenticate()` không OTP =
    market-only, khớp `broker/ssi.py` test_connection) và dùng chung 1 client.
    """

    provider_id = 'ssi'

    def _build_client(self):
        try:
            from vnbroker.broker.ssi.client import SSIBrokerClient
        except ImportError as exc:
            raise BrokerUnavailableError(f'SSI lane unavailable: {type(exc).__name__}') from exc
        return SSIBrokerClient(
            client_id=self.credentials.get('client_id') or None,
            api_key=self.credentials.get('api_key'),
            api_secret=self.credentials.get('api_secret'),
        )

    def is_available(self) -> bool:
        try:
            from vnbroker.broker.ssi.client import SSIBrokerClient  # noqa: F401
            return True
        except ImportError:
            return False

    def _authenticated_client(self):
        """Read path: KHÔNG bao giờ gọi read method trên client chưa authenticate."""
        self.authenticate()
        return self._client

    def list_accounts(self) -> list[BrokerAccount]:
        rows = _rows(self._authenticated_client().list_accounts())
        out = []
        for item in rows:
            ext = str(_first(item, 'account', 'accountNo', 'account_no', 'id'))
            if not ext:
                continue
            out.append(BrokerAccount(external_id=ext, display_name=ext, raw=item))
        return out

    def get_balance(self, account_no: str) -> BrokerBalance:
        data = self._authenticated_client().get_balance(account_no) or {}
        if not isinstance(data, dict):
            rows = _rows(data)
            data = rows[0] if rows else {}
        return BrokerBalance(
            cash=_to_float(_first(data, 'cash', 'cashBalance', 'availableCash', default=0)),
            stock_value=_to_float(_first(data, 'stockValue', 'marketValue', default=0)),
            debt=_to_float(_first(data, 'loan', 'marginDebt', default=0)),
            net_equity=_to_float(_first(data, 'netAsset', 'netEquity', default=0)),
            buying_power=_to_float(_first(data, 'purchasingPower', 'maxBuy', default=0)),
        )

    def get_positions(self, account_no: str) -> list[BrokerPosition]:
        rows = _rows(self._authenticated_client().get_holdings(account_no))
        out = []
        for item in rows:
            symbol = str(_first(item, 'symbol', 'ticker', 'stockSymbol')).upper()
            if not symbol:
                continue
            out.append(BrokerPosition(
                symbol=symbol,
                quantity=_to_float(_first(item, 'quantity', 'volume', 'totalVol', default=0)),
                avg_price=_to_float(_first(item, 'avgPrice', 'averagePrice', 'costPrice', default=0)),
                market_price=_to_float(_first(item, 'marketPrice', 'currentPrice', default=0)),
            ))
        return out

    def get_orders(self, account_no: str) -> list[BrokerOrder]:
        rows = _rows(self._authenticated_client().get_orders(account_no))
        out = []
        for item in rows:
            out.append(BrokerOrder(
                order_id=str(_first(item, 'orderId', 'order_id', 'id')),
                symbol=str(_first(item, 'symbol', 'ticker')).upper(),
                side=str(_first(item, 'buySell', 'side', default='')),
                price=_to_float(_first(item, 'price', 'orderPrice', default=0)),
                quantity=_to_float(_first(item, 'quantity', 'orderQuantity', default=0)),
                status=str(_first(item, 'status', 'orderStatus', default='')),
                placed_at=str(_first(item, 'orderTime', 'date', default='')),
            ))
        return out


class TcbsBrokerAdapter(BrokerAdapter):
    """Wrap TCBSBrokerClient (iFlash). Chỉ read ở pha C (OTP ở pha trade).

    P1-SEC-01: `base_url` phải qua egress allowlist trước khi dựng client.
    P1-AUTH-01: TCBS `authenticate(otp)` bắt buộc OTP ⇒ chưa OTP thì trạng thái là
    `unverified`, TUYỆT ĐỐI không phải `connected` (khớp `broker/tcbs.py` test_connection).
    """

    provider_id = 'tcbs'
    requires_otp = True

    def _resolved_base_url(self):
        """Egress allowlist — lỗi thì raise BrokerEgressError, KHÔNG rơi về default."""
        raw = str(self.credentials.get('base_url') or '').strip()
        try:
            return resolve_base_url(self.provider_id, raw)
        except EgressPolicyError as exc:
            raise BrokerEgressError(exc.code) from None

    def _build_client(self):
        try:
            from vnbroker.broker.tcbs.client import TCBSBrokerClient
        except ImportError as exc:
            raise BrokerUnavailableError(f'TCBS lane unavailable: {type(exc).__name__}') from exc
        raw = str(self.credentials.get('base_url') or '').strip()
        return TCBSBrokerClient(
            api_key=self.credentials.get('api_key'),
            # base_url rỗng ⇒ None để client tự dùng default iFlash (validate đã chạy ở trên).
            base_url=raw and self._resolved_base_url() or None,
            custody_code=self.credentials.get('custody_code') or None,
        )

    def is_available(self) -> bool:
        try:
            from vnbroker.broker.tcbs.client import TCBSBrokerClient  # noqa: F401
            return True
        except ImportError:
            return False

    def authenticate(self) -> dict:
        """TCBS cần OTP. Thiếu OTP ⇒ raise `broker_otp_required` và KHÔNG dựng client."""
        otp = str(self.credentials.get('otp') or '').strip()
        if not otp:
            self._unverified_code = CODE_OTP_REQUIRED_STATUS
            raise BrokerAdapterError('TCBS cần OTP để xác minh', code=CODE_OTP_REQUIRED)
        client = self._session()
        authenticator = getattr(client, 'authenticate', None)
        if not callable(authenticator):
            self._release_client()
            self._unverified_code = CODE_AUTH_UNSUPPORTED
            raise BrokerAdapterError('client không hỗ trợ authenticate',
                                     code=CODE_AUTH_UNSUPPORTED)
        authenticator(otp=otp)
        self._verified = True
        self._token_valid = True
        self._unverified_code = ''
        return self.connection_status()

    def _read_client(self):
        """Read-only: mở session cache nhưng KHÔNG giả định đã xác minh.

        Capability detect `is_token_valid` (TCBS client expose cờ này) để phân biệt
        "đã có token" với "chỉ mới đúng format API key".
        """
        client = self._session()
        probe = getattr(client, 'is_token_valid', None)
        if isinstance(probe, bool):
            self._token_valid = probe
        elif callable(probe):
            try:
                self._token_valid = bool(probe())
            except Exception:
                self._token_valid = False
        else:
            self._token_valid = False
        if not self._token_valid:
            self._unverified_code = CODE_OTP_REQUIRED_STATUS
        return client

    def connection_status(self) -> dict:
        if not self.is_available():
            return {'provider': self.provider_id, 'state': 'error', 'connected': False,
                    'unverified': False, 'code': CODE_LANE_UNAVAILABLE}
        if self._verified or self._token_valid:
            return {'provider': self.provider_id, 'state': 'connected', 'connected': True,
                    'unverified': False, 'code': ''}
        return {'provider': self.provider_id, 'state': 'unverified', 'connected': False,
                'unverified': True, 'code': self._unverified_code or CODE_OTP_REQUIRED_STATUS}

    def list_accounts(self) -> list[BrokerAccount]:
        rows = _rows(self._read_client().get_account_list())
        out = []
        for item in rows:
            ext = str(_first(item, 'accountNo', 'account_no', 'account', 'id'))
            if not ext:
                continue
            out.append(BrokerAccount(
                external_id=ext,
                display_name=str(_first(item, 'accountName', default=ext)),
                raw=item,
            ))
        return out

    def get_balance(self, account_no: str) -> BrokerBalance:
        data = self._read_client().get_balance(account_no)
        if not isinstance(data, dict):
            rows = _rows(data)
            data = rows[0] if rows else {}
        return BrokerBalance(
            cash=_to_float(_first(data, 'cash', default=0)),
            stock_value=_to_float(_first(data, 'stockValue', 'marketValue', default=0)),
            debt=_to_float(_first(data, 'debt', 'loan', default=0)),
            net_equity=_to_float(_first(data, 'netEquity', default=0)),
        )

    def get_positions(self, account_no: str) -> list[BrokerPosition]:
        rows = _rows(self._read_client().get_holdings(account_no))
        out = []
        for item in rows:
            symbol = str(_first(item, 'symbol', 'ticker')).upper()
            if not symbol:
                continue
            out.append(BrokerPosition(
                symbol=symbol,
                quantity=_to_float(_first(item, 'quantity', 'volume', default=0)),
                avg_price=_to_float(_first(item, 'avgPrice', 'costPrice', default=0)),
                market_price=_to_float(_first(item, 'marketPrice', default=0)),
            ))
        return out

    def get_orders(self, account_no: str) -> list[BrokerOrder]:
        rows = _rows(self._read_client().get_orders(account_no))
        out = []
        for item in rows:
            out.append(BrokerOrder(
                order_id=str(_first(item, 'orderId', 'order_id', 'id')),
                symbol=str(_first(item, 'symbol', 'ticker')).upper(),
                side=str(_first(item, 'side', default='')),
                price=_to_float(_first(item, 'price', default=0)),
                quantity=_to_float(_first(item, 'quantity', default=0)),
                status=str(_first(item, 'status', default='')),
                placed_at=str(_first(item, 'date', 'createdAt', default='')),
            ))
        return out


_ADAPTERS = {
    'dnse': DnseBrokerAdapter,
    'ssi': SsiBrokerAdapter,
    'tcbs': TcbsBrokerAdapter,
}


def get_broker_adapter(provider: str, **credentials) -> BrokerAdapter:
    """Factory nền Broker Hub. Provider lạ → BrokerAdapterError (không None)."""
    normalized = str(provider or '').strip().lower()
    cls = _ADAPTERS.get(normalized)
    if cls is None:
        raise BrokerAdapterError(f'Broker không hỗ trợ: {provider}')
    return cls(**credentials)


def adapter_to_dict(adapter: BrokerAdapter) -> dict:
    return {'provider': adapter.provider_id, 'available': adapter.is_available()}


def dto_to_dict(dto) -> dict:
    return asdict(dto)
