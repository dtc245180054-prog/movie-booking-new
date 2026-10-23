# Hệ thống Đặt vé Xem phim (Đề 11)

Ứng dụng web đặt vé xem phim (chọn suất chiếu, chọn ghế, thanh toán giả lập) triển khai bằng Docker Compose, kèm giám sát Prometheus + Grafana, log tập trung Loki + Promtail và các biện pháp hardening.

## Mục lục
1. [Kiến trúc](#kiến-trúc)
2. [Yêu cầu](#yêu-cầu)
3. [Cách khởi chạy](#cách-khởi-chạy)
4. [Bảng port](#bảng-port)
5. [Tài khoản mặc định](#tài-khoản-mặc-định)
6. [Truy vấn LogQL mẫu](#truy-vấn-logql-mẫu)
7. [Hardening bảo mật](#hardening-bảo-mật)
8. [Cấu trúc thư mục](#cấu-trúc-thư-mục)

## Kiến trúc

```
Trình duyệt --HTTPS--> Nginx (reverse proxy) --> Web (Node.js/Express) --> MySQL
                                                                            ^
                                                              phpMyAdmin ---+
Giám sát: cAdvisor, node-exporter, mysqld-exporter, nginx-exporter --> Prometheus --> Grafana
Log:      Promtail (đọc log Docker) --> Loki --> Grafana (LogQL)
```

Ba mạng Docker:
- `frontend`: Nginx, web, phpMyAdmin
- `backend` (internal, không ra internet): web, db, phpmyadmin, mysqld-exporter
- `monitoring`: Prometheus, Grafana, Loki, Promtail, các exporter

## Yêu cầu
- Ubuntu với Docker và Docker Compose v2
- Khoảng 5 GB đĩa trống

## Cách khởi chạy

```bash
git clone https://github.com/DTC245180054/movie-booking.git
cd movie-booking

# 1. Tạo file .env (mật khẩu mạnh ngẫu nhiên)
cat > .env << EOT
MYSQL_ROOT_PASSWORD=$(openssl rand -hex 16)
MYSQL_DATABASE=moviedb
APP_DB_USER=ticket_app
APP_DB_PASSWORD=$(openssl rand -hex 16)
EXPORTER_DB_PASSWORD=$(openssl rand -hex 16)
GRAFANA_ADMIN_PASSWORD=$(openssl rand -hex 8)
EOT
chmod 600 .env

# 1b. Tạo cấu hình cho mysqld-exporter
set -a; . ./.env; set +a
printf '[client]\nuser=exporter\npassword=%s\nhost=db\nport=3306\n' "$EXPORTER_DB_PASSWORD" > monitoring/mysqld-exporter.cnf

# 2. Sinh chứng chỉ HTTPS tự ký
./nginx/gen-cert.sh

# 3. Chạy toàn bộ hệ thống
docker compose up -d --build
docker compose ps
```

Đợi `mb-db` ở trạng thái `healthy` (khoảng 1 phút). Dừng hệ thống: `docker compose down` (thêm `-v` để xóa cả dữ liệu).

## Bảng port

| Dịch vụ | Địa chỉ | Truy cập từ |
|---|---|---|
| Website (HTTPS) | https://IP_MAY | Mọi nơi |
| HTTP (chuyển sang HTTPS) | http://IP_MAY | Mọi nơi |
| phpMyAdmin | http://localhost:8081 | Chỉ localhost |
| Grafana | http://localhost:3001 | Chỉ localhost |
| Prometheus | http://localhost:9090 | Chỉ localhost |
| cAdvisor | http://localhost:8082 | Chỉ localhost |

Truy cập từ máy khác qua SSH tunnel:
`ssh -L 3001:localhost:3001 -L 8081:localhost:8081 user@IP_MAY`

## Tài khoản mặc định

| Dịch vụ | Tài khoản | Mật khẩu |
|---|---|---|
| phpMyAdmin | `root` | `MYSQL_ROOT_PASSWORD` trong `.env` |
| Grafana | `admin` | `GRAFANA_ADMIN_PASSWORD` trong `.env` |
| Ứng dụng (DB) | `ticket_app` | `APP_DB_PASSWORD` trong `.env` |

Mật khẩu sinh ngẫu nhiên khi tạo `.env`, file này không được đưa lên Git. Thẻ thanh toán giả lập: bất kỳ 16 số hợp lệ được chấp nhận, số kết thúc bằng `0000` bị từ chối.

## Truy vấn LogQL mẫu

Mở Grafana, vào Explore, chọn datasource Loki:

```
{container="mb-nginx"}
{container="mb-nginx"} |~ `" (4|5)[0-9]{2} `
{container="mb-web"} | json | event="booking_created"
sum by (container) (count_over_time({service=~"nginx|web"}[1m]))
```

## Hardening bảo mật
1. Container `web` chạy user `node` (non-root), filesystem chỉ đọc, `cap_drop: ALL`, `no-new-privileges`.
2. Network isolation: mạng `backend` là `internal`, DB không có đường ra internet và không publish port.
3. Mật khẩu mạnh sinh ngẫu nhiên (`openssl rand`), lưu trong `.env` đã được `.gitignore`.
4. Nginx: HTTPS tự ký (TLS 1.2/1.3), chuyển hướng HTTP sang HTTPS, các header `X-Frame-Options`, `X-Content-Type-Options`, `Content-Security-Policy`, `Strict-Transport-Security`, `Referrer-Policy`, ẩn phiên bản Nginx.
5. Hạn chế quyền DB: user ứng dụng chỉ có `SELECT, INSERT, UPDATE`, không có `DROP`/`DELETE`; user exporter chỉ có quyền đọc số liệu.
6. Công cụ quản trị (phpMyAdmin, Grafana, Prometheus, cAdvisor) chỉ lắng nghe trên `127.0.0.1`.

## Cấu trúc thư mục

```
app/         Ứng dụng Node.js (Express) và giao diện
db/init/     SQL khởi tạo và script tạo user
nginx/       nginx.conf và script sinh chứng chỉ
monitoring/  Prometheus, Grafana (datasource, dashboard)
logging/     Loki, Promtail
docs/        Ảnh minh chứng
```
