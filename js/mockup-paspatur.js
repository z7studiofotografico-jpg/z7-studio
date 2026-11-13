// Prévia do Kit Paspatur de fotos (08/11/2026): livro A4 + encarte. Dois modelos, quase iguais: colégio público leva
// o calendário com a foto do aluno; colégio particular leva a foto da turma (st.encarte = "calendario" | "turma").
// - Imagem: capa fechada e calendário em cima; o livro aberto embaixo, com as fotos nos tamanhos de verdade.
// - Vídeo (~11 s): a capa abre como um livro, aparecem as fotos, entra o calendário e a capa fecha.
// Mesmo estilo e marca d'água da prévia do quadro (mockup.js).
//   página da direita: 1 foto 29x21 · página da esquerda: 1 foto 21x15 e 3 fotos 7x5 · no meio: tira com 6 fotos 4x3
// Lugares (st.slots): 0 = página da direita, 1 = foto grande da esquerda, 2 = as 3 pequenas, 3 = a tira de 6,
// 4 = a foto do calendário ou a foto da turma (A4 deitada, já pronta). st.anoCal = ano do calendário.
export const ehTurma = st => st.encarte === "turma";
import { cover, marca, prep, logoAtual, loadImg, exemplo, blocoPreco } from "./mockup.js";

export const W = 1080,
  H = 1350;
const TINTA = "#1c1b1d",
  CINZA = "#6b6670",
  VERMELHO = "#b3202a",
  S = 21; // escala das camadas: 1 cm = 21 px (página A4 = 441 x 624)
const PW = Math.round(21 * S),
  PH = Math.round(29.7 * S),
  TW = Math.round(4.2 * S);
let capaImg = null;

// ano do calendário: a partir de agosto, o do ano que vem (o kit é entregue no fim do ano)
export const anoCalendario = (d = new Date()) => d.getFullYear() + (d.getMonth() >= 7 ? 1 : 0);

// Sugestão automática: as fotos mais "em pé" vão para as páginas; as próximas, nas pequenas, na tira e no calendário
export function sugerirPaspatur(fotos, encarte) {
  const ordem = fotos
    .map((f, i) => [i, f.height / Math.max(1, f.width)])
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .map(([i]) => i);
  const k = n => ordem[Math.min(n, ordem.length - 1)] ?? 0;
  // foto da turma: a mais "deitada" das fotos (a montagem da turma é A4 deitada)
  const deitada = ordem[ordem.length - 1] ?? 0;
  return [k(0), k(1), k(2), k(3), encarte === "turma" ? deitada : k(4)];
}

const tela = (w, h) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};
// uma foto colada na página (com marca d'água e um filete, como a janela do paspatur)
function foto(ctx, img, x, y, w, h) {
  if (img) {
    cover(ctx, img, x, y, w, h);
    marca(ctx, x, y, w, h);
  } else exemplo(ctx, x, y, w, h);
  ctx.strokeStyle = "rgba(0,0,0,.35)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, w, h);
}
function papel(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, "#fbf8f2");
  g.addColorStop(1, "#f1ebe0");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}
function wrap(ctx, text, x, y, maxW, lh) {
  let line = "",
    yy = y;
  for (const w of String(text).split(/\s+/)) {
    const t = line ? line + " " + w : w;
    if (ctx.measureText(t).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = w;
      yy += lh;
    } else line = t;
  }
  if (line) ctx.fillText(line, x, yy);
  return yy;
}
function caixaRedonda(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---------- as peças do kit (desenhadas uma vez, na escala de 1 cm = 21 px) ----------
// lado de dentro da capa: página da esquerda + a tira de 6
function ladoEsquerdo(st, f) {
  const c = tela(PW + TW, PH),
    ctx = c.getContext("2d");
  papel(ctx, PW + TW, PH);
  const m = 0.45 * S,
    gw = 15 * S,
    gh = 20.4 * S,
    gx = (PW - gw) / 2,
    gy = m;
  foto(ctx, f(1), gx, gy, gw, gh);
  const pwid = 4.8 * S,
    phei = 6.7 * S,
    gap = (gw - 3 * pwid) / 2,
    py = gy + gh + 0.35 * S;
  for (let i = 0; i < 3; i++) foto(ctx, f(2), gx + i * (pwid + gap), py, pwid, phei);
  ctx.fillStyle = "#3b3739";
  ctx.font = "italic 600 15px 'Source Sans 3', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText((st.nome || "Nome do aluno").toUpperCase().slice(0, 48), PW / 2, PH - 0.45 * S);
  // a tira (com a dobra dos dois lados)
  const sw = 3 * S,
    sh = 4 * S,
    sg = (PH - 6 * sh) / 7;
  for (let i = 0; i < 6; i++) foto(ctx, f(3), PW + (TW - sw) / 2, sg + i * (sh + sg), sw, sh);
  [PW, PW + TW].forEach(cx => {
    const d = ctx.createLinearGradient(cx - 12, 0, cx + 12, 0);
    d.addColorStop(0, "rgba(0,0,0,0)");
    d.addColorStop(0.5, "rgba(0,0,0,.16)");
    d.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = d;
    ctx.fillRect(cx - 12, 0, 24, PH);
  });
  return c;
}
function ladoDireito(f) {
  const c = tela(PW, PH),
    ctx = c.getContext("2d");
  papel(ctx, PW, PH);
  const m = 0.35 * S;
  foto(ctx, f(0), m, m, PW - 2 * m, PH - 2 * m);
  return c;
}
function capa() {
  const c = tela(PW, PH),
    ctx = c.getContext("2d");
  ctx.fillStyle = "#f4f4f4";
  ctx.fillRect(0, 0, PW, PH);
  if (capaImg) ctx.drawImage(capaImg, 0, 0, PW, PH);
  return c;
}
// calendário A4 com a foto do aluno (como o do kit: ano e 4 meses ao lado da foto, os outros 8 embaixo)
const MESES = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
function mes(ctx, ano, m, x, y, w) {
  ctx.strokeStyle = "#8b9bb0";
  ctx.lineWidth = 1.2;
  ctx.fillStyle = "#eef2f7";
  caixaRedonda(ctx, x + 2, y, w - 4, 15, 7);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#33415a";
  ctx.font = "700 10px 'Source Sans 3', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(MESES[m], x + w / 2, y + 8);
  const cw = w / 7;
  ctx.font = "700 7.5px 'Source Sans 3', sans-serif";
  ["D", "S", "T", "Q", "Q", "S", "S"].forEach((d, i) => ctx.fillText(d, x + cw * (i + 0.5), y + 23));
  const ini = new Date(ano, m, 1).getDay(),
    dias = new Date(ano, m + 1, 0).getDate();
  ctx.font = "600 7.5px 'Source Sans 3', sans-serif";
  for (let d = 1; d <= dias; d++) {
    const k = ini + d - 1;
    ctx.fillStyle = k % 7 === 0 ? VERMELHO : "#2b2b2b";
    ctx.fillText(String(d), x + cw * ((k % 7) + 0.5), y + 34 + Math.floor(k / 7) * 10.5);
  }
}
function calendario(st, f) {
  const c = tela(PW, PH),
    ctx = c.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, PW, PH);
  // enfeite: quadrados azuis claros
  ctx.strokeStyle = "rgba(120,170,215,.35)";
  ctx.lineWidth = 6;
  [
    [-30, 40, 140, 120],
    [330, 520, 160, 140],
    [-20, 560, 120, 90],
    [300, -30, 120, 90]
  ].forEach(([x, y, w, h]) => ctx.strokeRect(x, y, w, h));
  const ano = Number(st.anoCal) || anoCalendario();
  ctx.fillStyle = "#4a4a4a";
  ctx.font = "800 64px 'Barlow Condensed', sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(String(ano), 22, 88);
  // a foto (em pé, com borda branca e sombra), à direita
  const fx = 236,
    fy = 26,
    fw = 182,
    fh = 250;
  ctx.save();
  ctx.translate(fx + fw / 2, fy + fh / 2);
  ctx.rotate(0.02);
  ctx.shadowColor = "rgba(0,0,0,.3)";
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = "#fff";
  ctx.fillRect(-fw / 2 - 6, -fh / 2 - 6, fw + 12, fh + 12);
  ctx.shadowColor = "transparent";
  foto(ctx, f(4), -fw / 2, -fh / 2, fw, fh);
  ctx.restore();
  // 4 meses ao lado da foto e 8 embaixo
  const mw = 100;
  [0, 1, 2, 3].forEach(m => mes(ctx, ano, m, 12 + (m % 2) * (mw + 6), 110 + Math.floor(m / 2) * 92, mw));
  for (let m = 4; m < 12; m++) mes(ctx, ano, m, 12 + ((m - 4) % 4) * (mw + 4), 300 + Math.floor((m - 4) / 4) * 98, mw);
  ctx.fillStyle = TINTA;
  ctx.font = "700 13px 'Source Sans 3', sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("www.z7studio.com.br", PW - 16, PH - 14);
  ctx.strokeStyle = "rgba(0,0,0,.12)";
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, PW - 1, PH - 1);
  return c;
}
// foto da turma: a montagem pronta, A4 deitada, com a marca d'água da prévia
function turma(f) {
  const c = tela(PH, PW),
    ctx = c.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, PH, PW);
  foto(ctx, f(4), 0, 0, PH, PW);
  return c;
}
async function pecas(st) {
  await prep();
  if (!capaImg) {
    try {
      capaImg = await loadImg("icons/paspatur-capa.jpg");
    } catch (_) {}
  }
  const f = i => st.fotos[st.slots[i]] ?? st.fotos[0] ?? null;
  return { esq: ladoEsquerdo(st, f), dir: ladoDireito(f), capa: capa(), cal: ehTurma(st) ? turma(f) : calendario(st, f) };
}

// ---------- fundo e textos (iguais na imagem e no vídeo) ----------
// parede cinza e mesa grafite embaixo, igual à prévia do quadro (11/11/2026: antes bege)
const MESA = 900;
function fundo(ctx) {
  const bg = ctx.createLinearGradient(0, 0, 0, MESA);
  bg.addColorStop(0, "#ededee");
  bg.addColorStop(1, "#d5d7da");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, MESA);
  const tb = ctx.createLinearGradient(0, MESA, 0, H);
  tb.addColorStop(0, "#55595f");
  tb.addColorStop(0.08, "#3a3d42");
  tb.addColorStop(1, "#202225");
  ctx.fillStyle = tb;
  ctx.fillRect(0, MESA, W, H - MESA);
}
// título, nome, colégio (grande) e preço; maxW = largura da coluna de texto
function textos(ctx, st, maxW, comPreco = true) {
  const x = 60;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = VERMELHO;
  ctx.font = "700 30px 'Barlow Condensed', sans-serif";
  ctx.fillText("KIT PASPATUR DE FOTOS", x, 88);
  ctx.fillStyle = TINTA;
  ctx.font = "700 62px 'Barlow Condensed', sans-serif";
  let y = wrap(ctx, (st.nome || "").trim().split(/\s+/).slice(0, 2).join(" ").toUpperCase() || "SEU NOME", x, 150, maxW, 60);
  if (st.escola) {
    ctx.fillStyle = "#4a4549";
    ctx.font = "700 34px 'Source Sans 3', sans-serif";
    y = wrap(ctx, st.escola, x, y + 52, maxW, 38);
  }
  ctx.fillStyle = CINZA;
  ctx.font = "600 24px 'Source Sans 3', sans-serif";
  y = wrap(ctx, `Livro com as fotos do ensaio + ${ehTurma(st) ? "foto da turma" : "calendário"}`, x, y + 46, maxW, 30);
  if (st.preco && comPreco) blocoPreco(ctx, st, x, y + 30, maxW);
}
function rodape(ctx) {
  const lg = logoAtual(),
    ly = H - 120;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  if (lg) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(92, ly + 32, 32, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(lg, 60, ly, 64, 64);
    ctx.restore();
  }
  ctx.fillStyle = "#f0eef0";
  ctx.font = "700 30px 'Barlow Condensed', sans-serif";
  ctx.fillText("Z7 STUDIO", 140, ly + 32);
  ctx.fillStyle = "#a39fa6";
  ctx.font = "400 20px 'Source Sans 3', sans-serif";
  ctx.fillText("Fotográfico", 140, ly + 58);
  ctx.textAlign = "right";
  ctx.font = "400 18px 'Source Sans 3', sans-serif";
  ctx.fillText("Prévia com marca d'água · as fotos entregues não têm marca", W - 60, ly + 58);
}
// uma peça com sombra, girada (a = ângulo) e centrada em cx, cy
function peca(ctx, img, cx, cy, w, h, a = 0) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(a);
  ctx.shadowColor = "rgba(0,0,0,.35)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 10;
  ctx.fillStyle = "#fff";
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.shadowColor = "transparent";
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();
}

// ---------- o livro: a capa gira na lombada (entre a tira e a página da direita) ----------
// ---------- a imagem ----------
export async function desenharPaspatur(cv, st) {
  const P = await pecas(st);
  const ctx = cv.getContext("2d");
  cv.width = W;
  cv.height = H;
  fundo(ctx);
  textos(ctx, st, 470, false);
  // em cima à direita: a capa fechada e o calendário
  const pw = 210,
    ph = Math.round(pw * 1.414);
  if (ehTurma(st)) {
    // foto da turma deitada, atrás da capa
    peca(ctx, P.cal, 850, 250, 300, Math.round(300 / 1.414), 0.05);
    peca(ctx, P.capa, 650, 200, pw, ph, -0.05);
  } else {
    peca(ctx, P.cal, 905, 205, pw, ph, 0.07);
    peca(ctx, P.capa, 690, 200, pw, ph, -0.05);
  }
  // embaixo: o livro aberto
  const k = 0.98,
    lw = (PW + TW) * k,
    pw2 = PW * k,
    x0 = (W - lw - pw2) / 2,
    topo = 440;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.35)";
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 18;
  ctx.fillStyle = "#d8cfc0";
  ctx.fillRect(x0 - 8, topo - 8, lw + pw2 + 16, PH * k + 16);
  ctx.restore();
  ctx.drawImage(P.esq, x0, topo, lw, PH * k);
  ctx.drawImage(P.dir, x0 + lw, topo, pw2, PH * k);
  const d = ctx.createLinearGradient(x0 + lw - 14, 0, x0 + lw + 14, 0);
  d.addColorStop(0, "rgba(0,0,0,0)");
  d.addColorStop(0.5, "rgba(0,0,0,.2)");
  d.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = d;
  ctx.fillRect(x0 + lw - 14, topo, 28, PH * k);
  if (st.preco) precoNaMesa(ctx, st, topo + PH * k + 24);
  rodape(ctx);
}
// o preço na mesa grafite, embaixo do livro: o Pix à esquerda e o cartão à direita (mesmas cores, em claro)
function precoNaMesa(ctx, st, y) {
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "rgba(255,255,255,.12)";
  ctx.fillRect(60, y, W - 120, 2);
  ctx.fillStyle = "#e0525b";
  ctx.font = "700 60px 'Barlow Condensed', sans-serif";
  ctx.fillText(st.preco, 60, y + 68);
  const lp = ctx.measureText(st.preco).width;
  ctx.fillStyle = "#a39fa6";
  ctx.font = "600 22px 'Source Sans 3', sans-serif";
  ctx.fillText("no Pix", 60 + lp + 12, y + 66);
  if (!st.cartao) return;
  const [valor, parc] = String(st.cartao).split(" · ");
  const xc = W / 2 + 20;
  ctx.fillStyle = "#f0eef0";
  ctx.font = "700 28px 'Source Sans 3', sans-serif";
  ctx.fillText("ou " + valor, xc, y + 42);
  if (parc) {
    ctx.fillStyle = "#a39fa6";
    ctx.font = "600 21px 'Source Sans 3', sans-serif";
    ctx.fillText(parc.replace(" ou até ", " · "), xc, y + 72);
  }
}

// ---------- o vídeo ----------
export const DURACAO = 11; // segundos
const suave = x => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
// um quadro do vídeo no tempo t (segundos). Roteiro: fechado → abre → fotos → calendário → fecha
function quadro(ctx, P, st, t, fixo) {
  ctx.drawImage(fixo, 0, 0); // fundo, textos e rodapé (prontos)
  const abre = suave((t - 1) / 1.6) - suave((t - 8.6) / 1.6); // 0 fechado, 1 aberto
  const cal = suave((t - 4.6) / 0.8) - suave((t - 7.4) / 0.8); // 0 fora, 1 no meio
  const k = 0.98,
    lw = (PW + TW) * k,
    pw = PW * k,
    topo = 430;
  // a lombada anda: fechado, a capa fica no meio da tela; aberto, o livro inteiro fica no meio
  const xAberto = (W - lw - pw) / 2 + lw,
    xFechado = (W - pw) / 2;
  const xL = xFechado + (xAberto - xFechado) * abre;
  // quando o calendário entra, o livro some quase todo e o calendário fica sozinho no meio
  ctx.save();
  ctx.globalAlpha = 1 - cal * 0.9;
  livroEm(ctx, P, abre, xL, topo, k);
  ctx.restore();
  if (cal > 0) {
    // o encarte sozinho no meio (a foto da turma é deitada: ocupa a largura)
    const e = 1.04,
      turmaDeitada = P.cal.width > P.cal.height,
      cw = turmaDeitada ? W - 80 : PW * e,
      ch = turmaDeitada ? (W - 80) / 1.414 : PH * e;
    const cx = W / 2 + (1 - cal) * (W / 2 + cw / 2);
    peca(ctx, P.cal, cx, topo + (PH * k) / 2, cw, ch, 0.05 * (1 - cal));
  }
}
// o livro com a lombada em xL e a abertura p (0 a 1)
function livroEm(ctx, P, p, xL, topo, k) {
  const pw = PW * k,
    ph = PH * k,
    lw = (PW + TW) * k;
  const ang = p * Math.PI,
    cos = Math.cos(ang);
  const esq = cos < 0 ? lw * -cos : 0;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.35)";
  ctx.shadowBlur = 34;
  ctx.shadowOffsetY = 16;
  ctx.fillStyle = "#d8cfc0";
  ctx.fillRect(xL - esq - 6, topo - 6, esq + pw + 12, ph + 12);
  ctx.restore();
  ctx.drawImage(P.dir, xL, topo, pw, ph);
  if (cos > 0) {
    const w = pw * cos;
    ctx.drawImage(P.capa, xL, topo, w, ph);
    ctx.fillStyle = `rgba(0,0,0,${0.3 * (1 - cos)})`;
    ctx.fillRect(xL, topo, w, ph);
  } else {
    ctx.drawImage(P.esq, xL - esq, topo, esq, ph);
    ctx.fillStyle = `rgba(0,0,0,${0.3 * (1 + cos)})`;
    ctx.fillRect(xL - esq, topo, esq, ph);
  }
  const d = ctx.createLinearGradient(xL - 14, 0, xL + 14, 0);
  d.addColorStop(0, "rgba(0,0,0,0)");
  d.addColorStop(0.5, `rgba(0,0,0,${0.22 * Math.min(1, p * 2)})`);
  d.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = d;
  ctx.fillRect(xL - 14, topo, 28, ph);
}
async function prepararVideo(st) {
  const P = await pecas(st);
  const fixo = tela(W, H),
    fx = fixo.getContext("2d");
  fundo(fx);
  textos(fx, st, 960);
  rodape(fx);
  return { P, fixo };
}
// desenha o quadro do tempo t (usado pelos testes e para gerar o vídeo fora do celular)
export async function quadroDoVideo(cv, st, t) {
  const { P, fixo } = await prepararVideo(st);
  cv.width = W;
  cv.height = H;
  quadro(cv.getContext("2d"), P, st, t, fixo);
}
// toca a animação no canvas da janela; devolve uma função para parar
export async function tocar(cv, st, aoAcabar) {
  const { P, fixo } = await prepararVideo(st);
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext("2d");
  const t0 = performance.now();
  let parar = false;
  const passo = agora => {
    if (parar) return;
    const t = (agora - t0) / 1000;
    quadro(ctx, P, st, Math.min(t, DURACAO), fixo);
    if (t < DURACAO) requestAnimationFrame(passo);
    else if (aoAcabar) aoAcabar();
  };
  requestAnimationFrame(passo);
  return () => (parar = true);
}
// grava o vídeo (MP4 quando o aparelho grava MP4; senão WebM). Devolve { blob, tipo } ou null se não der.
export const tipoVideo = () =>
  typeof MediaRecorder === "undefined"
    ? ""
    : ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm"].find(t => MediaRecorder.isTypeSupported(t)) || "";
export async function gravarVideo(cv, st) {
  const tipo = tipoVideo();
  if (!tipo || !cv.captureStream) return null;
  const rec = new MediaRecorder(cv.captureStream(30), { mimeType: tipo, videoBitsPerSecond: 4_000_000 });
  const partes = [];
  rec.ondataavailable = e => e.data && e.data.size && partes.push(e.data);
  const fim = new Promise(res => (rec.onstop = res));
  rec.start(250);
  await new Promise(res => tocar(cv, st, res));
  await new Promise(r => setTimeout(r, 300));
  rec.stop();
  await fim;
  return { blob: new Blob(partes, { type: tipo.split(";")[0] }), tipo: tipo.split(";")[0] };
}
