# docs/archive — tài liệu lịch sử

Thư mục này chứa **1368 tài liệu cũ** đã được **di chuyển** (không xoá) vào
`dev` ngày 2026-09-29, commit `00c2764f`.

```
git diff --name-status: 1368 rename, 0 delete
```

## Quy tắc dùng

| Nên | Không nên |
|---|---|
| tra cứu để hiểu *quyết định đã ghi* trong quá khứ | dùng làm nguồn sự thật cho trạng thái hiện tại |
| đọc để hiểu vì sao một cách làm cũ tồn tại | trích dẫn trong tài liệu mới hoặc PR |
| kiểm tra lịch sử của một quyết định | audit code dựa trên tài liệu ở đây |

Tài liệu ở đây **mô tả trạng thái đã qua**. Nếu nó mâu thuẫn với
`AGENTS.md`, `docs/CLAIMS.md` hoặc `docs/OPEN_WORK_20260927.md` thì
**những file đó mới đúng**. Khi có mâu thuẫn, hãy báo lại để tài liệu ở đây
được sửa hoặc xoá hẳn.

## Khôi phục một tài liệu

Bản đồ đường dẫn cũ → mới nằm ở [`MANIFEST.json`](MANIFEST.json):

```bash
node -e 'const m=require("./docs/archive/MANIFEST.json");
const e=m.entries.find(x=>x.from.endsWith("TEN_FILE.md"));
console.log(e.from,"->",e.to)'
git mv docs/archive/.../TEN_FILE.md TEN_FILE.md
```

Các quy tắc bảo vệ khi di chuyển (file không bị động tới):
- 76 file được code/CI/compose tham chiếu
- 8 process doc: `AGENTS.md`, `docs/CLAIMS.md`, `docs/AGENT_PROTOCOL.md`, ledger…
- tài liệu dành cho **người** đọc (Quickstart / Guide / Runbook / Deploy) — không
  file code nào trỏ tới nhưng người mới cần
- link closure: file `keep` nào trỏ tới file `move` thì file `keep` đó được giữ lại

## Kiểm tra link

```bash
node docs/scripts/check-md-links.mjs   # so với baseline, exit 1 nếu có link mới hỏng
node docs/scripts/fix-md-links.mjs --apply
node docs/scripts/demote-dead-links.mjs --apply
```

Hiện tại: **0 broken link** trong repo (9 link chết có sẵn đã đổi thành chữ thường
năm 2026-09-29). Còn 202 link `file:///C:/...` trỏ tới đường dẫn máy cục bộ của
người viết — đã hỏng từ trước, không phải link trong repo nên không sửa.

## Cấu trúc

```
docs/archive/
  <khu vực>/          # docs-flat, docs-plans, docs-evidence, repo-root, ...
    <chủ đề>/         # gom theo chủ đề để dễ tìm
      <tên file>.md
  MANIFEST.json       # đường dẫn cũ → mới
```
