# Hướng dẫn triển khai VNInvest trên vninvest.edusuccess.vn bằng Portainer + nginx-proxy

Ngày cập nhật: 2026-04-15

## 1) Mục tiêu triển khai

- Frontend chạy tại: https://vninvest.edusuccess.vn/
- Django Admin chạy tại: https://vninvest.edusuccess.vn/admin/
- API chạy tại: https://vninvest.edusuccess.vn/api/
- Không dùng iframe để mở Admin trong UI quản trị stack.

## 2) Kiến trúc route với nginx-proxy

Stack ứng dụng dùng file compose: `portainer-stack-nginx-proxy.yml`.

Route theo path:
- `/` -> frontend container
- `/admin` -> backend container
- `/api` -> backend container
- `/ws` -> backend container
- `/static/admin` -> backend container

Lợi ích:
- Admin luôn vào đúng Django backend tại cùng domain.
- Không phụ thuộc frontend container để chuyển tiếp admin.
- Tránh vòng lặp route gây hiển thị trang lỗi trong frame.

## 3) Điều kiện trước khi deploy

1. Server đã chạy stack proxy ngoài ứng dụng gồm:
- `nginx_proxy`
- `nginx-proxy-acme`

2. Stack proxy có network ngoài (thường là `nginx-proxy_default`).

3. DNS A record:
- `vninvest.edusuccess.vn` trỏ về IP server.

4. Port 80/443 mở trên firewall.

## 4) Chuẩn bị biến môi trường trong Portainer

Tạo các biến sau trong Stack Environment:

```env
DOMAIN=vninvest.edusuccess.vn
LETSENCRYPT_EMAIL=vietdung@edusuccess.vn
PROXY_NETWORK=nginx-proxy_default

POSTGRES_DB=vninvest
POSTGRES_USER=postgres
POSTGRES_PASSWORD=change_me_db_password

DJANGO_SECRET_KEY=change-me-very-long-random-string
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=vninvest.edusuccess.vn,localhost,127.0.0.1
X_FRAME_OPTIONS=SAMEORIGIN

CORS_ALLOWED_ORIGINS=https://vninvest.edusuccess.vn,http://vninvest.edusuccess.vn
CSRF_TRUSTED_ORIGINS=https://vninvest.edusuccess.vn,http://vninvest.edusuccess.vn
FRONTEND_BASE_URL=https://vninvest.edusuccess.vn
GOOGLE_OAUTH_REDIRECT_URI=https://vninvest.edusuccess.vn/admin/portfolio/systememailaccount/google/callback/

REALTIME_ENABLED=True
WATCHLIST_SYNC_ENABLED=True
WATCHLIST_SYNC_MINUTES=15
WATCHLIST_SYNC_DAYS=5
ENABLE_NEW_MARKET_VIEWS=False
ENABLE_NEW_TRADING_VIEWS=False

OPEN_CORE_QUOTA_ENFORCEMENT_ENABLED=True
OPEN_CORE_COMMUNITY_API_CALLS_PER_DAY=300
OPEN_CORE_COMMUNITY_AI_REGENERATE_PER_DAY=0
OPEN_CORE_PRO_INDIVIDUAL_API_CALLS_PER_DAY=3000
OPEN_CORE_PRO_INDIVIDUAL_AI_REGENERATE_PER_DAY=30
OPEN_CORE_PRO_TEAM_API_CALLS_PER_DAY=10000
OPEN_CORE_PRO_TEAM_AI_REGENERATE_PER_DAY=120
```

Bắt buộc thay giá trị thật trước khi deploy:
- `POSTGRES_PASSWORD`
- `DJANGO_SECRET_KEY`

### Trường hợp mật khẩu DB trong Portainer khác env production

- Với stack Portainer này, giá trị trong Environment Variables của Stack là nguồn ưu tiên cao nhất cho container backend và db.
- Nếu bạn để `POSTGRES_PASSWORD=change_me_db_password` trong Portainer nhưng database đã khởi tạo bằng mật khẩu khác, backend sẽ lỗi kết nối do xác thực sai.
- Nếu env production ở chỗ khác có mật khẩu khác, hệ thống vẫn lấy giá trị từ Portainer cho stack này.

Cách xử lý an toàn:

1. Chọn một mật khẩu chuẩn duy nhất cho production.
2. Cập nhật cùng một giá trị đó tại Portainer Stack Environment.
3. Redeploy stack.
4. Kiểm tra lại endpoint health sau deploy: https://vninvest.edusuccess.vn/api/health/

Lưu ý quan trọng:

- Nếu volume Postgres đã tồn tại từ lần chạy trước, đổi mật khẩu trong env không tự đổi mật khẩu user trong DB cũ.
- Khi đó cần đổi password user ngay trong Postgres hoặc tạo lại volume dữ liệu theo quy trình migration/backup phù hợp.

## 5) Triển khai stack trên Portainer

1. Vào Stacks -> Add stack.
2. Chọn Repository.
3. Repository URL: https://github.com/vietdungiitb/vninvest.git
4. Reference/Branch: `deploy`
5. Compose path: `portainer-stack-nginx-proxy.yml`
6. Dán toàn bộ biến môi trường ở mục 4.
7. Deploy the stack.

## 6) Kiểm tra sau deploy

Kiểm tra lần lượt:

1. HTTPS frontend:
- https://vninvest.edusuccess.vn/

2. HTTPS admin trực tiếp:
- https://vninvest.edusuccess.vn/admin/

3. API health:
- https://vninvest.edusuccess.vn/api/health/

4. Nếu cần kiểm tra header:
- `X-Frame-Options` phải là `SAMEORIGIN` (hoặc giá trị bạn đặt trong env).

## 7) Xử lý lỗi Unsafe attempt to load URL ... from frame

Thông báo lỗi:

`Unsafe attempt to load URL https://vninvest.edusuccess.vn/admin/ from frame with URL chrome-error://chromewebdata/. Domains, protocols and ports must match.`

Nguyên nhân thường gặp:
- Đang mở Admin bằng iframe (tab preview, tool nhúng, hoặc trang trung gian).
- Frame cha đang là trang lỗi `chrome-error://chromewebdata`, không cùng origin.

Cách xử lý đúng:
1. Không nhúng Admin bằng iframe.
2. Mở trực tiếp URL admin trên tab trình duyệt:
- https://vninvest.edusuccess.vn/admin/
3. Nếu có nút trong frontend trỏ tới admin, dùng link chuyển trang trực tiếp thay vì iframe.
4. Đảm bảo truy cập cùng protocol/host/port (`https://vninvest.edusuccess.vn`).

## 8) Checklist nhanh khi có sự cố

1. DNS đã trỏ đúng IP server.
2. `PROXY_NETWORK` đúng tên network của stack nginx-proxy.
3. Container frontend và backend đều đã join `proxy_net` theo compose.
4. Chứng chỉ SSL đã được nginx-proxy-acme cấp thành công.
5. Biến `DJANGO_ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS`, `CORS_ALLOWED_ORIGINS` chứa domain production.

## 9) Ghi chú bảo mật

- Không dùng `X_FRAME_OPTIONS=ALLOWALL` trên production nếu không có nhu cầu đặc biệt.
- Không mở port app stack trực tiếp ra internet khi đã dùng nginx-proxy.
- Chỉ để `nginx_proxy` publish 80/443.
