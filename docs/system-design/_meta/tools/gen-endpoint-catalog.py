#!/usr/bin/env python3
"""gen-endpoint-catalog.py -- sinh danh muc API tu Django runtime (Lop 2: may sinh).

MUC DICH
    Walk ``django.urls.get_resolver()`` (ky thuat cong don prefix nhu
    ``measure_repo.py::count_routes`` -- dem leaf_pattern thay vi duong dan day
    du la do sai 5 thay vi 609), lay moi leaf: path day du, methods, view,
    permissions, app. Ghi ``07.02-danh-muc-api.md``. Con nguoi KHONG viet tay
    tung endpoint.

CACH CHAY (tu goc repo)
    python docs/system-design/_meta/tools/gen-endpoint-catalog.py --write
    python docs/system-design/_meta/tools/gen-endpoint-catalog.py --check <file>

NGUYEN TAC
    - Chi DOC code (django.setup + walk resolver, khong cham DB).
    - Exit 0 = sach/khop, 1 = lech (in diff dong dau), 2 = khong verify duoc.
    - So sanh chuan hoa CRLF. Khong ghi timestamp gio/phut (chi ngay sinh --
      doi khi sinh lai la dung, cong do khi --check).
    - methods lay tu ``view_class.http_method_names`` (DRF, ke ca @api_view vi
      decorator gan .cls); function view thuan Django khong co view_class thi
      ghi "?" thay vi doan.
"""

import os
import sys

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(
    os.path.dirname(os.path.abspath(__file__))))))
SRC = os.path.join(REPO, "packages", "core", "backend", "src")
OUT_REL = os.path.join("docs", "system-design", "07-API-SPEC",
                        "07.02-danh-muc-api.md")


def collect():
    sys.path.insert(0, SRC)
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "vninvest_core.settings")
    os.environ.setdefault("DJANGO_DEBUG", "1")
    import django  # noqa: E402

    django.setup()
    from django.urls import get_resolver  # noqa: E402

    rows = []
    stack = [("", p) for p in get_resolver().url_patterns]
    while stack:
        prefix, p = stack.pop()
        seg = str(getattr(p, "pattern", ""))
        full = (prefix + seg).lstrip("^")
        if hasattr(p, "url_patterns"):
            for child in p.url_patterns:
                stack.append((full, child))
            continue
        cb = getattr(p, "callback", None)
        # Hai hinh callback do duoc tu runtime (2026-10-14):
        #  (a) APIView: cb.view_class co san;
        #  (b) ViewSet qua router: function tran mang ten ViewSet, KHONG co
        #      view_class, nhung co .cls (lop that) + .actions (method->action).
        view_cls = getattr(cb, "view_class", None)
        cb_actions = None
        if view_cls is None and cb is not None:
            view_cls = getattr(cb, "cls", None)
            cb_actions = getattr(cb, "actions", None)
        if view_cls is not None:
            view = view_cls.__module__ + "." + view_cls.__qualname__
            methods = sorted(m.upper() for m in
                             getattr(view_cls, "http_method_names", []))
            actions = cb_actions or getattr(view_cls, "action_map", None)
            if actions:
                methods = sorted(
                    "%s(%s)" % (k.upper(), v)
                    for k, v in actions.items())
            explicit = getattr(view_cls, "permission_classes", [])
            perms = [c.__name__ for c in explicit] or ["mặc-định"]
        elif cb is not None:
            view = getattr(cb, "__module__", "?") + "." + \
                getattr(cb, "__name__", "?")
            methods = ["?"]
            perms = []
        else:
            view = "?"
            methods = ["?"]
            perms = []
        mod = view.split(".")[0]
        app = mod if mod not in ("?", "django") else (
            "django.contrib" if view.startswith("django.") else "?")
        import re as _re
        clean = _re.sub(r"(?<=/)\^|\$$|^\^", "", full)
        rows.append({
            "path": "/" + clean,
            "methods": " ".join(methods),
            "view": view,
            "perms": " ".join(perms) if perms else "--",
            "app": app,
        })
    rows.sort(key=lambda r: (r["path"], r["methods"]))
    return rows


def render(rows, date):
    L = []
    L.append("# 07.02 — Danh Mục API (Máy Sinh, Không Sửa Tay)")
    L.append("")
    L.append("> Sinh ngày %s bằng "
             "`docs/system-design/_meta/tools/gen-endpoint-catalog.py` "
             "(walk Django resolver — định nghĩa đếm chuẩn như "
             "`measure_repo.py::count_routes`)." % date)
    L.append("> Lệch với code ⇒ `--check` đỏ. Muốn sửa: đổi code rồi chạy "
             "`--write`, không sửa tay file này.")
    L.append("> Cột `test khóa`: chưa rà — viết ở slice kiểm thử (ghi "
             "`--` cho tới lúc đó).")
    L.append("> `mặc-định` ở cột phân quyền = view không khai "
             "`permission_classes`, hiệu lực theo `REST_FRAMEWORK` trong "
             "`vninvest_core/settings.py` (IsAuthenticated + IsTenantActive).")
    L.append("")
    L.append("## 1. Thống kê")
    L.append("")
    L.append("| Chỉ số | Giá trị |")
    L.append("|---|---|")
    L.append("| Tổng route | %d |" % len(rows))
    core = sum(1 for r in rows if r["path"].startswith("/core/v1"))
    L.append("| Trong đó `/core/v1` | %d |" % core)
    L.append("| View không xác định được methods (`?`) | %d |"
             % sum(1 for r in rows if r["methods"] == "?"))
    L.append("")
    L.append("## 2. Danh mục")
    L.append("")
    L.append("| METHOD | Path | View | Phân quyền | App | Test khóa |")
    L.append("|---|---|---|---|---|---|")
    for r in rows:
        L.append("| %s | `%s` | `%s` | `%s` | `%s` | -- |"
                 % (r["methods"], r["path"], r["view"], r["perms"], r["app"]))
    L.append("")
    return "\n".join(L)


def main(argv):
    if "--write" in argv:
        try:
            rows = collect()
        except Exception as exc:  # noqa: BLE001
            print("FAIL: READ khong walk duoc resolver: %s" % exc)
            return 2
        from datetime import date as _date
        text = render(rows, _date.today().isoformat())
        with open(os.path.join(REPO, OUT_REL), "w", encoding="utf-8",
                  newline="\n") as f:
            f.write(text)
        print("gen-endpoint-catalog --write: %d route -> %s"
              % (len(rows), OUT_REL))
        return 0
    if "--check" in argv:
        i = argv.index("--check")
        target = argv[i + 1] if i + 1 < len(argv) else os.path.join(
            REPO, OUT_REL)
        try:
            rows = collect()
        except Exception as exc:  # noqa: BLE001
            print("FAIL: READ khong walk duoc resolver: %s" % exc)
            return 2
        try:
            with open(target, encoding="utf-8") as f:
                disk = f.read().replace("\r\n", "\n")
        except OSError:
            print("FAIL: READ khong thay %s" % target)
            return 2
        from datetime import date as _date
        fresh = render(rows, _date.today().isoformat())
        # Ngay sinh doi theo ngay chay: so phan con lai (bo dong ngay).
        def strip(t):
            return "\n".join(
                ln for ln in t.split("\n")
                if not ln.startswith("> Sinh ngày "))
        if strip(fresh) != strip(disk):
            fa = strip(fresh).split("\n")
            da = strip(disk).split("\n")
            for n, (a, b) in enumerate(zip(fa, da)):
                if a != b:
                    print("  dong %d sinh: %s | dia: %s"
                          % (n + 1, a[:150], b[:150]))
                    break
            else:
                print("  lech so dong: sinh %d, dia %d"
                      % (len(fa), len(da)))
            print("FAIL: CATALOG danh muc API lech code -- chay --write.")
            return 1
        print("gen-endpoint-catalog --check: %d route -- khop." % len(rows))
        return 0
    print("Dung: --write | --check [file]")
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
