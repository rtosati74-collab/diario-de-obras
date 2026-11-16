import "./style.css";
import { initializeApp } from "firebase/app";
import { initializeAuth, browserLocalPersistence, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";
import { initializeFirestore, collection, getDocs, doc, getDoc } from "firebase/firestore";
import { montarDados } from "./dados.js";
import { gerarRelatorio, fraseResumo, fmtData } from "./relatorio.js";
import { curvaChart, etapasChart, efetivoChart, climaChart, pct, dm } from "./charts.js";

const CFG_KEY = "relatorio-obra-firebase-config";
const S = { fase: "boot", user: null, obras: [], diarios: [], obraId: null, periodo: "mes", ini: "", fim: "", rascunhos: false, fotos: "todas", charts: [], gerando: false };
let AUTH, DB;
const fotoCache = new Map();
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = v => String(v == null ? "" : v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const app = $("#app");
const hoje = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
function toast(m) { let t = $(".toast"); if (t) t.remove(); t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); t.textContent = m; document.body.appendChild(t); setTimeout(() => t.remove(), 3500); }
function errMsg(e) {
  const c = (e && e.code) || "";
  if (c.includes("invalid-credential") || c.includes("wrong-password") || c.includes("user-not-found")) return "e-mail ou senha incorretos";
  if (c.includes("network")) return "sem conexão com a internet";
  if (c.includes("permission")) return "sem permissão no Firebase";
  if (c.includes("too-many")) return "muitas tentativas; aguarde alguns minutos";
  return (e && (e.message || c)) || "erro";
}
function parseConfig(text) {
  const out = {};
  ["apiKey", "authDomain", "projectId", "storageBucket", "messagingSenderId", "appId"].forEach(k => {
    const m = new RegExp('["\']?' + k + '["\']?\\s*:\\s*["\']([^"\']+)["\']').exec(text); if (m) out[k] = m[1].trim();
  });
  return out.apiKey && out.projectId && out.appId ? out : null;
}
function lerConfig() { try { const c = JSON.parse(localStorage.getItem(CFG_KEY)); return c && c.apiKey ? c : null; } catch (e) { return null; } }
function topo(sub, direita) { $("#topSub").textContent = sub || ""; $("#topRight").innerHTML = direita || ""; }

/* ---------- início ---------- */
function boot() {
  const cfg = lerConfig();
  if (!cfg) return telaConfig();
  try {
    const fb = initializeApp(cfg);
    AUTH = initializeAuth(fb, { persistence: browserLocalPersistence });
    DB = initializeFirestore(fb, {});
  } catch (e) { return telaConfig("Configuração inválida: " + errMsg(e)); }
  onAuthStateChanged(AUTH, u => { S.user = u; if (u) carregar(); else telaLogin(); });
}

function telaConfig(erro) {
  topo("Configuração inicial");
  app.innerHTML = '<div class="center"><section class="box"><div class="box-h">Conectar ao Firebase do Diário de Obra</div><div class="box-b">' +
    '<p style="margin:0">Cole o mesmo bloco <b>firebaseConfig</b> que você usou no celular. Isso é feito uma vez só neste computador.</p>' +
    '<textarea class="inp" id="cfg" placeholder="const firebaseConfig = { apiKey: ..., ... };"></textarea>' +
    '<div class="err" id="cfgErr"' + (erro ? "" : " hidden") + '>' + esc(erro || "") + '</div>' +
    '<button class="btn pri" id="cfgOk">Salvar e continuar</button></div></section></div>';
  $("#cfgOk").onclick = () => {
    const c = parseConfig($("#cfg").value);
    if (!c) { const e = $("#cfgErr"); e.hidden = false; e.textContent = "Não encontrei apiKey, projectId e appId no texto colado."; return; }
    localStorage.setItem(CFG_KEY, JSON.stringify(c)); location.reload();
  };
}

function telaLogin() {
  topo("Entrar");
  app.innerHTML = '<div class="center"><section class="box"><div class="box-h">Entrar</div><div class="box-b">' +
    '<p style="margin:0;color:var(--muted)">Use o mesmo e-mail e senha do app Diário de Obra.</p>' +
    '<label class="f">E-mail<input class="inp" id="em" type="email" autocomplete="username"></label>' +
    '<label class="f">Senha<input class="inp" id="pw" type="password" autocomplete="current-password"></label>' +
    '<div class="err" id="lgErr" hidden></div>' +
    '<div class="row"><button class="btn pri" id="lgOk">Entrar</button><span style="flex:1"></span><button class="btn ghost" id="lgCfg">Trocar projeto Firebase</button></div></div></section></div>';
  const ir = () => {
    const em = $("#em").value.trim(), pw = $("#pw").value;
    if (!em || !pw) { const e = $("#lgErr"); e.hidden = false; e.textContent = "Informe e-mail e senha."; return; }
    $("#lgOk").disabled = true;
    signInWithEmailAndPassword(AUTH, em, pw).catch(err => { $("#lgOk").disabled = false; const e = $("#lgErr"); e.hidden = false; e.textContent = "Não foi possível entrar: " + errMsg(err) + "."; });
  };
  $("#lgOk").onclick = ir; $("#pw").onkeydown = e => { if (e.key === "Enter") ir(); };
  $("#lgCfg").onclick = () => { localStorage.removeItem(CFG_KEY); location.reload(); };
  $("#em").focus();
}

async function carregar() {
  topo("Carregando…");
  app.innerHTML = '<div class="loading"><div class="spin"></div>Buscando obras e diários na nuvem…</div>';
  try {
    const [o, d] = await Promise.all([getDocs(collection(DB, "obras")), getDocs(collection(DB, "diarios"))]);
    S.obras = o.docs.map(x => ({ ...x.data(), id: x.id })).sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));
    S.diarios = d.docs.map(x => ({ ...x.data(), id: x.id }));
    if (!S.obraId || !S.obras.find(x => x.id === S.obraId)) S.obraId = S.obras[0] && S.obras[0].id;
    definirPeriodo(S.periodo);
    telaPrincipal();
  } catch (e) {
    app.innerHTML = '<div class="center"><div class="notice">Não foi possível ler os dados: ' + esc(errMsg(e)) + '</div><p><button class="btn" id="tent">Tentar de novo</button></p></div>';
    $("#tent").onclick = carregar;
  }
}

/* ---------- período ---------- */
function limitesObra(obra) {
  const ds = S.diarios.filter(d => d.obraId === obra.id).map(d => d.data).filter(Boolean).sort();
  const et = (obra.etapas || []).flatMap(e => [e.inicio, e.fim]).filter(Boolean).sort();
  return { ini: [ds[0], et[0]].filter(Boolean).sort()[0] || hoje(), fim: ds.at(-1) || hoje() };
}
function definirPeriodo(tipo) {
  S.periodo = tipo;
  const h = hoje(), y = +h.slice(0, 4), m = +h.slice(5, 7);
  const ultimoDia = (yy, mm) => new Date(Date.UTC(yy, mm, 0)).toISOString().slice(0, 10);
  const pad = n => String(n).padStart(2, "0");
  if (tipo === "mes") { S.ini = y + "-" + pad(m) + "-01"; S.fim = h; }
  else if (tipo === "anterior") { const yy = m === 1 ? y - 1 : y, mm = m === 1 ? 12 : m - 1; S.ini = yy + "-" + pad(mm) + "-01"; S.fim = ultimoDia(yy, mm); }
  else if (tipo === "toda") { const o = S.obras.find(x => x.id === S.obraId); const l = o ? limitesObra(o) : { ini: h, fim: h }; S.ini = l.ini; S.fim = l.fim > h ? l.fim : h; }
}

/* ---------- tela principal ---------- */
function telaPrincipal() {
  topo(S.user && S.user.email, '<button class="btn ghost" id="sair" style="color:#D2D8DF">Sair</button>');
  $("#sair").onclick = () => signOut(AUTH);
  if (!S.obras.length) {
    app.innerHTML = '<div class="center"><div class="notice">Nenhuma obra cadastrada ainda. Cadastre a obra no app do celular e clique em Atualizar.</div><p><button class="btn" id="atu">Atualizar</button></p></div>';
    $("#atu").onclick = carregar; return;
  }
  let side = '<div class="sec-t">Obras</div>';
  S.obras.forEach(o => {
    const n = S.diarios.filter(d => d.obraId === o.id).length;
    side += '<button class="obra" data-o="' + esc(o.id) + '" aria-current="' + (o.id === S.obraId) + '"><b>' + esc(o.nome) + '</b><span>' + n + (n === 1 ? " diário" : " diários") + (o.contratante ? " · " + esc(o.contratante) : "") + '</span></button>';
  });
  side += '<span style="flex:1"></span><button class="btn" id="atu">Atualizar dados</button>';
  app.innerHTML = '<aside class="side">' + side + '</aside><main class="main"><div class="main-in" id="painel"></div></main>';
  $$("[data-o]").forEach(b => b.onclick = () => { S.obraId = b.getAttribute("data-o"); if (S.periodo === "toda") definirPeriodo("toda"); telaPrincipal(); });
  $("#atu").onclick = carregar;
  painel();
}

function painel() {
  S.charts.forEach(c => c.destroy()); S.charts = [];
  const obra = S.obras.find(o => o.id === S.obraId);
  const dados = montarDados(obra, S.diarios.filter(d => d.obraId === obra.id), { inicio: S.ini, fim: S.fim, incluirRascunhos: S.rascunhos });
  const r = dados.resumo;
  const nFotos = dados.dias.reduce((s, d) => s + Math.min((d.fotos || []).length, S.fotos === "4" ? 4 : 999), 0);
  let h = '<section class="box"><div class="box-h">Período do relatório<span class="r">' + esc(obra.nome) + '</span></div><div class="box-b">' +
    '<div class="row"><div class="seg" role="group" aria-label="Período">' +
    [["mes", "Mês atual"], ["anterior", "Mês anterior"], ["toda", "Obra toda"], ["outro", "Escolher datas"]].map(([k, t]) => '<button data-p="' + k + '" aria-pressed="' + (S.periodo === k) + '">' + t + '</button>').join("") + '</div>' +
    '<label class="f">De<input type="date" class="inp" id="ini" value="' + S.ini + '"></label><label class="f">Até<input type="date" class="inp" id="fim" value="' + S.fim + '"></label></div>' +
    '<div class="row" style="align-items:center"><span class="f" style="font-weight:600;color:var(--muted);font-size:13px">Fotos no relatório</span><div class="seg" role="group" aria-label="Fotos">' +
    [["todas", "Todas"], ["4", "Até 4 por dia"], ["nenhuma", "Sem fotos"]].map(([k, t]) => '<button data-f="' + k + '" aria-pressed="' + (S.fotos === k) + '">' + t + '</button>').join("") + '</div>' +
    '<label class="chk"><input type="checkbox" id="rasc"' + (S.rascunhos ? " checked" : "") + '> Incluir diários em rascunho</label>' +
    '<span style="flex:1"></span><button class="btn pri" id="gerar">Gerar relatório em PDF</button></div>' +
    '<div id="prog" hidden><div class="progress"><span id="progBar" style="width:0%"></span></div><div id="progTxt" style="font-size:13px;color:var(--muted);margin-top:4px"></div></div>' +
    '<div style="font-size:13px;color:var(--muted)">' + dados.dias.length + ' diário(s) no período · ' + nFotos + ' foto(s) no relatório</div></div></section>';
  h += '<p class="lead">' + esc(fraseResumo(dados)) + '</p>';
  const dcls = r.desvio == null ? "" : r.desvio >= -2 ? " bom" : " ruim";
  h += '<div class="kpis">' +
    kpi("Realizado", pct(r.realizado), "acumulado até " + fmtData(S.fim)) +
    kpi("Previsto", r.previsto == null ? "—" : pct(r.previsto), "pelo cronograma") +
    kpi("Desvio", r.desvio == null ? "—" : (r.desvio > 0 ? "+" : "") + String(r.desvio).replace(".", ",") + " p.p.", r.desvio == null ? "sem cronograma" : r.desvio >= 0 ? "adiantada" : "atrasada", dcls) +
    kpi("Avanço no período", String(Math.round((r.realizado - r.realizadoInicio) * 10) / 10).replace(".", ",") + " p.p.", "de " + pct(r.realizadoInicio) + " para " + pct(r.realizado)) +
    kpi("Dias com diário", r.diasComDiario, "no período") + kpi("Dias com chuva", r.diasChuva, "manhã ou tarde") +
    kpi("Efetivo médio", String(r.efetivoMedio).replace(".", ","), "máximo " + r.efetivoMax) + kpi("Acidentes", r.acidentes, r.acidentes ? "ver relatório" : "nenhum", r.acidentes ? " ruim" : "") + '</div>';
  h += '<div class="charts">';
  if (!dados.semEtapas) {
    h += '<section class="box full"><div class="box-h">Curva de avanço: previsto x realizado</div><div class="box-b"><div class="chart-wrap alto"><canvas id="c1" role="img" aria-label="Curva previsto x realizado"></canvas></div></div></section>';
    h += '<section class="box full"><div class="box-h">Andamento por etapa em ' + fmtData(S.fim) + '</div><div class="box-b"><div class="chart-wrap" style="height:' + Math.max(160, 70 + dados.etapas.length * 44) + 'px"><canvas id="c2" role="img" aria-label="Andamento por etapa"></canvas></div>' +
      '<table class="t"><thead><tr><th>Etapa</th><th style="text-align:right">Peso</th><th style="text-align:right">Previsto</th><th style="text-align:right">Realizado</th></tr></thead><tbody>' +
      dados.etapas.map(e => '<tr><td>' + esc(e.nome) + '</td><td class="n">' + pct(e.peso) + '</td><td class="n">' + pct(e.previsto) + '</td><td class="n">' + pct(e.realizado) + '</td></tr>').join("") + '</tbody></table></div></section>';
  } else {
    h += '<div class="notice full">Esta obra não tem etapas cadastradas. Cadastre as etapas no app do celular (Editar dados da obra) para ver a curva de avanço.</div>';
  }
  h += '<section class="box"><div class="box-h">Efetivo diário</div><div class="box-b">' + (dados.efetivo.datas.length ? '<div class="chart-wrap"><canvas id="c3" role="img" aria-label="Efetivo diário por empreiteira"></canvas></div>' : '<div class="notice">Sem diários no período.</div>') + '</div></section>';
  h += '<section class="box"><div class="box-h">Turnos por condição do tempo</div><div class="box-b"><div class="chart-wrap"><canvas id="c4" role="img" aria-label="Turnos por condição do tempo"></canvas></div></div></section>';
  h += '</div>';
  $("#painel").innerHTML = h;

  if (!dados.semEtapas && dados.curva.length) S.charts.push(curvaChart($("#c1"), dados), etapasChart($("#c2"), dados));
  if ($("#c3")) S.charts.push(efetivoChart($("#c3"), dados));
  S.charts.push(climaChart($("#c4"), dados));

  $$("[data-p]").forEach(b => b.onclick = () => { const k = b.getAttribute("data-p"); if (k !== "outro") definirPeriodo(k); else S.periodo = "outro"; painel(); });
  $$("[data-f]").forEach(b => b.onclick = () => { S.fotos = b.getAttribute("data-f"); painel(); });
  $("#ini").onchange = e => { S.ini = e.target.value; S.periodo = "outro"; if (S.fim < S.ini) S.fim = S.ini; painel(); };
  $("#fim").onchange = e => { S.fim = e.target.value; S.periodo = "outro"; if (S.fim < S.ini) S.ini = S.fim; painel(); };
  $("#rasc").onchange = e => { S.rascunhos = e.target.checked; painel(); };
  $("#gerar").onclick = () => gerar(obra, dados);
}
function kpi(l, v, s, cls) { return '<div class="kpi"><div class="l">' + esc(l) + '</div><div class="v' + (cls || "") + '">' + esc(v) + '</div><div class="s">' + esc(s) + '</div></div>'; }

async function carregarFoto(id) {
  if (fotoCache.has(id)) return fotoCache.get(id);
  try { const s = await getDoc(doc(DB, "fotos", id)); const u = s.exists() ? s.data().dataUrl || "" : ""; fotoCache.set(id, u); return u; }
  catch (e) { return ""; }
}

async function gerar(obra, dados) {
  if (S.gerando) return;
  S.gerando = true;
  const b = $("#gerar"); b.disabled = true; b.textContent = "Gerando…";
  $("#prog").hidden = false;
  try {
    const bytes = await gerarRelatorio(dados, obra, { fotos: S.fotos, emissor: S.user && S.user.email }, carregarFoto,
      (p, t) => { $("#progBar").style.width = Math.round(p * 100) + "%"; $("#progTxt").textContent = t; });
    const nome = "Relatorio_" + (obra.nome || "obra").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "_") + "_" + S.ini + "_a_" + S.fim + ".pdf";
    if (window.desktop) {
      const r = await window.desktop.salvarPdf(nome, new Uint8Array(bytes));
      if (r.ok) toast("Relatório salvo em " + r.caminho);
    } else {
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      const a = document.createElement("a"); a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
    }
  } catch (e) {
    toast("Não foi possível gerar o relatório: " + errMsg(e));
  } finally {
    S.gerando = false; b.disabled = false; b.textContent = "Gerar relatório em PDF"; $("#prog").hidden = true;
  }
}

boot();
