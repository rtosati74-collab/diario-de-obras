import "./style.css";
import { initializeApp } from "firebase/app";
import { initializeAuth, browserLocalPersistence, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";
import { initializeFirestore, collection, getDocs, doc, getDoc, setDoc } from "firebase/firestore";
import { lerPlanilha, gerarModelo } from "./planilha.js";
import { mesclarEtapas } from "./cronograma.js";
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
  let h = cronogramaHtml(obra);
  h += '<section class="box"><div class="box-h">Período do relatório<span class="r">' + esc(obra.nome) + '</span></div><div class="box-b">' +
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
    h += '<div class="notice full">Esta obra não tem etapas cadastradas. Use <b>Importar planilha</b>, no quadro Cronograma acima, para ver a curva de avanço.</div>';
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
  $("#cronImp").onclick = () => { $("#cronArq").value = ""; $("#cronArq").click(); };
  $("#cronArq").onchange = e => { const f = e.target.files && e.target.files[0]; if (f) importarCronograma(obra, f); };
  $("#cronModelo").onclick = () => baixarModelo(obra);
}

/* ---------- cronograma: importar etapas de planilha ---------- */
const fmtPeso = n => String(Math.round((+n || 0) * 100) / 100).replace(".", ",") + "%";
const somaPesos = et => Math.round(et.reduce((s, e) => s + (+e.peso || 0), 0) * 100) / 100;
function cronogramaHtml(obra) {
  const et = obra.etapas || [];
  const datas = et.flatMap(e => [e.inicio, e.fim]).filter(Boolean).sort();
  const resumo = et.length
    ? et.length + (et.length === 1 ? " etapa" : " etapas") + " · pesos somam " + fmtPeso(somaPesos(et)) + (datas.length ? " · de " + fmtData(datas[0]) + " a " + fmtData(datas.at(-1)) : "")
    : "Nenhuma etapa cadastrada";
  return '<section class="box"><div class="box-h">Cronograma da obra<span class="r">' + esc(resumo) + '</span></div><div class="box-b">' +
    '<div class="row" style="align-items:center"><p style="margin:0;flex:1;min-width:260px;color:var(--muted);font-size:14px">Importe as etapas (nome, peso, início e fim previstos) de uma planilha Excel ou CSV. Etapas com o mesmo nome mantêm o % já lançado nos diários.</p>' +
    '<button class="btn" id="cronModelo">' + (et.length ? "Baixar cronograma atual (Excel)" : "Baixar modelo (Excel)") + '</button>' +
    '<button class="btn pri" id="cronImp">Importar planilha</button>' +
    '<input type="file" id="cronArq" accept=".xlsx,.xls,.xlsm,.csv" hidden></div></div></section>';
}
async function baixarModelo(obra) {
  const bytes = new Uint8Array(gerarModelo(obra.etapas || []));
  const nome = "Cronograma_" + (obra.nome || "obra").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9]+/g, "_") + ".xlsx";
  if (window.desktop && window.desktop.salvarArquivo) {
    const r = await window.desktop.salvarArquivo(nome, bytes, "xlsx");
    if (r.ok) toast("Planilha salva em " + r.caminho);
  } else {
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    const a = document.createElement("a"); a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
  }
}
async function importarCronograma(obra, arquivo) {
  let r;
  try { r = lerPlanilha(new Uint8Array(await arquivo.arrayBuffer()), arquivo.name); }
  catch (e) { toast("Não consegui ler a planilha: " + (e.message || e)); return; }
  const m = mesclarEtapas(obra.etapas || [], r.etapas, () => "e_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7));
  const soma = somaPesos(r.etapas);
  const nDiarios = S.diarios.filter(d => d.obraId === obra.id && d.andamento && m.removidas.some(x => x.id in d.andamento)).length;
  const rot = { nova: ["Nova", "ok"], alterada: ["Alterada", "alt"], igual: ["Sem mudança", "igual"] };
  let h = '<div class="modal" role="dialog" aria-modal="true" aria-label="Prévia da importação"><div class="modal-h">Prévia da importação<span class="r">' + esc(arquivo.name) + (r.aba ? " · aba " + esc(r.aba) : "") + '</span></div><div class="modal-b">';
  if (r.erros.length) {
    h += '<div class="aviso ruim"><b>Corrija a planilha antes de importar:</b><ul>' + r.erros.map(e => '<li>' + (e.linha ? "Linha " + e.linha + ": " : "") + esc(e.msg) + '</li>').join("") + '</ul></div>';
  }
  if (r.etapas.length) {
    h += '<table class="t"><thead><tr><th>Etapa</th><th style="text-align:right">Peso</th><th>Início</th><th>Fim</th><th>Situação</th></tr></thead><tbody>' +
      m.etapas.map((e, i) => '<tr><td>' + esc(e.nome) + '</td><td class="n">' + fmtPeso(e.peso) + '</td><td class="n" style="text-align:left">' + fmtData(e.inicio) + '</td><td class="n" style="text-align:left">' + fmtData(e.fim) + '</td><td><span class="chip ' + rot[m.status[i]][1] + '">' + rot[m.status[i]][0] + '</span></td></tr>').join("") +
      m.removidas.map(e => '<tr class="sai"><td>' + esc(e.nome) + '</td><td class="n">' + fmtPeso(e.peso) + '</td><td class="n" style="text-align:left">' + fmtData(e.inicio) + '</td><td class="n" style="text-align:left">' + fmtData(e.fim) + '</td><td><span class="chip sai">Sai da obra</span></td></tr>').join("") +
      '</tbody></table>';
    h += '<div class="row" style="gap:18px;font-size:14px"><span><b>' + m.status.filter(x => x === "nova").length + '</b> nova(s)</span><span><b>' + m.status.filter(x => x === "alterada").length + '</b> alterada(s)</span><span><b>' + m.removidas.length + '</b> sai(em)</span>' +
      '<span>Soma dos pesos: <b' + (Math.abs(soma - 100) < 0.05 ? '' : ' style="color:var(--bad)"') + '>' + fmtPeso(soma) + '</b>' + (Math.abs(soma - 100) < 0.05 ? '' : ' (o app ajusta proporcionalmente para 100%)') + '</span></div>';
    if (m.removidas.length) h += '<div class="aviso">' + (nDiarios ? "O % lançado em " + nDiarios + " diário(s) para as etapas que saem deixa de contar no andamento." : "As etapas que saem não têm % lançado em diários.") + '</div>';
  }
  h += '</div><div class="modal-f"><button class="btn" id="impNao">Cancelar</button><button class="btn pri" id="impSim"' + (r.erros.length || !r.etapas.length ? " disabled" : "") + '>Importar ' + r.etapas.length + ' etapa(s)</button></div></div>';
  const sc = document.createElement("div"); sc.className = "scrim"; sc.innerHTML = h; document.body.appendChild(sc);
  const fechar = () => sc.remove();
  $("#impNao").onclick = fechar; sc.onclick = e => { if (e.target === sc) fechar(); };
  document.addEventListener("keydown", function esc_(e) { if (e.key === "Escape") { fechar(); document.removeEventListener("keydown", esc_); } });
  $("#impSim").onclick = async () => {
    const b = $("#impSim"); b.disabled = true; b.textContent = "Gravando…";
    try {
      await setDoc(doc(DB, "obras", obra.id), { etapas: m.etapas, cronogramaImportadoEm: Date.now() }, { merge: true });
      obra.etapas = m.etapas; fechar(); toast("Cronograma importado: " + m.etapas.length + " etapa(s)"); painel();
    } catch (e) { b.disabled = false; b.textContent = "Importar " + r.etapas.length + " etapa(s)"; toast("Não foi possível gravar: " + errMsg(e)); }
  };
  $("#impSim").focus();
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
