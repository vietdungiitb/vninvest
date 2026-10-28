"""
Seed bo du lieu test nguoi dung QA cho vninvest (dataset v1).

Muc tieu: mo phong hoat dong THAT cua nguoi dung tu du lieu thi truong
da co, uu tien ma VN30/VN100. Gia giao dich neo theo DailyPrice.close
moi nhat trong DB (khong random gia vo can cu).

Universe (50 ma):
- VN30 ky 07/2026, hieu luc 03/08/2026 (30 ma): ACB BID BSR CTG FPT GAS
  GVR HDB HPG LPB MBB MCH MSN MWG SAB SHB SSB SSI STB TCB TCX VCB VHM
  VIB VIC VJC VNM VPB VPL VRE
- VN100 mo rong: 20 midcap HOSE thanh khoan cao: VCI HCM VND KDH NLG
  DIG PDR DXG HSG NKG DGC DPM DCM REE GEX POW NT2 FRT PNJ BVH PVD

6 persona (username/password):
- qa_longterm / Test@12345 — NDT dai han VN30 (buy-hold + co tuc)
- qa_trader / Test@12345 — luot song midcap (nhieu BUY/SELL + margin)
- qa_bank / Test@12345 — chuyen bank VN30 (screener + allocation)
- qa_whale / Test@12345 — san ca voi (whale threshold thap + alert)
- qa_tenant_admin / Test@12345 — tenant PRO (quota + billing test)
- qa_staff / Test@12345 — staff INTERNAL (SOC/DataOps verify)

Idempotent: chay lai bo qua row da co (marker source_ref qa:dataset-v1,
username prefix qa_). --delete xoa toan bo user qa_* + row marker.

Usage:
    python manage.py seed_qa_user_dataset
    python manage.py seed_qa_user_dataset --delete
    python manage.py seed_qa_user_dataset --personas qa_longterm,qa_trader

Lesson L-B03: stdout chi ASCII (khong dau tieng Viet).
"""
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

MARKER = "qa:dataset-v1"
PASSWORD = "Test@12345"

# VN30 ky 07/2026 (HOSE cong bo 15/07/2026, hieu luc 03/08/2026).
VN30 = [
    "ACB", "BID", "BSR", "CTG", "FPT", "GAS", "GVR", "HDB", "HPG", "LPB",
    "MBB", "MCH", "MSN", "MWG", "SAB", "SHB", "SSB", "SSI", "STB", "TCB",
    "TCX", "VCB", "VHM", "VIB", "VIC", "VJC", "VNM", "VPB", "VPL", "VRE",
]
# VN100 mo rong: 20 midcap HOSE dai dien (ngoai VN30).
VN100_EXT = [
    "VCI", "HCM", "VND", "KDH", "NLG", "DIG", "PDR", "DXG", "HSG", "NKG",
    "DGC", "DPM", "DCM", "REE", "GEX", "POW", "NT2", "FRT", "PNJ", "BVH",
]
UNIVERSE = VN30 + VN100_EXT

INDUSTRY = {
    "ACB": "Ngan hang", "BID": "Ngan hang", "CTG": "Ngan hang",
    "HDB": "Ngan hang", "LPB": "Ngan hang", "MBB": "Ngan hang",
    "SHB": "Ngan hang", "SSB": "Ngan hang", "STB": "Ngan hang",
    "TCB": "Ngan hang", "VCB": "Ngan hang", "VIB": "Ngan hang",
    "VPB": "Ngan hang", "FPT": "Cong nghe", "HPG": "Thep",
    "HSG": "Thep", "NKG": "Thep", "MSN": "Tieu dung", "MCH": "Tieu dung",
    "MWG": "Ban le", "FRT": "Ban le", "DGW": "Ban le", "VNM": "Tieu dung",
    "SAB": "Do uong", "GAS": "Dau khi", "BSR": "Dau khi", "PVD": "Dau khi",
    "POW": "Dien", "NT2": "Dien", "REE": "Dien", "GEX": "Dien",
    "VIC": "BDS", "VHM": "BDS", "VRE": "BDS", "VPL": "BDS",
    "KDH": "BDS", "NLG": "BDS", "DIG": "BDS", "PDR": "BDS", "DXG": "BDS",
    "SSI": "Chung khoan", "VCI": "Chung khoan", "HCM": "Chung khoan",
    "VND": "Chung khoan", "TCX": "Chung khoan", "VJC": "Hang khong",
    "GVR": "Cao su", "DGC": "Hoa chat", "DPM": "Phan bon",
    "DCM": "Phan bon", "PNJ": "Trang suc", "BVH": "Bao hiem",
}

# Gia fallback khi DB chua co DailyPrice (VND/cp, gan dung de test chay).
BASE_PRICES = {
    "VCB": 92000, "BID": 48000, "CTG": 36000, "TCB": 24500, "MBB": 23500,
    "VPB": 19500, "ACB": 25800, "STB": 32000, "HDB": 22500, "SHB": 11800,
    "LPB": 32000, "SSB": 21000, "VIB": 20500, "FPT": 128000, "HPG": 27500,
    "MSN": 76000, "MCH": 165000, "MWG": 62000, "VNM": 68000, "SAB": 58000,
    "GAS": 78000, "BSR": 23000, "VIC": 45000, "VHM": 42000, "VRE": 25000,
    "VPL": 60000, "VJC": 105000, "GVR": 22000, "SSI": 34000, "TCX": 28000,
    "VCI": 38000, "HCM": 29000, "VND": 18500, "KDH": 34000, "NLG": 38000,
    "DIG": 24000, "PDR": 21000, "DXG": 16500, "HSG": 22000, "NKG": 24000,
    "DGC": 95000, "DPM": 36000, "DCM": 37000, "REE": 68000, "GEX": 22000,
    "POW": 13000, "NT2": 23000, "FRT": 175000, "PNJ": 96000, "BVH": 48000,
}

PERSONAS = {
    "qa_longterm": {
        "plan": "pro", "display": "QA Longterm",
        "portfolios": [("Dai han VN30", ["VCB", "FPT", "MWG", "VNM", "MBB", "REE"])],
        "watchlists": {"Theo doi sat": ["VCB", "FPT", "MWG"], "Tich luy dai han": ["VNM", "REE", "PNJ", "FRT"]},
        "alerts": [("VCB", "BELOW", -0.05), ("FPT", "ABOVE", 0.08)],
        "whale_threshold": None,
    },
    "qa_trader": {
        "plan": "pro", "display": "QA Trader",
        "portfolios": [("Luot song Midcap", ["DIG", "DXG", "HSG", "VCI", "GEX", "PDR"])],
        "watchlists": {"Luot song": ["DIG", "DXG", "HSG", "VCI", "GEX"], "Canh breakout": ["PDR", "NLG", "KDH"]},
        "alerts": [("DIG", "ABOVE", 0.05), ("VCI", "ABOVE", 0.05), ("HSG", "BELOW", -0.04)],
        "whale_threshold": Decimal("500"),
    },
    "qa_bank": {
        "plan": "starter", "display": "QA Bank",
        "portfolios": [("Chuyen Bank VN30", ["ACB", "TCB", "MBB", "VPB", "STB", "CTG", "BID"])],
        "watchlists": {"Bank VN30": ["ACB", "TCB", "MBB", "VPB", "STB", "CTG", "BID", "VCB"]},
        "alerts": [("TCB", "BELOW", -0.03), ("MBB", "ABOVE", 0.06)],
        "whale_threshold": Decimal("1000"),
    },
    "qa_whale": {
        "plan": "pro", "display": "QA Whale",
        "portfolios": [("San ca voi", ["HPG", "SSI", "VHM", "VIC", "STB"])],
        "watchlists": {"Whale radar": ["HPG", "SSI", "VHM", "VIC", "STB", "VCI"]},
        "alerts": [("HPG", "ABOVE", 0.04), ("SSI", "ABOVE", 0.04)],
        "whale_threshold": Decimal("100"),
    },
    "qa_tenant_admin": {
        "plan": "pro", "display": "QA Tenant Admin",
        "portfolios": [("Tong hop VN100", ["FPT", "HPG", "VCI", "KDH", "DGC", "PNJ"])],
        "watchlists": {"Van hanh": ["FPT", "VCI", "HPG", "VNM"]},
        "alerts": [("FPT", "BELOW", -0.03)],
        "whale_threshold": None,
    },
    "qa_staff": {
        "plan": "internal", "display": "QA Staff",
        "portfolios": [("Giam sat thi truong", ["VCB", "FPT", "HPG", "VIC"])],
        "watchlists": {"Giam sat": ["VCB", "FPT", "HPG", "VIC"]},
        "alerts": [],
        "whale_threshold": None,
    },
}


class Command(BaseCommand):
    help = "Seed QA user dataset v1 (VN30/VN100, anchored to DailyPrice)."

    def add_arguments(self, parser):
        parser.add_argument("--delete", action="store_true", help="Delete all qa_* users + marker rows")
        parser.add_argument("--personas", default="", help="Comma-separated subset, e.g. qa_longterm,qa_trader")

    def handle(self, *args, **options):
        if options.get("delete"):
            self._delete()
            return
        only = [p.strip() for p in (options.get("personas") or "").split(",") if p.strip()]
        names = [n for n in PERSONAS if not only or n in only]
        if only and not names:
            self.stdout.write("WARN: no matching personas, nothing seeded.")
            return
        self._seed(names)

    # -- internals -----------------------------------------------------
    def _price_map(self):
        """Latest DailyPrice.close per symbol, fallback BASE_PRICES."""
        prices = dict(BASE_PRICES)
        try:
            from market_data.models import DailyPrice
            rows = (
                DailyPrice.objects.filter(symbol__in=UNIVERSE)
                .order_by("symbol", "-date")
                .values("symbol", "close")
            )
            seen = set()
            for r in rows:
                if r["symbol"] not in seen:
                    seen.add(r["symbol"])
                    try:
                        prices[r["symbol"]] = float(r["close"])
                    except (TypeError, ValueError):
                        pass
        except Exception:
            pass
        return prices

    @transaction.atomic
    def _seed(self, names):
        from django.utils import timezone as tz
        User = get_user_model()
        from identity_access.models import CoreServiceAccount, CoreTenant
        from market_data.models import StockProfile
        from user_workspace.models import (
            AccountSnapshot, Portfolio, PriceAlert, ScreenerRule,
            SubAccount, TrackedSymbol, Transaction, Watchlist, WatchlistItem,
        )
        from signal_intelligence.models import (
            OrderFlowEvent, UnifiedAlert, WhaleAlertCanonical,
        )
        from advisory.models import AdvisoryRecord, AdvisorySession, AdvisoryComponent
        from commercial.models import QuotaRecord, Subscription

        prices = self._price_map()
        today = tz.now().date()
        now = tz.now()

        # 1. StockProfile cho 50 ma.
        for sym in UNIVERSE:
            StockProfile.objects.get_or_create(
                symbol=sym,
                defaults={
                    "company_name": sym, "exchange": "HOSE",
                    "industry": INDUSTRY.get(sym, "Tong hop"), "status": "active",
                },
            )

        counts = {"users": 0, "tx": 0, "alerts": 0, "flows": 0, "advisory": 0}
        for uname in names:
            cfg = PERSONAS[uname]
            user, created = User.objects.get_or_create(
                username=uname, defaults={"email": f"{uname}@qa.local", "is_active": True},
            )
            if created:
                user.set_password(PASSWORD)
                user.save()
                counts["users"] += 1
            tenant, _ = CoreTenant.objects.get_or_create(
                owner_user=user,
                defaults={
                    "tenant_code": f"qa-{uname}", "display_name": cfg["display"],
                    "plan": cfg["plan"], "status": "active",
                },
            )
            # Login gate: can Service Account active (giong register.py:248).
            if uname == "qa_staff":
                sa_scopes = ["market:read", "signals:read", "ai:invoke", "manage_pats", "manage_tenant"]
            elif uname == "qa_tenant_admin":
                sa_scopes = ["market:read", "signals:read", "manage_pats", "manage_tenant"]
            else:
                sa_scopes = ["market:read", "signals:read"]
            CoreServiceAccount.objects.get_or_create(
                tenant=tenant, name="default",
                defaults={"status": CoreServiceAccount.StatusChoices.ACTIVE, "scopes": sa_scopes},
            )

            for pf_name, symbols in cfg["portfolios"]:
                pf, _ = Portfolio.objects.get_or_create(
                    user=user, tenant=tenant, name=pf_name,
                    defaults={"description": f"{MARKER} {pf_name}", "opening_balance": Decimal("2000000000")},
                )
                # Sub-accounts: Cash + Margin (trader/whale co them Margin).
                for sub_type, sub_name in (("1", "Tien mat"), ("6", "Ky quy")):
                    SubAccount.objects.get_or_create(
                        user=user, tenant=tenant, portfolio=pf, type=sub_type,
                        defaults={"broker": "DNSE", "display_name": f"{pf_name} - {sub_name}"},
                    )
                # Transactions neo theo gia DailyPrice that.
                lot = 100
                for i, sym in enumerate([s for s in symbols if s in prices]):
                    if sym == "VN30-ETF":
                        continue
                    px = Decimal(str(prices[sym]))
                    buy_date = today - timedelta(days=60 - i * 5)
                    if not Transaction.objects.filter(
                        portfolio=pf, symbol=sym, transaction_type="BUY", date=buy_date,
                    ).exists():
                        Transaction.objects.create(
                            portfolio=pf, tenant=tenant, symbol=sym,
                            transaction_type="BUY", date=buy_date,
                            price=px * Decimal("0.94"), quantity=(i + 2) * lot,
                            fee=Decimal("5000"), tax=Decimal("0"),
                        )
                        counts["tx"] += 1
                    # Trader: them lenh SELL (da chot loi 1 phan) + DIVIDEND cho longterm/bank.
                    if uname == "qa_trader" and i % 2 == 0:
                        sell_date = today - timedelta(days=10 - i)
                        if not Transaction.objects.filter(
                            portfolio=pf, symbol=sym, transaction_type="SELL", date=sell_date,
                        ).exists():
                            Transaction.objects.create(
                                portfolio=pf, tenant=tenant, symbol=sym,
                                transaction_type="SELL", date=sell_date,
                                price=px * Decimal("1.03"), quantity=lot,
                                fee=Decimal("5000"), tax=Decimal("10000"),
                            )
                            counts["tx"] += 1
                    if uname in ("qa_longterm", "qa_bank") and i % 3 == 0:
                        div_date = today - timedelta(days=30)
                        if not Transaction.objects.filter(
                            portfolio=pf, symbol=sym, transaction_type="DIVIDEND", date=div_date,
                        ).exists():
                            Transaction.objects.create(
                                portfolio=pf, tenant=tenant, symbol=sym,
                                transaction_type="DIVIDEND", date=div_date,
                                price=Decimal("0"), quantity=(i + 2) * lot,
                                fee=Decimal("0"), tax=Decimal("0"),
                            )
                            counts["tx"] += 1
                # AccountSnapshot 30 ngay (NAV = cash + stock_value - debt).
                sub = pf.sub_accounts.first()
                if sub:
                    for d in range(30):
                        sdate = today - timedelta(days=29 - d)
                        stock_val = sum(
                            Decimal(str(prices.get(s, 0))) * 200 for s in symbols if s in prices
                        )
                        AccountSnapshot.objects.get_or_create(
                            sub_account=sub, date=sdate,
                            defaults={
                                "net_equity": Decimal("2000000000") + stock_val,
                                "cash_balance": Decimal("2000000000"),
                                "stock_value": stock_val, "debt": Decimal("0"),
                            },
                        )

            for wl_name, symbols in cfg["watchlists"].items():
                wl, _ = Watchlist.objects.get_or_create(
                    user=user, tenant=tenant, name=wl_name,
                    defaults={"description": MARKER},
                )
                for sym in symbols:
                    WatchlistItem.objects.get_or_create(watchlist=wl, symbol=sym)
                    TrackedSymbol.objects.get_or_create(
                        user=user, tenant=tenant, symbol=sym,
                        defaults={
                            "source_watchlist": wl,
                            "whale_alert_threshold_million": cfg["whale_threshold"],
                            "is_active": True,
                        },
                    )

            for sym, cond, pct in cfg["alerts"]:
                if sym not in prices:
                    continue
                target = Decimal(str(prices[sym])) * (Decimal("1") + Decimal(str(pct)))
                atype = PriceAlert.AlertType.ABOVE if cond == "ABOVE" else PriceAlert.AlertType.BELOW
                PriceAlert.objects.get_or_create(
                    user=user, tenant=tenant, symbol=sym, alert_type=atype,
                    price_threshold=target,
                    defaults={"status": PriceAlert.AlertStatus.ACTIVE, "is_enabled": True,
                              "cooldown_seconds": 900, "notify_email": True},
                )

            # Screener: 2 rule/persona (1 active + 1 public cho tenant_admin).
            ScreenerRule.objects.get_or_create(
                user=user, tenant=tenant, name="Bluechip VN30 tang thanh khoan",
                defaults={"rules_json": {"universe": "VN30", "filters": [
                    {"field": "rsi14", "op": "<", "value": 50},
                    {"field": "momentum_5d_pct", "op": ">", "value": 1.5}]},
                    "is_active": True},
            )
            if uname == "qa_bank":
                ScreenerRule.objects.get_or_create(
                    user=user, tenant=tenant, name="Bank giu nen SMA20",
                    defaults={"rules_json": {"universe": ["ACB", "TCB", "MBB", "VPB"],
                        "filters": [{"field": "sma20_dev_pct", "op": "between", "value": [-5, 5]}]},
                        "is_active": True},
                )
            if uname == "qa_tenant_admin":
                ScreenerRule.objects.get_or_create(
                    user=user, tenant=tenant, name="Midcap VN100 breakout",
                    defaults={"rules_json": {"universe": "VN100_EXT",
                        "filters": [{"field": "volume_ratio_20d", "op": ">", "value": 1.5},
                                    {"field": "price_3d_pct", "op": ">", "value": 2.0}]},
                        "is_active": True, "is_public": True},
                )

            # UnifiedAlert + Whale canopy + OrderFlow + Advisory (2 phien, ma uu tien).
            focus = (cfg["portfolios"][0][1] if cfg["portfolios"] else ["FPT"])[:4]
            for day_off in (0, 1):
                sdate = today - timedelta(days=day_off)
                trig = (now - timedelta(days=day_off)).replace(hour=10, minute=30, second=0, microsecond=0)
                for j, sym in enumerate([s for s in focus if s in prices]):
                    if sym == "VN30-ETF":
                        continue
                    px = Decimal(str(prices[sym]))
                    is_buy = (j + day_off) % 2 == 0
                    side = "buy" if is_buy else "sell"
                    sev = "high" if sym in VN30 else "medium"
                    sref = f"{MARKER}:{uname}:{sdate}:{sym}"
                    ua, ua_created = UnifiedAlert.objects.get_or_create(
                        source_ref=sref,
                        defaults={
                            "alert_type": "whale", "symbol": sym, "severity": sev,
                            "confidence": 0.85, "freshness_state": "fresh",
                            "title": f"Whale {side.upper()} {sym}",
                            "body": f"{MARKER} matched_value derived from DailyPrice close.",
                            "value": px * 50000, "direction": side,
                            "session_date": sdate, "triggered_at": trig,
                            "evidence": {"source": MARKER, "close": float(px)},
                        },
                    )
                    if ua_created:
                        counts["alerts"] += 1
                        WhaleAlertCanonical.objects.get_or_create(
                            alert=ua,
                            defaults={"symbol": sym, "session_date": sdate, "side": side,
                                      "price": px, "volume": 50000,
                                      "matched_value": int(px * 50000),
                                      "is_dark_flow": (j == 2), "executed_at": trig},
                        )
                        OrderFlowEvent.objects.get_or_create(
                            source_ref=f"{sref}:flow",
                            defaults={"symbol": sym, "session_date": sdate,
                                      "signal_type": "whale_buy" if is_buy else "whale_sell",
                                      "side": side, "strength": 82.5,
                                      "whale_intensity": 0.78,
                                      "price_at_signal": px, "volume_at_signal": 50000,
                                      "unified_alert": ua, "triggered_at": trig,
                                      "metadata": {"source": MARKER}},
                        )
                        counts["flows"] += 1
            # Advisory: 1 record + 1 session (4 components) cho focus[0].
            if focus and focus[0] in prices:
                sym0 = focus[0]
                AdvisoryRecord.objects.get_or_create(
                    symbol=sym0, session_date=today, user=user,
                    defaults={"status": "generated", "ai_model": "gemini-2.5-flash",
                              "advisory_text": f"{MARKER} Nhan dinh {sym0}: xu huong theo VN30, close {prices[sym0]}.",
                              "structured_output": {"signal": "hold", "confidence": 0.72,
                                                    "summary": f"Theo doi {sym0} trong VN30/VN100."},
                              "context_snapshot": {"close": prices[sym0], "universe": "VN30/VN100"},
                              "tokens_used": 850, "generated_at": now},
                )
                sess, _ = AdvisorySession.objects.get_or_create(
                    user=user, symbol=sym0, session_date=today,
                    defaults={"status": "completed", "ai_model": "gemini-2.5-flash",
                              "tokens_used": 850, "token_budget": 2000,
                              "context_snapshot": {"close": prices[sym0]}},
                )
                for order, ctype in enumerate(["technical", "whale", "recommendation", "summary"]):
                    AdvisoryComponent.objects.get_or_create(
                        session=sess, component_type=ctype,
                        defaults={"content": f"{MARKER} {ctype} cho {sym0}.",
                                  "metadata": {"source": MARKER}, "order": order},
                    )
                counts["advisory"] += 1

            # Commercial: Subscription + QuotaRecord (tenant_admin = PRO active).
            period_start = today.replace(day=1)
            period_end = (today + timedelta(days=30))
            Subscription.objects.get_or_create(
                tenant=tenant,
                defaults={"plan": cfg["plan"], "status": "active",
                          "current_period_start": period_start, "current_period_end": period_end},
            )
            QuotaRecord.objects.get_or_create(
                tenant=tenant, period_start=period_start, period_end=period_end,
                defaults={"api_calls_used": 120 if uname == "qa_tenant_admin" else 15,
                          "api_calls_limit": 10000, "symbols_used": 12, "symbols_limit": 100,
                          "users_used": 1, "users_limit": 5},
            )

        self.stdout.write(
            f"OK seed {MARKER}: users={counts['users']} tx={counts['tx']} "
            f"alerts={counts['alerts']} flows={counts['flows']} advisory={counts['advisory']}"
        )

    @transaction.atomic
    def _delete(self):
        User = get_user_model()
        from signal_intelligence.models import MarketAnomalyEvent, OrderFlowEvent, UnifiedAlert
        OrderFlowEvent.objects.filter(source_ref__startswith=MARKER).delete()
        MarketAnomalyEvent.objects.filter(source_ref__startswith=MARKER).delete()
        UnifiedAlert.objects.filter(source_ref__startswith=MARKER).delete()
        n_users, _ = User.objects.filter(username__startswith="qa_").delete()
        self.stdout.write(f"OK delete {MARKER}: qa users deleted={n_users}")
