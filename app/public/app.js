const $ = (id) => document.getElementById(id);
const fmt = (n) => Number(n).toLocaleString('vi-VN') + ' đ';
let current = null;
const selected = new Set();

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

async function api(url, opts) {
  const r = await fetch(url, opts);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'Lỗi không xác định');
  return data;
}

async function loadShowtimes() {
  const list = await api('/api/showtimes');
  const box = $('showtimes');
  box.replaceChildren();
  list.forEach((s) => {
    const card = el('div', 'card');
    card.append(
      el('h3', null, s.title),
      el('p', 'muted', s.description),
      el('p', null, `Phòng ${s.room} · ${s.start_time}`),
      el('p', null, `Giá: ${fmt(s.price)} · Còn ${s.available_seats} ghế`)
    );
    const btn = el('button', null, 'Chọn suất này');
    btn.type = 'button';
    btn.addEventListener('click', () => chooseShowtime(s));
    card.append(btn);
    box.append(card);
  });
}

function updateSummary() {
  const n = selected.size;
  $('selected-info').textContent = n
    ? `Đã chọn ${n} ghế: ${[...selected].sort().join(', ')}`
    : 'Chưa chọn ghế nào';
  $('total').textContent = fmt(n * (current ? current.price : 0));
  $('step3').hidden = n === 0;
}

async function loadSeats() {
  const seats = await api(`/api/showtimes/${current.id}/seats`);
  const box = $('seats');
  box.replaceChildren();
  seats.forEach((seat) => {
    const booked = seat.status === 'booked';
    const b = el('button', 'seat ' + (booked ? 'booked' : 'free'), seat.seat_label);
    b.type = 'button';
    b.disabled = booked;
    b.addEventListener('click', () => {
      if (selected.has(seat.seat_label)) {
        selected.delete(seat.seat_label);
        b.className = 'seat free';
      } else {
        selected.add(seat.seat_label);
        b.className = 'seat selected';
      }
      updateSummary();
    });
    box.append(b);
  });
}

async function chooseShowtime(s) {
  current = s;
  selected.clear();
  $('movie-info').textContent = `${s.title} · Phòng ${s.room} · ${s.start_time}`;
  $('step2').hidden = false;
  $('result').hidden = true;
  $('error').textContent = '';
  await loadSeats();
  updateSummary();
  $('step2').scrollIntoView({ behavior: 'smooth' });
}

function showResult(r) {
  const box = $('result');
  box.replaceChildren();
  const t = el('div', 'ticket');
  t.append(
    el('h2', null, '✅ Đặt vé thành công'),
    el('p', null, `Mã vé: ${r.code}`),
    el('p', null, `Phim: ${current.title} · Phòng ${current.room} · ${current.start_time}`),
    el('p', null, `Ghế: ${r.seats.join(', ')}`),
    el('p', null, `Tổng tiền: ${fmt(r.total)} (${r.payment_status})`)
  );
  const again = el('button', null, 'Đặt vé khác');
  again.type = 'button';
  again.addEventListener('click', () => location.reload());
  t.append(again);
  box.append(t);
  box.hidden = false;
  $('step2').hidden = true;
  $('step3').hidden = true;
  box.scrollIntoView({ behavior: 'smooth' });
}

$('pay-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('error').textContent = '';
  try {
    const r = await api('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        showtime_id: current.id,
        seats: [...selected],
        customer_name: $('name').value,
        card_number: $('card').value
      })
    });
    showResult(r);
  } catch (err) {
    $('error').textContent = err.message;
    selected.clear();
    await loadSeats();
    updateSummary();
    $('step3').hidden = false;
  }
});

loadShowtimes().catch((err) => { $('showtimes').textContent = err.message; });
