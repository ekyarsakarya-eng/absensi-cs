const API_URL='https://script.google.com/macros/s/AKfycbwKWbxAmhxrZiA6o8xKQjEzyiR7GRZuimvh2KxcVFbf_CGfGqaQOegOOMQR-c9AYNqk/exec';
let user=null,cur=null,str=null,userLoc='-',profilePhotoData=null,selectedLokasi=null;
let LOCATIONS={};

const $=s=>document.querySelector(s);
const fixFoto=u=>{if(!u)return'icon-192.png';const i=(u.match(/[-\w]{25,}/)||[])[0];return i?`https://lh3.googleusercontent.com/d/${i}`:u};
const fW=d=>new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(d);
const fD=d=>new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',weekday:'long',day:'2-digit',month:'long',year:'numeric'}).format(d);

function jarak(lat1,lng1,lat2,lng2){
  const R=6371000, toRad=x=>x*Math.PI/180;
  const dLat=toRad(lat2-lat1), dLng=toRad(lng2-lng1);
  const a=Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLng/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

const apiCache={get:k=>{const v=sessionStorage.getItem(k);if(!v)return null;const o=JSON.parse(v);return Date.now()-o.t<5000?o.d:null},set:(k,d)=>sessionStorage.setItem(k,JSON.stringify({t:Date.now(),d}))};
async function api(p){
  const k=p.action+"_"+(p.username||"");
  if(p.action==="getRekap"&&apiCache.get(k))return apiCache.get(k);
  const r=await fetch(API_URL,{method:"POST",headers:{"Content-Type":"text/plain"},body:JSON.stringify(p),keepalive:true});
  const j=await r.json();
  if(j.error)throw new Error(j.error);
  if(p.action==="getRekap")apiCache.set(k,j);
  return j
}
async function kompres(f,m=720,q=.72){
  const b=await createImageBitmap(f),s=Math.min(m/b.width,m/b.height,1),c=document.createElement("canvas");
  c.width=b.width*s;c.height=b.height*s;
  c.getContext("2d",{willReadFrequently:true}).drawImage(b,0,0,c.width,c.height);
  return c.toDataURL("image/jpeg",q)
}
function show(i){document.querySelectorAll("#app>div").forEach(v=>v.classList.add("hidden"));$("#"+i).classList.remove("hidden")}

$("#loginForm").onsubmit=async e=>{e.preventDefault();$("#loginError").classList.add("hidden");try{user=await api({action:"login",username:$("#username").value.trim(),password:$("#password").value});localStorage.absensi_user=JSON.stringify(user);init()}catch(t){$("#loginError").textContent=t.message;$("#loginError").classList.remove("hidden")}};
$("#togglePass").onclick=()=>{const p=$("#password");p.type=p.type==="password"?"text":"password";$("#togglePass").textContent=p.type==="password"?"👁":"🙈"};

async function loadLokasi(){
  try{
    const data=await api({action:"getLokasi"});
    LOCATIONS={};
    data.forEach(l=>{LOCATIONS[l.nama]={lat:Number(l.lat),lng:Number(l.lng),radius:Number(l.radius)||100}});
  }catch(e){console.log("lokasi fallback")}
}
function init(){show("homeView");$("#namaHome").textContent=user.nama;$("#avatarHome").src=fixFoto(user.foto);tick();setInterval(tick,1000);loadLokasi()}
function tick(){const n=new Date;$("#jamHomeBig").textContent=fW(n).replace(/:/g,".");$("#tanggalHomeBig").textContent=fD(n);$("#hariHome").textContent=fD(n);$("#jam").textContent=fW(n);$("#tanggal").textContent=fD(n)}
$("#logoutBtn").onclick=()=>{localStorage.removeItem("absensi_user");location.reload()};

$("#cardAbsensi").onclick=()=>{show("absensiView");loadT()};
$("#cardRekap").onclick=()=>{show("rekapView");loadR()};
$("#cardProfil").onclick=()=>openProfile();
document.querySelectorAll("[data-back]").forEach(b=>b.onclick=()=>show("homeView"));

async function loadT(){try{const a=await api({action:"getAbsensi",username:user.username});$("#timeIn").textContent=a.masuk||"-";$("#timeOut").textContent=a.pulang||"-";const i=$("#btnIn"),o=$("#btnOut");i.disabled=o.disabled=false;i.classList.remove("opacity-40");o.classList.remove("opacity-40");i.textContent="Masuk";o.textContent="Pulang";if(a.masuk&&!a.pulang){i.disabled=true;i.classList.add("opacity-40");i.textContent="Sudah Masuk"}else if(a.masuk&&a.pulang){i.disabled=o.disabled=true;i.classList.add("opacity-40");o.classList.add("opacity-40");i.textContent="Selesai";o.textContent="Selesai"}else{o.disabled=true;o.classList.add("opacity-40")}}catch(e){}}

$("#btnIn").onclick=()=>pilihLokasi();
$("#btnOut").onclick=()=>{selectedLokasi=null;openC("out")};

function pilihLokasi(){
  $("#lokasiModal").classList.replace("hidden","flex");
  $("#lokasiMsg").textContent="";
  const list=$("#lokasiList");list.innerHTML="";
  Object.keys(LOCATIONS).forEach((nama,i)=>{
    const b=document.createElement("button");
    b.className="w-full py-3 rounded-2xl bg-sky-600 text-white btn";
    b.textContent=`${i+1}. ${nama}`;
    b.onclick=()=>cekLokasi(nama);
    list.appendChild(b);
  });
}
$("#cancelLokasi").onclick=()=>$("#lokasiModal").classList.replace("flex","hidden");

function cekLokasi(nama){
  const lok=LOCATIONS[nama];$("#lokasiMsg").textContent="Cek GPS...";
  if(!navigator.geolocation){$("#lokasiMsg").textContent="GPS tidak aktif";return}
  navigator.geolocation.getCurrentPosition(p=>{
    const lat=p.coords.latitude,lng=p.coords.longitude;
    const d=jarak(lat,lng,lok.lat,lok.lng);
    if(d>lok.radius){$("#lokasiMsg").textContent=`Jarak ${Math.round(d)}m > ${lok.radius}m`;return}
    selectedLokasi=nama;userLoc=`${lat.toFixed(5)},${lng.toFixed(5)}`;
    $("#lokasiModal").classList.replace("flex","hidden");
    openC("in");
  },e=>{$("#lokasiMsg").textContent="Gagal GPS: "+e.message},{enableHighAccuracy:true,timeout:12000});
}

async function openC(t){cur=t;$("#camModal").classList.replace("hidden","flex");try{str=await navigator.mediaDevices.getUserMedia({video:{facingMode:"user",width:1280}});$("#video").srcObject=str}catch(e){alert("Kamera gagal: "+e.message);closeC();return}$("#camWatermark").classList.remove("hidden");$("#wmNama").textContent=user.nama;$("#wmLokasi").textContent=selectedLokasi?`${selectedLokasi} (${userLoc})`:userLoc;clearInterval(window.wmTimer);window.wmTimer=setInterval(()=>{$("#wmWaktu").textContent=fW(new Date).replace(/:/g,".")+" WIB"},500)}
function closeC(){$("#camModal").classList.replace("flex","hidden");$("#camWatermark").classList.add("hidden");clearInterval(window.wmTimer);if(str)str.getTracks().forEach(t=>t.stop())}
$("#cancelCam").onclick=closeC;

$("#snapBtn").onclick=async()=>{const v=$("#video"),c=$("#canvas"),x=c.getContext("2d"),s=Math.min(720/v.videoWidth,1);c.width=v.videoWidth*s;c.height=v.videoHeight*s;x.drawImage(v,0,0,c.width,c.height);const n=new Date;x.shadowColor="rgba(0,0,0,0.8)";x.shadowBlur=4;x.fillStyle="#fff";x.font=`${22*s}px sans-serif`;x.fillText(user.nama,20*s,c.height-70*s);x.font=`${18*s}px sans-serif`;x.fillText(selectedLokasi||userLoc,20*s,c.height-45*s);x.fillText(`${fD(n)} ${fW(n)}`,20*s,c.height-20*s);closeC();$("#statusMsg").textContent="Mengirim...";try{const[lt,ln]=userLoc.split(",");const p=c.toDataURL("image/jpeg",.72);await api({action:"absen",username:user.username,type:cur,photo:p,lat:lt||0,lng:ln||0,lokasi:selectedLokasi||""});$("#statusMsg").textContent="Berhasil!";setTimeout(loadT,800)}catch(e){$("#statusMsg").textContent=e.message}};

async function loadR(){const r=await api({action:"getRekap",username:user.username}),b=$("#rekapBody");b.innerHTML="";let h=0;for(let i=1;i<=31;i++){const t=r[i]||{};t.in&&h++;b.innerHTML+=`<tr class="border-t border-slate-200"><td class="py-1">${String(i).padStart(2,"0")}</td><td class="text-center font-mono">${t.in||"-"}</td><td class="text-center font-mono">${t.out||"-"}</td></tr>`}$("#totalKerja").textContent=`Total: ${h} hari`;$("#rekapTitle").textContent="Rekap "+new Date().toLocaleString("id-ID",{month:"long",year:"numeric"})}
$("#refreshBtn").onclick=()=>{sessionStorage.removeItem("getRekap_"+user.username);loadR()};

async function openProfile(){show("profileView");$("#profileMsg").textContent="";try{const p=await api({action:"getProfile",username:user.username});$("#profileAvatar").src=fixFoto(p.foto);$("#pfNama").value=p.nama;$("#pfUsername").value=p.username;$("#pfNoHp").value=p.noHp||"";$("#pfAlamat").value=p.alamat||"";$("#pfNoRek").value=p.noRek||"";$("#pfTtl").value=p.ttl||"";profilePhotoData=null}catch(e){$("#profileMsg").textContent=e.message}}
$("#changePhotoBtn").onclick=()=>$("#photoInput").click();
$("#photoInput").onchange=async e=>{const f=e.target.files[0];if(!f)return;profilePhotoData=await kompres(f,600,.75);$("#profileAvatar").src=profilePhotoData};
document.querySelectorAll("[data-toggle]").forEach(b=>{b.onclick=()=>{const i=b.getAttribute("data-toggle"),e=$("#"+i);e.type=e.type==="password"?"text":"password";b.textContent=e.type==="password"?"👁":"🙈"}});
$("#profileForm").onsubmit=async e=>{e.preventDefault();const p1=$("#pfPass1").value,p2=$("#pfPass2").value;if(p1&&p1!==p2)return void($("#profileMsg").textContent="Password tidak sama");$("#profileMsg").textContent="Menyimpan...";const d={noHp:$("#pfNoHp").value,alamat:$("#pfAlamat").value,noRek:$("#pfNoRek").value,ttl:$("#pfTtl").value};p1&&(d.password=p1);profilePhotoData&&(d.fotoProfil=profilePhotoData);try{const r=await api({action:"updateProfile",username:user.username,data:d});r.foto&&(user.foto=fixFoto(r.foto),localStorage.absensi_user=JSON.stringify(user),$("#avatarHome").src=user.foto);$("#profileMsg").textContent="Berhasil disimpan";$("#pfPass1").value="";$("#pfPass2").value="";setTimeout(()=>show("homeView"),800)}catch(t){$("#profileMsg").textContent=t.message}};

window.onload=()=>{const s=localStorage.absensi_user;s?((e=>{try{user=JSON.parse(e),init()}catch{localStorage.removeItem("absensi_user"),show("loginView")}})(s)):show("loginView")};
