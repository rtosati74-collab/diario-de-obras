import "./style.css";
import { initializeApp } from "firebase/app";
import {
  initializeAuth, indexedDBLocalPersistence, browserLocalPersistence,
  signInWithEmailAndPassword, onAuthStateChanged, signOut, sendPasswordResetEmail
} from "firebase/auth";
import {
  initializeFirestore, persistentLocalCache, persistentSingleTabManager,
  collection, doc, setDoc, getDoc, onSnapshot, writeBatch
} from "firebase/firestore";
import { jsPDF } from "jspdf";
import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { App as CapApp } from "@capacitor/app";
import { firebaseConfig as fileConfig } from "./firebase-config.js";
import { pctGeral, pesosNormalizados, andamentoInicial } from "./andamento.js";
import { Drive } from "./drive.js";


const MIN_FOTOS = 3;
const CFG_KEY = "diario-obra-firebase-config";
const NATIVE = Capacitor.isNativePlatform();

const ICON = {
  back:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  chev:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>',
  plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  x:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  crane:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M6 21V4l-3 3M6 4h15l-3 3H6M15 7v5M13 12h4v3h-4zM3 21h8M9 4L6 7"/></svg>',
  doc:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6a1 1 0 00-1 1v16a1 1 0 001 1h12a1 1 0 001-1V8z"/><path d="M14 3v5h5M8 13h8M8 17h5"/></svg>',
  edit:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
  cam:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  gal:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 17l-5-5-9 8"/></svg>',
  pdf:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
  share:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/></svg>',
  user:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/></svg>',
  cloudOk:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 18a4.5 4.5 0 01-.6-9A6 6 0 0118 9.5 4.3 4.3 0 0117.5 18z"/><path d="M9.5 13.5l2 2 3.5-4"/></svg>',
  cloudUp:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 18a4.5 4.5 0 01-.6-9A6 6 0 0118 9.5 4.3 4.3 0 0117.5 18z"/><path d="M12 16v-5M9.5 13.5L12 11l2.5 2.5"/></svg>',
  cloudOff:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 18a4.5 4.5 0 01-.6-9 6 6 0 012.3-3.3M12 4.6A6 6 0 0118 9.5 4.3 4.3 0 0119.8 17M3 3l18 18"/></svg>',
  sun:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  cloud:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6.5A4 4 0 0116 7a3.5 3.5 0 011 6.9H7a3 3 0 01-.6-5.9"/><path d="M5 3.5l.8 1.6M2 7l1.7.4"/><path d="M7 19h10"/></svg>',
  rain:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 14a4 4 0 01-.5-8A5 5 0 0116 5.5 4 4 0 0117 14z"/><path d="M8 17l-1 3M12 17l-1 3M16 17l-1 3"/></svg>'
};
const CLIMA = { S:"Sol", I:"Instável", C:"Chuva" };

const S = { phase:"boot", obras:[], diarios:[], screen:"home", obraId:null, diarioId:null, draft:null, obraDraft:null,
  user:null, pend:{o:false,d:false,f:false}, online:navigator.onLine, got:{o:false,d:false}, unsubs:[] };
let FB = null, AUTH = null, DB = null;
const fotoCache = new Map();
const app = document.getElementById("app");

/* ---------- utilitários ---------- */
const $ = (s,r) => (r||document).querySelector(s);
const $$ = (s,r) => Array.from((r||document).querySelectorAll(s));
const esc = v => String(v==null?"":v).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const uid = p => (p||"") + Date.now().toString(36) + Math.random().toString(36).slice(2,7);
function hoje(){ const d=new Date(); d.setMinutes(d.getMinutes()-d.getTimezoneOffset()); return d.toISOString().slice(0,10); }
function fmtData(iso){ if(!iso) return "—"; const p=iso.split("-"); return p[2]+"/"+p[1]+"/"+p[0]; }
const DOW=["domingo","segunda","terça","quarta","quinta","sexta","sábado"];
function diaSemana(iso){ try{ const p=iso.split("-"); return DOW[new Date(+p[0],+p[1]-1,+p[2]).getDay()]; }catch(e){ return ""; } }
const clone = o => JSON.parse(JSON.stringify(o));
const obraById = id => S.obras.find(o => o.id===id) || null;
const diarioById = id => S.diarios.find(d => d.id===id) || null;
function diariosDa(obraId){ return S.diarios.filter(d => d.obraId===obraId).sort((a,b) => (b.data||"").localeCompare(a.data||"") || (b.atualizadoEm||0)-(a.atualizadoEm||0)); }
function sortObras(){ S.obras.sort((a,b) => (a.nome||"").localeCompare(b.nome||"","pt-BR")); }
let toastT;
function toast(msg){ let t=$(".toast"); if(t) t.remove(); t=document.createElement("div"); t.className="toast"; t.setAttribute("role","status"); t.textContent=msg; document.body.appendChild(t); clearTimeout(toastT); toastT=setTimeout(()=>t.remove(),3000); }
function errMsg(e){
  const c = e && e.code || "";
  if(c.includes("permission-denied")) return "sem permissão no Firebase (confira as regras do Firestore)";
  if(c.includes("invalid-credential")||c.includes("wrong-password")||c.includes("user-not-found")||c.includes("invalid-login")) return "e-mail ou senha incorretos";
  if(c.includes("too-many-requests")) return "muitas tentativas; aguarde alguns minutos";
  if(c.includes("network-request-failed")) return "sem conexão com a internet";
  if(c.includes("invalid-email")) return "e-mail inválido";
  if(c.includes("api-key")) return "configuração do Firebase inválida";
  return (e && (e.message||c)) || "erro";
}

/* ---------- configuração do Firebase ---------- */
function readConfig(){
  if(fileConfig && fileConfig.apiKey && fileConfig.projectId) return fileConfig;
  try{ const c=JSON.parse(localStorage.getItem(CFG_KEY)); if(c && c.apiKey && c.projectId) return c; }catch(e){}
  return null;
}
function parseConfig(text){
  const out={}; const keys=["apiKey","authDomain","projectId","storageBucket","messagingSenderId","appId"];
  keys.forEach(k => { const m=new RegExp('["\']?'+k+'["\']?\\s*:\\s*["\']([^"\']+)["\']').exec(text); if(m) out[k]=m[1].trim(); });
  return (out.apiKey && out.projectId && out.appId) ? out : null;
}

/* ---------- inicialização ---------- */
function boot(){
  const cfg = readConfig();
  if(!cfg){ S.phase="setup"; render(); return; }
  try{
    FB = initializeApp(cfg);
    AUTH = initializeAuth(FB, { persistence:[indexedDBLocalPersistence, browserLocalPersistence] });
    DB = initializeFirestore(FB, { localCache: persistentLocalCache({ tabManager: persistentSingleTabManager() }) });
  }catch(e){ S.phase="setup"; S.setupErr="Configuração inválida: "+errMsg(e); render(); return; }
  onAuthStateChanged(AUTH, u => {
    S.user = u;
    stopListeners();
    if(!u){ S.phase="login"; render(); return; }
    S.phase="loading"; S.screen="home"; render(); startListeners();
  });
}
function stopListeners(){ S.unsubs.forEach(f => { try{f()}catch(e){} }); S.unsubs=[]; S.got={o:false,d:false}; S.obras=[]; S.diarios=[]; fotoCache.clear(); }
function startListeners(){
  const onErr = e => { toast("Erro ao ler dados: "+errMsg(e)); if(S.phase==="loading"){ S.phase="app"; render(); } };
  S.unsubs.push(onSnapshot(collection(DB,"obras"), { includeMetadataChanges:true }, snap => {
    S.obras = snap.docs.map(d => ({ ...d.data(), id:d.id })); sortObras();
    S.pend.o = snap.metadata.hasPendingWrites; S.got.o = true; ready();
  }, onErr));
  S.unsubs.push(onSnapshot(collection(DB,"diarios"), { includeMetadataChanges:true }, snap => {
    S.diarios = snap.docs.map(d => ({ ...d.data(), id:d.id }));
    S.pend.d = snap.metadata.hasPendingWrites; S.got.d = true; ready();
  }, onErr));
  S.unsubs.push(onSnapshot(doc(DB,"config","geral"), snap => {
    S.cfg = snap.exists() ? snap.data() : {}; enviarFilaDrive();
  }, () => { S.cfg = {}; }));
}
function ready(){
  if(S.phase==="loading" && S.got.o && S.got.d){ S.phase="app"; render(); return; }
  if(S.phase==="app"){ if(["home","obra","view"].includes(S.screen)) render(); else updSync(); }
}
window.addEventListener("online", () => { S.online=true; updSync(); enviarFilaDrive(); });
window.addEventListener("offline", () => { S.online=false; updSync(); });

/* ---------- gravação (funciona sem internet: fica no celular e sobe quando conectar) ---------- */
function commit(batch, okMsg){
  S.pend.f = true; updSync();
  batch.commit().then(() => { S.pend.f=false; updSync(); }).catch(e => { S.pend.f=false; updSync(); toast("Não foi possível salvar na nuvem: "+errMsg(e)); });
  if(okMsg) toast(S.online ? okMsg : okMsg+" no celular. Envia quando houver internet.");
}
function upsert(list,obj){ const i=list.findIndex(x=>x.id===obj.id); if(i>=0) list[i]=obj; else list.push(obj); }
const Store = {
  saveObra(o, msg){ upsert(S.obras,o); sortObras(); const b=writeBatch(DB); b.set(doc(DB,"obras",o.id), o); commit(b,msg); },
  saveDiario(d, fotosNovas, fotosRemovidas, msg){
    const b = writeBatch(DB);
    fotosNovas.forEach(f => b.set(doc(DB,"fotos",f.id), { dataUrl:f.url, diarioId:d.id, obraId:d.obraId, criadoEm:Date.now() }));
    fotosRemovidas.forEach(id => b.delete(doc(DB,"fotos",id)));
    b.set(doc(DB,"diarios",d.id), d);
    upsert(S.diarios,d); commit(b,msg);
  },
  delDiario(d){
    const b = writeBatch(DB);
    (d.fotos||[]).forEach(f => b.delete(doc(DB,"fotos",f.id)));
    b.delete(doc(DB,"diarios",d.id));
    S.diarios = S.diarios.filter(x => x.id!==d.id); commit(b,"Diário excluído");
  },
  delObra(o){
    let b = writeBatch(DB), n=0; const batches=[b];
    const add = (fn) => { if(n>=450){ b=writeBatch(DB); batches.push(b); n=0; } fn(b); n++; };
    diariosDa(o.id).forEach(d => { (d.fotos||[]).forEach(f => add(x=>x.delete(doc(DB,"fotos",f.id)))); add(x=>x.delete(doc(DB,"diarios",d.id))); });
    add(x=>x.delete(doc(DB,"obras",o.id)));
    S.obras = S.obras.filter(x=>x.id!==o.id); S.diarios = S.diarios.filter(x=>x.obraId!==o.id);
    batches.forEach((bb,i) => commit(bb, i===0 ? "Obra excluída" : null));
  }
};
async function loadFoto(id){
  if(fotoCache.has(id)) return fotoCache.get(id);
  try{ const s = await getDoc(doc(DB,"fotos",id)); const u = s.exists() ? s.data().dataUrl : ""; if(u) fotoCache.set(id,u); return u; }
  catch(e){ return ""; }
}

/* ---------- navegação ---------- */
function go(screen, opts={}){
  S.screen = screen;
  if("obraId" in opts) S.obraId = opts.obraId;
  if("diarioId" in opts) S.diarioId = opts.diarioId;
  closeSheets(); render(); window.scrollTo(0,0);
}
let backHandler = null;
function setTop(title, sub, back, right){
  backHandler = back || null;
  $("#topbar").innerHTML = (back ? '<button class="iconbtn" id="backBtn" aria-label="Voltar">'+ICON.back+'</button>' : '') +
    '<h1>'+esc(title)+(sub ? '<span class="sub">'+esc(sub)+'</span>' : '')+'</h1>' + (right||"");
  if(back) $("#backBtn").onclick = back;
}
function setBar(html){ $("#barSlot").innerHTML = html ? '<div class="bar"><div class="bar-in">'+html+'</div></div>' : ''; }
CapApp.addListener("backButton", () => {
  const sc = $(".scrim"); if(sc){ sc.remove(); return; }
  if(backHandler) backHandler(); else CapApp.exitApp();
}).catch(()=>{});

function syncHtml(){
  const pend = S.pend.o||S.pend.d||S.pend.f;
  if(!S.online) return '<div class="sync off" id="sync">'+ICON.cloudOff+'Sem internet · tudo fica salvo no celular e sobe sozinho quando conectar</div>';
  if(pend) return '<div class="sync pend" id="sync">'+ICON.cloudUp+'Enviando para a nuvem…</div>';
  return '<div class="sync ok" id="sync">'+ICON.cloudOk+'Sincronizado na nuvem</div>';
}
function updSync(){ const el=$("#sync"); if(el) el.outerHTML = syncHtml(); }

function render(){
  if(S.phase==="boot") return;
  if(S.phase==="setup") return rSetup();
  if(S.phase==="login") return rLogin();
  if(S.phase==="loading"){ setTop("Diário de Obra"); setBar(""); app.innerHTML='<div class="loading"><div class="spin"></div>Carregando suas obras…</div>'; return; }
  if(S.screen==="home" && S.obras.length===0 && !S.obraDraft){ S.screen="obraForm"; S.obraDraft=novaObra(); S.firstRun=true; }
  ({ home:rHome, obraForm:rObraForm, obra:rObra, editor:rEditor, view:rView, driveCfg:rDriveCfg }[S.screen] || rHome)();
}

/* ---------- configuração inicial ---------- */
function rSetup(){
  setTop("Diário de Obra","Configuração inicial"); setBar("");
  app.innerHTML =
    '<section class="hero"><div class="stripe"></div><div class="in"><h2>Conecte o app à sua nuvem</h2>'+
    '<p>Cole aqui a configuração do seu projeto Firebase. Isso é feito uma vez só em cada celular.</p></div></section>'+
    '<section class="box"><div class="box-h">Configuração do Firebase</div><div class="box-b">'+
    '<p class="muted" style="margin:0;font-size:14px">No console do Firebase: <b>Configurações do projeto › Seus apps › App da Web</b>. Copie o bloco <b>firebaseConfig</b> inteiro, parecido com:</p>'+
    '<code class="cfg">const firebaseConfig = {\n  apiKey: "AIza…",\n  authDomain: "minha-obra.firebaseapp.com",\n  projectId: "minha-obra",\n  …\n  appId: "1:…:web:…"\n};</code>'+
    '<textarea class="inp mono" id="cfgTxt" style="font-size:13px" placeholder="Cole aqui"></textarea>'+
    '<div class="err" id="cfgErr"'+(S.setupErr?'':' hidden')+'>'+esc(S.setupErr||"")+'</div></div></section>';
  setBar('<button class="btn pri" id="cfgSave">Salvar e continuar</button>');
  $("#cfgSave").onclick = () => {
    const c = parseConfig($("#cfgTxt").value);
    if(!c){ const e=$("#cfgErr"); e.hidden=false; e.textContent="Não encontrei apiKey, projectId e appId no texto colado. Copie o bloco firebaseConfig inteiro."; return; }
    try{ localStorage.setItem(CFG_KEY, JSON.stringify(c)); }catch(e){}
    location.reload();
  };
}

/* ---------- login ---------- */
function rLogin(){
  setTop("Diário de Obra","Entrar");
  app.innerHTML =
    '<div class="login"><div class="brand"><span class="ic">'+ICON.crane+'</span><div><h2>Diário de Obra</h2><p>Entre com o e-mail cadastrado pelo engenheiro.</p></div></div>'+
    '<section class="box"><div class="box-b">'+
    '<label class="f">E-mail<input class="inp" id="lgEmail" type="email" autocomplete="username" inputmode="email"></label>'+
    '<label class="f">Senha<input class="inp" id="lgPass" type="password" autocomplete="current-password"></label>'+
    '<div class="err" id="lgErr" hidden></div>'+
    '<button class="linkbtn" id="lgForgot">Esqueci a senha</button></div></section>'+
    (readConfig()===fileConfig ? '' : '<button class="linkbtn" id="lgCfg" style="font-size:13px;color:var(--muted)">Trocar projeto Firebase</button>')+'</div>';
  setBar('<button class="btn pri" id="lgGo">Entrar</button>');
  const err = m => { const e=$("#lgErr"); e.hidden=false; e.textContent=m; };
  const go_ = () => {
    const em=$("#lgEmail").value.trim(), pw=$("#lgPass").value;
    if(!em||!pw){ err("Informe e-mail e senha."); return; }
    $("#lgGo").disabled=true;
    signInWithEmailAndPassword(AUTH, em, pw).catch(e => { $("#lgGo").disabled=false; err("Não foi possível entrar: "+errMsg(e)+"."); });
  };
  $("#lgGo").onclick = go_;
  $("#lgPass").onkeydown = e => { if(e.key==="Enter") go_(); };
  $("#lgForgot").onclick = () => {
    const em=$("#lgEmail").value.trim(); if(!em){ err("Digite seu e-mail acima e toque de novo em Esqueci a senha."); return; }
    sendPasswordResetEmail(AUTH, em).then(() => toast("Enviamos um link para "+em), e => err("Não foi possível enviar: "+errMsg(e)));
  };
  if($("#lgCfg")) $("#lgCfg").onclick = () => confirmSheet("Trocar projeto Firebase?","Você vai colar uma nova configuração.","Trocar", () => { try{localStorage.removeItem(CFG_KEY)}catch(e){} location.reload(); });
}
function contaSheet(){
  const sc=document.createElement("div"); sc.className="scrim";
  sc.innerHTML='<div class="sheet" role="dialog" aria-label="Conta"><h3>Conta</h3><p>Conectado como <b>'+esc(S.user&&S.user.email)+'</b></p>'+
    '<button class="btn" id="ctDrive">'+ICON.cloudUp+'Google Drive'+(driveConfigurado()?' · ligado':'')+'</button>'+
    '<button class="btn" id="ctOut">Sair da conta</button><button class="btn ghost" id="ctNo">Fechar</button></div>';
  document.body.appendChild(sc);
  $("#ctDrive").onclick = () => { sc.remove(); S.voltarDe=S.screen; go("driveCfg"); };
  $("#ctOut").onclick = () => { sc.remove(); signOut(AUTH); };
  $("#ctNo").onclick = () => sc.remove(); sc.onclick = e => { if(e.target===sc) sc.remove(); };
}

/* ---------- GOOGLE DRIVE ---------- */
function driveConfigurado(){ return !!(S.cfg && S.cfg.driveUrl && S.cfg.driveToken); }
function novoToken(){ const a=new Uint8Array(18); crypto.getRandomValues(a); return Array.from(a,b=>b.toString(16).padStart(2,"0")).join(""); }
async function enviarPdfDrive(url, token, p){
  const corpo = JSON.stringify({ token, ...p });
  let txt;
  if(NATIVE){
    const r = await CapacitorHttp.post({ url, headers:{ "Content-Type":"text/plain;charset=utf-8" }, data:corpo, readTimeout:120000, connectTimeout:30000 });
    txt = typeof r.data === "string" ? r.data : JSON.stringify(r.data);
  } else {
    const r = await fetch(url, { method:"POST", headers:{ "Content-Type":"text/plain;charset=utf-8" }, body:corpo });
    txt = await r.text();
  }
  try{ return JSON.parse(txt); }catch(e){ return { ok:false, erro:"O endereço do script não respondeu como esperado. Confira se ele foi publicado com acesso \"Qualquer pessoa\"." }; }
}
async function pdfParaDrive(id){
  const d=diarioById(id); if(!d) return null;
  const o=obraById(d.obraId); if(!o) return null;
  const uri = await makePdf(d,o);
  return { obra:o.nome, data:d.data, arquivo:"Diario_"+slug(o.nome)+"_"+d.data+".pdf", base64:uri.split(",")[1] };
}
function enviarFilaDrive(avisar){
  if(!DB || !S.user || !driveConfigurado() || !S.online || !Drive.fila().length) { if(avisar && !S.online) toast("Sem internet. O diário vai para o Drive quando conectar."); return; }
  Drive.processar({
    config:{ url:S.cfg.driveUrl, token:S.cfg.driveToken },
    gerarPdf: pdfParaDrive,
    enviar: enviarPdfDrive,
    marcarEnviado: (id, url) => setDoc(doc(DB,"diarios",id), { driveEm:Date.now(), driveUrl:url||"" }, { merge:true }).catch(()=>{})
  }).then(r => {
    if(r.ok && avisar!==false) toast(r.ok===1 ? "Diário salvo no Google Drive" : r.ok+" diários salvos no Google Drive");
    if(r.erros.length && avisar) toast("Google Drive: "+r.erros[0].msg);
    if(S.screen==="view"||S.screen==="obra") render();
  });
}
function driveStatusHtml(d){
  if(d.status!=="final") return "";
  if(!driveConfigurado()) return '<div class="notice">Google Drive não configurado. Toque no ícone de conta, na tela inicial, para ligar a cópia automática.</div>';
  if(d.driveEm) return '<div class="sync ok">'+ICON.cloudOk+'Salvo no Google Drive em '+new Date(d.driveEm).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"})+'</div>';
  const naFila = Drive.fila().includes(d.id);
  return '<div class="sync pend">'+ICON.cloudUp+(naFila?'Aguardando envio ao Google Drive':'Ainda não enviado ao Google Drive')+'</div>'+
    '<button class="btn small" id="v_drive" style="align-self:flex-start">Enviar ao Drive agora</button>';
}
function rDriveCfg(){
  const c = S.cfg || {};
  S.tokenTmp = S.tokenTmp || c.driveToken || novoToken();
  setTop("Google Drive","Cópia automática dos diários", () => go(S.voltarDe||"home"));
  app.innerHTML =
    (driveConfigurado() ? '<div class="sync ok">'+ICON.cloudOk+'Ligado. Cada diário concluído vai para Meu Drive › Diário de Obra › nome da obra.</div>' :
      '<div class="notice">Faça uma vez só. Vale para todos os celulares que usam este app.</div>')+
    '<section class="box"><div class="box-h">1. Código de segurança</div><div class="box-b">'+
    '<p class="muted" style="margin:0;font-size:14px">Copie este código e cole no script do Google, na linha <b>const TOKEN</b>.</p>'+
    '<code class="cfg" id="dv_tok">'+esc(S.tokenTmp)+'</code>'+
    '<button class="btn small" id="dv_copy" style="align-self:flex-start">Copiar código</button></div></section>'+
    '<section class="box"><div class="box-h">2. Endereço do script</div><div class="box-b">'+
    '<p class="muted" style="margin:0;font-size:14px">Depois de publicar o script como <b>App da Web</b>, cole aqui o endereço que termina em <b>/exec</b>.</p>'+
    '<input class="inp mono" id="dv_url" style="font-size:13px" value="'+esc(c.driveUrl||"")+'" placeholder="https://script.google.com/macros/s/…/exec">'+
    '<div class="err" id="dv_err" hidden></div></div></section>'+
    (driveConfigurado() ? '<button class="btn danger" id="dv_off">Desligar cópia no Drive</button>' : '');
  $("#dv_copy").onclick = () => {
    const t=S.tokenTmp;
    if(navigator.clipboard) navigator.clipboard.writeText(t).then(()=>toast("Código copiado"), ()=>toast("Selecione o código e copie"));
  };
  if($("#dv_off")) $("#dv_off").onclick = () => confirmSheet("Desligar o Google Drive?","Os diários deixam de ser copiados. O que já está no Drive continua lá.","Desligar", () => {
    setDoc(doc(DB,"config","geral"), { driveUrl:"", driveToken:"" }, { merge:true }); S.cfg={...S.cfg, driveUrl:"", driveToken:""}; go(S.voltarDe||"home"); });
  setBar('<button class="btn" id="dv_test">Testar</button><button class="btn pri" id="dv_save">Salvar</button>');
  const ler = () => { const u=$("#dv_url").value.trim(); const e=$("#dv_err"); e.hidden=true;
    if(!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec/.test(u)){ e.hidden=false; e.textContent="O endereço precisa começar com https://script.google.com/macros/s/ e terminar em /exec."; return null; } return u; };
  const testar = async (u) => {
    if(!S.online){ toast("Sem internet para testar."); return false; }
    try{ const r = await enviarPdfDrive(u, S.tokenTmp, { teste:true });
      if(r.ok){ toast("Funcionou: o script respondeu e a pasta está pronta no Drive."); return true; }
      const e=$("#dv_err"); e.hidden=false; e.textContent="O script respondeu com erro: "+(r.erro||"desconhecido"); return false;
    }catch(err){ const e=$("#dv_err"); e.hidden=false; e.textContent="Não consegui falar com o script: "+errMsg(err); return false; }
  };
  $("#dv_test").onclick = async function(){ const u=ler(); if(!u) return; this.disabled=true; await testar(u); this.disabled=false; };
  $("#dv_save").onclick = async function(){
    const u=ler(); if(!u) return;
    this.disabled=true; const ok = await testar(u); this.disabled=false;
    if(!ok && S.online) return;
    setDoc(doc(DB,"config","geral"), { driveUrl:u, driveToken:S.tokenTmp }, { merge:true }).catch(e=>toast("Não foi possível salvar: "+errMsg(e)));
    S.cfg = { ...(S.cfg||{}), driveUrl:u, driveToken:S.tokenTmp }; S.tokenTmp=null;
    toast("Google Drive ligado"); go(S.voltarDe||"home");
  };
}

/* ---------- HOME: escolher obra ---------- */
function rHome(){
  setTop("Diário de Obra","Escolha a obra",null,'<button class="iconbtn" id="contaBtn" aria-label="Conta">'+ICON.user+'</button>');
  $("#contaBtn").onclick = contaSheet;
  let h = syncHtml() + '<div class="sec-t">Obras cadastradas</div>';
  S.obras.forEach(o => {
    const ds=diariosDa(o.id), ult=ds[0];
    h+='<button class="card" data-obra="'+esc(o.id)+'"><span class="ic">'+ICON.crane+'</span><span class="tx"><span class="t">'+esc(o.nome)+'</span>'+
      '<span class="m">'+ds.length+(ds.length===1?' diário':' diários')+(ult?' · último em <span class="mono">'+fmtData(ult.data)+'</span>':' · nenhum diário ainda')+'</span></span><span class="chev">'+ICON.chev+'</span></button>';
  });
  app.innerHTML = h;
  $$("[data-obra]").forEach(b => b.onclick = () => go("obra",{obraId:b.getAttribute("data-obra")}));
  setBar('<button class="btn" id="novaObra">'+ICON.plus+'Cadastrar obra</button>');
  $("#novaObra").onclick = () => { S.obraDraft=novaObra(); S.firstRun=false; go("obraForm"); };
}

/* ---------- CADASTRO DE OBRA ---------- */
function novaObra(){ return { id:uid("o_"), nome:"", endereco:"", contratante:"", construtora:"", mestre:"", engenheiro:"Rosmandi L. Tosati", empreiteiras:[], equipamentos:[], etapas:[], criadoEm:Date.now() }; }
function somaPesos(etapas){ return Math.round((etapas||[]).reduce((s,e)=>s+(+e.peso||0),0)*10)/10; }
function rObraForm(){
  const o=S.obraDraft, novo=!obraById(o.id);
  o.etapas = o.etapas || []; o.contratante = o.contratante || "";
  setTop(novo?"Cadastrar obra":"Editar obra", novo?"Dados fixos de todos os diários":o.nome,
    S.obras.length ? () => { S.obraDraft=null; go(novo?"home":"obra"); } : null,
    S.obras.length ? '' : '<button class="iconbtn" id="contaBtn" aria-label="Conta">'+ICON.user+'</button>');
  if($("#contaBtn")) $("#contaBtn").onclick = contaSheet;
  let h="";
  if(S.firstRun && novo){
    h+='<section class="hero"><div class="stripe"></div><div class="in"><h2>Primeiro uso: cadastre sua obra</h2>'+
      '<p>Preencha uma vez o cabeçalho do diário. Depois é só escolher a obra no menu e lançar o dia.</p>'+
      '<div class="steps"><span class="on">1 Cadastrar obra</span><span>2 Escolher obra</span><span>3 Diário + fotos</span></div></div></section>';
  }
  h+='<section class="box"><div class="box-h">Identificação</div><div class="box-b">'+
    '<label class="f">Nome da obra *<input class="inp" id="o_nome" value="'+esc(o.nome)+'" placeholder="Ex.: Residencial Grand Soleil" autocomplete="off"></label>'+
    '<label class="f">Endereço<input class="inp" id="o_endereco" value="'+esc(o.endereco)+'" placeholder="Rua, nº, bairro, cidade"></label>'+
    '<label class="f">Contratante<input class="inp" id="o_contratante" value="'+esc(o.contratante)+'" placeholder="Ex.: Condomínio Residencial Viva Vida Itajaí"></label>'+
    '<label class="f">Construtora<input class="inp" id="o_construtora" value="'+esc(o.construtora)+'" placeholder="Ex.: Vigo Construtora"></label>'+
    '<div class="row2"><label class="f">Mestre de obras<input class="inp" id="o_mestre" value="'+esc(o.mestre)+'"></label>'+
    '<label class="f">Eng. responsável<input class="inp" id="o_engenheiro" value="'+esc(o.engenheiro)+'"></label></div></div></section>';
  h+='<section class="box" id="secEtapas"><div class="box-h">Etapas da obra<span class="req" id="o_soma"></span></div><div class="box-b">'+
    '<p class="muted" style="margin:0;font-size:14px">Cada etapa tem um peso no total da obra e datas previstas. No diário você informa o % concluído de cada uma, e o relatório compara o previsto com o realizado.</p>'+
    '<div id="o_etps" style="display:flex;flex-direction:column;gap:12px"></div>'+
    '<button class="btn small ghost" id="o_addEtp">'+ICON.plus+'Adicionar etapa</button></div></section>';
  h+='<section class="box"><div class="box-h">Empreiteiras da obra</div><div class="box-b"><p class="muted" style="margin:0;font-size:14px">Já aparecem preenchidas em cada diário novo. Só falta o nº de funcionários do dia.</p><div id="o_emps" style="display:flex;flex-direction:column;gap:8px"></div>'+
    '<button class="btn small ghost" id="o_addEmp">'+ICON.plus+'Adicionar empreiteira</button></div></section>';
  h+='<section class="box"><div class="box-h">Equipamentos habituais</div><div class="box-b"><div id="o_eqs" style="display:flex;flex-direction:column;gap:8px"></div>'+
    '<button class="btn small ghost" id="o_addEq">'+ICON.plus+'Adicionar equipamento</button></div></section>';
  if(!novo) h+='<button class="btn danger" id="o_del">Excluir obra e seus diários</button>';
  h+='<div class="err" id="o_err" hidden></div>';
  app.innerHTML=h;
  ["nome","endereco","contratante","construtora","mestre","engenheiro"].forEach(k => $("#o_"+k).oninput = e => { o[k]=e.target.value; });
  function updSoma(){
    const s=somaPesos(o.etapas), el=$("#o_soma"); if(!el) return;
    el.textContent = o.etapas.length ? "Soma dos pesos: "+String(s).replace(".",",")+"%" : "";
    el.className = "req"+(o.etapas.length && Math.abs(s-100)<0.05 ? " ok" : "");
  }
  function drawEtapas(){
    const box=$("#o_etps");
    box.innerHTML = o.etapas.map((e,i) =>
      '<div class="etp"><div class="etp-top"><span class="etp-n mono">'+(i+1)+'</span><input class="inp" data-k="nome" data-i="'+i+'" value="'+esc(e.nome)+'" placeholder="Ex.: Rampa Bloco '+(i+1)+'"><button class="xbtn" data-rm="'+i+'" aria-label="Remover etapa">'+ICON.x+'</button></div>'+
      '<div class="etp-row"><label class="f">Peso %<input class="inp mono" data-k="peso" data-i="'+i+'" value="'+esc(e.peso)+'" inputmode="decimal" placeholder="0"></label>'+
      '<label class="f">Início previsto<input type="date" class="inp mono" data-k="inicio" data-i="'+i+'" value="'+esc(e.inicio)+'"></label>'+
      '<label class="f">Fim previsto<input type="date" class="inp mono" data-k="fim" data-i="'+i+'" value="'+esc(e.fim)+'"></label></div></div>'
    ).join("") || '<div class="muted" style="font-size:14px">Nenhuma etapa. Sem etapas, o diário não registra andamento.</div>';
    $$("[data-k]",box).forEach(inp => inp.oninput = () => {
      const e=o.etapas[+inp.getAttribute("data-i")], k=inp.getAttribute("data-k");
      e[k] = k==="peso" ? inp.value.replace(",",".").replace(/[^\d.]/g,"") : inp.value;
      if(k==="peso"){ inp.value=e[k]; updSoma(); }
    });
    $$("[data-rm]",box).forEach(b => b.onclick = () => { o.etapas.splice(+b.getAttribute("data-rm"),1); drawEtapas(); });
    updSoma();
  }
  drawEtapas();
  $("#o_addEtp").onclick = () => { o.etapas.push({ id:uid("e_"), nome:"", peso:"", inicio:"", fim:"" }); drawEtapas(); const l=$$('#o_etps [data-k="nome"]'); l[l.length-1].focus(); };
  function listUI(box, arr, ph, isEmp){
    function draw(){
      box.innerHTML = arr.map((v,i) => '<div class="erow"><input class="inp" value="'+esc(isEmp?v.nome:v)+'" placeholder="'+ph+'"><button class="xbtn" data-i="'+i+'" aria-label="Remover">'+ICON.x+'</button></div>').join("") || '<div class="muted" style="font-size:14px">Nenhum item.</div>';
      $$("input",box).forEach((inp,i) => inp.oninput = () => { if(isEmp) arr[i].nome=inp.value; else arr[i]=inp.value; });
      $$(".xbtn",box).forEach(b => b.onclick = () => { arr.splice(+b.getAttribute("data-i"),1); draw(); });
    }
    draw(); return draw;
  }
  const drawE=listUI($("#o_emps"),o.empreiteiras,"Nome da empreiteira",true);
  const drawQ=listUI($("#o_eqs"),o.equipamentos,"Ex.: Betoneira 400L",false);
  $("#o_addEmp").onclick = () => { o.empreiteiras.push({nome:""}); drawE(); const l=$$("#o_emps input"); l[l.length-1].focus(); };
  $("#o_addEq").onclick = () => { o.equipamentos.push(""); drawQ(); const l=$$("#o_eqs input"); l[l.length-1].focus(); };
  if(!novo) $("#o_del").onclick = () => confirmSheet("Excluir "+o.nome+"?","A obra e todos os "+diariosDa(o.id).length+" diários dela serão apagados para todos. Isso não pode ser desfeito.","Excluir obra", () => { Store.delObra(obraById(o.id)); S.obraDraft=null; go("home"); });
  setBar('<button class="btn pri" id="o_save">'+(novo?"Salvar e continuar":"Salvar alterações")+'</button>');
  $("#o_save").onclick = () => {
    o.nome=o.nome.trim();
    if(!o.nome){ const e=$("#o_err"); e.hidden=false; e.textContent="Informe o nome da obra."; $("#o_nome").focus(); return; }
    o.empreiteiras=o.empreiteiras.filter(x=>x.nome.trim());
    o.equipamentos=o.equipamentos.map(x=>x.trim()).filter(Boolean);
    o.etapas=o.etapas.filter(x=>(x.nome||"").trim()).map(x=>({ id:x.id, nome:x.nome.trim(), peso:+x.peso||0, inicio:x.inicio||"", fim:x.fim||"" }));
    const ruim=o.etapas.find(x=>x.inicio&&x.fim&&x.fim<x.inicio);
    if(ruim){ const e=$("#o_err"); e.hidden=false; e.textContent="A etapa \""+ruim.nome+"\" termina antes de começar. Corrija as datas."; return; }
    const sp=somaPesos(o.etapas);
    if(o.etapas.length && Math.abs(sp-100)>=0.05) toast("Pesos somam "+String(sp).replace(".",",")+"%. O app ajusta proporcionalmente para 100%.");
    const saved=clone(o);
    Store.saveObra(saved, novo?"Obra cadastrada":"Obra atualizada");
    S.obraDraft=null; S.firstRun=false; go("obra",{obraId:saved.id});
  };
}

/* ---------- OBRA: lista de diários ---------- */
function rObra(){
  const o=obraById(S.obraId); if(!o){ go("home"); return; }
  setTop(o.nome, o.endereco||"Diários da obra", () => go("home"));
  const ds=diariosDa(o.id);
  let h=syncHtml();
  h+='<section class="box"><div class="box-b"><dl class="kv">'+
    '<dt>Mestre</dt><dd>'+esc(o.mestre||"—")+'</dd><dt>Eng. resp.</dt><dd>'+esc(o.engenheiro||"—")+'</dd>'+
    (o.construtora?'<dt>Construtora</dt><dd>'+esc(o.construtora)+'</dd>':'')+
    ((o.etapas||[]).length ? '<dt>Andamento</dt><dd><b class="mono">'+fmtPct(ds.length?pctGeral(o.etapas,ds[0].andamento):0)+'</b> concluído</dd>' : '')+
    '</dl>'+((o.etapas||[]).length ? barraPct(ds.length?pctGeral(o.etapas,ds[0].andamento):0) : '<div class="notice">Cadastre as etapas da obra para acompanhar o andamento físico.</div>')+
    '<button class="btn small ghost" id="editObra" style="align-self:flex-start">'+ICON.edit+'Editar dados da obra</button></div></section>';
  h+='<div class="sec-t">Diários</div>';
  if(!ds.length) h+='<div class="empty"><h2>Nenhum diário ainda</h2><p>Toque em <b>Novo diário</b> para registrar o dia com clima, efetivo, serviços e fotos.</p></div>';
  ds.forEach(d => {
    const nf=(d.fotos||[]).length, ef=(d.empreiteiras||[]).reduce((s,e)=>s+(+e.func||0),0);
    h+='<button class="card" data-d="'+esc(d.id)+'"><span class="ic">'+ICON.doc+'</span><span class="tx"><span class="t mono" style="font-size:18px">'+fmtData(d.data)+' <span class="muted" style="font-family:var(--f-body);font-size:14px;font-weight:500">'+diaSemana(d.data)+'</span></span>'+
      '<span class="m">'+(d.status==="final"?'<span class="pill ok">Concluído</span>':'<span class="pill draft">Rascunho</span>')+' · '+ef+' func. · '+nf+' foto'+(nf===1?'':'s')+((o.etapas||[]).length&&d.andamento?' · '+fmtPct(pctGeral(o.etapas,d.andamento)):'')+(d.driveEm?' · Drive ✓':'')+'</span></span><span class="chev">'+ICON.chev+'</span></button>';
  });
  app.innerHTML=h;
  $("#editObra").onclick = () => { S.obraDraft=clone(o); S.firstRun=false; go("obraForm"); };
  $$("[data-d]").forEach(b => b.onclick = () => go("view",{diarioId:b.getAttribute("data-d")}));
  setBar('<button class="btn pri" id="novoD">'+ICON.plus+'Novo diário</button>');
  $("#novoD").onclick = () => {
    const dt=hoje(), ex=ds.find(d=>d.data===dt);
    if(ex){ confirmSheet("Já existe um diário de hoje","Você pode abrir o diário de "+fmtData(dt)+" para editar ou criar outro.","Abrir o de hoje", () => openEditor(ex), "Criar outro", () => { S.draft=novoDiario(o); go("editor"); }); return; }
    S.draft=novoDiario(o); go("editor");
  };
}
const fmtPct = n => String(Math.round((+n||0)*10)/10).replace(".",",")+"%";
const barraPct = n => '<div class="pbar" role="img" aria-label="'+fmtPct(n)+' concluído"><span style="width:'+Math.min(100,Math.max(0,+n||0))+'%"></span></div>';
function novoDiario(o){
  return { id:uid("d_"), obraId:o.id, data:hoje(), mestre:o.mestre||"", engenheiro:o.engenheiro||"",
    andamento: andamentoInicial(o.etapas||[], diariosDa(o.id), hoje()),
    clima:{manha:"",tarde:""}, empreiteiras:(o.empreiteiras||[]).map(e=>({nome:e.nome,func:""})),
    acidente:"", acidenteDesc:"", epi:"", equipamentos:(o.equipamentos||[]).slice(),
    servicos:"", assinaturaServicos:o.mestre||"", observacoes:"", assinaturaObs:o.engenheiro||"",
    fotos:[], status:"rascunho", criadoEm:Date.now(), atualizadoEm:Date.now(), criadoPor:(S.user&&S.user.email)||"" };
}
function openEditor(d){
  const dr = clone(d);
  const ob = obraById(d.obraId);
  if(ob && (ob.etapas||[]).length){
    const base = andamentoInicial(ob.etapas, diariosDa(ob.id).filter(x=>x.id!==d.id), d.data);
    dr.andamento = Object.assign(base, dr.andamento||{});
  }
  dr.fotos =(dr.fotos||[]).map(f => ({ id:f.id, legenda:f.legenda||"", url:fotoCache.get(f.id)||"", salva:true }));
  S.draft = dr; go("editor");
  dr.fotos.forEach(f => { if(!f.url) loadFoto(f.id).then(u => { f.url = u || "erro"; if(S.screen==="editor" && S.draft===dr) keepScroll(rEditor); }); });
}

/* ---------- EDITOR DO DIÁRIO ---------- */
function rEditor(){
  const d=S.draft, o=obraById(d.obraId); if(!o){ go("home"); return; }
  const novo=!diarioById(d.id);
  setTop(novo?"Novo diário":"Editar diário", o.nome, () => confirmSheet("Sair sem salvar?","As alterações deste diário serão perdidas.","Sair sem salvar", () => { S.draft=null; go(novo?"obra":"view"); }));
  const nv=fotosValidas(d);
  let h="";
  h+='<section class="box"><div class="box-h">Cabeçalho</div><div class="box-b">'+
    '<label class="f">Data<input type="date" class="inp mono" id="d_data" value="'+esc(d.data)+'"></label>'+
    '<div class="row2"><label class="f">Mestre<input class="inp" id="d_mestre" value="'+esc(d.mestre)+'"></label>'+
    '<label class="f">Eng. responsável<input class="inp" id="d_engenheiro" value="'+esc(d.engenheiro)+'"></label></div></div></section>';
  h+='<section class="box"><div class="box-h">Condições climáticas</div><div class="box-b"><div class="clima">';
  [["manha","Manhã"],["tarde","Tarde"]].forEach(p => {
    h+='<span class="lb">'+p[1]+'</span>';
    [["S","sun"],["I","cloud"],["C","rain"]].forEach(c => { h+='<button class="seg" data-cl="'+p[0]+'" data-v="'+c[0]+'" aria-pressed="'+(d.clima[p[0]]===c[0])+'">'+ICON[c[1]]+CLIMA[c[0]]+'</button>'; });
  });
  h+='</div></div></section>';
  const tot=d.empreiteiras.reduce((s,e)=>s+(+e.func||0),0);
  h+='<section class="box"><div class="box-h">Empreiteiras e efetivo</div><div class="box-b">'+
    '<div class="thead"><span>Empreiteira</span><span>Nº func.</span><span></span></div><div style="display:flex;flex-direction:column;gap:8px">';
  d.empreiteiras.forEach((e,i) => { h+='<div class="trow"><input class="inp" data-en="'+i+'" value="'+esc(e.nome)+'" placeholder="Empreiteira"><input class="inp mono" data-ef="'+i+'" value="'+esc(e.func)+'" inputmode="numeric" pattern="[0-9]*" placeholder="0"><button class="xbtn" data-er="'+i+'" aria-label="Remover">'+ICON.x+'</button></div>'; });
  h+='</div><div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><button class="btn small ghost" id="d_addEmp">'+ICON.plus+'Empreiteira</button><span class="total">Total: <b class="mono" id="d_tot">'+tot+'</b> funcionários</span></div></div></section>';
  h+='<section class="box"><div class="box-h">Segurança</div><div class="box-b">'+
    '<div class="qrow"><span class="q">Acidente de trabalho</span><div class="chips">'+
      '<button class="chip no" data-ac="nao" aria-pressed="'+(d.acidente==="nao")+'">Não houve</button>'+
      '<button class="chip yes" data-ac="sim" aria-pressed="'+(d.acidente==="sim")+'">Houve acidente</button></div>'+
      (d.acidente==="sim"?'<textarea class="inp" id="d_acDesc" style="min-height:80px" placeholder="Descreva o que aconteceu, quem e providências">'+esc(d.acidenteDesc)+'</textarea>':'')+'</div>'+
    '<div class="qrow"><span class="q">Uso de EPI’s</span><div class="chips">'+
      '<button class="chip no" data-epi="sim" aria-pressed="'+(d.epi==="sim")+'">Todos usando</button>'+
      '<button class="chip mid" data-epi="parcial" aria-pressed="'+(d.epi==="parcial")+'">Parcial</button>'+
      '<button class="chip yes" data-epi="nao" aria-pressed="'+(d.epi==="nao")+'">Não usando</button></div></div></div></section>';
  h+='<section class="box"><div class="box-h">Equipamentos</div><div class="box-b"><div style="display:flex;flex-direction:column;gap:8px">';
  d.equipamentos.forEach((e,i) => { h+='<div class="erow"><input class="inp" data-eq="'+i+'" value="'+esc(e)+'" placeholder="Equipamento"><button class="xbtn" data-eqr="'+i+'" aria-label="Remover">'+ICON.x+'</button></div>'; });
  h+='</div><button class="btn small ghost" id="d_addEq" style="align-self:flex-start">'+ICON.plus+'Equipamento</button></div></section>';
  h+=andamentoEditorHtml(d,o);
  h+='<section class="box"><div class="box-h">Serviços e/ou atividades executados</div><div class="box-b">'+
    '<textarea class="inp" id="d_servicos" placeholder="Ex.: Concretagem da laje do 3º pavimento; alvenaria bloco 14 no 2º pav., eixo A-C…">'+esc(d.servicos)+'</textarea>'+
    '<label class="f">Assinatura (responsável)<input class="inp" id="d_assS" value="'+esc(d.assinaturaServicos)+'"></label></div></section>';
  h+='<section class="box"><div class="box-h">Observações (Engenharia e Diretoria)</div><div class="box-b">'+
    '<textarea class="inp" id="d_obs" style="min-height:100px" placeholder="Pendências, ocorrências, visitas, solicitações…">'+esc(d.observacoes)+'</textarea>'+
    '<label class="f">Assinatura (responsável)<input class="inp" id="d_assO" value="'+esc(d.assinaturaObs)+'"></label></div></section>';
  h+='<section class="box" id="secFotos"><div class="box-h">Registro fotográfico<span class="req'+(nv>=MIN_FOTOS?' ok':'')+'">'+nv+' de '+MIN_FOTOS+' com legenda</span></div><div class="box-b">';
  h+='<div class="slots">'; for(let s=0;s<MIN_FOTOS;s++){ const f=d.fotos[s], ok=fotoOk(f); h+='<div class="slot'+(ok?' done':'')+'">'+(ok?'Foto '+(s+1)+' ✓':'Foto '+(s+1))+'</div>'; } h+='</div>';
  h+='<div class="fotos">';
  d.fotos.forEach((f,i) => {
    const im = f.url && f.url!=="erro" ? '<img src="'+esc(f.url)+'" alt="Foto '+(i+1)+'">' :
      (f.url==="erro" ? '<span class="busy">Foto indisponível sem internet</span>' : '<span class="busy"><span class="spin" style="display:inline-block;vertical-align:middle;margin-right:6px"></span>Carregando foto…</span>');
    h+='<div class="foto"><div class="img">'+im+'<span class="n">'+(i+1)+'</span><button class="xbtn rm" data-fr="'+i+'" aria-label="Remover foto '+(i+1)+'">'+ICON.x+'</button></div>'+
      '<div class="cap"><input class="inp" data-fl="'+i+'" value="'+esc(f.legenda)+'" placeholder="Legenda da foto '+(i+1)+' (obrigatória)"></div></div>';
  });
  h+='</div><div class="addph"><button class="btn pri" id="d_cam">'+ICON.cam+'Tirar foto</button><button class="btn" id="d_gal">'+ICON.gal+'Da galeria</button></div>'+
    '<p class="muted" style="margin:0;font-size:13px">Mínimo de '+MIN_FOTOS+' fotos, cada uma com legenda, para concluir o diário.</p></div></section>';
  h+='<div class="err" id="d_err" hidden></div>';
  app.innerHTML=h;

  const bindVal = (id,key) => { const el=$("#"+id); if(el) el.oninput = () => { d[key]=el.value; }; };
  bindVal("d_data","data"); bindVal("d_mestre","mestre"); bindVal("d_engenheiro","engenheiro"); bindVal("d_servicos","servicos");
  bindVal("d_obs","observacoes"); bindVal("d_assS","assinaturaServicos"); bindVal("d_assO","assinaturaObs"); bindVal("d_acDesc","acidenteDesc");
  $$("[data-cl]").forEach(b => b.onclick = () => { const p=b.getAttribute("data-cl"), v=b.getAttribute("data-v"); d.clima[p] = d.clima[p]===v ? "" : v;
    $$('[data-cl="'+p+'"]').forEach(x => x.setAttribute("aria-pressed", String(d.clima[p]===x.getAttribute("data-v")))); });
  $$("[data-en]").forEach(el => el.oninput = () => { d.empreiteiras[+el.getAttribute("data-en")].nome=el.value; });
  $$("[data-ef]").forEach(el => el.oninput = () => { el.value=el.value.replace(/\D/g,""); d.empreiteiras[+el.getAttribute("data-ef")].func=el.value;
    $("#d_tot").textContent=d.empreiteiras.reduce((s,e)=>s+(+e.func||0),0); });
  $$("[data-er]").forEach(b => b.onclick = () => { d.empreiteiras.splice(+b.getAttribute("data-er"),1); keepScroll(rEditor); });
  $("#d_addEmp").onclick = () => { d.empreiteiras.push({nome:"",func:""}); keepScroll(rEditor); const l=$$("[data-en]"); l[l.length-1].focus(); };
  $$("[data-ac]").forEach(b => b.onclick = () => { d.acidente=b.getAttribute("data-ac"); keepScroll(rEditor); });
  $$("[data-epi]").forEach(b => b.onclick = () => { d.epi=b.getAttribute("data-epi"); $$("[data-epi]").forEach(x => x.setAttribute("aria-pressed", String(x===b))); });
  $$("[data-eq]").forEach(el => el.oninput = () => { d.equipamentos[+el.getAttribute("data-eq")]=el.value; });
  $$("[data-eqr]").forEach(b => b.onclick = () => { d.equipamentos.splice(+b.getAttribute("data-eqr"),1); keepScroll(rEditor); });
  $("#d_addEq").onclick = () => { d.equipamentos.push(""); keepScroll(rEditor); const l=$$("[data-eq]"); l[l.length-1].focus(); };
  $$("[data-fl]").forEach(el => el.oninput = () => { d.fotos[+el.getAttribute("data-fl")].legenda=el.value; updFotoCount(); });
  $$("[data-fr]").forEach(b => b.onclick = () => { const i=+b.getAttribute("data-fr");
    confirmSheet("Remover foto "+(i+1)+"?","A foto e a legenda saem deste diário quando você salvar.","Remover", () => { d.fotos.splice(i,1); keepScroll(rEditor); }); });
  $("#d_cam").onclick = tirarFoto;
  $("#d_gal").onclick = daGaleria;
  bindAndamento(d,o);
  setBar('<button class="btn" id="d_draft">Salvar rascunho</button><button class="btn pri" id="d_fin">Concluir diário</button>');
  $("#d_draft").onclick = () => salvar("rascunho");
  $("#d_fin").onclick = () => salvar("final");
}
/* ---------- andamento físico no diário ---------- */
function anteriorDe(d,o){
  return andamentoInicial(o.etapas||[], diariosDa(o.id).filter(x=>x.id!==d.id && x.data<d.data), d.data);
}
function andamentoEditorHtml(d,o){
  const et=o.etapas||[];
  if(!et.length) return '<section class="box"><div class="box-h">Andamento físico</div><div class="box-b">'+
    '<div class="notice">Esta obra ainda não tem etapas cadastradas, então o andamento não é registrado.</div>'+
    '<button class="btn small" id="d_cadEtapas" style="align-self:flex-start">'+ICON.edit+'Cadastrar etapas</button></div></section>';
  d.andamento = d.andamento || {};
  const pesos=pesosNormalizados(et), ant=anteriorDe(d,o);
  let h='<section class="box" id="secAnd"><div class="box-h">Andamento físico<span class="req mono" id="d_pg">'+fmtPct(pctGeral(et,d.andamento))+' geral</span></div><div class="box-b">'+
    '<p class="muted" style="margin:0;font-size:14px">% concluído <b>acumulado</b> de cada etapa até hoje. Já vem com os valores do diário anterior.</p>';
  et.forEach((e,i) => {
    const v=+d.andamento[e.id]||0;
    h+='<div class="and"><div class="and-top"><span class="and-nome">'+esc(e.nome)+'</span><span class="muted mono" style="font-size:12px">peso '+fmtPct(pesos.get(e.id)*100)+'</span></div>'+
      '<div class="and-row"><input type="range" min="0" max="100" step="5" value="'+v+'" data-ar="'+esc(e.id)+'" aria-label="% concluído de '+esc(e.nome)+'">'+
      '<input class="inp mono and-num" data-an="'+esc(e.id)+'" value="'+v+'" inputmode="numeric" aria-label="% concluído de '+esc(e.nome)+'"><span class="muted">%</span></div>'+
      '<div class="and-warn err" data-aw="'+esc(e.id)+'"'+(v<(ant[e.id]||0)?'':' hidden')+'>Menor que no diário anterior ('+fmtPct(ant[e.id]||0)+'). Confira se está certo.</div></div>';
  });
  return h+'</div></section>';
}
function bindAndamento(d,o){
  if($("#d_cadEtapas")) $("#d_cadEtapas").onclick = () => confirmSheet("Sair do diário para cadastrar etapas?","As alterações ainda não salvas deste diário serão perdidas.","Cadastrar etapas", () => { S.draft=null; S.obraDraft=clone(o); S.firstRun=false; go("obraForm"); });
  const et=o.etapas||[]; if(!et.length) return;
  const ant=anteriorDe(d,o);
  const set = (id,val) => {
    val=Math.max(0,Math.min(100,Math.round(+val||0))); d.andamento[id]=val;
    const r=$('[data-ar="'+id+'"]'), n=$('[data-an="'+id+'"]'), w=$('[data-aw="'+id+'"]');
    if(r && +r.value!==val) r.value=val;
    if(n && document.activeElement!==n) n.value=val;
    if(w) w.hidden = !(val < (ant[id]||0));
    $("#d_pg").textContent = fmtPct(pctGeral(et,d.andamento))+" geral";
  };
  $$("[data-ar]").forEach(r => r.oninput = () => set(r.getAttribute("data-ar"), r.value));
  $$("[data-an]").forEach(n => {
    n.oninput = () => { n.value=n.value.replace(/\D/g,"").slice(0,3); set(n.getAttribute("data-an"), n.value); };
    n.onblur = () => { n.value = d.andamento[n.getAttribute("data-an")]||0; };
  });
}

const fotoOk = f => f && f.url && f.url!=="erro" && (f.legenda||"").trim();
function fotosValidas(d){ return (d.fotos||[]).filter(fotoOk).length; }
function updFotoCount(){
  const d=S.draft, n=fotosValidas(d), r=$("#secFotos .req");
  if(r){ r.textContent=n+" de "+MIN_FOTOS+" com legenda"; r.className="req"+(n>=MIN_FOTOS?" ok":""); }
  $$("#secFotos .slot").forEach((s,i) => { const ok=fotoOk(d.fotos[i]); s.className="slot"+(ok?" done":""); s.textContent=ok?"Foto "+(i+1)+" ✓":"Foto "+(i+1); });
}
function keepScroll(fn){ const y=window.scrollY; fn(); window.scrollTo(0,y); }

function salvar(status){
  const d=S.draft, err=$("#d_err"); err.hidden=true;
  if(d.fotos.some(f => !f.url)){ toast("Aguarde as fotos terminarem de carregar."); return; }
  if(!d.data){ err.hidden=false; err.textContent="Informe a data do diário."; $("#d_data").focus(); return; }
  if(status==="final"){
    const faltas=[];
    if(!d.clima.manha||!d.clima.tarde) faltas.push("clima da manhã e da tarde");
    if(!d.acidente) faltas.push("acidente de trabalho");
    if(!d.epi) faltas.push("uso de EPI’s");
    if(!d.servicos.trim()) faltas.push("serviços executados");
    const nf=fotosValidas(d); if(nf<MIN_FOTOS) faltas.push((MIN_FOTOS-nf)+" foto(s) com legenda");
    if(faltas.length){ err.hidden=false; err.textContent="Para concluir, falta: "+faltas.join(", ")+". Ou salve como rascunho."; err.scrollIntoView({behavior:"smooth",block:"center"}); return; }
  }
  const antigo = diarioById(d.id);
  const idsAntigos = new Set((antigo&&antigo.fotos||[]).map(f=>f.id));
  const idsAgora = new Set(d.fotos.map(f=>f.id));
  const novas = d.fotos.filter(f => !f.salva && f.url && f.url!=="erro");
  const removidas = [...idsAntigos].filter(id => !idsAgora.has(id));
  novas.forEach(f => fotoCache.set(f.id, f.url));
  const saved = {
    ...d, status, atualizadoEm:Date.now(), atualizadoPor:(S.user&&S.user.email)||"",
    empreiteiras: d.empreiteiras.filter(e => (e.nome||"").trim() || e.func),
    equipamentos: d.equipamentos.map(x=>(x||"").trim()).filter(Boolean),
    fotos: d.fotos.filter(f => f.url!=="erro" || f.salva).map(f => ({ id:f.id, legenda:(f.legenda||"").trim() })),
    driveEm: null
  };
  const ob = obraById(d.obraId);
  if(ob && (ob.etapas||[]).length){
    const a={}; ob.etapas.forEach(e => { a[e.id]=Math.max(0,Math.min(100,+((d.andamento||{})[e.id])||0)); }); saved.andamento=a;
  }
  Store.saveDiario(saved, novas, removidas, status==="final" ? "Diário concluído" : "Rascunho salvo");
  if(status==="final" && driveConfigurado()){ Drive.enfileirar(saved.id); setTimeout(enviarFilaDrive, 300); }
  S.draft=null; go("view",{diarioId:saved.id});
}

/* ---------- fotos: câmera nativa, compressão ---------- */
function compressSrc(src){
  return new Promise((res,rej) => {
    const img=new Image();
    img.onload = () => {
      let side=1280, q=0.72, out="";
      for(let tries=0; tries<5; tries++){
        const k=Math.min(1, side/Math.max(img.naturalWidth,img.naturalHeight));
        const c=document.createElement("canvas"); c.width=Math.round(img.naturalWidth*k); c.height=Math.round(img.naturalHeight*k);
        c.getContext("2d").drawImage(img,0,0,c.width,c.height);
        out=c.toDataURL("image/jpeg",q);
        if(out.length < 700000) break; // cabe com folga no limite de 1 MB do Firestore
        side=Math.round(side*0.85); q=Math.max(0.5,q-0.06);
      }
      res(out);
    };
    img.onerror = () => rej(new Error("Imagem inválida"));
    img.src=src;
  });
}
function addFoto(srcPromise){
  const d=S.draft; if(!d) return;
  const f={ id:uid("f_"), legenda:"", url:"" }; d.fotos.push(f); keepScroll(rEditor);
  srcPromise.then(src => compressSrc(src)).then(u => { f.url=u; })
    .catch(e => { const i=d.fotos.indexOf(f); if(i>=0) d.fotos.splice(i,1); if(!/cancel/i.test(e&&e.message||"")) toast("Não foi possível usar a foto: "+errMsg(e)); })
    .then(() => { if(S.screen==="editor" && S.draft===d){ keepScroll(rEditor); const l=$$("[data-fl]"); const inp=l[d.fotos.indexOf(f)]; if(inp && f.url){ inp.scrollIntoView({block:"center"}); } } });
}
function fileToDataUrl(file){ return new Promise((res,rej) => { const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=()=>rej(r.error); r.readAsDataURL(file); }); }
function tirarFoto(){
  if(!NATIVE){ $("#camIn").value=""; $("#camIn").click(); return; }
  Camera.getPhoto({ source:CameraSource.Camera, resultType:CameraResultType.DataUrl, quality:85, width:1600, correctOrientation:true, saveToGallery:true })
    .then(p => addFoto(Promise.resolve(p.dataUrl)))
    .catch(e => { if(!/cancel/i.test(e&&e.message||"")) toast("Câmera indisponível: "+errMsg(e)); });
}
function daGaleria(){
  if(!NATIVE){ $("#galIn").value=""; $("#galIn").click(); return; }
  Camera.pickImages({ quality:85, width:1600, limit:10, correctOrientation:true })
    .then(r => (r.photos||[]).forEach(p => addFoto(fetch(p.webPath).then(x=>x.blob()).then(fileToDataUrl))))
    .catch(e => { if(!/cancel/i.test(e&&e.message||"")) toast("Galeria indisponível: "+errMsg(e)); });
}
$("#camIn").onchange = e => Array.from(e.target.files||[]).forEach(f => addFoto(fileToDataUrl(f)));
$("#galIn").onchange = e => Array.from(e.target.files||[]).forEach(f => addFoto(fileToDataUrl(f)));

/* ---------- VISUALIZAÇÃO ---------- */
function rView(){
  const d=diarioById(S.diarioId); if(!d){ go("obra"); return; }
  const o=obraById(d.obraId)||{nome:"Obra"};
  setTop("Diário "+fmtData(d.data), o.nome, () => go("obra",{obraId:d.obraId}));
  const tot=(d.empreiteiras||[]).reduce((s,e)=>s+(+e.func||0),0);
  const epiTx={sim:"Todos usando",parcial:"Uso parcial",nao:"Não usando"}[d.epi]||"—";
  const acTx={nao:"Não houve",sim:"Houve acidente"}[d.acidente]||"—";
  let h=syncHtml();
  h+='<section class="box"><div class="box-h">'+(d.status==="final"?'<span class="pill ok">Concluído</span>':'<span class="pill draft">Rascunho</span>')+'<span class="req mono">'+fmtData(d.data)+' · '+diaSemana(d.data)+'</span></div><div class="box-b"><dl class="kv">'+
    '<dt>Obra</dt><dd>'+esc(o.nome)+'</dd><dt>Mestre</dt><dd>'+esc(d.mestre||"—")+'</dd><dt>Eng. resp.</dt><dd>'+esc(d.engenheiro||"—")+'</dd>'+
    '<dt>Manhã</dt><dd>'+(CLIMA[d.clima&&d.clima.manha]||"—")+'</dd><dt>Tarde</dt><dd>'+(CLIMA[d.clima&&d.clima.tarde]||"—")+'</dd>'+
    '<dt>Acidente</dt><dd>'+acTx+'</dd>'+(d.acidente==="sim"&&d.acidenteDesc?'<dt></dt><dd class="ptext">'+esc(d.acidenteDesc)+'</dd>':'')+
    '<dt>EPI’s</dt><dd>'+epiTx+'</dd>'+(d.atualizadoPor?'<dt>Lançado por</dt><dd>'+esc(d.atualizadoPor)+'</dd>':'')+'</dl></div></section>';
  h+='<section class="box"><div class="box-h">Empreiteiras<span class="req mono">'+tot+' func.</span></div><div class="box-b">'+
    ((d.empreiteiras||[]).length?'<table class="vtable"><tbody>'+d.empreiteiras.map(e=>'<tr><td>'+esc(e.nome||"—")+'</td><td>'+esc(e.func||"0")+'</td></tr>').join("")+'</tbody></table>':'<span class="muted">Nenhuma informada.</span>')+'</div></section>';
  h+='<section class="box"><div class="box-h">Equipamentos</div><div class="box-b">'+((d.equipamentos||[]).length?esc(d.equipamentos.join(" · ")):'<span class="muted">Nenhum informado.</span>')+'</div></section>';
  if((o.etapas||[]).length && d.andamento){
    const pg=pctGeral(o.etapas,d.andamento);
    h+='<section class="box"><div class="box-h">Andamento físico<span class="req mono">'+fmtPct(pg)+' geral</span></div><div class="box-b">'+barraPct(pg)+
      '<table class="vtable"><tbody>'+o.etapas.map(e=>'<tr><td>'+esc(e.nome)+'</td><td>'+fmtPct(d.andamento[e.id]||0)+'</td></tr>').join("")+'</tbody></table></div></section>';
  }
  h+='<section class="box"><div class="box-h">Serviços executados</div><div class="box-b"><p class="ptext">'+(esc(d.servicos)||'<span class="muted">—</span>')+'</p><div class="muted" style="font-size:13px">Assinatura: '+esc(d.assinaturaServicos||"—")+'</div></div></section>';
  h+='<section class="box"><div class="box-h">Observações</div><div class="box-b"><p class="ptext">'+(esc(d.observacoes)||'<span class="muted">—</span>')+'</p><div class="muted" style="font-size:13px">Assinatura: '+esc(d.assinaturaObs||"—")+'</div></div></section>';
  h+='<section class="box"><div class="box-h">Registro fotográfico<span class="req">'+(d.fotos||[]).length+' fotos</span></div><div class="box-b"><div class="fotos">'+
    (d.fotos||[]).map((f,i)=>'<div class="foto"><div class="img" data-img="'+esc(f.id)+'"><span class="busy"><span class="spin" style="display:inline-block;vertical-align:middle;margin-right:6px"></span>Carregando…</span><span class="n">'+(i+1)+'</span></div><div class="cap">'+esc(f.legenda||"Sem legenda")+'</div></div>').join("")+
    '</div></div></section>';
  h+=driveStatusHtml(d);
  h+='<div class="actions"><button class="btn" id="v_txt">'+ICON.share+'Enviar resumo</button><button class="btn" id="v_pdf">'+ICON.pdf+'PDF</button></div>';
  h+='<button class="btn danger" id="v_del">Excluir este diário</button>';
  app.innerHTML=h;
  if($("#v_drive")) $("#v_drive").onclick = function(){ this.disabled=true; this.textContent="Enviando…"; Drive.enfileirar(d.id); enviarFilaDrive(true); };
  (d.fotos||[]).forEach((f,i) => loadFoto(f.id).then(u => { const box=$('[data-img="'+f.id+'"]'); if(!box) return;
    box.innerHTML = (u ? '<img src="'+esc(u)+'" alt="'+esc(f.legenda||"Foto "+(i+1))+'">' : '<span class="busy">Foto indisponível sem internet</span>')+'<span class="n">'+(i+1)+'</span>'; }));
  $("#v_txt").onclick = () => compartilharTexto(resumo(d,o));
  $("#v_pdf").onclick = function(){ const b=this; b.disabled=true; b.lastChild.textContent="Gerando…";
    makePdf(d,o).then(dataUri => compartilharPdf(dataUri, "Diario_"+slug(o.nome)+"_"+d.data+".pdf", o.nome+" – "+fmtData(d.data)))
      .catch(e => toast("Não foi possível gerar o PDF: "+errMsg(e)))
      .then(() => { b.disabled=false; b.lastChild.textContent="PDF"; }); };
  $("#v_del").onclick = () => confirmSheet("Excluir diário de "+fmtData(d.data)+"?","O diário e as fotos dele serão apagados para todos.","Excluir", () => { Store.delDiario(d); go("obra",{obraId:d.obraId}); });
  setBar('<button class="btn pri" id="v_edit">'+ICON.edit+'Editar diário</button>');
  $("#v_edit").onclick = () => openEditor(d);
}
function slug(s){ return String(s||"obra").normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^A-Za-z0-9]+/g,"_").replace(/^_|_$/g,""); }
function resumo(d,o){
  const L=[]; L.push("*DIÁRIO DE OBRA – "+o.nome+"*"); L.push("Data: "+fmtData(d.data)+" ("+diaSemana(d.data)+")");
  L.push("Mestre: "+(d.mestre||"—")+" | Eng.: "+(d.engenheiro||"—"));
  L.push("Clima: manhã "+(CLIMA[d.clima.manha]||"—")+", tarde "+(CLIMA[d.clima.tarde]||"—"));
  let tot=0; if(d.empreiteiras.length){ L.push("Efetivo:"); d.empreiteiras.forEach(e => { tot+=+e.func||0; L.push("• "+e.nome+": "+(e.func||0)); }); L.push("Total: "+tot+" func."); }
  L.push("Acidente de trabalho: "+({nao:"não",sim:"SIM"}[d.acidente]||"—")+(d.acidente==="sim"&&d.acidenteDesc?" – "+d.acidenteDesc:""));
  L.push("EPI’s: "+({sim:"todos usando",parcial:"uso parcial",nao:"não usando"}[d.epi]||"—"));
  if(d.equipamentos.length) L.push("Equipamentos: "+d.equipamentos.join(", "));
  if((o.etapas||[]).length && d.andamento){ L.push(""); L.push("*Andamento: "+fmtPct(pctGeral(o.etapas,d.andamento))+" concluído*"); o.etapas.forEach(e => L.push("• "+e.nome+": "+fmtPct(d.andamento[e.id]||0))); }
  L.push(""); L.push("*Serviços executados:*"); L.push(d.servicos||"—");
  if(d.observacoes){ L.push(""); L.push("*Observações:*"); L.push(d.observacoes); }
  if(d.fotos.length){ L.push(""); L.push("*Fotos:*"); d.fotos.forEach((f,i) => L.push((i+1)+". "+(f.legenda||""))); }
  return L.join("\n");
}
async function compartilharTexto(t){
  if(NATIVE){ try{ await Share.share({ title:"Diário de Obra", text:t, dialogTitle:"Enviar resumo" }); }catch(e){} return; }
  try{ await navigator.clipboard.writeText(t); toast("Resumo copiado"); }catch(e){ toast("Não foi possível copiar"); }
}
async function compartilharPdf(dataUri, filename, title){
  if(NATIVE){
    const base64 = dataUri.split(",")[1];
    const w = await Filesystem.writeFile({ path:filename, data:base64, directory:Directory.Cache });
    try{ await Share.share({ title, files:[w.uri], dialogTitle:"Salvar ou enviar PDF (Drive, WhatsApp, e-mail…)" }); }catch(e){}
    return;
  }
  const a=document.createElement("a"); a.href=dataUri; a.download=filename; document.body.appendChild(a); a.click(); a.remove();
}
function confirmSheet(title,text,okLabel,onOk,altLabel,onAlt){
  closeSheets();
  const sc=document.createElement("div"); sc.className="scrim";
  sc.innerHTML='<div class="sheet" role="dialog" aria-modal="true" aria-label="'+esc(title)+'"><h3>'+esc(title)+'</h3><p>'+esc(text)+'</p>'+
    '<button class="btn '+(/xclu|Remov|Sair|Trocar/.test(okLabel)?'danger':'pri')+'" id="cs_ok">'+esc(okLabel)+'</button>'+
    (altLabel?'<button class="btn" id="cs_alt">'+esc(altLabel)+'</button>':'')+'<button class="btn ghost" id="cs_no">Cancelar</button></div>';
  document.body.appendChild(sc);
  const close=()=>sc.remove();
  $("#cs_ok").onclick=()=>{ close(); onOk(); };
  if(altLabel) $("#cs_alt").onclick=()=>{ close(); onAlt(); };
  $("#cs_no").onclick=close; sc.onclick=e=>{ if(e.target===sc) close(); };
}
function closeSheets(){ $$(".scrim").forEach(s=>s.remove()); }

/* ---------- PDF no formato do diário em papel ---------- */
function imgInfo(url){ return new Promise(res => { if(!url) return res(null); const i=new Image(); i.onload=()=>res({data:url,w:i.naturalWidth,h:i.naturalHeight}); i.onerror=()=>res(null); i.src=url; }); }
async function makePdf(d,o){
  const pdf=new jsPDF({unit:"mm",format:"a4"});
  const M=12, W=186, PH=297; let y=M;
  pdf.setLineWidth(0.25); pdf.setDrawColor(40);
  const ensure = h => { if(y+h>PH-M){ pdf.addPage(); y=M; } };
  function cell(x,yy,w,h,label,val,opt={}){
    if(opt.fill){ pdf.setFillColor(225); pdf.rect(x,yy,w,h,"FD"); } else pdf.rect(x,yy,w,h);
    pdf.setFont("helvetica",opt.bold?"bold":"normal"); pdf.setFontSize(opt.size||9);
    pdf.text((label||"")+(val?" "+val:""), x+1.8, yy+h/2+1.2, {maxWidth:w-3});
  }
  pdf.rect(M,y,W,14); pdf.setFont("helvetica","bold"); pdf.setFontSize(16); pdf.text("DIÁRIO DE OBRA",M+W/2,y+9.2,{align:"center"});
  if(o.construtora){ pdf.setFontSize(9); pdf.setFont("helvetica","normal"); pdf.text(o.construtora,M+W-3,y+9,{align:"right"}); }
  y+=17;
  cell(M,y,140,7,"OBRA:",(o.nome||"").toUpperCase(),{size:10}); cell(M+140,y,46,7,"DATA:",fmtData(d.data),{size:10}); y+=7;
  cell(M,y,93,7,"Mestre:",d.mestre||""); cell(M+93,y,93,7,"Eng Responsável:",d.engenheiro||""); y+=7;
  if(o.endereco){ cell(M,y,W,7,"Endereço:",o.endereco); y+=7; }
  y+=4;
  const y0=y, cx=M, cw=78;
  cell(cx,y,cw,6,"Condições Climáticas","",{bold:true}); y+=6;
  const cols=[cx+24,cx+42,cx+60];
  cell(cx,y,24,6,"",""); ["S","I","C"].forEach((k,i) => { cell(cols[i],y,18,6,"",""); pdf.setFont("helvetica","bold"); pdf.text(k,cols[i]+9,y+4.2,{align:"center"}); }); y+=6;
  [["manha","Manhã"],["tarde","Tarde"]].forEach(p => { cell(cx,y,24,6,p[1],""); ["S","I","C"].forEach((k,i) => { cell(cols[i],y,18,6,"",""); if(d.clima[p[0]]===k){ pdf.setFont("helvetica","bold"); pdf.setFontSize(11); pdf.text("X",cols[i]+9,y+4.4,{align:"center"}); } }); y+=6; });
  pdf.setFont("helvetica","normal"); pdf.setFontSize(7.5); pdf.rect(cx,y,cw,5); pdf.text("S=Sol    I=Instável    C=Chuva",cx+1.8,y+3.5); y+=8;
  cell(cx,y,54,6,"Acidente de trabalho",""); cell(cx+54,y,24,6,{nao:"Não",sim:"SIM"}[d.acidente]||"",""); y+=6;
  cell(cx,y,54,6,"Uso de EPI's",""); cell(cx+54,y,24,6,{sim:"Sim",parcial:"Parcial",nao:"Não"}[d.epi]||"",""); y+=6;
  const yL=y; y=y0; const ex=M+84, ew=W-84;
  cell(ex,y,ew-22,6,"Empreiteiras","",{bold:true}); cell(ex+ew-22,y,22,6,"Nº Func","",{bold:true}); y+=6;
  const emps=d.empreiteiras.slice(); while(emps.length<6) emps.push({nome:"",func:""});
  let tot=0; emps.forEach(e => { tot+=+e.func||0; cell(ex,y,ew-22,6,e.nome||"",""); cell(ex+ew-22,y,22,6,e.func?String(e.func):"",""); y+=6; });
  cell(ex,y,ew-22,6,"Total","",{bold:true}); cell(ex+ew-22,y,22,6,String(tot),"",{bold:true}); y+=6;
  y=Math.max(y,yL)+4;
  if(d.acidente==="sim"&&d.acidenteDesc){ pdf.setFontSize(9); const al=pdf.splitTextToSize("Descrição do acidente: "+d.acidenteDesc,W-4); ensure(al.length*4.2+4); pdf.rect(M,y,W,al.length*4.2+3); pdf.text(al,M+1.8,y+4.2); y+=al.length*4.2+7; }
  const eq=d.equipamentos.slice(); while(eq.length<4||eq.length%4) eq.push("");
  cell(M,y,W,6,"Equipamentos:","",{bold:true}); y+=6;
  for(let i=0;i<eq.length;i+=4){ for(let j=0;j<4;j++) cell(M+j*W/4,y,W/4,6,eq[i+j],""); y+=6; }
  y+=4;
  if((o.etapas||[]).length && d.andamento){
    const pesos=pesosNormalizados(o.etapas);
    ensure(12+o.etapas.length*6);
    cell(M,y,W-50,6,"ANDAMENTO FÍSICO (acumulado)","",{fill:true,bold:true}); cell(M+W-50,y,25,6,"Peso","",{fill:true,bold:true}); cell(M+W-25,y,25,6,"Concluído","",{fill:true,bold:true}); y+=6;
    o.etapas.forEach(e => { ensure(6); cell(M,y,W-50,6,e.nome,""); cell(M+W-50,y,25,6,fmtPct(pesos.get(e.id)*100),""); cell(M+W-25,y,25,6,fmtPct(d.andamento[e.id]||0),""); y+=6; });
    cell(M,y,W-25,6,"Total da obra","",{bold:true}); cell(M+W-25,y,25,6,fmtPct(pctGeral(o.etapas,d.andamento)),"",{bold:true}); y+=10;
  }
  function textBox(title,body,sign){
    pdf.setFontSize(9); const lines=pdf.splitTextToSize(body||"",W-4), lh=4.4;
    ensure(6+Math.min(lines.length,8)*lh+10);
    cell(M,y,W,6,title,"",{fill:true,bold:true}); y+=6;
    let idx=0;
    for(;;){
      let room=Math.floor((PH-M-y-8)/lh); if(room<1){ pdf.addPage(); y=M; room=Math.floor((PH-M-y-8)/lh); }
      let chunk=lines.slice(idx,idx+room); if(!chunk.length) chunk=[""];
      const hh=Math.max(chunk.length,3)*lh+3; pdf.rect(M,y,W,hh); pdf.setFont("helvetica","normal"); pdf.setFontSize(9); pdf.text(chunk,M+1.8,y+4.4); y+=hh; idx+=room;
      if(idx>=lines.length) break;
    }
    cell(M,y,W,7,"Assinatura:",sign||""); y+=11;
  }
  textBox("SERVIÇOS E/OU ATIVIDADES EXECUTADOS:",d.servicos,d.assinaturaServicos);
  textBox("OBSERVAÇÕES (Engenharia e Diretoria):",d.observacoes,d.assinaturaObs);
  const fotos=d.fotos||[];
  if(fotos.length){
    const imgs = await Promise.all(fotos.map(f => loadFoto(f.id).then(imgInfo)));
    pdf.addPage(); y=M;
    cell(M,y,W,7,"REGISTRO FOTOGRÁFICO – "+(o.nome||"")+" – "+fmtData(d.data),"",{fill:true,bold:true}); y+=10;
    const colW=(W-6)/2, boxH=colW*0.75, capH=12;
    imgs.forEach((im,i) => {
      const col=i%2; if(col===0&&i>0) y+=boxH+capH+6;
      if(col===0&&y+boxH+capH>PH-M){ pdf.addPage(); y=M; }
      const x=M+col*(colW+6); pdf.rect(x,y,colW,boxH);
      if(im){ const k=Math.min(colW/im.w,boxH/im.h), iw=im.w*k, ih=im.h*k; pdf.addImage(im.data,"JPEG",x+(colW-iw)/2,y+(boxH-ih)/2,iw,ih); }
      pdf.setFont("helvetica","bold"); pdf.setFontSize(8.5); pdf.text("Foto "+(i+1)+":",x,y+boxH+4.5);
      pdf.setFont("helvetica","normal"); pdf.text(pdf.splitTextToSize(fotos[i].legenda||"",colW-14).slice(0,2),x+14,y+boxH+4.5);
    });
  }
  return pdf.output("datauristring");
}

boot();
