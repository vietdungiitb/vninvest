from __future__ import annotations

from typing import Any


def _dataframe_to_records(payload: Any) -> list[dict]:
    # vnbroker often returns pandas DataFrame for account/order endpoints.
    if hasattr(payload, "to_dict") and callable(payload.to_dict):
        try:
            rows = payload.to_dict("records")
            if isinstance(rows, list):
                return [item for item in rows if isinstance(item, dict)]
        except Exception:
            return []
    return []


def _coerce_list(payload: Any) -> list[dict]:
    df_rows = _dataframe_to_records(payload)
    if df_rows:
        return df_rows

    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    if not isinstance(payload, dict):
        return []

    for key in ("data", "items", "results", "accounts", "rows"):
        value = payload.get(key)
        if isinstance(value, list):
            return [item for item in value if isinstance(item, dict)]
    return []


def _to_float(value: Any) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def build_dnse_client(client_id: str, client_secret: str):
    from vnbroker.connector.dnse.client import DNSEClient

    return DNSEClient(
        api_key=client_id,
        api_secret=client_secret,
        base_url="https://openapi.dnse.com.vn",
        show_log=False,
    )


def fetch_sub_accounts(client) -> list[dict]:
    raw = client.get_accounts(raw=False)
    accounts = _coerce_list(raw)

    normalized = []
    for item in accounts:
        account_number = (
            item.get("account_number")
            or item.get("accountNo")
            or item.get("account_no")
            or item.get("id")
            or item.get("id")
        )
        if not account_number:
            continue

        account_type = item.get("account_type") or item.get("accountType")
        if account_type is None:
            # DNSE DataFrame shape: dealAccount/derivativeAccount flags.
            if item.get("derivativeAccount"):
                account_type = "6"
            else:
                account_type = "1"

        normalized.append(
            {
                "account_number": str(account_number),
                "account_type": str(account_type or "1"),
                "account_name": item.get("account_name")
                or item.get("accountName")
                or f"DNSE {account_number}",
            }
        )

    return normalized


def fetch_account_balance(client, account_number: str) -> dict:
    raw = client.get_balances(account_no=account_number, raw=False)

    if isinstance(raw, list) and raw and isinstance(raw[0], dict):
        data = raw[0]
    elif isinstance(raw, dict):
        rows = _coerce_list(raw)
        data = rows[0] if rows else raw
    else:
        data = {}

    return {
        "cash": _to_float(data.get("cash") or data.get("cashBalance") or data.get("availableCash")),
        "stock_value": _to_float(data.get("stock_value") or data.get("stockValue") or data.get("marketValue")),
        "debt": _to_float(data.get("debt") or data.get("loan") or data.get("marginDebt")),
        "net_equity": _to_float(data.get("net_equity") or data.get("netEquity") or data.get("netAsset")),
    }


def fetch_positions(client, account_number: str, market_type: str = "STOCK") -> list[dict]:
    """B1.2 (Wave 1): vi the DNSE — nguon that cho position-first sync.

    `market_type` mac dinh STOCK (vnbroker 3.7.2 chi nhan STOCK/DERIVATIVE;
    sai nem DNSEValidationError — khong retry mu nhu ban cu).
    """
    raw = client.get_positions(
        account_no=account_number,
        market_type=market_type,
        raw=False,
    )
    normalized = []
    for item in _coerce_list(raw):
        symbol = item.get("symbol") or item.get("ticker")
        if not symbol:
            continue
        normalized.append(
            {
                "symbol": str(symbol).upper(),
                "quantity": _to_float(
                    item.get("quantity")
                    or item.get("volume")
                    or item.get("totalVol")
                ),
                "avg_price": _to_float(
                    item.get("avg_price")
                    or item.get("avgPrice")
                    or item.get("average_price")
                    or item.get("averagePrice")
                    or item.get("cost_price")
                    or item.get("costPrice")
                ),
                "market_price": _to_float(
                    item.get("market_price")
                    or item.get("marketPrice")
                    or item.get("current_price")
                    or item.get("currentPrice")
                ),
            }
        )
    return normalized


def fetch_order_history(client, account_number: str, from_date: str, to_date: str) -> list[dict]:
    last_error = None
    raw = None

    for market_type in ("ALL", "STOCK", "EQUITY"):
        try:
            raw = client.get_order_history(
                account_no=account_number,
                market_type=market_type,
                from_date=from_date,
                to_date=to_date,
                raw=False,
            )
            break
        except Exception as exc:
            last_error = exc

    if raw is None:
        raise RuntimeError(f"Không thể lấy order history từ DNSE: {last_error}")

    orders = _coerce_list(raw)
    if not orders and isinstance(raw, dict):
        maybe_single = raw.get("order")
        if isinstance(maybe_single, dict):
            orders = [maybe_single]

    normalized = []
    for item in orders:
        normalized.append(
            {
                "order_id": item.get("order_id") or item.get("orderId") or item.get("id"),
                "symbol": item.get("symbol") or item.get("ticker"),
                "type": (item.get("type") or item.get("side") or "BUY"),
                "status": item.get("status") or item.get("orderStatus") or "",
                "date": item.get("date") or item.get("matched_date") or item.get("createdAt"),
                "price": _to_float(item.get("price") or item.get("matched_price")),
                "quantity": _to_float(item.get("quantity") or item.get("matched_quantity")),
                "fee": _to_float(item.get("fee")),
                "tax": _to_float(item.get("tax")),
            }
        )

    return normalized
