// Prévia da formatura (venda depois das fotos), montada no próprio celular — as fotos não sobem para a internet.
// - "Todas as fotos": folha com TODAS as fotos do kit do aluno (o kit é vendido inteiro), em páginas de 30.
// - "Prévia do álbum": capa e duas páginas duplas do álbum, para os Kits 04 e 05.
// Tudo sai com marca d'água repetida e as fotos reduzidas (um print não serve como foto final).
import { el, avisoErro } from "./ui.js";
import { cover, marca, prep, logoAtual } from "./mockup.js";
import { msgPrevia } from "./mensagens.js";

const POR_PAGINA = 30,
  COLS = 5,
  LADO = 640, // fotos reduzidas para no máximo 640 px (pouca memória, mesmo com 70 fotos)
  MAX_FOTOS = 90; // acima disso o celular pode ficar sem memória
const FUNDO = "#f3f0ec",
  TINTA = "#1c1b1d",
  CINZA = "#6b6670";

// Lê a foto e já reduz (um celular não aguenta 70 fotos de 12 MP abertas ao mesmo tempo)
async function reduzir(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const r = Math.min(1, LADO / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * r);
    c.height = Math.round(img.height * r);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return c;
  } finally {
    URL.revokeObjectURL(url);
  }
}
function cabecalho(ctx, W, st, sub) {
  ctx.fillStyle = TINTA;
  ctx.fillRect(0, 0, W, 150);
  const lg = logoAtual();
  if (lg) ctx.drawImage(lg, 40, 25, 100, 100);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = "700 52px 'Barlow Condensed', sans-serif";
  ctx.fillText((st.nome || "Formando").toUpperCase(), 165, 78);
  ctx.font = "600 26px 'Source Sans 3', sans-serif";
  ctx.fillStyle = "rgba(255,255,255,.8)";
  ctx.fillText(sub, 165, 118);
}
function rodape(ctx, W, H, txt) {
  ctx.fillStyle = CINZA;
  ctx.font = "400 22px 'Source Sans 3', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(txt, W / 2, H - 28);
}

// Uma página da folha com todas as fotos
export function desenharFolha(cv, st, pagina) {
  const W = 1080,
    gap = 12,
    margem = 30,
    cw = (W - margem * 2 - gap * (COLS - 1)) / COLS,
    ch = cw * 1.25;
  const fotos = st.fotos.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA),
    linhas = Math.ceil(fotos.length / COLS) || 1;
  const H = 150 + 40 + linhas * (ch + gap) + 90;
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext("2d");
  ctx.fillStyle = FUNDO;
  ctx.fillRect(0, 0, W, H);
  const paginas = Math.ceil(st.fotos.length / POR_PAGINA) || 1;
  cabecalho(
    ctx,
    W,
    st,
    `${st.escola ? st.escola + " · " : ""}${st.fotos.length} fotos do kit${paginas > 1 ? ` · página ${pagina + 1} de ${paginas}` : ""}`
  );
  fotos.forEach((f, i) => {
    const x = margem + (i % COLS) * (cw + gap),
      y = 190 + Math.floor(i / COLS) * (ch + gap);
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,.18)";
    ctx.shadowBlur = 8;
    ctx.fillStyle = "#fff";
    ctx.fillRect(x, y, cw, ch);
    ctx.restore();
    cover(ctx, f, x + 5, y + 5, cw - 10, ch - 10, 0.35);
  });
  marca(ctx, 0, 150, W, H - 150 - 70);
  rodape(ctx, W, H, "Prévia com marca d'água · o kit é entregue com todas as fotos, tratadas e sem marca");
}

// Álbum aberto (página dupla), com as fotos em layout de revista
function paginaDupla(ctx, W, H, fotos, layout) {
  const m = 50,
    top = 180,
    ph = H - top - 110,
    pw = (W - m * 2) / 2;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.35)";
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 18;
  ctx.fillStyle = "#fbfaf8";
  ctx.fillRect(m, top, pw * 2, ph);
  ctx.restore();
  const p = 34,
    g = 14;
  const L = { x: m + p, y: top + p, w: pw - p * 1.5, h: ph - p * 2 },
    R = { x: m + pw + p / 2, y: top + p, w: pw - p * 1.5, h: ph - p * 2 };
  const foto = (f, r) => f && cover(ctx, f, r.x, r.y, r.w, r.h, 0.35);
  if (layout === 0) {
    foto(fotos[0], L);
    foto(fotos[1], { x: R.x, y: R.y, w: R.w, h: (R.h - g) / 2 });
    foto(fotos[2], { x: R.x, y: R.y + (R.h + g) / 2, w: R.w, h: (R.h - g) / 2 });
  } else {
    const qw = (L.w - g) / 2,
      qh = (L.h - g) / 2;
    [0, 1, 2, 3].forEach(i => foto(fotos[i], { x: L.x + (i % 2) * (qw + g), y: L.y + Math.floor(i / 2) * (qh + g), w: qw, h: qh }));
    foto(fotos[4], R);
  }
  // dobra do meio do álbum
  const dob = ctx.createLinearGradient(m + pw - 40, 0, m + pw + 40, 0);
  dob.addColorStop(0, "rgba(0,0,0,0)");
  dob.addColorStop(0.5, "rgba(0,0,0,.28)");
  dob.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = dob;
  ctx.fillRect(m + pw - 40, top, 80, ph);
  marca(ctx, m, top, pw * 2, ph);
}
// Capa + duas páginas duplas, numa imagem só (fácil de mandar)
export function desenharAlbum(cv, st, escolhidas) {
  const W = 1600,
    H = 900,
    esc = escolhidas || st.fotos;
  cv.width = W;
  cv.height = H * 3 - 300;
  const ctx = cv.getContext("2d");
  ctx.fillStyle = "#e9e4dd";
  ctx.fillRect(0, 0, cv.width, cv.height);
  cabecalho(ctx, W, st, `${st.escola ? st.escola + " · " : ""}prévia do álbum · ${st.fotos.length} fotos no kit`);
  // capa
  const cx = W / 2 - 230,
    cy = 190,
    cww = 460,
    chh = 560;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.4)";
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 20;
  ctx.fillStyle = TINTA;
  ctx.fillRect(cx, cy, cww, chh);
  ctx.restore();
  if (esc[0]) cover(ctx, esc[0], cx + 30, cy + 30, cww - 60, chh - 170, 0.3);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.font = "700 46px 'Barlow Condensed', sans-serif";
  ctx.fillText((st.nome || "").toUpperCase().slice(0, 26), W / 2, cy + chh - 85);
  ctx.font = "600 24px 'Source Sans 3', sans-serif";
  ctx.fillStyle = "rgba(255,255,255,.75)";
  ctx.fillText(`FORMATURA ${new Date().getFullYear()}`, W / 2, cy + chh - 45);
  marca(ctx, cx, cy, cww, chh);
  // duas páginas duplas
  ctx.save();
  ctx.translate(0, 600);
  paginaDupla(ctx, W, H, esc.slice(1, 4), 0);
  ctx.restore();
  ctx.save();
  ctx.translate(0, 600 + H - 150);
  paginaDupla(ctx, W, H, esc.slice(4, 9), 1);
  ctx.restore();
  ctx.fillStyle = CINZA;
  ctx.font = "400 24px 'Source Sans 3', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Prévia com marca d'água · o álbum é entregue com todas as fotos, tratadas e sem marca", W / 2, cv.height - 30);
}

export function openPrevia({ nome = "", escola = "", kits = "", toast = null } = {}) {
  const st = { fotos: [], nome, escola, modo: "folha", pagina: 0, embaralho: 0 };
  const sh = el("div", "sheet"),
    p = el("div", "panel mock");
  sh.append(p);
  document.body.append(sh);
  const close = () => sh.remove();
  sh.addEventListener("click", e => {
    if (e.target === sh) close();
  });
  p.append(el("h2", null, "Prévia da formatura"));
  const modos = el("div", "chips");
  const bF = el("button", "chip", "📋 Todas as fotos"),
    bA = el("button", "chip", "📘 Prévia do álbum");
  [bF, bA].forEach(b => {
    b.type = "button";
    modos.append(b);
  });
  p.append(modos);
  const drop = el("label", "drop");
  drop.append(
    el("b", null, "Escolha todas as fotos do aluno"),
    el("span", null, "Pode escolher de uma vez (20 a 70 fotos). Elas não saem do celular: o app monta a prévia aqui.")
  );
  const inp = el("input");
  inp.type = "file";
  inp.accept = "image/*";
  inp.multiple = true;
  inp.hidden = true;
  drop.append(inp);
  p.append(drop);
  const info = el("p", "hint");
  p.append(info);
  const nav = el("div", "actions");
  const ant = el("button", "btn btn-sm", "‹ Página"),
    prox = el("button", "btn btn-sm", "Página ›"),
    troca = el("button", "btn btn-sm", "🔀 Trocar fotos do álbum");
  [ant, prox, troca].forEach(b => (b.type = "button"));
  nav.append(ant, prox, troca);
  p.append(nav);
  const cv = el("canvas", "mock-cv");
  p.append(cv);
  const acts = el("div", "panel-actions");
  const bClose = el("button", "btn", "Fechar"),
    bDown = el("button", "btn", "Baixar"),
    bShare = el("button", "btn btn-primary", "Enviar pelo WhatsApp");
  [bClose, bDown, bShare].forEach(b => (b.type = "button"));
  bClose.onclick = close;
  const sp = el("span");
  sp.style.flex = "1";
  acts.append(bClose, sp, bDown, bShare);
  p.append(acts);

  const paginas = () => Math.ceil(st.fotos.length / POR_PAGINA) || 1;
  // fotos do álbum: a primeira na capa e oito espalhadas pelo ensaio (trocar mostra outras)
  const doAlbum = () => {
    const n = st.fotos.length;
    if (n <= 9) return st.fotos;
    return Array.from({ length: 9 }, (_, i) => st.fotos[(Math.floor((i * n) / 9) + st.embaralho) % n]);
  };
  async function desenhar() {
    await prep();
    if (!st.fotos.length) {
      cv.width = 1080;
      cv.height = 300;
      const c = cv.getContext("2d");
      c.fillStyle = FUNDO;
      c.fillRect(0, 0, 1080, 300);
      c.fillStyle = CINZA;
      c.font = "600 32px 'Source Sans 3', sans-serif";
      c.textAlign = "center";
      c.fillText("Escolha as fotos do aluno acima", 540, 160);
    } else if (st.modo === "folha") desenharFolha(cv, st, st.pagina);
    else desenharAlbum(cv, st, doAlbum());
    ant.hidden = prox.hidden = st.modo !== "folha" || paginas() < 2;
    troca.hidden = st.modo !== "album" || st.fotos.length <= 9;
    ant.disabled = st.pagina === 0;
    prox.disabled = st.pagina >= paginas() - 1;
    info.textContent = st.fotos.length
      ? st.modo === "folha"
        ? `${st.fotos.length} fotos em ${paginas()} página${paginas() > 1 ? "s" : ""}. Ao enviar, vão todas as páginas.`
        : "Capa e duas páginas duplas com fotos do ensaio. Toque em 🔀 para usar outras fotos."
      : "";
  }
  function setModo(m) {
    st.modo = m;
    bF.setAttribute("aria-pressed", String(m === "folha"));
    bA.setAttribute("aria-pressed", String(m === "album"));
    desenhar();
  }
  bF.onclick = () => setModo("folha");
  bA.onclick = () => setModo("album");
  ant.onclick = () => {
    st.pagina = Math.max(0, st.pagina - 1);
    desenhar();
  };
  prox.onclick = () => {
    st.pagina = Math.min(paginas() - 1, st.pagina + 1);
    desenhar();
  };
  troca.onclick = () => {
    st.embaralho = (st.embaralho + 1) % Math.max(1, st.fotos.length);
    desenhar();
  };
  inp.onchange = async () => {
    let files = [...inp.files].filter(f => f.type.startsWith("image/"));
    inp.value = "";
    const cabem = MAX_FOTOS - st.fotos.length;
    if (files.length > cabem) {
      toast(`A prévia aceita até ${MAX_FOTOS} fotos (mais que isso o celular pode travar). Ficaram as primeiras ${Math.max(0, cabem)}.`);
      files = files.slice(0, Math.max(0, cabem));
    }
    let falhou = 0;
    for (let i = 0; i < files.length; i++) {
      info.textContent = `Preparando as fotos… ${i + 1} de ${files.length}`;
      try {
        st.fotos.push(await reduzir(files[i]));
      } catch (_) {
        falhou++;
      }
    }
    if (falhou) avisoErro(new Error("foto"), `abrir ${falhou} foto${falhou > 1 ? "s" : ""} (use JPG ou PNG)`, toast);
    st.pagina = 0;
    desenhar();
  };
  // canvas → JPG; sem memória o navegador devolve null em vez de dar erro
  const jpg = async (c, nome) => {
    const b = await new Promise(r => c.toBlob(r, "image/jpeg", 0.82));
    if (!b) throw new Error("sem memória");
    return new File([b], nome, { type: "image/jpeg" });
  };
  const SEM_MEMORIA = "O celular ficou sem memória para gerar as imagens. Feche outros apps ou use menos fotos e tente de novo.";
  // gera as imagens para mandar: todas as páginas da folha, ou a imagem do álbum
  async function imagens() {
    await prep();
    const out = [],
      c = document.createElement("canvas");
    const nome0 =
      (st.nome || "previa")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "previa";
    if (st.modo === "folha") {
      for (let i = 0; i < paginas(); i++) {
        desenharFolha(c, st, i);
        out.push(await jpg(c, `${nome0}-fotos-${i + 1}.jpg`));
      }
    } else {
      desenharAlbum(c, st, doAlbum());
      out.push(await jpg(c, `${nome0}-album.jpg`));
    }
    return out;
  }
  const gerar = async () => {
    try {
      return await imagens();
    } catch (_) {
      info.textContent = SEM_MEMORIA;
      toast(SEM_MEMORIA);
      return null;
    }
  };
  bDown.onclick = async fs => {
    const lista = Array.isArray(fs) ? fs : await gerar();
    if (!lista) return false;
    for (const f of lista) {
      const u = URL.createObjectURL(f),
        a = document.createElement("a");
      a.href = u;
      a.download = f.name;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(u), 4000);
    }
    return true;
  };
  bShare.onclick = async () => {
    if (!st.fotos.length) return inp.click();
    const files = await gerar();
    if (!files) return;
    const data = { files, text: msgPrevia(st.nome, st.fotos.length, kits) };
    let motivo = "";
    if (navigator.canShare && navigator.canShare(data)) {
      try {
        await navigator.share(data);
        return;
      } catch (e) {
        if (e && e.name === "AbortError") return;
        motivo = "Não deu para abrir o compartilhar do celular (imagens grandes demais ou muitas de uma vez). ";
      }
    }
    if (await bDown.onclick(files)) info.textContent = motivo + "Imagens baixadas. No WhatsApp, clique no clipe 📎 e escolha as imagens.";
  };
  if (!navigator.canShare) bShare.textContent = "Baixar para o WhatsApp";
  setModo("folha");
}
