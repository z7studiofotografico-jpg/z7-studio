// "🆘 Ajuda de vendas" (Etapa 8): nos cards de aluno (PR, Paspatur, Formatura Linha de Frente/Repasse, Venda
// Antecipada) e de instituição. O vendedor escolhe a situação, ajusta a resposta pronta e copia para o WhatsApp.
// As respostas ficam em config/app (ajudaVendas) (o Adriano edita) e puxam os preços do catálogo (Produtos e estoque),
// nunca abaixo do preço mínimo.
// "Copiar para perguntar ao Claude": monta um texto com as regras do estúdio, os produtos e preços atuais, o primeiro
// nome do aluno e o colégio, e um espaço para a dúvida do cliente. NÃO leva telefone nem outros dados pessoais (muitos
// alunos são menores). O app não se liga a nenhuma IA: o vendedor cola o texto no Claude, fora do app. Custo zero.
//
// FASE 2 (descrita, NÃO ativada — só com a aprovação do Adriano): um campo para colar a dúvida do cliente e receber a
// sugestão do Claude dentro do app. Precisaria de uma chave da API da Anthropic guardada num servidor (nunca no app,
// que é público) — por exemplo uma função na nuvem — porque o plano Spark do Firebase não roda funções. Regras: só
// produtos, preços e condições do catálogo; nunca inventar preço; nunca abaixo do preço mínimo; se não souber,
// "consulte o Adriano"; mostrar a sugestão para editar e NUNCA enviar sozinho; mandar só primeiro nome, colégio e a
// pergunta; registrar quem usou e quando.
import { el, sheet, title } from "./ui.js";
import * as U from "./util.js";
import { brl } from "./regras.js";
import { carregarCatalogo } from "./estoque.js";

export const SITUACOES = [
  ["preco", "Preço", "{oi} O valor de {produto} é {preco}. Posso te mandar a prévia para você ver como fica?"],
  [
    "caro",
    "“Está caro”",
    "{oi} Entendo! Dá para dividir no cartão. É uma lembrança para a vida toda de {aluno} 😊 Quer que eu te mostre as opções?"
  ],
  ["pensar", "“Vou pensar”", "{oi} Claro, sem pressa! Posso te chamar de novo em alguns dias para tirar alguma dúvida?"],
  ["pagamento", "Forma de pagamento", "{oi} Aceitamos {formas}. Qual fica melhor para você?"],
  ["previa", "Prévia", "{oi} Vou te mandar a prévia das fotos de {aluno} para você escolher 📸"],
  ["kit", "Kit", "{oi} O kit tem {kit}. Fica pronto para retirar no estúdio."],
  ["prazo", "Prazo de entrega", "{oi} Depois do pagamento, o prazo de entrega é de [prazo]. Te aviso quando estiver pronto!"],
  [
    "cobranca",
    "Cobrança de parcela",
    "{oi} Passando para lembrar da parcela de {aluno}. Se preferir, pode pagar no Pix: {pix}. Qualquer dúvida, estou aqui 😊"
  ]
];
export const FORMAS_TXT = "Pix, cartão de crédito (pode parcelar), link de pagamento e boleto";
const PIX = "21998817771";

// preço que pode ir para o cliente: o preço do catálogo, nunca abaixo do mínimo
export const precoCliente = p => Math.max(Number(p.preco) || 0, Number(p.precoMin) || 0);
export function listaPrecos(cat) {
  return cat
    .filter(p => p.categoria === "venda" && precoCliente(p) > 0)
    .map(p => `- ${p.nome}: ${brl(precoCliente(p))}` + (Number(p.precoMin) ? ` (mínimo ${brl(Number(p.precoMin))})` : ""));
}
// texto para colar no Claude (fora do app): sem telefone e sem dados pessoais além do primeiro nome
export function textoParaClaude({ aluno = "", colegio = "", cat = [], precoModulo = "", modulo = "" }) {
  const precos = listaPrecos(cat);
  return [
    "Você está ajudando um vendedor do Z7 Studio Fotográfico (fotos de formatura) a responder um cliente pelo WhatsApp.",
    "",
    "REGRAS DO ESTÚDIO:",
    "1. Use só os produtos e preços da lista abaixo. Nunca invente preço, produto, desconto ou prazo.",
    "2. Nunca ofereça valor abaixo do “mínimo” de cada produto.",
    "3. Se não souber a resposta, diga: “consulte o Adriano”.",
    "4. Sugira a resposta para o vendedor editar. Não envie nada: quem envia é o vendedor.",
    "5. Responda em português, curto e simpático, no tom de WhatsApp.",
    "",
    "PRODUTOS E PREÇOS ATUAIS:",
    ...(precoModulo ? [`- Preço do ${modulo || "kit"} para este aluno: ${precoModulo}`] : []),
    ...(precos.length ? precos : ["- (catálogo sem preços cadastrados: consulte o Adriano)"]),
    "",
    "FORMAS DE PAGAMENTO: " + FORMAS_TXT + ". Pix: " + PIX + ".",
    "",
    "CLIENTE:",
    `- Aluno(a): ${U.first(title(aluno)) || "(sem nome)"}`,
    `- Colégio: ${title(colegio) || "(sem colégio)"}`,
    "",
    "COLE AQUI A DÚVIDA DO CLIENTE:",
    "",
    ""
  ].join("\n");
}
export function preencherAjuda(t, v) {
  return String(t || "").replace(/\{(\w+)\}/g, (m, k) => (v[k] != null && v[k] !== "" ? v[k] : m));
}

async function copiar(txt) {
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

// o = { aluno, colegio, precoModulo, modulo, contato } (contato = primeiro nome de quem recebe a mensagem)
export async function abrirAjuda(C, o = {}) {
  let cat = [];
  try {
    cat = await carregarCatalogo(C);
  } catch (_) {}
  const textos = Object.assign({}, (C.P && C.P.ajudaVendas) || {});
  const v = {
    oi: o.contato ? `Olá, ${U.first(title(o.contato))}!` : "Olá!",
    aluno: U.first(title(o.aluno || "")),
    colegio: title(o.colegio || ""),
    preco: o.precoModulo || "",
    produto: o.modulo === "Paspatur" ? "o paspatur" : "o kit",
    formas: FORMAS_TXT,
    pix: PIX,
    kit: ""
  };
  const kp = cat.find(p => p.id === "kit_pr");
  if (kp) v.kit = kp.nome.replace(/^Kit PR \(|\)$/g, "");
  sheet("🆘 Ajuda de vendas", (p, close) => {
    const chips = el("div", "chips");
    const txt = el("textarea");
    txt.rows = 6;
    txt.setAttribute("aria-label", "Resposta (ajuste antes de copiar)");
    SITUACOES.forEach(([k, nome, ex]) => {
      const b = el("button", "chip", nome);
      b.type = "button";
      b.onclick = () => {
        chips.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
        txt.value = preencherAjuda(textos[k] || ex, v);
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
      U.mkBtn("🤖 Copiar para perguntar ao Claude", "", async () => {
        const t = textoParaClaude({ aluno: o.aluno, colegio: o.colegio, cat, precoModulo: o.precoModulo, modulo: o.modulo });
        U.toast(
          (await copiar(t))
            ? "Copiado! Abra o Claude, cole o texto e escreva a dúvida do cliente no fim."
            : "Não consegui copiar agora. Tente de novo."
        );
      })
    );
    if (C.isAdmin)
      acoes.append(
        U.mkBtn("✏️ Editar respostas", "", () => {
          close();
          editarRespostas(C);
        })
      );
    p.append(acoes);
    p.append(
      el(
        "p",
        "hint",
        "“Copiar para perguntar ao Claude” não manda telefone nem dados pessoais: só o primeiro nome, o colégio e os preços do catálogo. Nada é enviado pelo app."
      )
    );
    const a = el("div", "panel-actions");
    a.append(el("span"), U.mkBtn("Fechar", "", close));
    a.firstChild.style.flex = "1";
    p.append(a);
  });
}

// Respostas da biblioteca (só o Adriano): {oi}, {aluno}, {colegio}, {preco}, {produto}, {formas}, {pix}, {kit}
export function editarRespostas(C) {
  const atuais = Object.assign({}, (C.P && C.P.ajudaVendas) || {});
  sheet("Ajuda de vendas · respostas", (p, close) => {
    p.append(
      el(
        "p",
        "hint",
        "Uma resposta por situação. Use {oi}, {aluno}, {colegio}, {preco}, {produto}, {formas}, {pix} e {kit} onde o app deve completar. Em branco = o texto de exemplo."
      )
    );
    const ins = {};
    SITUACOES.forEach(([k, nome, ex]) => {
      const t = el("textarea");
      t.rows = 3;
      t.placeholder = ex;
      t.value = atuais[k] || "";
      const f = el("div", "field");
      const l = el("label", null, nome);
      t.id = "ajv_" + k;
      l.htmlFor = t.id;
      f.append(l, t);
      ins[k] = t;
      p.append(f);
    });
    const a = el("div", "panel-actions");
    const ok = el("button", "btn btn-primary", "Salvar");
    ok.type = "submit";
    a.append(el("span"), U.mkBtn("Cancelar", "", close), ok);
    a.firstChild.style.flex = "1";
    p.append(a);
    p.addEventListener("submit", async ev => {
      ev.preventDefault();
      const novo = Object.fromEntries(SITUACOES.map(([k]) => [k, ins[k].value.trim()]));
      ok.disabled = true;
      try {
        await C.FS.setDoc(C.FS.doc(C.db, "config", "app"), { ajudaVendas: novo }, { merge: true });
        if (C.P) C.P.ajudaVendas = novo;
        U.toast("Respostas salvas ✅");
        close();
      } catch (e) {
        ok.disabled = false;
        C.handleErr(e);
      }
    });
  });
}
