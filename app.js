const API_URL='https://script.google.com/macros/s/AKfycbxtru3eT8Zn6wMpWqjfLQPctuKThGFDPSIbRXKI1HInJYoQ5QnXqQZGYST68brYJas8/exec';
let deferredPrompt = null;
let isInstalled = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
let user=null,cur=null,str=null,userLoc='-',profilePhotoData=null;
let LOCATIONS = {};
let lastHijriDate = '', cachedHijri = '';

// === FORCE RE-LOGIN MECHANISM ===
const APP_VERSION='2.7.2';
const storedVersion = localStorage.getItem('app_version');

if(storedVersion && storedVersion !== APP_VERSION){
  // Ada update - clear semua dan force logout
  localStorage.clear();
  sessionStorage.clear();
  if('caches' in window){ 
    caches.keys().then(k=>k.forEach(n=>caches.delete(n))); 
  }
  if('serviceWorker' in navigator){ 
    navigator.serviceWorker.getRegistrations().then(rs=>rs.forEach(r=>r.unregister())); 
  }
  alert('Aplikasi telah diperbarui ke versi ' + APP_VERSION + '.\n\nSilakan login ulang untuk menikmati fitur terbaru.');
}

localStorage.setItem('app_version', APP_VERSION);

const $=s=>document.querySelector(s);
const fixFoto=u=>{if(!u)return'icon-192.png';const i=(u.match(/[-\w]{25,}/)||[])[0];return i?`https://lh3.googleusercontent.com/d/${i}`:u};
const fW=d=>new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(d);
const fD=d=>new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',weekday:'long',day:'2-digit',month:'long',year:'numeric'}).format(d);

// === PWA INSTALL GATE ===
function checkInstallGate(){
  const installed = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone || localStorage.pwa_installed === '1';
  if(!installed){
    $("#installGate").classList.replace('hidden','flex');
    return false;
  }
  $("#installGate").classList.replace('flex','hidden');
  return true;
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if(!isInstalled) $("#installGate").classList.replace('hidden','flex');
});

window.addEventListener('appinstalled', () => {
  isInstalled = true;
  localStorage.pwa_installed = '1';
  $("#installGate").classList.replace('flex','hidden');
});

$("#btnInstallPWA").onclick = async () => {
  if(!deferredPrompt){
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if(isIOS){
      alert('Cara Install di iPhone:\n\n1. Klik tombol Share di bawah\n2. Pilih "Add to Home Screen"\n3. Klik Add\n4. Buka dari icon di layar utama');
    } else {
      alert('Browser tidak support auto install.\n\nCara manual:\n1. Klik titik 3 di Chrome\n2. Pilih "Install aplikasi" / "Tambahkan ke Layar Utama"');
    }
    return;
  }
  deferredPrompt.prompt();
  const {outcome} = await deferredPrompt.userChoice;
  if(outcome === 'accepted'){
    $("#btnInstallPWA").textContent = 'Membuka...';
  }
  deferredPrompt = null;
};

if(localStorage.pwa_installed === '1' &&!isInstalled){
  document.addEventListener('DOMContentLoaded', () => {
    document.body.innerHTML = `
      <div class="h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-6 text-center">
        <img src="icon-512.png" class="w-20 h-20 rounded-2xl mb-4">
        <h2 class="text-xl font-bold mb-2">Buka dari Aplikasi</h2>
        <p class="text-slate-400 text-sm">Aplikasi sudah terinstall.<br>Silakan buka dari icon di layar utama HP Anda.</p>
      </div>
    `;
  });
  throw new Error('FORCE_INSTALL');
}

// === API PATCH: JSONP + RETRY ===
const apiCache = {
  get: k => {
    const v = sessionStorage.getItem(k);
    if(!v) return null;
    const o = JSON.parse(v);
    return Date.now() - o.t < 10000? o.d : null;
  },
  set: (k,d) => {
    const clone = JSON.parse(JSON.stringify(d));
    if(clone.foto && clone.foto.length > 200) delete clone.foto;
    sessionStorage.setItem(k, JSON.stringify({t:Date.now(), d:clone}));
  }
};

async function api(p){
  const k=p.action+"_"+(p.username||"")+"_"+(p.bulan||"")+"_"+(p.tahun||"");
  if(p.action==="getRekap" && apiCache.get(k)) return apiCache.get(k);

  if(p.action==="absen" || p.action==="updateProfile"){
    for(let attempt=1; attempt<=2; attempt++){
      try{
        const r=await fetch(API_URL,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(p)});
        if(!r.ok) throw new Error('HTTP '+r.status);
        const j=await r.json();
        if(j.error)throw new Error(j.error);
        return j;
      }catch(err){
        if(attempt===2) throw err;
        await new Promise(res=>setTimeout(res,700));
      }
    }
  }

  return new Promise((resolve, reject) => {
    const cbName = 'cb_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    window[cbName] = (data) => {
      delete window[cbName];
      script.remove();
      if(data.error) reject(new Error(data.error));
      else {
        if(p.action==="getRekap") apiCache.set(k, data);
        resolve(data);
      }
    };
    const script = document.createElement('script');
    const params = new URLSearchParams({...p, callback: cbName});
    script.src = `${API_URL}?${params}`;
    script.onerror = () => {
      delete window[cbName];
      script.remove();
      reject(new Error('Network error'));
    };
    document.head.appendChild(script);
    setTimeout(() => {
      if(window[cbName]) {
        delete window[cbName];
        script.remove();
        reject(new Error('Timeout'));
      }
    }, 8000);
  });
}

async function loadLokasi(){
  LOCATIONS = {
    "BALAIKOTA":{lat:-6.9825,lng:110.4131,radius:100},
    "GEDUNG JUANG":{lat:-6.983,lng:110.4135,radius:100},
    "GEDUNG PANDANARAN":{lat:-6.984,lng:110.4105,radius:100},
    "GEDUNG PKK":{lat:-6.9837,lng:110.4125,radius:100},
    "RUMDIN WALIKOTA":{lat:-6.99,lng:110.42,radius:100},
    "RUMDIN WAKIL WALIKOTA":{lat:-6.991,lng:110.421,radius:100},
    "GEDAWANG":{lat:-7.042,lng:110.424,radius:100}
  };
  try{
    const data = await api({action:'getLokasi'});
    if(Array.isArray(data) && data.length){
      const tmp = {};
      data.forEach(l=>{ if(l.nama) tmp[l.nama] = {lat:Number(l.lat),lng:Number(l.lng),radius:Number(l.radius)||100}; });
      if(Object.keys(tmp).length) LOCATIONS = tmp;
    }
  }catch(e){ console.log('pakai lokasi default'); }
}

async function kompres(f,m=600,q=.65){const b=await createImageBitmap(f),s=Math.min(m/b.width,m/b.height,1),c=document.createElement("canvas");c.width=b.width*s;c.height=b.height*s;c.getContext("2d",{willReadFrequently:true}).drawImage(b,0,0,c.width,c.height);return c.toDataURL("image/jpeg",q)}
function show(i){document.querySelectorAll("#app>div").forEach(v=>v.classList.add("hidden"));$("#"+i).classList.remove("hidden")}

$("#loginForm").onsubmit=async e=>{
  e.preventDefault();
  $("#loginError").classList.add("hidden");
  try{
    user=await api({action:"login",username:$("#username").value.trim(),password:$("#password").value});
    localStorage.absensi_user=JSON.stringify(user);
    init()
  }catch(t){
    $("#loginError").textContent=t.message;
    $("#loginError").classList.remove("hidden")
  }
};
$("#togglePass").onclick=()=>{const p=$("#password");p.type=p.type==="password"?"text":"password";$("#togglePass").textContent=p.type==="password"?"👁":"🙈"};

async function init(){
  if(!window.moment){
    await new Promise(r=>{
      const s1=document.createElement('script');
      s1.src='https://cdn.jsdelivr.net/npm/moment@2.30.1/moment.min.js';
      s1.onload=()=>{
        const s2=document.createElement('script');
        s2.src='https://cdn.jsdelivr.net/npm/moment-hijri@2.1.2/moment-hijri.min.js';
        s2.onload=r;
        document.head.appendChild(s2);
      };
      document.head.appendChild(s1);
    });
  }
  show("homeView");
  $("#namaHome").textContent=user.nama;
  $("#avatarHome").src=fixFoto(user.foto);
  $("#hariHome").textContent=user.penempatan || '-';
  tick();
  setInterval(tick,1000);
  await loadLokasi();
}

function tick(){
  const n=new Date;
  const h=String(n.getHours()).padStart(2,'0');
  const m=String(n.getMinutes()).padStart(2,'0');
  const s=String(n.getSeconds()).padStart(2,'0');
  const dateKey = n.getFullYear()+'-'+n.getMonth()+'-'+n.getDate();
  if(dateKey!== lastHijriDate){
    const pasaran=['Legi','Pahing','Pon','Wage','Kliwon'];
    const ref=new Date(2026,5,7);
    const selisih=Math.floor((n-ref)/86400000);
    const pas=pasaran[(3+selisih+1000)%5];
    moment.locale('id');
    const hijriMoment = moment(n).subtract(1, 'days');
    const hijriBulan = ['Muharram','Safar','Rabiul Awal','Rabiul Akhir','Jumadil Awal','Jumadil Akhir','Rajab','Syaban','Ramadhan','Syawal','Dzulkaidah','Dzulhijjah'];
    const hijri = hijriMoment.format('iD') + ' ' + hijriBulan[hijriMoment.iMonth()] + ' ' + hijriMoment.iYear() + ' H';
    const hari=['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][n.getDay()];
    const bulan=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'][n.getMonth()];
    const tgl=String(n.getDate()).padStart(2,'0');
    cachedHijri = hari+' '+pas+', '+tgl+' '+bulan+' '+n.getFullYear()+'<br>'+
      '<span style="color:#0ea5e9;font-size:13px">'+hijri+'</span>';
    lastHijriDate = dateKey;
    document.getElementById('tanggalHomeBig').innerHTML = cachedHijri;
  }
  document.getElementById('jamHomeBig').textContent=h+':'+m+':'+s;
  document.getElementById('jam').textContent=h+':'+m+':'+s;
}

$("#logoutBtn").onclick=()=>{localStorage.removeItem("absensi_user");location.reload()};
$("#cardAbsensi").onclick=()=>{show("absensiView");loadT()};
$("#cardRekap").onclick=()=>{
  // Set default bulan/tahun saat ini
  const now = new Date();
  $("#bulanPicker").value = now.getMonth();
  $("#tahunPicker").value = now.getFullYear();
  show("rekapView");
  loadR();
};
$("#cardProfil").onclick=()=>openProfile();
document.querySelectorAll("[data-back]").forEach(b=>b.onclick=()=>show("homeView"));

async function loadT(){
  try{
    const a=await api({action:"getAbsensi",username:user.username});
    $("#timeIn").textContent=a.masuk||"-";
    $("#timeOut").textContent=a.pulang||"-";
    const i=$("#btnIn"),o=$("#btnOut");
    i.disabled=o.disabled=false;
    i.classList.remove("opacity-40");
    o.classList.remove("opacity-40");
    i.textContent="Masuk";
    o.textContent="Pulang";
    if(a.masuk&&!a.pulang){
      i.disabled=true;
      i.classList.add("opacity-40");
      i.textContent="Sudah Masuk"
    }else if(a.masuk&&a.pulang){
      i.disabled=o.disabled=true;
      i.classList.add("opacity-40");
      o.classList.add("opacity-40");
      i.textContent="Selesai";
      o.textContent="Selesai"
    }else{
      o.disabled=true;
      o.classList.add("opacity-40")
    }
  }catch(e){ $("#statusMsg").textContent="Gagal load: "+e.message; }
}

$("#btnIn").onclick=()=>pilihLokasi();
$("#btnOut").onclick=()=>{window.pilihLokasi=null;openC("out")};

function pilihLokasi(){
  $("#lokasiModal").classList.replace("hidden","flex");
  const list=$("#lokasiList"); list.innerHTML="";
  Object.keys(LOCATIONS).forEach((nama,i)=>{
    const b=document.createElement('button');
    b.className='w-full py-3 mb-2 rounded-2xl bg-sky-600 text-white btn';
    b.textContent=`${i+1}. ${nama}`;
    b.onclick=()=>{window.pilihLokasi=nama;$("#lokasiModal").classList.replace('flex','hidden');openC('in');};
    list.appendChild(b);
  });
}
$("#cancelLokasi").onclick=()=>$("#lokasiModal").classList.replace("flex","hidden");

async function openC(t){
  cur=t;
  $("#camModal").classList.replace("hidden","flex");
  try{
    const videoEl = $("#video");
    let constraints = { video: { facingMode: {ideal:"user"}, width:{ideal:720,max:1280}, height:{ideal:960,max:1280} }, audio:false };
    try{
      str = await navigator.mediaDevices.getUserMedia(constraints);
    }catch(e1){
      str = await navigator.mediaDevices.getUserMedia({video:true,audio:false});
    }
    videoEl.srcObject = str;
    videoEl.setAttribute('playsinline', true);
    await videoEl.play().catch(()=>{});
  }catch(e){
    alert("Kamera gagal: "+e.message+"\nPastikan izin kamera aktif di Pengaturan.");
    closeC();
    return
  }
  $("#camWatermark").classList.remove("hidden");
  $("#wmNama").textContent=user.nama;
  if(navigator.geolocation){
    navigator.geolocation.getCurrentPosition(p=>{
      userLoc=`${p.coords.latitude.toFixed(5)},${p.coords.longitude.toFixed(5)}`;
      $("#wmLokasi").textContent=(window.pilihLokasi||'')+' '+userLoc
    },()=>{
      userLoc='0,0';
      $("#wmLokasi").textContent="-"
    })
  }
  clearInterval(window.wmTimer);
  window.wmTimer=setInterval(()=>{$("#wmWaktu").textContent=fW(new Date)+" WIB"},500)
}

function closeC(){
  $("#camModal").classList.replace("flex","hidden");
  $("#camWatermark").classList.add("hidden");
  clearInterval(window.wmTimer);
  if(str)str.getTracks().forEach(t=>t.stop())
}
$("#cancelCam").onclick=closeC;

$("#snapBtn").onclick=async()=>{
  const v=$("#video"),c=$("#canvas"),x=c.getContext("2d"),s=Math.min(600/v.videoWidth,1);
  c.width=v.videoWidth*s;c.height=v.videoHeight*s;
  x.drawImage(v,0,0,c.width,c.height);
  const n=new Date;
  x.shadowColor="rgba(0,0,0,0.8)";
  x.shadowBlur=4;
  x.fillStyle="#fff";
  x.font=`${22*s}px sans-serif`;
  x.fillText(user.nama,20*s,c.height-70*s);
  x.font=`${18*s}px sans-serif`;
  x.fillText(window.pilihLokasi||userLoc,20*s,c.height-45*s);
  x.fillText(`${fD(n)} ${fW(n)}`,20*s,c.height-20*s);
  closeC();
  $("#statusMsg").textContent="Mengirim...";
  try{
    const[lt,ln]=userLoc.split(",");
    const p=c.toDataURL("image/jpeg",.65);
    await api({action:"absen",username:user.username,type:cur,photo:p,lat:lt||0,lng:ln||0,lokasi:window.pilihLokasi||''});
    $("#statusMsg").textContent="Berhasil!";
    setTimeout(loadT,800)
  }catch(e){
    $("#statusMsg").textContent=e.message
  }
};

// === FUNGSI loadR YANG SUDAH DIMODIFIKASI ===
async function loadR(bulan = null, tahun = null){
  const params = {action:"getRekap", username:user.username};
  if(bulan !== null) params.bulan = bulan;
  if(tahun !== null) params.tahun = tahun;
  
  const r = await api(params);
  const b = $("#rekapBody");
  let h = 0;
  let html = '';
  
  // Tentukan jumlah hari dalam bulan
  const bulanInt = parseInt(bulan || new Date().getMonth());
  const tahunInt = parseInt(tahun || new Date().getFullYear());
  const daysInMonth = new Date(tahunInt, bulanInt + 1, 0).getDate();
  
  for(let i = 1; i <= daysInMonth; i++){
    const t = r[i] || {};
    if(t.in) h++;
    const inTime = t.in || "-";
    const outTime = t.out || "-";
    const hasIn = inTime !== "-";
    const hasOut = outTime !== "-";
    
    html += `<tr class="hover:bg-slate-50 transition-colors">
      <td class="py-2.5 px-3 font-bold text-slate-700">${String(i).padStart(2,"0")}</td>
      <td class="py-2.5 px-3 text-center font-mono text-sm ${hasIn ? 'text-emerald-600 font-semibold' : 'text-slate-400'}">${inTime}</td>
      <td class="py-2.5 px-3 text-center font-mono text-sm ${hasOut ? 'text-rose-600 font-semibold' : 'text-slate-400'}">${outTime}</td>
    </tr>`;
  }
  
  b.innerHTML = html;
  $("#totalKerja").textContent = `Total Hadir: ${h} hari dari ${daysInMonth} hari`;
  
  const bulanNames = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  $("#rekapTitle").textContent = "Rekap " + bulanNames[bulanInt] + " " + tahunInt;
}

// === EVENT LISTENER UNTUK REKAP ===
$("#refreshBtn").onclick = () => {
  const bulan = $("#bulanPicker").value;
  const tahun = $("#tahunPicker").value;
  sessionStorage.removeItem("getRekap_"+user.username+"_"+bulan+"_"+tahun);
  loadR(bulan, tahun);
};

$("#bulanPicker").onchange = () => {
  const bulan = $("#bulanPicker").value;
  const tahun = $("#tahunPicker").value;
  loadR(bulan, tahun);
};

$("#tahunPicker").onchange = () => {
  const bulan = $("#bulanPicker").value;
  const tahun = $("#tahunPicker").value;
  loadR(bulan, tahun);
};

async function openProfile(){
  show("profileView");
  $("#profileMsg").textContent="";
  try{
    const p=await api({action:"getProfile",username:user.username});
    $("#profileAvatar").src=fixFoto(p.foto);
    $("#pfNama").value=p.nama;
    $("#pfUsername").value=p.username;
    $("#pfNoHp").value=p.noHp||"";
    $("#pfAlamat").value=p.alamat||"";
    $("#pfNoRek").value=p.noRek||"";
    $("#pfTtl").value=p.ttl||"";
    profilePhotoData=null
  }catch(e){
    $("#profileMsg").textContent=e.message
  }
}

$("#changePhotoBtn").onclick=()=>$("#photoInput").click();
$("#photoInput").onchange=async e=>{const f=e.target.files[0];if(!f)return;profilePhotoData=await kompres(f,600,.75);$("#profileAvatar").src=profilePhotoData};

document.querySelectorAll("[data-toggle]").forEach(b=>{
  b.onclick=()=>{
    const i=b.getAttribute("data-toggle"),e=$("#"+i);
    e.type=e.type==="password"?"text":"password";
    b.textContent=e.type==="password"?"👁":""
  }
});

$("#profileForm").onsubmit=async e=>{
  e.preventDefault();
  const p1=$("#pfPass1").value,p2=$("#pfPass2").value;
  if(p1&&p1!==p2)return void($("#profileMsg").textContent="Password tidak sama");
  $("#profileMsg").textContent="Menyimpan...";
  const d={noHp:$("#pfNoHp").value,alamat:$("#pfAlamat").value,noRek:$("#pfNoRek").value,ttl:$("#pfTtl").value};
  p1&&(d.password=p1);
  profilePhotoData&&(d.fotoProfil=profilePhotoData);
  try{
    const r=await api({action:"updateProfile",username:user.username,data:d});
    r.foto&&(user.foto=fixFoto(r.foto),localStorage.absensi_user=JSON.stringify(user),$("#avatarHome").src=user.foto);
    $("#profileMsg").textContent="Berhasil disimpan";
    $("#pfPass1").value="";
    $("#pfPass2").value="";
    setTimeout(()=>show("homeView"),800)
  }catch(t){
    $("#profileMsg").textContent=t.message
  }
};

window.onload=()=>{
  checkInstallGate();
  const s=localStorage.absensi_user;
  if(s){
    try{
      user=JSON.parse(s);
      init();
    }catch{
      localStorage.removeItem("absensi_user");
      show("loginView");
    }
  }else{
    show("loginView");
  }
};
