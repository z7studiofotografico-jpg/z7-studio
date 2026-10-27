// Dados do estúdio usados nas mensagens de WhatsApp e nos e-mails. Mudou o endereço ou o horário? Mude só aqui.
export const ESTUDIO = {
  nome: "Z7 Studio Fotográfico",
  curto: "Z7 Studio",
  endereco: "Estrada Dr. Rufino Gonçalves Ferreira, 290, Centro, Nilópolis",
  cidadeUF: "Nilópolis/RJ",
  horario: "seg. a sáb., das 9h às 19h"
};
export const ENDERECO = ESTUDIO.endereco;
export const ENDERECO_COMPLETO = `${ESTUDIO.endereco.replace(/, Nilópolis$/, "")}, ${ESTUDIO.cidadeUF}`;
// Final dos e-mails para os colégios
export const ASSINATURA_EMAIL = `Atenciosamente,\n${ESTUDIO.nome}\n${ENDERECO_COMPLETO}`;
export const assuntoDatas = nome => `${ESTUDIO.curto} · Datas confirmadas${nome ? " · " + nome : ""}`;

// ---------- Formaturas (WhatsApp) ----------
// Os textos ficam aqui; quem chama passa os dados já formatados (nome, valores em "R$ ...", datas em dd/mm/aaaa).
const primeiro = nome =>
  String(nome || "")
    .trim()
    .split(/\s+/)[0] || "";

// Cobrança de parcela: { nome, parcela: "3/10", item: "do Kit 04", valor: "R$ 85,00", venc: "05/10/2026", atrasada, pagar }
// pagar = "\nChave Pix: ..." ou "\nO pagamento é pelo boleto." ou ""
export function msgCobranca({ nome, parcela, item, valor, venc, atrasada, pagar = "" }) {
  const oi = `Oi, ${primeiro(nome)}! Aqui é do ${ESTUDIO.nome} 📸`;
  return atrasada
    ? `${oi} Passando para lembrar da parcela ${parcela} ${item}, de ${valor}, que venceu ${venc ? "dia " + venc : "este mês"}.${pagar}\nPode me mandar o comprovante por aqui? Se já pagou, é só desconsiderar 😊`
    : `${oi} Só lembrando que a parcela ${parcela} ${item}, de ${valor}, vence ${venc ? "dia " + venc : "em breve"}.${pagar}\nQualquer dúvida, estou por aqui 😊`;
}

// Oferta para quem tem só o Kit 01: { nome, escola, linhas (kits com preço), repasse, ano }
export function msgOfertaKit({ nome, escola, linhas, repasse, ano }) {
  const oi = `Oi, ${primeiro(nome)}! Aqui é do ${ESTUDIO.nome} 📸`,
    kits = linhas.join("\n");
  return repasse
    ? `${oi} Ainda guardamos as fotos da sua formatura de ${ano} no ${escola}. Que tal ter todas elas tratadas e impressas?\n\n${kits}\n\nPosso te mandar uma prévia? 😊`
    : `${oi} As fotos da formatura do ${escola} ficaram prontas e estão lindas! Quer garantir as suas?\n\n${kits}\n\nPosso te mandar uma prévia? 😊`;
}

// Texto que vai junto com as imagens da prévia
export function msgPrevia(nome, n, kits) {
  const pn = primeiro(nome);
  return `Oi${pn ? ", " + pn : ""}! Aqui estão as ${n} fotos da sua formatura 📸 O kit vem com todas elas, tratadas e sem a marca d'água.${kits ? "\n\n" + kits : ""}\n\nQuer garantir o seu? 😊`;
}
