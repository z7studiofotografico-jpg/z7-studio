// Becas por responsável (11/11/2026): cada pessoa da equipe vê só os seus aluguéis (alunos dos colégios do contrato
// dela e avulsos que ela registrou). O estoque continua geral: cada aluguel que segura beca tem uma cópia só com os
// números na coleção "becasUso" (tipo, tamanho, faixa, capelo, datas), sem nome, telefone ou valor. A equipe confere
// o estoque por ela. O app grava a cópia junto com o aluguel; ao abrir as becas, o admin acerta o que ficou diferente
// (aluguel apagado, planilha importada…).
import { RESERVA, FORA, usoDosAlunos, nomeBeca, nomeFaixa, nomeCapelo, semTamanho } from "./becas-estoque.js";

export const USO = "becasUso";
const AVULSO_ATIVO = ["reservado", "retirado"];
const n0 = v => Number(v) || 0;

// id da cópia: "aluno_<id>" ou "avulso_<id>"
export const idUso = (tipo, id) => `${tipo}_${id}`;

// a cópia de um aluno de aluguel (null = não segura beca: não conta no estoque)
export function usoDeAluno(a) {
  if (!a || a.excluido || !(RESERVA.includes(a.status) || FORA.includes(a.status))) return null;
  return {
    tipo: "aluno",
    status: a.status,
    becaTipo: a.becaTipo || "",
    tamanho: a.tamanho || "",
    menosLonga: !!a.menosLonga,
    faixa: a.faixa || "",
    capelo: a.capelo || "",
    instId: a.instId || "", // (19/11/2026) para o agendamento do colégio tomar o lugar dos alunos no estoque
    ano: Number(a.ano) || 0
  };
}
// a cópia de um aluguel avulso
export function usoDeAvulso(x) {
  if (!x || !AVULSO_ATIVO.includes(x.status)) return null;
  const num = o =>
    Object.fromEntries(
      Object.entries(o && typeof o === "object" ? o : {})
        .filter(([, v]) => n0(v))
        .map(([k, v]) => [k, n0(v)])
    );
  const tam = {};
  Object.entries(x.tamanhosQtd && typeof x.tamanhosQtd === "object" ? x.tamanhosQtd : {}).forEach(([k, v]) => {
    if (v && typeof v === "object") tam[k] = num(v); // (o formato antigo, sem tipo, já não conta no estoque)
  });
  return {
    tipo: "avulso",
    status: x.status,
    retirada: x.retirada || "",
    devolucao: x.devolucao || "",
    becasQtd: num(x.becasQtd),
    faixasQtd: num(x.faixasQtd),
    capelosQtd: num(x.capelosQtd),
    tamanhosQtd: tam
  };
}
// (19/11/2026) a cópia de um agendamento de becas do colégio (Agenda): as becas saem no dia da entrega e voltam na
// devolução. id "evento_<colégio>_<campo>"; leva só números, datas e o nome do colégio.
export const idEvento = (instId, campo) => `evento_${instId}_${campo}`;
export function usoDeEvento(inst, campo, ev) {
  const b = ev && ev.becas;
  if (!inst || !b || !ev.data || ev.status === "recusado") return null;
  const n = v =>
    Object.fromEntries(
      Object.entries(v && typeof v === "object" ? v : {})
        .filter(([, q]) => n0(q))
        .map(([k, q]) => [k, n0(q)])
    );
  const tam = {};
  Object.entries(b.tamanhosQtd || {}).forEach(([tp, zs]) => {
    const z = n(zs);
    if (Object.keys(z).length) tam[tp] = z;
  });
  const becasQtd = n(b.becasQtd);
  if (!Object.keys(becasQtd).length) return null;
  return {
    tipo: "evento",
    status: "reservado",
    instId: inst.id,
    instNome: inst.nome || "",
    campo,
    retirada: b.retirada || ev.data,
    devolucao: b.devolucao || "",
    becasQtd,
    faixasQtd: n(b.faixasQtd),
    capelosQtd: n(b.capelosQtd),
    tamanhosQtd: tam
  };
}
const usoDe = (tipo, d) => (tipo === "aluno" ? usoDeAluno(d) : usoDeAvulso(d));

// grava (ou apaga) a cópia depois de gravar o aluguel; d = o aluguel inteiro como ficou
export async function espelhar(C, tipo, id, d) {
  if (!id) return;
  const ref = C.FS.doc(C.db, USO, idUso(tipo, id));
  const u = usoDe(tipo, d);
  try {
    if (u) await C.FS.setDoc(ref, u);
    else await C.FS.deleteDoc(ref);
  } catch (e) {
    console.warn("[Z7] cópia do estoque de becas", e);
  }
}

// o que gravar para a cópia ficar igual aos aluguéis: { gravar: [[id, dados]], apagar: [id] }
// alunos/avulsos = todos os aluguéis (com id); copias = os documentos atuais de becasUso (com id)
export function acertoDoUso(alunos, avulsos, copias) {
  const certo = new Map();
  alunos.forEach(a => {
    const u = usoDeAluno(a);
    if (u) certo.set(idUso("aluno", a.id), u);
  });
  avulsos.forEach(x => {
    const u = usoDeAvulso(x);
    if (u) certo.set(idUso("avulso", x.id), u);
  });
  const atual = new Map(copias.map(c => [c.id, c]));
  const gravar = [],
    apagar = [];
  certo.forEach((u, id) => {
    const c = atual.get(id);
    const { id: _id, ...semId } = c || {};
    if (!c || JSON.stringify(ordenado(semId)) !== JSON.stringify(ordenado(u))) gravar.push([id, u]);
  });
  // os agendamentos (evento_…) são gravados pela Agenda, não pelos aluguéis
  atual.forEach((_c, id) => !certo.has(id) && !String(id).startsWith("evento_") && apagar.push(id));
  return { gravar, apagar };
}
function ordenado(o) {
  if (!o || typeof o !== "object" || Array.isArray(o)) return o;
  return Object.fromEntries(
    Object.keys(o)
      .sort()
      .map(k => [k, ordenado(o[k])])
  );
}
// admin, uma vez por dia em cada aparelho (ao abrir as becas): grava o dono que falta ou mudou (contrato trocou de
// representante, aluno importado…) e acerta a cópia do estoque. Devolve quantas gravações fez.
export async function acertarBecas(C, hoje) {
  if (!C.isAdmin || C.verComo) return 0;
  const chave = "z7becasAcerto";
  try {
    if (localStorage.getItem(chave) === hoje + "b") return 0;
  } catch (_) {}
  const { FS, db } = C;
  const ler = async q => (await FS.getDocs(q)).docs.map(d => Object.assign({ id: d.id }, d.data()));
  const [alunos, avulsos, contratos, copias] = await Promise.all([
    ler(FS.query(FS.collection(db, "alugueis"), FS.limit(8000))),
    ler(FS.query(FS.collection(db, "becas"), FS.limit(5000))),
    ler(FS.query(FS.collection(db, "contratosColegio"), FS.limit(2000))),
    ler(FS.collection(db, USO))
  ]);
  const ops = [];
  donosAlugueis(alunos, contratos).forEach(([id, r]) => ops.push(b => b.update(FS.doc(db, "alugueis", id), { respEmail: r })));
  donosAvulsos(avulsos).forEach(([id, r]) => ops.push(b => b.update(FS.doc(db, "becas", id), { respEmail: r })));
  const { gravar, apagar } = acertoDoUso(alunos, avulsos, copias);
  gravar.forEach(([id, u]) => ops.push(b => b.set(FS.doc(db, USO, id), u)));
  apagar.forEach(id => ops.push(b => b.delete(FS.doc(db, USO, id))));
  for (let i = 0; i < ops.length; i += 400) {
    const b = FS.writeBatch(db);
    ops.slice(i, i + 400).forEach(f => f(b));
    await b.commit();
  }
  try {
    localStorage.setItem(chave, hoje + "b"); // "b" (19/11/2026): a cópia dos alunos passou a levar colégio e ano
  } catch (_) {}
  return ops.length;
}

// as cópias separadas: alunos (no formato de usoDosAlunos) e avulsos (no formato dos aluguéis), com o id do aluguel
// copias = [{ id: "aluno_<id>", ...dados }]
// Os agendamentos de becas dos colégios entram junto com os avulsos (contam pelas datas: entrega → devolução) e
// tomam o lugar dos alunos daquele colégio e ano (senão as mesmas becas contariam duas vezes).
export function separarUso(copias) {
  const comId = c => Object.assign({}, c, { id: String(c.id).replace(/^(aluno|avulso)_/, "") });
  const eventos = copias.filter(c => c.tipo === "evento").map(c => Object.assign({}, c));
  const doEvento = new Set(eventos.map(e => `${e.instId}|${String(e.retirada || "").slice(0, 4)}`));
  return {
    alunos: copias.filter(c => c.tipo === "aluno" && !doEvento.has(`${c.instId}|${c.ano}`)).map(comId),
    avulsos: [...copias.filter(c => c.tipo === "avulso").map(comId), ...eventos],
    eventos
  };
}
// ouve a cópia do estoque (todos com o módulo de becas leem): aoMudar({ alunos, avulsos })
export function ouvirUso(C, aoMudar, falhou) {
  return C.FS.onSnapshot(
    C.FS.collection(C.db, USO),
    s => aoMudar(separarUso(s.docs.map(d => Object.assign({ id: d.id }, d.data())))),
    falhou || (() => {})
  );
}

// Dono de cada aluno de aluguel = quem fechou o contrato do colégio naquele ano. Sem contrato: fica o dono que já tem
// (o admin pode ter passado para alguém); sem nenhum, "" (a equipe toda vê). semContrato = dono para os sem dono.
// devolve [[id, respEmail]] só dos que precisam mudar
export function donosAlugueis(alunos, contratos, semContrato = "") {
  const dono = new Map(contratos.map(c => [`${c.instId}|${c.ano}`, String(c.respEmail || "").toLowerCase()]));
  const out = [];
  alunos.forEach(a => {
    const d = dono.get(`${a.instId}|${Number(a.ano)}`);
    const atual = a.respEmail ?? null;
    if (d !== undefined) {
      if (atual !== d) out.push([a.id, d]);
    } else if (atual === null || (semContrato && atual === "")) out.push([a.id, semContrato]);
  });
  return out;
}
// Avulsos ainda sem dono gravado: o dono é quem registrou (porEmail); os antigos sem registro ficam sem dono ("")
export function donosAvulsos(avulsos) {
  return avulsos.filter(x => x.respEmail == null).map(x => [x.id, String(x.porEmail || "").toLowerCase()]);
}
// quem fica com um aluno novo: o dono do contrato do colégio/ano (o admin acha qualquer um; a equipe só os seus)
export async function donoDoAluguel(C, instId, ano) {
  if (!instId) return "";
  const { FS, db } = C;
  const filtros = [FS.where("instId", "==", instId)];
  if (!C.isAdmin) filtros.push(FS.where("respEmail", "==", C.email));
  try {
    const s = await FS.getDocs(FS.query(FS.collection(db, "contratosColegio"), ...filtros, FS.limit(20)));
    const c = s.docs.map(d => d.data()).find(x => Number(x.ano) === Number(ano));
    return c ? String(c.respEmail || "").toLowerCase() : "";
  } catch (_) {
    return "";
  }
}
// contrato criado ou trocado de representante: os alunos de aluguel daquele colégio/ano passam para o novo dono
// (a equipe só pega os que estão sem dono; o admin passa todos)
export async function passarAlugueis(C, instId, ano, respEmail) {
  const { FS, db } = C;
  const filtros = [FS.where("instId", "==", instId)];
  if (!C.isAdmin) filtros.push(FS.where("respEmail", "==", ""));
  const s = await FS.getDocs(FS.query(FS.collection(db, "alugueis"), ...filtros, FS.limit(3000)));
  const docs = s.docs.filter(d => Number(d.data().ano) === Number(ano) && d.data().respEmail !== respEmail);
  for (let i = 0; i < docs.length; i += 400) {
    const b = FS.writeBatch(db);
    docs.slice(i, i + 400).forEach(d => b.update(d.ref, { respEmail }));
    await b.commit();
  }
  return docs.length;
}

// soma as becas dos avulsos e agendamentos (sem olhar as datas: na dúvida, segura)
export function somaAvulsos(arr) {
  const t = { becas: {}, faixas: {}, capelos: {}, tamanhos: {} };
  arr.forEach(x => {
    ["becas", "faixas", "capelos"].forEach(kk =>
      Object.entries(x[kk + "Qtd"] || {}).forEach(([z, n]) => (t[kk][z] = (Number(t[kk][z]) || 0) + (Number(n) || 0)))
    );
    Object.entries(x.tamanhosQtd || {}).forEach(([tp, zs]) => {
      const m = (t.tamanhos[tp] = t.tamanhos[tp] || {});
      Object.entries(zs || {}).forEach(([z, n]) => (m[z] = (Number(m[z]) || 0) + (Number(n) || 0)));
    });
  });
  return t;
}

// (19/11/2026) Estoque no período de um agendamento de becas: o que já está comprometido entre "de" e "ate"
// copias = os documentos de becasUso (com id); ignora = id da cópia do próprio agendamento.
// Devolve { uso, outros: [{ nome, de, ate, n }] } (outros = colégios e avulsos no mesmo período).
export function usoNoPeriodo(copias, de, ate, ignora) {
  // os alunos do próprio colégio continuam fora (o agendamento toma o lugar deles); só a cópia dele não conta
  const sep = separarUso(copias);
  const alunos = sep.alunos,
    avulsos = sep.avulsos.filter(c => c.id !== ignora);
  const uso = Object.assign({ tamanhos: {} }, usoDosAlunos(alunos));
  const soma = somaAvulsos(avulsos.filter(x => x.retirada && x.retirada <= ate && (x.devolucao || "9999") >= de));
  ["becas", "faixas", "capelos"].forEach(k => Object.entries(soma[k]).forEach(([z, v]) => (uso[k][z] = n0(uso[k][z]) + n0(v))));
  Object.entries(soma.tamanhos).forEach(([tp, zs]) => {
    const o = (uso.tamanhos[tp] = uso.tamanhos[tp] || {});
    Object.entries(zs).forEach(([z, v]) => (o[z] = n0(o[z]) + n0(v)));
  });
  const tot = x => Object.values(x.becasQtd || {}).reduce((s, v) => s + n0(v), 0);
  const outros = avulsos
    .filter(x => x.tipo === "evento" && x.retirada <= ate && (x.devolucao || "9999") >= de)
    .map(x => ({ nome: x.instNome || "Colégio", de: x.retirada, ate: x.devolucao || "", n: tot(x) }));
  const av = avulsos.filter(x => x.tipo !== "evento" && x.retirada && x.retirada <= ate && (x.devolucao || "9999") >= de);
  if (av.length) outros.push({ nome: `Aluguéis avulsos (${av.length})`, de: "", ate: "", n: av.reduce((s, x) => s + tot(x), 0) });
  const nAl = alunos.length;
  if (nAl) outros.push({ nome: "Alunos de colégios sem agendamento (medidos ou com a beca)", de: "", ate: "", n: nAl });
  return { uso, outros };
}
// Confere o pedido (becasQtd, tamanhosQtd, faixasQtd, capelosQtd) com o estoque E menos o uso:
// [{ rot, pede, livre, falta }] de tudo o que foi pedido. O tamanho só é conferido se o estoque de tamanhos foi preenchido.
export function conferirPedido(E, uso, ped) {
  const out = [];
  const linha = (rot, pede, tem, usado) => {
    const livre = Math.max(0, n0(tem) - n0(usado));
    out.push({ rot, pede, livre, falta: Math.max(0, pede - livre) });
  };
  Object.entries(ped.becasQtd || {}).forEach(([tp, q]) => {
    if (!n0(q)) return;
    const ET = (E.tamanhos || {})[tp] || {};
    const temTam = Object.values(ET).some(v => n0(v));
    const tams = Object.entries((ped.tamanhosQtd || {})[tp] || {}).filter(([, v]) => n0(v));
    if (temTam && !semTamanho(tp) && tams.length)
      tams.forEach(([z, v]) => linha(`${nomeBeca(tp)} ${z}`, n0(v), ET[z], ((uso.tamanhos || {})[tp] || {})[z]));
    else linha(nomeBeca(tp), n0(q), (E.becas || {})[tp], (uso.becas || {})[tp]);
  });
  Object.entries(ped.faixasQtd || {}).forEach(
    ([k, q]) => n0(q) && linha(`Faixa ${nomeFaixa(k).toLowerCase()}`, n0(q), (E.faixas || {})[k], (uso.faixas || {})[k])
  );
  Object.entries(ped.capelosQtd || {}).forEach(
    ([k, q]) => n0(q) && linha(nomeCapelo(k), n0(q), (E.capelos || {})[k], (uso.capelos || {})[k])
  );
  return out;
}
// As quantidades a partir dos alunos do aluguel do colégio (os que vão participar)
export function pedidoDosAlunos(alunos) {
  const p = { becasQtd: {}, tamanhosQtd: {}, faixasQtd: {}, capelosQtd: {}, semMedida: 0 };
  alunos
    .filter(a => !a.excluido && !a.naoParticipa && !a.soPaspatur)
    .forEach(a => {
      if (!a.becaTipo || (!a.tamanho && !semTamanho(a.becaTipo))) p.semMedida++;
      if (a.becaTipo) {
        p.becasQtd[a.becaTipo] = n0(p.becasQtd[a.becaTipo]) + 1;
        if (a.tamanho) {
          const t = (p.tamanhosQtd[a.becaTipo] = p.tamanhosQtd[a.becaTipo] || {});
          t[a.tamanho] = n0(t[a.tamanho]) + 1;
        }
      }
      if (a.faixa) p.faixasQtd[a.faixa] = n0(p.faixasQtd[a.faixa]) + 1;
      if (a.capelo) p.capelosQtd[a.capelo] = n0(p.capelosQtd[a.capelo]) + 1;
    });
  return p;
}
