// Prévia do Kit Recordação: monta uma imagem com o quadro 30x40 (moldura preta)
// e os 2 porta-retratos 15x10 usando as fotos do formando, pronta para mandar no WhatsApp.
const W = 1080, H = 1350;
let logoImg = null;

function el(tag, cls, text){ const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function loadImg(src){ return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }); }
function fileToImg(f){ return new Promise((res, rej) => { const u = URL.createObjectURL(f); loadImg(u).then(i => { res(i); }, rej); }); }

// Desenha a foto cobrindo o retângulo, com o foco um pouco acima do centro (onde costuma estar o rosto).
function cover(ctx, img, x, y, w, h, fy = 0.38){
  const r = Math.max(w / img.width, h / img.height);
  const sw = w / r, sh = h / r;
  const sx = (img.width - sw) / 2, sy = Math.max(0, Math.min(img.height - sh, (img.height - sh) * fy));
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}
function moldura(ctx, x, y, w, h, b, img, opts = {}){
  // sombra na parede
  ctx.save(); ctx.shadowColor = "rgba(0,0,0,.45)"; ctx.shadowBlur = opts.blur || 40; ctx.shadowOffsetY = opts.off || 18;
  ctx.fillStyle = "#111"; ctx.fillRect(x, y, w, h); ctx.restore();
  // moldura preta com leve brilho
  const g = ctx.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, "#2a2a2a"); g.addColorStop(.5, "#0d0d0d"); g.addColorStop(1, "#1c1c1c");
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "rgba(255,255,255,.12)"; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  // foto
  const ix = x + b, iy = y + b, iw = w - 2 * b, ih = h - 2 * b;
  if (img) cover(ctx, img, ix, iy, iw, ih); else { ctx.fillStyle = "#d9d4cd"; ctx.fillRect(ix, iy, iw, ih); ctx.fillStyle = "#8a847d"; ctx.font = "600 26px 'Source Sans 3', sans-serif"; ctx.textAlign = "center"; ctx.fillText("foto", ix + iw / 2, iy + ih / 2); }
  // borda interna e reflexo do vidro
  ctx.strokeStyle = "rgba(0,0,0,.6)"; ctx.lineWidth = 3; ctx.strokeRect(ix, iy, iw, ih);
  const gl = ctx.createLinearGradient(ix, iy, ix + iw, iy + ih); gl.addColorStop(0, "rgba(255,255,255,.10)"); gl.addColorStop(.35, "rgba(255,255,255,0)"); ctx.fillStyle = gl; ctx.fillRect(ix, iy, iw, ih);
  if (opts.marca) {
    ctx.save(); ctx.beginPath(); ctx.rect(ix, iy, iw, ih); ctx.clip();
    ctx.translate(ix + iw / 2, iy + ih / 2); ctx.rotate(-Math.PI / 7);
    ctx.fillStyle = "rgba(255,255,255,.22)"; ctx.font = `700 ${Math.round(iw / 9)}px 'Barlow Condensed', sans-serif`; ctx.textAlign = "center";
    ctx.fillText("PRÉVIA · Z7 STUDIO", 0, 0); ctx.restore();
  }
}

async function desenhar(cv, st){
  const ctx = cv.getContext("2d");
  try { await document.fonts.load("700 40px 'Barlow Condensed'"); await document.fonts.load("600 20px 'Source Sans 3'"); } catch (_) {}
  if (!logoImg) { try { logoImg = await loadImg("icons/icon-192.png"); } catch (_) {} }
  // parede
  const wall = ctx.createLinearGradient(0, 0, 0, 980); wall.addColorStop(0, "#efe9e2"); wall.addColorStop(1, "#ddd5cb");
  ctx.fillStyle = wall; ctx.fillRect(0, 0, W, 980);
  // aparador de madeira
  const tb = ctx.createLinearGradient(0, 980, 0, H); tb.addColorStop(0, "#7a5a41"); tb.addColorStop(.08, "#5e4330"); tb.addColorStop(1, "#3d2b1f");
  ctx.fillStyle = tb; ctx.fillRect(0, 980, W, H - 980);
  ctx.fillStyle = "rgba(255,255,255,.08)"; ctx.fillRect(0, 980, W, 6);

  const [f0, f1, f2] = [st.fotos[0], st.fotos[1] || st.fotos[0], st.fotos[2] || st.fotos[1] || st.fotos[0]];
  // quadro 30x40 (3:4) na parede
  moldura(ctx, 80, 110, 540, 720, 30, f0, { marca: st.marca, blur: 50, off: 24 });
  // cartão de informação
  const x = 670;
  ctx.textAlign = "left"; ctx.fillStyle = "#b3202a"; ctx.font = "700 30px 'Barlow Condensed', sans-serif"; ctx.fillText("KIT RECORDAÇÃO", x, 170);
  ctx.fillStyle = "#1c1b1d"; ctx.font = "700 58px 'Barlow Condensed', sans-serif";
  const nome = (st.nome || "").trim().split(/\s+/).slice(0, 2).join(" ").toUpperCase() || "SEU NOME";
  wrap(ctx, nome, x, 232, 360, 58);
  ctx.fillStyle = "#4a4549"; ctx.font = "600 26px 'Source Sans 3', sans-serif";
  const linhas = ["Quadro 30x40 · moldura preta", "2 porta-retratos 15x10", "Fotos digitais do ensaio"];
  linhas.forEach((t, i) => { ctx.fillText("• " + t, x, 360 + i * 40); });
  if (st.escola) { ctx.fillStyle = "#6b6670"; ctx.font = "400 22px 'Source Sans 3', sans-serif"; wrap(ctx, st.escola, x, 500, 360, 28); }
  if (st.preco) {
    ctx.fillStyle = "#b3202a"; ctx.font = "700 64px 'Barlow Condensed', sans-serif"; ctx.fillText(st.preco, x, 640);
    ctx.fillStyle = "#6b6670"; ctx.font = "600 22px 'Source Sans 3', sans-serif"; ctx.fillText("no Pix ou no cartão", x, 676);
  }
  if (logoImg) { ctx.save(); ctx.beginPath(); ctx.arc(x + 40, 770, 40, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(logoImg, x, 730, 80, 80); ctx.restore(); }
  ctx.fillStyle = "#1c1b1d"; ctx.font = "700 30px 'Barlow Condensed', sans-serif"; ctx.fillText("Z7 STUDIO", x + 96, 765);
  ctx.fillStyle = "#6b6670"; ctx.font = "400 20px 'Source Sans 3', sans-serif"; ctx.fillText("Fotográfico", x + 96, 792);

  // porta-retratos 15x10 sobre o aparador
  if (st.deitado) { moldura(ctx, 300, 1010, 330, 225, 16, f1, { blur: 24, off: 12 }); moldura(ctx, 670, 1030, 330, 225, 16, f2, { blur: 24, off: 12 }); }
  else { moldura(ctx, 560, 900, 220, 330, 16, f1, { blur: 24, off: 12 }); moldura(ctx, 810, 930, 210, 315, 16, f2, { blur: 24, off: 12 }); }
  ctx.fillStyle = "rgba(255,255,255,.55)"; ctx.font = "400 20px 'Source Sans 3', sans-serif"; ctx.textAlign = "left";
  ctx.fillText("Imagem ilustrativa. Cores e enquadramento podem variar levemente.", 60, H - 30);
}
function wrap(ctx, text, x, y, maxW, lh){
  const words = String(text).split(/\s+/); let line = "", yy = y;
  for (const w of words) { const t = line ? line + " " + w : w; if (ctx.measureText(t).width > maxW && line) { ctx.fillText(line, x, yy); line = w; yy += lh; } else line = t; }
  if (line) ctx.fillText(line, x, yy);
}

export function openMockup({ nome = "", escola = "", preco = "" } = {}){
  const st = { fotos: [], nome, escola: escola || "", preco: /\[/.test(preco) ? "" : preco, deitado: false, marca: true };
  const sh = el("div", "sheet"); const p = el("div", "panel mock");
  sh.append(p); document.body.append(sh);
  const close = () => { sh.remove(); document.removeEventListener("paste", onPaste); };
  sh.addEventListener("click", e => { if (e.target === sh) close(); });

  p.append(el("h2", null, "Prévia do kit"));
  const drop = el("label", "drop");
  drop.innerHTML = "<b>Arraste até 3 fotos aqui</b><span>ou toque para escolher. A 1ª vai no quadro; a 2ª e a 3ª nos porta-retratos. No PC também dá para colar (Ctrl+V).</span>";
  const inp = el("input"); inp.type = "file"; inp.accept = "image/*"; inp.multiple = true; inp.hidden = true; drop.append(inp);
  p.append(drop);
  const thumbs = el("div", "thumbs"); p.append(thumbs);

  const f1 = el("div", "row2");
  const iNome = el("input"); iNome.value = st.nome; iNome.maxLength = 60; iNome.id = "mkNome";
  const iPreco = el("input"); iPreco.value = st.preco; iPreco.maxLength = 20; iPreco.placeholder = "R$ 0"; iPreco.id = "mkPreco";
  f1.append(fieldOf("Nome no cartão", iNome), fieldOf("Preço", iPreco)); p.append(f1);
  const opts = el("div", "quick");
  const cDeit = chk("Porta-retratos deitados", false, v => { st.deitado = v; redraw(); });
  const cMarca = chk("Marca d'água \"PRÉVIA\" no quadro", true, v => { st.marca = v; redraw(); });
  opts.append(cDeit, cMarca); p.append(opts);

  const cv = el("canvas", "mock-cv"); cv.width = W; cv.height = H; p.append(cv);
  const acts = el("div", "panel-actions");
  const bShare = el("button", "btn btn-primary", "Enviar pelo WhatsApp"); bShare.type = "button";
  const bDown = el("button", "btn", "Baixar imagem"); bDown.type = "button";
  const bClose = el("button", "btn", "Fechar"); bClose.type = "button"; bClose.onclick = close;
  acts.append(bClose, el("span"), bDown, bShare); acts.children[1].style.flex = "1"; p.append(acts);

  let t; const redraw = () => { clearTimeout(t); t = setTimeout(() => desenhar(cv, st), 60); };
  iNome.oninput = () => { st.nome = iNome.value; redraw(); };
  iPreco.oninput = () => { st.preco = iPreco.value; redraw(); };

  async function addFiles(files){
    if (st.fotos.length >= 3) st.fotos = [];
    const imgs = [...files].filter(f => f.type.startsWith("image/")).slice(0, 3 - st.fotos.length);
    for (const f of imgs) { try { st.fotos.push(await fileToImg(f)); } catch (_) {} }
    paintThumbs(); redraw();
  }
  function paintThumbs(){
    thumbs.innerHTML = "";
    st.fotos.forEach((img, i) => {
      const b = el("button", "thumb"); b.type = "button"; b.title = "Tirar esta foto";
      const c = el("canvas"); c.width = 120; c.height = 120; cover(c.getContext("2d"), img, 0, 0, 120, 120, .4);
      b.append(c, el("small", null, i === 0 ? "Quadro" : "Porta-retrato " + i));
      b.onclick = () => { st.fotos.splice(i, 1); paintThumbs(); redraw(); };
      thumbs.append(b);
    });
  }
  inp.onchange = () => { addFiles(inp.files); inp.value = ""; };
  ["dragenter", "dragover"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add("on"); }));
  ["dragleave", "drop"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove("on"); }));
  drop.addEventListener("drop", e => addFiles(e.dataTransfer.files));
  const onPaste = e => { const fs = [...(e.clipboardData?.files || [])]; if (fs.length) { e.preventDefault(); addFiles(fs); } };
  document.addEventListener("paste", onPaste);

  function fileName(){ return "kit-" + ((st.nome || "previa").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "previa") + ".jpg"; }
  function blob(){ return new Promise(res => cv.toBlob(res, "image/jpeg", .9)); }
  bDown.onclick = async () => {
    const b = await blob(); const u = URL.createObjectURL(b);
    const a = document.createElement("a"); a.href = u; a.download = fileName(); document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 4000);
  };
  bShare.onclick = async () => {
    if (!st.fotos.length) { drop.classList.add("on"); setTimeout(() => drop.classList.remove("on"), 900); return; }
    const b = await blob(); const file = new File([b], fileName(), { type: "image/jpeg" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file] }); return; } catch (e) { if (e && e.name === "AbortError") return; }
    }
    bDown.onclick();
    alertMsg(p, "Imagem baixada. No WhatsApp Web, clique no clipe 📎 e escolha a imagem (ou arraste o arquivo para a conversa).");
  };
  if (!navigator.canShare) bShare.textContent = "Baixar para o WhatsApp";
  redraw();
}

function fieldOf(lbl, inp){ const f = el("div", "field"); const l = el("label", null, lbl); l.htmlFor = inp.id; f.append(l, inp); return f; }
function chk(lbl, val, on){ const l = el("label", "chk"); const c = el("input"); c.type = "checkbox"; c.checked = val; c.onchange = () => on(c.checked); l.append(c, document.createTextNode(" " + lbl)); return l; }
function alertMsg(p, t){ let n = p.querySelector(".mock-msg"); if (!n) { n = el("p", "hint mock-msg"); p.append(n); } n.textContent = t; }
