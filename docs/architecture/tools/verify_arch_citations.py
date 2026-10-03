#!/usr/bin/env python3
"""Kiểm chứng citation dạng `path:line` trong bộ tài liệu AS-IS.

Vì sao có file này
------------------
Nguyên tắc "code-grounded" của bộ tài liệu chỉ có giá trị nếu **kiểm chứng được**.
Một citation `models.py:107` mà không biết `models.py` nào trong 15 Django app
thì đó là niềm tin, không phải bằng chứng — và sẽ hỏng theo thời gian.

Đo trước khi viết file này (2026-10-03, 4 file .md / 4.247 dòng):

    tổng citation 261 · full-path khớp 133 · **full-path không tồn tại 11**
    **bare basename 117 (45%)** · trong đó trùng tên 2/3/14/15 file: 26
    **không file nào khớp: 6** · **line vượt EOF 1**

Tức **45% citation không xác minh được ngay từ đầu**. Bệnh này đã xảy ra thật ở
`AGENTS.md` (sai 20 `file:line`, xem `docs/evidence/portfolio-commercial/
AUDIT_VERIFICATION_20260926.md`) vì không có script nào kiểm.

Phân loại kết quả
-----------------
| Nhãn | Nghĩa | Chặn? |
|---|---|---|
| `OK` | resolve được 1 file, dòng nằm trong file | không |
| `DEAD_PATH` | có dấu `/` nhưng không khớp file tracked nào | **có** |
| `DEAD_NAME` | không dấu `/`, không file nào tên đó | **có** |
| `AMBIGUOUS` | không dấu `/`, khớp ≥2 file ⇒ không biết nói ai | **có** |
| `OUT_OF_RANGE` | dòng vượt quá số dòng thật của file | **có** |

Cách dùng
---------
    python docs/architecture/tools/verify_arch_citations.py
    python docs/architecture/tools/verify_arch_citations.py --allow-ambiguous
    python docs/architecture/tools/verify_arch_citations.py --verbose

Exit 0 = sạch. Exit 1 = có citation hỏng, **không được báo "PASS"**.

Chạy ở thư mục gốc repo. Chỉ đọc, không ghi.
"""
from __future__ import annotations

import re
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent.parent.parent
DOCS = REPO / "docs" / "architecture"

#: Đuôi file được coi là "trích dẫn tới mã nguồn". `.md` kếp cả vì tài liệu
#: kiến trúc trích dẫn chính nó (`README.md:7-34`).
EXTS = ("py", "js", "mjs", "cjs", "ts", "tsx", "jsx", "css", "json", "toml",
        "yml", "yaml", "md", "sh", "ps1", "html", "txt", "sql", "env")

CIT = re.compile(
    r"(?<![\w./\\-])"                      # không bắt giữa đường dẫn
    r"([A-Za-z0-9_][A-Za-z0-9_./\\-]*"
    r"\.(?:" + "|".join(EXTS) + r"))"      # tên file
    r":(\d+)(?:-(\d+))?"                   # :N hoặc :N-M
)

BLOCKING = ("DEAD_PATH", "DEAD_NAME", "AMBIGUOUS", "OUT_OF_RANGE")


def tracked_files() -> list[str]:
    out = subprocess.run(
        ["git", "-C", str(REPO), "ls-files"],
        capture_output=True, text=True, check=True,
    )
    return [p.replace("\\", "/") for p in out.stdout.splitlines()]


def line_count(abs_path: Path) -> int | None:
    try:
        return len(abs_path.read_text(encoding="utf-8", errors="replace").splitlines())
    except OSError:
        return None


def main() -> int:
    # BẪY ĐÃ MẮC THẬT trong repo này: `print()` tiếng Việt có dấu trên Windows
    # với stdout cp1252 ⇒ `UnicodeEncodeError` ⇒ script chết giữa chừng, tệ hơn
    # là chết ngay khi bắt đầu vì ta mất toàn bộ danh sách lỗi. Đã xảy ra ở
    # `identity_access/.../0019:264-272` và làm `migrate` thất bại giữa chừng.
    # `errors="replace"` để một ký tự lạ không giết cả lần chạy.
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    allow_ambiguous = "--allow-ambiguous" in sys.argv
    verbose = "--verbose" in sys.argv

    tracked = tracked_files()
    tracked_set = set(tracked)
    by_name: dict[str, list[str]] = defaultdict(list)
    for rel in tracked:
        by_name[rel.rsplit("/", 1)[-1]].append(rel)

    findings: list[tuple[str, str, str, str]] = []   # nhãn, doc, citation, ghi chú
    ok_count = 0

    docs = sorted(DOCS.glob("*.md"))
    if not docs:
        print(f"KHONG CO .md nao trong {DOCS}", file=sys.stderr)
        return 1

    for doc in docs:
        text = doc.read_text(encoding="utf-8", errors="replace")
        for m in CIT.finditer(text):
            raw, a, b = m.group(1), int(m.group(2)), m.group(3)
            hi = int(b) if b else a
            citation = f"{raw}:{a}" + (f"-{b}" if b else "")
            line_no = text[: m.start()].count("\n") + 1
            where = f"{doc.name}:{line_no}"

            norm = raw.replace("\\", "/").lstrip("./")
            if "/" in norm:
                # Đường dẫn gốc repo (`scripts/x.ps1`) không có tiền tố thư mục
                # nên so bằng hậu tố có `/` sẽ hụt. Thử khớp tuyệt đối trước.
                if norm in tracked_set:
                    hits = [norm]
                else:
                    hits = [t for t in tracked if t.endswith("/" + norm)]
                if not hits:
                    findings.append(("DEAD_PATH", where, citation,
                                     "có dấu / nhưng không khớp file tracked nào"))
                    continue
                # >1 khớp ⇒ chính xác là mơ hồ, không phải hợp lệ
                if len(hits) > 1:
                    findings.append(("AMBIGUOUS", where, citation,
                                     f"khớp {len(hits)} file: {', '.join(hits[:3])}"))
                    continue
            else:
                hits = by_name.get(norm, [])
                if not hits:
                    findings.append(("DEAD_NAME", where, citation,
                                     "không có file tracked nào tên đúng như vậy"))
                    continue
                if len(hits) > 1:
                    findings.append(("AMBIGUOUS", where, citation,
                                     f"trùng tên {len(hits)} file: {', '.join(hits[:3])}"))
                    continue

            n = line_count(REPO / hits[0])
            if n is None:
                findings.append(("DEAD_PATH", where, citation,
                                 f"không đọc được {hits[0]}"))
                continue
            if hi > n:
                findings.append(("OUT_OF_RANGE", where, citation,
                                 f"{hits[0]} chỉ có {n} dòng"))
                continue

            ok_count += 1
            if verbose:
                print(f"  OK  {citation:<52} -> {hits[0]}")

    by_label: dict[str, list[tuple[str, str, str, str]]] = defaultdict(list)
    for f in findings:
        by_label[f[0]].append(f)

    print()
    print("=" * 78)
    print("KIEM CHUNG CITATION  docs/architecture/*.md")
    print("=" * 78)
    print(f"  citation khop      : {ok_count}")
    print(f"  citation hong     : {len(findings)}")
    print()
    if not findings:
        print("Khop: moi file:line trong tai lieu deu tro toi file that, dung dong.")
        print("Chay lai sau moi lan sua code - tai lieu khong tu lam chinh no.")
        return 0

    for label in BLOCKING:
        rows = by_label.get(label)
        if not rows:
            continue
        note = "  (--allow-ambiguous: khong chan)" if (label == "AMBIGUOUS" and allow_ambiguous) else ""
        print(f"--- {label} x{len(rows)} ---{note}")
        for _, where, citation, why in rows:
            print(f"  {where:<38} {citation:<40} {why}")
        print()

    blocking = [f for f in findings if f[0] in BLOCKING and not (allow_ambiguous and f[0] == "AMBIGUOUS")]
    if not blocking:
        print("Khop theo --allow-ambiguous. Citation AMBIGUOUS van chua xac minh duoc.")
        return 0
    print(f"HONG {len(blocking)} citation. Khong bao 'PASS' - sua hoac gan nhan '[CHUA XAC MINH]'.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())