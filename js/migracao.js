// Plano de atualização dos dados antigos (sem banco): recebe os documentos e devolve o que gravar.
// Usado por scripts/migrar.mjs (no GitHub) e testado em tests/migracao.test.mjs.
import { pagamentosDe, proxVenc } from "./regras.js";
import { norm } from "./ui.js";
import { entradasFones } from "./pedidos.js";
import { codigoBusca, comAno } from "./aluno-id.js";
import { normTel, fmtTel, EMPRESA_PADRAO } from "./numeros.js";
import { segmentoPeloNome } from "./instituicao-cadastro.js";
import { contarEscolasAno } from "./escolas-pr.js";
import { tipoIdEnsaio, precisaCodigo, anoDoFechamento, fmtCodigoEnsaio, maiorEnsaio } from "./ensaio-id.js";
export const VERSAO_DADOS = 12;
// v12 (combinado com o Adriano em 28/10/2026): os 42 colégios públicos que vieram das planilhas do Drive
// - João Paulo II e CIEP 156 são do Adriano; os outros, do Roberto (com o aviso para completar o cadastro)
// - tipo pelo nome: CIEP e C.E. = 3º ano (ensino médio); E.M. = 9º ano; Zenóbio da Costa e Waldemar Raythe são C.E.
// - Mário Piragibe é aluguel de becas: aluno sem telefone lá não é falha (não conta em "Sem telefone")
const DO_ADRIANO = /JOAO PAULO II|CIEP 156/;
const NOME_CERTO = { "E.E. Zenóbio da Costa": "C.E. Zenóbio da Costa", "Waldemar Raythe": "C.E. Waldemar Raythe" };
// v11: aluno do PR importado sem nenhum telefone sai dos Incompletos (etapa "SEM TELEFONE": só conta no Dashboard)
// v10: WhatsApp da empresa corrigido (combinado com o Adriano em 27/10/2026)
// - (21) 97105-9512 é de um representante (vai no cadastro dele em Equipe): sai da Linha de Frente da empresa
// - o Repasse é (21) 3743-0000 (estava (21) 3774-0000)
const NUMERO_DE_REPRESENTANTE = "21971059512";
const CORRIGE_NUMERO = { 2137740000: "2137430000" };

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
  for (const x of cols.repasse || []) {
    const patch = {};
    if (x.resp && !x.respEmail && emailDe(x.resp)) patch.respEmail = emailDe(x.resp);
    // v9: ID do aluno com o ano na frente ("CEPNCP - 01" do aluno de 2026 → "26CEPNCP-01"; o original fica em codigoOrig)
    // e no formato de busca, para achar o aluno digitando o ID
    if (x.codigo) {
      const novo = x.ano ? comAno(x.codigo, x.ano) : x.codigo;
      if (novo !== x.codigo) {
        patch.codigo = novo;
        if (x.codigoOrig == null) patch.codigoOrig = x.codigo;
      }
      if (x.codigoBusca !== codigoBusca(novo)) patch.codigoBusca = codigoBusca(novo);
    }
    if (Object.keys(patch).length) muda("PR", "repasse", x.id, patch);
  }
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
  // v11: sem telefone (combinado com o Adriano em 28/10/2026)
  for (const x of cols.repasse || []) {
    if ((x.contatos || []).length || (x.telefones || []).length || x.semTelefone) continue;
    // (só quem não está com ninguém da equipe: o aluno incluído à mão por alguém continua com essa pessoa)
    if (x.etapa === "INCOMPLETO" && !x.respEmail)
      muda("PR sem telefone (só Dashboard)", "repasse", x.id, { etapa: "SEM TELEFONE", semTelefone: true, followup: null });
    else if (x.historico) muda("PR sem telefone (só Dashboard)", "repasse", x.id, { semTelefone: true });
  }
  // v12: colégios das planilhas do Drive (importados com a observação "Já trabalhamos…")
  for (const x of cols.instituicoes || []) {
    const v0 = (x.visitas || [])[0];
    if (x.tipo !== "publico" || !x.importadoEm || !(v0 && /^Já trabalhamos/.test(v0.obs || ""))) continue;
    const patch = {};
    const nome = NOME_CERTO[x.nome] || x.nome;
    if (nome !== x.nome) Object.assign(patch, { nome, nomeBusca: norm(nome) });
    const seg = segmentoPeloNome(nome);
    if (seg && !Object.values(x.segmentos || {}).some(Boolean))
      patch.segmentos = { pre: false, ano5: false, ano9: seg === "ano9", medio: seg === "medio" };
    const adriano = DO_ADRIANO.test(norm(nome));
    const resp = adriano ? "Adriano" : "Roberto";
    const respEmail = emailDe(resp);
    if (x.resp !== resp) patch.resp = resp;
    if ((x.respEmail || "") !== respEmail && (respEmail || !x.respEmail)) patch.respEmail = respEmail;
    if (!adriano && x.cadastroPendente === undefined) patch.cadastroPendente = true;
    if (Object.keys(patch).length) muda("colégios das planilhas (Roberto e Adriano)", "instituicoes", x.id, patch);
  }
  for (const x of cols.repasse || [])
    if (x.etapa === "SEM TELEFONE" && /PIRAGIBE/.test(norm(x.escola)) && !x.semTelOk)
      muda("Mário Piragibe (becas): sem telefone não conta", "repasse", x.id, { semTelOk: true });
  // v12: lista de escolas do PR por ano ("2026 - C.E. João Cardoso"), contada de novo a partir dos alunos
  if ((cols.repasse || []).length) {
    const atual = (cols.config || []).find(x => x.id === "repasse_meta") || {};
    const escolasAno = contarEscolasAno(cols.repasse);
    const escolas = {},
      anos = {};
    cols.repasse.forEach(a => {
      if (a.escola) escolas[a.escola] = (escolas[a.escola] || 0) + 1;
      if (a.ano) anos[a.ano] = (anos[a.ano] || 0) + 1;
    });
    const igual = (x, y) => JSON.stringify(Object.entries(x || {}).sort()) === JSON.stringify(Object.entries(y || {}).sort());
    if (!igual(atual.escolasAno, escolasAno) || !igual(atual.escolas, escolas) || !igual(atual.anos, anos))
      muda("lista de escolas do PR por ano", "config", "repasse_meta", { escolasAno, escolas, anos }, atual.id ? "u" : "s");
  }
  // v10: WhatsApp da empresa (config/app)
  const cfg = (cols.config || []).find(x => x.id === "app");
  if (cfg) {
    const patch = {};
    for (const k of ["funilNumero", "lfNumero", "repNumero", "cobrancaNumero"]) {
      const d = normTel(cfg[k]);
      if (d === NUMERO_DE_REPRESENTANTE) patch[k] = "";
      else if (CORRIGE_NUMERO[d]) patch[k] = fmtTel(CORRIGE_NUMERO[d]);
      else if (!d && EMPRESA_PADRAO[k]) patch[k] = fmtTel(EMPRESA_PADRAO[k]);
    }
    if (Object.keys(patch).length) muda("WhatsApp da empresa", "config", "app", patch);
  }
  // v10: ID das vendas de ensaio já fechadas (26EST-00001), na ordem do fechamento, seguindo os contadores
  const contadores = {};
  (cols.ids || []).forEach(x => (contadores[x.id] = Number(x.ultimo) || 0));
  const comId = cols.leads || [];
  const semId = comId
    .filter(precisaCodigo)
    .sort(
      (a, b) => String(a.fechadoEm || a.criadoEm || "").localeCompare(String(b.fechadoEm || b.criadoEm || "")) || (a.id < b.id ? -1 : 1)
    );
  const usados = new Set();
  for (const x of semId) {
    const ano = anoDoFechamento(x),
      tipo = tipoIdEnsaio(x.servico),
      k = `ensaio_${String(ano).slice(-2)}${tipo}`;
    const n = Math.max(contadores[k] || 0, maiorEnsaio(ano, tipo, comId)) + 1;
    contadores[k] = n;
    usados.add(k);
    muda("ID dos ensaios", "leads", x.id, { codigoEnsaio: fmtCodigoEnsaio(ano, tipo, n) });
  }
  usados.forEach(k => ops.push({ col: "ids", id: k, tipo: "s", dados: { ultimo: contadores[k] } }));
  return { ops, conta };
}
export { norm as normBusca };

// ---------- responsável antigo (nome) → e-mail de quem está cadastrado ----------
// usuarios: [{ id: e-mail, nome }]; donos: [{ email, nome }] (config.js).
// Acha pelo nome completo (sem diferença de maiúsculas e acentos), pelo e-mail escrito no lugar do nome
// ou, se só uma pessoa tem aquele primeiro nome, pelo primeiro nome ("Pedro" → Pedro Vendedor).
// Devolve emailDe(nome) e comoAchou(nome) → "nome completo" | "e-mail" | "primeiro nome" | "".
export function criarEmailDe(usuarios, donos) {
  const pessoas = [
    ...(usuarios || []).filter(u => u && u.nome && u.id).map(u => ({ email: String(u.id).toLowerCase(), nome: u.nome })),
    ...(donos || []).filter(d => d && d.nome && d.email).map(d => ({ email: d.email.toLowerCase(), nome: d.nome }))
  ];
  const completo = {},
    primeiro = {};
  pessoas.forEach(p => {
    const k = norm(p.nome);
    if (!completo[k]) completo[k] = p.email;
    const f = k.split(" ")[0];
    (primeiro[f] = primeiro[f] || new Set()).add(p.email);
  });
  const emails = new Set(pessoas.map(p => p.email));
  const achar = nome => {
    const k = norm(nome);
    if (!k) return ["", ""];
    if (completo[k]) return [completo[k], "nome completo"];
    const em = String(nome).trim().toLowerCase();
    if (emails.has(em)) return [em, "e-mail"];
    const f = primeiro[k.split(" ")[0]];
    if (f && f.size === 1) return [[...f][0], "primeiro nome"];
    return ["", ""];
  };
  return { emailDe: nome => achar(nome)[0], comoAchou: nome => achar(nome)[1] };
}
// Relatório para quem roda a atualização: cada nome de responsável antigo (registros ainda sem e-mail),
// com quem foi ligado, como, e quantos registros. Os que não acharam ninguém ficam primeiro.
export function relatorioResponsaveis(cols, emailDe, comoAchou) {
  const m = {};
  const anota = (nome, onde) => {
    const k = norm(nome);
    if (!k) return;
    const r = (m[k] = m[k] || { nome: String(nome).trim(), email: emailDe(nome), como: comoAchou(nome), registros: 0, onde: {} });
    r.registros++;
    r.onde[onde] = (r.onde[onde] || 0) + 1;
  };
  (cols.repasse || []).forEach(x => x.resp && !x.respEmail && anota(x.resp, "PR"));
  (cols.leads || []).forEach(x => x.resp && x.respEmail == null && anota(x.resp, "Funil"));
  (cols.instituicoes || []).forEach(x => x.resp && x.respEmail == null && anota(x.resp, "Instituições"));
  (cols.formandos || []).forEach(x => x.resp && x.respEmail == null && anota(x.resp, "Formandos"));
  (cols.agenda || []).forEach(x => x.pedidoPor && !x.pedidoEmail && anota(x.pedidoPor, "Agenda"));
  return Object.values(m).sort((a, b) => !!a.email - !!b.email || b.registros - a.registros);
}
