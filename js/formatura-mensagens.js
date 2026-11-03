// Mensagens prontas da FORMATURA (Linha de Frente, Repasse e Venda Antecipada): próprias, diferentes das do PR
// (os produtos são outros). Os textos são editáveis pelo Adriano (config/app → msgFormatura); estes são só exemplos.
// No texto: {oi} = "Olá, Maria!" · {aluno} = primeiro nome do aluno · {colegio} · {eu} = quem envia ·
// {oferta} = preço e formas de pagamento · {pix} = chave Pix de cobrança
import { el, sheet, botoes, title } from "./ui.js";
import * as U from "./util.js";

export const MSGS_FORMATURA = [
  [
    "primeiro",
    "1º contato",
    "{oi} Tudo bem? Aqui é {eu}, do Z7 Studio 📸\nAs fotos da formatura de {aluno} no {colegio} ficaram prontas! Posso te mandar uma prévia? 😊"
  ],
  [
    "lembrete",
    "2º contato (lembrar)",
    "Oi! Passando só para saber se você viu minha mensagem sobre as fotos da formatura de {aluno} 😊 Posso te mandar a prévia?"
  ],
  ["previa", "Mandar a prévia e o preço", "Olha como ficaram as fotos da formatura de {aluno}! 😍 {oferta}. Quer que eu separe?"],
  ["followup", "Follow-up da prévia", "Oi! Conseguiu ver a prévia? Se quiser, separo hoje e já combinamos a entrega 😊"],
  [
    "encerra",
    "Encerrar com elegância",
    "Tudo bem, vou entender que agora não é o momento e não vou mais te incomodar. Se um dia quiser as fotos da formatura de {aluno}, é só me chamar aqui! 💛"
  ],
  [
    "pago",
    "Pagamento confirmado",
    "Pagamento confirmado, muito obrigado! 💛 Como você prefere receber as fotos de {aluno}: entrega em casa ou retirada no estúdio?"
  ],
  ["posvenda", "Pós-venda", "As fotos de {aluno} chegaram direitinho? 💛 Se puder, manda uma foto, vamos amar ver!"],
  [
    "cobranca",
    "Cobrança de parcela (Venda Antecipada)",
    "{oi} Aqui é do Z7 Studio 📸 A parcela da formatura de {aluno} venceu. Se preferir, pode pagar no Pix: {pix}. Qualquer dúvida, estou aqui 😊"
  ]
];
export const textoFormatura = (P, k) => ((P && P.msgFormatura) || {})[k] || (MSGS_FORMATURA.find(m => m[0] === k) || [])[2] || "";
export function preencher(t, v) {
  return String(t || "").replace(/\{(\w+)\}/g, (m, k) => (v[k] != null ? v[k] : m));
}
// passo da formatura (mesmo formato do PR): { title, msg, then, mockup }
export function passoFormatura(it, c, o) {
  const cn = o.cn;
  const v = {
    oi: cn ? `Olá, ${cn}!` : "Olá!",
    aluno: U.first(title(it.nome)),
    colegio: title(it.escola || ""),
    eu: o.eu,
    oferta: o.oferta,
    pix: o.pix || ""
  };
  const t = k => preencher(textoFormatura(o.P, k), v);
  const n = it.tentativas || 0,
    ni = it.tentInteresse || 0;
  const encerra = { title: "Encerrar com elegância", msg: t("encerra"), then: { etapa: "NÃO QUER", days: -1 } };
  switch (it.etapa) {
    case "SEPARADO":
      return { title: "1º contato", msg: t("primeiro"), then: { etapa: "CONTATADO", days: 2, count: true } };
    case "CONTATADO":
      return n <= 1 ? { title: "2º contato", msg: t("lembrete"), then: { etapa: "CONTATADO", days: 3, count: true } } : encerra;
    case "INTERESSADO":
      if (ni === 0)
        return {
          title: "Mandar a prévia e o preço",
          mockup: true,
          msg: t("previa"),
          then: { etapa: "INTERESSADO", days: 2, countI: true }
        };
      if (ni === 1) return { title: "Follow-up da prévia", msg: t("followup"), then: { etapa: "INTERESSADO", days: 3, countI: true } };
      return encerra;
    case "PAGO":
      return it.entregaTipo && !it.entregaTipo.startsWith("A combinar")
        ? null
        : { title: "Pagamento confirmado", msg: t("pago"), then: null };
    case "ENTREGUE":
      return { title: "Pós-venda", msg: t("posvenda"), then: null };
    default:
      return null;
  }
}
// Editor dos textos (só o admin)
export function editarMensagensFormatura(C) {
  sheet("✏️ Mensagens da Formatura", (p, close) => {
    p.append(
      el(
        "p",
        "hint",
        "Textos das mensagens prontas da Formatura. Use {oi}, {aluno}, {colegio}, {eu}, {oferta} e {pix} onde o app deve completar."
      )
    );
    const atual = (C.P && C.P.msgFormatura) || {};
    const campos = MSGS_FORMATURA.map(([k, nome, ex]) => {
      const f = el("div", "field");
      const l = el("label", null, nome);
      const t = el("textarea");
      t.rows = 3;
      t.maxLength = 1200;
      t.value = atual[k] || ex;
      t.disabled = !C.isAdmin;
      t.setAttribute("aria-label", nome);
      f.append(l, t);
      p.append(f);
      return [k, t];
    });
    p.append(botoes(close, "Salvar mensagens"));
    if (!C.isAdmin) p.querySelector("button[type=submit]").hidden = true;
    p.addEventListener("submit", async ev => {
      ev.preventDefault();
      const msgFormatura = Object.fromEntries(campos.map(([k, t]) => [k, t.value.trim()]));
      try {
        await C.FS.setDoc(C.FS.doc(C.db, "config", "app"), { msgFormatura }, { merge: true });
        C.P.msgFormatura = msgFormatura;
        U.toast("Mensagens salvas");
        close();
      } catch (e) {
        C.handleErr(e);
      }
    });
  });
}
