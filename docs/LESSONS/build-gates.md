# Build Gates - Lessons (TS/Build/Lint, Timing, PASS vs CHƯA CHẠY)

> Gate chỉ có giá trị khi chạy **đúng thời điểm** (sau rebase) và **trên code thật đã chạy** (không đoán).
> Nguồn: `AGENTS.md` "Build verification" + bảng "Cạm bẫy đã gặp thật 2026-09-26".

## L-G01: Rebase → Check Migration → Gate (thứ tự bắt buộc)

- **Nguyên nhân:** Chạy gate trước khi rebase lên base/dev.
- **Hậu quả thật:** Báo `PASS` xanh trên code hiện tại nhưng **code sau rebase đã khác** → bỏ sót lỗi/conflict phát sinh sau đồng bộ.
- **Khi nào gặp:** `tags: [gate, gates, build-gates, build-gate, rebase, gate-timing]`
- **QUY TẮC:** "Thứ tự đóng phiên: **rebase → check migration → gate**. KHÔNG chạy gate trước rebase."
- **CHECKLIST:**
  - [ ] Đã tuân thủ trình tự **rebase** → **check migration** → **gate** (theo `scripts/agent-sync.ps1`)?
  - [ ] Không tự tách riêng chạy gate trước khi rebase?
  - [ ] Sau rebase có rà lại vùng code đã sửa còn đúng không?
  - [ ] Kết quả gate được báo cáo là từ code **sau rebase**?
- **Proof:** `AGENTS.md` bảng "Cạm bẫy" dòng "Chạy gate **trước** khi rebase → Báo xanh nhưng code sau rebase khác"; `docs/AGENT_PROTOCOL.md` §10.

## L-G02: KHÔNG báo "PASS" cho thứ chưa chạy - ghi "CHƯA CHẠY"

- **Nguyên nhân:** Báo kết quả dựa trên suy luận/ước đoán ("chắc là được") thay vì thực thi thật.
- **Hậu quả thật:** False-positive, che lỗi, mất độ tin cậy của quality gates → dễ lọt regression vào PR.
- **Khi nào gặp:** `tags: [gate, gates, build-gates, pass-vs-unrun, tsc, lint, build, test]`
- **QUY TẮC:** "KHÔNG báo 'PASS' cho thứ chưa chạy. Nếu chưa chạy được, **ghi 'CHƯA CHẠY'** - đừng suy ra 'chắc là được'."
- **CHECKLIST:**
  - [ ] Mỗi mục gate/test/build có **bằng chứng thực thi** (command + exit code)?
  - [ ] Không chạy được (thiếu DB/env) → ghi **`CHƯA CHẠY`** kèm lý do ngắn, KHÔNG đổi thành `PASS`?
  - [ ] Đã phân biệt rõ 3 trạng thái: `PASS` | `FAIL` | `CHƯA CHẠY`?
  - [ ] Frontend: `npx tsc --noEmit` sau mỗi sub-step, `npm run build` cuối mỗi step - **chỉ báo PASS khi đã chạy thành công**?
- **Proof:** `AGENTS.md` "Không báo 'PASS' cho thứ chưa chạy - ghi 'CHƯA CHẠY'"; "Không có môi trường ⇒ không có kết luận".

## L-G03: Gate trên máy agent KHÔNG đại diện cho máy khác

- **Nguyên nhân:** Tin tuyệt đối kết quả gate chạy trên máy agent, không kiểm tra lại ở môi trường merge.
- **Hậu quả thật:** Cả 4 agent báo gate PASS, nhưng khi merge lại chạy thì **198 test `errors=1`** (lỗi tiếng Việt có dấu trong `print()` gây `UnicodeEncodeError` trên cp1252) → làm `migrate` thất bại giữa chừng.
- **Khi nào gặp:** `tags: [gate, gates, build-gates, multi-agent, test, merge]`
- **QUY TẮC:** "Gate trên máy agent **KHÔNG đại diện** cho máy khác. Kết luận merge phải dựa trên gate chạy **sau khi merge/rebase** trên đúng môi trường đích."
- **CHECKLIST:**
  - [ ] Đã chạy lại gate **sau khi rebase lên base/dev** (không dùng kết quả trước rebase)?
  - [ ] Nếu kết quả merge khác kết quả agent → đã ghi rõ **sự khác biệt** trong báo cáo?
  - [ ] Với test nhạy cảm encoding/locale (Windows cp1252) → đã kiểm tra riêng?
  - [ ] Đã xác nhận test suite chạy trên đúng DB engine của môi trường đích?
- **Proof:** `AGENTS.md` mục Portfolio Commercial - "Bài học coordinator đã trả giá: cả 4 agent báo gate PASS; merge lại chạy thì **198 test `errors=1`** ... `0019:264-272` `print()` tiếng Việt có dấu ⇒ `UnicodeEncodeError` trên cp1252 ⇒ làm `migrate` thất bại giữa chừng. Gate trên máy agent **không** đại diện cho máy khác."