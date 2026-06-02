// ===== CONFIG =====
const API_URL = 'https://script.google.com/macros/s/AKfycbwKWbxAmhxrZiA6o8xKQjEzyiR7GRZuimvh2KxcVFbf_CGfGqaQOegOOMQR-c9AYNqk/exec'; // <-- paste URL dari GAS deploy

// ===== STATE =====
let user = null;

// ===== HELPERS =====
const $ = (s) => document.querySelector(s);
const fmtWIB = (d) => new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(d);
const fmtDate = (d) => new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(d);

async function api(payload) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  });
  return res.json();
}

// ===== CLOCK =====
function startClock() {
  const tick = () => {
    const now = new Date();
    $('#jam').textContent = fmtWIB(now);
    $('#tanggal').textContent = fmtDate(now);
  };
  tick();
  setInterval(tick, 1000);
}

// ===== LOGIN =====
$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#loginError').classList.add('hidden');
  const username = $('#username').value.trim();
  const password = $('#password').value;
  try {
    const r = await api({ action: 'login', username, password });
    if (r.status !== 'success') throw new Error(r.message);
    user = { ...r.data, username, password };
    localStorage.setItem('absensi_user', JSON.stringify(user));
    showDashboard();
  } catch (err) {
    $('#loginError').textContent = err.message || 'Gagal login';
    $('#loginError').classList.remove('hidden');
  }
});

function showDashboard() {
  $('#loginView').classList.add('hidden');
  $('#dashView').classList.remove('hidden');
  $('#namaUser').textContent = user.nama;
  $('#userInfo').textContent = user.username + ' • ' + (user.ttl || 'Semarang');
  if (user.foto && user.foto.startsWith('http')) $('#avatar').src = user.foto;
  startClock();
  loadToday();
}

async function loadToday() {
  try {
    const [abs, rek] = await Promise.all([
      api({ action: 'getAbsensi', username: user.username }),
      api({ action: 'getRekap', username: user.username })
    ]);
    const today = new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' });
    const d = new Date(today).getDate();
    const data = (abs.data?.absensi || {})[d] || {};
    $('#timeIn').textContent = data.in || '-';
    $('#timeOut').textContent = data.out || '-';
    $('#btnIn').disabled = !!data.in;
    $('#btnOut').disabled = !!data.out;
    $('#btnIn').classList.toggle('opacity-40', !!data.in);
    $('#btnOut').classList.toggle('opacity-40', !!data.out);

    // render rekap
    const rekap = rek.data?.rekap || {};
    const tbody = $('#rekapBody');
    tbody.innerHTML = '';
    for (let i = 1; i <= 30; i++) {
      const r = rekap[i] || {};
      const tr = document.createElement('tr');
      tr.className = 'border-t border-white/5 hover:bg-white/5';
      tr.innerHTML = `<td class="p-2 text-white/70">${String(i).padStart(2,'0')}</td>
        <td class="p-2 text-center font-mono">${r.in || '-'}</td>
        <td class="p-2 text-center font-mono">${r.out || '-'}</td>`;
      tbody.appendChild(tr);
    }
  } catch (e) {
    console.error(e);
  }
}

// ===== ABSEN =====
async function doAbsen(type) {
  $('#statusMsg').textContent = 'Menyimpan...';
  try {
    const r = await api({ action: 'absen', username: user.username, type });
    if (r.status !== 'success') throw new Error(r.message);
    $('#statusMsg').textContent = `Berhasil ${type === 'in' ? 'Masuk' : 'Pulang'} ${r.data.time}`;
    await loadToday();
    // haptic
    if (navigator.vibrate) navigator.vibrate(30);
  } catch (err) {
    $('#statusMsg').textContent = err.message;
  }
  setTimeout(() => $('#statusMsg').textContent = '', 3000);
}

$('#btnIn').addEventListener('click', () => doAbsen('in'));
$('#btnOut').addEventListener('click', () => doAbsen('out'));
$('#refreshBtn').addEventListener('click', loadToday);
$('#logoutBtn').addEventListener('click', () => {
  localStorage.removeItem('absensi_user');
  location.reload();
});

// ===== INIT =====
window.addEventListener('load', () => {
  const saved = localStorage.getItem('absensi_user');
  if (saved) {
    user = JSON.parse(saved);
    showDashboard();
  }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js');
  }
});
