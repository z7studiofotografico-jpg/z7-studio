// PR: as mensagens prontas de cada etapa do contato (o texto que vai no WhatsApp)
import { title } from "./ui.js";
import { ESTUDIO } from "./mensagens.js";
import * as U from "./util.js";
import { C, segDe, eu, ofertaTxt, entregaTxt, sextaTxt, parcTxt, ehFormatura, precos, vendaDe } from "./repasse-estado.js";
import { passoFormatura } from "./formatura-mensagens.js";
import { ehRespCadastro } from "./repasse-dados.js";

export function passo(it, c) {
  const F = U.first(title(it.nome));
  // "Responsável do aluno Fulano (cadastrado)" não é nome: a mensagem começa só com "Olá!"
  const cn = c && c.nome && !ehRespCadastro(c.nome) ? U.first(title(c.nome)) : "";
  const oi = cn ? `Olá, ${cn}!` : "Olá!";
  const souEu = `Aqui é ${eu()}, do ${ESTUDIO.nome} 📸`;
  // Formatura: mensagens próprias (editáveis em Formaturas → ✏️ Mensagens)
  if (ehFormatura()) return passoFormatura(it, c, { cn, eu: eu(), oferta: ofertaTxt(it), P: C.P, pix: C.P.pixCobranca || "21998817771" });
  const quem = c && c.tipo === "Formando" ? "o seu ensaio de formatura" : `o ensaio de formatura de ${F}`;
  const onde = segDe(it) === "lf" ? title(it.escola) + ", este ano" : [title(it.escola), it.ano].filter(Boolean).join(", ");
  const t = it.tentativas || 0;
  // lista única: quem está sendo vendido como Paspatur recebe o texto do Kit Paspatur de fotos
  const pas = vendaDe(it) === "paspatur";
  const KIT = pas ? "Kit Paspatur de fotos" : "Kit Recordação";
  const PECA = pas ? "kit" : "quadro";
  const encerra = {
    title: "Encerrar com elegância",
    msg: `${cn || "Tudo bem"}, vou entender que agora não é o momento e não vou mais te incomodar. Se um dia quiser o ${PECA} ${c && c.tipo === "Formando" ? "da sua formatura" : "de " + F}, é só me chamar aqui! 💛`,
    then: { etapa: "NÃO QUER", days: -1 }
  };
  switch (it.etapa) {
    case "SEPARADO":
      return {
        title: "1º contato: pedir para mandar a prévia",
        msg: `${oi} Tudo bem? ${souEu}\nNós fizemos ${quem} no colégio${onde ? " (" + onde + ")" : ""}, e as fotos ficaram lindas!\nO ${KIT} ${c && c.tipo === "Formando" ? "com as suas fotos" : "de " + F} já está pronto aqui no estúdio${pas ? "" : ": quadro 30x40 com moldura preta, 2 porta-retratos e as fotos digitais"}. Posso te mandar uma foto de como ficou? 😊`,
        then: { etapa: "CONTATADO", days: 2, count: true }
      };
    case "CONTATADO":
      if (t <= 1)
        return {
          title: "2º contato: lembrar com carinho",
          msg: `Oi${cn ? ", " + cn : ""}! Passando só para saber se você viu minha mensagem sobre as fotos do ensaio de formatura${c && c.tipo === "Formando" ? "" : " de " + F} 😊 Posso te mandar a prévia do ${PECA}?`,
          then: { etapa: "CONTATADO", days: 3, count: true }
        };
      return encerra;
    case "INTERESSADO": {
      const tI = it.tentInteresse || 0;
      if (tI === 0) {
        return {
          title: "Mandar a prévia e o preço",
          mockup: true,
          msg: `Olha como fica o ${KIT} ${c && c.tipo === "Formando" ? "do seu ensaio" : "de " + F}! 😍\n${pas ? "" : "• Quadro 30x40 com moldura preta\n• 2 porta-retratos 15x10\n• As fotos digitais do ensaio\n"}Já está pronto, é só combinar a entrega! ${ofertaTxt(it)}.\nEntregamos ${entregaTxt()}. Quer que eu separe o seu?`,
          then: { etapa: "INTERESSADO", days: 2, countI: true }
        };
      }
      if (tI === 1)
        return precos(it).kitFinal && segDe(it) === "rep"
          ? {
              title: "Última condição (só para quem já viu a prévia)",
              msg: `Oi${cn ? ", " + cn : ""}! Estamos organizando os kits que ainda estão aqui no estúdio e consegui uma condição especial para o ${c && c.tipo === "Formando" ? "seu kit" : "kit de " + F}: ${U.money(precos(it).kitFinal)} no Pix${precos(it).linkCartaoFinal ? ` ou no cartão (${parcTxt(precos(it).parcelas)})` : ""}, válida até ${sextaTxt()}. Depois disso volta ao valor normal. Quer que eu separe? 😊`,
              then: { etapa: "INTERESSADO", days: 3, countI: true }
            }
          : {
              title: "Follow-up da prévia",
              msg: `Oi${cn ? ", " + cn : ""}! Conseguiu ver a prévia do ${PECA}? Se quiser, separo o seu hoje e já combinamos a entrega 😊`,
              then: { etapa: "INTERESSADO", days: 3, countI: true }
            };
      return encerra;
    }
    case "PAGO":
      if (!it.entregaTipo || it.entregaTipo.startsWith("A combinar"))
        return {
          title: "Perguntar como prefere receber",
          msg: `${cn || "Oi"}, pagamento confirmado, muito obrigado! 💛 Como você prefere receber o kit ${c && c.tipo === "Formando" ? "" : "de " + F + " "}?\n1️⃣ Entregamos na sua casa (me confirma o endereço completo)\n2️⃣ Você retira aqui no estúdio, no dia e horário que for melhor (${ESTUDIO.endereco}, ${ESTUDIO.horario})`,
          then: null
        };
      if ((it.entregaTipo || "").startsWith("Retirada")) {
        if (it.entregaData) return null;
        return {
          title: "Agendar a retirada no estúdio",
          msg: `${cn || "Oi"}, pagamento confirmado, muito obrigado! 💛 O kit ${c && c.tipo === "Formando" ? "" : "de " + F + " "}fica pronto em poucos dias. Qual dia e horário fica melhor para você retirar aqui no estúdio? Estamos na ${ESTUDIO.endereco} (${ESTUDIO.horario}).`,
          then: null
        };
      }
      if (it.enderecoConfirmado) return null;
      return {
        title: "Confirmar o endereço de entrega",
        msg: `${cn || "Oi"}, pagamento confirmado, muito obrigado! 💛 Para a entrega do kit, me confirma o endereço completo? Rua, número, complemento, bairro, cidade e um ponto de referência.${it.endereco && it.endereco.rua ? "\nNo nosso cadastro está: " + [title(it.endereco.rua) + (it.endereco.numero ? ", " + it.endereco.numero : ""), title(it.endereco.bairro), title(it.endereco.cidade)].filter(Boolean).join(" · ") + ". Continua esse?" : ""}`,
        then: null
      };
    case "ENTREGUE":
      return {
        title: "Pós-venda: foto na parede e indicação",
        msg: `${cn || "Oi"}, o kit ${c && c.tipo === "Formando" ? "" : "de " + F + " "}chegou direitinho? 💛 Se puder, manda uma foto ${pas ? "do kit" : "do quadro na parede"}, vamos amar ver! E se alguém da família ou algum amigo também se formou, me indica?`,
        then: null
      };
    default:
      return null;
  }
}
