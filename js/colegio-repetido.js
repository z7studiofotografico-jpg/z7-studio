// Colégio repetido (23/11/2026). O E.M. Manoel Gomes ficou cadastrado 3 vezes (pela Luciana, pelo Roberto e pelo
// cadastro automático) e cada parte do sistema ficou com um pedaço das informações. Agora:
// 1) antes de cadastrar um colégio novo, o app procura um parecido (sem C.E., E.M., Escola Municipal, Professor,
//    acento…) e pergunta: "Já está cadastrado. É o mesmo ou é outro colégio?";
// 2) o admin vê os colégios repetidos e junta num só: alunos, contratos, agendamentos e contatos passam para o que
//    fica; os outros são arquivados (nada é apagado).
// As regras sem tela (repetidosDe, gruposRepetidos, juntarCampos) são testadas em tests/colegio-repetido.test.mjs.
import { chaveColegio } from "./historico-dados.js";

const ativo = i => i && i.nome && !i.arquivado && !i.excluido;
const pal = n => chaveColegio(n).split(" ").filter(Boolean);
const rede = n => {
  const t = String(n || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase();
  if (/^\s*(C\.?\s*E\.?\b|COLEGIO ESTADUAL|ESCOLA ESTADUAL|E\.?\s*E\.?\b)/.test(t)) return "e";
  if (/^\s*(E\.?\s*M\.?\b|ESCOLA MUNICIPAL|C\.?\s*M\.?\b)/.test(t)) return "m";
  return "";
};
// os colégios cadastrados que parecem ser o mesmo do nome digitado
export function repetidosDe(nome, insts, ignoraId) {
  const p = pal(nome);
  if (!p.length) return [];
  const k = p.join(" ");
  const r = rede(nome);
  return (insts || []).filter(i => {
    if (!ativo(i) || i.id === ignoraId) return false;
    if (r && rede(i.nome) && rede(i.nome) !== r) return false; // estadual × municipal: outro colégio
    const q = pal(i.nome);
    if (q.join(" ") === k) return true;
    // um nome contém o outro inteiro (≥ 2 palavras): "Manoel Gomes" × "Manoel Gomes da Silva"
    const [cur, lon] = p.length <= q.length ? [p, q] : [q, p];
    return cur.length >= 2 && lon.join(" ").includes(cur.join(" "));
  });
}
// grupos de colégios repetidos já cadastrados: [[inst, inst, …]] (só os com 2 ou mais)
export function gruposRepetidos(insts) {
  const g = new Map();
  (insts || []).filter(ativo).forEach(i => {
    const k = (rede(i.nome) || "?") + "|" + chaveColegio(i.nome);
    if (!chaveColegio(i.nome)) return;
    if (!g.has(k)) g.set(k, []);
    g.get(k).push(i);
  });
  // "?" (o nome não diz a rede) junta com o de rede conhecida se for o único
  const out = [];
  const vistos = new Set();
  [...g.entries()].forEach(([k, l]) => {
    if (vistos.has(k)) return;
    const [r, c] = k.split("|");
    let todos = l;
    if (r === "?") {
      const outros = [...g.keys()].filter(x => x !== k && x.endsWith("|" + c));
      if (outros.length === 1) {
        todos = [...l, ...g.get(outros[0])];
        vistos.add(outros[0]);
      }
    } else {
      const sem = "?|" + c;
      if (g.has(sem) && [...g.keys()].filter(x => x.endsWith("|" + c) && x !== sem).length === 1) {
        todos = [...l, ...g.get(sem)];
        vistos.add(sem);
      }
    }
    vistos.add(k);
    if (todos.length > 1) out.push(todos);
  });
  return out;
}
// qual fica: o que tem mais informação (contatos, agendamentos, endereço); empate: o mais antigo
const peso = i =>
  (i.contatos || []).length * 3 +
  Object.keys(i).filter(k => /^(formatura|diaFotos|diaPaspatur|diaBecas)\d*$/.test(k) && i[k] && i[k].data).length * 5 +
  (i.endereco && (i.endereco.rua || i.endereco.bairro) ? 2 : 0) +
  (i.sigla ? 1 : 0) +
  (i.notas ? 1 : 0);
export const escolherQueFica = grupo =>
  [...grupo].sort((a, b) => peso(b) - peso(a) || String(a.criadoEm || "9").localeCompare(String(b.criadoEm || "9")))[0];

const vazio = v =>
  v == null ||
  v === "" ||
  (Array.isArray(v) && !v.length) ||
  (typeof v === "object" && !Array.isArray(v) && !Object.values(v).some(x => !vazio(x)));
const SEM_COPIAR = new Set([
  "id",
  "nome",
  "nomeBusca",
  "criadoEm",
  "atualizadoEm",
  "arquivado",
  "juntadoCom",
  "juntadoEm",
  "resp",
  "respEmail"
]);
// o que o colégio que fica ganha dos outros: campos vazios nele são completados; contatos e visitas se somam
export function juntarCampos(fica, outros) {
  const patch = {};
  const tel = c =>
    String((c && c.tel) || "")
      .replace(/\D/g, "")
      .replace(/^0+/, "")
      .replace(/^55(?=\d{10,11}$)/, "");
  let contatos = [...(fica.contatos || [])];
  let visitas = [...(fica.visitas || [])];
  outros.forEach(o => {
    Object.entries(o).forEach(([k, v]) => {
      if (SEM_COPIAR.has(k) || k === "contatos" || k === "visitas" || vazio(v)) return;
      if (vazio(fica[k]) && vazio(patch[k])) patch[k] = v;
    });
    (o.contatos || []).forEach(c => {
      if (!contatos.some(x => (tel(x) && tel(x) === tel(c)) || (x.nome && x.nome === c.nome && x.email === c.email))) contatos.push(c);
    });
    visitas = [...visitas, ...(o.visitas || [])];
  });
  if (contatos.length !== (fica.contatos || []).length) patch.contatos = contatos;
  if (visitas.length !== (fica.visitas || []).length)
    patch.visitas = visitas.sort((a, b) => String(b.data || "").localeCompare(String(a.data || "")));
  return patch;
}

// ---------- com tela ----------
const tit = s =>
  String(s || "").replace(/\S+/g, w => (/\./.test(w) ? w.toUpperCase() : w.length > 2 ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w));
const quem = i =>
  [i.resp && "cadastrado por " + i.resp, i.criadoEm && "em " + String(i.criadoEm).slice(8, 10) + "/" + String(i.criadoEm).slice(5, 7)]
    .filter(Boolean)
    .join(" ");

// Antes de cadastrar um colégio novo: { usar: inst } (é o mesmo), { novo: true } (é outro) ou null (não achou parecido)
export async function perguntarSeRepetido(C, nome, insts) {
  const achados = repetidosDe(nome, insts);
  if (!achados.length) return null;
  const { el } = await import("./ui.js");
  const { confirmar } = await import("./confirmar.js");
  const lista = el("div", "rep-lista");
  achados.slice(0, 4).forEach(i => lista.append(el("p", "notice", `🏫 ${tit(i.nome)}${quem(i) ? " · " + quem(i) : ""}`)));
  const mesmo = await confirmar(
    "Esse colégio já está cadastrado?",
    `Achamos ${achados.length === 1 ? "um colégio parecido" : achados.length + " colégios parecidos"} com “${nome}”. É o mesmo?`,
    { sim: "É o mesmo: usar o já cadastrado", nao: "É outro colégio: cadastrar", extra: lista }
  );
  return mesmo ? { usar: achados[0] } : { novo: true };
}

// Admin: junta um grupo de repetidos no que fica. Passa alunos (aluguel, formatura, fichas), contratos e o resto.
const COM_INST = ["alugueis", "formandos", "formaturaAlunos", "fichas", "fichasPedidos"];
export async function juntarColegios(C, fica, outros, aviso = () => {}) {
  const { FS, db } = C;
  const agora = new Date().toISOString();
  let n = 0;
  const ops = [];
  for (const o of outros) {
    for (const colNome of COM_INST) {
      aviso(`Procurando ${colNome} de ${tit(o.nome)}…`);
      try {
        const s = await FS.getDocs(FS.query(FS.collection(db, colNome), FS.where("instId", "==", o.id), FS.limit(5000)));
        s.docs.forEach(d => ops.push(b => b.update(d.ref, { instId: fica.id, instNome: fica.nome })));
      } catch (e) {
        console.warn("[Z7] juntar colégio", colNome, e);
      }
    }
    // contratos (id = instId_ano): passa para o que fica; se ele já tem contrato do ano, completa o que falta
    try {
      const s = await FS.getDocs(FS.query(FS.collection(db, "contratosColegio"), FS.where("instId", "==", o.id), FS.limit(50)));
      for (const d of s.docs) {
        const c = d.data();
        const novoId = `${fica.id}_${c.ano}`;
        const ja = await FS.getDoc(FS.doc(db, "contratosColegio", novoId));
        const dados = Object.assign({}, c, { instId: fica.id, instNome: fica.nome, juntadoDe: o.id, atualizadoEm: agora });
        if (ja.exists()) {
          const atual = ja.data();
          const comp = {};
          Object.entries(dados).forEach(([k, v]) => vazio(atual[k]) && !vazio(v) && (comp[k] = v));
          ops.push(b => b.set(FS.doc(db, "contratosColegio", novoId), Object.assign(comp, { atualizadoEm: agora }), { merge: true }));
        } else ops.push(b => b.set(FS.doc(db, "contratosColegio", novoId), dados));
        ops.push(b => b.delete(d.ref));
      }
    } catch (e) {
      console.warn("[Z7] juntar contratos", e);
    }
    // agendamentos de becas copiados no estoque: o da Agenda grava de novo ao abrir
    try {
      const s = await FS.getDocs(FS.collection(db, "becasUso"));
      s.docs
        .filter(d => d.id.startsWith(`evento_${o.id}_`))
        .forEach(d => {
          const u = d.data();
          ops.push(b =>
            b.set(
              FS.doc(db, "becasUso", d.id.replace(`evento_${o.id}_`, `evento_${fica.id}_`)),
              Object.assign({}, u, { instId: fica.id, instNome: fica.nome })
            )
          );
          ops.push(b => b.delete(d.ref));
        });
      s.docs
        .filter(d => d.data().instId === o.id && d.id.startsWith("aluno_"))
        .forEach(d => ops.push(b => b.update(d.ref, { instId: fica.id })));
    } catch (e) {
      console.warn("[Z7] juntar estoque", e);
    }
    ops.push(b =>
      b.update(FS.doc(db, "instituicoes", o.id), {
        arquivado: true,
        juntadoCom: fica.id,
        juntadoEm: agora,
        juntadoPor: C.me || "",
        atualizadoEm: agora
      })
    );
  }
  const patch = juntarCampos(fica, outros);
  ops.push(b => b.update(FS.doc(db, "instituicoes", fica.id), Object.assign(patch, { atualizadoEm: agora })));
  for (let i = 0; i < ops.length; i += 400) {
    aviso(`Gravando ${Math.min(i + 400, ops.length)} de ${ops.length}…`);
    const b = FS.writeBatch(db);
    ops.slice(i, i + 400).forEach(f => f(b));
    await b.commit();
    n += Math.min(400, ops.length - i);
  }
  return n;
}

// a janela "🔀 Colégios repetidos" (admin): mostra cada grupo e junta com um toque
export async function abrirRepetidos(C, insts) {
  const { el, sheet } = await import("./ui.js");
  const U = await import("./util.js");
  const { confirmar } = await import("./confirmar.js");
  const grupos = gruposRepetidos(insts);
  sheet("🔀 Colégios repetidos", (p, close) => {
    if (!grupos.length) {
      p.append(el("p", "empty", "Nenhum colégio repetido ✅"), U.mkBtn("Fechar", "", close));
      return;
    }
    p.append(
      el(
        "p",
        "hint",
        "Estes colégios parecem ser o mesmo, cadastrado mais de uma vez. Escolha o que fica: os alunos, contratos, agendamentos e contatos dos outros passam para ele, e os outros são arquivados (nada é apagado)."
      )
    );
    grupos.forEach(g => {
      const box = el("div", "bloco");
      const fica0 = escolherQueFica(g);
      const nome = "rep_" + g[0].id;
      g.forEach(i => {
        const l = el("label", "chk");
        const r = el("input");
        r.type = "radio";
        r.name = nome;
        r.value = i.id;
        r.checked = i.id === fica0.id;
        l.append(
          r,
          " ",
          el("b", null, tit(i.nome)),
          el("small", null, " " + [quem(i), (i.contatos || []).length + " contato(s)"].filter(Boolean).join(" · "))
        );
        box.append(l);
      });
      const msg = el("p", "hint");
      const bt = U.mkBtn("🔀 Juntar neste que está marcado", "btn-primary btn-sm", async () => {
        const id = (box.querySelector(`input[name="${nome}"]:checked`) || {}).value;
        const fica = g.find(i => i.id === id);
        const outros = g.filter(i => i.id !== id);
        if (!fica) return;
        if (
          !(await confirmar(
            "Juntar os colégios?",
            `Fica: ${tit(fica.nome)}. ${outros.length} cadastro(s) repetido(s) passam tudo para ele e são arquivados.`,
            { sim: "Sim, juntar" }
          ))
        )
          return;
        bt.disabled = true;
        try {
          const n = await juntarColegios(C, fica, outros, t => (msg.textContent = t));
          msg.textContent = `✅ Juntado (${n} gravações).`;
        } catch (e) {
          bt.disabled = false;
          msg.textContent = "";
          C.handleErr(e);
        }
      });
      box.append(bt, msg);
      p.append(box);
    });
    p.append(U.mkBtn("Fechar", "", close));
  });
}
