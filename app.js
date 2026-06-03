// ===== CONFIG =====
const API_URL = 'https://script.google.com/macros/s/AKfycbwKWbxAmhxrZiA6o8xKQjEzyiR7GRZuimvh2KxcVFbf_CGfGqaQOegOOMQR-c9AYNqk/exec';

let user = null;
let currentType = null;
let stream = null;

const $ = s => document.querySelector(s);
const fmtWIB = d => new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false }).format(d);
const fmtDate = d => new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', weekday:'long', day:'2-digit', month:'long', year:'numeric' }).format(d);

// ===== API HELPER =====
async function api(payload) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Network error');
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

// ===== VIEW MANAGEMENT =====
function show(id) {
  document.querySelectorAll('#app > div').forEach(v => v.classList.add('hidden'));
  $(`#${id}`).classList.remove('hidden');
}

// ===== LOGIN =====
$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const username = $('#username').value.trim();
  const password = $('#password').value;
  const btn = e.target.querySelector('button');
  const err = $('#loginError');
  btn.disabled = true; btn.textContent = 'Memproses...'; err.classList.add('hidden');
  
  try {
    const data = await api({ action: 'login', username, password });
    user = data;
    localStorage.setItem('absensi_user', JSON.stringify(user));
    initHome();
  } catch (e) {
    err.textContent = e.message || 'Login gagal'; err.classList.remove('hidden');
  } finally {
    btn.disabled = false; btn.textContent = 'Masuk';
  }
});

// Password eye toggle
$('#togglePass').addEventListener('click', () => {
  const inp = $('#password');
  const icon = $('#togglePass');
  if (inp.type === 'password') {
    inp.type = 'text';
    icon.textContent = '🙈';
  } else {
    inp.type = 'password';
    icon.textContent = '👁️';
  }
});

// ===== INIT HOME =====
function initHome() {
  $('#namaHome').textContent = user.nama;
  if (user.foto) $('#avatarHome').src = user.foto;
  show('homeView');
  updateJamHome();
  setInterval(updateJamHome, 1000);
}

function updateJamHome() {
  const now = new Date();
  $('#jamHome').textContent = fmtWIB(now);
  $('#jamHomeBig').textContent = fmtWIB(now);
  $('#tanggalHomeBig').textContent = fmtDate(now);
}

$('#logoutBtn').addEventListener('click', () => { localStorage.removeItem('absensi_user'); location.reload(); });

// ===== NAV =====
$('#cardAbsensi').addEventListener('click', () => { show('absensiView'); loadToday(); });
$('#cardRekap').addEventListener('click', () => { show('rekapView'); loadRekap(); });
document.querySelectorAll('[data-back]').forEach(b => b.addEventListener('click', () => show('homeView')));

// ===== ABSENSI =====
async function loadToday() {
  try {
    const abs = await api({action:'getAbsensi', username:user.username});
    $('#timeIn').textContent = abs.masuk || '-';
    $('#timeOut').textContent = abs.pulang || '-';
  } catch(e) { console.error(e); }
}

function startClock() {
  const tick = () => { const n = new Date(); $('#jam').textContent = fmtWIB(n); $('#tanggal').textContent = fmtDate(n); };
  tick(); setInterval(tick, 1000);
}
startClock();

$('#btnIn').addEventListener('click', () => openCamera('in'));
$('#btnOut').addEventListener('click', () => openCamera('out'));

// ===== CAMERA + WATERMARK =====
async function openCamera(type) {
  currentType = type;
  $('#statusMsg').textContent = 'Membuka kamera...';
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
    $('#video').srcObject = stream;
    $('#camModal').classList.remove('hidden');
    $('#camModal').classList.add('flex');
  } catch (e) {
    $('#statusMsg').textContent = 'Kamera ditolak. Aktifkan izin kamera.';
  }
}

$('#cancelCam').addEventListener('click', closeCamera);
function closeCamera() {
  if (stream) stream.getTracks().forEach(t => t.stop());
  $('#camModal').classList.add('hidden');
  $('#camModal').classList.remove('flex');
}

$('#snapBtn').addEventListener('click', takePhoto);

async function takePhoto() {
  const video = $('#video');
  const canvas = $('#canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  
  // Draw video frame
  ctx.drawImage(video, 0, 0);
  
  // Add watermark
  const now = new Date();
  const timeStr = fmtWIB(now);
  const dateStr = fmtDate(now);
  const nameStr = user.nama;
  
  ctx.font = 'bold 32px Outfit';
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.lineWidth = 4;
  ctx.textAlign = 'right';
  
  const padding = 20;
  const lineHeight = 38;
  let y = canvas.height - padding;
  
  // Name
  ctx.strokeText(nameStr, canvas.width - padding, y);
  ctx.fillText(nameStr, canvas.width - padding, y);
  y -= lineHeight;
  
  // Date
  ctx.strokeText(dateStr, canvas.width - padding, y);
  ctx.fillText(dateStr, canvas.width - padding, y);
  y -= lineHeight;
  
  // Time
  ctx.font = 'bold 48px Outfit';
  ctx.strokeText(timeStr, canvas.width - padding, y);
  ctx.fillText(timeStr, canvas.width - padding, y);
  
  closeCamera();
  $('#statusMsg').textContent = 'Mengirim data...';
  
  const base64 = canvas.toDataURL('image/jpeg', 0.8);
  
  try {
    const res = await api({
      action: 'absen',
      username: user.username,
      nama: user.nama,
      type: currentType,
      photo: base64
    });
    $('#statusMsg').textContent = `Absen ${currentType === 'in' ? 'Masuk' : 'Pulang'} berhasil!`;
    loadToday();
  } catch (e) {
    $('#statusMsg').textContent = e.message || 'Gagal mengirim absen';
  }
}

// ===== REKAP =====
async function loadRekap() {
  const d = new Date();
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  $('#rekapTitle').textContent = `Rekap ${new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(d)}`;
  
  try {
    const rekap = await api({ action: 'getRekap', username: user.username, month, year });
    const tbody = $('#rekapBody');
    tbody.innerHTML = '';
    let hadir = 0;
    for (let i = 1; i <= 31; i++) {
      const r = rekap[i] || {};
      if (r.in) hadir++;
      const tr = document.createElement('tr');
      tr.className = 'border-t border-white/5 hover:bg-white/5';
      tr.innerHTML = `<td class="p-2.5 text-white/70">${String(i).padStart(2,'0')}</td>
        <td class="p-2.5 text-center font-mono">${r.in || '-'}</td>
        <td class="p-2.5 text-center font-mono">${r.out || '-'}</td>`;
      tbody.appendChild(tr);
    }
    $('#totalKerja').textContent = `Total hadir: ${hadir} hari`;
  } catch(e) { console.error(e); }
}
$('#refreshBtn').addEventListener('click', loadRekap);

// ===== INIT + UNREGISTER SW =====
window.addEventListener('load', () => {
  const saved = localStorage.getItem('absensi_user');
  if(saved){ user = JSON.parse(saved); initHome(); } else { show('loginView'); }
  // hapus service worker lama agar tidak pakai cache lama
  if('serviceWorker' in navigator){
    navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()));
  }
});
