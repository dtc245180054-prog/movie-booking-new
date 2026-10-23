const express = require('express');
const mysql = require('mysql2/promise');
const crypto = require('crypto');
const path = require('path');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '10kb' }));

app.use((req, res, next) => {
  const t = Date.now();
  res.on('finish', () => {
    if (req.path === '/health') return;
    console.log(JSON.stringify({
      event: 'http', method: req.method, path: req.path,
      status: res.statusCode, ms: Date.now() - t
    }));
  });
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'db',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10
});

const wrap = (fn) => (req, res) =>
  fn(req, res).catch((err) => {
    console.error(JSON.stringify({ event: 'error', msg: err.message }));
    res.status(500).json({ error: 'Lỗi máy chủ, vui lòng thử lại' });
  });

app.get('/health', wrap(async (req, res) => {
  await pool.query('SELECT 1');
  res.json({ status: 'ok', db: 'up' });
}));

app.get('/api/showtimes', wrap(async (req, res) => {
  const [rows] = await pool.query(`
    SELECT st.id, m.title, m.description, m.duration_min, st.room, st.price,
           DATE_FORMAT(st.start_time, '%d/%m/%Y %H:%i') AS start_time,
           (SELECT COUNT(*) FROM seats s
             WHERE s.showtime_id = st.id AND s.status = 'available') AS available_seats
    FROM showtimes st JOIN movies m ON m.id = st.movie_id
    ORDER BY st.start_time`);
  res.json(rows);
}));

app.get('/api/showtimes/:id/seats', wrap(async (req, res) => {
  const [rows] = await pool.query(
    'SELECT seat_label, status FROM seats WHERE showtime_id = ? ORDER BY seat_label',
    [Number(req.params.id)]);
  res.json(rows);
}));

app.post('/api/bookings', wrap(async (req, res) => {
  const { showtime_id, seats, customer_name, card_number } = req.body || {};
  const name = String(customer_name || '').trim();

  if (!Number.isInteger(showtime_id) || !Array.isArray(seats) ||
      seats.length === 0 || seats.length > 8 || !name || name.length > 100) {
    return res.status(400).json({ error: 'Dữ liệu đặt vé không hợp lệ' });
  }
  if (!seats.every((s) => /^[A-E][1-8]$/.test(s))) {
    return res.status(400).json({ error: 'Mã ghế không hợp lệ' });
  }
  const uniq = [...new Set(seats)];

  const card = String(card_number || '').replace(/\s/g, '');
  if (!/^\d{16}$/.test(card)) {
    return res.status(400).json({ error: 'Số thẻ phải gồm 16 chữ số' });
  }
  if (card.endsWith('0000')) {
    console.log(JSON.stringify({ event: 'payment_declined', showtime_id }));
    return res.status(402).json({ error: 'Thanh toán bị từ chối (thẻ giả lập kết thúc bằng 0000)' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[st]] = await conn.query('SELECT price FROM showtimes WHERE id = ?', [showtime_id]);
    if (!st) {
      await conn.rollback();
      return res.status(404).json({ error: 'Không tìm thấy suất chiếu' });
    }

    const [locked] = await conn.query(
      `SELECT id FROM seats
        WHERE showtime_id = ? AND seat_label IN (?) AND status = 'available' FOR UPDATE`,
      [showtime_id, uniq]);
    if (locked.length !== uniq.length) {
      await conn.rollback();
      return res.status(409).json({ error: 'Có ghế vừa được người khác đặt, vui lòng chọn lại' });
    }

    const total = st.price * uniq.length;
    const code = 'BK' + crypto.randomBytes(4).toString('hex').toUpperCase();
    const [r] = await conn.query(
      'INSERT INTO bookings (code, showtime_id, customer_name, total, payment_status) VALUES (?,?,?,?,?)',
      [code, showtime_id, name, total, 'PAID']);
    await conn.query(
      `UPDATE seats SET status = 'booked', booking_id = ? WHERE id IN (?)`,
      [r.insertId, locked.map((x) => x.id)]);

    await conn.commit();
    console.log(JSON.stringify({ event: 'booking_created', code, seats: uniq.length, total }));
    res.status(201).json({ code, seats: uniq, total, payment_status: 'PAID' });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}));

app.listen(3000, () => console.log(JSON.stringify({ event: 'startup', port: 3000 })));
