// ===== CONFIG =====
const API_URL = 'https://script.google.com/macros/s/AKfycbwKWbxAmhxrZiA6o8xKQjEzyiR7GRZuimvh2KxcVFbf_CGfGqaQOegOOMQR-c9AYNqk/exec'; // <-- paste URL dari GAS deploy

let user = null;
let currentType = null;
let stream = null;

const $ = s => document.querySelector(s);
const fmtWIB = d => new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false }).format(d);
const fmtDate = d => new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', weekday:'long', day:'2-digit', month:'long', year:'numeric' }).format(d);

async function api(payload) {
  const res = await fetch(API_URL, { method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body: JSON.stringify(payload) });
  return res.json();
}

// ===== VERSION =====
async function loadVersion() {
  try {
    const manifest = await fetch('./manifest.json?_=' + Date.now()).then(r => r.json());
    const v = manifest.version || '1.0';
    const el = $('#appVersion');
    if (el) el.textContent = `@v${v} • SMG-2026`;
    document.title = manifest.name || document.title;
  } catch(e) {}
}

// ===== VIEWS =====
function show(view) {
  ['loginView','homeView','absensiView','rekapView'].forEach(id => {
    const el = $('#'+id); if(el) el.classList.add('hidden');
  });
  const target = $('#'+view); if(target) target.classList.remove('hidden');
}

// ===== CLOCK =====
function startClocks() {
  const tick = () => {
    const now = new Date();
    const t = fmtWIB(now);
    if($('#jam')) $('#jam').textContent = t;
    if($('#jamHome')) $('#jamHome').textContent = t;
    if($('#tanggal')) $('#tanggal').textContent = fmtDate(now);
  };
  tick(); setInterval(tick, 1000);
}

// ===== INIT AFTER DOM =====
window.addEventListener('DOMContentLoaded', () => {
  loadVersion();
  
  // Login
  $('#loginForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    $('#loginError')?.classList.add('hidden');
    const username = $('#username').value.trim();
    const password = $('#password').value;
    try {
      const r = await api({action:'login', username, password});
      if(r.status!=='success') throw new Error(r.message);
      user = {...r.data, username, password};
      localStorage.setItem('absensi_user', JSON.stringify(user));
      initHome();
    } catch(err) {
      const errEl = $('#loginError'); if(errEl){ errEl.textContent = err.message; errEl.classList.remove('hidden'); }
    }
  });

  $('#logoutBtn')?.addEventListener('click', () => { localStorage.removeItem('absensi_user'); location.reload(); });
  $('#cardAbsensi')?.addEventListener('click', () => { show('absensiView'); loadToday(); });
  $('#cardRekap')?.addEventListener('click', () => { show('rekapView'); loadRekap(); });
  document.querySelectorAll('[data-back]').forEach(b => b.addEventListener('click', () => show('homeView')));
  
  $('#btnIn')?.addEventListener('click', () => openCamera('in'));
  $('#btnOut')?.addEventListener('click', () => openCamera('out'));
  $('#cancelCam')?.addEventListener('click', closeCamera);
  $('#refreshBtn')?.addEventListener('click', loadRekap);
  
  $('#snapBtn')?.addEventListener('click', takePhoto);

  // Restore session
  const saved = localStorage.getItem('absensi_user');
  if(saved){ user = JSON.parse(saved); initHome(); } else { show('loginView'); }
  
  if('serviceWorker' in navigator){ navigator.serviceWorker.register('sw.js'); }
});

function initHome() {
  show('homeView');
  if($('#namaHome')) $('#namaHome').textContent = user.nama;
  if(user.foto && user.foto.startsWith('http') && $('#avatarHome')) $('#avatarHome').src = user.foto;
  startClocks();
}

// ===== ABSENSI =====
async function loadToday() {
  try {
    const abs = await api({action:'getAbsensi', username:user.username});
    const d = new Date(new Date().toLocaleString('en-US',{timeZone:'Asia/Jakarta'})).getDate();
    const data = (abs.data?.absensi||{})[d]||{};
    if($('#timeIn')) $('#timeIn').textContent = data.in || '-';
    if($('#timeOut')) $('#timeOut').textContent = data.out || '-';
    $('#btnIn').disabled = !!data.in; $('#btnOut').disabled = !!data.out;
    $('#btnIn')?.classList.toggle('opacity-40', !!data.in);
    $('#btnOut')?.classList.toggle('opacity-40', !!data.out);
  } catch(e){ console.error(e); }
}

// ===== CAMERA =====
async function openCamera(type) {
  currentType = type;
  $('#camModal')?.classList.remove('hidden'); $('#camModal')?.classList.add('flex');
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:'user', width:{ideal:640} }, audio:false });
    $('#video').srcObject = stream;
  } catch(e) { alert('Kamera tidak bisa diakses'); closeCamera(); }
}
function closeCamera() {
  $('#camModal')?.classList.add('hidden'); $('#camModal')?.classList.remove('flex');
  if(stream){ stream.getTracks().forEach(t=>t.stop()); stream=null; }
}

async function takePhoto() {
  const video = $('#video');
  const canvas = $('#canvas');
  const w = 600; // lebih kecil biar upload cepat
  const h = video.videoHeight * (w / video.videoWidth);
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video,0,0,w,h);
  
  const now = new Date();
  const timeStr = fmtWIB(now);
  const dateStr = fmtDate(now);
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, h-80, w, 80);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 24px Outfit'; ctx.fillText(`${user.nama} - ${currentType.toUpperCase()}`, 16, h-48);
  ctx.font = '18px Outfit'; ctx.fillText(`${dateStr} ${timeStr} WIB`, 16, h-20);
  ctx.fillStyle = 'rgba(14,165,233,0.9)'; ctx.fillRect(w-100, 16, 84, 28); ctx.fillStyle='#fff'; ctx.font='bold 14px Outfit'; ctx.fillText('VALID', w-78, 35);
  
  const dataUrl = canvas.toDataURL('image/jpeg', 0.68);
  closeCamera();
  await doAbsen(currentType, dataUrl);
}

async function doAbsen(type, photo) {
  const status = $('#statusMsg'); if(status) status.textContent = 'Menyimpan...';
  try {
    // langsung absen dulu tanpa tunggu lokasi (biar cepat)
    const r = await api({action:'absen', username:user.username, type, photo});
    if(r.status!=='success') throw new Error(r.message);
    if(status) status.textContent = `Berhasil ${type==='in'?'Masuk':'Pulang'} ${r.data.time}`;
    if(navigator.vibrate) navigator.vibrate(30);
    await loadToday();
  } catch(err) {
    if(status) status.textContent = err.message || 'Gagal';
  }
  setTimeout(()=>{ if(status) status.textContent=''; },4000);
}

// ===== REKAP =====
async function loadRekap() {
  const now = new Date();
  const m = now.toLocaleString('id-ID',{timeZone:'Asia/Jakarta', month:'long'});
  const y = now.toLocaleString('id-ID',{timeZone:'Asia/Jakarta', year:'numeric'});
  if($('#rekapTitle')) $('#rekapTitle').textContent = `Rekap ${m} ${y}`;
  
  try {
    const rek = await api({action:'getRekap', username:user.username});
    const rekap = rek.data?.rekap || {};
    const tbody = $('#rekapBody'); if(!tbody) return; tbody.innerHTML = '';
    let hadir = 0;
    for(let i=1;i<=31;i++){
      const r = rekap[i]||{};
      if(r.in) hadir++;
      const tr = document.createElement('tr');
      tr.className='border-t border-white/5 hover:bg-white/5';
      tr.innerHTML = `<td class="p-2.5 text-white/70">${String(i).padStart(2,'0')}</td>
        <td class="p-2.5 text-center font-mono">${r.in||'-'}</td>
        <td class="p-2.5 text-center font-mono">${r.out||'-'}</td>`;
      tbody.appendChild(tr);
    }
    if($('#totalKerja')) $('#totalKerja').textContent = `Total hadir: ${hadir} hari`;
  } catch(e){ console.error(e); }
}
