# GitHub Actions — ĐÃ TẮT 2026-09-27

> **Nhánh này (PR #37, base `main`)** chỉ làm một việc: gỡ 7 file `.yml` khỏi
> `.github/workflows/` trên **`main`** (default branch). `dev` đã gỡ ở PR #36.
>
> **Vì sao phải sửa `main`:** GitHub đăng ký workflow từ **default branch**. Repo này có
> default branch là `main`, nên chỉ xoá trên `dev` **không tắt được** — `gh workflow list`
> vẫn liệt kê 10 workflow `active` và workflow `push`/`schedule` lên `main` vẫn chạy.

Lý do đầy đủ, bảng gate thay thế, và cách bật lại: xem `README.md` cùng thư mục
(trên `dev`) hoặc `docs/evidence/uiux-dashboard/gates-code-health.md`.

## Bật lại

```bash
git mv .github/workflows-disabled/*.yml .github/workflows/
```
