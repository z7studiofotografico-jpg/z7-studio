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
// "5x R$ 75,40" numa linha só, tudo no tamanho da parcela (diminui a letra se não couber na largura)
export function parcelaGrande(ctx, p, x, y, maxW, cor, tam) {
  const txt = p.vezes + "x " + reais(p.parcela);
  let t = tam;
  ctx.font = `700 ${t}px 'Barlow Condensed', sans-serif`;
  while (t > 36 && ctx.measureText(txt).width > maxW) ctx.font = `700 ${(t -= 4)}px 'Barlow Condensed', sans-serif`;
  ctx.fillStyle = cor;
  ctx.fillText(txt, x, y);
  return y;
}
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
    // (28/11/2026) o "5x" do mesmo tamanho da parcela, na mesma linha ("5x R$ 75,40"): o Adriano achou que só o
    // valor aparecia e o cliente não via que era parcela
    fim = parcelaGrande(ctx, p, x, y + 82, maxW, c.forte, 72);
    ctx.fillStyle = c.fraco;
    ctx.font = "600 22px 'Source Sans 3', sans-serif";
    ctx.fillText("sem juros no cartão", x, fim + 36);
    ctx.fillStyle = c.texto;
    ctx.font = "700 27px 'Source Sans 3', sans-serif";
    fim = wrap(ctx, "ou " + st.preco + " à vista no Pix", x, fim + 80, maxW, 32);
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
  // o prazo, num selo grande grafite (bem visível): "⏳ SEU ATENDIMENTO TERMINA" / "SEX, 20/11"
  // (o preço não muda depois: o selo fala só do atendimento, prazo-atendimento.js)
  if (st.prazo) fim = seloPrazo(ctx, st.prazo, x, fim + 24, Math.min(maxW, 380), c);
  return fim;
}

// o selo do prazo: caixa cheia, duas linhas, a data grande
export function seloPrazo(ctx, prazo, x, y, w, c = {}) {
  // (28/11/2026) mais destaque sem mudar o estilo clássico (grafite com o filete vermelho do Z7), a pedido do
  // Adriano ("quem não presta atenção não vê"): a palavra "TERMINA" em vermelho e a data maior
  const H = 108;
  const fundo = c.seloFundo || "#2b2d31";
  ctx.fillStyle = fundo;
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(x, y, w, H, 18) : ctx.rect(x, y, w, H);
  ctx.fill();
  if (!c.seloFundo) {
    ctx.save();
    ctx.clip();
    ctx.fillStyle = "#d0202b";
    ctx.fillRect(x, y, 10, H);
    ctx.restore();
  }
  ctx.textAlign = "left";
  const a1 = "⏳ SEU ATENDIMENTO ",
    a2 = "TERMINA";
  let t = 25;
  ctx.font = `800 ${t}px 'Source Sans 3', sans-serif`;
  while (t > 16 && ctx.measureText(a1 + a2).width > w - 44) ctx.font = `800 ${(t -= 1)}px 'Source Sans 3', sans-serif`;
  ctx.fillStyle = "#fff";
  ctx.fillText(a1, x + 26, y + 38);
  ctx.fillStyle = c.seloFundo ? "#fff" : "#ff5a63";
  ctx.fillText(a2, x + 26 + ctx.measureText(a1).width, y + 38);
  ctx.fillStyle = "#fff";
  ctx.font = "700 54px 'Barlow Condensed', sans-serif";
  ctx.fillText(String(prazo).toUpperCase(), x + 26, y + 92);
  return y + H;
}
