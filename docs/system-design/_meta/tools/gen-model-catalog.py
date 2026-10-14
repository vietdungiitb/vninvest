#!/usr/bin/env python3
"""gen-model-catalog.py -- sinh danh muc model + migration tu Django runtime.

MUC DICH
    Liet ke 107 model theo 15 app nghiep vu (field, kieu, FK, tenant FK,
    constraints) + 115 migration theo app. Ghi
    ``06-DATA-ARCHITECTURE/06.02-danh-muc-model.md``. Con nguoi KHONG viet tay
    danh muc (nguyen tac 00.03 s1).

CACH CHAY (tu goc repo)
    python docs/system-design/_meta/tools/gen-model-catalog.py --write
    python docs/system-design/_meta/tools/gen-model-catalog.py --check [file]

NGUYEN TAC
    - Chi DOC (apps.get_models + doc migrations/, khong cham DB).
    - Dinh nghia "app nghiep vu" COPY tu measure_repo.py::count_apps.
    - Exit 0 = sach/khop, 1 = lech, 2 = khong verify duoc. So sanh bo dong
      ngay sinh (ngay doi theo ngay chay la dung).
    - Cot "tenant FK": field ten `tenant`/`tenant_id` hoac FK toi CoreTenant.
      Day la cot audit cach ly tenant quan trong nhat cua bang nay.
"""

import os
import sys

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(
    os.path.dirname(os.path.abspath(__file__))))))
SRC = os.path.join(REPO, "packages", "core", "backend", "src")
OUT_REL = os.path.join("docs", "system-design", "06-DATA-ARCHITECTURE",
                        "06.02-danh-muc-model.md")


def project_apps():
    """15 app nghiep vu: co apps.py, tru vninvest_core (== count_apps)."""
    out = []
    for name in sorted(os.listdir(SRC)):
        d = os.path.join(SRC, name)
        if not os.path.isdir(d) or name.startswith("_"):
            continue
        if name == "vninvest_core":
            continue
        if os.path.exists(os.path.join(d, "apps.py")):
            out.append(name)
    return out


def collect():
    sys.path.insert(0, SRC)
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "vninvest_core.settings")
    os.environ.setdefault("DJANGO_DEBUG", "1")
    import django  # noqa: E402

    django.setup()
    from django.apps import apps as _apps  # noqa: E402

    by_app = {a: [] for a in project_apps()}
    for model in _apps.get_models(include_auto_created=False):
        label = model._meta.app_label
        if label not in by_app:
            continue
        fields = []
        tenant = False
        for f in list(model._meta.fields) + list(
                model._meta.local_many_to_many):
            ftype = f.__class__.__name__
            rel = ""
            if getattr(f, "many_to_one", False) or getattr(
                    f, "one_to_one", False):
                rel = " -> %s" % f.related_model.__name__
            elif getattr(f, "many_to_many", False):
                rel = " -> M2M %s" % f.related_model.__name__
            if f.name in ("tenant", "tenant_id") or (
                    rel and "CoreTenant" in rel):
                tenant = True
            null = " NULL" if getattr(f, "null", False) else ""
            fields.append("%s: %s%s%s" % (f.name, ftype, rel, null))
        cons = [c.name for c in model._meta.constraints]
        if model._meta.unique_together:
            cons.append("unique_together=%s" % list(
                model._meta.unique_together))
        by_app[label].append({
            "model": model.__name__,
            "table": model._meta.db_table,
            "tenant": tenant,
            "fields": fields,
            "constraints": cons,
        })
    for arr in by_app.values():
        arr.sort(key=lambda m: m["model"])
    migs = {}
    for app in by_app:
        md = os.path.join(SRC, app, "migrations")
        names = []
        if os.path.isdir(md):
            names = sorted(f[:-3] for f in os.listdir(md)
                           if f.startswith("0") and f.endswith(".py"))
        migs[app] = names
    return by_app, migs


def render(by_app, migs, date):
    L = []
    L.append("# 06.02 — Danh Mục Model (Máy Sinh, Không Sửa Tay)")
    L.append("")
    L.append("> Sinh ngày %s bằng "
             "`docs/system-design/_meta/tools/gen-model-catalog.py` "
             "(Django runtime: `apps.get_models` + doc `migrations/`)."
             % date)
    L.append("> Lệch với code ⇒ `--check` đỏ. Muốn sửa: đổi model/migration "
             "rồi chạy `--write`, không sửa tay file này.")
    L.append("> Cột `tenant FK` là cột audit cách ly tenant — model tiền mà "
             "không có tenant FK là finding, xem `06.01`.")
    L.append("")
    n_model = sum(len(v) for v in by_app.values())
    n_mig = sum(len(v) for v in migs.values())
    n_tenant = sum(1 for v in by_app.values() for m in v if m["tenant"])
    L.append("## 1. Thống kê")
    L.append("")
    L.append("| Chỉ số | Giá trị |")
    L.append("|---|---|")
    L.append("| Tổng model | %d |" % n_model)
    L.append("| Tổng migration | %d |" % n_mig)
    L.append("| Model có tenant FK | %d |" % n_tenant)
    L.append("")
    L.append("## 2. Danh mục theo app")
    L.append("")
    for app in sorted(by_app):
        L.append("### `%s` — %d model, %d migration"
                 % (app, len(by_app[app]), len(migs[app])))
        L.append("")
        for m in by_app[app]:
            L.append("#### `%s` (bảng `%s`, tenant FK: %s)"
                     % (m["model"], m["table"],
                        "có" if m["tenant"] else "KHÔNG"))
            for f in m["fields"]:
                L.append("- `%s`" % f)
            for c in m["constraints"]:
                L.append("- ràng buộc `%s`" % c)
            L.append("")
        L.append("Migration: " + (", ".join("`%s`" % x for x in migs[app])
                                  or "--"))
        L.append("")
    return "\n".join(L)


def _strip(t):
    return "\n".join(
        ln for ln in t.replace("\r\n", "\n").split("\n")
        if not ln.startswith("> Sinh ngày "))


def main(argv):
    if "--write" in argv:
        try:
            by_app, migs = collect()
        except Exception as exc:  # noqa: BLE001
            print("FAIL: READ khong doc duoc models: %s" % exc)
            return 2
        from datetime import date as _date
        with open(os.path.join(REPO, OUT_REL), "w", encoding="utf-8",
                  newline="\n") as f:
            f.write(render(by_app, migs, _date.today().isoformat()))
        print("gen-model-catalog --write: %d model, %d migration -> %s"
              % (sum(len(v) for v in by_app.values()),
                 sum(len(v) for v in migs.values()), OUT_REL))
        return 0
    if "--check" in argv:
        i = argv.index("--check")
        target = argv[i + 1] if i + 1 < len(argv) else os.path.join(
            REPO, OUT_REL)
        try:
            by_app, migs = collect()
        except Exception as exc:  # noqa: BLE001
            print("FAIL: READ khong doc duoc models: %s" % exc)
            return 2
        try:
            with open(target, encoding="utf-8") as f:
                disk = f.read()
        except OSError:
            print("FAIL: READ khong thay %s" % target)
            return 2
        from datetime import date as _date
        fresh = render(by_app, migs, _date.today().isoformat())
        if _strip(fresh) != _strip(disk):
            fa = _strip(fresh).split("\n")
            da = _strip(disk).split("\n")
            for n, (a, b) in enumerate(zip(fa, da)):
                if a != b:
                    print("  dong %d sinh: %s | dia: %s"
                          % (n + 1, a[:150], b[:150]))
                    break
            else:
                print("  lech so dong: sinh %d, dia %d"
                      % (len(fa), len(da)))
            print("FAIL: CATALOG model lech code -- chay --write.")
            return 1
        print("gen-model-catalog --check: %d model -- khop."
              % sum(len(v) for v in by_app.values()))
        return 0
    print("Dung: --write | --check [file]")
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
