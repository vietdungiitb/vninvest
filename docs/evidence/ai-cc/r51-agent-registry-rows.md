# BẢN SAO DỮ LIỆU — `ai_agents_agentregistry` (trước khi DROP, R5.1 phương án B)

Ngày xuất: **2026-10-18** · Nguồn: staging `vninvest_core` (`docker exec vninvest-core-db psql`).

## Vì sao có file này

Đo trước khi xoá cho thấy bảng **không rỗng**: có **1 dòng**. Dòng này **không** do
migration sinh ra — app `ai_agents` chỉ có `0001_initial` + `0002_agent_name_per_creator`,
không có bước seed nào — nên nó là dữ liệu nhập tay. Xoá bảng là xoá luôn dòng này.

Vì vậy: **ghi lại trước, drop sau.** Nếu sau này cần khôi phục (phương án A của R5.1),
đọc lại file này là đủ — không cần đào git history tìm script đã bị xoá.

## Nội dung bảng (đầy đủ 1 dòng)

| id | name | agent_type | provider | model | is_active | created_at |
|---|---|---|---|---|---|---|
| 1 | Phân tích ngành | advisory | gemini | gemini-3.8-flash | true | 2026-09-25 08:04:04.414446+00 |

Lệnh đã dùng để xuất (chạy lại được sau khi drop chỉ trả 0 dòng):

```sql
SELECT id, name, agent_type, provider, model, is_active, created_at
FROM ai_agents_agentregistry ORDER BY id;
```

## Cấu trúc bảng lúc xoá

```
id            bigint        identity, not null
name          varchar(64)   not null
agent_type    varchar(32)   not null
provider      varchar(32)   not null
model         varchar(64)   not null
is_active     boolean       (default true)
created_by_id / created_at / updated_at   (theo 0002)
```

## Đánh giá mức độ rủi ro

- Dòng là **seed mặc định**, không phải cấu hình do người dùng tạo (tạo 2026-09-25, đúng
  đợt seed dữ liệu đầu tiên của hệ thống).
- Không có đường đọc nào trong backend (R5.1 đo: `AgentRegistry` không được orchestrator /
  advisory / task nào đọc) ⇒ mất dòng này **không đổi hành vi** của bất kỳ luồng nào.
- Nếu sau này chọn phương án A (nối `AgentRegistry` vào orchestrator), chỉ cần chạy lại
  `INSERT` từ bảng trên.