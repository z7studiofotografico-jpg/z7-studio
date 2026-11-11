// PR / Paspatur / Formatura (10/11/2026): cada um no seu "Para hoje".
// - A trabalhar: os alunos que são seus, em andamento, sem data para hoje (os passados pelo admin chegam aqui);
//   "📅 Trabalhar hoje" coloca no Para hoje.
// - Admin: o botão "👥 Representantes" lista quem tem alunos em andamento (Roberto 32…); a pessoa escolhida abre com o que está com ela
//   separado em Para hoje dela · A trabalhar · Caídos. O Para hoje do admin mostra só os dele e os sem responsável.
import { el, title, emPartes } from "./ui.js";
import { rotuloRepresentantes, escolherRepresentante } from "./escolher-pessoa.js";
import * as U from "./util.js";
import { C, FS, col, tab, seg, ABERTAS, baseLF, baseSeg, ehFormatura, colNome, pessoaAberta, save } from "./repasse-estado.js";

// A trabalhar: um toque coloca no Para hoje
export function renderTrabalhar(list, arr, linha) {
  arr.sort(
    (a, b) => String(a.escola || "").localeCompare(String(b.escola || "")) || String(a.nome || "").localeCompare(String(b.nome || ""))
  );
  emPartes(list, arr, it => {
    const box = linha(it);
    const b = U.mkBtn("📅 Trabalhar hoje", "btn-sm btn-hoje", () => {
      b.disabled = true;
      save(it, { followup: U.todayStr() }, "Está no seu Para hoje ✅").finally(() => (b.disabled = false));
    });
    box.append(b);
    return box;
  });
}

// [para hoje, a trabalhar, caídos] de uma pessoa
export function gruposEquipe(arr, hoje) {
  const grupo = it => (it.etapa === "CAÍDO" ? 2 : ABERTAS.includes(it.etapa) && it.followup && it.followup <= hoje ? 0 : 1);
  return [0, 1, 2].map(i => arr.filter(it => grupo(it) === i && (i === 2 || ABERTAS.includes(it.etapa))));
}
export function renderEquipe(list, arr, linha) {
  const nome = U.first(title(pessoaAberta.nome));
  const g = gruposEquipe(arr, U.todayStr());
  const topo = el("p", "notes", `${nome}: ${g[0].length} para hoje · ${g[1].length} a trabalhar · ${g[2].length} caídos`);
  topo.style.gridColumn = "1/-1";
  list.append(topo);
  [`Para hoje de ${nome}`, "A trabalhar", "Caídos"].forEach((t, i) => {
    if (!g[i].length) return;
    const h = el("h3", "grp", `${t} (${g[i].length})`);
    h.style.gridColumn = "1/-1";
    list.append(h);
    g[i].sort(
      (a, b) => (a.followup || "9").localeCompare(b.followup || "9") || String(a.escola || "").localeCompare(String(b.escola || ""))
    );
    g[i].forEach(it => list.append(linha(it)));
  });
}

// ---------- botões da equipe (admin) ----------
let contas = { chave: "", em: 0, lista: [] };
function pessoasEquipe() {
  const mods = ehFormatura() ? ["formaturas", "colegios"] : ["lf", "rep"];
  return Object.entries(C.usuarios || {})
    .filter(([em, u]) => u && u.ativo !== false && em !== C.email)
    .filter(([, u]) => u.papel === "admin" || (u.modulos || []).some(m => mods.includes(m)))
    .map(([email, u]) => ({ email, nome: u.nome || email }));
}
// quantos alunos em andamento cada pessoa tem nesta lista (contagem no servidor: quase não gasta leitura)
async function contarEquipe() {
  const chave = colNome() + "|" + seg;
  if (contas.chave === chave && Date.now() - contas.em < 60000) return contas.lista;
  const conta = (email, ...f) =>
    FS.getCountFromServer(FS.query(col, FS.where("respEmail", "==", email), FS.where("etapa", "in", ABERTAS), ...f)).then(
      c => c.data().count
    );
  const lista = await Promise.all(
    pessoasEquipe().map(async p => {
      let n;
      if (ehFormatura()) n = await conta(p.email, ...baseSeg());
      else if (seg === "lf") n = await conta(p.email, ...baseLF());
      else {
        // Repasse: todos menos os do ano atual (Linha de Frente)
        const [todos, lf] = await Promise.all([conta(p.email), conta(p.email, ...baseLF())]);
        n = todos - lf;
      }
      return Object.assign({ n }, p);
    })
  );
  contas = { chave, em: Date.now(), lista: lista.filter(p => p.n > 0).sort((a, b) => b.n - a.n) };
  return contas.lista;
}
// c = a fileira das abas; abrir({ email, nome }) abre a aba da pessoa. Um botão só, "👥 Representantes": ao tocar,
// a lista de quem tem alunos em andamento (11/11/2026: antes era um botão por pessoa)
export function botoesEquipe(c, abrir) {
  let pessoas = [];
  const b = el("button", "chip chip-pessoa", "");
  b.type = "button";
  b.title = "Alunos de cada representante";
  const aberta = () => (tab === "equipe" && pessoaAberta.email ? pessoaAberta : null);
  const desenhar = lista => {
    pessoas = lista.slice();
    // a pessoa aberta continua na lista, mesmo sem ninguém em andamento
    if (aberta() && !pessoas.some(p => p.email === pessoaAberta.email))
      pessoas.push({ email: pessoaAberta.email, nome: pessoaAberta.nome, n: 0 });
    b.textContent = rotuloRepresentantes(pessoas, aberta());
    b.setAttribute("aria-pressed", String(!!aberta()));
  };
  b.onclick = () =>
    escolherRepresentante(pessoas, aberta(), abrir, { dica: "Toque para ver os alunos da pessoa: para hoje, a trabalhar e caídos." });
  c.append(b);
  desenhar(contas.chave === colNome() + "|" + seg ? contas.lista : []);
  contarEquipe()
    .then(l => {
      if (c.isConnected) desenhar(l);
    })
    .catch(e => console.warn("[Z7] botões da equipe", e));
}
// depois de passar um colégio, os números mudam: conta de novo na próxima vez
export const recontarEquipe = () => (contas = { chave: "", em: 0, lista: [] });

// os alunos em andamento de uma pessoa na lista aberta (A trabalhar; botão da pessoa, com os caídos)
export const emAndamento = (email, etapas = ABERTAS) =>
  FS.query(
    col,
    ...(ehFormatura() ? baseSeg() : seg === "lf" ? baseLF() : []),
    FS.where("respEmail", "==", email),
    FS.where("etapa", "in", etapas),
    FS.limit(500)
  );
// várias consultas numa lista só (ex.: Para hoje do admin = os seus + os sem responsável); devolve o "parar"
export function ouvirJuntas(qs, aoMudar, falhou) {
  const partes = qs.map(() => null);
  const offs = qs.map((q, i) =>
    FS.onSnapshot(
      q,
      s => {
        partes[i] = s.docs;
        if (!partes.every(Boolean)) return;
        const vistos = new Set();
        aoMudar(partes.flat().filter(d => !vistos.has(d.id) && vistos.add(d.id)));
      },
      falhou
    )
  );
  return () => offs.forEach(f => f());
}
