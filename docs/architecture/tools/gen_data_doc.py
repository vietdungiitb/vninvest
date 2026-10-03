#!/usr/bin/env python3
"""Sinh `docs/architecture/D02_DATA_AND_ARCHITECTURE.md` tu **model Django that**.

Vì sao sinh bằng script chứ không viết tay
----------------------------------------
107 model × trung bình 10 trường. Viết tay nghĩa là:
- chắc chắn sai ở một chỗ nào đó, và sai ấy **không ai phát hiện** vì trông
  rất giống hàng bên cạnh;
- mỗi lần model đổi là phải sửa lại toàn bảng;
- không kiểm chứng được — không có cách nào biết tài liệu còn khớp code.

Sinh từ runtime thì: luôn khớp, và `python tools/gen_data_doc.py` tái chạy được.

Cách dùng
---------
    python docs/architecture/tools/gen_data_doc.py

Ghi đè `docs/architecture/D02_DATA_AND_ARCHITECTURE.md` (phần sinh tự động).
Phần viết tay trong file đó được giữ nguyên — script chỉ thay giữa hai marker.
"""
from __future__ import annotations

import datetime
import os
import re
import sys
import uuid
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent.parent.parent
SRC = REPO / "packages" / "core" / "backend" / "src"
OUT = REPO / "docs" / "architecture" / "D02_DATA_AND_ARCHITECTURE.md"

BEGIN = "<!-- BEGIN GENERATED: data-model -->"
END = "<!-- END GENERATED: data-model -->"

sys.path.insert(0, str(SRC))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "vninvest_core.settings")
os.environ.setdefault("DJANGO_DEBUG", "1")

import django  # noqa: E402

django.setup()

from django.apps import apps as django_apps  # noqa: E402
from django.db import models  # noqa: E402

#: Cụm nghiệp vụ — gom model theo **bounded context**, KHÔNG theo app.
#: `identity_access` (24 model) trải ra 3 cụm, nên gom theo app sẽ vô nghĩa.
#: Bảng này là phần duy nhất phải duy trì thủ công; thêm model mới mà quên
#: khai báo sẽ bị script báo (không im lặng bỏ sót).
CLUSTERS: list[tuple[str, str, list[str]]] = [
    ("C1", "Định danh & Tenant", [
        "identity_access.CoreTenant", "identity_access.TenantSettings",
        "identity_access.UserProfile", "identity_access.TenantCustomRole",
        "identity_access.TenantMember", "identity_access.TenantInvite",
    ]),
    ("C2", "Credential & Truy cập", [
        "identity_access.CoreServiceAccount", "identity_access.CorePATCredential",
        "identity_access.PATAuditLog", "identity_access.PasswordResetToken",
        "identity_access.UserDNSECredential", "identity_access.SystemBrokerCredential",
        "identity_access.TenantSSOConfig", "identity_access.UsageAlertConfig",
        "identity_access.LoginAttempt", "identity_access.EmailVerificationToken",
    ]),
    ("C3", "Nền tảng chung (outbox, mail, báo cáo, webhook)", [
        "identity_access.OutboxEvent", "identity_access.ProcessedEvent",
        "identity_access.SystemMailConfig", "identity_access.MailConfigAuditLog",
        "identity_access.ScheduledReport", "identity_access.ReportDeliveryLog",
        "identity_access.TenantWebhookConfig", "identity_access.WebhookDelivery",
    ]),
    ("C4", "Thuê bao & Thanh toán", [
        "commercial.Subscription", "commercial.QuotaRecord", "commercial.QuotaHistory",
        "commercial.Invoice", "commercial.PaymentTransaction", "commercial.VNPayIPNLog",
        "tenant_lifecycle.TenantLifecycleEvent",
    ]),
    ("C5", "Dữ liệu thị trường thô", [
        "market_data.StockProfile", "market_data.DailyPrice", "market_data.IntradayBar",
        "market_data.IntradayTick", "market_data.GlobalSymbolRegistry",
        "market_data.GlobalSymbolDemandSource", "market_data.GlobalSymbolCoverage",
        "market_data.VnbrokerRuntimeConfig", "data_ingest.IngestJob", "data_ingest.IngestRun",
    ]),
    ("C6", "Vật chất hoá thị trường (serving)", [
        "market_serving.SymbolSnapshot", "market_serving.SessionFacts",
        "market_serving.SessionFactsBucket",
    ]),
    ("C7", "Tín hiệu & Cảnh báo", [
        "signal_intelligence.UnifiedAlert", "signal_intelligence.WhaleAlertCanonical",
        "signal_intelligence.OrderFlowEvent", "signal_intelligence.MarketAnomalyEvent",
        "signal_intelligence.AdvisorySignalEvent", "signal_intelligence.UserAlertDelivery",
        "signal_intelligence.UserAlertPreference",
    ]),
    ("C8", "Danh mục, Ledger & Giao dịch", [
        "user_workspace.Portfolio", "user_workspace.Transaction",
        "user_workspace.Watchlist", "user_workspace.WatchlistItem",
        "user_workspace.TrackedSymbol", "user_workspace.PriceAlert",
        "user_workspace.SubAccount", "user_workspace.AccountSnapshot",
        "user_workspace.QuarantinedRecord", "user_workspace.LedgerEntry",
        "user_workspace.CashFlow", "user_workspace.PositionSnapshot",
        "user_workspace.ValuationSnapshot", "user_workspace.IdempotencyRecord",
    ]),
    ("C9", "Broker & Bộ lọc", [
        "user_workspace.DNSECredential", "user_workspace.UserBrokerConfig",
        "user_workspace.ScreenerRule", "user_workspace.ScreenerRunHistory",
        "user_workspace.ScreenerSchedule",
    ]),
    ("C10", "AI & Advisory", [
        "advisory.SystemAISettings", "advisory.AdvisoryRecord",
        "advisory.AdvisorySession", "advisory.AdvisoryComponent",
        "advisory.UserAICredential", "advisory.AIAuditLog",
        "ai_agents.AgentRegistry", "ai_analytics.AIUsageRecord",
        "ai_analytics.AIUsageSummary",
    ]),
    ("C11", "Vận hành & Kiểm toán", [
        "service_ops.ServiceDefinition", "service_ops.ServiceConfig",
        "service_ops.ServiceHealth", "service_ops.ServiceHealthCheckLog",
        "service_ops.ServiceRunLog", "service_ops.OwnershipRecord",
        "service_ops.ConfigChangeAudit", "service_ops.ScrapeMatrix",
        "service_ops.ScrapeMatrixCell", "service_ops.CustomSymbolGroup",
        "service_ops.CachedSymbolGroup", "service_ops.CachedSymbolGroupMember",
        "service_ops.BackfillExecutionRun", "service_ops.BackfillExecutionBatch",
        "service_ops.MarketDataParitySnapshot",
        "ops_audit.AuditEvent", "ops_audit.RequestTrace", "ops_audit.ApiCallRollup",
    ]),
    ("C12", "Hỗ trợ & Quảng cáo", [
        "support.SupportTicket", "support.TicketMessage", "support.TicketAttachment",
        "support.TicketAuditLog", "support.SupportTicketCounter",
        "advertising.TrademarkConfig", "advertising.AdCampaign",
        "advertising.AdDailySummary", "advertising.AdImpressionLog",
        "advertising.AdClickLog",
    ]),
]


def jtype(f) -> str:
    """Kiểu trong ERD Mermaid. Mermaid không nhận `CharField(max_length=36)`
    nên phải rút gọn — giữ nguyên chi tiết cho Data Dictionary."""
    t = f.get_internal_type()
    if t == "ForeignKey":
        # Cột FK thật là bigint/uuid. Ghi "fk" cho gọn; kiểu đầy đủ nằm ở
        # Data Dictionary. Ghi "foreignkey" là nhãn dài vô nghĩa trong sơ đồ.
        return "fk"
    return {
        "CharField": "char", "TextField": "text", "SlugField": "char",
        "EmailField": "char", "URLField": "char", "UUIDField": "uuid",
        "IntegerField": "int", "BigIntegerField": "int",
        "SmallIntegerField": "int", "PositiveIntegerField": "int",
        "PositiveBigIntegerField": "int", "AutoField": "int",
        "BigAutoField": "int", "SmallAutoField": "int",
        "BooleanField": "bool", "NullBooleanField": "bool",
        "DateTimeField": "datetime", "DateField": "date", "TimeField": "time",
        "DurationField": "interval", "DecimalField": "decimal",
        "FloatField": "float", "JSONField": "json",
        "BinaryField": "binary", "GenericIPAddressField": "ip",
    }.get(t, t.lower())


def on_delete_name(od) -> str:
    """`models.CASCADE` là **hàm**, nên `type(od).__name__` ra `'function'`.

    Phải so sánh theo danh tính với hằng của Django thì mới ra tên đọc được.
    """
    for label, const in (
        ("CASCADE", models.CASCADE), ("SET_NULL", models.SET_NULL),
        ("SET_DEFAULT", models.SET_DEFAULT), ("DO_NOTHING", models.DO_NOTHING),
        ("PROTECT", models.PROTECT), ("RESTRICT", models.RESTRICT),
    ):
        if od is const:
            return label
    return getattr(od, "__name__", type(od).__name__)


def is_auto(f) -> bool:
    """Trường tự sinh (`AutoField`, `auto_now`, `auto_now_add`).

    Cần để **không** báo nhầm `blank=True nhưng NOT NULL`: Django mặc định đặt
    `blank=True` cho PK, nên kiểm tra `blank and not null` bắt nhầm mọi bảng.
    """
    if isinstance(f, models.AutoField):
        return True
    return bool(getattr(f, "auto_now", False) or getattr(f, "auto_now_add", False))


def default_repr(f) -> str:
    d = f.default
    if d is None or d is models.NOT_PROVIDED:
        return "—"
    if callable(d):
        try:
            d = d()
        except Exception:  # noqa: BLE001
            return "callable"
    if isinstance(d, (datetime.datetime, datetime.date, datetime.time)):
        return f"`{d.isoformat()}`"
    if isinstance(d, uuid.UUID):
        return "`uuid4()`"
    s = str(d)
    if s == "":
        return '`""`'
    if len(s) > 28:
        s = s[:25] + "…"
    return f"`{s}`"


def key_of(f) -> str:
    if f.primary_key:
        return "PK"
    if f.unique:
        return "UK"
    if f.remote_field and f.remote_field.model:
        return "FK"
    return ""


def related_name_for(f) -> str:
    rn = getattr(f.remote_field, "related_name", None) if f.remote_field else None
    return rn or ""


def collect(model) -> dict:
    rows = []
    for f in model._meta.get_fields():
        if not getattr(f, "concrete", False):
            continue
        attname = f.attname
        rows.append(dict(
            name=attname,
            column=f.column,
            jtype=jtype(f),
            full=f"{f.get_internal_type()}"
                 + (f"({f.max_length})" if getattr(f, "max_length", None) else "")
                 + (f"({f.max_digits},{f.decimal_places})"
                    if getattr(f, "max_digits", None) else ""),
            null=bool(f.null),
            blank=bool(f.blank),
            auto=is_auto(f),
            default=default_repr(f),
            key=key_of(f),
            db_index=bool(getattr(f, "db_index", False)),
            target=(f"{f.related_model._meta.app_label}.{f.related_model.__name__}"
                    if f.remote_field and f.related_model else None),
            on_delete=(on_delete_name(f.remote_field.on_delete)
                       if f.remote_field and hasattr(f.remote_field, "on_delete")
                       else ""),
            choices=len(getattr(f, "choices", []) or []) or None,
        ))
    meta = model._meta
    cons = []
    for c in meta.constraints:
        cons.append(f"`{c.name}`")
    idx = [i.name for i in meta.indexes]
    uq = [c for c in (meta.unique_together or [])]
    return dict(
        app=meta.app_label,
        name=meta.object_name,
        table=meta.db_table,
        verbose=str(meta.verbose_name),
        rows=rows,
        constraints=cons,
        indexes=idx,
        unique_together=[str(x) for x in uq],
        # `Meta.pk` là **field**, không phải composite → không có `get_fields()`.
        # Chỉ cần tên cột PK là đủ cho Data Dictionary.
        pk=[meta.pk.name] if meta.pk else [],
    )


def resolve(label: str):
    app_label, model_name = label.split(".")
    return django_apps.get_model(app_label, model_name)


def md_table(rows: list[dict]) -> list[str]:
    out = ["| Trường | Cột | Kiểu | Null | Mặc định | Khoá | Ghi chú |",
           "|---|---|---|---|---|---|---|"]
    for r in rows:
        notes = []
        if r["db_index"] and r["key"] != "FK":
            notes.append("index")
        if r["choices"]:
            notes.append(f"{r['choices']} choices")
        if r["on_delete"]:
            notes.append(f"on_delete={r['on_delete']}")
        if r["target"]:
            notes.append(f"→ `{r['target']}`")
        # Chỉ cảnh báo `blank` trên trường **nghiệp vụ**. Trường tự sinh
        # (PK, auto_now) có `blank=True` theo thiết kế Django — báo nhầm ở mọi
        # bảng làm thông điệp này mất giá trị.
        if r["blank"] and not r["null"] and not r["auto"]:
            notes.append("**blank nhưng NOT NULL**")
        out.append(
            f"| `{r['name']}` | `{r['column']}` | `{r['full']}` | "
            f"{'✓' if r['null'] else '—'} | {r['default']} | "
            f"{r['key'] or '—'} | {'; '.join(notes) or ''} |")
    return out


def er_block(cid: str, title: str, labels: list[str], data: dict) -> list[str]:
    lines = ["```mermaid", "erDiagram"]
    entities = {}
    for lb in labels:
        m = resolve(lb)
        if m is None:
            continue
        d = data[lb]
        entities[lb] = d
        # ERD chỉ giữ PK/FK + trường nghiệp vụ chính, để sơ đồ đọc được
        keep = [r for r in d["rows"] if r["key"] in ("PK", "FK")]
        seen = {r["name"] for r in keep}
        for r in d["rows"]:
            if r["key"] == "" and r["name"] not in seen and \
                    len(keep) < 9 and not r["choices"]:
                keep.append(r)
                seen.add(r["name"])
        keep = keep[:10]
        lines.append(f"    {m.__name__} {{")
        for r in keep:
            attr = re.sub(r"[^A-Za-z0-9_]", "_", r["name"])
            k = f" {r['key']}" if r["key"] else ""
            lines.append(f"        {r['jtype']} {attr}{k}")
        lines.append("    }")
    # quan hệ
    for lb, d in entities.items():
        m = resolve(lb)
        for r in d["rows"]:
            if not r["target"] or r["target"] not in entities:
                continue
            tgt = resolve(r["target"])
            src_card = "||--o{" if not r["null"] else "|o--o{"
            lines.append(
                f'    {tgt.__name__} {src_card} {m.__name__} : "{r["name"]}"')
    lines.append("```")
    return lines


def main() -> int:
    labels: list[str] = []
    missing: list[str] = []
    for _cid, _title, group in CLUSTERS:
        for lb in group:
            try:
                resolve(lb)
            except Exception:  # noqa: BLE001
                missing.append(lb)
                continue
            labels.append(lb)

    # Model của Django/thư viện không phải của repo, nhưng **hai cái là gánh
    # nặng** và phải nêu tên tường minh:
    #  - `auth.User`: mọi hồ sơ người dùng đều trỏ tới nó.
    #  - `django_celery_beat.PeriodicTask`: beat schedule nằm trong DB, không
    #    phải trong `settings.py` ⇒ lệch `settings.py` là lệch runtime thật.
    FRAMEWORK_APPS = {
        "auth", "admin", "contenttypes", "sessions", "django_celery_beat",
    }
    all_models = {
        f"{m._meta.app_label}.{m.__name__}"
        for m in django_apps.get_models()
        if not m._meta.abstract
    }
    declared = {lb for _c, _t, g in CLUSTERS for lb in g}
    framework = sorted(
        f"{m._meta.app_label}.{m.__name__}" for m in django_apps.get_models()
        if m._meta.app_label in FRAMEWORK_APPS and not m._meta.abstract
    )
    framework_set = set(framework)
    orphan = sorted(all_models - declared - framework_set)
    dead = sorted(declared - all_models)

    data = {lb: collect(resolve(lb)) for lb in labels}

    out: list[str] = [BEGIN, "",
                      "<!-- Sinh boi docs/architecture/tools/gen_data_doc.py -",
                      "     KHONG sua tay. Chay lai: python",
                      "     docs/architecture/tools/gen_data_doc.py -->", ""]

    out += ["## 4.0 Tổng quan", "",
            f"- **{len(labels)}** model được mô tả trong {len(CLUSTERS)} cụm nghiệp vụ.",
            "- Sinh từ `django.apps.get_models()` nên **luôn khớp code**.",
            "- `PK` = primary key · `FK` = foreign key · `UK` = unique.", ""]

    if orphan:
        out += ["> [!WARNING]", "> **Model chưa được khai báo trong CLUSTERS** — "
                "tài liệu bỏ sót, cần thêm vào `tools/gen_data_doc.py`:", "",
                *[f"> - `{o}`" for o in orphan], ""]
    if missing:
        out += ["> [!WARNING]", "> **Khai báo trong CLUSTERS nhưng không resolve "
                "được** (đã bị xoá/đổi tên?):", "",
                *[f"> - `{m}`" for m in missing], ""]
    if dead:
        out += ["> **Trong CLUSTERS nhưng không có trong registry:** "
                + ", ".join(f"`{d}`" for d in dead), ""]

    # Bảng của framework: nêu tường minh vì ảnh hưởng tới hiệu lực thiết kế.
    out += ["> **Bảng của framework không mô tả ở đây** (không thuộc repo, "
            "nhưng bạn vẫn phụ thuộc):", ""]
    key = {"auth.User": "gốc của mọi hồ sơ người dùng — "
                        "`CoreTenant.owner_user`, `TenantMember.user`, "
                        "`PATAuditLog.pat`…",
           "django_celery_beat.PeriodicTask": "**nguồn sự thật của beat schedule**. "
                                              "Nó nằm trong DB, **không** nằm trong "
                                              "`settings.py` ⇒ sửa `settings.py` "
                                              "mà không `repair_beat_schedule` thì "
                                              "runtime **không đổi**.",
           "admin.LogEntry": "audit log của Django admin.",
           "contenttypes.ContentType": "khóa ngoại của Django contenttypes.",
           "sessions.Session": "không dùng — xác thực bằng PAT, không dùng session "
                               "Django. Có thể cân nhắc bỏ nếu không bật admin login.",
           "auth.Permission": "bảng quyền mặc định của Django.",
           "auth.Group": "không dùng — repo dùng `TenantMember.role` + "
                         "`TenantCustomRole.permissions`.",
           "django_celery_beat.IntervalSchedule":
               "lịch chạy theo số giây — nhiều entry trong "
               "`CELERY_BEAT_SCHEDULE` dùng loại này.",
           "django_celery_beat.CrontabSchedule":
               "lịch theo cron — ví dụ `daily-db-backup-2am`.",
           "django_celery_beat.ClockedSchedule": "lịch theo mốc thời gian tuyệt đối.",
           "django_celery_beat.SolarSchedule": "theo vị trí mặt trời — có vẻ không dùng.",
           "django_celery_beat.PeriodicTasks":
               "model **lịch sử** mà Django giữ lại để migrate. Không dùng — "
               "nếu thấy nó trong DB thì đừng đọc, hãy đọc `PeriodicTask`."}
    for m in framework:
        if m in key:
            out.append(f"> - `{m}` — {key[m]}")
    out.append("")

    # --- 4.1 ERD theo cụm
    out += ["---", "", "## 4.1 ERD theo cụm nghiệp vụ", "",
            "> ERD lược lọc: mỗi entity giữ PK/FK + tối đa 10 trường để đọc nổi.",
            "> Trường đầy đủ nằm ở §4.2.", ""]
    for cid, title, group in CLUSTERS:
        present = [lb for lb in group if lb in data]
        if not present:
            continue
        total_fields = sum(len(data[lb]["rows"]) for lb in present)
        out += [f"### {cid} — {title}", "",
                f"*{len(present)} model · {total_fields} trường*", ""]
        out += er_block(cid, title, present, data)
        out.append("")

    # --- 4.2 Data Dictionary
    out += ["---", "", "## 4.2 Từ điển dữ liệu (Data Dictionary)", ""]
    for cid, title, group in CLUSTERS:
        present = [lb for lb in group if lb in data]
        if not present:
            continue
        out += [f"### {cid} — {title}", ""]
        for lb in present:
            d = data[lb]
            out += [f"#### `{d['table']}` — {d['name']}", "",
                    f"- Model: `{lb}` · `{d['verbose']}`",
                    f"- PK: {', '.join('`'+p+'`' for p in d['pk']) or '—'}"]
            if d["unique_together"]:
                out.append("- `unique_together`: "
                           + "; ".join(f"`{u}`" for u in d["unique_together"]))
            if d["constraints"]:
                out.append("- `Meta.constraints`: " + ", ".join(d["constraints"]))
            if d["indexes"]:
                out.append("- `Meta.indexes`: "
                           + ", ".join(f"`{i}`" for i in d["indexes"]))
            out.append("")
            out += md_table(d["rows"])
            out.append("")
    out.append(END)

    existing = OUT.read_text(encoding="utf-8") if OUT.exists() else ""
    if BEGIN in existing and END in existing:
        pre = existing.split(BEGIN)[0]
        post = existing.split(END)[1]
        new = pre + "\n".join(out) + post
    elif existing:
        new = existing.rstrip() + "\n\n---\n\n" + "\n".join(out) + "\n"
    else:
        new = "\n".join(out) + "\n"
    OUT.write_text(new, encoding="utf-8")

    print(f"OK  {OUT.relative_to(REPO)}")
    print(f"    models described : {len(labels)}")
    print(f"    clusters         : {len(CLUSTERS)}")
    print(f"    orphan models    : {len(orphan)} {orphan if orphan else ''}")
    print(f"    unresolvable     : {len(missing)} {missing if missing else ''}")
    print(f"    bytes written    : {OUT.stat().st_size}")
    return 1 if (orphan or missing) else 0


if __name__ == "__main__":
    raise SystemExit(main())