const API_URL='https://script.google.com/macros/s/AKfycbwKWbxAmhxrZiA6o8xKQjEzyiR7GRZuimvh2KxcVFbf_CGfGqaQOegOOMQR-c9AYNqk/exec';
let user=null,cur=null,str=null,userLoc='-';
const $=s=>document.querySelector(s);
const fW=d=>new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(d);
const fD=d=>new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',weekday:'long',day:'2-digit',month:'long',year:'numeric'}).format(d);
async function api(p){const r=await fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify(p)});const j=await r.json();if(j.error)throw new Error(j.error);return j;}
function show(i){document.querySelectorAll('#app>div').forEach(v=>v.classList.add('hidden'));$('#'+i).classList.remove('hidden');}
$('#loginForm').onsubmit=async e=>{e.preventDefault();try{user=await api({action:'login',username:$('#username').value,password:$('#password').value});localStorage.absensi_user=JSON.stringify(user);init()}catch(err){$('#loginError').textContent=err.message;$('#loginError').classList.remove('hidden')}};
$('#togglePass').onclick=()=>{const p=$('#password');p.type=p.type==='password'?'text':'password';$('#togglePass').textContent=p.type==='password'?'👁️':'🙈';};
function init(){show('homeView');$('#namaHome').textContent=user.nama;if(user.foto)$('#avatarHome').src=user.foto;tick();setInterval(tick,1000);checkInstall();}
function tick(){const n=new Date();$('#jamHomeBig').textContent=fW(n).replace(/:/g,'.');$('#tanggalHomeBig').textContent=fD(n);$('#hariHome').textContent=fD(n);$('#jam').textContent=fW(n);$('#tanggal').textContent=fD(n);}
$('#logoutBtn').onclick=()=>{localStorage.removeItem('absensi_user');location.reload()};
$('#cardAbsensi').onclick=()=>{show('absensiView');loadT()};$('#cardRekap').onclick=()=>{show('rekapView');loadR()};document.querySelectorAll('[data-back]').forEach(b=>b.onclick=()=>show('homeView'));
async function loadT(){try{const a=await api({action:'getAbsensi',username:user.username});$('#timeIn').textContent=a.masuk||'-';$('#timeOut').textContent=a.pulang||'-';const bI=$('#btnIn'),bO=$('#btnOut');bI.disabled=bO.disabled=false;bI.classList.remove('opacity-40','pointer-events-none');bO.classList.remove('opacity-40','pointer-events-none');bI.textContent='Masuk';bO.textContent='Pulang';if(a.masuk&&!a.pulang){bI.disabled=true;bI.classList.add('opacity-40','pointer-events-none');bI.textContent='Sudah Masuk';}else if(a.masuk&&a.pulang){bI.disabled=bO.disabled=true;bI.classList.add('opacity-40','pointer-events-none');bO.classList.add('opacity-40','pointer-events-none');bI.textContent='Selesai';bO.textContent='Selesai';}else{bO.disabled=true;bO.classList.add('opacity-40','pointer-events-none');}}catch(e){}}
$('#btnIn').onclick=()=>openC('in');$('#btnOut').onclick=()=>openC('out');
async function openC(t){
  cur=t;
  $('#camModal').classList.replace('hidden','flex');
  str=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:720}});
  $('#video').srcObject=str;

  $('#camWatermark').classList.remove('hidden');
  $('#wmNama').textContent = user.nama;

  if(navigator.geolocation){
    navigator.geolocation.getCurrentPosition(p=>{
      userLoc = `${p.coords.latitude.toFixed(5)},${p.coords.longitude.toFixed(5)}`;
      $('#wmLokasi').textContent = userLoc;
    },()=>{$('#wmLokasi').textContent='-';});
  }
  // update jam tiap detik
  clearInterval(window.wmTimer);
  window.wmTimer = setInterval(()=>{
    $('#wmWaktu').textContent = fW(new Date()).replace(/:/g,'.') + ' WIB';
  },500);
}
function closeC(){
  $('#camModal').classList.replace('flex','hidden');
  $('#camWatermark').classList.add('hidden');
  clearInterval(window.wmTimer);
  if(str) str.getTracks().forEach(t=>t.stop());
}
$('#cancelCam').onclick=closeC;
$('#snapBtn').onclick=async()=>{const v=$('#video'),c=$('#canvas'),x=c.getContext('2d');c.width=v.videoWidth;c.height=v.videoHeight;x.drawImage(v,0,0,c.width,c.height);const n=new Date();x.shadowColor='rgba(0,0,0,0.8)';x.shadowBlur=6;x.fillStyle='#fff';x.font='22px Outfit';x.fillText(user.nama,20,c.height-70);x.font='18px Outfit';x.fillText(userLoc,20,c.height-45);x.fillText(`${fD(n)} ${fW(n)}`,20,c.height-20);closeC();$('#statusMsg').textContent='Mengirim...';try{const [lat,lng]=userLoc.split(',');await api({action:'absen',username:user.username,type:cur,photo:c.toDataURL('image/jpeg',0.82),lat,lng});$('#statusMsg').textContent='Berhasil!';loadT();}catch(e){$('#statusMsg').textContent=e.message}};
async function loadR(){const r=await api({action:'getRekap',username:user.username});const b=$('#rekapBody');b.innerHTML='';let h=0;for(let i=1;i<=31;i++){const t=r[i]||{};if(t.in)h++;b.innerHTML+=`<tr class="border-t border-white/5"><td class="py-1">${String(i).padStart(2,'0')}</td><td class="text-center font-mono">${t.in||'-'}</td><td class="text-center font-mono">${t.out||'-'}</td></tr>`}$('#totalKerja').textContent=`Total: ${h} hari`;$('#rekapTitle').textContent='Rekap '+new Date().toLocaleString('id-ID',{month:'long',year:'numeric'});}
$('#refreshBtn').onclick=loadR;
window.onload=()=>{const s=localStorage.absensi_user;if(s){user=JSON.parse(s);init()}else show('loginView');};
