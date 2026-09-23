"""Phase C (v34 upgrade): tầng BrokerAdapter hợp nhất — nền cho Broker Hub.

- Một interface `BrokerAdapter` cho dnse/ssi/tcbs, DTO chuẩn
  (BrokerAccount/BrokerBalance/BrokerPosition/BrokerOrder).
- Chỉ READ-ONLY ở pha này (accounts/balances/positions/holdings/orders);
  write pipeline thuộc plan Broker Hub (G0/P1-P3).
- Mọi import vnbroker lazy + chịu ImportError → BrokerUnavailableError
  (image cũ / lane thiếu không được crash app).
- Mapping field phòng thủ (.get nhiều key) vì schema broker trả về khác nhau.
"""
from __future__ import annotations

import logging
from dataclasses import asdict, dataclass, field

logger = logging.getLogger(__name__)


class BrokerAdapterError(Exception):
    """Lỗi chung tầng adapter."""


class BrokerUnavailableError(BrokerAdapterError):
    """Lane broker chưa khả dụng (thiếu lib/credential)."""


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
        except Exception:  # noqa: BLE001
            return []
        return []
    if isinstance(payload, list):
        return [r for r in payload if isinstance(r, dict)]
    return []


class BrokerAdapter:
    """Interface chung. Mỗi lane implement read methods, thiếu → BrokerAdapterError."""

    provider_id = 'base'

    def __init__(self, **credentials):
        self.credentials = credentials

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


class DnseBrokerAdapter(BrokerAdapter):
    """Wrap vnbroker_dnse_compat (đã dùng ở production cho sync)."""

    provider_id = 'dnse'

    def __init__(self, client_id: str = '', client_secret: str = '', **kwargs):
        super().__init__(client_id=client_id, client_secret=client_secret, **kwargs)
        self._client = None

    def is_available(self) -> bool:
        try:
            from user_workspace.vnbroker_dnse_compat import build_dnse_client
            build_dnse_client  # noqa: B018 — chỉ check import được
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
        # DNSE positions suy từ order history hiện tại chưa có endpoint riêng ở compat
        raise BrokerAdapterError('DNSE positions chưa hỗ trợ ở pha C (dùng sync holdings)')

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
    """Wrap SSIBrokerClient (FastConnect v3). Keyword args bắt buộc (C2)."""

    provider_id = 'ssi'

    def _new_client(self):
        try:
            from vnbroker.broker.ssi.client import SSIBrokerClient
        except ImportError as exc:
            raise BrokerUnavailableError(f'SSI lane unavailable: {exc}') from exc
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

    def list_accounts(self) -> list[BrokerAccount]:
        rows = _rows(self._new_client().list_accounts())
        out = []
        for item in rows:
            ext = str(_first(item, 'account', 'accountNo', 'account_no', 'id'))
            if not ext:
                continue
            out.append(BrokerAccount(external_id=ext, display_name=ext, raw=item))
        return out

    def get_balance(self, account_no: str) -> BrokerBalance:
        data = self._new_client().get_balance(account_no) or {}
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
        rows = _rows(self._new_client().get_holdings(account_no))
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
        rows = _rows(self._new_client().get_orders(account_no))
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
    """Wrap TCBSBrokerClient (iFlash). Chỉ read ở pha C (OTP ở pha trade)."""

    provider_id = 'tcbs'

    def _new_client(self):
        try:
            from vnbroker.broker.tcbs.client import TCBSBrokerClient
        except ImportError as exc:
            raise BrokerUnavailableError(f'TCBS lane unavailable: {exc}') from exc
        return TCBSBrokerClient(
            api_key=self.credentials.get('api_key'),
            base_url=self.credentials.get('base_url') or None,
            custody_code=self.credentials.get('custody_code') or None,
        )

    def is_available(self) -> bool:
        try:
            from vnbroker.broker.tcbs.client import TCBSBrokerClient  # noqa: F401
            return True
        except ImportError:
            return False

    def list_accounts(self) -> list[BrokerAccount]:
        rows = _rows(self._new_client().get_account_list())
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
        data = self._new_client().get_balance(account_no)
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
        rows = _rows(self._new_client().get_holdings(account_no))
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
        rows = _rows(self._new_client().get_orders(account_no))
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
