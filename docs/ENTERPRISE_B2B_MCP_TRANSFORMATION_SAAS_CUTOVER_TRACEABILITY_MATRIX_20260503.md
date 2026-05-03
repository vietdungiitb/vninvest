# TRACEABILITY MATRIX - ENTERPRISE B2B MCP TRANSFORMATION SAAS CUTOVER

## 1. Muc tieu

Ma tran nay truy vet tu muc tieu SaaS cuoi sang doc family, task slice va evidence bat buoc. Neu mot requirement khong co evidence gate thi requirement do chua duoc xem la done.

---

## 2. Traceability table

| Req ID | Yeu cau | Doc family chinh | Task IDs | Bang chung audit bat buoc |
|---|---|---|---|---|
| `SAAS-00` | Governance freeze phai chot legacy hotfix-only, package target va single-active-slice rule | handoff master, execution plan, taskboard | `SAAS-00` | cross-link review, taskboard/ledger/progress sync proof |
| `SAAS-01` | Access plane phai co dedicated capability snapshot versioned va human/machine surface map | execution plan, taskboard, self-audit | `SAAS-01` | auth payload snapshot, surface map, frontend route proof |
| `SAAS-02` | Partner APIs phai cutover sang tenant PAT machine-auth | execution plan, partner contract, taskboard | `SAAS-02` | PAT issue/rotate/revoke snapshot, request-id proof, audit reason proof |
| `SAAS-03` | Tenant lifecycle va commercial plane phai co truth ro rang | execution plan, contract pack, storage strategy | `SAAS-03` | lifecycle snapshots, quota/subscription/invoice parity proof |
| `SAAS-04` | Data plane phai facts-first, co freshness witness va stale/degraded semantics | execution plan, schema analysis, storage strategy | `SAAS-04` | symbol_snapshot/session_facts/unified_alert snapshot, stale flag proof |
| `SAAS-05` | Shadow run va pilot phai so payload, auth, routing va UX | execution plan, evidence template, taskboard | `SAAS-05` | diff report, pilot signoff, rollback rehearsal evidence |
| `SAAS-06` | Legacy decommission phai go runtime path, script, doc va alias | execution plan, handoff master, taskboard | `SAAS-06` | route inventory, compose/CI diff, removal proof, fallback window close proof |
| `AUD-01` | Moi slice phai co file list, validation, residual risk va handoff packet | self-audit, evidence template | all | ledger/progress sync, evidence packet, handoff packet |

---

## 3. Rule su dung ma tran

1. Moi slice phai map toi it nhat mot `Req ID`.
2. Neu cot bang chung con trong thi slice chua duoc xem la PASS.
3. Neu taskboard, audit ledger va progress dashboard khong khop, taskboard phai sua ngay truoc khi code tiep.
4. Neu docs va code xung dot, uu tien re-check handoff master va execution plan truoc khi sua code.
