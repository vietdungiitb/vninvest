# TRACEABILITY MATRIX - Enterprise B2B MCP Transformation Current-Code Realignment

## 1. Muc tieu

Ma tran nay truy vet truc tiep tu requirement cua chuong trinh current-code realignment sang doc family, task slice va bang chung audit bat buoc.

## 2. Ma tran truy vet

| Req ID | Yeu cau | Doc family chinh | Task IDs | Bang chung audit bat buoc |
|---|---|---|---|---|
| `B2B-01` | Rebaseline phai phan anh repo dang co ca legacy runtime va package-track baseline | Rebaseline, master index | `DOC-01`, `DOC-02` | grep proof cho `packages/`, `shared/`, `buildTarget.js`, cross-reference review |
| `B2B-02` | Doi code phai co mot bo handoff pack day du de nhan viec ma khong hoi lai owner | Handoff master, plan, taskboard, audit docs | `DOC-03` | pack files ton tai + cross-link review |
| `B2B-03` | Moi doc family phai danh dau ro implemented-now, partial, target-state | Access/Admin docs, contract docs, schema docs | `DOC-04`, `DOC-05`, `DOC-06` | doc diff review + status labeling proof |
| `ACC-01` | Access/bootstrap phai co current-code truth thay vi broad bridge semantics | access payload, RBAC, UI architecture | `ACC-01`, `ACC-02` | auth/me or capabilities payload snapshot + frontend route proof |
| `ACC-02` | Package-track bootstrap khong duoc tiep tuc claim admin parity bang wildcard fallback | package-track docs + package code | `ACC-03`, `PKG-01` | shell check PASS + ability payload diff + wildcard removal proof |
| `OPS-01` | Operator P0 read APIs phai duoc tach khoi partner docs va build read-first | operator backlog, detailed contracts | `OPS-01`, `OPS-02`, `OPS-04` | API response snapshots + backend tests + docs alignment review |
| `OPS-02` | Operator AI runtime phai duoc danh dau dung la implemented-now partial lane | operator docs, screen spec | `OPS-05` | route payload snapshot + UI/browser proof + docs review |
| `PART-01` | Partner contract phai phan tach route da co va route con thieu | partner contract draft, contract pack | `PART-01`, `PART-02` | missing-route closure proof + headers/envelope validation |
| `PART-02` | Tenant admin docs phai khop namespace `/tenant-admin/*` va live self-service lanes | screen spec, RBAC, UI architecture | `PART-03` | browser proof + screen-spec diff review |
| `DATA-01` | Resource/schema docs phai phan biet object da co voi object target-state | resource freeze, schema analysis, storage strategy | `DOC-06`, `DATA-01` | implemented-vs-target matrix + model anchor proof |
| `DATA-02` | Migration/backfill chi duoc lap sau khi contract/resource freeze du ro | schema docs, implementation plan | `DATA-02`, `DATA-03` | migration order note + rollback note + traceability update |
| `PKG-01` | Package-track promotion phai den sau current-code contract convergence, khong di truoc | rebaseline, package migration plan, package foundation docs | `PKG-01`, `PKG-02`, `PKG-03` | shell check + compileall + cutover gate review |
| `AUD-01` | Moi slice phai co file list, validation, residual risk, handoff packet | self-audit, evidence template | `AUD-01`, `AUD-02` | ledger/progress sync + evidence template duoc dien |
| `HND-01` | Code-team continuation phai co mot playbook duy nhat, one-active-slice rule va audit sync giua cac slice | handoff master, continuation playbook, taskboard, audit docs | `PKG-01`, `PKG-02`, `PKG-03`, `CA-01`, `CA-02`, `CA-03`, `CA-04`, `CA-05`, `CA-06`, `CA-07` | playbook ton tai + active slice claim + ledger/progress sync + drift check |

## 3. Quy tac su dung matrix

1. Moi slice phai map toi it nhat mot `Req ID`.
2. Neu cot bang chung con trong thi slice chua duoc xem la PASS.
3. Neu taskboard noi mot dang, ledger/progress noi mot nẻo, taskboard phai duoc sua ngay truoc khi code tiep.
4. Neu docs va code xung dot, uu tien doi chieu rebaseline va code anchors truoc, sau do moi sua docs con lai.