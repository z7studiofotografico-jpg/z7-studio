// Funil de vendas: a mensagem pronta e o próximo passo de cada etapa (o cartão do lead mostra e envia)
import { ESTUDIO } from "./mensagens.js";
import * as U from "./util.js";

const money = v => U.money(v),
  first = n => U.first(n);
const pv = v => (v ? money(v) : "[valor]");

export function nextStep(C, l) {
  const n = first(l.nome),
    turma = l.servico === "Turma",
    corp = l.servico === "Corporativo";
  const valor = l.valor ? money(l.valor) : pv(C.P.individual);
  const t = l.tentativas || 0;
  switch (l.etapa) {
    case "NOVO LEAD":
      return {
        title: "Qualificar: descobrir o que a pessoa precisa",
        msg: `Olá, ${n}! Que bom ter você aqui 😊 Sou ${first(C.me) ? (/a$/i.test(first(C.me)) ? "a " : "o ") + first(C.me) : "do time"}, do ${ESTUDIO.curto}.\nO orçamento é só para você ou para a sua turma? E qual a data da sua colação?`,
        then: { etapa: "QUALIFICADO", days: 1 }
      };
    case "QUALIFICADO":
      if (turma)
        return {
          title: "Coletar dados da turma",
          msg: `Perfeito, ${n}! Para montar o orçamento da turma, me diga:\n• Instituição\n• Curso\n• Quantidade de alunos\n• Mês previsto para as fotos`,
          then: { etapa: "PROPOSTA ENVIADA", days: 1 }
        };
      if (corp)
        return {
          title: "Entender o trabalho corporativo",
          msg: `Perfeito, ${n}! Para te passar o orçamento: quantas pessoas serão fotografadas, as fotos são para site/LinkedIn ou evento, e qual a data ideal?`,
          then: { etapa: "PROPOSTA ENVIADA", days: 1 }
        };
      return {
        title: "Enviar o valor em texto (sem PDF)",
        msg: `${n}, o ensaio de formatura no estúdio fica ${valor}, com cerca de ${C.P.fotos || 30} fotos tratadas entregues em até ${C.P.prazo || 15} dias.\nJá estão inclusos: beca, cadeira, 2 fundos, acessórios, fotos com família (até 4 pessoas) e pet.\nPara reservar a data, o sinal é de ${pv(C.P.sinal)} via Pix. Qual dia fica melhor para você?`,
        then: { etapa: "PROPOSTA ENVIADA", days: 1 }
      };
    case "PROPOSTA ENVIADA":
      return {
        title: "1º follow-up (tirar dúvida)",
        msg: `Oi, ${n}! Conseguiu ver o orçamento? Ficou alguma dúvida que eu possa te ajudar a resolver?`,
        then: { etapa: "FOLLOW-UP", days: 2, count: true }
      };
    case "FOLLOW-UP":
      if (t <= 1)
        return {
          title: "2º follow-up (oferecer data)",
          msg: `${n}, separei algumas datas livres para o seu ensaio. Quer que eu te mostre? Se vier com colegas no mesmo dia, cada um paga ${pv(C.P.g36)} (de 3 a 6 alunos).`,
          then: { etapa: "FOLLOW-UP", days: 4, count: true }
        };
      return {
        title: "3º follow-up (encerrar com elegância)",
        msg: `${n}, vou entender que agora não é o momento e não vou mais te incomodar. Quando quiser, é só me chamar! 😊`,
        then: { etapa: "PERDIDO", days: -1, count: true }
      };
    case "FECHADO":
      return {
        title: "Pós-venda: pedir depoimento e indicação",
        msg: `${n}, que bom que você gostou das fotos! 💛 Pode me mandar um áudio ou texto curto contando como foi a experiência? E se algum colega também vai se formar, me indica? Vou adorar fotografar.`,
        then: null
      };
    default:
      return null;
  }
}
