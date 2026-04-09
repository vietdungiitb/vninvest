# Module Tree Workflow

Muc tieu: giu file `module_tree_full.md` luon dong bo voi source code de tim module/class/function/variable nhanh.

## File va script lien quan

- Nguon cay: `module_tree_full.md`
- Script sinh tu dong: `scripts/ops/generate_module_tree.py`

## Cach cap nhat

Chay lenh tai root project:

```powershell
"c:/Mujoco Projects/vninvest/.venv/Scripts/python.exe" scripts/ops/generate_module_tree.py
```

Script se:
- Quet cac thu muc: `backend`, `frontend`, `mobile-app`, `scripts`
- Trich xuat:
  - Python: module, class, methods, top-level functions, top-level variables
  - JS/TS: class, function declaration, arrow/function-expression assignment, top-level variables
- Ghi de file `module_tree_full.md`

## Quy uoc team

1. Moi khi them/sua/xoa class hoac function, chay script cap nhat cay.
2. Commit code va `module_tree_full.md` trong cung mot commit.
3. Khong sua tay `module_tree_full.md`.
4. Neu muon doi logic parser, sua `scripts/ops/generate_module_tree.py` roi regen.

## Luu y

- Day la tai lieu index nhanh, khong thay the code search.
- Co the bo sot mot so syntax JS/TS qua dac biet; khi gap truong hop do, cap nhat parser trong script.
- Da bo qua migration folder de tranh noise qua lon.
