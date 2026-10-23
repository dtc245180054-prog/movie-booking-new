SET NAMES utf8mb4;
USE moviedb;

CREATE TABLE movies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(150) NOT NULL,
  description VARCHAR(255) NOT NULL,
  duration_min INT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE showtimes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  movie_id INT NOT NULL,
  room VARCHAR(20) NOT NULL,
  start_time DATETIME NOT NULL,
  price INT UNSIGNED NOT NULL,
  FOREIGN KEY (movie_id) REFERENCES movies(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  showtime_id INT NOT NULL,
  customer_name VARCHAR(100) NOT NULL,
  total INT UNSIGNED NOT NULL,
  payment_status VARCHAR(20) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (showtime_id) REFERENCES showtimes(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE seats (
  id INT AUTO_INCREMENT PRIMARY KEY,
  showtime_id INT NOT NULL,
  seat_label VARCHAR(5) NOT NULL,
  status ENUM('available','booked') NOT NULL DEFAULT 'available',
  booking_id INT NULL,
  UNIQUE KEY uq_showtime_seat (showtime_id, seat_label),
  FOREIGN KEY (showtime_id) REFERENCES showtimes(id),
  FOREIGN KEY (booking_id) REFERENCES bookings(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO movies (title, description, duration_min) VALUES
('Hành Tinh Cuối Cùng', 'Phim khoa học viễn tưởng về chuyến di cư của nhân loại.', 128),
('Đêm Hà Nội', 'Phim tình cảm lãng mạn lấy bối cảnh phố cổ về đêm.', 105),
('Thám Tử Mèo', 'Phim hoạt hình hài hước dành cho cả gia đình.', 92);

INSERT INTO showtimes (movie_id, room, start_time, price) VALUES
(1, 'P1', TIMESTAMP(CURDATE() + INTERVAL 1 DAY, '19:30:00'), 110000),
(1, 'P1', TIMESTAMP(CURDATE() + INTERVAL 2 DAY, '21:00:00'), 110000),
(2, 'P2', TIMESTAMP(CURDATE() + INTERVAL 1 DAY, '18:00:00'), 90000),
(2, 'P2', TIMESTAMP(CURDATE() + INTERVAL 2 DAY, '20:15:00'), 90000),
(3, 'P3', TIMESTAMP(CURDATE() + INTERVAL 1 DAY, '15:00:00'), 80000),
(3, 'P3', TIMESTAMP(CURDATE() + INTERVAL 2 DAY, '10:00:00'), 80000);

INSERT INTO seats (showtime_id, seat_label)
SELECT s.id, CONCAT(r.r, n.n)
FROM showtimes s
CROSS JOIN (SELECT 'A' AS r UNION SELECT 'B' UNION SELECT 'C' UNION SELECT 'D' UNION SELECT 'E') r
CROSS JOIN (SELECT 1 AS n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4
            UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8) n;
