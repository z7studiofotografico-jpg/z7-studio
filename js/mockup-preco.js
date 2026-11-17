// O bloco do preço nas prévias (o quadro e o Paspatur). Separado de mockup.js por tamanho.
// texto em várias linhas; devolve a altura (y) da última linha
export function wrap(ctx, text, x, y, maxW, lh) {
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
  return yy;
}

// 17/11/2026: o preço que ajuda a decidir. Em destaque a parcela do cartão sem juros ("5x de R$ 75,40"), que cabe
// no bolso de quem acha R$ 350 caro; logo abaixo o Pix à vista, mais barato; e o prazo da condição (o
// representante fica 3 dias com o aluno). Sem cartão, fica o Pix em destaque, como antes.
// "R$ 377,00 no cartão · até 5x sem juros ou até 12x com juros" → { total: 377, vezes: 5 }
export function parcelaDoCartao(cartao) {
  const t = String(cartao || "");
  const m = t.match(/R\$\s*([\d.]+(?:,\d{1,2})?)/);
  const v = t.match(/(\d{1,2})\s*x\s*sem juros/i);
  const total = m ? Number(m[1].replace(/\./g, "").replace(",", ".")) : 0;
  const vezes = v ? Number(v[1]) : 0;
  return total && vezes > 1 ? { total, vezes, parcela: Math.ceil(Math.round(total * 100) / vezes) / 100 } : null;
}
const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
// "sex, 20/11": até quando vale (o representante fica 3 dias com o aluno)
export function prazoTxt(d) {
  return `${DIAS_SEMANA[d.getDay()]}, ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}
const reais = v =>
  "R$ " +
  v
    .toFixed(2)
    .replace(".", ",")
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
export function blocoPreco(ctx, st, x, y, maxW, cores = {}) {
  const c = Object.assign(
    { forte: "#b3202a", texto: "#1c1b1d", fraco: "#6b6670", linha: "rgba(28,27,29,.15)", selo: "#1c1b1d", seloTxt: "#fff" },
    cores
  );
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = c.linha;
  ctx.fillRect(x, y, Math.min(maxW, 300), 2);
  const p = parcelaDoCartao(st.cartao);
  let fim;
  if (p) {
    ctx.fillStyle = c.fraco;
    ctx.font = "600 24px 'Source Sans 3', sans-serif";
    ctx.fillText(p.vezes + "x de", x, y + 42);
    ctx.fillStyle = c.forte;
    ctx.font = "700 72px 'Barlow Condensed', sans-serif";
    ctx.fillText(reais(p.parcela), x, y + 108);
    ctx.fillStyle = c.fraco;
    ctx.font = "600 22px 'Source Sans 3', sans-serif";
    ctx.fillText("sem juros no cartão", x, y + 140);
    ctx.fillStyle = c.texto;
    ctx.font = "700 27px 'Source Sans 3', sans-serif";
    fim = wrap(ctx, "ou " + st.preco + " à vista no Pix", x, y + 184, maxW, 32);
  } else {
    ctx.fillStyle = c.forte;
    ctx.font = "700 66px 'Barlow Condensed', sans-serif";
    ctx.fillText(st.preco, x, y + 72);
    const lp = ctx.measureText(st.preco).width;
    ctx.fillStyle = c.fraco;
    ctx.font = "600 24px 'Source Sans 3', sans-serif";
    ctx.fillText("no Pix", x + lp + 12, y + 70);
    fim = y + 72;
    if (st.cartao) {
      ctx.fillStyle = c.texto;
      ctx.font = "700 26px 'Source Sans 3', sans-serif";
      fim = wrap(ctx, "ou " + String(st.cartao).split(" · ")[0], x, y + 112, maxW, 30);
    }
  }
  // o prazo, num selo grande grafite (bem visível): "⏳ Seu atendimento vai até" / "SEX, 20/11"
  // (o preço não muda depois: o selo fala só do atendimento, prazo-atendimento.js)
  if (st.prazo) fim = seloPrazo(ctx, st.prazo, x, fim + 24, Math.min(maxW, 380), c);
  return fim;
}

// o selo do prazo: caixa cheia, duas linhas, a data grande
export function seloPrazo(ctx, prazo, x, y, w, c = {}) {
  const fundo = c.seloFundo || "#2b2d31";
  ctx.fillStyle = fundo;
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(x, y, w, 92, 18) : ctx.rect(x, y, w, 92);
  ctx.fill();
  // o filete vermelho do Z7 à esquerda (como na página da prévia)
  if (!c.seloFundo) {
    ctx.save();
    ctx.clip();
    ctx.fillStyle = "#d0202b";
    ctx.fillRect(x, y, 8, 92);
    ctx.restore();
  }
  ctx.textAlign = "left";
  ctx.fillStyle = "#fff";
  ctx.font = "700 22px 'Source Sans 3', sans-serif";
  ctx.fillText("⏳ Seu atendimento vai até", x + 24, y + 34);
  ctx.font = "700 44px 'Barlow Condensed', sans-serif";
  ctx.fillText(String(prazo).toUpperCase(), x + 24, y + 78);
  return y + 92;
}
