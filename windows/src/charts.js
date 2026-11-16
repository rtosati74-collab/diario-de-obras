// Gráficos do relatório (Chart.js). Usados na prévia da tela e, em tamanho fixo, no PDF.
import { Chart, registerables } from "chart.js";
Chart.register(...registerables);

export const COR = {
  ink: "#18212B", muted: "#5A6573", grid: "#E3E7EC",
  plan: "#8A94A3", real: "#E2560B",
  // paleta categórica na ordem fixa (validada para daltonismo)
  cat: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"]
};
const OUTROS = "#9AA3AE";
Chart.defaults.font.family = '"Barlow","Segoe UI",system-ui,sans-serif';
Chart.defaults.font.size = 13;
Chart.defaults.color = COR.muted;

export const dm = iso => iso ? iso.slice(8, 10) + "/" + iso.slice(5, 7) : "";
export const pct = n => n == null ? "—" : String(Math.round(n * 10) / 10).replace(".", ",") + "%";

const eixo = (extra = {}) => ({ grid: { color: COR.grid, drawTicks: false }, border: { display: false }, ticks: { padding: 6 }, ...extra });
const legenda = { position: "top", align: "start", labels: { boxWidth: 12, boxHeight: 12, useBorderRadius: true, borderRadius: 3, color: COR.ink } };

// Linha vertical marcando o fim do período
const marcaFim = {
  id: "marcaFim",
  afterDatasetsDraw(chart, args, opts) {
    if (opts.index == null || opts.index < 0) return;
    const { ctx, chartArea: a, scales: { x } } = chart;
    const px = x.getPixelForValue(opts.index);
    ctx.save(); ctx.strokeStyle = COR.ink; ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(px, a.top); ctx.lineTo(px, a.bottom); ctx.stroke();
    ctx.setLineDash([]); ctx.fillStyle = COR.ink; ctx.font = "600 12px Barlow, sans-serif";
    ctx.textAlign = px > a.right - 90 ? "right" : "left";
    ctx.fillText(opts.texto || "", px + (ctx.textAlign === "right" ? -6 : 6), a.top + 12);
    ctx.restore();
  }
};

/** Curva previsto x realizado (% acumulado). */
export function curvaChart(canvas, dados, estatico) {
  const c = dados.curva;
  const idx = c.findIndex(p => p.data === dados.periodo.fim);
  return new Chart(canvas, {
    type: "line",
    data: {
      labels: c.map(p => dm(p.data)),
      datasets: [
        { label: "Previsto", data: c.map(p => p.previsto), borderColor: COR.plan, borderDash: [6, 4], borderWidth: 2, pointRadius: 0, tension: 0 },
        { label: "Realizado", data: c.map(p => p.realizado), borderColor: COR.real, backgroundColor: COR.real, borderWidth: 2.5, pointRadius: 3.5, pointHoverRadius: 6, spanGaps: true, tension: 0 }
      ]
    },
    options: base(estatico, {
      interaction: { mode: "index", intersect: false },
      scales: {
        x: eixo({ grid: { display: false }, ticks: { maxTicksLimit: 12, maxRotation: 0, autoSkip: true } }),
        y: eixo({ min: 0, max: 100, ticks: { stepSize: 25, callback: v => v + "%" } })
      },
      plugins: {
        legend: legenda,
        tooltip: { callbacks: { label: t => t.dataset.label + ": " + pct(t.raw) } },
        marcaFim: { index: idx, texto: "Fim do período " + dm(dados.periodo.fim) }
      }
    }),
    plugins: [marcaFim]
  });
}

/** Barras horizontais: previsto x realizado por etapa. */
export function etapasChart(canvas, dados, estatico) {
  const e = dados.etapas;
  return new Chart(canvas, {
    type: "bar",
    data: {
      labels: e.map(x => x.nome),
      datasets: [
        { label: "Previsto", data: e.map(x => x.previsto ?? 0), backgroundColor: COR.plan, borderRadius: 4, borderSkipped: "start", barPercentage: 0.8, categoryPercentage: 0.7 },
        { label: "Realizado", data: e.map(x => x.realizado), backgroundColor: COR.real, borderRadius: 4, borderSkipped: "start", barPercentage: 0.8, categoryPercentage: 0.7 }
      ]
    },
    options: base(estatico, {
      indexAxis: "y",
      scales: { x: eixo({ min: 0, max: 100, ticks: { stepSize: 25, callback: v => v + "%" } }), y: eixo({ grid: { display: false }, ticks: { color: COR.ink } }) },
      plugins: { legend: legenda, tooltip: { callbacks: { label: t => t.dataset.label + ": " + pct(t.raw) } } }
    })
  });
}

/** Efetivo diário empilhado por empreiteira. Mais de 7 empreiteiras: o resto vira "Outras". */
export function efetivoChart(canvas, dados, estatico) {
  let s = dados.efetivo.series.slice();
  if (s.length > 7) {
    const tot = x => x.valores.reduce((a, b) => a + b, 0);
    s.sort((a, b) => tot(b) - tot(a));
    const resto = s.slice(6);
    s = s.slice(0, 6).concat([{ nome: "Outras", valores: dados.efetivo.datas.map((_, i) => resto.reduce((a, r) => a + r.valores[i], 0)), outros: true }]);
  }
  return new Chart(canvas, {
    type: "bar",
    data: {
      labels: dados.efetivo.datas.map(dm),
      datasets: s.map((x, i) => ({ label: x.nome, data: x.valores, backgroundColor: x.outros ? OUTROS : COR.cat[i], borderColor: "#FFFFFF", borderWidth: { top: 2 }, borderSkipped: false, borderRadius: 2, maxBarThickness: 28 }))
    },
    options: base(estatico, {
      scales: { x: eixo({ stacked: true, grid: { display: false }, ticks: { maxTicksLimit: 16, maxRotation: 0 } }), y: eixo({ stacked: true, beginAtZero: true, ticks: { precision: 0 } }) },
      plugins: { legend: { ...legenda, display: s.length > 1 }, tooltip: { mode: "index", intersect: false } }
    })
  });
}

/** Turnos (manhã + tarde) por condição do tempo. */
export function climaChart(canvas, dados, estatico) {
  const c = dados.clima;
  return new Chart(canvas, {
    type: "bar",
    data: { labels: ["Sol", "Instável", "Chuva"], datasets: [{ label: "Turnos", data: [c.S, c.I, c.C], backgroundColor: COR.cat[0], borderRadius: 4, borderSkipped: "start", barPercentage: 0.6 }] },
    options: base(estatico, {
      indexAxis: "y",
      scales: { x: eixo({ beginAtZero: true, ticks: { precision: 0 } }), y: eixo({ grid: { display: false }, ticks: { color: COR.ink } }) },
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: t => t.raw + " turno(s)" } } }
    })
  });
}

// Fundo branco nos gráficos exportados (JPEG não tem transparência)
const fundoBranco = { id: "fundoBranco", beforeDraw(c) { const x = c.ctx; x.save(); x.globalCompositeOperation = "destination-over"; x.fillStyle = "#FFFFFF"; x.fillRect(0, 0, c.width, c.height); x.restore(); } };
Chart.register(fundoBranco);
function base(estatico, o) {
  return { responsive: !estatico, maintainAspectRatio: false, animation: estatico ? false : { duration: 250 }, devicePixelRatio: estatico ? 3 : undefined, layout: { padding: { top: 4, right: 12 } }, ...o };
}

/** Desenha um gráfico fora da tela e devolve PNG (para o PDF). */
export function grafico(fn, dados, largura, altura) {
  const host = document.createElement("div");
  host.style.cssText = `position:fixed;left:-20000px;top:0;width:${largura}px;height:${altura}px`;
  const cv = document.createElement("canvas");
  cv.width = largura; cv.height = altura; cv.style.width = largura + "px"; cv.style.height = altura + "px";
  host.appendChild(cv); document.body.appendChild(host);
  const ch = fn(cv, dados, true);
  const png = ch.toBase64Image("image/jpeg", 0.9);
  ch.destroy(); host.remove();
  return png;
}
