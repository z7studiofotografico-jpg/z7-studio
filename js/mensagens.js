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
