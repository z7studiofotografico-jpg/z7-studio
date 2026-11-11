// Becas por responsável (11/11/2026): cada pessoa da equipe vê só os seus aluguéis (alunos dos colégios do contrato
// dela e avulsos que ela registrou). O estoque continua geral: cada aluguel que segura beca tem uma cópia só com os
// números na coleção "becasUso" (tipo, tamanho, faixa, capelo, datas), sem nome, telefone ou valor. A equipe confere
// o estoque por ela. O app grava a cópia junto com o aluguel; ao abrir as becas, o admin acerta o que ficou diferente
// (aluguel apagado, planilha importada…).
import { RESERVA, FORA } from "./becas-estoque.js";

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
    capelo: a.capelo || ""
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
  atual.forEach((_c, id) => !certo.has(id) && apagar.push(id));
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
    if (localStorage.getItem(chave) === hoje) return 0;
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
    localStorage.setItem(chave, hoje);
  } catch (_) {}
  return ops.length;
}

// as cópias separadas: alunos (no formato de usoDosAlunos) e avulsos (no formato dos aluguéis), com o id do aluguel
// copias = [{ id: "aluno_<id>", ...dados }]
export function separarUso(copias) {
  const comId = c => Object.assign({}, c, { id: String(c.id).replace(/^(aluno|avulso)_/, "") });
  return {
    alunos: copias.filter(c => c.tipo === "aluno").map(comId),
    avulsos: copias.filter(c => c.tipo === "avulso").map(comId)
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

// Dono de cada aluno de aluguel = quem fechou o contrato do colégio naquele ano ("" = sem contrato: a equipe toda vê)
// devolve [[id, respEmail]] só dos que estão diferentes
export function donosAlugueis(alunos, contratos) {
  const dono = new Map(contratos.map(c => [`${c.instId}|${c.ano}`, String(c.respEmail || "").toLowerCase()]));
  return alunos
    .filter(a => (a.respEmail ?? null) !== (dono.get(`${a.instId}|${Number(a.ano)}`) || ""))
    .map(a => [a.id, dono.get(`${a.instId}|${Number(a.ano)}`) || ""]);
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
