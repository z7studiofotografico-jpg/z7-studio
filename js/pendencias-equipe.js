// Resumo das pendências de uma pessoa da equipe (para a notificação das 19h que vai para o Adriano).
// Sem tela e sem banco: recebe as listas já lidas. Usado por scripts/pendencias.mjs e testado em tests/.
import { cadastroFalta, cadastroPendente } from "./instituicao-cadastro.js";

const REP_ABERTAS = ["SEPARADO", "CONTATADO", "INTERESSADO"];
const FUNIL_ABERTAS = ["NOVO LEAD", "QUALIFICADO", "PROPOSTA ENVIADA", "FOLLOW-UP"];
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
const primeiro = n =>
  String(n || "")
    .trim()
    .split(/\s+/)[0] || "";

// pessoa = { email, nome }; inst/rep/leads = documentos (dados); hoje = "AAAA-MM-DD"
export function pendenciasDe(pessoa, { inst = [], rep = [], leads = [] }, hoje) {
  const email = String(pessoa.email || "").toLowerCase();
  const nome = primeiro(pessoa.nome).toLowerCase();
  // é dele: pelo e-mail ou, enquanto o colégio não tem e-mail, pelo nome do responsável
  const dele = x => {
    const e = String(x.respEmail || "").toLowerCase();
    return e ? e === email : !!nome && primeiro(x.resp).toLowerCase() === nome;
  };
  const meusInst = inst.filter(dele);
  const cadastro = meusInst.filter(cadastroPendente);
  const okHoje = meusInst.filter(x => String(x.cadastroOkEm || "").slice(0, 10) === hoje);
  const retInst = meusInst.filter(x => x.etapa !== "FECHADO" && x.followup && x.followup < hoje);
  const retPR = rep.filter(r => dele(r) && REP_ABERTAS.includes(r.etapa) && r.followup && r.followup < hoje);
  const retFunil = leads.filter(l => dele(l) && FUNIL_ABERTAS.includes(l.etapa) && l.followup && l.followup < hoje);
  const partes = [];
  if (cadastro.length)
    partes.push(
      `📋 ${plural(cadastro.length, "colégio", "colégios")} sem cadastro completo (ex.: ${cadastro
        .slice(0, 2)
        .map(x => `${x.nome}: falta ${cadastroFalta(x).join(", ")}`)
        .join("; ")})`
    );
  if (retInst.length) partes.push(`🏫 ${plural(retInst.length, "retorno de colégio atrasado", "retornos de colégio atrasados")}`);
  if (retPR.length) partes.push(`📞 ${plural(retPR.length, "contato do PR atrasado", "contatos do PR atrasados")}`);
  if (retFunil.length) partes.push(`💬 ${plural(retFunil.length, "contato do Funil atrasado", "contatos do Funil atrasados")}`);
  if (okHoje.length) partes.push(`✅ Atualizou hoje: ${okHoje.map(x => x.nome).join(", ")}`);
  // o último colégio foi completado hoje: avisa uma vez que está tudo ok
  const tudoOk = okHoje.length > 0 && !cadastro.length;
  if (!partes.length && !tudoOk) return null;
  const quem = primeiro(pessoa.nome) || pessoa.email;
  const pend = cadastro.length + retInst.length + retPR.length + retFunil.length;
  return {
    title: pend ? `${quem}: ${plural(pend, "pendência", "pendências")} hoje` : `${quem}: tudo em dia ✅`,
    body: [...partes, tudoOk ? "Cadastro de todos os colégios completo ✅" : ""].filter(Boolean).join(" · ")
  };
}
