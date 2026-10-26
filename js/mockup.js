// Prévia do kit e folha de escolha das fotos.
// - "Prévia do kit": quadro 30x40 (moldura preta) + 2 porta-retratos 15x10 em pé, com as fotos escolhidas.
// - "Fotos para escolher": todas as fotos do ensaio numeradas, para o formando escolher o que vai em cada lugar.
// Toda imagem sai com marca d'água repetida (um print não serve como foto final).
import { el, avisoErro } from "./ui.js";
const W = 1080, H = 1350;
let logoImg = null;

function loadImg(src){ return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }); }
function fileToImg(f){ return loadImg(URL.createObjectURL(f)); }

function cover(ctx, img, x, y, w, h, fy = 0.38){
  const r = Math.max(w / img.width, h / img.height);
  const sw = w / r, sh = h / r;
  const sx = (img.width - sw) / 2, sy = Math.max(0, Math.min(img.height - sh, (img.height - sh) * fy));
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}
// Marca d'água repetida em diagonal dentro de um retângulo.
function marca(ctx, x, y, w, h){
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  const fs = Math.max(14, Math.round(Math.min(w, h) / 9));
  ctx.font = `700 ${fs}px 'Barlow Condensed', sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.translate(x + w / 2, y + h / 2); ctx.rotate(-Math.PI / 7);
  const step = fs * 2.6, span = Math.hypot(w, h);
  for (let yy = -span / 2; yy <= span / 2; yy += step) {
    for (let xx = -span / 2; xx <= span / 2; xx += fs * 9) {
      ctx.fillStyle = "rgba(255,255,255,.28)"; ctx.fillText("PRÉVIA · Z7 STUDIO", xx + (Math.round(yy / step) % 2) * fs * 4.5, yy);
      ctx.fillStyle = "rgba(0,0,0,.10)"; ctx.fillText("PRÉVIA · Z7 STUDIO", xx + (Math.round(yy / step) % 2) * fs * 4.5 + 1.5, yy + 1.5);
    }
  }
  ctx.restore();
}
function moldura(ctx, x, y, w, h, b, img, opts = {}){
  ctx.save(); ctx.shadowColor = "rgba(0,0,0,.45)"; ctx.shadowBlur = opts.blur || 40; ctx.shadowOffsetY = opts.off || 18;
  ctx.fillStyle = "#111"; ctx.fillRect(x, y, w, h); ctx.restore();
  const g = ctx.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, "#2a2a2a"); g.addColorStop(.5, "#0d0d0d"); g.addColorStop(1, "#1c1c1c");
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "rgba(255,255,255,.12)"; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  const ix = x + b, iy = y + b, iw = w - 2 * b, ih = h - 2 * b;
  if (img) cover(ctx, img, ix, iy, iw, ih); else { ctx.fillStyle = "#d9d4cd"; ctx.fillRect(ix, iy, iw, ih); ctx.fillStyle = "#8a847d"; ctx.font = "600 26px 'Source Sans 3', sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("foto", ix + iw / 2, iy + ih / 2); ctx.textBaseline = "alphabetic"; }
  if (img && opts.marca !== false) marca(ctx, ix, iy, iw, ih);
  ctx.strokeStyle = "rgba(0,0,0,.6)"; ctx.lineWidth = 3; ctx.strokeRect(ix, iy, iw, ih);
  const gl = ctx.createLinearGradient(ix, iy, ix + iw, iy + ih); gl.addColorStop(0, "rgba(255,255,255,.10)"); gl.addColorStop(.35, "rgba(255,255,255,0)"); ctx.fillStyle = gl; ctx.fillRect(ix, iy, iw, ih);
}
function wrap(ctx, text, x, y, maxW, lh){
  const words = String(text).split(/\s+/); let line = "", yy = y;
  for (const w of words) { const t = line ? line + " " + w : w; if (ctx.measureText(t).width > maxW && line) { ctx.fillText(line, x, yy); line = w; yy += lh; } else line = t; }
  if (line) ctx.fillText(line, x, yy);
}
async function prep(){
  try { await document.fonts.load("700 40px 'Barlow Condensed'"); await document.fonts.load("600 20px 'Source Sans 3'"); } catch (_) {}
  if (!logoImg) { try { logoImg = await loadImg("icons/icon-192.png"); } catch (_) {} }
}
function rodape(ctx, cor){
  ctx.fillStyle = cor; ctx.font = "400 20px 'Source Sans 3', sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  ctx.fillText("Prévia com marca d'água · reprodução proibida · as fotos entregues não têm marca", 60, H - 30);
}

async function desenharKit(cv, st){
  await prep(); const ctx = cv.getContext("2d");
  cv.width = W; cv.height = H;
  const wall = ctx.createLinearGradient(0, 0, 0, 980); wall.addColorStop(0, "#efe9e2"); wall.addColorStop(1, "#ddd5cb");
  ctx.fillStyle = wall; ctx.fillRect(0, 0, W, 980);
  const tb = ctx.createLinearGradient(0, 980, 0, H); tb.addColorStop(0, "#7a5a41"); tb.addColorStop(.08, "#5e4330"); tb.addColorStop(1, "#3d2b1f");
  ctx.fillStyle = tb; ctx.fillRect(0, 980, W, H - 980);
  ctx.fillStyle = "rgba(255,255,255,.08)"; ctx.fillRect(0, 980, W, 6);
  const f = i => st.fotos[st.slots[i]] || st.fotos[0] || null;
  moldura(ctx, 80, 110, 540, 720, 30, f(0), { blur: 50, off: 24 });
  const x = 670;
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = "#b3202a"; ctx.font = "700 30px 'Barlow Condensed', sans-serif"; ctx.fillText("KIT RECORDAÇÃO", x, 170);
  ctx.fillStyle = "#1c1b1d"; ctx.font = "700 58px 'Barlow Condensed', sans-serif";
  wrap(ctx, (st.nome || "").trim().split(/\s+/).slice(0, 2).join(" ").toUpperCase() || "SEU NOME", x, 232, 360, 58);
  ctx.fillStyle = "#4a4549"; ctx.font = "600 26px 'Source Sans 3', sans-serif";
  ["Quadro 30x40 · moldura preta", "2 porta-retratos 15x10", "Fotos digitais do ensaio"].forEach((t, i) => ctx.fillText("• " + t, x, 360 + i * 40));
  if (st.escola) { ctx.fillStyle = "#6b6670"; ctx.font = "400 22px 'Source Sans 3', sans-serif"; wrap(ctx, st.escola, x, 500, 360, 28); }
  if (st.preco) {
    ctx.fillStyle = "#b3202a"; ctx.font = "700 64px 'Barlow Condensed', sans-serif"; ctx.fillText(st.preco, x, 640);
    ctx.fillStyle = "#6b6670"; ctx.font = "600 22px 'Source Sans 3', sans-serif"; ctx.fillText("no Pix", x, 676);
  }
  if (logoImg) { ctx.save(); ctx.beginPath(); ctx.arc(x + 40, 770, 40, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(logoImg, x, 730, 80, 80); ctx.restore(); }
  ctx.fillStyle = "#1c1b1d"; ctx.font = "700 30px 'Barlow Condensed', sans-serif"; ctx.fillText("Z7 STUDIO", x + 96, 765);
  ctx.fillStyle = "#6b6670"; ctx.font = "400 20px 'Source Sans 3', sans-serif"; ctx.fillText("Fotográfico", x + 96, 792);
  // porta-retratos 15x10 em pé sobre o aparador
  moldura(ctx, 560, 900, 220, 330, 16, f(1), { blur: 24, off: 12 });
  moldura(ctx, 810, 930, 210, 315, 16, f(2), { blur: 24, off: 12 });
  rodape(ctx, "rgba(255,255,255,.6)");
}

async function desenharEscolha(cv, st){
  await prep(); const ctx = cv.getContext("2d");
  const n = Math.max(1, st.fotos.length), cols = n <= 4 ? 2 : 3, rows = Math.ceil(n / cols);
  cv.width = W; cv.height = H;
  ctx.fillStyle = "#141315"; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#e0525b"; ctx.font = "700 30px 'Barlow Condensed', sans-serif"; ctx.fillText("ESCOLHA AS SUAS FOTOS", 60, 80);
  ctx.fillStyle = "#f0eef0"; ctx.font = "700 52px 'Barlow Condensed', sans-serif";
  ctx.fillText(((st.nome || "").trim().split(/\s+/).slice(0, 2).join(" ") || "Ensaio de formatura").toUpperCase(), 60, 138);
  ctx.fillStyle = "#a39fa6"; ctx.font = "400 24px 'Source Sans 3', sans-serif";
  ctx.fillText("Responda com o número: qual vai no quadro e quais vão nos 2 porta-retratos.", 60, 178);
  if (logoImg) { ctx.save(); ctx.beginPath(); ctx.arc(W - 100, 105, 44, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(logoImg, W - 144, 61, 88, 88); ctx.restore(); }
  const top = 210, bottom = H - 70, gap = 20, gx = 60;
  const cw = (W - 2 * gx - (cols - 1) * gap) / cols, ch = (bottom - top - (rows - 1) * gap) / rows;
  st.fotos.forEach((img, i) => {
    const c = i % cols, r = Math.floor(i / cols), x = gx + c * (cw + gap), y = top + r * (ch + gap);
    // foto inteira (sem cortar), centralizada na célula
    const sc = Math.min(cw / img.width, ch / img.height), w = img.width * sc, h = img.height * sc, ox = x + (cw - w) / 2, oy = y + (ch - h) / 2;
    ctx.drawImage(img, ox, oy, w, h); marca(ctx, ox, oy, w, h);
    ctx.fillStyle = "#e0525b"; ctx.beginPath(); ctx.arc(ox + 40, oy + 40, 30, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = "700 38px 'Barlow Condensed', sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(String(i + 1), ox + 40, oy + 42);
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  });
  if (!st.fotos.length) { ctx.fillStyle = "#a39fa6"; ctx.font = "600 30px 'Source Sans 3', sans-serif"; ctx.textAlign = "center"; ctx.fillText("Arraste as fotos do ensaio", W / 2, H / 2); }
  rodape(ctx, "#a39fa6");
}

export const textoEscolha = (F) => `Aqui estão as fotos do ensaio${F ? " de " + F : ""}! 📸 Escolhe qual vai no quadro e quais vão nos 2 porta-retratos. É só responder com os números, por exemplo: Quadro 2, porta-retratos 1 e 4 😊`;

export function openMockup({ nome = "", escola = "", preco = "", modo = "kit", toast = null } = {}){
  const st = { fotos: [], slots: [0, 1, 2], nome, escola: escola || "", preco: /\[/.test(preco) ? "" : preco, modo };
  const sh = el("div", "sheet"); const p = el("div", "panel mock");
  sh.append(p); document.body.append(sh);
  const close = () => { sh.remove(); document.removeEventListener("paste", onPaste); };
  sh.addEventListener("click", e => { if (e.target === sh) close(); });

  p.append(el("h2", null, "Prévia e escolha de fotos"));
  const modos = el("div", "chips");
  const bKit = el("button", "chip", "Prévia do kit"), bEsc = el("button", "chip", "Fotos para escolher");
  [bKit, bEsc].forEach(b => { b.type = "button"; modos.append(b); });
  p.append(modos);
  const drop = el("label", "drop");
  drop.innerHTML = "<b>Arraste as fotos do ensaio aqui (até 8)</b><span>ou toque para escolher. No PC também dá para colar (Ctrl+V). Toque numa miniatura para tirar a foto.</span>";
  const inp = el("input"); inp.type = "file"; inp.accept = "image/*"; inp.multiple = true; inp.hidden = true; drop.append(inp);
  p.append(drop);
  const thumbs = el("div", "thumbs"); p.append(thumbs);

  const slotsBox = el("div", "row3"); p.append(slotsBox);
  const slotSel = ["Quadro 30x40", "Porta-retrato 1", "Porta-retrato 2"].map((lbl, i) => {
    const s = el("select"); s.id = "mkSlot" + i; s.onchange = () => { st.slots[i] = Number(s.value); redraw(); };
    const f = el("div", "field"); const l = el("label", null, lbl); l.htmlFor = s.id; f.append(l, s); slotsBox.append(f); return s;
  });
  const f1 = el("div", "row2");
  const iNome = el("input"); iNome.value = st.nome; iNome.maxLength = 60; iNome.id = "mkNome";
  const iPreco = el("input"); iPreco.value = st.preco; iPreco.maxLength = 20; iPreco.placeholder = "R$ 0"; iPreco.id = "mkPreco";
  const fPreco = fieldOf("Preço no Pix", iPreco);
  f1.append(fieldOf("Nome", iNome), fPreco); p.append(f1);
  const dica = el("p", "hint"); p.append(dica);

  const cv = el("canvas", "mock-cv"); cv.width = W; cv.height = H; p.append(cv);
  const acts = el("div", "panel-actions");
  const bShare = el("button", "btn btn-primary", "Enviar pelo WhatsApp"); bShare.type = "button";
  const bDown = el("button", "btn", "Baixar imagem"); bDown.type = "button";
  const bCopy = el("button", "btn", "Copiar mensagem"); bCopy.type = "button";
  const bClose = el("button", "btn", "Fechar"); bClose.type = "button"; bClose.onclick = close;
  const sp = el("span"); sp.style.flex = "1";
  acts.append(bClose, sp, bCopy, bDown, bShare); p.append(acts);

  let t; const redraw = () => { clearTimeout(t); t = setTimeout(() => (st.modo === "kit" ? desenharKit : desenharEscolha)(cv, st), 60); };
  function setModo(m){
    st.modo = m; bKit.setAttribute("aria-pressed", String(m === "kit")); bEsc.setAttribute("aria-pressed", String(m !== "kit"));
    slotsBox.hidden = m !== "kit"; fPreco.hidden = m !== "kit"; bCopy.hidden = m === "kit";
    dica.textContent = m === "kit" ? "Escolha qual foto vai em cada lugar: a que o cliente pediu, ou a que já está impressa no kit." : "Mande esta imagem e depois a mensagem pedindo para o formando responder com os números.";
    redraw();
  }
  bKit.onclick = () => setModo("kit"); bEsc.onclick = () => setModo("escolha");
  iNome.oninput = () => { st.nome = iNome.value; redraw(); };
  iPreco.oninput = () => { st.preco = iPreco.value; redraw(); };

  function paintSlots(){
    slotSel.forEach((s, i) => {
      s.innerHTML = ""; st.fotos.forEach((_, k) => { const o = el("option", null, "Foto " + (k + 1)); o.value = k; s.append(o); });
      if (st.slots[i] >= st.fotos.length) st.slots[i] = Math.min(i, Math.max(0, st.fotos.length - 1));
      s.value = st.slots[i]; s.disabled = !st.fotos.length;
    });
  }
  async function addFiles(files){
    const imgs = [...files].filter(f => f.type.startsWith("image/")).slice(0, 8 - st.fotos.length);
    let falhou = 0; for (const f of imgs) { try { st.fotos.push(await fileToImg(f)); } catch (_) { falhou++; } }
    if (falhou) avisoErro(new Error("foto"), `abrir ${falhou} foto${falhou > 1 ? "s" : ""} (use JPG ou PNG)`, toast);
    paintThumbs(); paintSlots(); redraw();
  }
  function paintThumbs(){
    thumbs.innerHTML = "";
    st.fotos.forEach((img, i) => {
      const b = el("button", "thumb"); b.type = "button"; b.title = "Tirar esta foto";
      const c = el("canvas"); c.width = 120; c.height = 120; cover(c.getContext("2d"), img, 0, 0, 120, 120, .4);
      b.append(c, el("small", null, "Foto " + (i + 1)));
      b.onclick = () => { st.fotos.splice(i, 1); st.slots = st.slots.map(v => (v > i ? v - 1 : v === i ? 0 : v)); paintThumbs(); paintSlots(); redraw(); };
      thumbs.append(b);
    });
  }
  inp.onchange = () => { addFiles(inp.files); inp.value = ""; };
  ["dragenter", "dragover"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add("on"); }));
  ["dragleave", "drop"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove("on"); }));
  drop.addEventListener("drop", e => addFiles(e.dataTransfer.files));
  const onPaste = e => { const fs = [...(e.clipboardData?.files || [])]; if (fs.length) { e.preventDefault(); addFiles(fs); } };
  document.addEventListener("paste", onPaste);

  const fileName = () => (st.modo === "kit" ? "kit-" : "fotos-") + ((st.nome || "previa").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "previa") + ".jpg";
  const blob = () => new Promise(res => cv.toBlob(res, "image/jpeg", .85));
  const msgEscolha = () => textoEscolha((st.nome || "").trim().split(/\s+/)[0]);
  bCopy.onclick = async () => { try { await navigator.clipboard.writeText(msgEscolha()); alertMsg(p, "Mensagem copiada."); } catch (_) { alertMsg(p, msgEscolha()); } };
  bDown.onclick = async () => {
    const b = await blob(); const u = URL.createObjectURL(b);
    const a = document.createElement("a"); a.href = u; a.download = fileName(); document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 4000);
  };
  bShare.onclick = async () => {
    if (!st.fotos.length) { drop.classList.add("on"); setTimeout(() => drop.classList.remove("on"), 900); return; }
    const b = await blob(); const file = new File([b], fileName(), { type: "image/jpeg" });
    const data = { files: [file] }; if (st.modo !== "kit") data.text = msgEscolha();
    if (navigator.canShare && navigator.canShare(data)) {
      try { await navigator.share(data); return; } catch (e) { if (e && e.name === "AbortError") return; }
    }
    bDown.onclick();
    alertMsg(p, "Imagem baixada. No WhatsApp Web, clique no clipe 📎 e escolha a imagem (ou arraste o arquivo para a conversa).");
  };
  if (!navigator.canShare) bShare.textContent = "Baixar para o WhatsApp";
  paintSlots(); setModo(modo);
}

function fieldOf(lbl, inp){ const f = el("div", "field"); const l = el("label", null, lbl); l.htmlFor = inp.id; f.append(l, inp); return f; }
function alertMsg(p, t){ let n = p.querySelector(".mock-msg"); if (!n) { n = el("p", "hint mock-msg"); p.append(n); } n.textContent = t; }
