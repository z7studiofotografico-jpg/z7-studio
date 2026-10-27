// Plano de atualização dos dados antigos (sem banco): recebe os documentos e devolve o que gravar.
// Usado por scripts/migrar.mjs (no GitHub) e testado em tests/migracao.test.mjs.
import { pagamentosDe, proxVenc } from "./regras.js";
import { norm } from "./ui.js";
import { entradasFones } from "./pedidos.js";
export const VERSAO_DADOS = 8;

// cols = { instituicoes, formandos, repasse, agenda, ensaios, leads }: listas de { id, ...dados }
// emailDe(nome) → e-mail da pessoa com esse nome ("" se não achar)
// devolve [{ col, id, tipo: "u" | "s", dados, apagar?: [campos] }] e a contagem por assunto
export function planejar(cols, emailDe) {
  const ops = [],
    conta = {};
  const muda = (assunto, col, id, dados, tipo = "u", apagar) => {
    ops.push(apagar ? { col, id, tipo, dados, apagar } : { col, id, tipo, dados });
    conta[assunto] = (conta[assunto] || 0) + 1;
  };
  const insts = {};
  // todo documento tem "respEmail" (mesmo vazio), senão a carteira da equipe não o encontra
  for (const x of cols.instituicoes || []) {
    insts[x.id] = x;
    const patch = {};
    if (x.respEmail == null) {
      patch.respEmail = emailDe(x.resp);
      insts[x.id] = { ...x, respEmail: patch.respEmail };
    }
    // v7: nome de busca no formato único (maiúsculas, sem acento)
    if (x.nome && x.nomeBusca != null && x.nomeBusca !== norm(x.nome)) patch.nomeBusca = norm(x.nome);
    if (Object.keys(patch).length) muda("instituições", "instituicoes", x.id, patch);
  }
  // v6: o preço antigo de "colação" da turma vira o preço do Kit 01 na tabela da turma
  for (const x of cols.instituicoes || []) {
    if (x.colacao == null) continue;
    const kits = Array.isArray(x.kits) ? x.kits.slice() : [],
      c = x.colacao || {},
      dados = {};
    if (Number(c.valor) && !kits.some(k => k.id === "k01")) {
      kits.push({ id: "k01", ant: { valor: Number(c.valor), parcelas: Math.max(1, Number(c.parcelas) || 1) } });
      dados.kits = kits;
    }
    muda("turmas (preço antigo da colação)", "instituicoes", x.id, dados, "u", ["colacao"]);
  }
  for (const f of cols.formandos || []) {
    const pags = pagamentosDe(f),
      patch = {};
    // v6: Kit 01 = "adesao" (antes "colacao")
    if (f.contrato === "colacao") patch.contrato = "adesao";
    // v6: só conta quantos ainda estão como "ainda não comprou" (formato antigo); não muda (seria inventar uma venda)
    if (f.status === "semkit")
      conta["formandos antigos sem kit (não mudados)"] = (conta["formandos antigos sem kit (não mudados)"] || 0) + 1;
    if (!Array.isArray(f.pagamentos)) {
      patch.pagamentos = pags;
      patch.pagas = pags.length;
    }
    const pv = proxVenc({ ...f, pagamentos: pags });
    if (f.proxVenc !== pv) patch.proxVenc = pv;
    if (f.respEmail == null) patch.respEmail = emailDe(f.resp) || (insts[f.instId] || {}).respEmail || "";
    // v7: data do último pagamento (o resumo da madrugada lê só quem pagou nos últimos 24 meses)
    const ult = pags
      .map(p => p.data)
      .filter(Boolean)
      .sort()
      .pop();
    if (ult && !(f.ultimoPag >= ult)) patch.ultimoPag = ult;
    if (Object.keys(patch).length) muda("formandos", "formandos", f.id, patch);
  }
  for (const x of cols.repasse || [])
    if (x.resp && !x.respEmail && emailDe(x.resp)) muda("PR", "repasse", x.id, { respEmail: emailDe(x.resp) });
  // v8: índice de telefones do PR (acha a mesma família em outro ano ou colégio, ex.: aluno transferido)
  const fones = {};
  for (const x of cols.repasse || []) for (const [t, d] of entradasFones(x.id, x)) Object.assign((fones[t] = fones[t] || {}), d.alunos);
  const atuaisF = Object.fromEntries((cols.fones || []).map(f => [f.id, f.alunos || {}]));
  const ordenado = o =>
    JSON.stringify(
      Object.keys(o)
        .sort()
        .map(k => [k, (o[k] || {}).nome || "", (o[k] || {}).ano || null, (o[k] || {}).escola || ""])
    );
  for (const [t, alunos] of Object.entries(fones))
    if (ordenado(alunos) !== ordenado(atuaisF[t] || {})) muda("telefones do PR (índice)", "fones", t, { alunos }, "s");
  for (const x of cols.agenda || [])
    if (!x.pedidoEmail && emailDe(x.pedidoPor)) muda("agenda", "agenda", x.id, { pedidoEmail: emailDe(x.pedidoPor) });
  // compromisso particular: o assunto vai para "privado" (só admin lê)
  for (const x of cols.ensaios || []) {
    if (x.kind === "pessoal" && x.particular && (x.titulo || x.obs)) {
      muda("compromissos particulares", "privado", x.id, { titulo: x.titulo || "", obs: x.obs || "", data: x.data || "" }, "s");
      ops.push({ col: "ensaios", id: x.id, tipo: "u", dados: { titulo: "", obs: "" } });
    }
  }
  // v5: nome para a busca no servidor e responsável por e-mail nos leads
  for (const x of cols.leads || []) {
    const patch = {};
    if (x.nome && x.nomeBusca !== norm(x.nome)) patch.nomeBusca = norm(x.nome);
    if (x.respEmail == null) patch.respEmail = emailDe(x.resp);
    if (Object.keys(patch).length) muda("funil", "leads", x.id, patch);
  }
  return { ops, conta };
}
export { norm as normBusca };
