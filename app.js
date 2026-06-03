// ===== CONFIG =====
const API_URL = 'https://script.google.com/macros/s/AKfycbwKWbxAmhxrZiA6o8xKQjEzyiR7GRZuimvh2KxcVFbf_CGfGqaQOegOOMQR-c9AYNqk/exec'; // <-- paste URL dari GAS deploy

let user = null;
let currentType = null;
let stream = null;

const $ = s => document.querySelector(s);
const fmtWIB = d => new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false }).format(d);
const fmtDate = d => new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', weekday:'long', day:'2-digit', month:'long', year:'numeric' }).format(d);
const monthID = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

async function api(payload) {
  const res = await fetch(API_URL, { method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body: JSON.stringify(payload) });
  return res.json();
}

// ===== VERSION =====
async function loadVersion() {
  try {
    const manifest = await fetch('./manifest.json?_=' + Date.now()).then(r => r.json());
    const v = manifest.version || '1.0';
    const el = document.getElementById('appVersion');
    if (el) el.textContent = `@v${v} • SMG-2026`;
    // juga update title jika perlu
    document.title = manifest.name || document.title;
  } catch(e) {
    console.warn('Gagal load version', e);
  }
}

// ===== VIEWS =====
function show(view) {
  ['loginView','homeView','absensiView','rekapView'].forEach(id => $('#'+id).classList.add('hidden'));
  $('#'+view).classList.remove('hidden');
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

// ===== LOGIN =====
$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  $('#loginError').classList.add('hidden');
  const username = $('#username').value.trim();
  const password = $('#password').value;
  try {
    const r = await api({action:'login', username, password});
    if(r.status!=='success') throw new Error(r.message);
    user = {...r.data, username, password};
    localStorage.setItem('absensi_user', JSON.stringify(user));
    initHome();
  } catch(err) {
    $('#loginError').textContent = err.message; $('#loginError').classList.remove('hidden');
  }
});

function initHome() {
  show('homeView');
  $('#namaHome').textContent = user.nama;
  if(user.foto && user.foto.startsWith('http')) $('#avatarHome').src = user.foto;
  startClocks();
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
    const d = new Date(new Date().toLocaleString('en-US',{timeZone:'Asia/Jakarta'})).getDate();
    const data = (abs.data?.absensi||{})[d]||{};
    $('#timeIn').textContent = data.in || '-';
    $('#timeOut').textContent = data.out || '-';
    $('#btnIn').disabled = !!data.in; $('#btnOut').disabled = !!data.out;
    $('#btnIn').classList.toggle('opacity-40', !!data.in);
    $('#btnOut').classList.toggle('opacity-40', !!data.out);
  } catch(e){ console.error(e); }
}

$('#btnIn').addEventListener('click', () => openCamera('in'));
$('#btnOut').addEventListener('click', () => openCamera('out'));

// ===== CAMERA WITH WATERMARK =====
async function openCamera(type) {
  currentType = type;
  $('#camModal').classList.remove('hidden'); $('#camModal').classList.add('flex');
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:'user', width:{ideal:720} }, audio:false });
    $('#video').srcObject = stream;
  } catch(e) { alert('Kamera tidak bisa diakses'); closeCamera(); }
}
function closeCamera() {
  $('#camModal').classList.add('hidden'); $('#camModal').classList.remove('flex');
  if(stream){ stream.getTracks().forEach(t=>t.stop()); stream=null; }
}
$('#cancelCam').addEventListener('click', closeCamera);

$('#snapBtn').addEventListener('click', async () => {
  const video = $('#video');
  const canvas = $('#canvas');
  const w = 720; const h = video.videoHeight * (w / video.videoWidth);
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video,0,0,w,h);
  
  // Watermark TimeMark style
  const now = new Date();
  const timeStr = fmtWIB(now);
  const dateStr = fmtDate(now);
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, h-90, w, 90);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 28px Outfit'; ctx.fillText(`${user.nama} - ${currentType.toUpperCase()}`, 20, h-55);
  ctx.font = '20px Outfit'; ctx.fillText(`${dateStr} ${timeStr} WIB`, 20, h-25);
  ctx.fillStyle = 'rgba(14,165,233,0.9)'; ctx.fillRect(w-120, 20, 100, 36); ctx.fillStyle='#fff'; ctx.font='bold 16px Outfit'; ctx.fillText('VALID', w-95, 43);
  
  const dataUrl = canvas.toDataURL('image/jpeg', 0.75); // kecil tapi jelas
  closeCamera();
  await doAbsen(currentType, dataUrl);
});

async function doAbsen(type, photo) {
  $('#statusMsg').textContent = 'Menyimpan...';
  try {
    // get location (optional)
    let lat=null,lng=null;
    try { const pos = await new Promise((res,rej)=>navigator.geolocation.getCurrentPosition(res,rej,{timeout:3000})); lat=pos.coords.latitude; lng=pos.coords.longitude; } catch{}
    
    const r = await api({action:'absen', username:user.username, type, photo, lat, lng});
    if(r.status!=='success') throw new Error(r.message);
    $('#statusMsg').textContent = `Berhasil ${type==='in'?'Masuk':'Pulang'} ${r.data.time}`;
    if(navigator.vibrate) navigator.vibrate(30);
    await loadToday();
  } catch(err) {
    $('#statusMsg').textContent = err.message || 'Gagal';
  }
  setTimeout(()=>$('#statusMsg').textContent='',4000);
}

// ===== REKAP =====
async function loadRekap() {
  const now = new Date();
  const m = now.toLocaleString('id-ID',{timeZone:'Asia/Jakarta', month:'long'});
  const y = now.toLocaleString('id-ID',{timeZone:'Asia/Jakarta', year:'numeric'});
  $('#rekapTitle').textContent = `Rekap ${m} ${y}`;
  
  try {
    const rek = await api({action:'getRekap', username:user.username});
    const rekap = rek.data?.rekap || {};
    const tbody = $('#rekapBody'); tbody.innerHTML = '';
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
    $('#totalKerja').textContent = `Total hadir: ${hadir} hari`;
  } catch(e){ console.error(e); }
}
$('#refreshBtn').addEventListener('click', loadRekap);

// ===== INIT =====
window.addEventListener('load', () => {
  loadVersion(); // baca versi dari manifest.json
  const saved = localStorage.getItem('absensi_user');
  if(saved){ user = JSON.parse(saved); initHome(); } else { show('loginView'); }
  if('serviceWorker' in navigator){ navigator.serviceWorker.register('sw.js'); }
});
