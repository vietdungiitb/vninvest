# OPEN CORE REVIEW MEMO (OC-16)

Doc ID: OC-16
Ngay tao: 2026-04-18
Trang thai: Review memo only, khong phai quyet dinh chinh thuc
Related docs: OPEN_CORE_15_DECISION_PACKET_CURRENT_20260418.md, OPEN_CORE_STRATEGY_MASTER_FINAL.md, OPEN_CORE_13_COMMUNITY_PUBLISH_READINESS_V1.md, OPEN_CORE_11_NUMERIC_LOCK_SHEET_V1.md, OPEN_CORE_12_ENTITLEMENT_QUOTA_IMPLEMENTATION_CHECKLIST_V1.md

## 1. Muc dich cua memo nay

Memo nay duoc tao de stakeholder doc, nghien cuu va can nhac them.

No KHONG:
1. Tu dong phe duyet Open Core public launch.
2. Tu dong phe duyet lane implementation tiep theo.
3. Thay the decision record chinh thuc.

No CO:
1. Tong hop nhanh nhung diem can hieu dung.
2. Chi ro nhung diem chua nen quyet dinh voi thong tin hien tai.
3. Goi y cach doc tai lieu theo thu tu de ra quyet dinh sau.

## 2. Tom tat mot trang

1. Huong Open Core van hop ly voi VNInvest.
2. Runtime OpenCore da ton tai mot phan trong codebase, nen bai toan khong con la "co nen bat dau hay khong".
3. Tuy nhien, public/community release ngay luc nay van khong nen duoc phe duyet.
4. Ly do chinh khong nam o tam nhin san pham, ma nam o viec boundary, quota/trial canonical, package strategy va legal/publication artifacts chua duoc khoa ro.

## 3. Dieu nen doc nhu su that hien tai

1. Open Core da co business baseline.
2. Open Core da co runtime lane thuc te trong backend.
3. Team da khong con o giai doan brainstorming thuần tuy.
4. Project dang o giai doan governance reset + hardening, chua o giai doan announce/public-ready.

## 4. Dieu khong nen vo tinh gia dinh

1. Khong nen gia dinh rang co the mirror mot thu muc `/core` la xong.
2. Khong nen gia dinh cac con so quota cu trong docs cu da la canonical.
3. Khong nen gia dinh self-host Pro da co operating model ro rang.
4. Khong nen gia dinh cac tai lieu cu kieu "ready/live/production" van con dung cho hien tai.

## 5. Neu hom nay chua quyet dinh, dieu do hoan toan hop ly

Chua quyet dinh ngay la hop ly vi 5 cau hoi sau van can owner chot:
1. Quota canonical theo ngay hay theo thang?
2. Business package se map vao runtime plan nhu the nao?
3. Community V1 package boundary chinh xac la gi?
4. Self-host Pro se phan phoi va enforce theo mo hinh nao?
5. Legal/publication/support bundle public se chot ra sao?
6. Co che tach private docs va public docs se duoc thuc hien nhu the nao?

Neu 5 cau hoi nay chua co cau tra loi ro, moi quyet dinh launch/public lane deu de thanh quyet dinh cam tinh.

## 6. Cach doc bo tai lieu de hieu nhanh ma khong bi nhieu

1. Doc [OPEN_CORE_15_DECISION_PACKET_CURRENT_20260418.md](../../../OPEN_CORE_15_DECISION_PACKET_CURRENT_20260418.md) truoc.
2. Sau do doc [OPEN_CORE_STRATEGY_MASTER_FINAL.md](../core_strategy_master/OPEN_CORE_STRATEGY_MASTER_FINAL.md) de hieu tam nhin va framing.
3. Neu muon danh gia co nen public hay khong, doc [OPEN_CORE_13_COMMUNITY_PUBLISH_READINESS_V1.md](../../../OPEN_CORE_13_COMMUNITY_PUBLISH_READINESS_V1.md).
4. Neu muon kiem tra cho nao dang lech giua docs va runtime, doc [OPEN_CORE_11_NUMERIC_LOCK_SHEET_V1.md](../../../OPEN_CORE_11_NUMERIC_LOCK_SHEET_V1.md) va [OPEN_CORE_12_ENTITLEMENT_QUOTA_IMPLEMENTATION_CHECKLIST_V1.md](../../../OPEN_CORE_12_ENTITLEMENT_QUOTA_IMPLEMENTATION_CHECKLIST_V1.md).

## 7. Khuyen nghi tam thoi khi chua ra quyet dinh

Khuyen nghi tam thoi luc nay:
1. Khong phe duyet public/community release ngay.
2. Khong vo hieu hoa huong Open Core.
3. Giu trang thai "reviewing" cho den khi 5 quyet dinh con treo duoc lam ro.

## 8. Neu can mot quyet dinh rat nhe o thoi diem hien tai

Quyet dinh nhe, an toan nhat co the dua ra luc nay la:

"Dong y tiep tuc giai doan review va lam ro boundary/governance cua Open Core, nhung chua chot launch hay public lane."

Quyet dinh nay khong khoa tay team vao launch som, nhung giu duoc dong luc va huong uu tien.

## 9. Next review checkpoint

- Quay lai memo nay sau khi anh doc xong OC-15, OC-14 va OC-13; luc do toi co the viet tiep 1 memo follow-up dang approve / no-go / de-risking options.