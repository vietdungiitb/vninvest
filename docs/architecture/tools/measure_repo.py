#!/usr/bin/env python3
"""Đo lại các số liệu trong `docs/architecture/README.md` §0.4.

Vì sao có file này
-----------------
Bộ tài liệu AS-IS là SSOT. Một con số trong tài liệu mà không tái lập được thì
không phải SSOT — đó là tin đồn có dấu ngoặc. File này in ra **đúng** những gì
tài liệu khẳng định, để người review kiểm lại bằng lệnh, không bằng niềm tin.

Cách dùng
---------
    python docs/architecture/tools/measure_repo.py

Chạy từ **thư mục gốc repo**. Chỉ đọc, không ghi gì.

Khi nào số liệu lệch với tài liệu
-------------------------------
Đó **không** phải tài liệu sai — đó là hệ thống đã đổi. Cập nhật cả hai cùng lúc,
đừng sửa riêng một phía.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent.parent.parent
BACKEND = REPO / "packages" / "core" / "backend"
SRC = BACKEND / "src"

#: Ngưỡng dưới đây là giá trị đã ghi ở README §0.4. Lệch ⇒ in cảnh báo.
EXPECTED = {
    "django_apps": 15,
    "models": 107,
    "migrations": 115,
    "routes_total": 1029,
    "routes_core_v1": 609,
    "celery_beat_entries": 42,
    "compose_stacks": 8,
    "web_src_tracked_files": 516,
}


def _read(p: Path) -> str:
    try:
        return p.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return ""


def count_apps() -> int:
    n = 0
    if not SRC.is_dir():
        return 0
    for d in SRC.iterdir():
        if not d.is_dir() or d.name.startswith("_") or d.name == "vninvest_core":
            continue
        if (d / "models.py").exists() or (d / "apps.py").exists() \
                or any(d.glob("migrations/0*.py")):
            n += 1
    return n


def count_models() -> int:
    total = 0
    for f in SRC.rglob("models.py"):
        rel = f.relative_to(SRC).as_posix()
        if rel.startswith("vninvest_core/") or "migrations" in rel:
            continue
        total += len(re.findall(
            r"^class\s+\w+\([^)]*models\.Model", _read(f), re.M))
    return total


def count_migrations() -> int:
    return sum(1 for f in SRC.rglob("migrations/0*.py")
               if f.parent.parent.name != "vninvest_core")


def count_routes() -> tuple[int, int]:
    """Walk `get_resolver()` và dựng **đường dẫn đầy đủ** cho từng leaf.

    Bẫy đã mắc: `str(pattern)` của một `IncludePattern` chỉ là **tiền tố**,
    còn `pattern` của leaf chỉ là **phân đoạn cuối**. Bản đầu dùng
    `leaf_pattern.startswith('core/v1')` nên đếm ra 5 thay vì 609 — đo sai
    rồi tưởng tài liệu sai. Phải cộng dồn tiền tố trong lúc đi.
    """
    sys.path.insert(0, str(SRC))
    os_env = __import__("os").environ
    os_env.setdefault("DJANGO_SETTINGS_MODULE", "vninvest_core.settings")
    os_env.setdefault("DJANGO_DEBUG", "1")
    import django  # noqa: PLC0415

    django.setup()
    from django.urls import get_resolver  # noqa: PLC0415

    total = 0
    core = 0
    # (pattern, prefix_đã_cộng_dồn)
    stack: list[tuple[str, str]] = [("", p) for p in get_resolver().url_patterns]
    while stack:
        prefix, p = stack.pop()
        seg = str(getattr(p, "pattern", ""))
        # Bỏ phần đầu `$` / regex phức tạp: chỉ giữ dạng literal để thống kê.
        full = prefix + seg
        if hasattr(p, "url_patterns"):
            for child in p.url_patterns:
                stack.append((full, child))
            continue
        total += 1
        if full.lstrip("^").startswith("core/v1"):
            core += 1
    return total, core


def count_beat_entries() -> int:
    txt = _read(SRC / "vninvest_core" / "settings.py")
    m = re.search(r"CELERY_BEAT_SCHEDULE\s*=\s*\{(.*?)\n\}", txt, re.S)
    if not m:
        return 0
    return len(re.findall(r"^\s{4}[\"']", m.group(1), re.M))


def count_compose_stacks() -> int:
    n = 0
    for p in REPO.glob("docker-compose*.yml"):
        n += 1
    for pkg in ("packages/core", "packages/opencore", "packages/vip-app"):
        n += len(list((REPO / pkg).glob("docker-compose*.yml")))
    return n


def tracked(path: str) -> int:
    import subprocess  # noqa: PLC0415

    r = subprocess.run(["git", "-C", str(REPO), "ls-files", path],
                       capture_output=True, text=True)
    return len([x for x in r.stdout.splitlines() if x.strip()])


def main() -> int:
    got: dict[str, int | str] = {}
    got["django_apps"] = count_apps()
    got["models"] = count_models()
    got["migrations"] = count_migrations()
    got["compose_stacks"] = count_compose_stacks()
    got["celery_beat_entries"] = count_beat_entries()
    got["web_src_tracked_files"] = tracked("packages/web/src")
    try:
        total, core = count_routes()
        got["routes_total"] = total
        got["routes_core_v1"] = core
    except Exception as exc:  # noqa: BLE001
        got["routes_total"] = f"CHUA DOI (can Django: {type(exc).__name__})"
        got["routes_core_v1"] = "-"

    print("SO LIEU DO DUOC  <->  SO LIEU TRONG README 0.4\n")
    print(f"{'metric':26} {'measured':>12}  {'expected':>10}  status")
    print("-" * 66)
    drift = 0
    for key, want in EXPECTED.items():
        have = got.get(key)
        if isinstance(have, int):
            ok = have == want
            drift += 0 if ok else 1
            print(f"{key:26} {have:>12}  {want:>10}  {'OK' if ok else 'LECH'}")
        else:
            print(f"{key:26} {str(have):>12}  {want:>10}  CHUA DOC")
    print()
    if drift:
        print(f"!! {drift} so lieu LECH README §0.4.")
        print("   He thong da doi => cap nhat README §0.4 va commit cung mot lan.")
        return 1
    print("Khop: bo tai lieu van dung.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())