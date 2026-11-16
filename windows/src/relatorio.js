// Monta o PDF do relatório de andamento (A4 retrato) a partir de montarDados().
import { jsPDF } from "jspdf";
import { grafico, curvaChart, etapasChart, efetivoChart, climaChart, dm, pct } from "./charts.js";

const INK = [24, 33, 43], MUTED = [90, 101, 115], LINE = [211, 217, 224], SOFT = [244, 246, 248];
const ACC = [226, 86, 11], OK = [46, 122, 76], BAD = [184, 50, 42];
const M = 14, W = 182, PH = 297, PW = 210;

export const fmtData = iso => iso ? iso.slice(8, 10) + "/" + iso.slice(5, 7) + "/" + iso.slice(0, 4) : "-";
const DOW = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const dia = iso => DOW[new Date(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)).getDay()];
const pp = n => (n > 0 ? "+" : "") + String(Math.round(n * 10) / 10).replace(".", ",") + " p.p.";

/** Frase principal do relatório (também usada na tela). */
export function fraseResumo(d) {
  const r = d.resumo;
  if (d.semEtapas) return "A obra não tem etapas cadastradas, então o relatório mostra o registro diário sem o andamento físico.";
  let s = "Até " + fmtData(d.periodo.fim) + ", a obra está com " + pct(r.realizado) + " concluído";
  if (r.previsto != null) {
    const abs = String(Math.round(Math.abs(r.desvio) * 10) / 10).replace(".", ",") + " pontos percentuais";
    const situ = Math.abs(r.desvio) < 2 ? "dentro do previsto" : r.desvio > 0 ? abs + " adiantada" : abs + " atrasada";
    s += ", contra " + pct(r.previsto) + " previsto, ou seja, " + situ;
  }
  const av = Math.round((r.realizado - r.realizadoInicio) * 10) / 10;
  return s + ". No período, o avanço foi de " + String(av).replace(".", ",") + " pontos percentuais.";
}

function imgDims(url) {
  return new Promise(res => { const i = new Image(); i.onload = () => res({ w: i.naturalWidth, h: i.naturalHeight }); i.onerror = () => res(null); i.src = url; });
}

/**
 * @param dados   resultado de montarDados()
 * @param obra    documento da obra
 * @param op      { fotos: "todas" | "4" | "nenhuma", emissor?: string }
 * @param carregarFoto (id) => Promise<dataURL|"">
 * @param progresso (0..1, texto) => void
 * @returns Promise<ArrayBuffer>
 */
export async function gerarRelatorio(dados, obra, op, carregarFoto, progresso = () => {}) {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  let y = M;
  const titulo = (obra.nome || "Obra") + " - Relatório de andamento " + fmtData(dados.periodo.inicio) + " a " + fmtData(dados.periodo.fim);
  const cor = (c, f) => (f === "fill" ? pdf.setFillColor(...c) : f === "draw" ? pdf.setDrawColor(...c) : pdf.setTextColor(...c));
  const fonte = (estilo, tam, c = INK) => { pdf.setFont("helvetica", estilo); pdf.setFontSize(tam); cor(c); };
  const novaPagina = () => {
    pdf.addPage(); y = M;
    fonte("bold", 8, MUTED); pdf.text(titulo.toUpperCase(), M, 9);
    cor(ACC, "fill"); pdf.rect(M, 10.5, W, 0.8, "F"); y = 16;
  };
  const cabe = h => { if (y + h > PH - 16) novaPagina(); };
  const secao = (txt) => { cabe(14); fonte("bold", 13, INK); pdf.text(txt.toUpperCase(), M, y + 5); cor(INK, "fill"); pdf.rect(M, y + 7, 18, 0.9, "F"); y += 12; };

  /* ---------- 1. Capa ---------- */
  progresso(0.05, "Capa e resumo");
  cor(INK, "fill"); pdf.rect(0, 0, PW, 50, "F");
  for (let x = -10; x < PW + 10; x += 8) { cor(ACC, "fill"); pdf.triangle(x, 54, x + 4, 50, x + 8, 50, "F"); pdf.triangle(x, 54, x + 8, 50, x + 4, 54, "F"); }
  fonte("bold", 9, ACC); pdf.text("RELATÓRIO DE ANDAMENTO DE OBRA", M, 16);
  fonte("bold", 24, [255, 255, 255]); pdf.text(pdf.splitTextToSize(obra.nome || "Obra", W).slice(0, 2), M, 28);
  fonte("normal", 11, [210, 216, 223]); pdf.text("Período: " + fmtData(dados.periodo.inicio) + " a " + fmtData(dados.periodo.fim), M, 43);
  y = 62;
  const info = [
    ["Contratante", obra.contratante], ["Construtora", obra.construtora], ["Endereço", obra.endereco],
    ["Responsável técnico", obra.engenheiro], ["Emitido em", new Date().toLocaleDateString("pt-BR")]
  ].filter(x => x[1]);
  info.forEach(([k, v], i) => {
    const col = i % 2, x = M + col * (W / 2);
    if (col === 0 && i) y += 11;
    fonte("bold", 7.5, MUTED); pdf.text(k.toUpperCase(), x, y);
    fonte("normal", 10.5, INK); pdf.text(pdf.splitTextToSize(String(v), W / 2 - 4)[0], x, y + 5);
  });
  y += 16;
  cor(LINE, "draw"); pdf.setLineWidth(0.3); pdf.line(M, y, M + W, y); y += 8;
  fonte("bold", 12.5, INK); const fr = pdf.splitTextToSize(fraseResumo(dados), W); pdf.text(fr, M, y); y += fr.length * 5.6 + 4;

  // KPIs
  const r = dados.resumo;
  const kpis = [
    ["Realizado", pct(r.realizado), "acumulado até o fim do período"],
    ["Previsto", r.previsto == null ? "-" : pct(r.previsto), "pelo cronograma das etapas"],
    ["Desvio", r.desvio == null ? "-" : pp(r.desvio), r.desvio == null ? "sem cronograma" : r.desvio >= 0 ? "adiantada" : "atrasada", r.desvio == null ? INK : r.desvio >= -2 ? OK : BAD],
    ["Avanço no período", pp(r.realizado - r.realizadoInicio).replace("+", ""), "de " + pct(r.realizadoInicio) + " para " + pct(r.realizado)],
    ["Dias com diário", String(r.diasComDiario), "no período"],
    ["Dias com chuva", String(r.diasChuva), "manhã ou tarde"],
    ["Efetivo médio", String(r.efetivoMedio).replace(".", ","), "máximo de " + r.efetivoMax + " no dia"],
    ["Acidentes", String(r.acidentes), r.acidentes ? "ver seção Segurança" : "nenhum registrado", r.acidentes ? BAD : INK]
  ];
  const kw = (W - 9) / 4, kh = 22;
  kpis.forEach(([l, v, s, c], i) => {
    const x = M + (i % 4) * (kw + 3), yy = y + Math.floor(i / 4) * (kh + 3);
    cor(SOFT, "fill"); cor(LINE, "draw"); pdf.roundedRect(x, yy, kw, kh, 1.5, 1.5, "FD");
    fonte("bold", 7, MUTED); pdf.text(l.toUpperCase(), x + 3, yy + 5.5);
    fonte("bold", 16, c || INK); pdf.text(v, x + 3, yy + 13.5);
    fonte("normal", 7.5, MUTED); pdf.text(pdf.splitTextToSize(s, kw - 5)[0], x + 3, yy + 18.5);
  });
  y += 2 * (kh + 3) + 6;

  // Curva
  if (!dados.semEtapas && dados.curva.length) {
    secao("Curva de avanço físico: previsto x realizado");
    const h = Math.min(92, PH - 18 - y);
    pdf.addImage(grafico(curvaChart, dados, 720, Math.round(720 * h / W)), "JPEG", M, y, W, h); y += h + 2;
  }

  /* ---------- 2. Andamento por etapa ---------- */
  progresso(0.2, "Andamento por etapa");
  novaPagina();
  if (!dados.semEtapas) {
    secao("Andamento por etapa em " + fmtData(dados.periodo.fim));
    const h = Math.max(40, Math.min(95, 16 + dados.etapas.length * 13));
    pdf.addImage(grafico(etapasChart, dados, 720, Math.round(720 * h / W)), "JPEG", M, y, W, h); y += h + 4;
    tabela(["Etapa", "Peso", "Previsto", "Realizado", "Desvio"], dados.etapas.map(e => [e.nome, pct(e.peso), pct(e.previsto), pct(e.realizado), e.previsto == null ? "-" : pp(e.realizado - e.previsto)]), [86, 22, 24, 24, 26]);
    y += 6;
  }

  /* ---------- 3. Efetivo, clima, segurança ---------- */
  progresso(0.3, "Efetivo, clima e segurança");
  if (dados.efetivo.datas.length) {
    secao("Efetivo diário por empreiteira");
    cabe(70); const h = 66;
    pdf.addImage(grafico(efetivoChart, dados, 720, Math.round(720 * h / W)), "JPEG", M, y, W, h); y += h + 6;
  }
  secao("Condições do tempo e segurança");
  cabe(52);
  const yTop = y, half = (W - 8) / 2;
  fonte("bold", 9, MUTED); pdf.text("TURNOS DE TRABALHO POR CONDIÇÃO DO TEMPO", M, y + 2);
  pdf.addImage(grafico(climaChart, dados, 400, 200), "JPEG", M, y + 4, half, half * 200 / 400);
  let y2 = yTop;
  const xs = M + half + 8;
  fonte("bold", 9, MUTED); pdf.text("SEGURANÇA DO TRABALHO", xs, y2 + 2); y2 += 8;
  const epi = dados.seguranca.epi;
  [["Dias com todos usando EPI", epi.sim], ["Dias com uso parcial de EPI", epi.parcial], ["Dias sem uso de EPI", epi.nao], ["Acidentes de trabalho", dados.seguranca.acidentes.length]].forEach(([k, v], i) => {
    fonte("normal", 10, INK); pdf.text(k, xs, y2); fonte("bold", 10, (i >= 2 && v) ? BAD : INK); pdf.text(String(v), xs + half, y2, { align: "right" });
    cor(LINE, "draw"); pdf.line(xs, y2 + 2, xs + half, y2 + 2); y2 += 7;
  });
  dados.seguranca.acidentes.forEach(a => {
    fonte("normal", 8.5, BAD); const t = pdf.splitTextToSize(fmtData(a.data) + ": " + (a.desc || "sem descrição"), half); pdf.text(t, xs, y2 + 2); y2 += t.length * 4 + 2;
  });
  y = Math.max(yTop + 4 + half * 200 / 400, y2) + 8;

  /* ---------- 4. Serviços executados ---------- */
  progresso(0.4, "Serviços executados");
  secao("Serviços executados e observações");
  if (!dados.dias.length) { fonte("normal", 10, MUTED); pdf.text("Nenhum diário concluído no período.", M, y); y += 8; }
  dados.dias.forEach(d => {
    fonte("normal", 9.5, INK);
    const serv = pdf.splitTextToSize(d.servicos || "-", W - 34);
    const obs = d.observacoes ? pdf.splitTextToSize("Obs.: " + d.observacoes, W - 34) : [];
    const ef = (d.empreiteiras || []).reduce((s, e) => s + (+e.func || 0), 0);
    const meta = "Efetivo " + ef + " · Tempo " + ({ S: "sol", I: "instável", C: "chuva" }[d.clima && d.clima.manha] || "-") + "/" + ({ S: "sol", I: "instável", C: "chuva" }[d.clima && d.clima.tarde] || "-");
    const h = 5 + serv.length * 4.3 + obs.length * 4.3 + 3;
    cabe(Math.min(h, 60));
    fonte("bold", 9.5, INK); pdf.text(fmtData(d.data), M, y + 4);
    fonte("normal", 8, MUTED); pdf.text(dia(d.data), M, y + 8);
    fonte("normal", 8, MUTED); pdf.text(meta, M + 32, y + 4);
    let yy = y + 9;
    fonte("normal", 9.5, INK);
    serv.forEach(l => { if (yy > PH - 18) { novaPagina(); yy = y; } pdf.text(l, M + 32, yy); yy += 4.3; });
    fonte("italic", 9, MUTED);
    obs.forEach(l => { if (yy > PH - 18) { novaPagina(); yy = y; } pdf.text(l, M + 32, yy); yy += 4.3; });
    y = yy + 1; cor(LINE, "draw"); pdf.line(M, y, M + W, y); y += 3;
  });

  /* ---------- 5. Fotos ---------- */
  if (op.fotos !== "nenhuma") {
    const lista = [];
    dados.dias.forEach(d => (d.fotos || []).slice(0, op.fotos === "4" ? 4 : 999).forEach(f => lista.push({ d, f })));
    if (lista.length) {
      novaPagina(); secao("Registro fotográfico");
      const NC = 3, GAP = 4, cw = (W - GAP * (NC - 1)) / NC, ch = cw * 0.7;
      let col = 0, dataAtual = null;
      for (let i = 0; i < lista.length; i++) {
        const { d, f } = lista[i];
        progresso(0.45 + 0.5 * i / lista.length, "Fotos (" + (i + 1) + " de " + lista.length + ")");
        if (d.data !== dataAtual) {
          if (col > 0) { y += ch + 10; col = 0; }
          cabe(6 + ch + 10);
          fonte("bold", 10, INK); pdf.text(fmtData(d.data) + "  ·  " + dia(d.data), M, y + 4); y += 6; dataAtual = d.data;
        }
        if (col === 0) cabe(ch + 10);
        const x = M + col * (cw + GAP);
        const url = await carregarFoto(f.id);
        cor(SOFT, "fill"); pdf.rect(x, y, cw, ch, "F");
        if (url) {
          const dim = await imgDims(url);
          if (dim) { const k = Math.min(cw / dim.w, ch / dim.h), iw = dim.w * k, ih = dim.h * k; pdf.addImage(url, "JPEG", x + (cw - iw) / 2, y + (ch - ih) / 2, iw, ih, undefined, "FAST"); }
        } else { fonte("normal", 9, MUTED); pdf.text("Foto indisponível", x + cw / 2, y + ch / 2, { align: "center" }); }
        fonte("normal", 8, INK); pdf.text(pdf.splitTextToSize(f.legenda || "Sem legenda", cw).slice(0, 2), x, y + ch + 4.2);
        col++;
        if (col === NC) { col = 0; y += ch + 10; }
      }
      if (col > 0) y += ch + 10;
    }
  }

  /* ---------- 6. Assinatura ---------- */
  cabe(34); y += 14;
  cor(INK, "draw"); pdf.setLineWidth(0.3); pdf.line(M + W / 2 - 45, y, M + W / 2 + 45, y);
  fonte("bold", 10, INK); pdf.text(obra.engenheiro || "Responsável técnico", M + W / 2, y + 5, { align: "center" });
  fonte("normal", 9, MUTED); pdf.text("Responsável técnico pela fiscalização", M + W / 2, y + 10, { align: "center" });

  // Rodapé com numeração
  const n = pdf.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    pdf.setPage(i); fonte("normal", 7.5, MUTED);
    pdf.text("Gerado pelo Diário de Obra" + (op.emissor ? " · " + op.emissor : ""), M, PH - 7);
    pdf.text("Página " + i + " de " + n, M + W, PH - 7, { align: "right" });
  }
  progresso(1, "Pronto");
  return pdf.output("arraybuffer");

  function tabela(cab, linhas, larg) {
    const lh = 6.5;
    const linha = (cels, bold, fundo) => {
      cabe(lh);
      if (fundo) { cor(SOFT, "fill"); pdf.rect(M, y, W, lh, "F"); }
      let x = M;
      cels.forEach((c, i) => {
        fonte(bold ? "bold" : "normal", bold ? 8 : 9, bold ? MUTED : INK);
        const txt = pdf.splitTextToSize(String(c), larg[i] - 3)[0];
        if (i === 0) pdf.text(txt, x + 1.5, y + 4.4); else pdf.text(txt, x + larg[i] - 1.5, y + 4.4, { align: "right" });
        x += larg[i];
      });
      cor(LINE, "draw"); pdf.line(M, y + lh, M + W, y + lh); y += lh;
    };
    linha(cab.map(c => c.toUpperCase()), true, true);
    linhas.forEach(l => linha(l, false, false));
  }
}
