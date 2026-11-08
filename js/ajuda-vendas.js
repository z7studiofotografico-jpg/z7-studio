// "🆘 Ajuda de vendas" (Etapa 8): em todos os cards que vendem — PR, Paspatur, Formatura (Linha de Frente/Repasse e
// Venda Antecipada), Instituições, Funil de vendas e Aluguel de becas. Cada card tem as suas situações e respostas
// prontas (o Adriano edita e inclui novas aos poucos); o vendedor escolhe, ajusta e copia para o WhatsApp.
// As respostas puxam os preços do catálogo (Produtos e estoque), nunca abaixo do preço mínimo.
// "Copiar para perguntar ao Claude": monta um texto com as regras do estúdio, o que AQUELE card vende, os preços,
// o primeiro nome do aluno e o colégio, e um espaço para a dúvida do cliente; depois abre o Claude gratuito
// (claude.ai) para a pessoa colar. NÃO leva telefone nem outros dados pessoais (muitos alunos são menores).
// O app não se liga a nenhuma IA: nada é enviado pelo app e não há custo.
// Guardado em config/app → ajudaCards = { textos: { card: { situacao: texto } }, extras: { card: [{ titulo, texto }] } }
//
// FASE 2 (descrita, NÃO ativada — só com a aprovação do Adriano): um campo para colar a dúvida do cliente e receber a
// sugestão do Claude dentro do app. Precisaria de uma chave da API da Anthropic guardada num servidor (nunca no app,
// que é público) — por exemplo uma função na nuvem — porque o plano Spark do Firebase não roda funções. Regras: só
// produtos, preços e condições do catálogo; nunca inventar preço; nunca abaixo do preço mínimo; se não souber,
// "consulte o Adriano"; mostrar a sugestão para editar e NUNCA enviar sozinho; mandar só primeiro nome, colégio e a
// pergunta; registrar quem usou e quando.
import { el, sheet, title, topoDireita } from "./ui.js";
import * as U from "./util.js";
import { brl } from "./regras.js";
import { carregarCatalogo } from "./estoque.js";

export const FORMAS_TXT = "Pix, cartão de crédito (pode parcelar), link de pagamento e boleto";
const PIX = "21998817771";
export const CLAUDE_URL = "https://claude.ai/new";
// o Claude abre com o texto já escrito na caixa (?q=); a pessoa só confere e envia
export const urlClaude = t => CLAUDE_URL + "?q=" + encodeURIComponent(t);
// a dúvida colada pelo vendedor perde telefones, e-mails e CPF antes de ir para o Claude
export const limparDuvida = t =>
  String(t || "")
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[e-mail]")
    .replace(/\+?\(?\d(?:[\s().-]*\d){7,}/g, "[número]")
    .trim()
    .slice(0, 1500);

const S = {
  preco: ["preco", "Preço", "{oi} O valor de {produto} é {preco}. Posso te mandar a prévia para você ver como fica?"],
  caro: [
    "caro",
    "“Está caro”",
    "{oi} Entendo! Dá para dividir no cartão. É uma lembrança para a vida toda 😊 Quer que eu te mostre as opções?"
  ],
  pensar: ["pensar", "“Vou pensar”", "{oi} Claro, sem pressa! Posso te chamar de novo em alguns dias para tirar alguma dúvida?"],
  pagamento: ["pagamento", "Forma de pagamento", "{oi} Aceitamos {formas}. Qual fica melhor para você?"],
  prazo: ["prazo", "Prazo de entrega", "{oi} Depois do pagamento, o prazo de entrega é de [prazo]. Te aviso quando estiver pronto!"]
};
// cada card: o que vende (vai no texto do Claude), quais produtos do catálogo entram e as situações
export const CARDS = {
  pr: {
    nome: "PR",
    vende: "o Kit PR (quadro 30x40 com moldura, 2 porta-retratos e fotos digitais) das fotos que o aluno fez no ensaio no colégio",
    grupos: ["Kit", "Quadro", "Porta-retrato", "Foto avulsa"],
    situacoes: [
      S.preco,
      S.caro,
      S.pensar,
      S.pagamento,
      ["previa", "Prévia", "{oi} Vou te mandar a prévia das fotos de {aluno} para você ver como fica o kit 📸"],
      ["kit", "O que vem no kit", "{oi} O kit tem {kit}. Fica pronto para retirar no estúdio."],
      S.prazo
    ]
  },
  paspatur: {
    nome: "Paspatur",
    vende: "o Kit Paspatur de fotos, com as fotos do ensaio do aluno no colégio",
    grupos: ["Paspatur", "Foto avulsa"],
    situacoes: [
      S.preco,
      S.caro,
      S.pensar,
      S.pagamento,
      ["previa", "Prévia", "{oi} Vou te mandar a prévia do Kit Paspatur de fotos de {aluno} 📸"],
      S.prazo
    ]
  },
  formatura: {
    nome: "Formatura (Linha de Frente / Repasse)",
    vende: "os kits de fotos da formatura do aluno (fotos já feitas; o cliente escolhe o kit)",
    grupos: ["Kit", "Quadro", "Porta-retrato", "Foto avulsa", "Diploma", "Canudo"],
    situacoes: [
      S.preco,
      S.caro,
      S.pensar,
      S.pagamento,
      ["previa", "Prévia", "{oi} Vou te mandar a prévia das fotos da formatura de {aluno} para você escolher 📸"],
      ["kit", "Kits", "{oi} Temos os kits da formatura de {colegio}. Quer que eu te mande as opções?"],
      S.prazo
    ]
  },
  va: {
    nome: "Venda Antecipada",
    vende: "o contrato da formatura antes das fotos (kits pagos em parcelas, boleto ou Pix)",
    grupos: ["Kit", "Diploma", "Canudo"],
    situacoes: [
      [
        "kit",
        "Kits e parcelas",
        "{oi} Os kits da formatura de {colegio} podem ser parcelados até a formatura. Quer que eu te mande as opções?"
      ],
      S.caro,
      S.pensar,
      ["pagamento", "Boleto ou Pix", "{oi} Pode pagar pelo boleto ou, se preferir, no Pix: {pix}."],
      [
        "cobranca",
        "Cobrança de parcela",
        "{oi} Passando para lembrar da parcela de {aluno}. Se preferir, pode pagar no Pix: {pix}. Qualquer dúvida, estou aqui 😊"
      ],
      ["atraso", "Parcela atrasada", "{oi} Vi que a parcela de {aluno} ficou em aberto. Conseguimos acertar esta semana? Pix: {pix}"]
    ]
  },
  instituicao: {
    nome: "Instituições",
    vende: "o contrato de formatura com o colégio ou a comissão (colação de grau, ensaio no colégio e álbum/kits da formatura)",
    grupos: ["Kit", "Diploma", "Canudo"],
    situacoes: [
      [
        "apresentacao",
        "Apresentação",
        "{oi} Aqui é {eu}, do Z7 Studio 📸 Fazemos a formatura completa (colação, fotos e kits). Posso marcar uma visita?"
      ],
      ["proposta", "Proposta", "{oi} Segue a nossa proposta para a formatura de {colegio}. Qualquer dúvida, estou à disposição!"],
      [
        "concorrente",
        "“Já temos empresa”",
        "{oi} Entendo! Se quiser comparar, posso deixar uma proposta sem compromisso para o ano que vem."
      ],
      S.pensar,
      ["retorno", "Retorno", "{oi} Passando para saber se conseguiram ver a proposta para a formatura de {colegio} 😊"]
    ]
  },
  funil: {
    nome: "Funil de vendas",
    vende: "ensaios fotográficos do estúdio (formatura, corporativo e retratos), com as fotos tratadas",
    grupos: ["Foto avulsa", "Quadro", "Porta-retrato"],
    situacoes: [
      ["preco", "Preço do ensaio", "{oi} O ensaio sai por [valor]. Inclui [o que inclui]. Quer que eu veja as datas livres?"],
      S.caro,
      S.pensar,
      S.pagamento,
      ["agenda", "Agendar", "{oi} Tenho horário em [data]. Fica bom para você?"],
      ["local", "Onde fica", "{oi} O estúdio fica na Estrada Dr. Rufino Gonçalves Ferreira, 290, Centro de Nilópolis."],
      S.prazo
    ]
  },
  aluguel: {
    nome: "Aluguel de becas",
    vende: "o aluguel de beca, faixa e capelo para a formatura, e os produtos que podem ir junto (paspatur, fotos, diploma, canudo)",
    grupos: ["Paspatur", "Foto avulsa", "Diploma", "Canudo", "Kit"],
    situacoes: [
      ["preco", "Preço do aluguel", "{oi} O aluguel da beca para {aluno} sai por {preco}. Quer que eu já reserve o tamanho?"],
      ["tamanho", "Tamanho / prova", "{oi} Podemos medir {aluno} aqui no estúdio ou você me passa a altura que eu separo o tamanho."],
      ["retirada", "Retirada e devolução", "{oi} A retirada é em [data] e a devolução até [data], no estúdio."],
      ["produtos", "Produtos junto", "{oi} Junto com a beca você pode levar paspatur, fotos, diploma e canudo. Quer ver as opções?"],
      S.pagamento,
      S.pensar
    ]
  }
};
export const cardDe = k => CARDS[k] || CARDS.pr;

// preço que pode ir para o cliente: o preço do catálogo, nunca abaixo do mínimo
export const precoCliente = p => Math.max(Number(p.preco) || 0, Number(p.precoMin) || 0);
export function listaPrecos(cat, grupos) {
  return cat
    .filter(p => p.categoria === "venda" && precoCliente(p) > 0 && (!grupos || grupos.includes(p.grupo)))
    .map(p => `- ${p.nome}: ${brl(precoCliente(p))}` + (Number(p.precoMin) ? ` (mínimo ${brl(Number(p.precoMin))})` : ""));
}
// situações do card: as padrão (com o texto editado, se houver) + as incluídas pelo Adriano
export function situacoesDo(card, guardado = {}) {
  const textos = (guardado.textos || {})[card] || {},
    extras = (guardado.extras || {})[card] || [];
  return [
    ...cardDe(card).situacoes.map(([k, nome, ex]) => ({ k, nome, texto: textos[k] || ex, padrao: ex })),
    ...extras.filter(x => x && x.titulo).map((x, i) => ({ k: "x" + i, nome: x.titulo, texto: x.texto || "", extra: true }))
  ];
}
// texto para colar no Claude (fora do app): sem telefone e sem dados pessoais além do primeiro nome
export function textoParaClaude({
  card = "pr",
  aluno = "",
  colegio = "",
  cat = [],
  precoModulo = "",
  guardado = {},
  duvida = "",
  curto = false
}) {
  const d = limparDuvida(duvida);
  const c = cardDe(card);
  const precos = listaPrecos(cat, c.grupos);
  const respostas = situacoesDo(card, guardado)
    .filter(s => s.texto)
    .map(s => `- ${s.nome}: ${s.texto}`);
  return [
    `Você está ajudando um vendedor do Z7 Studio Fotográfico (Nilópolis, RJ) a responder um cliente pelo WhatsApp.`,
    `Assunto: ${c.nome} — o estúdio vende ${c.vende}.`,
    "",
    "REGRAS DO ESTÚDIO:",
    "1. Use só os produtos e preços da lista abaixo. Nunca invente preço, produto, desconto ou prazo.",
    "2. Nunca ofereça valor abaixo do “mínimo” de cada produto.",
    "3. Se não souber a resposta, diga: “consulte o Adriano”.",
    "4. Sugira a resposta para o vendedor editar. Não envie nada: quem envia é o vendedor.",
    "5. Responda em português, curto e simpático, no tom de WhatsApp.",
    "",
    "PRODUTOS E PREÇOS ATUAIS:",
    ...(precoModulo ? [`- Preço de ${c.nome} para este cliente: ${precoModulo}`] : []),
    ...(precos.length ? precos : ["- (sem preços cadastrados para este assunto: consulte o Adriano)"]),
    "",
    "FORMAS DE PAGAMENTO: " + FORMAS_TXT + ". Pix: " + PIX + ".",
    "",
    ...(respostas.length && !curto ? ["RESPOSTAS QUE O ESTÚDIO JÁ USA (siga o mesmo tom):", ...respostas, ""] : []),
    "CLIENTE:",
    ...(aluno ? [`- Aluno(a): ${U.first(title(aluno))}`] : []),
    ...(colegio ? [`- Colégio: ${title(colegio)}`] : []),
    "",
    ...(d
      ? ["DÚVIDA DO CLIENTE:", d, "", "Sugira a resposta que o vendedor pode mandar no WhatsApp."]
      : ["COLE AQUI A DÚVIDA DO CLIENTE:", "", ""])
  ].join("\n");
}
export function preencherAjuda(t, v) {
  return String(t || "").replace(/\{(\w+)\}/g, (m, k) => (v[k] != null && v[k] !== "" ? v[k] : m));
}

export async function copiar(txt) {
  try {
    await navigator.clipboard.writeText(txt);
    return true;
  } catch (_) {
    const t = el("textarea");
    t.value = txt;
    document.body.append(t);
    t.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch (_e) {}
    t.remove();
    return ok;
  }
}
const guardadoDe = C => (C.P && C.P.ajudaCards) || {};

// o = { card, aluno, colegio, precoModulo, contato } (contato = primeiro nome de quem recebe a mensagem)
export async function abrirAjuda(C, o = {}) {
  const card = CARDS[o.card] ? o.card : "pr";
  let cat = [];
  try {
    cat = await carregarCatalogo(C);
  } catch (_) {}
  const v = {
    oi: o.contato ? `Olá, ${U.first(title(o.contato))}!` : "Olá!",
    aluno: U.first(title(o.aluno || "")),
    colegio: title(o.colegio || ""),
    preco: o.precoModulo || "",
    produto: card === "paspatur" ? "o paspatur" : card === "aluguel" ? "o aluguel" : "o kit",
    formas: FORMAS_TXT,
    pix: PIX,
    eu: U.first(C.me || "") || "a equipe",
    kit: ""
  };
  const kp = cat.find(p => p.id === "kit_pr");
  if (kp) v.kit = kp.nome.replace(/^Kit PR \(|\)$/g, "");
  sheet("🆘 Ajuda de vendas · " + cardDe(card).nome, (p, close) => {
    if (C.isAdmin)
      topoDireita(
        p,
        U.mkBtn("✏️ Editar respostas", "btn-sm", () => {
          close();
          editarRespostas(C, card);
        })
      );
    const chips = el("div", "chips");
    const txt = el("textarea");
    txt.rows = 6;
    txt.setAttribute("aria-label", "Resposta (ajuste antes de copiar)");
    situacoesDo(card, guardadoDe(C)).forEach(s => {
      const b = el("button", "chip", s.nome);
      b.type = "button";
      b.onclick = () => {
        chips.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
        txt.value = preencherAjuda(s.texto, v);
      };
      chips.append(b);
    });
    p.append(el("p", "hint", "Escolha a situação, ajuste o texto e copie para o WhatsApp."), chips, txt);
    const acoes = el("div", "actions");
    acoes.append(
      U.mkBtn("📋 Copiar resposta", "btn-primary", async () => {
        if (!txt.value.trim()) return U.toast("Escolha uma situação primeiro.");
        U.toast((await copiar(txt.value)) ? "Resposta copiada. Cole no WhatsApp." : "Não consegui copiar: selecione o texto e copie.");
      }),
      U.mkBtn("🤖 Perguntar ao Claude (grátis)", "", () => {
        if (!duv.value.trim()) {
          duv.focus();
          return U.toast("Cole primeiro a mensagem do cliente no campo “Dúvida do cliente”.");
        }
        const t = textoParaClaude({
          card,
          aluno: o.aluno,
          colegio: o.colegio,
          cat,
          precoModulo: o.precoModulo,
          guardado: guardadoDe(C),
          duvida: duv.value
        });
        // abre já (no celular, abrir depois de esperar é bloqueado) com o texto pronto na caixa do Claude;
        // e também copia, caso o Claude abra sem o texto (aí é só colar)
        // link muito grande (muitas respostas cadastradas): vai sem a lista de respostas, que é só exemplo de tom
        let url = urlClaude(t);
        if (url.length > 7000)
          url = urlClaude(
            textoParaClaude({ card, aluno: o.aluno, colegio: o.colegio, cat, precoModulo: o.precoModulo, duvida: duv.value, curto: true })
          );
        window.open(url, "_blank", "noopener");
        copiar(t).catch(() => {});
        U.toast("Abrindo o Claude com a pergunta pronta. Se a caixa vier vazia, segure e “Colar”.");
      })
    );
    const duv = el("textarea");
    duv.rows = 3;
    duv.placeholder = "Cole aqui a mensagem do cliente (ex.: “dá para pagar em 3 vezes?”)";
    duv.id = "ajvDuvida";
    const fd = el("div", "field");
    const ld = el("label", null, "Dúvida do cliente (para perguntar ao Claude)");
    ld.htmlFor = duv.id;
    fd.append(ld, duv);
    p.append(fd, acoes);
    p.append(
      el(
        "p",
        "hint",
        "“Perguntar ao Claude” abre o Claude gratuito com a pergunta já escrita: as regras do estúdio, os preços, o primeiro nome do aluno, o colégio e a dúvida do cliente (telefones e e-mails da mensagem são tirados). Lá é só enviar, ler a sugestão e ajustar antes de mandar ao cliente. O app não envia nada sozinho."
      )
    );
    const a = el("div", "panel-actions");
    a.append(el("span"), U.mkBtn("Fechar", "", close));
    a.firstChild.style.flex = "1";
    p.append(a);
  });
}

// Respostas de um card (só o Adriano): edita as padrão e inclui novas aos poucos ("+ Incluir" no canto)
export function editarRespostas(C, card0 = "pr", { incluir = false } = {}) {
  let card = CARDS[card0] ? card0 : "pr";
  const g = JSON.parse(JSON.stringify(guardadoDe(C)));
  g.textos = g.textos || {};
  g.extras = g.extras || {};
  sheet("✏️ Respostas da Ajuda de vendas", (p, close) => {
    const corpo = el("div");
    const desenhar = () => {
      corpo.textContent = "";
      const chips = el("div", "chips");
      Object.entries(CARDS).forEach(([k, c]) => {
        const b = el("button", "chip", c.nome);
        b.type = "button";
        b.setAttribute("aria-pressed", String(k === card));
        b.onclick = () => {
          ler();
          card = k;
          desenhar();
        };
        chips.append(b);
      });
      corpo.append(
        chips,
        el(
          "p",
          "hint",
          "Use {oi}, {aluno}, {colegio}, {preco}, {produto}, {formas}, {pix}, {kit} e {eu} onde o app deve completar. Pode salvar aos poucos."
        )
      );
      cardDe(card).situacoes.forEach(([k, nome, ex]) => {
        const t = el("textarea");
        t.rows = 3;
        t.placeholder = ex;
        t.value = (g.textos[card] || {})[k] || "";
        t.dataset.k = k;
        const f = el("div", "field");
        const l = el("label", null, nome);
        t.id = "ajv_" + card + "_" + k;
        l.htmlFor = t.id;
        f.append(l, t);
        corpo.append(f);
      });
      (g.extras[card] || []).forEach((x, i) => {
        const f = el("div", "field ajv-extra");
        const ti = el("input");
        ti.value = x.titulo || "";
        ti.placeholder = "Situação (ex.: “Posso pagar depois?”)";
        ti.dataset.ei = i;
        ti.setAttribute("aria-label", "Situação incluída");
        const t = el("textarea");
        t.rows = 3;
        t.value = x.texto || "";
        t.dataset.ex = i;
        t.setAttribute("aria-label", "Resposta da situação incluída");
        const tira = U.mkBtn("🗑️", "btn-danger btn-sm", () => {
          ler();
          g.extras[card].splice(i, 1);
          desenhar();
        });
        tira.setAttribute("aria-label", "Tirar esta situação");
        f.append(ti, t, tira);
        corpo.append(f);
      });
    };
    const ler = () => {
      const tx = (g.textos[card] = g.textos[card] || {});
      corpo.querySelectorAll("textarea[data-k]").forEach(t => (tx[t.dataset.k] = t.value.trim()));
      const ex = g.extras[card] || [];
      corpo.querySelectorAll("input[data-ei]").forEach(i => (ex[i.dataset.ei].titulo = i.value.trim()));
      corpo.querySelectorAll("textarea[data-ex]").forEach(t => (ex[t.dataset.ex].texto = t.value.trim()));
    };
    topoDireita(
      p,
      U.mkBtn("+ Incluir", "btn-primary btn-sm", () => {
        ler();
        (g.extras[card] = g.extras[card] || []).push({ titulo: "", texto: "" });
        desenhar();
        const ult = corpo.querySelectorAll("input[data-ei]");
        if (ult.length) ult[ult.length - 1].focus();
      })
    );
    if (incluir) (g.extras[card] = g.extras[card] || []).push({ titulo: "", texto: "" });
    desenhar();
    p.append(corpo);
    const a = el("div", "panel-actions");
    const ok = el("button", "btn btn-primary", "Salvar");
    ok.type = "submit";
    a.append(el("span"), U.mkBtn("Cancelar", "", close), ok);
    a.firstChild.style.flex = "1";
    p.append(a);
    p.addEventListener("submit", async ev => {
      ev.preventDefault();
      ler();
      Object.keys(g.extras).forEach(k => (g.extras[k] = (g.extras[k] || []).filter(x => x.titulo || x.texto)));
      ok.disabled = true;
      try {
        await C.FS.setDoc(C.FS.doc(C.db, "config", "app"), { ajudaCards: g }, { merge: true });
        if (C.P) C.P.ajudaCards = g;
        U.toast("Respostas salvas ✅");
        close();
      } catch (e) {
        ok.disabled = false;
        C.handleErr(e);
      }
    });
  });
}
