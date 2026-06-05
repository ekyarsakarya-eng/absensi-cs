const API_URL='https://script.google.com/macros/s/AKfycbwKWbxAmhxrZiA6o8xKQjEzyiR7GRZuimvh2KxcVFbf_CGfGqaQOegOOMQR-c9AYNqk/exec';
let user=null,cur=null,str=null,userLoc='-',profilePhotoData=null;

const $=s=>document.querySelector(s);
const fixFoto=u=>{if(!u)return'icon-192.png';const i=(u.match(/[-\w]{25,}/)||[])[0];return i?`https://lh3.googleusercontent.com/d/${i}`:u};
const fW=d=>new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(d);
const fD=d=>new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',weekday:'long',day:'2-digit',month:'long',year:'numeric'}).format(d);

/* === API Cache 5 detik === */
const apiCache={
  get:k=>{const v=sessionStorage.getItem(k);if(!v)return null;const o=JSON.parse(v);return Date.now()-o.t<5000?o.d:null},
  set:(k,d)=>sessionStorage.setItem(k,JSON.stringify({t:Date.now(),d}))
};

async function api(p){
  const k=p.action+"_"+(p.username||"");
  if(p.action==="getRekap"&&apiCache.get(k))return apiCache.get(k);
  const r=await fetch(API_URL,{method:"POST",headers:{"Content-Type":"text/plain"},body:JSON.stringify(p),keepalive:true});
  const j=await r.json();
  if(j.error)throw new Error(j.error);
  if(p.action==="getRekap")apiCache.set(k,j);
  return j
}

/* === Kompres Foto === */
async function kompres(f,m=720,q=.72){
  const b=await createImageBitmap(f),s=Math.min(m/b.width,m/b.height,1),c=document.createElement("canvas");
  c.width=b.width*s;c.height=b.height*s;
  c.getContext("2d",{willReadFrequently:true}).drawImage(b,0,0,c.width,c.height);
  return c.toDataURL("image/jpeg",q)
}

/* === Router View === */
function show(i){
  document.querySelectorAll("#app>div").forEach(v=>v.classList.add("hidden"));
  $("#"+i).classList.remove("hidden")
}

/* === Login === */
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

$("#togglePass").onclick=()=>{
  const p=$("#password");
  p.type=p.type==="password"?"text":"password";
  $("#togglePass").textContent=p.type==="password"?"👁":"🙈"
};

/* === Home + Clock === */
function init(){
  show("homeView");
  $("#namaHome").textContent=user.nama;
  $("#avatarHome").src=fixFoto(user.foto);
  tick();
  setInterval(tick,1000)
}

function tick(){
  const n=new Date;
  $("#jamHomeBig").textContent=fW(n).replace(/:/g,".");
  $("#tanggalHomeBig").textContent=fD(n);
  $("#hariHome").textContent=fD(n);
  $("#jam").textContent=fW(n);
  $("#tanggal").textContent=fD(n)
}

$("#logoutBtn").onclick=()=>{localStorage.removeItem("absensi_user");location.reload()};

/* === Navigasi === */
$("#cardAbsensi").onclick=()=>{show("absensiView");loadT()};
$("#cardRekap").onclick=()=>{show("rekapView");loadR()};
$("#cardProfil").onclick=()=>openProfile();
document.querySelectorAll("[data-back]").forEach(b=>b.onclick=()=>show("homeView"));

/* === Absensi === */
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
      i.disabled=true;i.classList.add("opacity-40");i.textContent="Sudah Masuk"
    }else if(a.masuk&&a.pulang){
      i.disabled=o.disabled=true;
      i.classList.add("opacity-40");o.classList.add("opacity-40");
      i.textContent="Selesai";o.textContent="Selesai"
    }else{
      o.disabled=true;o.classList.add("opacity-40")
    }
  }catch(e){}
}

$("#btnIn").onclick=()=>openC("in");
$("#btnOut").onclick=()=>openC("out");

/* === Kamera === */
async function openC(t){
  cur=t;
  $("#camModal").classList.replace("hidden","flex");
  try{
    str=await navigator.mediaDevices.getUserMedia({video:{facingMode:"user",width:1280}});
    $("#video").srcObject=str
  }catch(e){
    alert("Kamera gagal: "+e.message);
    closeC();
    return
  }
  $("#camWatermark").classList.remove("hidden");
  $("#wmNama").textContent=user.nama;
  if(navigator.geolocation){
    navigator.geolocation.getCurrentPosition(p=>{
      userLoc=`${p.coords.latitude.toFixed(5)},${p.coords.longitude.toFixed(5)}`;
      $("#wmLokasi").textContent=userLoc
    },()=>{
      userLoc='0,0'; // fallback biar ga error split
      $("#wmLokasi").textContent="-"
    })
  }
  clearInterval(window.wmTimer);
  window.wmTimer=setInterval(()=>{$("#wmWaktu").textContent=fW(new Date).replace(/:/g,".")+" WIB"},500)
}

function closeC(){
  $("#camModal").classList.replace("flex","hidden");
  $("#camWatermark").classList.add("hidden");
  clearInterval(window.wmTimer);
  if(str)str.getTracks().forEach(t=>t.stop())
}

$("#cancelCam").onclick=closeC;

$("#snapBtn").onclick=async()=>{
  const v=$("#video"),c=$("#canvas"),x=c.getContext("2d"),s=Math.min(720/v.videoWidth,1);
  c.width=v.videoWidth*s;c.height=v.videoHeight*s;
  x.drawImage(v,0,0,c.width,c.height);
  const n=new Date;
  x.shadowColor="rgba(0,0,0,0.8)";x.shadowBlur=4;x.fillStyle="#fff";
  x.font=`${22*s}px sans-serif`;x.fillText(user.nama,20*s,c.height-70*s);
  x.font=`${18*s}px sans-serif`;x.fillText(userLoc,20*s,c.height-45*s);
  x.fillText(`${fD(n)} ${fW(n)}`,20*s,c.height-20*s);
  closeC();
  $("#statusMsg").textContent="Mengirim...";
  try{
    const[lt,ln]=userLoc.split(",");
    const p=c.toDataURL("image/jpeg",.72);
    await api({action:"absen",username:user.username,type:cur,photo:p,lat:lt,lng:ln});
    $("#statusMsg").textContent="Berhasil!";
    setTimeout(loadT,800)
  }catch(e){$("#statusMsg").textContent=e.message}
};

/* === Rekap === */
async function loadR(){
  const r=await api({action:"getRekap",username:user.username}),b=$("#rekapBody");
  b.innerHTML="";let h=0;
  for(let i=1;i<=31;i++){
    const t=r[i]||{};
    t.in&&h++;
    b.innerHTML+=`<tr class="border-t border-slate-200"><td class="py-1">${String(i).padStart(2,"0")}</td><td class="text-center font-mono">${t.in||"-"}</td><td class="text-center font-mono">${t.out||"-"}</td></tr>`
  }
  $("#totalKerja").textContent=`Total: ${h} hari`;
  $("#rekapTitle").textContent="Rekap "+new Date().toLocaleString("id-ID",{month:"long",year:"numeric"})
}

$("#refreshBtn").onclick=()=>{sessionStorage.removeItem("getRekap_"+user.username);loadR()};

/* === Profil === */
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
  }catch(e){$("#profileMsg").textContent=e.message}
}

$("#changePhotoBtn").onclick=()=>$("#photoInput").click();

$("#photoInput").onchange=async e=>{
  const f=e.target.files[0];if(!f)return;
  profilePhotoData=await kompres(f,600,.75);
  $("#profileAvatar").src=profilePhotoData
};

document.querySelectorAll("[data-toggle]").forEach(b=>{
  b.onclick=()=>{
    const i=b.getAttribute("data-toggle"),e=$("#"+i);
    e.type=e.type==="password"?"text":"password";
    b.textContent=e.type==="password"?"👁":"🙈"
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
    $("#pfPass1").value="";$("#pfPass2").value="";
    setTimeout(()=>show("homeView"),800)
  }catch(t){$("#profileMsg").textContent=t.message}
};

/* === Auto Login === */
window.onload=()=>{
  const s=localStorage.absensi_user;
  s?((e=>{
    try{user=JSON.parse(e),init()}catch{localStorage.removeItem("absensi_user"),show("loginView")}
  })(s)):show("loginView")
};
