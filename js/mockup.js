// Prévia do kit e folha de escolha das fotos.
// - "Prévia do kit": quadro 30x40 (moldura preta) + 2 porta-retratos 15x10 em pé, com as fotos escolhidas.
// - "Fotos para escolher": todas as fotos do ensaio numeradas, para o formando escolher o que vai em cada lugar.
// Toda imagem sai com marca d'água repetida (um print não serve como foto final).
import { el, avisoErro } from "./ui.js";
import { noComputador, copiarImagem, abrirWhatsAppWeb } from "./enviar-computador.js";
const W = 1080,
  H = 1350;
let logoImg = null;

function loadImg(src) {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
}
// Foto do celular (12 MP ou mais) → reduzida para no máximo 1600 px, e o arquivo é liberado da memória.
// (antes a foto ficava inteira na memória e o endereço nunca era liberado: com várias fotos o celular travava)
// Formatura (até ~70 fotos): 1000 px, senão a memória do celular passa de ~400 MB e as imagens somem no iPhone
const LADO_MAX = 1600;
async function fileToImg(f, ladoMax = LADO_MAX) {
  const url = URL.createObjectURL(f);
  try {
    const img = await loadImg(url);
    const r = Math.min(1, ladoMax / Math.max(img.width, img.height));
    if (r === 1) {
      const c0 = document.createElement("canvas");
      c0.width = img.width;
      c0.height = img.height;
      c0.getContext("2d").drawImage(img, 0, 0);
      return c0;
    }
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * r);
    c.height = Math.round(img.height * r);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return c;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function cover(ctx, img, x, y, w, h, fy = 0.38) {
  const r = Math.max(w / img.width, h / img.height);
  const sw = w / r,
    sh = h / r;
  const sx = (img.width - sw) / 2,
    sy = Math.max(0, Math.min(img.height - sh, (img.height - sh) * fy));
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}
// Marca d'água repetida em diagonal dentro de um retângulo.
// forte = true: marca mais junta e mais visível (folhas que vão para o diretor/colégio)
function marca(ctx, x, y, w, h, forte = false) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const fs = Math.max(14, Math.round(Math.min(w, h) / (forte ? 14 : 9)));
  ctx.font = `700 ${fs}px 'Barlow Condensed', sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(-Math.PI / 7);
  const step = fs * (forte ? 1.9 : 2.6),
    span = Math.hypot(w, h);
  for (let yy = -span / 2; yy <= span / 2; yy += step) {
    for (let xx = -span / 2; xx <= span / 2; xx += fs * (forte ? 10 : 9)) {
      ctx.fillStyle = forte ? "rgba(255,255,255,.36)" : "rgba(255,255,255,.28)";
      ctx.fillText("PRÉVIA · Z7 STUDIO", xx + (Math.round(yy / step) % 2) * fs * 4.5, yy);
      ctx.fillStyle = "rgba(0,0,0,.10)";
      ctx.fillText("PRÉVIA · Z7 STUDIO", xx + (Math.round(yy / step) % 2) * fs * 4.5 + 1.5, yy + 1.5);
    }
  }
  ctx.restore();
}
// Sem foto ainda: uma foto de exemplo desenhada (formando de beca e capelo num fundo de estúdio), em vez do quadro branco
export function exemplo(ctx, x, y, w, h) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const bg = ctx.createRadialGradient(x + w / 2, y + h * 0.35, 10, x + w / 2, y + h * 0.45, Math.max(w, h));
  bg.addColorStop(0, "#d8c7b2");
  bg.addColorStop(0.55, "#9c8670");
  bg.addColorStop(1, "#4b3d31");
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  const cx = x + w / 2,
    u = Math.min(w, h * 0.75);
  // beca (ombros e corpo)
  const beca = ctx.createLinearGradient(cx - u * 0.5, 0, cx + u * 0.5, 0);
  beca.addColorStop(0, "#14182b");
  beca.addColorStop(0.5, "#252b47");
  beca.addColorStop(1, "#14182b");
  ctx.fillStyle = beca;
  ctx.beginPath();
  ctx.moveTo(cx - u * 0.46, y + h);
  ctx.quadraticCurveTo(cx - u * 0.44, y + h * 0.66, cx - u * 0.12, y + h * 0.6);
  ctx.lineTo(cx + u * 0.12, y + h * 0.6);
  ctx.quadraticCurveTo(cx + u * 0.44, y + h * 0.66, cx + u * 0.46, y + h);
  ctx.closePath();
  ctx.fill();
  // faixa
  ctx.fillStyle = "#b3202a";
  ctx.beginPath();
  ctx.moveTo(cx - u * 0.12, y + h * 0.6);
  ctx.lineTo(cx - u * 0.04, y + h);
  ctx.lineTo(cx - u * 0.12, y + h);
  ctx.lineTo(cx - u * 0.2, y + h * 0.63);
  ctx.closePath();
  ctx.fill();
  // pescoço e rosto
  ctx.fillStyle = "#c69c7d";
  ctx.fillRect(cx - u * 0.06, y + h * 0.5, u * 0.12, h * 0.11);
  ctx.beginPath();
  ctx.ellipse(cx, y + h * 0.43, u * 0.13, u * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
  // capelo
  ctx.fillStyle = "#111";
  ctx.beginPath();
  ctx.moveTo(cx, y + h * 0.27);
  ctx.lineTo(cx + u * 0.26, y + h * 0.31);
  ctx.lineTo(cx, y + h * 0.35);
  ctx.lineTo(cx - u * 0.26, y + h * 0.31);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(cx - u * 0.13, y + h * 0.32, u * 0.26, h * 0.05);
  ctx.strokeStyle = "#d4a017";
  ctx.lineWidth = Math.max(2, u * 0.012);
  ctx.beginPath();
  ctx.moveTo(cx, y + h * 0.31);
  ctx.lineTo(cx + u * 0.2, y + h * 0.33);
  ctx.lineTo(cx + u * 0.2, y + h * 0.42);
  ctx.stroke();
  // aviso discreto
  ctx.fillStyle = "rgba(255,255,255,.85)";
  ctx.font = `600 ${Math.max(14, Math.round(u * 0.07))}px 'Source Sans 3', sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("foto de exemplo", cx, y + h * 0.12);
  ctx.restore();
}
// Sugestão automática: no quadro, a foto mais "em pé" (retrato); nos porta-retratos, as próximas, sem repetir
export function sugerirSlots(fotos) {
  const idx = fotos.map((f, i) => [i, f.height / Math.max(1, f.width)]);
  const quadro = idx.length ? idx.slice().sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0] : 0;
  const resto = idx.map(([i]) => i).filter(i => i !== quadro);
  return [quadro, resto[0] ?? quadro, resto[1] ?? resto[0] ?? quadro];
}
function moldura(ctx, x, y, w, h, b, img, opts = {}) {
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.45)";
  ctx.shadowBlur = opts.blur || 40;
  ctx.shadowOffsetY = opts.off || 18;
  ctx.fillStyle = "#111";
  ctx.fillRect(x, y, w, h);
  ctx.restore();
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, "#2a2a2a");
  g.addColorStop(0.5, "#0d0d0d");
  g.addColorStop(1, "#1c1c1c");
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "rgba(255,255,255,.12)";
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  const ix = x + b,
    iy = y + b,
    iw = w - 2 * b,
    ih = h - 2 * b;
  if (img) cover(ctx, img, ix, iy, iw, ih);
  else exemplo(ctx, ix, iy, iw, ih);
  if (img && opts.marca !== false) marca(ctx, ix, iy, iw, ih);
  ctx.strokeStyle = "rgba(0,0,0,.6)";
  ctx.lineWidth = 3;
  ctx.strokeRect(ix, iy, iw, ih);
  const gl = ctx.createLinearGradient(ix, iy, ix + iw, iy + ih);
  gl.addColorStop(0, "rgba(255,255,255,.10)");
  gl.addColorStop(0.35, "rgba(255,255,255,0)");
  ctx.fillStyle = gl;
  ctx.fillRect(ix, iy, iw, ih);
}
function wrap(ctx, text, x, y, maxW, lh) {
  const words = String(text).split(/\s+/);
  let line = "",
    yy = y;
  for (const w of words) {
    const t = line ? line + " " + w : w;
    if (ctx.measureText(t).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = w;
      yy += lh;
    } else line = t;
  }
  if (line) ctx.fillText(line, x, yy);
}
async function prep() {
  try {
    await document.fonts.load("700 40px 'Barlow Condensed'");
    await document.fonts.load("600 20px 'Source Sans 3'");
  } catch (_) {}
  if (!logoImg) {
    try {
      logoImg = await loadImg("icons/icon-192.png");
    } catch (_) {}
  }
}
function rodape(ctx, cor) {
  ctx.fillStyle = cor;
  ctx.font = "400 20px 'Source Sans 3', sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("Prévia com marca d'água · reprodução proibida · as fotos entregues não têm marca", 60, H - 30);
}

async function desenharKit(cv, st) {
  await prep();
  const ctx = cv.getContext("2d");
  cv.width = W;
  cv.height = H;
  // parede cinza e mesa grafite (11/11/2026: combina com o app e o site; antes bege e madeira)
  const wall = ctx.createLinearGradient(0, 0, 0, 980);
  wall.addColorStop(0, "#ededee");
  wall.addColorStop(1, "#d5d7da");
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, W, 980);
  const tb = ctx.createLinearGradient(0, 980, 0, H);
  tb.addColorStop(0, "#55595f");
  tb.addColorStop(0.08, "#3a3d42");
  tb.addColorStop(1, "#202225");
  ctx.fillStyle = tb;
  ctx.fillRect(0, 980, W, H - 980);
  ctx.fillStyle = "rgba(255,255,255,.08)";
  ctx.fillRect(0, 980, W, 6);
  const f = i => st.fotos[st.slots[i]] || st.fotos[0] || null;
  moldura(ctx, 80, 110, 540, 720, 30, f(0), { blur: 50, off: 24 });
  const x = 670;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#b3202a";
  ctx.font = "700 30px 'Barlow Condensed', sans-serif";
  ctx.fillText("KIT RECORDAÇÃO", x, 170);
  ctx.fillStyle = "#1c1b1d";
  ctx.font = "700 58px 'Barlow Condensed', sans-serif";
  wrap(ctx, (st.nome || "").trim().split(/\s+/).slice(0, 2).join(" ").toUpperCase() || "SEU NOME", x, 232, 360, 58);
  ctx.fillStyle = "#4a4549";
  ctx.font = "600 26px 'Source Sans 3', sans-serif";
  ["Quadro 30x40 · moldura preta", "2 porta-retratos 15x10", "Fotos digitais do ensaio"].forEach((t, i) =>
    ctx.fillText("• " + t, x, 360 + i * 40)
  );
  if (st.escola) {
    ctx.fillStyle = "#6b6670";
    ctx.font = "400 22px 'Source Sans 3', sans-serif";
    wrap(ctx, st.escola, x, 500, 360, 28);
  }
  if (st.preco) {
    ctx.fillStyle = "#b3202a";
    ctx.font = "700 64px 'Barlow Condensed', sans-serif";
    ctx.fillText(st.preco, x, 640);
    ctx.fillStyle = "#6b6670";
    ctx.font = "600 22px 'Source Sans 3', sans-serif";
    ctx.fillText("no Pix", x, 676);
  }
  if (logoImg) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + 40, 770, 40, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(logoImg, x, 730, 80, 80);
    ctx.restore();
  }
  ctx.fillStyle = "#1c1b1d";
  ctx.font = "700 30px 'Barlow Condensed', sans-serif";
  ctx.fillText("Z7 STUDIO", x + 96, 765);
  ctx.fillStyle = "#6b6670";
  ctx.font = "400 20px 'Source Sans 3', sans-serif";
  ctx.fillText("Fotográfico", x + 96, 792);
  // porta-retratos 15x10 em pé sobre o aparador
  moldura(ctx, 560, 900, 220, 330, 16, f(1), { blur: 24, off: 12 });
  moldura(ctx, 810, 930, 210, 315, 16, f(2), { blur: 24, off: 12 });
  rodape(ctx, "rgba(255,255,255,.6)");
}

async function desenharEscolha(cv, st, kit = "pr") {
  await prep();
  const ctx = cv.getContext("2d");
  const n = Math.max(1, st.fotos.length),
    cols = n <= 4 ? 2 : n <= 9 ? 3 : 4,
    rows = Math.ceil(n / cols);
  cv.width = W;
  cv.height = H;
  ctx.fillStyle = "#141315";
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#e0525b";
  ctx.font = "700 30px 'Barlow Condensed', sans-serif";
  ctx.fillText("ESCOLHA AS SUAS FOTOS", 60, 80);
  ctx.fillStyle = "#f0eef0";
  ctx.font = "700 52px 'Barlow Condensed', sans-serif";
  ctx.fillText(((st.nome || "").trim().split(/\s+/).slice(0, 2).join(" ") || "Ensaio de formatura").toUpperCase(), 60, 138);
  ctx.fillStyle = "#a39fa6";
  ctx.font = "400 24px 'Source Sans 3', sans-serif";
  ctx.fillText(
    kit === "paspatur"
      ? "Responda com o número: qual vai em cada lugar do Kit Paspatur."
      : "Responda com o número: qual vai no quadro e quais vão nos 2 porta-retratos.",
    60,
    178
  );
  if (logoImg) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(W - 100, 105, 44, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(logoImg, W - 144, 61, 88, 88);
    ctx.restore();
  }
  const top = 210,
    bottom = H - 70,
    gap = 20,
    gx = 60;
  const cw = (W - 2 * gx - (cols - 1) * gap) / cols,
    ch = (bottom - top - (rows - 1) * gap) / rows;
  st.fotos.forEach((img, i) => {
    const c = i % cols,
      r = Math.floor(i / cols),
      x = gx + c * (cw + gap),
      y = top + r * (ch + gap);
    // foto inteira (sem cortar), centralizada na célula
    const sc = Math.min(cw / img.width, ch / img.height),
      w = img.width * sc,
      h = img.height * sc,
      ox = x + (cw - w) / 2,
      oy = y + (ch - h) / 2;
    ctx.drawImage(img, ox, oy, w, h);
    marca(ctx, ox, oy, w, h);
    ctx.fillStyle = "#e0525b";
    ctx.beginPath();
    ctx.arc(ox + 40, oy + 40, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "700 38px 'Barlow Condensed', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(i + 1), ox + 40, oy + 42);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  });
  if (!st.fotos.length) {
    ctx.fillStyle = "#a39fa6";
    ctx.font = "600 30px 'Source Sans 3', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Arraste as fotos do ensaio", W / 2, H / 2);
  }
  rodape(ctx, "#a39fa6");
}

export const textoEscolha = (F, kit) =>
  kit === "paspatur"
    ? `Aqui estão as fotos do ensaio${F ? " de " + F : ""}! 📸 Escolhe as fotos do Kit Paspatur: a grande da direita, a grande da esquerda, as 3 pequenas, a tirinha e a do calendário. É só responder com os números, por exemplo: Direita 2, esquerda 1, pequenas 4, tirinha 3, calendário 5 😊`
    : `Aqui estão as fotos do ensaio${F ? " de " + F : ""}! 📸 Escolhe qual vai no quadro e quais vão nos 2 porta-retratos. É só responder com os números, por exemplo: Quadro 2, porta-retratos 1 e 4 😊`;

// fotos: já entram na prévia (as escolhidas pela família, vindas do Drive), na ordem quadro, porta-retratos
// maxFotos: PR até 15 fotos por aluno (Formatura usa o envio próprio, com até ~70)
// kit: "pr" (quadro e porta-retratos) ou "paspatur" (o livro A4 aberto, em mockup-paspatur.js)
// encarte (só Paspatur): "calendario" (colégio público) ou "turma" (colégio particular: a foto da turma)
export function openMockup({
  nome = "",
  escola = "",
  preco = "",
  modo = "kit",
  toast = null,
  fotos = [],
  maxFotos = 15,
  kit = "pr",
  encarte = "calendario",
  tel = ""
} = {}) {
  const pas = kit === "paspatur";
  const st = {
    fotos: [],
    slots: pas ? [0, 1, 2, 3, 4] : [0, 1, 2],
    nome,
    escola: escola || "",
    preco: /\[/.test(preco) ? "" : preco,
    modo,
    encarte: encarte === "turma" ? "turma" : "calendario"
  };
  let pasMod = null; // o desenho do Paspatur (carregado só quando precisa)
  const sh = el("div", "sheet");
  const p = el("div", "panel mock");
  sh.append(p);
  document.body.append(sh);
  const close = () => {
    sh.remove();
    document.removeEventListener("paste", onPaste);
  };
  sh.addEventListener("click", e => {
    if (e.target === sh) close();
  });

  p.append(el("h2", null, "Prévia e escolha de fotos"));
  const modos = el("div", "chips");
  const bKit = el("button", "chip", "Prévia do kit"),
    bEsc = el("button", "chip", "Fotos para escolher");
  [bKit, bEsc].forEach(b => {
    b.type = "button";
    modos.append(b);
  });
  p.append(modos);
  const drop = el("label", "drop");
  drop.append(
    el("b", null, `Arraste as fotos do ensaio aqui (até ${maxFotos})`),
    el("span", null, "ou toque para escolher. No PC também dá para colar (Ctrl+V). Toque numa miniatura para tirar a foto.")
  );
  const inp = el("input");
  inp.type = "file";
  inp.accept = "image/*";
  inp.multiple = true;
  inp.hidden = true;
  drop.append(inp);
  p.append(drop);
  // envio de muitas fotos (Formatura, até ~70): mostra o progresso e deixa tentar de novo as que falharam
  const prog = el("p", "hint");
  prog.hidden = true;
  p.append(prog);
  const thumbs = el("div", "thumbs");
  p.append(thumbs);

  const slotsBox = el("div", pas ? "row2" : "row3");
  p.append(slotsBox);
  const LUG_PAS = ["Página da direita", "Foto grande da esquerda", "3 fotos pequenas", "Tira de 7 fotos", "Foto do calendário"];
  const rotulos = [];
  const slotSel = (pas ? LUG_PAS : ["Quadro 30x40", "Porta-retrato 1", "Porta-retrato 2"]).map((lbl, i) => {
    const s = el("select");
    s.id = "mkSlot" + i;
    s.onchange = () => {
      st.slots[i] = Number(s.value);
      st.escolheu = true;
      redraw();
    };
    const f = el("div", "field");
    const l = el("label", null, lbl);
    l.htmlFor = s.id;
    rotulos.push(l);
    f.append(l, s);
    slotsBox.append(f);
    return s;
  });
  const f1 = el("div", "row2");
  const iNome = el("input");
  iNome.value = st.nome;
  iNome.maxLength = 60;
  iNome.id = "mkNome";
  const iPreco = el("input");
  iPreco.value = st.preco;
  iPreco.maxLength = 20;
  iPreco.placeholder = "R$ 0";
  iPreco.id = "mkPreco";
  const fPreco = fieldOf("Preço no Pix", iPreco);
  f1.append(fieldOf("Nome", iNome), fPreco);
  p.append(f1);
  // Kit Paspatur: o ano do calendário (a partir de agosto, o do ano que vem)
  const iAno = el("input");
  iAno.id = "mkAnoCal";
  iAno.type = "number";
  iAno.min = "2024";
  iAno.max = "2100";
  iAno.value = String(new Date().getFullYear() + (new Date().getMonth() >= 7 ? 1 : 0));
  st.anoCal = Number(iAno.value);
  const fAno = fieldOf("Ano do calendário", iAno);
  iAno.oninput = () => {
    st.anoCal = Number(iAno.value) || st.anoCal;
    redraw();
  };
  // Kit Paspatur: o encarte. Colégio público: calendário; particular: foto da turma (adicione a montagem da turma
  // junto com as fotos do aluno e escolha em "Foto da turma")
  const encBox = el("div", "chips");
  encBox.setAttribute("role", "group");
  encBox.setAttribute("aria-label", "Encarte do Kit Paspatur");
  const encBtns = [
    ["calendario", "📅 Calendário"],
    ["turma", "👥 Foto da turma"]
  ].map(([k, t]) => {
    const b = el("button", "chip", t);
    b.type = "button";
    b.onclick = () => {
      if (st.encarte === k) return;
      st.encarte = k;
      // a foto da turma é a mais deitada; o calendário usa uma foto do aluno
      if (!st.escolheu && st.fotos.length && pasMod) st.slots = pasMod.sugerirPaspatur(st.fotos, k);
      paintEncarte();
      paintSlots();
      redraw();
    };
    encBox.append(b);
    return [k, b];
  });
  const fEnc = el("div", "field");
  fEnc.append(el("label", null, "Encarte do kit"), encBox);
  function paintEncarte() {
    encBtns.forEach(([k, b]) => b.setAttribute("aria-pressed", String(st.encarte === k)));
    if (rotulos[4]) rotulos[4].textContent = st.encarte === "turma" ? "Foto da turma" : "Foto do calendário";
    fAno.hidden = !pas || st.modo !== "kit" || st.encarte === "turma";
    fEnc.hidden = !pas || st.modo !== "kit";
  }
  p.append(fEnc, fAno);
  const dica = el("p", "hint");
  p.append(dica);

  const cv = el("canvas", "mock-cv");
  cv.width = W;
  cv.height = H;
  p.append(cv);
  const acts = el("div", "panel-actions");
  const bShare = el("button", "btn btn-primary", "Enviar pelo WhatsApp");
  bShare.type = "button";
  const bDown = el("button", "btn", "Baixar imagem");
  bDown.type = "button";
  const bCopy = el("button", "btn", "Copiar mensagem");
  bCopy.type = "button";
  const bClose = el("button", "btn", "Fechar");
  bClose.type = "button";
  bClose.onclick = close;
  const sp = el("span");
  sp.style.flex = "1";
  // Kit Paspatur: o livro abrindo (vídeo de ~11 s)
  const bVer = el("button", "btn", "▶️ Ver abrindo");
  bVer.type = "button";
  const bVideo = el("button", "btn", "🎬 Enviar vídeo");
  bVideo.type = "button";
  acts.append(bClose, sp, bCopy, bVer, bVideo, bDown, bShare);
  p.append(acts);

  let t;
  const redraw = () => {
    if (pararVideo) {
      pararVideo();
      pararVideo = null;
    }
    clearTimeout(t);
    t = setTimeout(async () => {
      if (st.modo !== "kit") return desenharEscolha(cv, st, kit);
      if (!pas) return desenharKit(cv, st);
      try {
        pasMod = pasMod || (await import("./mockup-paspatur.js"));
        await pasMod.desenharPaspatur(cv, st);
      } catch (e) {
        avisoErro(e, "montar a prévia do Paspatur", toast);
      }
    }, 60);
  };
  let pararVideo = null;
  function setModo(m) {
    st.modo = m;
    bVer.hidden = bVideo.hidden = !pas || m !== "kit";
    paintEncarte();
    bKit.setAttribute("aria-pressed", String(m === "kit"));
    bEsc.setAttribute("aria-pressed", String(m !== "kit"));
    slotsBox.hidden = m !== "kit";
    fPreco.hidden = m !== "kit";
    bCopy.hidden = m === "kit";
    dica.textContent =
      m === "kit"
        ? "Escolha qual foto vai em cada lugar: a que o cliente pediu, ou a que já está impressa no kit."
        : "Mande esta imagem e depois a mensagem pedindo para o aluno responder com os números.";
    redraw();
  }
  bKit.onclick = () => setModo("kit");
  bEsc.onclick = () => setModo("escolha");
  iNome.oninput = () => {
    st.nome = iNome.value;
    redraw();
  };
  iPreco.oninput = () => {
    st.preco = iPreco.value;
    redraw();
  };

  function paintSlots() {
    slotSel.forEach((s, i) => {
      s.innerHTML = "";
      st.fotos.forEach((_, k) => {
        const o = el("option", null, "Foto " + (k + 1));
        o.value = k;
        s.append(o);
      });
      if (st.slots[i] >= st.fotos.length) st.slots[i] = Math.min(i, Math.max(0, st.fotos.length - 1));
      s.value = st.slots[i];
      s.disabled = !st.fotos.length;
    });
  }
  async function addFiles(files) {
    const todas = [...files].filter(f => f.type.startsWith("image/") || /\.(jpe?g|png|webp|heic)$/i.test(f.name));
    const imgs = todas.slice(0, Math.max(0, maxFotos - st.fotos.length));
    // passou do limite: avisa (antes as fotos a mais sumiam sem aviso)
    if (todas.length > imgs.length && toast) toast(`No máximo ${maxFotos} fotos por aluno: ${todas.length - imgs.length} ficaram de fora.`);
    const falhas = [];
    const lado = maxFotos > 15 ? 1000 : LADO_MAX;
    let n = 0;
    prog.hidden = imgs.length < 5;
    for (const f of imgs) {
      prog.textContent = `Carregando as fotos… ${++n} de ${imgs.length}`;
      try {
        st.fotos.push(await fileToImg(f, lado));
      } catch (_) {
        // uma segunda tentativa (foto grande no celular às vezes falha na primeira)
        try {
          st.fotos.push(await fileToImg(f, lado));
        } catch (_e) {
          falhas.push(f);
        }
      }
      if (n % 10 === 0) paintThumbs();
    }
    prog.textContent = "";
    prog.hidden = !falhas.length;
    if (falhas.length) {
      const de = el("button", "btn btn-sm", "Tentar de novo");
      de.type = "button";
      de.onclick = () => addFiles(falhas);
      prog.append(`${falhas.length} foto${falhas.length > 1 ? "s" : ""} não abriu (use JPG ou PNG). `, de);
      avisoErro(new Error("foto"), `abrir ${falhas.length} foto${falhas.length > 1 ? "s" : ""} (use JPG ou PNG)`, toast);
    }
    // sugestão de qual foto vai em cada lugar (até a pessoa escolher outra)
    if (!st.escolheu && st.fotos.length) {
      if (pas) {
        pasMod = pasMod || (await import("./mockup-paspatur.js"));
        st.slots = pasMod.sugerirPaspatur(st.fotos, st.encarte);
      } else st.slots = sugerirSlots(st.fotos);
    }
    paintThumbs();
    paintSlots();
    redraw();
  }
  function paintThumbs() {
    thumbs.innerHTML = "";
    st.fotos.forEach((img, i) => {
      const b = el("button", "thumb");
      b.type = "button";
      b.title = "Tirar esta foto";
      const c = el("canvas");
      c.width = 120;
      c.height = 120;
      cover(c.getContext("2d"), img, 0, 0, 120, 120, 0.4);
      b.append(c, el("small", null, "Foto " + (i + 1)));
      b.onclick = () => {
        st.fotos.splice(i, 1);
        st.slots = st.slots.map(v => (v > i ? v - 1 : v === i ? 0 : v));
        paintThumbs();
        paintSlots();
        redraw();
      };
      thumbs.append(b);
    });
  }
  inp.onchange = () => {
    addFiles(inp.files);
    inp.value = "";
  };
  ["dragenter", "dragover"].forEach(ev =>
    drop.addEventListener(ev, e => {
      e.preventDefault();
      drop.classList.add("on");
    })
  );
  ["dragleave", "drop"].forEach(ev =>
    drop.addEventListener(ev, e => {
      e.preventDefault();
      drop.classList.remove("on");
    })
  );
  drop.addEventListener("drop", e => addFiles(e.dataTransfer.files));
  const onPaste = e => {
    const fs = [...(e.clipboardData?.files || [])];
    if (fs.length) {
      e.preventDefault();
      addFiles(fs);
    }
  };
  document.addEventListener("paste", onPaste);

  const fileName = () =>
    (st.modo === "kit" ? (pas ? "paspatur-" : "kit-") : "fotos-") +
    ((st.nome || "previa")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "previa") +
    ".jpg";
  const blob = () => new Promise(res => cv.toBlob(res, "image/jpeg", 0.85));
  const msgEscolha = () => textoEscolha((st.nome || "").trim().split(/\s+/)[0], kit);
  bCopy.onclick = async () => {
    try {
      await navigator.clipboard.writeText(msgEscolha());
      alertMsg(p, "Mensagem copiada.");
    } catch (_) {
      alertMsg(p, msgEscolha());
    }
  };
  bDown.onclick = async () => {
    const b = await blob();
    const u = URL.createObjectURL(b);
    const a = document.createElement("a");
    a.href = u;
    a.download = fileName();
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 4000);
  };
  bShare.onclick = async () => {
    if (!st.fotos.length) {
      drop.classList.add("on");
      setTimeout(() => drop.classList.remove("on"), 900);
      return;
    }
    const b = await blob();
    // computador: copia a imagem e abre a conversa no WhatsApp Web (Ctrl+V cola a imagem)
    if (noComputador()) {
      if (!(await copiarImagem(b))) bDown.onclick();
      abrirWhatsAppWeb(tel, st.modo !== "kit" ? msgEscolha() : "");
      return alertMsg(p, "Imagem copiada. Na conversa do WhatsApp Web, aperte Ctrl+V e envie.");
    }
    const file = new File([b], fileName(), { type: "image/jpeg" });
    const data = { files: [file] };
    if (st.modo !== "kit") data.text = msgEscolha();
    if (navigator.canShare && navigator.canShare(data)) {
      try {
        await navigator.share(data);
        return;
      } catch (e) {
        if (e && e.name === "AbortError") return;
      }
    }
    bDown.onclick();
    alertMsg(p, "Imagem baixada. No WhatsApp Web, clique no clipe 📎 e escolha a imagem (ou arraste o arquivo para a conversa).");
  };
  bVer.onclick = async () => {
    try {
      pasMod = pasMod || (await import("./mockup-paspatur.js"));
      if (pararVideo) pararVideo();
      pararVideo = await pasMod.tocar(cv, st, () => {
        pararVideo = null;
        redraw();
      });
    } catch (e) {
      avisoErro(e, "mostrar o livro abrindo", toast);
    }
  };
  bVideo.onclick = async () => {
    if (!st.fotos.length) {
      drop.classList.add("on");
      setTimeout(() => drop.classList.remove("on"), 900);
      return;
    }
    try {
      pasMod = pasMod || (await import("./mockup-paspatur.js"));
      if (!pasMod.tipoVideo()) return alertMsg(p, "Este aparelho não grava vídeo. Mande a imagem (Enviar pelo WhatsApp).");
      if (pararVideo) pararVideo();
      bVideo.disabled = true;
      bVideo.textContent = "🎬 Gravando… (11 s)";
      const r = await pasMod.gravarVideo(cv, st);
      redraw();
      if (!r || !r.blob.size) return alertMsg(p, "Não deu para gravar o vídeo. Mande a imagem (Enviar pelo WhatsApp).");
      const ext = r.tipo === "video/mp4" ? ".mp4" : ".webm";
      const file = new File([r.blob], fileName().replace(/\.jpg$/, ext), { type: r.tipo });
      // o WhatsApp aceita MP4; WebM (alguns Android antigos) é baixado para mandar como arquivo
      if (ext === ".mp4" && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file] });
          return;
        } catch (e) {
          if (e && e.name === "AbortError") return;
        }
      }
      const u = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = u;
      a.download = file.name;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(u), 8000);
      alertMsg(p, "Vídeo baixado. No WhatsApp, clique no clipe 📎 e escolha o vídeo.");
    } catch (e) {
      avisoErro(e, "gravar o vídeo do Paspatur", toast);
    } finally {
      bVideo.disabled = false;
      bVideo.textContent = "🎬 Enviar vídeo";
    }
  };
  if (!noComputador() && !navigator.canShare) bShare.textContent = "Baixar para o WhatsApp";
  paintSlots();
  setModo(modo);
  // fotos já escolhidas pela família, na ordem dos lugares: ficam onde vieram (sem a sugestão automática)
  if (fotos.length) st.escolheu = true;
  if (fotos.length) addFiles(fotos.map(b => (b instanceof File ? b : new File([b], "foto.jpg", { type: b.type || "image/jpeg" }))));
  // Kit Paspatur: sempre pergunta o encarte antes (a regra costuma ser público = calendário e particular = turma,
  // e a sugestão do colégio vem marcada, mas quem decide é quem está vendendo — pedido da Luciana, 09/11/2026)
  if (pas && modo === "kit")
    import("./confirmar.js")
      .then(m =>
        m.escolher("Kit Paspatur: qual encarte?", "Colégio público costuma levar o calendário; particular, a foto da turma em mosaico.", [
          {
            v: "calendario",
            txt: "📅 Com calendário" + (st.encarte === "calendario" ? " (sugerido)" : ""),
            cls: st.encarte === "calendario" ? "btn-primary" : ""
          },
          {
            v: "turma",
            txt: "👥 Com a foto da turma (mosaico)" + (st.encarte === "turma" ? " (sugerido)" : ""),
            cls: st.encarte === "turma" ? "btn-primary" : ""
          }
        ])
      )
      .then(v => {
        if (!v || v === st.encarte) return;
        const b = encBtns.find(([k]) => k === v);
        if (b) b[1].click();
      })
      .catch(e => console.warn("[Z7] encarte", e));
}

function fieldOf(lbl, inp) {
  const f = el("div", "field");
  const l = el("label", null, lbl);
  l.htmlFor = inp.id;
  f.append(l, inp);
  return f;
}
function alertMsg(p, t) {
  let n = p.querySelector(".mock-msg");
  if (!n) {
    n = el("p", "hint mock-msg");
    p.append(n);
  }
  n.textContent = t;
}
// usados também pela prévia da formatura (js/previa.js)
export { cover, marca, prep, loadImg };
export const logoAtual = () => logoImg;
