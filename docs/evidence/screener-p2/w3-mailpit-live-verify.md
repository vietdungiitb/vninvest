# Evidence — W3 live verify schedule email (2026-09-14)

> Đóng `Next` của Entry 81: rebuild docker dev + verify mailpit nhận mail khi schedule email chạy.

## Kết quả kiểm tra container (không cần rebuild)

- `docker exec vninvest-dev-core-worker-manual grep schedule_id/send_mail screener_tasks.py`
  → dòng 29/37/181 (`schedule_id`), 184/187 (`send_mail`) — code email đã có trong image.
- `printenv EMAIL_HOST/EMAIL_PORT/EMAIL_BACKEND` trong worker-manual
  → `mailpit / 1025 / django.core.mail.backends.smtp.EmailBackend` — ENV đã đúng.
- Kết luận: image `vninvest-dev-core-runtime` hiện tại đã chứa Entry 81, **không rebuild**.

## Verify live end-to-end (task thật + mailpit thật)

Script tạm (đã xóa sau khi chạy): tạo rule tạm `W3VERIFY rule`
(`close gt 0`), schedule tạm `notify_channels=[in_app,email]` cho `testuser`,
seed history cũ `ZZZ_FAKE_OLD_SYMBOL`, gọi trực tiếp
`run_screener_scan_task.run(..., schedule_id=...)` trong `core-api`,
đọc `http://mailpit:8025/api/v1/messages` từ trong container
(mailpit không publish port ra host).

```
user: testuser testuser@vninvest.vn
latest session: 2026-09-09
rule: 7 tenant: 2
schedule: 4 ['in_app', 'email']
mailpit before: 0
task result: {'ok': True, 'matched_count': 20, 'total_scanned': 20}
mailpit after: 1
subject: [Screener] W3VERIFY rule: +20 mã mới (2026-09-09)
to: [{'Name': '', 'Address': 'testuser@vninvest.vn'}]
cleanup done. VERDICT: PASS
```

Message kiểm tra trực tiếp trong mailpit: `From: noreply@vninvest.local`,
`Subject` đúng format, body liệt kê 20 mã (ABW…VNM), `Size: 870`.

## Dọn dẹp

- Đã xóa rule/schedule/history tạm (`ScreenerRunHistory.objects.filter(rule=rule).delete()` + `sched.delete()` + `rule.delete()`).
- Đã xóa message test khỏi mailpit (`DELETE /api/v1/messages` → `total: 0`).
