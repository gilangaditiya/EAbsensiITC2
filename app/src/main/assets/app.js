/* E-ABSENSI ITC SMK GANESA - REBUILD */

const SUPABASE_URL = "https://gltcygellftrfnovmlep.supabase.co";
const SUPABASE_KEY = "sb_publishable_bLQxEyQwnJyUANs-PPhyiw_0lzXkbZt";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentMode = null;
let currentUser = null;
let currentPetugas = null;
let currentPage = "loginPage";
let anggotaData = [];
let selectedQRMember = null;
let selectedManualMember = null;
let qrScanner = null;
let toastTimer = null;
let realtimeChannel = null;
let navigationStack = [];
let isPopStateNavigation = false;
let attendanceLocks = new Map();

const $ = id => document.getElementById(id);

// ---------- TOGGLE VISIBILITAS PASSWORD ----------
function setupPasswordVisibility(root = document) {
  root.querySelectorAll?.('input[type="password"]:not([data-visibility-toggle])').forEach(input => {
    input.dataset.visibilityToggle = "true";
    const field = input.closest(".field") || input.parentElement;
    if (!field) return;
    field.classList.add("password-field-toggle");

    const button = document.createElement("button");
    button.type = "button";
    button.className = "password-visibility-toggle";
    button.setAttribute("aria-label", "Tampilkan password");
    button.setAttribute("aria-pressed", "false");
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
    button.addEventListener("click", () => {
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      button.setAttribute("aria-label", show ? "Sembunyikan password" : "Tampilkan password");
      button.setAttribute("aria-pressed", String(show));
      button.innerHTML = show
        ? '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 3l18 18"></path><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"></path><path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c6.4 0 10 7 10 7a16 16 0 0 1-3.1 3.9"></path><path d="M6.2 6.2C3.5 8 2 12 2 12s3.6 7 10 7a10.6 10.6 0 0 0 4-.8"></path></svg>'
        : '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
    });
    field.appendChild(button);
  });
}
setupPasswordVisibility();
new MutationObserver(mutations => {
  mutations.forEach(mutation => mutation.addedNodes.forEach(node => {
    if (node.nodeType === 1) {
      if (node.matches?.('input[type="password"]')) setupPasswordVisibility(node.parentElement || document);
      else setupPasswordVisibility(node);
    }
  }));
}).observe(document.documentElement, { childList: true, subtree: true });


const pages = [
  "loginPage","anggotaHomePage","dashboardPage",
  "anggotaPage","qrPage","scannerPage","manualAbsensiPage","rekapPage","pengumumanPage","pengajuanPasswordPage","pengajuanPage","memberPengajuanPage","identitasPage"
];

/* ---------- TAB BAR: pemetaan halaman ---------- */
let pendingTab=null,pendingTabTimer=null;
const TAB_ROOT_PAGES={
  pengelola:{home:["dashboardPage"],anggota:["anggotaPage"],scan:["scannerPage"],rekap:["rekapPage"],more:["manualAbsensiPage","pengajuanPage","pengajuanPasswordPage","pengumumanPage"]},
  anggota:{home:["anggotaHomePage"],identitas:["identitasPage"],rekap:["rekapPage"],pengajuan:["memberPengajuanPage"],pengumuman:["pengumumanPage"]}
};
const TAB_EXTRA_PAGES={pengelola:{anggota:["qrPage"]},anggota:{}};
function homePageFor(mode){return mode==="anggota"?"anggotaHomePage":"dashboardPage"}
function tabForPage(id){
  for(const map of [TAB_ROOT_PAGES[currentMode],TAB_EXTRA_PAGES[currentMode]]){
    if(!map)continue;
    for(const k in map)if(map[k].includes(id))return k;
  }
  return null;
}
function markPendingTab(key){
  pendingTab=key;
  clearTimeout(pendingTabTimer);
  pendingTabTimer=setTimeout(()=>{pendingTab=null},6000);
}

/* Deteksi perangkat lemah / preferensi kurangi gerak -> animasi diperingan */
const NO_MOTION=(()=>{try{return window.matchMedia("(prefers-reduced-motion: reduce)").matches}catch(_){return false}})();
(function(){
  try{
    const n=navigator;
    if((n.hardwareConcurrency&&n.hardwareConcurrency<=4)||(n.deviceMemory&&n.deviceMemory<=2))
      document.documentElement.classList.add("low-end");
  }catch(_){}
})();
function showPage(id,{pushHistory=true}={}){
  if(!$(id)) return;
  const prevEl=pages.map(p=>$(p)).find(p=>p&&p.classList.contains("active"));
  pages.forEach(p => $(p)?.classList.remove("active"));
  $(id)?.classList.add("active");
  if(prevEl&&prevEl!==$(id)&&!NO_MOTION){
    prevEl.classList.add("page-out");
    setTimeout(()=>prevEl.classList.remove("page-out"),180);
  }
  const home=homePageFor(currentMode);
  const isTabRoot=!!pendingTab && !!TAB_ROOT_PAGES[currentMode]?.[pendingTab]?.includes(id);
  if(isTabRoot && !isPopStateNavigation){
    // Perpindahan antar tab: tidak menumpuk riwayat; tombol Kembali dari tab lain menuju Beranda.
    const wasHome=(currentPage===home && navigationStack.length===0);
    if(id===home){
      navigationStack=[];
      history.replaceState({page:id}, "", `#${id}`);
    }else if(wasHome){
      navigationStack=[home];
      history.pushState({page:id}, "", `#${id}`);
    }else{
      navigationStack=[home];
      history.replaceState({page:id}, "", `#${id}`);
    }
    pendingTab=null;
  }else if(pushHistory && !isPopStateNavigation && currentPage !== id){
    navigationStack.push(currentPage);
    history.pushState({page:id}, "", `#${id}`);
  }
  currentPage = id;
  updateTabBar();
  window.scrollTo({top:0,behavior:"auto"});
}

function goBack(){
  if(navigationStack.length){
    history.back();
    return true;
  }
  return false;
}

function resetNavigation(page="modePage"){
  navigationStack=[];
  history.replaceState({page}, "", `#${page}`);
}

function escapeHTML(v){
  return String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}

function getInitials(name){
  const words = String(name || "").trim().split(/\s+/).filter(Boolean);
  if(!words.length) return "--";
  if(words.length === 1) return words[0].slice(0,2).toUpperCase();
  return (words[0][0] + words[words.length-1][0]).toUpperCase();
}

/* UUID aman: crypto.randomUUID tidak ada di WebView file:// / Android lama */
function safeUUID(){
  try{
    const c=window.crypto||window.msCrypto;
    if(c&&typeof c.randomUUID==="function")return c.randomUUID();
    if(c&&typeof c.getRandomValues==="function"){
      const b=c.getRandomValues(new Uint8Array(16));
      b[6]=(b[6]&0x0f)|0x40;b[8]=(b[8]&0x3f)|0x80;
      const h=Array.from(b,x=>x.toString(16).padStart(2,"0")).join("");
      return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
    }
  }catch(_){}
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,ch=>{const r=Math.random()*16|0;return(ch==="x"?r:(r&3|8)).toString(16)})+"-"+Date.now().toString(36);
}

function getToday(){
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function getCurrentTime(){
  const d = new Date();
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}:${String(d.getSeconds()).padStart(2,"0")}`;
}

function formatTanggal(v){
  if(!v) return "-";
  const d = new Date(v+"T00:00:00");
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString("id-ID",{day:"2-digit",month:"2-digit",year:"numeric"});
}

function statusLabel(s){
  return ({hadir:"Hadir",sakit:"Sakit",izin:"Izin","tanpa keterangan":"Tanpa Keterangan"})[s] || s || "-";
}
function statusClass(s){
  return ({hadir:"status-hadir",sakit:"status-sakit",izin:"status-izin","tanpa keterangan":"status-tanpa"})[s] || "";
}

function toast(message,type=""){
  const el=$("toast"); if(!el) return;
  clearTimeout(toastTimer);
  el.textContent=message;
  el.className="toast show "+type;
  toastTimer=setTimeout(()=>el.className="toast",2600);
}

function message(id,text,type=""){
  const el=$(id); if(!el) return;
  el.textContent=text || "";
  el.className="message "+type;
}

function recapSkeleton(count=5){
  return `<div class="skeleton-list" role="status" aria-label="Menyiapkan daftar">${Array.from({length:count},()=>`<div class="skeleton-row"><span class="skeleton skeleton-avatar"></span><div class="skeleton-lines"><span class="skeleton skeleton-line"></span><span class="skeleton skeleton-line small"></span></div><span class="skeleton skeleton-status"></span></div>`).join("")}</div>`;
}
function detailSkeleton(){
  return `<div class="skeleton-detail" role="status" aria-label="Menyiapkan detail"><span class="skeleton skeleton-line"></span><span class="skeleton skeleton-line small"></span><span class="skeleton skeleton-photo"></span></div>`;
}

function dashboardSkeleton(mode="pengelola"){
  const cards=mode==="anggota"?4:6;
  return `<div class="page-skeleton" role="status" aria-label="Memuat dashboard"><div class="skeleton skeleton-dash-title"></div><div class="skeleton skeleton-dash-subtitle"></div>${mode==="pengelola"?`<div class="skeleton-dash-stats"><div class="skeleton skeleton-dash-stat"></div><div class="skeleton skeleton-dash-stat"></div></div>`:""}<div class="skeleton-dash-menu">${Array.from({length:cards},()=>`<div class="skeleton-dash-card"><span class="skeleton skeleton-dash-icon"></span><div class="skeleton-lines"><span class="skeleton skeleton-line"></span><span class="skeleton skeleton-line small"></span></div></div>`).join("")}</div></div>`;
}
function setStartupSkeleton(mode){
  const screen=$("loadingScreen");
  if(!screen)return;
  const shell=screen.querySelector(".skeleton-shell");
  if(!shell)return;
  if(mode==="anggota"||mode==="pengelola"){
    shell.classList.add("startup-dashboard-skeleton");
    shell.innerHTML=dashboardSkeleton(mode);
    screen.setAttribute("aria-label","Menyiapkan dashboard");
  }else{
    shell.classList.remove("startup-dashboard-skeleton");
    shell.innerHTML=`<div class="skeleton skeleton-brand"></div><div class="skeleton skeleton-heading"></div><div class="skeleton skeleton-subheading"></div><div class="skeleton skeleton-panel"></div><div class="skeleton skeleton-panel short"></div>`;
    screen.setAttribute("aria-label","Menyiapkan aplikasi");
  }
}
function showDashboardSkeleton(pageId){
  const shell=$(pageId)?.querySelector(".page-shell");
  if(!shell)return;
  let overlay=shell.querySelector(":scope > .dashboard-skeleton-overlay");
  if(!overlay){overlay=document.createElement("div");overlay.className="dashboard-skeleton-overlay";shell.appendChild(overlay)}
  overlay.innerHTML=dashboardSkeleton(pageId==="anggotaHomePage"?"anggota":"pengelola");
  shell.classList.add("dashboard-is-loading");
}
function hideDashboardSkeleton(pageId){
  $(pageId)?.querySelector(".page-shell")?.classList.remove("dashboard-is-loading");
  $(pageId)?.querySelector(".dashboard-skeleton-overlay")?.remove();
}
function listSkeleton(id,count=5){const el=$(id);if(el)el.innerHTML=recapSkeleton(count)}

function setLoadingButton(btn,loadingText,loading){
  if(!btn) return;
  if(loading){
    btn.dataset.originalText=btn.textContent;
    btn.disabled=true;
    btn.textContent=loadingText;
  }else{
    btn.disabled=false;
    btn.textContent=btn.dataset.originalText || btn.textContent;
  }
}

function setMode(mode){
  currentMode=mode;
  document.body.dataset.mode=mode || "";
  buildTabBar(mode);
  try{if(mode==="anggota"||mode==="pengelola")localStorage.setItem("eabsensi_last_role",mode);else localStorage.removeItem("eabsensi_last_role")}catch(_){}
}

function backToMode(){
  stopScanner();
  setMode(null);
  currentUser=null;
  currentPetugas=null;
  selectedManualMember=null;
  selectedQRMember=null;
  resetNavigation("modePage");
  showPage("loginPage",{pushHistory:false});
}

async function getPetugas(){
  if(!currentUser) return null;
  const {data,error}=await supabaseClient.from("Petugas").select("*").eq("id",currentUser.id).maybeSingle();
  if(error) throw error;
  currentPetugas=data;
  return data;
}

/* ---------- AUTH ---------- */
let loginAsManager = false;
let currentAnggota = null;

function configureLogin(mode="anggota"){
  loginAsManager = mode === "pengelola";

  const namaField = $("loginNamaField");
  const emailField = $("loginEmailField");
  const namaInput = $("namaLogin");
  const emailInput = $("email");

  if(loginAsManager){
    $("loginEyebrow").textContent = "AKSES PENGELOLA";
    $("loginTitle").textContent = "Selamat datang";
    $("loginDescription").textContent = "Masuk ke panel pengelola untuk mengatur anggota dan absensi ITC.";
    $("loginNoteText").textContent = "Akses khusus petugas.";
    $("loginCardTitle").textContent = "Masuk sebagai Pengelola";
    $("loginCardSubtitle").textContent = "Gunakan email dan password akun petugas.";
    namaField.classList.add("hidden");
    emailField.classList.remove("hidden");
    namaInput.required = false;
    emailInput.required = true;
    $("managerLoginButton").classList.add("hidden");
    $("memberLoginButton").classList.remove("hidden");
    $("forgotPasswordButton").classList.add("hidden");
  }else{
    $("loginEyebrow").textContent = "AKSES ANGGOTA";
    $("loginTitle").textContent = "Selamat datang";
    $("loginDescription").textContent = "Masuk menggunakan nama dan password akun anggota.";
    $("loginNoteText").textContent = "Akun anggota dikelola oleh Pengelola.";
    $("loginCardTitle").textContent = "Masuk sebagai Anggota";
    $("loginCardSubtitle").textContent = "Gunakan nama dan password yang diberikan Pengelola.";
    namaField.classList.remove("hidden");
    emailField.classList.add("hidden");
    namaInput.required = true;
    emailInput.required = false;
    $("managerLoginButton").classList.remove("hidden");
    $("memberLoginButton").classList.add("hidden");
    $("forgotPasswordButton").classList.remove("hidden");
  }

  message("loginMessage","");
  $("loginForm").reset();
}

function clearAuthState(){
  currentUser=null;
  currentPetugas=null;
  currentAnggota=null;
  selectedManualMember=null;
  selectedQRMember=null;
  updateFirstPasswordNotice();
}

async function loginMember(nama,password){
  const {data,error}=await supabaseClient.functions.invoke("login-member",{
    body:{nama,password}
  });

  if(error) throw error;
  if(!data?.success || !data?.session?.access_token){
    throw new Error(data?.error || "Nama atau password salah.");
  }

  const {data:sessionData,error:sessionError}=await supabaseClient.auth.setSession({
    access_token:data.session.access_token,
    refresh_token:data.session.refresh_token
  });

  if(sessionError) throw sessionError;

  currentUser=sessionData.user;
  currentAnggota=data.anggota || null;
  try{
    const {data:memberRow}=await supabaseClient.from("Anggota").select("id,nama,kelas,email,no_hp,auth_user_id,qr_code,password_awal_sudah_diubah").eq("auth_user_id",currentUser.id).maybeSingle();
    if(memberRow) currentAnggota=memberRow;
  }catch(e){console.warn("Gagal memuat status password anggota",e)}
  currentPetugas=null;
  setMode("anggota");
  resetNavigation("anggotaHomePage");
  $("anggotaDashboardTitle").textContent=`Halo, ${currentAnggota?.nama || nama}`;
  $("anggotaDashboardSubtitle").textContent=`${currentAnggota?.kelas || "Anggota"} · Ringkasan kehadiranmu`;
  $("loginForm").reset();
  showPage("anggotaHomePage",{pushHistory:false});
  updateFirstPasswordNotice();
  loadBerandaAnggota();
}

function loginManager(email,password){
  return supabaseClient.auth.signInWithPassword({email,password});
}

configureLogin("anggota");

// ---------- PASSWORD MODALS ----------
function ensurePasswordModals(){
  if($("passwordModalRoot")) return;
  const root=document.createElement("div");
  root.id="passwordModalRoot";
  root.innerHTML=`
    <div id="forgotModal" class="app-modal hidden">
      <div class="modal-card">
        <button class="modal-close" data-close-modal="forgotModal" type="button">×</button>
        <span class="eyebrow">LUPA PASSWORD</span><h2>Konfirmasi Identitas</h2>
        <p class="modal-muted">Masukkan data yang sama dengan data anggota.</p>
        <form id="forgotIdentityForm" class="form-grid">
          <label class="field"><span>Nama</span><input id="forgotNama" required></label>
          <label class="field"><span>Kelas</span><input id="forgotKelas" required></label>
          <label class="field"><span>No. HP atau Email</span><input id="forgotKontak" required></label>
          <div id="forgotIdentityMessage" class="message"></div>
          <button class="primary-button full" type="submit">Konfirmasi</button>
        </form>
      </div>
    </div>
    <div id="requestResetModal" class="app-modal hidden">
      <div class="modal-card">
        <button class="modal-close" data-close-modal="requestResetModal" type="button">×</button>
        <span class="eyebrow">PENGAJUAN RESET</span><h2>Ajukan Reset Password</h2>
        <p id="requestResetIdentity" class="modal-muted"></p>
        <form id="requestResetForm" class="form-grid">
          <input id="requestResetAnggotaId" type="hidden">
          <label class="field"><span>Alasan</span><textarea id="requestResetAlasan" rows="5" maxlength="500" placeholder="Jelaskan alasan meminta reset password..." required></textarea></label>
          <div id="requestResetMessage" class="message"></div>
          <button class="primary-button full" type="submit">Ajukan Reset Password</button>
        </form>
      </div>
    </div>
    <div id="changePasswordModal" class="app-modal hidden">
      <div class="modal-card">
        <button class="modal-close" data-close-modal="changePasswordModal" type="button">×</button>
        <span class="eyebrow">KEAMANAN AKUN</span><h2>Ubah Password</h2>
        <p class="modal-muted">Password lama hanya digunakan untuk verifikasi dan tidak disimpan.</p>
        <form id="changePasswordForm" class="form-grid">
          <label class="field"><span>Password Lama</span><input id="passwordLama" type="password" required></label>
          <label class="field"><span>Password Baru</span><input id="passwordBaru" type="password" minlength="6" required></label>
          <label class="field"><span>Konfirmasi Password Baru</span><input id="konfirmasiPassword" type="password" minlength="6" required></label>
          <div id="changePasswordMessage" class="message"></div>
          <button class="primary-button full" type="submit">Simpan Password</button>
        </form>
      </div>
    </div>
    <div id="identityModal" class="app-modal hidden">
      <div class="modal-card">
        <button class="modal-close" data-close-modal="identityModal" type="button">×</button>
        <span class="eyebrow">IDENTITAS SAYA</span><h2 id="identityName">-</h2>
        <div class="identity-grid"><div><small>Kelas</small><strong id="identityKelas">-</strong></div><div><small>No. HP</small><strong id="identityHp">-</strong></div><div><small>Email</small><strong id="identityEmail">-</strong></div></div>
        <div class="qr-mini" id="identityQr"></div>
        <div class="identity-actions">
          <button id="memberChangePasswordButton" class="secondary-button" type="button">Ubah Password</button>
          <button id="memberForgotPasswordButton" class="secondary-button" type="button">Lupa Password</button>
        </div>
      </div>
    </div>
    <div id="managerResetModal" class="app-modal hidden">
      <div class="modal-card">
        <button class="modal-close" data-close-modal="managerResetModal" type="button">×</button>
        <span class="eyebrow">RESET OLEH PENGELOLA</span><h2 id="managerResetName">Reset Password</h2>
        <p class="modal-muted">Masukkan password baru. Password lama tidak ditampilkan.</p>
        <form id="managerResetForm" class="form-grid">
          <input id="managerResetAnggotaId" type="hidden">
          <label class="field"><span>Password Baru</span><input id="managerResetPassword" type="password" minlength="6" required></label>
          <label class="field"><span>Konfirmasi Password</span><input id="managerResetConfirm" type="password" minlength="6" required></label>
          <div id="managerResetMessage" class="message"></div>
          <button class="primary-button full" type="submit">Reset Password</button>
        </form>
      </div>
    </div>
    <div id="generatedPasswordModal" class="app-modal hidden">
      <div class="modal-card">
        <button class="modal-close" data-close-modal="generatedPasswordModal" type="button">×</button>
        <span class="eyebrow">PASSWORD BARU</span><h2>Berikan kepada anggota</h2>
        <p class="modal-muted">Password ini hanya ditampilkan sekarang. Jangan disimpan di tabel anggota.</p>
        <div class="generated-password" id="generatedPasswordText">-</div>
        <button class="primary-button full" data-close-modal="generatedPasswordModal" type="button">Selesai</button>
      </div>
    </div>`;
  document.body.appendChild(root);
  root.querySelectorAll("[data-close-modal]").forEach(b=>b.addEventListener("click",()=>closeModal(b.dataset.closeModal)));
}
function openModal(id){ensurePasswordModals(); $(id)?.classList.remove("hidden");}
function closeModal(id){$(id)?.classList.add("hidden");}
function openRequestReset(anggota){
  openModal("requestResetModal");
  $("requestResetAnggotaId").value=anggota.id;
  $("requestResetIdentity").textContent=`${anggota.nama} · ${anggota.kelas}`;
  $("requestResetAlasan").value=""; message("requestResetMessage","");
}

ensurePasswordModals();
$("forgotPasswordButton").addEventListener("click",()=>{ $("forgotIdentityForm").reset(); message("forgotIdentityMessage",""); openModal("forgotModal"); });
$("forgotIdentityForm").addEventListener("submit",async e=>{
  e.preventDefault(); const btn=e.target.querySelector("button[type=submit]"); setLoadingButton(btn,"Memeriksa...",true);
  try{
    const body={nama:$("forgotNama").value.trim(),kelas:$("forgotKelas").value.trim(),kontak:$("forgotKontak").value.trim()};
    const {data,error}=await supabaseClient.functions.invoke("request-password-reset",{body});
    if(error) throw error; if(!data?.success) throw new Error(data?.error||"Data identitas tidak cocok.");
    if(!data.verified) throw new Error(data?.error||"Verifikasi gagal.");
    closeModal("forgotModal");
    openRequestReset({id:data.anggota_id,nama:body.nama,kelas:body.kelas});
  }catch(err){message("forgotIdentityMessage",err.message||"Verifikasi gagal.","error")}finally{setLoadingButton(btn,"",false)}
});
$("requestResetForm").addEventListener("submit",async e=>{
  e.preventDefault(); const btn=e.target.querySelector("button[type=submit]"); setLoadingButton(btn,"Mengirim...",true);
  try{
    const nama=$("forgotNama").value.trim(),kelas=$("forgotKelas").value.trim(),kontak=$("forgotKontak").value.trim();
    const {data,error}=await supabaseClient.functions.invoke("request-password-reset",{body:{anggota_id:$("requestResetAnggotaId").value,nama,kelas,kontak,alasan:$("requestResetAlasan").value.trim()}});
    if(error) throw error; if(!data?.success) throw new Error(data?.error||"Gagal mengirim pengajuan.");
    closeModal("requestResetModal"); toast("Pengajuan reset password berhasil dikirim.","success");
  }catch(err){message("requestResetMessage",err.message||"Gagal mengirim pengajuan.","error")}finally{setLoadingButton(btn,"",false)}
});
$("changePasswordForm").addEventListener("submit",async e=>{
  e.preventDefault(); const btn=e.target.querySelector("button[type=submit]"); setLoadingButton(btn,"Menyimpan...",true);
  try{
    const {data,error}=await supabaseClient.functions.invoke("change-member-password",{body:{password_lama:$("passwordLama").value,password_baru:$("passwordBaru").value,konfirmasi_password:$("konfirmasiPassword").value}});
    if(error) throw error; if(!data?.success) throw new Error(data?.error||"Gagal mengubah password.");
    closeModal("changePasswordModal");
    $("changePasswordForm").reset();
    if(currentAnggota) currentAnggota.password_awal_sudah_diubah=true;
    updateFirstPasswordNotice();
    toast("Password berhasil diubah.","success");
  }catch(err){message("changePasswordMessage",err.message||"Gagal mengubah password.","error")}finally{setLoadingButton(btn,"",false)}
});
$("memberChangePasswordButton").addEventListener("click",()=>{closeModal("identityModal");$("changePasswordForm").reset();message("changePasswordMessage","");openModal("changePasswordModal")});
$("memberForgotPasswordButton").addEventListener("click",()=>{closeModal("identityModal");$("forgotIdentityForm").reset();message("forgotIdentityMessage","");openModal("forgotModal")});
$("managerResetForm").addEventListener("submit",async e=>{
  e.preventDefault(); const p=$("managerResetPassword").value,c=$("managerResetConfirm").value; if(p!==c){message("managerResetMessage","Konfirmasi password tidak cocok.","error");return;}
  const btn=e.target.querySelector("button[type=submit]");setLoadingButton(btn,"Mereset...",true);
  try{const {data,error}=await supabaseClient.functions.invoke("manager-reset-member-password",{body:{anggota_id:$("managerResetAnggotaId").value,password_baru:p}});if(error)throw error;if(!data?.success)throw new Error(data?.error||"Gagal mereset password.");closeModal("managerResetModal");$("managerResetForm").reset();toast("Password anggota berhasil direset.","success");}
  catch(err){message("managerResetMessage",err.message||"Gagal mereset password.","error")}finally{setLoadingButton(btn,"",false)}
});

$("managerLoginButton").addEventListener("click",()=>{
  configureLogin("pengelola");
  showPage("loginPage");
});

$("memberLoginButton").addEventListener("click",()=>{
  configureLogin("anggota");
  showPage("loginPage");
});

$("loginForm").addEventListener("submit",async e=>{
  e.preventDefault();

  const password=$("password").value;
  const nama=$("namaLogin").value.trim();
  const email=$("email").value.trim();

  if(!password || (loginAsManager ? !email : !nama)){
    message("loginMessage",loginAsManager
      ? "Email dan password wajib diisi."
      : "Nama dan password wajib diisi.","error");
    return;
  }

  setLoadingButton($("loginButton"),"Memproses...",true);
  message("loginMessage","");

  try{
    if(loginAsManager){
      const {data,error}=await loginManager(email,password);
      if (error) {
  throw new Error("Email atau password salah. Periksa kembali.");
      }

      currentUser=data.user;
      const petugas=await getPetugas();

      if(!petugas){
        await supabaseClient.auth.signOut();
        clearAuthState();
        throw new Error("Akun ini tidak terdaftar sebagai petugas.");
      }

      setMode("pengelola");
      resetNavigation("dashboardPage");
      $("loginForm").reset();
      showPage("dashboardPage",{pushHistory:false});
      await loadDashboard();
      toast("Login pengelola berhasil.","success");
    }else{
      await loginMember(nama,password);
      toast("Login berhasil.","success");
    }
  } catch(err) {
  console.error("Login gagal:", err);

  const pesan = err?.message || "";

  if (
    pesan.includes("Edge Function returned") ||
    pesan.includes("Invalid login credentials")
  ) {
    message(
      "loginMessage",
      "Nama atau password salah. Silakan periksa kembali.",
      "error"
    );
  } else {
    message(
      "loginMessage",
      pesan || "Login gagal. Silakan coba lagi.",
      "error"
    );
  }
}finally{
    setLoadingButton($("loginButton"),"",false);
  }
});

$("logoutButton").addEventListener("click",async()=>{
  try{await supabaseClient.auth.signOut()}catch(e){console.error(e)}
  stopScanner();
  clearAuthState();
  setMode(null);
  configureLogin("anggota");
  resetNavigation("loginPage");
  showPage("loginPage",{pushHistory:false});
  toast("Berhasil keluar.","success");
});

$("logoutAnggotaButton").addEventListener("click",async()=>{
  try{await supabaseClient.auth.signOut()}catch(e){console.error(e)}
  stopScanner();
  clearAuthState();
  setMode(null);
  configureLogin("anggota");
  resetNavigation("loginPage");
  showPage("loginPage",{pushHistory:false});
  toast("Berhasil keluar.","success");
});

$("headerHomeButton").addEventListener("click",()=>{
  if(currentUser && (currentMode==="pengelola" || currentMode==="anggota")) navTo("home");
  else showPage("loginPage");
});

/* ---------- JADWAL PERTEMUAN ---------- */
async function hasMeetingOn(date){if(!date)return false;const {data,error}=await supabaseClient.from("Pertemuan").select("id").eq("tanggal",date).limit(1);if(error)throw error;return !!data?.length}
async function getMeetingDates(futureOnly=false){let q=supabaseClient.from("Pertemuan").select("id,tanggal").order("tanggal",{ascending:false});if(futureOnly)q=q.gt("tanggal",getToday());const {data,error}=await q;if(error)throw error;return (data||[]).filter(x=>x.tanggal)}
async function requireMeetingToday(kind){try{if(await hasMeetingOn(getToday()))return true;toast(kind==="scan"?"Tidak dapat melakukan scan QR, karena belum waktunya untuk melakukan absensi.":"Tidak dapat melakukan absensi manual, karena belum waktunya untuk melakukan absensi.","warning");return false}catch(e){toast("Gagal memeriksa jadwal pertemuan.","error");return false}}
function closeJadwalModal(){$("jadwalPertemuanModal").classList.add("hidden");refreshBeranda()}
async function renderJadwalList(){const el=$("jadwalPertemuanList");try{const ds=await getMeetingDates(true);el.innerHTML=ds.length?ds.map(d=>`<article class="request-card"><div><strong>${escapeHTML(formatTanggal(d.tanggal))}</strong></div><button class="mini-button danger" type="button" data-hapus-jadwal="${escapeHTML(d.id)}">Hapus</button></article>`).join(""):'<p>Belum ada jadwal mendatang.</p>'}catch(e){el.textContent="Gagal memuat jadwal: "+e.message}}
$("jadwalkanPertemuanButton").addEventListener("click",async()=>{if(currentMode!=="pengelola")return;$("jadwalPertemuanTanggal").min=getToday();$("jadwalPertemuanTanggal").value="";message("jadwalPertemuanMessage","");$("jadwalPertemuanModal").classList.remove("hidden");await renderJadwalList()});
$("closeJadwalPertemuan").addEventListener("click",closeJadwalModal);$("batalJadwalPertemuan").addEventListener("click",closeJadwalModal);document.querySelectorAll("[data-close-jadwal]").forEach(x=>x.addEventListener("click",closeJadwalModal));
$("jadwalPertemuanForm").addEventListener("submit",async e=>{e.preventDefault();const tanggal=$("jadwalPertemuanTanggal").value;if(!currentPetugas?.id||!tanggal)return;if(tanggal<getToday()){message("jadwalPertemuanMessage","Tanggal tidak boleh sebelum hari ini.","error");return}try{if(await hasMeetingOn(tanggal)){message("jadwalPertemuanMessage","Tanggal tersebut sudah memiliki jadwal.","error");return}const {error}=await supabaseClient.from("Pertemuan").insert({tanggal,dibuat_oleh:currentPetugas.id});if(error)throw error;message("jadwalPertemuanMessage","Jadwal berhasil disimpan.","success");await renderJadwalList();toast("Jadwal pertemuan berhasil dibuat.","success")}catch(err){message("jadwalPertemuanMessage",err.message||"Gagal menyimpan jadwal.","error")}});
$("jadwalPertemuanList").addEventListener("click",async e=>{const btn=e.target.closest("[data-hapus-jadwal]");if(!btn||!confirm("Hapus jadwal ini?"))return;try{const {error}=await supabaseClient.from("Pertemuan").delete().eq("id",btn.dataset.hapusJadwal);if(error)throw error;await renderJadwalList();toast("Jadwal dihapus.","success")}catch(err){toast(err.message,"error")}});

/* ---------- DASHBOARD ---------- */
/* loadDashboard() = memuat Beranda pengelola (lihat bagian BERANDA di bawah) */
$("anggotaButton").addEventListener("click",async()=>{anggotaSort="kelas";updateAnggotaSortUI();showPage("anggotaPage");await loadAnggota()});
$("backFromAnggota").addEventListener("click",async()=>{if(!goBack())showPage(currentMode==="anggota"?"anggotaHomePage":"dashboardPage",{pushHistory:false});if(currentMode==="pengelola"&&currentPage==="dashboardPage")await loadDashboard()});
$("scanQRButton").addEventListener("click",async()=>{if(!await requireMeetingToday("scan"))return;showPage("scannerPage");await startScanner();await loadScannerMembers()});
$("manualAbsensiButton").addEventListener("click",async()=>{
  if(!await requireMeetingToday("manual"))return;
  resetManual();
  $("manualAbsensiSearch").value="";
  showPage("manualAbsensiPage");
  await loadManualMembers("");
});
ensureManualPengajuanButton();
/* ---------- REKAP ANGGOTA: daftar riwayat + filter status ---------- */
let memberRekapRows=[];
let memberRekapFilter="semua";

function setRekapView(mode){
  const member=mode==="anggota";
  $("rekapPage").classList.toggle("is-member-view",member);
  $("rekapFilterPanel").classList.toggle("hidden",member);
  $("rekapStats").classList.toggle("hidden",member);
  $("memberRekapFilters").classList.toggle("hidden",!member);
  $("rekapEyebrow").textContent=member?"RIWAYAT SAYA":"RIWAYAT ABSENSI";
  $("rekapSubtitle").textContent=member?"Riwayat kehadiranmu, dari pertemuan terbaru.":"Lihat kehadiran berdasarkan tanggal.";
  $("rekapListTitle").textContent=member?"Riwayat Kehadiran":"Daftar Anggota";
  $("rekapListHint").textContent=member?"":"Status absensi pada tanggal terpilih";
  $("rekapEmptyTitle").textContent="Belum ada absensi";
  $("rekapEmptyText").textContent=member?"Riwayat kehadiranmu akan muncul di sini.":"Tidak ada data absensi pada tanggal ini.";
}

function memberRekapCategory(row){
  const st=row.status;
  if(st==="hadir"||st==="izin"||st==="sakit"||st==="menunggu")return st;
  return "alpa";
}

function tanggalBadge(iso){
  const p=String(iso||"").split("-");
  const bln=["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
  if(p.length!==3)return {day:"--",month:"",year:""};
  return {day:p[2],month:bln[+p[1]-1]||"",year:p[0]};
}

function renderMemberRekapList(){
  const list=$("rekapList");
  const counts={semua:memberRekapRows.length,hadir:0,izin:0,sakit:0,alpa:0};
  memberRekapRows.forEach(r=>{const c=memberRekapCategory(r);if(counts[c]!==undefined)counts[c]++});
  document.querySelectorAll("#memberRekapFilters .chip").forEach(chip=>{
    const f=chip.dataset.filter,on=f===memberRekapFilter;
    chip.classList.toggle("active",on);
    chip.setAttribute("aria-pressed",String(on));
    chip.querySelector("b").textContent=counts[f]||0;
  });

  const rows=memberRekapFilter==="semua"?memberRekapRows:memberRekapRows.filter(r=>memberRekapCategory(r)===memberRekapFilter);
  $("rekapListHint").textContent=rows.length+" pertemuan";
  list.innerHTML="";
  const empty=$("rekapEmptyState");
  empty.classList.toggle("hidden",rows.length>0);
  if(!rows.length){
    const filtered=memberRekapFilter!=="semua"&&memberRekapRows.length>0;
    $("rekapEmptyTitle").textContent=filtered?"Tidak ada data":"Belum ada absensi";
    $("rekapEmptyText").textContent=filtered?"Tidak ada kehadiran dengan status ini.":"Riwayat kehadiranmu akan muncul di sini.";
    return;
  }

  const labelMap={hadir:"HADIR",izin:"IZIN",sakit:"SAKIT","izin (alpa)":"IZIN (ALPA)","sakit (alpa)":"SAKIT (ALPA)","tanpa keterangan":"ALPA",menunggu:"MENUNGGU"};
  const frag=document.createDocumentFragment();
  rows.forEach(row=>{
    const label=labelMap[row.status]||String(row.status||"ALPA").toUpperCase();
    const statusCls=row.status.includes("izin")?"status-izin":row.status.includes("sakit")?"status-sakit":row.status==="hadir"?"status-hadir":row.status==="menunggu"?"status-izin":"status-tanpa";
    const expandable=row.detailType!=="hadir";
    const d=tanggalBadge(row.tanggal);
    const item=document.createElement("article");
    item.className="recap-row member-recap-row"+(expandable?" is-expandable":"");
    item.innerHTML=`
      <button class="recap-row-main" type="button" ${expandable?"":"disabled"} aria-expanded="false">
        <span class="recap-date" aria-label="${escapeHTML(formatTanggal(row.tanggal))}"><strong>${escapeHTML(d.day)}</strong><small>${escapeHTML(d.month)} ${escapeHTML(d.year)}</small></span>
        <span class="recap-person">
          <strong>${escapeHTML(currentAnggota.nama||"-")}</strong>
          <small>${escapeHTML(currentAnggota.kelas||"-")}</small>
        </span>
        <span class="recap-status ${statusCls}">${escapeHTML(label)}</span>
        ${expandable?`<span class="recap-chevron" aria-hidden="true">⌄</span>`:""}
      </button>
      <div class="recap-detail" hidden></div>`;
    if(expandable){
      const main=item.querySelector(".recap-row-main");
      main.addEventListener("click",async()=>{
        const detail=item.querySelector(".recap-detail");
        const opening=detail.hidden;
        detail.hidden=!opening;
        main.setAttribute("aria-expanded",String(opening));
        item.classList.toggle("open",opening);
        if(opening&&detail.dataset.loaded!=="1"){
          detail.innerHTML=detailSkeleton();
          await renderMemberRekapDetail(detail,row,row.tanggal);
          detail.dataset.loaded="1";
        }
      });
    }
    frag.appendChild(item);
  });
  list.appendChild(frag);
}

async function loadMemberRekap(){
  if(!currentAnggota?.id){
    toast("Data anggota belum tersedia.","error");
    return;
  }
  const list=$("rekapList");
  list.innerHTML=recapSkeleton(4);
  $("rekapEmptyState").classList.add("hidden");

  try{
    const [{data:absensiRows,error:absensiError},{data:pengajuanRows,error:pengajuanError}]=await Promise.all([
      supabaseClient.from("Absensi")
        .select("id,anggota_id,tanggal,jam,status,metode,petugas_id")
        .eq("anggota_id",currentAnggota.id)
        .order("tanggal",{ascending:false})
        .order("jam",{ascending:false}),
      supabaseClient.from("Pengajuan")
        .select("id,anggota_id,tanggal,jenis,alasan,foto_bukti,status,alasan_penolakan,diajukan_pada,diproses_pada")
        .eq("anggota_id",currentAnggota.id)
        .order("diajukan_pada",{ascending:false})
    ]);
    if(absensiError)throw absensiError;
    if(pengajuanError)throw pengajuanError;

    // satu baris per tanggal; absensi lebih utama daripada pengajuan
    const attByDate=new Map(),reqByDate=new Map();
    for(const r of absensiRows||[])if(r.tanggal&&!attByDate.has(r.tanggal))attByDate.set(r.tanggal,r);
    for(const r of pengajuanRows||[])if(r.tanggal&&!reqByDate.has(r.tanggal))reqByDate.set(r.tanggal,r);

    const rows=[];
    for(const tanggal of new Set([...attByDate.keys(),...reqByDate.keys()])){
      const attendance=attByDate.get(tanggal)||null;
      const request=reqByDate.get(tanggal)||null;
      if(attendance){
        const raw=String(attendance.status||"tanpa keterangan").toLowerCase();
        rows.push({tanggal,status:raw,attendance,request,detailType:(raw==="hadir"?"hadir":raw==="izin"||raw==="sakit"?raw:"alpa")});
      }else{
        const reqStatus=String(request.status||"").toLowerCase();
        if(reqStatus==="diterima")rows.push({tanggal,status:request.jenis,attendance:null,request,detailType:request.jenis});
        else if(reqStatus==="ditolak")rows.push({tanggal,status:request.jenis+" (alpa)",attendance:null,request,detailType:"rejected"});
        else rows.push({tanggal,status:"menunggu",attendance:null,request,detailType:"pending"});
      }
    }
    rows.sort((x,y)=>x.tanggal<y.tanggal?1:x.tanggal>y.tanggal?-1:0); // terbaru -> terlama
    memberRekapRows=rows;
    renderMemberRekapList();
  }catch(error){
    console.error("loadMemberRekap:",error);
    list.innerHTML=`<div class="recap-error">Gagal memuat rekap.<br><small>${escapeHTML(error.message||"Terjadi kesalahan.")}</small></div>`;
    toast("Gagal memuat rekap absensi kamu.","error");
  }
}

$("memberRekapFilters").addEventListener("click",e=>{
  const chip=e.target.closest("[data-filter]");
  if(!chip)return;
  memberRekapFilter=chip.dataset.filter;
  renderMemberRekapList();
});

async function renderMemberRekapDetail(container,row,tanggal){
  const request=row.request;
  const attendance=row.attendance;

  if(row.detailType==="alpa"){
    container.innerHTML=`<div class="recap-detail-grid"><div><span>Keterangan</span><strong>Tanpa keterangan.</strong></div></div>`;
    return;
  }

  let photoUrl="";
  if(request?.foto_bukti){
    photoUrl=await getPengajuanProofUrl(request.foto_bukti);
  }

  const jenisLabel=request?.jenis==="sakit"?"Sakit":"Izin";
  const jam=(attendance?.jam&&attendance.metode!=="Pengajuan")?String(attendance.jam).slice(0,5):"-";

  const photoHtml=photoUrl
    ? `<div class="recap-detail-wide"><span>Bukti</span><div class="recap-proof"><img src="${escapeHTML(photoUrl)}" alt="Bukti pengajuan"><button type="button" class="secondary-button recap-image-button" data-image-url="${escapeHTML(photoUrl)}">Perbesar Gambar</button></div></div>`
    : request?.foto_bukti
      ? `<div class="recap-detail-wide"><span>Bukti</span><strong>Bukti tersimpan, tetapi gambar tidak dapat dimuat.</strong></div>`
      : "";

  if(row.detailType==="pending"){
    container.innerHTML=`<div class="recap-detail-grid">
      <div><span>Jenis Pengajuan</span><strong>${escapeHTML(jenisLabel)}</strong></div>
      <div><span>Status</span><strong>Menunggu persetujuan</strong></div>
      <div class="recap-detail-wide"><span>Alasan</span><strong>${escapeHTML(request?.alasan||"-")}</strong></div>
      ${photoHtml}
    </div>`;
    bindRecapImageButton(container);
    return;
  }

  if(row.detailType==="rejected"){
    container.innerHTML=`<div class="recap-detail-grid">
      <div><span>Jenis Pengajuan</span><strong>${escapeHTML(jenisLabel)}</strong></div>
      <div><span>Status</span><strong>Ditolak → Alpa</strong></div>
      <div class="recap-detail-wide"><span>Alasan Pengajuan</span><strong>${escapeHTML(request?.alasan||"-")}</strong></div>
      <div class="recap-detail-wide"><span>Alasan Penolakan</span><strong>${escapeHTML(request?.alasan_penolakan||"-")}</strong></div>
      ${photoHtml}
    </div>`;
    bindRecapImageButton(container);
    return;
  }

  container.innerHTML=`<div class="recap-detail-grid">
    <div><span>Status</span><strong>${escapeHTML(statusLabel(row.status))}</strong></div>
    <div><span>Jam</span><strong>${escapeHTML(jam)}</strong></div>
    ${request?`<div class="recap-detail-wide"><span>Alasan Pengajuan</span><strong>${escapeHTML(request.alasan||"-")}</strong></div>`:""}
    ${photoHtml}
  </div>`;
  bindRecapImageButton(container);
}

$("rekapButton").addEventListener("click",async()=>{setRekapView("pengelola");showPage("rekapPage");await setupRecapDateOptions();await loadRekap()});

$("pengumumanButton").addEventListener("click",async()=>{showPage("pengumumanPage");await loadPengumuman()});

/* ---------- ANGGOTA ---------- */
let anggotaSort="kelas"; // az | kelas | terbaru | terlama
function sortAnggota(list,mode=anggotaSort){
  const arr=list.slice();
  const teks=(a,b)=>String(a||"").localeCompare(String(b||""),"id",{numeric:true,sensitivity:"base"});
  const byNama=(a,b)=>teks(a.nama,b.nama);
  const gabung=(a,b,arah)=>{ // arah: -1 = terbaru dulu, 1 = terlama dulu; yang tanpa tanggal selalu di bawah
    const x=a.tanggal_bergabung||"",y=b.tanggal_bergabung||"";
    if(x===y)return byNama(a,b);
    if(!x)return 1;
    if(!y)return -1;
    return (x<y?-1:1)*arah;
  };
  if(mode==="az")arr.sort(byNama);
  else if(mode==="terbaru")arr.sort((a,b)=>gabung(a,b,-1));
  else if(mode==="terlama")arr.sort((a,b)=>gabung(a,b,1));
  else arr.sort((a,b)=>teks(a.kelas,b.kelas)||byNama(a,b));
  return arr;
}
function updateAnggotaSortUI(){
  document.querySelectorAll("#anggotaSortGroup .seg-btn").forEach(btn=>{
    const on=btn.dataset.sort===anggotaSort;
    btn.classList.toggle("active",on);
    btn.setAttribute("aria-pressed",String(on));
  });
  $("anggotaSortHint").classList.toggle("hidden",anggotaSort!=="terbaru"&&anggotaSort!=="terlama");
}
$("anggotaSortGroup").addEventListener("click",e=>{
  const btn=e.target.closest("[data-sort]");
  if(!btn)return;
  anggotaSort=btn.dataset.sort;
  updateAnggotaSortUI();
  renderAnggota(sortAnggota(anggotaData));
});

async function loadAnggota(search=""){
  const list=$("anggotaList"), empty=$("anggotaEmptyState");
  listSkeleton("anggotaList");
  try{
    let q=supabaseClient.from("Anggota").select("*").order("nama",{ascending:true});
    if(search.trim()) q=q.or(`nama.ilike.%${search.trim()}%,kelas.ilike.%${search.trim()}%`);
    const {data,error}=await q;
    if(error) throw error;
    anggotaData=data||[];
    $("jumlahAnggota").textContent=anggotaData.length;
    empty.classList.toggle("hidden",anggotaData.length>0);
    renderAnggota(sortAnggota(anggotaData));
  }catch(e){console.error(e);toast("Gagal memuat data anggota.","error")}
}

function renderAnggota(data){
  const list=$("anggotaList"); list.innerHTML="";
  data.forEach(m=>{
    const card=document.createElement("article");
    card.className="member-card";
    const active=(m.status||"aktif")==="aktif";
    const canManage=currentMode==="pengelola";
    card.innerHTML=`
      <div class="avatar">${escapeHTML(getInitials(m.nama))}</div>
      <div class="member-info">
        <strong>${escapeHTML(m.nama||"-")}</strong>
        <span>${escapeHTML(m.kelas||"-")}</span>
        <small>Bergabung: ${escapeHTML(formatTanggal(m.tanggal_bergabung))}</small>
      </div>
      <div class="member-meta">
        <span class="status-pill ${active?"status-active":"status-inactive"}">${active?"Aktif":"Nonaktif"}</span>
        <div class="member-actions">
          <button class="mini-button" data-action="qr" data-id="${escapeHTML(m.id)}" type="button">QR</button>
          ${canManage?`<button class="mini-button" data-action="edit" data-id="${escapeHTML(m.id)}" type="button">Edit</button><button class="mini-button" data-action="reset" data-id="${escapeHTML(m.id)}" type="button">Reset PW</button><button class="mini-button danger" data-action="delete" data-id="${escapeHTML(m.id)}" type="button">Hapus</button>`:""}
        </div>
      </div>`;
    list.appendChild(card);
  });
}

$("searchAnggota").addEventListener("input",e=>loadAnggota(e.target.value));
$("anggotaList").addEventListener("click",async e=>{
  const b=e.target.closest("[data-action]"); if(!b)return;
  const id=b.dataset.id;
  if(b.dataset.action==="qr") await openQR(id);
  if(b.dataset.action==="edit") openEdit(id);
  if(b.dataset.action==="reset"){const m=anggotaData.find(x=>x.id===id);if(m){$("managerResetName").textContent=`Reset Password: ${m.nama}`;$("managerResetAnggotaId").value=m.id;$("managerResetForm").reset();message("managerResetMessage","");openModal("managerResetModal")}}
  if(b.dataset.action==="delete") await deleteMember(id);
});

$("tambahAnggotaButton").addEventListener("click",()=>{
  if(currentMode!=="pengelola")return;
  $("formAnggota").reset(); $("tanggalBergabung").value=getToday(); $("statusAnggota").value="aktif";
  $("tambahAnggotaForm").classList.remove("hidden"); $("formEditAnggota").classList.add("hidden");
  $("tambahAnggotaForm").scrollIntoView({behavior:"smooth",block:"start"});
});
$("batalTambahAnggota").addEventListener("click",()=>{$("tambahAnggotaForm").classList.add("hidden");$("formAnggota").reset()});
$("batalEditAnggota").addEventListener("click",()=>{$("formEditAnggota").classList.add("hidden")});

$("formAnggota").addEventListener("submit",async e=>{
  e.preventDefault(); if(currentMode!=="pengelola")return;
  const nama=$("namaAnggota").value.trim(),kelas=$("kelasAnggota").value.trim(),no_hp=$("noHpAnggota").value.trim(),email=$("emailAnggota").value.trim(),password=$("passwordAnggota").value,tanggalBergabung=$("tanggalBergabung").value,status=$("statusAnggota").value;
  if(!nama||!kelas||!password||!tanggalBergabung){message("anggotaMessage","Nama, kelas, password, dan tanggal bergabung wajib diisi.","error");return}
  if(password.length<6){message("anggotaMessage","Password minimal 6 karakter.","error");return}
  const btn=e.target.querySelector("button[type=submit]");setLoadingButton(btn,"Membuat akun...",true);
  try{
    const {data,error}=await supabaseClient.functions.invoke("create-member",{body:{nama,kelas,no_hp,email,password,tanggalBergabung,status}});
    if(error)throw error; if(!data?.success)throw new Error(data?.error||"Gagal membuat akun anggota.");
    $("formAnggota").reset();$("tanggalBergabung").value=getToday();$("statusAnggota").value="aktif";$("tambahAnggotaForm").classList.add("hidden");
    await loadAnggota();await loadDashboard();toast("Akun anggota berhasil dibuat.","success");
  }catch(err){console.error(err);message("anggotaMessage",err.message||"Gagal menambah anggota.","error")}finally{setLoadingButton(btn,"",false)}
});

function openEdit(id){
  const m=anggotaData.find(x=>x.id===id); if(!m)return;
  $("editId").value=m.id;$("editNama").value=m.nama||"";$("editKelas").value=m.kelas||"";$("editTanggal").value=m.tanggal_bergabung||getToday();$("editStatus").value=m.status||"aktif";
  $("formEditAnggota").classList.remove("hidden");$("tambahAnggotaForm").classList.add("hidden");
  $("formEditAnggota").scrollIntoView({behavior:"smooth",block:"start"});
}

$("editForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const id=$("editId").value;
  const payload={nama:$("editNama").value.trim(),kelas:$("editKelas").value.trim(),tanggal_bergabung:$("editTanggal").value,status:$("editStatus").value};
  if(!payload.nama||!payload.kelas||!payload.tanggal_bergabung){message("editAnggotaMessage","Lengkapi data anggota.","error");return}
  const btn=e.target.querySelector("button[type=submit]");setLoadingButton(btn,"Menyimpan...",true);
  try{
    const {error}=await supabaseClient.from("Anggota").update(payload).eq("id",id);
    if(error)throw error;
    $("formEditAnggota").classList.add("hidden");await loadAnggota();toast("Data anggota diperbarui.","success");
  }catch(err){console.error(err);message("editAnggotaMessage",err.message||"Gagal memperbarui.","error")}
  finally{setLoadingButton(btn,"",false)}
});

async function deleteMember(id){
  const m=anggotaData.find(x=>x.id===id); if(!m)return;
  if(!confirm(`Hapus anggota "${m.nama}"?`))return;
  try{
    const {error}=await supabaseClient.from("Anggota").delete().eq("id",id);
    if(error)throw error;
    await loadAnggota();await loadDashboard();toast("Anggota dihapus.","success");
  }catch(e){console.error(e);toast(e.message||"Gagal menghapus anggota.","error")}
}

/* ---------- QR ---------- */
async function openQR(id){
  const m=anggotaData.find(x=>x.id===id);
  if(!m){
    const {data,error}=await supabaseClient.from("Anggota").select("*").eq("id",id).single();
    if(error){toast("Data anggota tidak ditemukan.","error");return}
    selectedQRMember=data;
  }else selectedQRMember=m;
  $("qrMemberName").textContent=selectedQRMember.nama||"-";
  $("qrMemberClass").textContent=selectedQRMember.kelas||"-";
  $("qrCodeDisplay").innerHTML="";
  new QRCode($("qrCodeDisplay"),{text:selectedQRMember.qr_code||selectedQRMember.id,width:256,height:256,colorDark:"#071a32",colorLight:"#ffffff",correctLevel:QRCode.CorrectLevel.M});
  showPage("qrPage");
}
$("backFromQR").addEventListener("click",async()=>{if(!goBack())showPage("anggotaPage",{pushHistory:false});if(currentPage==="anggotaPage")await loadAnggota($("searchAnggota").value)});
;

/* ---------- MEMBER DASHBOARD ---------- */
$("anggotaPengumumanButton").addEventListener("click",async()=>{
  showPage("pengumumanPage");
  await loadPengumuman();
});

$("anggotaRekapButton").addEventListener("click",async()=>{
  memberRekapFilter="semua";
  setRekapView("anggota");
  showPage("rekapPage");
  await loadMemberRekap();
});

$("anggotaIdentitasButton").addEventListener("click",async()=>{
  if(!currentAnggota?.id){toast("Data anggota belum tersedia.","error");return;}
  $("identitasNama").textContent=currentAnggota.nama||"-";
  $("identitasKelas").textContent=currentAnggota.kelas||"-";
  $("identitasHp").textContent=currentAnggota.no_hp||"-";
  $("identitasEmail").textContent=currentAnggota.email||"-";
  $("identitasQr").innerHTML="";
  if(window.QRCode)new QRCode($("identitasQr"),{text:currentAnggota.qr_code||currentAnggota.id,width:200,height:200,colorDark:"#071a32",colorLight:"#ffffff",correctLevel:QRCode.CorrectLevel.M});
  showPage("identitasPage");
});
$("identitasChangePasswordButton").addEventListener("click",()=>{$("changePasswordForm").reset();message("changePasswordMessage","");openModal("changePasswordModal")});
$("identitasForgotPasswordButton").addEventListener("click",()=>{$("forgotIdentityForm").reset();message("forgotIdentityMessage","");openModal("forgotModal")});

$("anggotaPengajuanButton").addEventListener("click",()=>{
  openPengajuanPage();
});


/* ---------- MEMBER PENGAJUAN IZIN / SAKIT ---------- */

let memberPengajuanPageReady = false;

function ensureMemberPengajuanPage(){
  if(memberPengajuanPageReady) return;

  const page = document.createElement("section");
  page.id = "memberPengajuanPage";
  page.className = "page";

  page.innerHTML = `
    <div class="page-shell pengajuan-shell">
      <div class="section-heading-row pengajuan-heading">
        <button id="backFromMemberPengajuan" class="back-button compact" type="button">←</button>
        <div class="section-heading">
          <span class="eyebrow">ABSENSI ANGGOTA</span>
          <h1>Pengajuan Absensi</h1>
          <p>Ajukan izin atau sakit untuk kegiatan ekstrakurikuler.</p>
        </div>
      </div>

      <div id="memberPengajuanStatus" class="pengajuan-status-message hidden"></div>

      <div class="panel pengajuan-panel" id="memberPengajuanFormPanel">
        <div class="panel-title">
          <span class="eyebrow">FORM PENGAJUAN</span>
          <h2>Izin / Sakit</h2>
          <p>Isi data dengan lengkap. Foto bukti akan otomatis dikompres sebelum disimpan.</p>
        </div>

        <form id="memberPengajuanForm" class="form-grid">
          <label class="field">
            <span>Jenis Pengajuan</span>
            <select id="memberPengajuanJenis" required>
              <option value="">Pilih jenis pengajuan</option>
              <option value="izin">Izin</option>
              <option value="sakit">Sakit</option>
            </select>
          </label>

          <label class="field">
            <span>Tanggal</span>
            <select id="memberPengajuanTanggal" required><option value="">Memuat jadwal...</option></select>
          </label>

          <label class="field">
            <span>Alasan</span>
            <textarea id="memberPengajuanAlasan" rows="5" maxlength="1000" placeholder="Jelaskan alasan izin atau sakit..." required></textarea>
          </label>

          <label class="field">
            <span>Foto Bukti</span>
            <input id="memberPengajuanBukti" type="file" accept="image/*" required>
            <small class="pengajuan-help">Foto boleh berukuran besar. Sistem akan otomatis mengompres foto menjadi maksimal sekitar 200 KB.</small>
          </label>

          <div id="memberPengajuanPreview" class="pengajuan-preview hidden">
            <img id="memberPengajuanPreviewImg" alt="Preview foto bukti">
            <div id="memberPengajuanFileInfo" class="pengajuan-file-info"></div>
          </div>

          <div id="memberPengajuanMessage" class="message"></div>

          <div class="pengajuan-actions">
            <button id="batalMemberPengajuanButton" type="button" class="secondary-button">Batal</button>
            <button id="kirimMemberPengajuanButton" type="submit" class="primary-button">Kirim Pengajuan</button>
          </div>
        </form>
      </div>

      <div class="pengajuan-note">
        <strong>Catatan:</strong> Pengajuan akan berstatus <strong>Menunggu</strong> sampai diperiksa oleh Pengelola.
      </div>
    </div>
  `;

  const toastElement = $("toast");
  if(toastElement) toastElement.parentNode.insertBefore(page,toastElement);
  else $("app").appendChild(page);

  $("backFromMemberPengajuan").addEventListener("click",closeMemberPengajuanPage);
  $("batalMemberPengajuanButton").addEventListener("click",closeMemberPengajuanPage);
  $("memberPengajuanBukti").addEventListener("change",previewMemberPengajuanBukti);
  $("memberPengajuanTanggal").addEventListener("change",async()=>{
    try{
      await checkMemberAlreadyAttended($("memberPengajuanTanggal").value,true);
    }catch(err){
      console.error("checkMemberAlreadyAttended:",err);
      message("memberPengajuanMessage","Gagal mengecek status absensi. Silakan coba lagi.","error");
    }
  });
  $("memberPengajuanForm").addEventListener("submit",submitMemberPengajuan);

  memberPengajuanPageReady = true;
}

function closeMemberPengajuanPage(){
  if(!goBack()) showPage("anggotaHomePage",{pushHistory:false});
}

function openPengajuanPage(){
  ensureMemberPengajuanPage();

  if(!currentAnggota?.id){
    toast("Data anggota belum tersedia.","error");
    return;
  }

  $("memberPengajuanForm").reset();
  $("memberPengajuanTanggal").innerHTML='<option value="">Memuat jadwal...</option>';
  $("memberPengajuanPreview").classList.add("hidden");
  $("memberPengajuanPreviewImg").removeAttribute("src");
  $("memberPengajuanFileInfo").textContent="";
  message("memberPengajuanMessage","");
  setMemberPengajuanAvailability(false);
  showPage("memberPengajuanPage");
  (async()=>{
    try {
      await checkMemberAlreadyAttended(getToday(),true);
      const dates=(await getMeetingDates(false)).filter(d=>d.tanggal>=getToday()), input=$("memberPengajuanTanggal");
      if(!dates.length){
        input.innerHTML='<option value="">Belum ada jadwal pertemuan</option>';
        setMemberPengajuanAvailability(true,"Tidak dapat melakukan pengajuan izin/sakit karena tidak ada jadwal pertemuan di hari yang akan datang.");
      }else{
        dates.sort((a,b)=>a.tanggal.localeCompare(b.tanggal));
        input.innerHTML=dates.map(d=>`<option value="${d.tanggal}">${escapeHTML(formatTanggal(d.tanggal))}</option>`).join("");
        input.value=dates.some(d=>d.tanggal===getToday())?getToday():dates[0].tanggal;
        if(input.value!==getToday()) await checkMemberAlreadyAttended(input.value,true);
      }
    } catch(err) {
      console.error("Pengajuan availability:",err);
      setMemberPengajuanAvailability(true,"Gagal memeriksa jadwal pertemuan. Silakan coba lagi.");
    }
  })();
}

function setMemberPengajuanAvailability(blocked, messageText=""){
  const statusBox=$("memberPengajuanStatus");
  const form=$("memberPengajuanForm");
  const dateInput=$("memberPengajuanTanggal");
  const submitButton=$("kirimMemberPengajuanButton");

  if(statusBox){
    statusBox.textContent=messageText;
    statusBox.classList.toggle("hidden",!blocked);
  }

  if(form){
    form.querySelectorAll("select, textarea, input[type=file]").forEach(el=>{
      el.disabled=blocked;
    });
  }

  if(submitButton) submitButton.disabled=blocked;
  if(dateInput) dateInput.disabled=false;

  if(!blocked) message("memberPengajuanMessage","");
}

async function checkMemberAlreadyAttended(tanggal,showError=true){
  if(!currentAnggota?.id||!tanggal) return false;

  const submitButton=$("kirimMemberPengajuanButton");
  if(submitButton) submitButton.disabled=true;

  let result;
  try{
    result=await Promise.all([
      supabaseClient
        .from("Absensi")
        .select("id,status")
        .eq("anggota_id",currentAnggota.id)
        .eq("tanggal",tanggal)
        .limit(1),
      supabaseClient
        .from("Pengajuan")
        .select("id,jenis,status,diajukan_pada")
        .eq("anggota_id",currentAnggota.id)
        .eq("tanggal",tanggal)
        .order("diajukan_pada",{ascending:false})
        .limit(1)
    ]);
  }catch(err){
    setMemberPengajuanAvailability(false);
    throw err;
  }

  const [{data:attendanceRows,error:attendanceError},{data:requestRows,error:requestError}]=result;

  if(attendanceError){
    setMemberPengajuanAvailability(false);
    throw attendanceError;
  }
  if(requestError){
    setMemberPengajuanAvailability(false);
    throw requestError;
  }

  const attendance=Array.isArray(attendanceRows)&&attendanceRows.length?attendanceRows[0]:null;
  const request=Array.isArray(requestRows)&&requestRows.length?requestRows[0]:null;

  if(attendance){
    const statusLabel={
      hadir:"HADIR",
      izin:"IZIN",
      sakit:"SAKIT",
      alpa:"ALPA",
      "tanpa keterangan":"ALPA"
    }[String(attendance.status||"").toLowerCase()]||String(attendance.status||"TERCATAT").toUpperCase();

    const text=`Kamu sudah absen hari ini dengan status ${statusLabel}. Kamu tidak bisa mengajukan izin/sakit lagi pada tanggal yang sama.`;
    if(showError) setMemberPengajuanAvailability(true,text);
    return true;
  }

  if(request){
    const statusText={
      menunggu:"masih menunggu persetujuan",
      diterima:"sudah diterima",
      ditolak:"sudah ditolak"
    }[String(request.status||"").toLowerCase()]||"sudah tercatat";

    const text=`Kamu sudah mengirimkan pengajuan hari ini dan ${statusText}. Kamu tidak bisa mengirim pengajuan lagi pada tanggal yang sama.`;
    if(showError) setMemberPengajuanAvailability(true,text);
    return true;
  }

  if(showError) setMemberPengajuanAvailability(false);
  return false;
}

function previewMemberPengajuanBukti(){
  const file=$("memberPengajuanBukti").files?.[0];
  if(!file){
    $("memberPengajuanPreview").classList.add("hidden");
    return;
  }

  if(!file.type.startsWith("image/")){
    message("memberPengajuanMessage","File bukti harus berupa gambar.","error");
    $("memberPengajuanBukti").value="";
    $("memberPengajuanPreview").classList.add("hidden");
    return;
  }

  const oldUrl=$("memberPengajuanPreviewImg").dataset.objectUrl;
  if(oldUrl) URL.revokeObjectURL(oldUrl);
  const url=URL.createObjectURL(file);
  $("memberPengajuanPreviewImg").dataset.objectUrl=url;
  $("memberPengajuanPreviewImg").src=url;
  $("memberPengajuanPreview").classList.remove("hidden");
  $("memberPengajuanFileInfo").textContent=`${file.name} · ${formatFileSize(file.size)}`;
}

function formatFileSize(bytes){
  if(!Number.isFinite(bytes)) return "-";
  if(bytes<1024) return `${bytes} B`;
  if(bytes<1024*1024) return `${(bytes/1024).toFixed(1)} KB`;
  return `${(bytes/(1024*1024)).toFixed(2)} MB`;
}

async function compressImageTo200KB(file){
  const MAX_BYTES=200*1024;
  if(file.size<=MAX_BYTES && file.type==="image/jpeg") return file;

  const image=await loadImageFromFile(file);
  let width=image.naturalWidth||image.width;
  let height=image.naturalHeight||image.height;
  const MAX_DIMENSION=1600;

  if(width>MAX_DIMENSION||height>MAX_DIMENSION){
    const scale=Math.min(MAX_DIMENSION/width,MAX_DIMENSION/height);
    width=Math.max(1,Math.round(width*scale));
    height=Math.max(1,Math.round(height*scale));
  }

  let quality=0.82;

  for(let attempt=0;attempt<12;attempt++){
    const canvas=document.createElement("canvas");
    canvas.width=width;
    canvas.height=height;
    const ctx=canvas.getContext("2d",{alpha:false});
    ctx.fillStyle="#ffffff";
    ctx.fillRect(0,0,width,height);
    ctx.drawImage(image,0,0,width,height);

    const blob=await canvasToBlob(canvas,"image/jpeg",quality);
    if(!blob) throw new Error("Gagal memproses gambar.");

    if(blob.size<=MAX_BYTES){
      return new File([blob],`bukti-${Date.now()}.jpg`,{
        type:"image/jpeg",
        lastModified:Date.now()
      });
    }

    if(quality>0.45){
      quality-=0.08;
    }else{
      width=Math.max(600,Math.round(width*0.85));
      height=Math.max(600,Math.round(height*0.85));
      quality=0.68;
    }
  }

  throw new Error("Foto terlalu sulit dikompres hingga 200 KB. Silakan gunakan foto lain.");
}

function loadImageFromFile(file){
  return new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file);
    const img=new Image();
    img.onload=()=>{URL.revokeObjectURL(url);resolve(img)};
    img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("Foto tidak dapat dibaca."))};
    img.src=url;
  });
}

function canvasToBlob(canvas,type,quality){
  return new Promise(resolve=>canvas.toBlob(resolve,type,quality));
}

async function submitMemberPengajuan(e){
  e.preventDefault();

  if(!currentUser||!currentAnggota?.id){
    message("memberPengajuanMessage","Sesi anggota tidak aktif.","error");
    return;
  }

  const jenis=$("memberPengajuanJenis").value;
  const tanggal=$("memberPengajuanTanggal").value;
  const alasan=$("memberPengajuanAlasan").value.trim();
  const file=$("memberPengajuanBukti").files?.[0];

  if(!jenis){message("memberPengajuanMessage","Pilih jenis pengajuan.","error");return}
  if(!tanggal){message("memberPengajuanMessage","Tanggal wajib dipilih.","error");return}
  try{if(tanggal<getToday()||!(await hasMeetingOn(tanggal))){message("memberPengajuanMessage",tanggal===getToday()?"Tidak dapat melakukan pengajuan izin/sakit karena tidak ada jadwal pertemuan hari ini.":"Tidak dapat melakukan pengajuan izin/sakit karena tidak ada jadwal pertemuan di hari yang akan datang.","error");return}}catch(err){message("memberPengajuanMessage","Gagal memeriksa jadwal pertemuan.","error");return}

  // Cek ulang tepat sebelum upload agar tetap aman jika pengelola
  // baru saja mengisi absensi setelah halaman pengajuan dibuka.
  try{
    const alreadyAttended=await checkMemberAlreadyAttended(tanggal,true);
    if(alreadyAttended) return;
  }catch(err){
    console.error("checkMemberAlreadyAttended submit:",err);
    message("memberPengajuanMessage","Gagal mengecek status absensi. Pengajuan dibatalkan, silakan coba lagi.","error");
    return;
  }

  if(!alasan){message("memberPengajuanMessage","Alasan wajib diisi.","error");return}
  if(!file){message("memberPengajuanMessage","Foto bukti wajib diunggah.","error");return}

  const btn=$("kirimMemberPengajuanButton");
  setLoadingButton(btn,"Memproses foto...",true);
  let uploadedPath=null;

  try{
    const compressedFile=await compressImageTo200KB(file);
    if(compressedFile.size>200*1024) throw new Error("Foto hasil kompres masih lebih dari 200 KB.");

    setLoadingButton(btn,"Mengunggah bukti...",true);
    const filePath=`${currentAnggota.id}/${safeUUID()}.jpg`;
    uploadedPath=filePath;

    const {error:uploadError}=await supabaseClient.storage
      .from("bukti-pengajuan")
      .upload(filePath,compressedFile,{contentType:"image/jpeg",upsert:false});
    if(uploadError) throw uploadError;

    setLoadingButton(btn,"Menyimpan pengajuan...",true);
    const {error:insertError}=await supabaseClient.from("Pengajuan").insert({
      anggota_id:currentAnggota.id,
      tanggal,
      jenis,
      alasan,
      foto_bukti:filePath,
      status:"menunggu"
    });
    if(insertError) throw insertError;

    toast("Pengajuan berhasil dikirim dan menunggu persetujuan.","success");
    closeMemberPengajuanPage();
  }catch(err){
    console.error("submitMemberPengajuan error:",err);
    if(uploadedPath) await supabaseClient.storage.from("bukti-pengajuan").remove([uploadedPath]).catch(()=>{});
    message("memberPengajuanMessage",err.message||"Gagal mengirim pengajuan.","error");
  }finally{
    setLoadingButton(btn,"",false);
  }
}

/* ---------- PENGELOLA: PENGAJUAN IZIN / SAKIT ---------- */

async function loadPengajuanRequests(){
  const list=$("pengajuanList");
  if(!list) return;
  listSkeleton("pengajuanList",3);

  const {data,error}=await supabaseClient
    .from("Pengajuan")
    .select("id,anggota_id,tanggal,jenis,alasan,foto_bukti,status,diajukan_pada,Anggota(id,nama,kelas,no_hp,email)")
    .eq("status","menunggu")
    .order("diajukan_pada",{ascending:false});

  if(error){
    console.error("loadPengajuanRequests:",error);
    toast("Gagal memuat pengajuan anggota.","error");
    return;
  }

  const rows=data||[];
  list.innerHTML="";
  $("jumlahPengajuan").textContent=rows.length;
  $("pengajuanEmptyState").classList.toggle("hidden",rows.length>0);

  for(const r of rows){
    const a=r.Anggota||{};
    let photoUrl="";

    if(r.foto_bukti){
      const storage=supabaseClient.storage.from("bukti-pengajuan");

      // Untuk pengelola, ambil file sebagai Blob terlebih dahulu.
      // Ini lebih stabil untuk bucket private dibanding langsung memakai
      // URL pada <img>, terutama di WebView Android.
      try{
        const downloaded=await storage.download(r.foto_bukti);
        if(!downloaded.error&&downloaded.data){
          photoUrl=URL.createObjectURL(downloaded.data);
        }
      }catch(downloadError){
        console.warn("Gagal download bukti:",downloadError);
      }

      // Fallback: signed URL.
      if(!photoUrl){
        try{
          const signed=await storage.createSignedUrl(r.foto_bukti,3600);
          if(!signed.error) photoUrl=signed.data?.signedUrl||"";
        }catch(signedError){
          console.warn("Gagal membuat signed URL bukti:",signedError);
        }
      }
    }

    const card=document.createElement("article");
    card.className="request-card pengajuan-request-card";

    const jenisLabel=r.jenis==="sakit"?"Sakit":"Izin";
    const photoHtml=photoUrl
      ? `<div class="pengajuan-proof-preview"><button class="pengajuan-proof-thumb" type="button" data-proof-image-url="${escapeHTML(photoUrl)}" aria-label="Lihat foto bukti"><img class="pengajuan-proof-image" src="${escapeHTML(photoUrl)}" alt="Bukti ${escapeHTML(jenisLabel)}"></button><button class="secondary-button pengajuan-proof-open" type="button" data-proof-image-url="${escapeHTML(photoUrl)}">Perbesar Gambar</button></div>`
      : `<div class="pengajuan-proof-empty"><strong>Foto bukti tidak dapat dimuat.</strong><small>Periksa izin Storage untuk akun Pengelola.</small></div>`;

    card.innerHTML=`
      <div class="request-main">
        <div class="avatar">${escapeHTML(getInitials(a.nama))}</div>
        <div>
          <strong>${escapeHTML(a.nama||"-")}</strong>
          <span>${escapeHTML(a.kelas||"-")} · ${escapeHTML(jenisLabel)}</span>
          <small>${escapeHTML(formatTanggal(r.tanggal))} · ${escapeHTML(formatTanggalWaktu(r.diajukan_pada))}</small>
        </div>
      </div>

      <div class="pengajuan-request-proof">${photoHtml}</div>

      <div class="pengajuan-request-reason">
        <strong>Alasan</strong>
        <p>${escapeHTML(r.alasan||"-")}</p>
      </div>

      <div class="request-actions">
        <button class="secondary-button danger" type="button" data-pengajuan-action="reject" data-id="${escapeHTML(r.id)}">Tolak</button>
        <button class="primary-button" type="button" data-pengajuan-action="approve" data-id="${escapeHTML(r.id)}">Terima</button>
      </div>
    `;

    list.appendChild(card);
  }
}

async function processPengajuanRequest(id,action,button){
  if(!currentUser||!currentPetugas){
    toast("Sesi pengelola tidak aktif.","error");
    return;
  }

  let alasanPenolakan=null;

  if(action==="reject"){
    alasanPenolakan=prompt("Masukkan alasan penolakan:");
    if(alasanPenolakan===null) return;
    alasanPenolakan=alasanPenolakan.trim();
    if(!alasanPenolakan){
      toast("Alasan penolakan wajib diisi.","warning");
      return;
    }
  }else{
    if(!confirm("Terima pengajuan ini? Absensi akan otomatis masuk ke rekap.")) return;
  }

  button.disabled=true;

  try{
    const {data:request,error:requestError}=await supabaseClient
      .from("Pengajuan")
      .select("id,anggota_id,tanggal,jenis,status")
      .eq("id",id)
      .maybeSingle();

    if(requestError) throw requestError;
    if(!request) throw new Error("Pengajuan tidak ditemukan.");
    if(request.status!=="menunggu") throw new Error("Pengajuan ini sudah diproses.");

    if(action==="approve"){
      const {data:existing,error:existingError}=await supabaseClient
        .from("Absensi")
        .select("id,status")
        .eq("anggota_id",request.anggota_id)
        .eq("tanggal",request.tanggal)
        .maybeSingle();

      if(existingError) throw existingError;

      if(existing?.status==="hadir"){
        throw new Error("Anggota sudah tercatat Hadir pada tanggal tersebut.");
      }

      if(existing){
        const {error:updateAttendanceError}=await supabaseClient
          .from("Absensi")
          .update({
            status:request.jenis,
            metode:"Pengajuan",
            petugas_id:currentPetugas.id,
            jam:getCurrentTime()
          })
          .eq("id",existing.id);

        if(updateAttendanceError) throw updateAttendanceError;
      }else{
        const {error:insertAttendanceError}=await supabaseClient
          .from("Absensi")
          .insert({
            anggota_id:request.anggota_id,
            tanggal:request.tanggal,
            jam:getCurrentTime(),
            status:request.jenis,
            metode:"Pengajuan",
            petugas_id:currentPetugas.id
          });

        if(insertAttendanceError) throw insertAttendanceError;
      }
    }

    const payload={
      status:action==="approve"?"diterima":"ditolak",
      alasan_penolakan:action==="approve"?null:alasanPenolakan,
      diproses_pada:new Date().toISOString(),
      diproses_oleh:currentPetugas.id
    };

    const {error:updateError}=await supabaseClient
      .from("Pengajuan")
      .update(payload)
      .eq("id",id)
      .eq("status","menunggu");

    if(updateError) throw updateError;

    toast(action==="approve"?"Pengajuan diterima dan masuk rekap.":"Pengajuan ditolak.","success");
    await loadPengajuanRequests();
    await loadDashboard();
    if(currentPage==="rekapPage") await loadRekap();
  }catch(err){
    console.error("processPengajuanRequest:",err);
    toast(err.message||"Gagal memproses pengajuan.","error");
  }finally{
    button.disabled=false;
  }
}

function ensureManagerPengajuanPage(){
  if($("pengajuanPage")) return;

  const page=document.createElement("section");
  page.id="pengajuanPage";
  page.className="page";
  page.innerHTML=`
    <div class="page-shell pengajuan-shell">
      <div class="section-heading-row pengajuan-heading">
        <button id="backFromPengajuan" class="back-button compact" type="button">←</button>
        <div class="section-heading">
          <span class="eyebrow">PENGELOLA</span>
          <h1>Pengajuan Izin / Sakit</h1>
          <p>Periksa dan proses pengajuan absensi anggota.</p>
        </div>
      </div>

      <div class="pengajuan-manager-head">
        <div>
          <span class="eyebrow">PENGAJUAN MASUK</span>
          <h2>Menunggu Diproses</h2>
        </div>
        <span id="jumlahPengajuan" class="count-badge">0</span>
      </div>

      <div id="pengajuanList" class="request-list"></div>
      <div id="pengajuanEmptyState" class="empty-state">Belum ada pengajuan yang menunggu diproses.</div>
    </div>
  `;

  const toastElement=$("toast");
  if(toastElement) toastElement.parentNode.insertBefore(page,toastElement);
  else $("app").appendChild(page);

  $("backFromPengajuan").addEventListener("click",async()=>{
    if(!goBack()) showPage("manualAbsensiPage",{pushHistory:false});
  });
}

function ensureManualPengajuanButton(){
  const page=$("manualAbsensiPage");
  if(!page) return;

  ensureManagerPengajuanPage();

  if($("manualPengajuanButton")) return;

  const button=document.createElement("button");
  button.id="manualPengajuanButton";
  button.type="button";
  button.className="secondary-button full manual-pengajuan-button";
  button.textContent="Pengajuan Izin / Sakit";
  button.addEventListener("click",async()=>{
    showPage("pengajuanPage");
    await loadPengajuanRequests();
  });

  const heading=page.querySelector(".section-heading-row");
  const target=heading?.parentElement||page.firstElementChild||page;
  const search=$("manualAbsensiSearch");
  if(search && search.parentElement===target){
    target.insertBefore(button,search);
  }else{
    target.insertBefore(button,target.children[1]||null);
  }
}

if($("pengajuanList")){
  $("pengajuanList").addEventListener("click",async e=>{
    const button=e.target.closest("[data-pengajuan-action]");
    if(!button) return;
    await processPengajuanRequest(button.dataset.id,button.dataset.pengajuanAction,button);
  });
}


/* ---------- PASSWORD REQUESTS ---------- */
async function loadPasswordRequests(){
  const list=$("pengajuanPasswordList");if(!list)return;listSkeleton("pengajuanPasswordList",3);
  const {data,error}=await supabaseClient.from("PengajuanPassword").select("id,anggota_id,alasan,status,diajukan_pada,catatan,Anggota(nama,kelas,no_hp,email)").eq("status","menunggu").order("diajukan_pada",{ascending:false});
  if(error){console.error(error);toast("Gagal memuat pengajuan password.","error");return}
  const rows=data||[];list.innerHTML="";$("jumlahPengajuanPassword").textContent=rows.length;$("pengajuanPasswordEmpty").classList.toggle("hidden",rows.length>0);
  rows.forEach(r=>{
    const a=r.Anggota||{};
    const kontak=[a.email,a.no_hp].filter(Boolean).join(" · ")||"Kontak tidak tersedia";
    const card=document.createElement("article");
    card.className="pw-card";
    card.innerHTML=`
      <div class="pw-card-top">
        <div class="avatar">${escapeHTML(getInitials(a.nama))}</div>
        <div class="pw-card-who"><strong>${escapeHTML(a.nama||"-")}</strong><span>${escapeHTML(a.kelas||"-")}</span></div>
      </div>
      <dl class="pw-card-info">
        <div><dt>Kontak</dt><dd>${escapeHTML(kontak)}</dd></div>
        <div><dt>Diajukan</dt><dd>${escapeHTML(formatTanggalWaktu(r.diajukan_pada))}</dd></div>
      </dl>
      <div class="pw-card-reason"><span>Alasan</span><p>${escapeHTML(r.alasan||"-")}</p></div>
      <div class="pw-card-actions">
        <button class="secondary-button" type="button" data-request="reject" data-id="${escapeHTML(r.id)}">Tolak</button>
        <button class="primary-button" type="button" data-request="approve" data-id="${escapeHTML(r.id)}">Terima &amp; Reset</button>
      </div>`;
    list.appendChild(card);
  });
}
$("pengajuanPasswordButton").addEventListener("click",async()=>{showPage("pengajuanPasswordPage");await loadPasswordRequests()});
$("backFromPengajuanPassword").addEventListener("click",async()=>{if(!goBack())showPage("dashboardPage",{pushHistory:false});});
$("pengajuanPasswordList").addEventListener("click",async e=>{const b=e.target.closest("[data-request]");if(!b)return;const id=b.dataset.id;const aksi=b.dataset.request;let catatan="";if(aksi==="reject"){catatan=prompt("Catatan penolakan (opsional):")??"";}else if(!confirm("Terima pengajuan dan buat password baru?"))return;
  b.disabled=true;try{const {data,error}=await supabaseClient.functions.invoke("approve-password-reset",{body:{pengajuan_id:id,aksi:aksi==="approve"?"terima":"tolak",catatan}});if(error)throw error;if(!data?.success)throw new Error(data?.error||"Gagal memproses pengajuan.");if(aksi==="approve"&&data.password_baru){$("generatedPasswordText").textContent=data.password_baru;openModal("generatedPasswordModal");}else toast("Pengajuan ditolak.","success");await loadPasswordRequests();}catch(err){toast(err.message||"Gagal memproses pengajuan.","error")}finally{b.disabled=false;}});

function updateFirstPasswordNotice(){
  const notice=$("firstPasswordNotice");
  if(!notice) return;
  const needsChange=!!currentAnggota && currentAnggota.password_awal_sudah_diubah===false;
  notice.classList.toggle("hidden",!needsChange);
}

$("firstPasswordChangeButton")?.addEventListener("click",()=>{
  $("changePasswordForm").reset();
  message("changePasswordMessage","");
  openModal("changePasswordModal");
});

/* ---------- SCANNER ---------- */
async function startScanner(){
  stopScanner();
  if(!window.Html5Qrcode){message("scannerMessage","Library scanner belum siap.","error");return}
  qrScanner=new Html5Qrcode("qr-reader");
  try{
    await qrScanner.start({facingMode:"environment"},{fps:10,qrbox:{width:220,height:220}},
      async decodedText=>{await handleQRScan(decodedText)},
      ()=>{});
  }catch(e){
    console.error(e);
    // Lepaskan instance kamera yang gagal agar halaman tetap bisa dinavigasi.
    try{if(qrScanner){await qrScanner.stop().catch(()=>{});qrScanner.clear();}}catch(_){}
    qrScanner=null;
    message("scannerMessage","Kamera tidak dapat dibuka. Pastikan izin kamera diberikan lalu coba lagi, atau tekan tombol kembali.","error");
  }
}
async function handleQRScan(value){
  if(!value)return;
  let id=value.trim();
  try{const parsed=JSON.parse(value);id=parsed.id||parsed.anggota_id||value}catch(_){}
  const {data,error}=await supabaseClient.from("Anggota").select("*").or(`id.eq.${id},qr_code.eq.${id}`).maybeSingle();
  if(error||!data){message("scannerMessage","QR tidak terdaftar.","error");return}
  await recordAttendance(data,"hadir","QR");
}
async function recordAttendance(member,status,metode){
  if(!currentUser||!currentPetugas){toast("Sesi pengelola tidak aktif.","error");return false}
  const today=getToday();
  try{if(!(await hasMeetingOn(today))){toast("Tidak dapat melakukan absensi, karena belum waktunya untuk melakukan absensi.","warning");return false}}catch(e){toast("Gagal memeriksa jadwal pertemuan.","error");return false}
  const lockKey=`${member.id}:${today}`;
  if(attendanceLocks.has(lockKey)){toast(`${member.nama} sedang diproses.` ,"warning");return false}
  attendanceLocks.set(lockKey,true);
  try{
    const {data:existing,error:findError}=await supabaseClient.from("Absensi").select("id").eq("anggota_id",member.id).eq("tanggal",today).maybeSingle();
    if(findError) throw findError;
    if(existing){toast(`${member.nama} sudah memiliki absensi hari ini.` ,"warning");message("scannerMessage",`${member.nama} sudah absen hari ini.` ,"warning");return false}
    const {error}=await supabaseClient.from("Absensi").insert({anggota_id:member.id,tanggal:today,jam:getCurrentTime(),status,metode,petugas_id:currentPetugas.id});
    if(error){
      const duplicate=error.code==="23505"||/duplicate|unique/i.test(error.message||"");
      if(duplicate){toast(`${member.nama} sudah memiliki absensi hari ini.` ,"warning");message("scannerMessage",`${member.nama} sudah absen hari ini.` ,"warning");return false}
      throw error;
    }
    toast(`${member.nama}: ${statusLabel(status)}.` ,"success");
    message("scannerMessage",`Absensi ${statusLabel(status)} berhasil disimpan.` ,"success");
    await loadDashboard();
    return true;
  }catch(err){console.error(err);toast(err.message||"Gagal menyimpan absensi.","error");return false}
  finally{setTimeout(()=>attendanceLocks.delete(lockKey),1200)}
}
function stopScanner(){
  const scanner=qrScanner;
  qrScanner=null;
  if(scanner){
    Promise.resolve().then(()=>scanner.stop()).catch(()=>{}).finally(()=>{try{scanner.clear()}catch(_){}});
  }
}
async function loadScannerMembers(search=""){
  const list=$("manualAnggotaList");list.innerHTML="";
  let q=supabaseClient.from("Anggota").select("*").order("nama");
  if(search.trim())q=q.or(`nama.ilike.%${search.trim()}%,kelas.ilike.%${search.trim()}%`);
  const {data,error}=await q;if(error){toast("Gagal memuat anggota.","error");return}
  (data||[]).forEach(m=>{
    const b=document.createElement("button");b.type="button";b.className="compact-member";
    b.innerHTML=`<span class="avatar">${escapeHTML(getInitials(m.nama))}</span><span class="compact-member-info"><strong>${escapeHTML(m.nama)}</strong><span>${escapeHTML(m.kelas)}</span></span><b>›</b>`;
    b.addEventListener("click",()=>recordAttendance(m,"hadir","Manual"));
    list.appendChild(b);
  });
}
$("manualSearch").addEventListener("input",e=>loadScannerMembers(e.target.value));
$("backFromScanner").addEventListener("click",async()=>{
  stopScanner();
  // Navigasi langsung: tidak bergantung pada popstate/history yang bisa macet
  // ketika kamera gagal dibuka atau permission ditolak.
  const previous=navigationStack.pop();
  const target=previous&&$(previous)?previous:(currentMode==="anggota"?"anggotaHomePage":"dashboardPage");
  showPage(target,{pushHistory:false});
  try{if(currentPage==="dashboardPage"&&currentMode==="pengelola")await loadDashboard();}catch(e){console.error(e)}
});

/* ---------- MANUAL ATTENDANCE ---------- */
function resetManual(){
  selectedManualMember=null;
  $("selectedManualAnggota").classList.add("hidden");
  $("manualAbsensiForm").classList.add("hidden");
  $("manualAbsensiSearch").value="";
  document.querySelectorAll('input[name="manualStatus"]').forEach(r=>r.checked=r.value==="hadir");
  message("manualAbsensiMessage","");
}
async function loadManualMembers(search=""){
  const list=$("manualAbsensiAnggotaList");list.innerHTML="";
  let q=supabaseClient.from("Anggota").select("*").order("nama");
  if(search.trim())q=q.or(`nama.ilike.%${search.trim()}%,kelas.ilike.%${search.trim()}%`);
  const {data,error}=await q;if(error){toast("Gagal memuat anggota.","error");return}
  (data||[]).forEach(m=>{
    const b=document.createElement("button");b.type="button";b.className="compact-member";
    b.innerHTML=`<span class="avatar">${escapeHTML(getInitials(m.nama))}</span><span class="compact-member-info"><strong>${escapeHTML(m.nama)}</strong><span>${escapeHTML(m.kelas)}</span></span><b>›</b>`;
    b.addEventListener("click",()=>selectManualMember(m));
    list.appendChild(b);
  });
}
function selectManualMember(m){
  selectedManualMember=m;
  $("selectedManualAvatar").textContent=getInitials(m.nama);
  $("selectedManualNama").textContent=m.nama;
  $("selectedManualKelas").textContent=m.kelas;
  $("selectedManualAnggota").classList.remove("hidden");
  $("manualAbsensiForm").classList.remove("hidden");
  $("manualAbsensiAnggotaList").innerHTML="";
  $("manualAbsensiSearch").value="";
}
$("manualAbsensiSearch").addEventListener("input",e=>{
  if(selectedManualMember)return;
  loadManualMembers(e.target.value);
});
$("clearSelectedManual").addEventListener("click",async()=>{
  resetManual();
  $("manualAbsensiSearch").value="";
  await loadManualMembers("");
});
$("manualAbsensiForm").addEventListener("submit",async e=>{
  e.preventDefault();
  if(!selectedManualMember){toast("Pilih anggota terlebih dahulu.","warning");return}
  const status=document.querySelector('input[name="manualStatus"]:checked')?.value||"hadir";
  const btn=$("simpanManualAbsensi");setLoadingButton(btn,"Menyimpan...",true);
  try{
    const ok=await recordAttendance(selectedManualMember,status,"Manual");
    if(ok){
      message("manualAbsensiMessage",`Absensi ${statusLabel(status)} berhasil disimpan.`,"success");
      resetManual();await loadManualMembers();
    }
  }finally{setLoadingButton(btn,"",false)}
});
$("backFromManualAbsensi").addEventListener("click",async()=>{resetManual();if(!goBack())showPage("dashboardPage",{pushHistory:false});if(currentPage==="dashboardPage")await loadDashboard()});

/* ---------- REKAP ---------- */
async function loadRekap(){
  const tanggal=$("rekapTanggal").value||getToday();
  const list=$("rekapList");
  if(!list)return;
  list.innerHTML=recapSkeleton(6);

  try{
    const [{data:anggotaRows,error:anggotaError},{data:absensiRows,error:absensiError},{data:pengajuanRows,error:pengajuanError}]=await Promise.all([
      supabaseClient.from("Anggota").select("id,nama,kelas,status").order("nama",{ascending:true}),
      supabaseClient.from("Absensi").select("id,anggota_id,tanggal,jam,status,metode,petugas_id").eq("tanggal",tanggal),
      supabaseClient.from("Pengajuan").select("id,anggota_id,tanggal,jenis,alasan,foto_bukti,status,alasan_penolakan,diajukan_pada,diproses_pada").eq("tanggal",tanggal).order("diajukan_pada",{ascending:false})
    ]);

    if(anggotaError)throw anggotaError;
    if(absensiError)throw absensiError;
    if(pengajuanError)throw pengajuanError;

    const anggota=anggotaRows||[];
    const absensiMap=new Map((absensiRows||[]).map(r=>[r.anggota_id,r]));
    const pengajuanMap=new Map();
    for(const r of (pengajuanRows||[])){
      if(!pengajuanMap.has(r.anggota_id))pengajuanMap.set(r.anggota_id,r);
    }

    const rows=anggota.map(a=>{
      const attendance=absensiMap.get(a.id)||null;
      const request=pengajuanMap.get(a.id)||null;
      let status="tanpa keterangan";
      let detailType="alpa";

      if(attendance){
        status=String(attendance.status||"tanpa keterangan").toLowerCase();
        if(status==="izin"||status==="sakit")detailType=status;
        else if(status==="hadir")detailType="hadir";
        else detailType="alpa";
      }else if(request&&request.status==="ditolak"){
        status=request.jenis==="izin"?"izin (alpa)":"sakit (alpa)";
        detailType="rejected";
      }else{
        status="tanpa keterangan";
        detailType="alpa";
      }

      return {anggota:a,attendance,request,status,detailType};
    });

    const total=rows.length;
    const hadir=rows.filter(r=>r.status==="hadir").length;
    const sakit=rows.filter(r=>r.status==="sakit").length;
    const izin=rows.filter(r=>r.status==="izin").length;
    const alpa=rows.filter(r=>r.status==="tanpa keterangan"||r.status==="izin (alpa)"||r.status==="sakit (alpa)").length;

    $("rekapTotal").textContent=total;
    $("rekapHadir").textContent=hadir;
    $("rekapSakit").textContent=sakit;
    $("rekapIzin").textContent=izin;
    $("rekapTanpaKeterangan").textContent=alpa;
    $("rekapEmptyState").classList.toggle("hidden",total>0);

    list.innerHTML="";

    for(const row of rows){
      const m=row.anggota;
      const expandable=row.detailType!=="hadir";
      const item=document.createElement("article");
      item.className=`recap-row ${expandable?"is-expandable":""}`;

      const labelMap={
        hadir:"HADIR",
        izin:"IZIN",
        sakit:"SAKIT",
        "izin (alpa)":"IZIN (ALPA)",
        "sakit (alpa)":"SAKIT (ALPA)",
        "tanpa keterangan":"ALPA"
      };
      const label=labelMap[row.status]||String(row.status||"ALPA").toUpperCase();
      const statusCls=row.status.includes("izin")?"status-izin":row.status.includes("sakit")?"status-sakit":row.status==="hadir"?"status-hadir":"status-tanpa";
      const arrow=expandable?`<span class="recap-chevron" aria-hidden="true">⌄</span>`:"";

      item.innerHTML=`
        <button class="recap-row-main" type="button" ${expandable?"":"disabled"} aria-expanded="false">
          <span class="avatar">${escapeHTML(getInitials(m?.nama||"?"))}</span>
          <span class="recap-person">
            <strong>${escapeHTML(m?.nama||"Anggota sudah dihapus")}</strong>
            <small>${escapeHTML(m?.kelas||"-")}</small>
          </span>
          <span class="recap-status ${statusCls}">${escapeHTML(label)}</span>
          ${arrow}
        </button>
        <div class="recap-detail" hidden></div>
      `;

      if(expandable){
        const main=item.querySelector(".recap-row-main");
        main.addEventListener("click",async()=>{
          const detail=item.querySelector(".recap-detail");
          const opening=detail.hidden;
          detail.hidden=!opening;
          main.setAttribute("aria-expanded",String(opening));
          item.classList.toggle("open",opening);
          if(opening&&detail.dataset.loaded!=="1"){
            detail.innerHTML=detailSkeleton();
            await renderRekapDetail(detail,row);
            detail.dataset.loaded="1";
          }
        });
      }

      list.appendChild(item);
    }
  }catch(error){
    console.error("loadRekap:",error);
    list.innerHTML=`<div class="recap-error">Gagal memuat rekap.<br><small>${escapeHTML(error.message||"Terjadi kesalahan.")}</small></div>`;
    toast("Gagal memuat rekap.","error");
  }
}

async function renderRekapDetail(container,row){
  const request=row.request;
  const attendance=row.attendance;

  if(row.detailType==="alpa"){
    container.innerHTML=`<div class="recap-detail-grid"><div><span>Keterangan</span><strong>Tanpa keterangan.</strong></div></div>`;
    return;
  }

  let photoUrl="";
  if(request?.foto_bukti){
    photoUrl=await getPengajuanProofUrl(request.foto_bukti);
  }

  const jenisLabel=request?.jenis==="sakit"?"Sakit":"Izin";
  const photoHtml=photoUrl
    ? `<div class="recap-detail-wide"><span>Bukti</span><div class="recap-proof"><img src="${escapeHTML(photoUrl)}" alt="Bukti pengajuan"><button type="button" class="secondary-button recap-image-button" data-image-url="${escapeHTML(photoUrl)}">Perbesar Gambar</button></div></div>`
    : `<div class="recap-detail-wide"><span>Bukti</span><strong>Tidak tersedia.</strong></div>`;

  if(row.detailType==="rejected"){
    container.innerHTML=`
      <div class="recap-detail-grid">
        <div><span>Jenis Pengajuan</span><strong>${escapeHTML(jenisLabel)}</strong></div>
        <div><span>Status</span><strong>Ditolak → Alpa</strong></div>
        <div class="recap-detail-wide"><span>Alasan Pengajuan</span><strong>${escapeHTML(request?.alasan||"-")}</strong></div>
        <div class="recap-detail-wide"><span>Alasan Penolakan</span><strong>${escapeHTML(request?.alasan_penolakan||"-")}</strong></div>
        ${photoHtml}
      </div>`;
    bindRecapImageButton(container);
    return;
  }

  if(row.detailType==="izin"||row.detailType==="sakit"){
    container.innerHTML=`
      <div class="recap-detail-grid">
        <div><span>Status</span><strong>${escapeHTML(row.status==="izin"?"Izin diterima":"Sakit diterima")}</strong></div>
        <div><span>Waktu</span><strong>${escapeHTML((attendance?.jam&&attendance.metode!=="Pengajuan")?String(attendance.jam).slice(0,5):"-")}</strong></div>
        <div class="recap-detail-wide"><span>Alasan</span><strong>${escapeHTML(request?.alasan||"Tidak ada keterangan tambahan.")}</strong></div>
        ${photoUrl?photoHtml:""}
      </div>`;
    bindRecapImageButton(container);
  }
}


async function getPengajuanProofUrl(path){
  if(!path) return "";
  const storage=supabaseClient.storage.from("bukti-pengajuan");

  try{
    const downloaded=await storage.download(path);
    if(!downloaded.error&&downloaded.data){
      return URL.createObjectURL(downloaded.data);
    }
  }catch(error){
    console.warn("Gagal download bukti pengajuan:",error);
  }

  try{
    const signed=await storage.createSignedUrl(path,3600);
    if(!signed.error&&signed.data?.signedUrl) return signed.data.signedUrl;
  }catch(error){
    console.warn("Gagal membuat signed URL bukti pengajuan:",error);
  }

  return "";
}

function ensureProofImageViewer(){
  let viewer=$("proofImageViewer");
  if(viewer) return viewer;

  viewer=document.createElement("div");
  viewer.id="proofImageViewer";
  viewer.className="proof-image-viewer hidden";
  viewer.innerHTML=`
    <div class="proof-image-viewer-backdrop" data-proof-close="1"></div>
    <div class="proof-image-viewer-card" role="dialog" aria-modal="true" aria-label="Bukti foto">
      <button type="button" class="proof-image-viewer-close" data-proof-close="1" aria-label="Tutup">×</button>
      <div class="proof-image-stage" id="proofImageStage">
        <img id="proofImageViewerImg" src="" alt="Bukti foto">
      </div>
      <div class="proof-image-controls" aria-label="Kontrol pembesaran gambar">
        <button type="button" data-proof-zoom="-1" aria-label="Perkecil gambar">−</button>
        <button type="button" data-proof-zoom="reset">Pas ukuran layar</button>
        <button type="button" data-proof-zoom="1" aria-label="Perbesar gambar">+</button>
      </div>
      <small class="proof-image-hint">Gunakan tombol +/− atau cubit gambar untuk zoom.</small>
    </div>
  `;
  document.body.appendChild(viewer);
  viewer.addEventListener("click",e=>{
    if(e.target.closest("[data-proof-close]")) closeProofImageViewer();
    const zoomButton=e.target.closest("[data-proof-zoom]");
    if(zoomButton){
      const action=zoomButton.dataset.proofZoom;
      if(action==="reset") setProofImageScale(1);
      else setProofImageScale(proofImageScale + (Number(action)>0 ? 0.25 : -0.25));
    }
  });
  const stage=viewer.querySelector("#proofImageStage");
  stage.addEventListener("wheel",e=>{
    e.preventDefault();
    setProofImageScale(proofImageScale + (e.deltaY<0 ? 0.15 : -0.15));
  },{passive:false});
  let pinchStartDistance=0, pinchStartScale=1;
  stage.addEventListener("touchstart",e=>{
    if(e.touches.length===2){
      pinchStartDistance=proofTouchDistance(e.touches);
      pinchStartScale=proofImageScale;
    }
  },{passive:true});
  stage.addEventListener("touchmove",e=>{
    if(e.touches.length===2){
      e.preventDefault();
      const distance=proofTouchDistance(e.touches);
      if(pinchStartDistance>0) setProofImageScale(pinchStartScale*(distance/pinchStartDistance));
    }
  },{passive:false});
  return viewer;
}

let proofImageScale=1;
function proofTouchDistance(touches){
  const dx=touches[0].clientX-touches[1].clientX;
  const dy=touches[0].clientY-touches[1].clientY;
  return Math.hypot(dx,dy);
}
function setProofImageScale(scale){
  proofImageScale=Math.max(0.5,Math.min(4,Number(scale)||1));
  const img=$("proofImageViewerImg");
  if(img) img.style.transform=`scale(${proofImageScale})`;
}

function openProofImage(url){
  if(!url) return;
  const viewer=ensureProofImageViewer();
  const img=$("proofImageViewerImg");
  if(!img) return;
  proofImageScale=1;
  img.style.transform="scale(1)";
  img.src=url;
  viewer.classList.remove("hidden");
  document.body.classList.add("proof-viewer-open");
}

function closeProofImageViewer(){
  const viewer=$("proofImageViewer");
  const img=$("proofImageViewerImg");
  if(!viewer) return;
  viewer.classList.add("hidden");
  document.body.classList.remove("proof-viewer-open");
  if(img){img.removeAttribute("src");img.style.transform="scale(1)";}
}

function bindRecapImageButton(container){
  container.querySelector(".recap-image-button")?.addEventListener("click",e=>{
    const url=e.currentTarget.dataset.imageUrl;
    if(url)openProofImage(url);
  });
}

document.addEventListener("click",e=>{
  const trigger=e.target.closest("[data-proof-image-url]");
  if(!trigger) return;
  e.preventDefault();
  openProofImage(trigger.dataset.proofImageUrl);
});

/* ---------- REKAP KESELURUHAN + DOWNLOAD EXCEL ---------- */
let rekapKeseluruhanData=null;
async function ambilRekapKeseluruhan(){
  const [{data:ms,error:me},{data:as,error:ae},{data:ps,error:pe}]=await Promise.all([
    supabaseClient.from("Anggota").select("id,nama,kelas").order("nama"),
    supabaseClient.from("Absensi").select("anggota_id,tanggal,status"),
    supabaseClient.from("Pengajuan").select("anggota_id,tanggal,jenis,status")
  ]);
  if(me)throw me;if(ae)throw ae;if(pe)throw pe;
  return Laporan.hitungRekap(ms,as,ps);
}
async function openRekapKeseluruhan(){
  const modal=$("rekapKeseluruhanModal"),el=$("rekapKeseluruhanContent"),dl=$("downloadRekapButton");
  modal.classList.remove("hidden");el.textContent="Memuat rekap...";rekapKeseluruhanData=null;
  if(dl){dl.classList.toggle("hidden",currentMode!=="pengelola");dl.disabled=true}
  try{
    const data=await ambilRekapKeseluruhan();
    rekapKeseluruhanData=data;
    el.innerHTML=`<div class="recap-overall-table"><div class="recap-overall-head"><span>Nama</span><span>Hadir</span><span>Izin</span><span>Sakit</span><span>Alpa</span></div>${data.rows.map(m=>`<div class="recap-overall-row"><span><strong>${escapeHTML(m.nama||"-")}</strong><small>${escapeHTML(m.kelas||"")}</small></span><b>${m.hadir}</b><b>${m.izin}</b><b>${m.sakit}</b><b>${m.alpa}</b></div>`).join("")}</div>`;
    if(dl)dl.disabled=false;
  }catch(e){el.textContent="Gagal memuat rekap: "+e.message}
}
$("downloadRekapButton").addEventListener("click",()=>{
  if(currentMode!=="pengelola"||!rekapKeseluruhanData)return;
  if(!rekapKeseluruhanData.rows.length){toast("Belum ada data anggota untuk diunduh.","warning");return}
  try{
    const bytes=Laporan.buatRekap(rekapKeseluruhanData);
    if(Laporan.simpan("Rekap_Absensi_"+Laporan.stamp()+".xlsx",bytes)==="browser")toast("File sedang diunduh.","success");
  }catch(e){console.error(e);toast("Gagal membuat file: "+e.message,"error")}
});
$("downloadAnggotaButton").addEventListener("click",async()=>{
  if(currentMode!=="pengelola")return;
  const btn=$("downloadAnggotaButton");btn.disabled=true;
  try{
    const {data,error}=await supabaseClient.from("Anggota").select("nama,kelas,email,no_hp").order("nama",{ascending:true});
    if(error)throw error;
    if(!data||!data.length){toast("Belum ada data anggota untuk diunduh.","warning");return}
    const bytes=Laporan.buatAnggota(data);
    if(Laporan.simpan("Data_Anggota_"+Laporan.stamp()+".xlsx",bytes)==="browser")toast("File sedang diunduh.","success");
  }catch(e){console.error(e);toast("Gagal mengunduh data: "+e.message,"error")}
  finally{btn.disabled=false}
});
$("rekapKeseluruhanButton").addEventListener("click",openRekapKeseluruhan);function closeRekapKeseluruhan(){$("rekapKeseluruhanModal").classList.add("hidden")}$("closeRekapKeseluruhan").addEventListener("click",closeRekapKeseluruhan);document.querySelectorAll("[data-close-rekap-keseluruhan]").forEach(x=>x.addEventListener("click",closeRekapKeseluruhan));
$("rekapTanggal").value=getToday();
async function setupRecapDateOptions(){const input=$("rekapTanggal");try{const [{data:a,error:ae},{data:p,error:pe}]=await Promise.all([supabaseClient.from("Absensi").select("tanggal"),supabaseClient.from("Pengajuan").select("tanggal")]);if(ae)throw ae;if(pe)throw pe;const ds=[...new Set([...(a||[]),...(p||[])].map(x=>x.tanggal).filter(Boolean))].sort().reverse();input.innerHTML="";ds.forEach(d=>{const o=document.createElement("option");o.value=d;o.textContent=formatTanggal(d);input.appendChild(o)});input.disabled=!ds.length;if(ds.length)input.value=ds[0]}catch(e){console.error(e)}}
$("rekapTanggal").addEventListener("change",()=>{currentMode==="anggota"?loadMemberRekap():loadRekap()});
$("resetRekapFilter").addEventListener("click",async()=>{await setupRecapDateOptions();currentMode==="anggota"?loadMemberRekap():loadRekap()});
$("backFromRekap").addEventListener("click",async()=>{
  if(!goBack())showPage(currentMode==="anggota"?"anggotaHomePage":"dashboardPage",{pushHistory:false});
  if(currentMode==="pengelola"&&currentPage==="dashboardPage")await loadDashboard();
});

/* ---------- PENGUMUMAN ---------- */
function formatTanggalWaktu(v){
  if(!v) return "-";
  const d=new Date(v);
  if(Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"})+" · "+d.toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"});
}
function formatRole(role){
  const map={ketua:"Ketua",sekretaris:"Sekretaris",bendahara:"Bendahara",pembina:"Pembina",petugas:"Petugas"};
  return map[String(role||"").toLowerCase()] || String(role||"Petugas").replace(/\b\w/g,c=>c.toUpperCase());
}
/* Format teks pengumuman: *tebal* dan tautan (http/https/www) yang bisa dipencet */
function formatPengumumanText(text){
  let t=escapeHTML(text);
  const links=[];
  t=t.replace(/(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi,m=>{
    let url=m,tail="";
    const trail=url.match(/(?:[.,;:!?)\]}]|&quot;|&#039;)+$/);
    if(trail){tail=trail[0];url=url.slice(0,url.length-tail.length)}
    if(!url)return m;
    const href=/^www\./i.test(url)?"https://"+url:url;
    links.push(`<a class="announcement-link" href="${href}" target="_blank" rel="noopener noreferrer">${url}</a>`);
    return "\u0000"+(links.length-1)+"\u0000"+tail;
  });
  t=t.replace(/\*([^\s*](?:[^*\n]*?[^\s*])?)\*/g,"<strong>$1</strong>");
  return t.replace(/\u0000(\d+)\u0000/g,(_,i)=>links[+i]);
}
async function loadPengumuman(){
  const list=$("pengumumanList");
  if(!list) return;
  const bolehBuat=currentMode==="pengelola";
  $("tambahPengumumanButton").classList.toggle("hidden",!bolehBuat);
  if(!bolehBuat)$("formPengumumanPanel").classList.add("hidden");
  listSkeleton("pengumumanList",3);
  const {data,error}=await supabaseClient.from("Pengumuman").select("id,judul,isi,petugas_id,petugas_nama,petugas_role,dibuat_pada").order("dibuat_pada",{ascending:false});
  if(error){console.error(error);toast("Gagal memuat pengumuman.","error");return}
  const rows=data||[];
  list.innerHTML="";
  $("jumlahPengumuman").textContent=rows.length;
  $("pengumumanEmptyState").classList.toggle("hidden",rows.length>0);
  rows.forEach(item=>{
    const article=document.createElement("article");article.className="announcement-item";
    article.innerHTML=`<div class="announcement-top"><h2 class="announcement-title">${escapeHTML(item.judul)}</h2><time class="announcement-date">${escapeHTML(formatTanggalWaktu(item.dibuat_pada))}</time></div><p class="announcement-body">${formatPengumumanText(item.isi)}</p><div class="announcement-author"><span class="announcement-author-avatar">${escapeHTML(getInitials(item.petugas_nama))}</span><span class="announcement-author-text"><strong>${escapeHTML(item.petugas_nama||"Petugas")}</strong><span>${escapeHTML(formatRole(item.petugas_role))}</span></span></div>`;
    list.appendChild(article);
  });
}
function resetFormPengumuman(){
  $("formPengumuman")?.reset();
  message("pengumumanMessage","");
  $("formPengumumanPanel")?.classList.add("hidden");
}
$("tambahPengumumanButton").addEventListener("click",()=>{
  if(currentMode!=="pengelola")return;
  $("formPengumumanPanel").classList.toggle("hidden");
  if(!$("formPengumumanPanel").classList.contains("hidden")) $("judulPengumuman").focus();
});
$("batalPengumuman").addEventListener("click",resetFormPengumuman);
$("formPengumuman").addEventListener("submit",async e=>{
  e.preventDefault();
  if(!currentUser||!currentPetugas){toast("Sesi pengelola tidak aktif.","error");return}
  const judul=$("judulPengumuman").value.trim();
  const isi=$("isiPengumuman").value.trim();
  if(!judul||!isi){message("pengumumanMessage","Judul dan isi pengumuman wajib diisi.","error");return}
  const btn=$("simpanPengumuman");setLoadingButton(btn,"Menerbitkan...",true);message("pengumumanMessage","");
  try{
    const {error}=await supabaseClient.from("Pengumuman").insert({
      judul,isi,petugas_id:currentPetugas.id,petugas_nama:currentPetugas.nama,petugas_role:currentPetugas.role,dibuat_pada:new Date().toISOString()
    });
    if(error) throw error;
    resetFormPengumuman();
    await loadPengumuman();
    toast("Pengumuman berhasil diterbitkan.","success");
  }catch(err){console.error(err);message("pengumumanMessage",err.message||"Gagal menerbitkan pengumuman.","error")}
  finally{setLoadingButton(btn,"",false)}
});
$("backFromPengumuman").addEventListener("click",async()=>{
  resetFormPengumuman();
  if(!goBack())showPage(currentMode==="anggota"?"anggotaHomePage":"dashboardPage",{pushHistory:false});
  if(currentMode==="pengelola"&&currentPage==="dashboardPage")await loadDashboard();
});

/* ---------- REALTIME ---------- */
function setupRealtime(){
  if(realtimeChannel) supabaseClient.removeChannel(realtimeChannel);
  realtimeChannel=supabaseClient.channel("e-absensi-realtime-rebuild")
    .on("postgres_changes",{event:"*",schema:"public",table:"Anggota"},async()=>{
      if(currentPage==="anggotaPage")await loadAnggota($("searchAnggota").value);
      if(currentPage==="dashboardPage")await loadDashboard();
      if(currentPage==="scannerPage")await loadScannerMembers($("manualSearch").value);
      if(currentPage==="manualAbsensiPage"&&!selectedManualMember)await loadManualMembers($("manualAbsensiSearch").value);
    })
    .on("postgres_changes",{event:"*",schema:"public",table:"Absensi"},async()=>{
      if(currentPage==="rekapPage")await(currentMode==="anggota"?loadMemberRekap():loadRekap());
      refreshBeranda();
    })
    .on("postgres_changes",{event:"*",schema:"public",table:"Pengumuman"},async()=>{
      if(currentPage==="pengumumanPage")await loadPengumuman();
      refreshBeranda();
    })
    .on("postgres_changes",{event:"*",schema:"public",table:"PengajuanPassword"},async()=>{
      if(currentPage==="pengajuanPasswordPage")await loadPasswordRequests();
      refreshBeranda();
    })
    .on("postgres_changes",{event:"*",schema:"public",table:"Pengajuan"},async()=>{
      if(currentPage==="pengajuanPage")await loadPengajuanRequests();
      refreshBeranda();
    }).subscribe();
}

/* =====================================================================
   TAB BAR + BERANDA
   ===================================================================== */
const TAB_ICONS={
  home:'<path d="M3 11.5 12 4l9 7.5"></path><path d="M5.5 10v9.5h4.5v-5.5h4v5.5h4.5V10"></path>',
  anggota:'<circle cx="9" cy="8" r="3.5"></circle><path d="M2.5 20a6.5 6.5 0 0 1 13 0"></path><path d="M16 4.7a3.5 3.5 0 0 1 0 6.6M18.5 14.3A6.5 6.5 0 0 1 21.5 20"></path>',
  scan:'<path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4"></path><path d="M8 8h3v3H8zM13 13h3v3h-3zM14 8h2"></path>',
  rekap:'<path d="M4 19V5M4 19h16M7 15l3-4 3 2 5-7"></path>',
  more:'<circle cx="5.5" cy="12" r="1.5"></circle><circle cx="12" cy="12" r="1.5"></circle><circle cx="18.5" cy="12" r="1.5"></circle>',
  identitas:'<circle cx="12" cy="8" r="4"></circle><path d="M4 21a8 8 0 0 1 16 0"></path>',
  pengajuan:'<path d="M6 3h9l4 4v14H6z"></path><path d="M14 3v5h5M9 13h6M9 17h6"></path>',
  pengumuman:'<path d="M4 11h4l8-5v12l-8-5H4z"></path><path d="M8 16v3M19 9.5a4 4 0 0 1 0 5"></path>'
};
const TAB_DEFS={
  pengelola:[
    {key:"home",label:"Beranda"},{key:"anggota",label:"Anggota"},{key:"scan",label:"Scan QR"},
    {key:"rekap",label:"Rekap"},{key:"more",label:"Lainnya"}
  ],
  anggota:[
    {key:"home",label:"Beranda"},{key:"identitas",label:"Identitas"},{key:"rekap",label:"Rekap"},
    {key:"pengajuan",label:"Izin/Sakit"},{key:"pengumuman",label:"Pengumuman"}
  ]
};
let tabBarMode=null;

function buildTabBar(mode){
  const inner=$("tabBarInner");
  if(!inner)return;
  const defs=TAB_DEFS[mode];
  if(!defs){tabBarMode=null;inner.innerHTML="";updateTabBar();return}
  if(tabBarMode===mode&&inner.children.length)return;
  tabBarMode=mode;
  inner.innerHTML=defs.map(t=>`<button type="button" class="tab-item" data-tab="${t.key}"><span class="tab-ico"><svg viewBox="0 0 24 24" aria-hidden="true">${TAB_ICONS[t.key]}</svg></span><span class="tab-label">${t.label}</span></button>`).join("");
}
function updateTabBar(){
  const bar=$("tabBar");
  if(!bar)return;
  const show=!!currentMode&&!!TAB_DEFS[currentMode]&&currentPage!=="loginPage";
  bar.classList.toggle("hidden",!show);
  document.body.classList.toggle("has-tabbar",show);
  const active=show?tabForPage(currentPage):null;
  bar.querySelectorAll(".tab-item").forEach(b=>{
    const on=b.dataset.tab===active;
    b.classList.toggle("active",on);
    if(on)b.setAttribute("aria-current","page");else b.removeAttribute("aria-current");
  });
}
function setTabBadge(key,show){
  const b=document.querySelector(`#tabBarInner .tab-item[data-tab="${key}"]`);
  if(!b)return;
  let dot=b.querySelector(".tab-badge");
  if(show&&!dot){dot=document.createElement("i");dot.className="tab-badge";b.appendChild(dot)}
  else if(!show&&dot)dot.remove();
}

function openMoreSheet(){$("moreSheet")?.classList.remove("hidden")}
function closeMoreSheet(){$("moreSheet")?.classList.add("hidden")}
$("moreSheet").addEventListener("click",e=>{
  if(e.target.closest("[data-close-sheet]")){closeMoreSheet();return}
  if(e.target.closest(".menu-card")){markPendingTab("more");closeMoreSheet()}
},true);
$("sheetPengajuanButton").addEventListener("click",async()=>{
  showPage("pengajuanPage");
  await loadPengajuanRequests();
});

const TAB_NO_RELOAD=new Set(["scan","pengajuan","identitas"]);
async function navTo(key){
  closeMoreSheet();
  const mode=currentMode;
  if(!mode||!currentUser)return;
  if(key==="more"){openMoreSheet();return}
  const onThisTab=tabForPage(currentPage)===key&&TAB_ROOT_PAGES[mode]?.[key]?.includes(currentPage);
  if(onThisTab&&TAB_NO_RELOAD.has(key))return;
  if(currentPage==="scannerPage"&&key!=="scan")stopScanner();
  markPendingTab(key);
  if(key==="home"){
    showPage(homePageFor(mode));
    if(mode==="pengelola")await loadDashboard();else await loadBerandaAnggota();
    return;
  }
  const proxy={
    pengelola:{anggota:"anggotaButton",scan:"scanQRButton",rekap:"rekapButton"},
    anggota:{identitas:"anggotaIdentitasButton",rekap:"anggotaRekapButton",pengajuan:"anggotaPengajuanButton",pengumuman:"anggotaPengumumanButton"}
  }[mode]?.[key];
  if(proxy)$(proxy)?.click();
}
$("tabBar").addEventListener("click",e=>{
  const b=e.target.closest(".tab-item");
  if(b)navTo(b.dataset.tab);
});

// Sembunyikan tab bar saat keyboard muncul agar ruang ketik tidak terpotong.
(function(){
  const typing=el=>el&&el.matches?.('input:not([type=radio]):not([type=checkbox]):not([type=file]):not([type=button]):not([type=submit]),textarea,select');
  let t=null;
  document.addEventListener("focusin",e=>{if(typing(e.target)){clearTimeout(t);document.body.classList.add("kb-open")}});
  document.addEventListener("focusout",()=>{clearTimeout(t);t=setTimeout(()=>{if(!typing(document.activeElement))document.body.classList.remove("kb-open")},120)});
})();

/* ---------- Pembantu data & tampilan Beranda ---------- */
let berandaToken=0,berandaTimer=null;
function refreshBeranda(){
  if(!currentUser)return;
  clearTimeout(berandaTimer);
  berandaTimer=setTimeout(()=>{
    if(currentMode==="pengelola"&&currentPage==="dashboardPage")loadDashboard();
    else if(currentMode==="anggota"&&currentPage==="anggotaHomePage")loadBerandaAnggota();
  },350);
}
async function safeQ(builder){
  try{
    const r=await builder;
    if(r?.error){console.warn("Beranda:",r.error);return {data:null,count:null,error:r.error}}
    return r;
  }catch(e){console.warn("Beranda:",e);return {data:null,count:null,error:e}}
}
function berandaSkeleton(){
  return `<div class="skeleton b-sk" style="height:178px;border-radius:22px"></div>
    <div class="skeleton b-sk" style="height:150px"></div>
    <div class="skeleton b-sk" style="height:96px"></div>
    <div class="skeleton b-sk" style="height:84px"></div>`;
}
function fmtTanggalPanjang(iso){
  const d=new Date(iso+"T00:00:00");
  return Number.isNaN(d.getTime())?String(iso||"-"):d.toLocaleDateString("id-ID",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
}
function daysFromToday(iso){
  return Math.round((new Date(iso+"T00:00:00")-new Date(getToday()+"T00:00:00"))/86400000);
}
function countdownLabel(n){
  if(n===0)return "Hari ini";
  if(n===1)return "Besok";
  if(n>=14&&n%7===0)return `${n/7} minggu lagi`;
  return `${n} hari lagi`;
}
function meetingInfo(meetingDates,recordDates){
  const today=getToday();
  const md=[...new Set(meetingDates.filter(Boolean))].sort();
  const next=md.find(d=>d>today)||null;
  const past=[...new Set([...md.filter(d=>d<today),...recordDates.filter(d=>d&&d<today)])].sort();
  return {today,todayMeeting:md.includes(today),next,last:past.length?past[past.length-1]:null};
}
function pct(h,total){return total?Math.round(h/total*100):null}
function segBar(h,i,s,a){
  const t=h+i+s+a;
  if(!t)return `<div class="seg-bar is-empty"></div>`;
  return `<div class="seg-bar" role="img" aria-label="Hadir ${h}, izin ${i}, sakit ${s}, alpa ${a}">${h?`<i class="s-hadir" style="flex:${h}"></i>`:""}${i?`<i class="s-izin" style="flex:${i}"></i>`:""}${s?`<i class="s-sakit" style="flex:${s}"></i>`:""}${a?`<i class="s-alpa" style="flex:${a}"></i>`:""}</div>`;
}
function countGrid(h,i,s,a){
  return `<div class="count-grid"><div class="c-hadir"><strong>${h}</strong><small>Hadir</small></div><div class="c-izin"><strong>${i}</strong><small>Izin</small></div><div class="c-sakit"><strong>${s}</strong><small>Sakit</small></div><div class="c-alpa"><strong>${a}</strong><small>Alpa</small></div></div>`;
}
function heroCard({info,sub,actions}){
  const {todayMeeting,next}=info;
  const target=todayMeeting?info.today:next;
  let label,chip,title,tile;
  if(target){
    const n=daysFromToday(target);
    label=todayMeeting?"PERTEMUAN HARI INI":"PERTEMUAN BERIKUTNYA";
    chip=countdownLabel(n);
    title=fmtTanggalPanjang(target);
    const b=tanggalBadge(target);
    tile=`<strong>${escapeHTML(b.day)}</strong><small>${escapeHTML(b.month)}</small>`;
  }else{
    label="PERTEMUAN BERIKUTNYA";
    chip="Belum dijadwalkan";
    title="Belum ada jadwal";
    tile=`<strong>–</strong><small>Jadwal</small>`;
  }
  return `<article class="hero-card${target?"":" is-empty"}">
    <span class="hero-label">${label}</span>
    <div class="hero-main"><div class="date-tile">${tile}</div><div class="hero-copy"><h2>${escapeHTML(title)}</h2><span class="hero-chip">${escapeHTML(chip)}</span></div></div>
    ${sub?`<p class="hero-sub">${sub}</p>`:""}
    ${actions?`<div class="hero-actions">${actions}</div>`:""}
  </article>`;
}
function newsCard(row){
  if(!row)return "";
  const snippet=String(row.isi||"").replace(/\*/g,"").replace(/\s+/g," ").trim();
  return `<button type="button" class="b-card b-link" data-go="news">
    <div class="b-head"><div><span class="eyebrow">PENGUMUMAN TERBARU</span><h3>${escapeHTML(row.judul||"-")}</h3></div><span class="link-chip">Buka ›</span></div>
    <p class="news-snip">${escapeHTML(snippet)}</p>
    <time class="news-time">${escapeHTML(formatTanggalWaktu(row.dibuat_pada))}</time>
  </button>`;
}
function berandaError(box,msg){
  box.innerHTML=`<div class="b-card b-error"><strong>Gagal memuat ringkasan</strong><small>${escapeHTML(msg||"Periksa koneksi internet lalu coba lagi.")}</small><button type="button" class="secondary-button" data-go="retry">Coba Lagi</button></div>`;
  box.dataset.ready="";
}

/* ---------- BERANDA PENGELOLA ---------- */
async function loadDashboard(){
  const box=$("berandaPengelola");
  if(!box)return;
  const token=++berandaToken;
  if(currentPetugas?.nama)$("pengelolaDashboardTitle").textContent=`Halo, ${currentPetugas.nama}`;
  if(!box.dataset.ready)box.innerHTML=berandaSkeleton();
  const sb=supabaseClient;
  const [ms,as,ps,pt,pg,pw]=await Promise.all([
    safeQ(sb.from("Anggota").select("id,nama,kelas,status")),
    safeQ(sb.from("Absensi").select("anggota_id,tanggal,status")),
    safeQ(sb.from("Pengajuan").select("anggota_id,tanggal,jenis,status")),
    safeQ(sb.from("Pertemuan").select("tanggal")),
    safeQ(sb.from("Pengumuman").select("id,judul,isi,dibuat_pada").order("dibuat_pada",{ascending:false}).limit(1)),
    safeQ(sb.from("PengajuanPassword").select("id",{count:"exact",head:true}).eq("status","menunggu"))
  ]);
  if(token!==berandaToken)return;
  if(ms.error||as.error){berandaError(box,(ms.error||as.error)?.message);return}

  const anggota=ms.data||[],absensi=as.data||[],pengajuan=ps.data||[];
  const info=meetingInfo((pt.data||[]).map(x=>x.tanggal),[...absensi.map(x=>x.tanggal),...pengajuan.map(x=>x.tanggal)]);

  // Ringkasan keseluruhan (aturan sama dengan "Rekap Keseluruhan")
  const rk=Laporan.hitungRekap(anggota,absensi,pengajuan);
  const tot=rk.rows.reduce((o,r)=>({h:o.h+r.hadir,i:o.i+r.izin,s:o.s+r.sakit,a:o.a+r.alpa}),{h:0,i:0,s:0,a:0});
  const allCount=tot.h+tot.i+tot.s+tot.a;
  const rata=pct(tot.h,allCount);
  const totalPertemuan=new Set([...(pt.data||[]).map(x=>x.tanggal).filter(d=>d&&d<info.today),...rk.dates.filter(d=>d<=info.today)]).size;

  // Hero
  let sub="",actions="";
  if(info.todayMeeting){
    const hadirHariIni=new Set(absensi.filter(a=>a.tanggal===info.today&&String(a.status||"").toLowerCase()==="hadir").map(a=>a.anggota_id)).size;
    sub=`<b>${hadirHariIni}</b> dari <b>${anggota.length}</b> anggota sudah hadir.`;
    if(info.next)sub+=` Berikutnya: ${escapeHTML(fmtTanggalPanjang(info.next))}.`;
    actions=`<button type="button" class="hero-btn solid" data-go="scan">Mulai Scan QR</button><button type="button" class="hero-btn" data-go="manual">Absen Manual</button>`;
  }else if(info.next){
    sub=`Anggota bisa mengajukan izin/sakit sampai hari pertemuan.`;
    actions=`<button type="button" class="hero-btn solid" data-go="jadwal">Kelola Jadwal</button>`;
  }else{
    sub=`Tambahkan jadwal agar scan QR dan absensi manual bisa digunakan.`;
    actions=`<button type="button" class="hero-btn solid" data-go="jadwal">Jadwalkan Pertemuan</button>`;
  }

  // Pertemuan terakhir (aturan sama dengan halaman Rekap per tanggal)
  let lastCard="";
  if(info.last){
    const byMember=new Map(absensi.filter(a=>a.tanggal===info.last).map(a=>[a.anggota_id,String(a.status||"").toLowerCase()]));
    let h=0,i=0,s=0,a=0;
    for(const m of anggota){const st=byMember.get(m.id);if(st==="hadir")h++;else if(st==="izin")i++;else if(st==="sakit")s++;else a++}
    const n=Math.abs(daysFromToday(info.last));
    lastCard=`<article class="b-card">
      <div class="b-head"><div><span class="eyebrow">PERTEMUAN TERAKHIR</span><h3>${escapeHTML(fmtTanggalPanjang(info.last))}</h3><small class="b-sub">${n===1?"Kemarin":n+" hari yang lalu"} · ${pct(h,anggota.length)??0}% hadir</small></div><button type="button" class="link-chip" data-go="rekap">Detail ›</button></div>
      ${segBar(h,i,s,a)}${countGrid(h,i,s,a)}
    </article>`;
  }else{
    lastCard=`<article class="b-card"><span class="eyebrow">PERTEMUAN TERAKHIR</span><p class="b-empty">Belum ada pertemuan yang tercatat.</p></article>`;
  }

  // Ringkasan keseluruhan
  const overall=`<article class="b-card">
    <div class="b-head"><div><span class="eyebrow">RINGKASAN KESELURUHAN</span></div><button type="button" class="link-chip" data-go="rekap">Rekap ›</button></div>
    <div class="tiles">
      <div class="tile"><strong>${anggota.length}</strong><small>Anggota</small></div>
      <div class="tile"><strong>${totalPertemuan}</strong><small>Pertemuan</small></div>
      <div class="tile"><strong>${rata===null?"–":rata+"%"}</strong><small>Rata-rata hadir</small></div>
    </div>
    ${allCount?`<div class="b-gap"></div>${segBar(tot.h,tot.i,tot.s,tot.a)}<div class="legend"><span><i class="s-hadir"></i>Hadir ${tot.h}</span><span><i class="s-izin"></i>Izin ${tot.i}</span><span><i class="s-sakit"></i>Sakit ${tot.s}</span><span><i class="s-alpa"></i>Alpa ${tot.a}</span></div>`:""}
  </article>`;

  // Perlu diproses
  const reqIzin=pengajuan.filter(p=>String(p.status||"").toLowerCase()==="menunggu").length;
  const reqPw=pw.count||0;
  setTabBadge("more",reqIzin+reqPw>0);
  const todo=`<article class="b-card">
    <div class="b-head"><div><span class="eyebrow">PERLU DIPROSES</span></div></div>
    <div class="todo-list">
      <button type="button" class="todo-row" data-go="req-izin"><span>Pengajuan izin / sakit</span><b class="todo-count${reqIzin?"":" zero"}">${reqIzin}</b></button>
      <button type="button" class="todo-row" data-go="req-pw"><span>Reset password anggota</span><b class="todo-count${reqPw?"":" zero"}">${reqPw}</b></button>
    </div>
  </article>`;

  box.innerHTML=heroCard({info,sub,actions})+lastCard+overall+todo+newsCard((pg.data||[])[0]);
  box.dataset.ready="1";
}

/* ---------- BERANDA ANGGOTA ---------- */
function memberDateStatus(att,req){
  if(att){const s=String(att.status||"").toLowerCase();return (s==="hadir"||s==="izin"||s==="sakit")?s:"alpa"}
  if(req){
    const r=String(req.status||"").toLowerCase();
    if(r==="diterima")return req.jenis==="sakit"?"sakit":"izin";
    if(r==="ditolak")return "alpa";
    return "menunggu";
  }
  return null;
}
const STATUS_BADGE={hadir:["HADIR","status-hadir"],izin:["IZIN","status-izin"],sakit:["SAKIT","status-sakit"],alpa:["ALPA","status-tanpa"],menunggu:["MENUNGGU","status-izin"]};
function statusBadge(st){const [t,c]=STATUS_BADGE[st]||["-",""];return `<span class="recap-status ${c}">${t}</span>`}

async function loadBerandaAnggota(){
  const box=$("berandaAnggota");
  if(!box||!currentAnggota?.id)return;
  const token=++berandaToken;
  if(!box.dataset.ready)box.innerHTML=berandaSkeleton();
  const sb=supabaseClient,id=currentAnggota.id;
  const [pt,ab,pj,pg]=await Promise.all([
    safeQ(sb.from("Pertemuan").select("tanggal")),
    safeQ(sb.from("Absensi").select("tanggal,jam,status").eq("anggota_id",id)),
    safeQ(sb.from("Pengajuan").select("tanggal,jenis,status,diajukan_pada").eq("anggota_id",id).order("diajukan_pada",{ascending:false})),
    safeQ(sb.from("Pengumuman").select("id,judul,isi,dibuat_pada").order("dibuat_pada",{ascending:false}).limit(1))
  ]);
  if(token!==berandaToken)return;
  if(ab.error||pj.error){berandaError(box,(ab.error||pj.error)?.message);return}

  const absensi=ab.data||[],pengajuan=pj.data||[];
  const attBy=new Map(),reqBy=new Map();
  for(const r of absensi)if(r.tanggal&&!attBy.has(r.tanggal))attBy.set(r.tanggal,r);
  for(const r of pengajuan)if(r.tanggal&&!reqBy.has(r.tanggal))reqBy.set(r.tanggal,r);
  const info=meetingInfo((pt.data||[]).map(x=>x.tanggal),[...attBy.keys(),...reqBy.keys()]);

  // Hitungan pribadi. Pertemuan terjadwal yang sudah lewat tanpa catatan dihitung Alpa
  // (sama seperti Rekap per tanggal di mode pengelola). Tanggal yang belum terjadi tidak dihitung.
  const c={hadir:0,izin:0,sakit:0,alpa:0};
  const pastMeetings=(pt.data||[]).map(x=>x.tanggal).filter(d=>d&&d<info.today);
  for(const d of new Set([...attBy.keys(),...reqBy.keys(),...pastMeetings])){
    if(d>info.today)continue;
    const st=memberDateStatus(attBy.get(d),reqBy.get(d))||(d<info.today?"alpa":null);
    if(st&&c[st]!==undefined)c[st]++;
  }
  const total=c.hadir+c.izin+c.sakit+c.alpa;
  const rata=pct(c.hadir,total);

  // Hero
  let sub="",actions="";
  if(info.todayMeeting){
    const st=memberDateStatus(attBy.get(info.today),reqBy.get(info.today));
    if(st==="hadir"){
      const jam=(attBy.get(info.today)?.jam&&attBy.get(info.today).metode!=="Pengajuan")?` pukul ${String(attBy.get(info.today).jam).slice(0,5)}`:"";
      sub=`Kamu sudah <b>hadir</b>${jam}. Terima kasih!`;
    }else if(st==="izin"||st==="sakit"){sub=`Status kamu hari ini: <b>${st==="izin"?"Izin":"Sakit"}</b>.`}
    else if(st==="menunggu"){sub=`Pengajuanmu hari ini sedang <b>menunggu</b> persetujuan.`}
    else{sub=`Kamu <b>belum absen</b> hari ini. Tunjukkan QR kamu ke pengelola.`;actions=`<button type="button" class="hero-btn solid" data-go="identitas">Tampilkan QR Saya</button>`}
  }else if(info.next){
    const rq=reqBy.get(info.next);
    if(rq){
      const rs=String(rq.status||"").toLowerCase();
      sub=`Pengajuan ${rq.jenis==="sakit"?"sakit":"izin"} kamu: <b>${rs==="diterima"?"Diterima":rs==="ditolak"?"Ditolak":"Menunggu"}</b>.`;
    }else{
      sub=`Tidak bisa hadir? Ajukan izin atau sakit sebelum hari pertemuan.`;
      actions=`<button type="button" class="hero-btn solid" data-go="pengajuan-tab">Ajukan Izin / Sakit</button>`;
    }
  }else{
    sub=`Pengelola belum menjadwalkan pertemuan berikutnya.`;
  }

  // Pertemuan terakhir
  let lastCard="";
  if(info.last){
    const st=memberDateStatus(attBy.get(info.last),reqBy.get(info.last))||"alpa";
    const n=Math.abs(daysFromToday(info.last));
    lastCard=`<article class="b-card">
      <div class="b-head"><div><span class="eyebrow">PERTEMUAN TERAKHIR</span><h3>${escapeHTML(fmtTanggalPanjang(info.last))}</h3><small class="b-sub">${n===1?"Kemarin":n+" hari yang lalu"}</small></div>${statusBadge(st)}</div>
      <p class="b-note">Statusmu pada pertemuan ini: <b>${escapeHTML(STATUS_BADGE[st]?.[0]||"-").toLowerCase()}</b>.</p>
    </article>`;
  }else{
    lastCard=`<article class="b-card"><span class="eyebrow">PERTEMUAN TERAKHIR</span><p class="b-empty">Belum ada pertemuan yang tercatat.</p></article>`;
  }

  // Kehadiran saya
  const mine=`<article class="b-card">
    <div class="b-head"><div><span class="eyebrow">KEHADIRAN SAYA</span><h3>${rata===null?"Belum ada data":rata+"% hadir"}</h3><small class="b-sub">dari ${total} pertemuan</small></div><button type="button" class="link-chip" data-go="rekap">Riwayat ›</button></div>
    ${segBar(c.hadir,c.izin,c.sakit,c.alpa)}${countGrid(c.hadir,c.izin,c.sakit,c.alpa)}
  </article>`;

  // Pengajuan terakhir
  let reqCard="";
  const lastReq=pengajuan[0];
  if(lastReq){
    const rs=String(lastReq.status||"").toLowerCase();
    const label=rs==="diterima"?"DITERIMA":rs==="ditolak"?"DITOLAK":"MENUNGGU";
    const cls=rs==="diterima"?"status-hadir":rs==="ditolak"?"status-tanpa":"status-izin";
    reqCard=`<button type="button" class="b-card b-link" data-go="rekap">
      <div class="b-head" style="margin:0"><div><span class="eyebrow">PENGAJUAN TERAKHIR</span><h3>${lastReq.jenis==="sakit"?"Sakit":"Izin"} · ${escapeHTML(formatTanggal(lastReq.tanggal))}</h3></div><span class="recap-status ${cls}">${label}</span></div>
    </button>`;
  }

  box.innerHTML=heroCard({info,sub,actions})+lastCard+mine+reqCard+newsCard((pg.data||[])[0]);
  box.dataset.ready="1";
}

/* ---------- Aksi di Beranda ---------- */
function berandaGo(action){
  switch(action){
    case "rekap":navTo("rekap");break;
    case "scan":navTo("scan");break;
    case "identitas":navTo("identitas");break;
    case "pengajuan-tab":navTo("pengajuan");break;
    case "jadwal":$("jadwalkanPertemuanButton").click();break;
    case "manual":markPendingTab("more");$("manualAbsensiButton").click();break;
    case "req-izin":markPendingTab("more");showPage("pengajuanPage");loadPengajuanRequests();break;
    case "req-pw":markPendingTab("more");$("pengajuanPasswordButton").click();break;
    case "news":
      if(currentMode==="anggota")navTo("pengumuman");
      else{markPendingTab("more");$("pengumumanButton").click()}
      break;
    case "retry":
      if(currentMode==="pengelola")loadDashboard();else loadBerandaAnggota();
      break;
  }
}
["berandaPengelola","berandaAnggota"].forEach(id=>$(id).addEventListener("click",e=>{
  const el=e.target.closest("[data-go]");
  if(el)berandaGo(el.dataset.go);
}));

/* ---------- INIT ---------- */
window.addEventListener("popstate",async(event)=>{
  closeMoreSheet();
  if(currentPage==="scannerPage")stopScanner();
  const previous=navigationStack.pop();
  if(previous){
    isPopStateNavigation=true;
    showPage(previous,{pushHistory:false});
    isPopStateNavigation=false;
    if(currentPage==="dashboardPage"&&currentMode==="pengelola")await loadDashboard();
    else if(currentPage==="anggotaHomePage"&&currentMode==="anggota")await loadBerandaAnggota();
    return;
  }
  // Root halaman aplikasi: tahan tombol Back agar tidak langsung meninggalkan SPA.
  if(currentMode==="pengelola"&&currentUser){
    resetNavigation("dashboardPage");
    showPage("dashboardPage",{pushHistory:false});
    await loadDashboard();
  }else if(currentMode==="anggota"){
    resetNavigation("anggotaHomePage");
    showPage("anggotaHomePage",{pushHistory:false});
    await loadBerandaAnggota();
  }else{
    resetNavigation("modePage");
    showPage("loginPage",{pushHistory:false});
  }
});

async function restoreSession(){
  // Kerangka awal mengikuti peran terakhir; bukan bukti autentikasi.
  try{
    const hint=localStorage.getItem("eabsensi_last_role");
    if(hint==="anggota"||hint==="pengelola")setStartupSkeleton(hint);
    else setStartupSkeleton("netral");
  }catch(_){setStartupSkeleton("netral")}
  try{
    const {data,error}=await supabaseClient.auth.getSession();
    if(error)throw error;

    currentUser=data.session?.user||null;

    if(currentUser){
      const petugas=await getPetugas();

      if(petugas){
        currentPetugas=petugas;
        setMode("pengelola");
        resetNavigation("dashboardPage");
        showPage("dashboardPage",{pushHistory:false});
        await loadDashboard();
      }else{
        // Member session: resolve only the logged-in member.
        const {data:member,error:memberError}=await supabaseClient
          .from("Anggota")
          .select("id,nama,kelas,email,no_hp,auth_user_id,qr_code,password_awal_sudah_diubah")
          .eq("auth_user_id",currentUser.id)
          .maybeSingle();

        if(memberError || !member){
          await supabaseClient.auth.signOut();
          clearAuthState();
          configureLogin("anggota");
          resetNavigation("loginPage");
          showPage("loginPage",{pushHistory:false});
        }else{
          currentAnggota=member;
          setMode("anggota");
          $("anggotaDashboardTitle").textContent=`Halo, ${member.nama}`;
          $("anggotaDashboardSubtitle").textContent=`${member.kelas || "Anggota"} · Ringkasan kehadiranmu`;
          resetNavigation("anggotaHomePage");
          showPage("anggotaHomePage",{pushHistory:false});
          updateFirstPasswordNotice();
          loadBerandaAnggota();
        }
      }
    }else{
      configureLogin("anggota");
      resetNavigation("loginPage");
      showPage("loginPage",{pushHistory:false});
    }
  }catch(err){
    console.error("Gagal memulihkan sesi:",err);
    configureLogin("anggota");
    resetNavigation("loginPage");
    showPage("loginPage",{pushHistory:false});
  }finally{
    setTimeout(()=>$("loadingScreen").classList.add("hidden"),150);
  }
}

supabaseClient.auth.onAuthStateChange((_event,session)=>{
  currentUser=session?.user||null;
  if(!session){currentPetugas=null;if(currentMode==="pengelola"){setMode(null);resetNavigation("modePage");showPage("loginPage",{pushHistory:false})}}
});
setupRealtime();
window.addEventListener("beforeunload",()=>{stopScanner();if(realtimeChannel)supabaseClient.removeChannel(realtimeChannel)});
restoreSession();


/* ---------- DONASI QRIS DINAMIS ---------- */
(function(){
  // QRIS statis milik "Gilang Stan, Komputer" (CRC valid). Diubah menjadi dinamis:
  // tag 01 -> "12", tag 54 (nominal) disisipkan, CRC16-CCITT dihitung ulang.
  const QRIS_STATIS="00020101021126570011ID.DANA.WWW011893600915303600049202090360004920303UMI51440014ID.CO.QRIS.WWW0215ID10266155735770303UMI5204504553033605802ID5921Gilang Stan, Komputer6008Sukabumi610543351630408A1";
  const MIN=1000,MAX=10000000;
  const crc16=s=>{let c=0xFFFF;for(let i=0;i<s.length;i++){c^=s.charCodeAt(i)<<8;for(let k=0;k<8;k++)c=(c&0x8000)?((c<<1)^0x1021):(c<<1);c&=0xFFFF}return c.toString(16).toUpperCase().padStart(4,"0")};
  const parse=s=>{const o=[];let i=0;while(i<s.length){const l=parseInt(s.substr(i+2,2),10);o.push([s.substr(i,2),s.substr(i+4,l)]);i+=4+l}return o};
  function qrisDinamis(nominal){
    const f=parse(QRIS_STATIS).filter(([t])=>t!=="63"&&t!=="54").map(([t,v])=>t==="01"?[t,"12"]:[t,v]);
    const n=f.findIndex(([t])=>+t>54);
    f.splice(n<0?f.length:n,0,["54",String(nominal)]);
    const body=f.map(([t,v])=>t+String(v.length).padStart(2,"0")+v).join("")+"6304";
    return body+crc16(body);
  }
  const rp=n=>"Rp "+Number(n).toLocaleString("id-ID");
  const $d=id=>document.getElementById(id);
  const input=$d("donasiNominal");
  if(!input)return;
  const digits=()=>parseInt(input.value.replace(/\D/g,"")||"0",10);
  const msg=(t)=>{const m=$d("donasiMessage");m.textContent=t||"";m.className="message"+(t?" error":"")};
  function show(step){$d("donasiForm").classList.toggle("hidden",step!=="form");$d("donasiResult").classList.toggle("hidden",step!=="result")}
  function open(){input.value="";msg("");show("form");$d("donasiModal").classList.remove("hidden");setTimeout(()=>input.focus(),120)}
  function close(){$d("donasiModal").classList.add("hidden")}
  $d("donasiButton").addEventListener("click",open);
  $d("closeDonasi").addEventListener("click",close);
  $d("donasiSelesai").addEventListener("click",close);
  $d("donasiModal").querySelector("[data-close-donasi]").addEventListener("click",close);
  $d("donasiUlang").addEventListener("click",()=>{show("form");setTimeout(()=>input.focus(),60)});
  input.addEventListener("input",()=>{const d=digits();input.value=d?d.toLocaleString("id-ID"):"";msg("")});
  $d("donasiModal").querySelectorAll("[data-nominal]").forEach(b=>b.addEventListener("click",()=>{input.value=Number(b.dataset.nominal).toLocaleString("id-ID");msg("")}));
  $d("donasiForm").addEventListener("submit",e=>{
    e.preventDefault();
    const n=digits();
    if(n<MIN){msg("Nominal minimal "+rp(MIN)+".");return}
    if(n>MAX){msg("Nominal maksimal "+rp(MAX)+".");return}
    if(!window.QRCode){msg("Pembuat QR belum siap. Periksa koneksi internet lalu coba lagi.");return}
    const box=$d("donasiQr");box.innerHTML="";
    new QRCode(box,{text:qrisDinamis(n),width:248,height:248,colorDark:"#000000",colorLight:"#ffffff",correctLevel:QRCode.CorrectLevel.M});
    $d("donasiTotal").textContent=rp(n);
    show("result");
  });
})();
