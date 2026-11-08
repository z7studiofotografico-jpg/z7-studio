// PR: números do topo, lote do dia (separar contatos da fila) e a lista de escolas
import { el, title, avisoErro, sheet as sheetQ, botoes as botoesQ } from "./ui.js";
import * as U from "./util.js";
import { pintarSeletor } from "./numeros-tela.js";
import { chaveColegio } from "./historico-dados.js";
import { gruposEscolas, escolhaDe } from "./escolas-pr.js";
import {
  C,
  FS,
  db,
  col,
  tab,
  seg,
  meta,
  mudarMeta,
  ANO,
  ANO_MIN,
  ABERTAS,
  baseLF,
  baseSeg,
  ehFormatura,
  soMinha,
  noSeg,
  $,
  tela,
  metaNome,
  vendasMes,
  textoVendasMes
} from "./repasse-estado.js";

export async function refreshStats() {
  const today = U.todayStr(),
    mes = today.slice(0, 8) + "01",
    Y = ANO();
  const set = (id, v) => {
    const x = $(id);
    if (x) x.textContent = v;
  };
  try {
    const lf = seg === "lf";
    const [h, i, m] = await Promise.all(
      lf
        ? [
            FS.getDocs(FS.query(col, ...baseLF(), ...soMinha(), FS.where("etapa", "in", ABERTAS), FS.limit(300))),
            FS.getDocs(FS.query(col, ...baseLF(), ...soMinha(), FS.where("etapa", "==", "INTERESSADO"), FS.limit(300))),
            FS.getDocs(FS.query(col, ...baseLF(), ...soMinha(), FS.where("etapa", "in", ["PAGO", "ENTREGUE"]), FS.limit(1000)))
          ]
        : C.isAdmin
          ? [
              FS.getDocs(FS.query(col, FS.where("followup", "<=", today), FS.limit(300))),
              FS.getDocs(FS.query(col, FS.where("etapa", "==", "INTERESSADO"), FS.limit(300))),
              FS.getDocs(FS.query(col, FS.where("pagoEm", ">=", mes), FS.limit(500)))
            ]
          : [
              FS.getDocs(FS.query(col, ...soMinha(), FS.where("etapa", "in", ABERTAS), FS.limit(500))),
              FS.getDocs(FS.query(col, ...soMinha(), FS.where("etapa", "==", "INTERESSADO"), FS.limit(300))),
              FS.getDocs(FS.query(col, ...soMinha(), FS.where("etapa", "in", ["PAGO", "ENTREGUE"]), FS.limit(1000)))
            ]
    );
    const docs = s0 => s0.docs.map(d => d.data()).filter(noSeg);
    set("rsHoje", docs(h).filter(x => ABERTAS.includes(x.etapa) && x.followup && x.followup <= today).length);
    set("rsInt", docs(i).length);
    // (aluno pago pelo colégio não é venda da equipe: não entra na conta do mês)
    const doMes = docs(m).filter(x => (x.pagoEm || "") >= mes && !x.colegioPaga);
    Object.assign(vendasMes, { n: doMes.length, v: doMes.reduce((a, x) => a + (Number(x.valor) || 0), 0), pronto: true });
    set("rsMes", U.money(vendasMes.v));
    set("rVendMes", textoVendasMes());
    // Fila: conta por ano (só filtros de igualdade, não precisa de índice extra no Firebase)
    const anos = ehFormatura() ? [null] : seg === "lf" ? [Y] : anosRepasse();
    const cs = await Promise.all(
      anos.map(a =>
        FS.getCountFromServer(FS.query(col, FS.where("etapa", "==", "NA FILA"), ...(a ? [FS.where("ano", "==", a)] : baseSeg())))
      )
    );
    set(
      "rsFila",
      cs.reduce((a, c) => a + c.data().count, 0)
    );
  } catch (e) {
    console.warn(e);
  }
}
export function anosRepasse() {
  const Y = ANO(),
    conhecidos = Object.keys(meta.anos || {})
      .map(Number)
      .filter(a => a && a < Y);
  const de = conhecidos.length ? Math.min(...conhecidos) : ANO_MIN;
  const out = [];
  for (let a = Y - 1; a >= de; a--) out.push(a);
  return out;
}
// Quantos separar: a pessoa decide a cada vez ("Deseja separar quantos alunos?"); sem número fixo por dia
const MAX_POR_VEZ = 100;
export async function refreshLote() {
  // qual WhatsApp usar: o da empresa (admin) ou os da própria pessoa (equipe); aparece mesmo sem internet para contar
  pintarSeletor($("rLoteNum"), C, seg);
  try {
    const c = await FS.getCountFromServer(
      FS.query(
        col,
        FS.where("resp", "==", C.me),
        FS.where("separadoEm", "==", U.todayStr()),
        FS.where("separadoSeg", "==", seg),
        ...(seg === "lf" ? baseLF() : [])
      )
    );
    const n = c.data().count;
    $("rLoteTxt").textContent = n ? ` ${n} separado${n > 1 ? "s" : ""} hoje.` : " Separe os alunos que você vai trabalhar hoje.";
    $("rLoteAviso").hidden = true;
    $("rLote").classList.remove("lote-aviso");
    $("rLoteBtn").disabled = false;
    $("rLoteBtn").textContent = n ? "Separar mais alunos" : "Separar alunos";
    $("rLoteBtn").dataset.n = n;
  } catch (e) {
    console.warn(e);
    $("rLoteTxt").textContent = " Não foi possível contar agora.";
  }
}
// "Deseja separar quantos alunos?": a pessoa digita o número (o app nunca separa sozinho)
export function perguntarQuantos() {
  return new Promise(res => {
    let fim = false;
    const acaba = v => {
      if (!fim) {
        fim = true;
        res(v);
      }
    };
    sheetQ(
      "Deseja separar quantos alunos?",
      (p, close) => {
        const q = el("input");
        q.type = "number";
        q.min = "1";
        q.max = String(MAX_POR_VEZ);
        q.required = true;
        q.value = "10";
        q.setAttribute("aria-label", "Quantos alunos separar");
        p.append(q, el("p", "hint", "Nunca vem o mesmo aluno duas vezes, nem aluno caído."), botoesQ(close, "Separar"));
        p.addEventListener("submit", ev => {
          ev.preventDefault();
          const n = Math.min(MAX_POR_VEZ, Math.max(1, parseInt(q.value, 10) || 0));
          acaba(n);
          close();
        });
        setTimeout(() => q.select(), 30);
      },
      { onClose: () => acaba(0) }
    );
  });
}
export async function separarLote() {
  if (!C.me) return;
  const quantos = await perguntarQuantos();
  if (!quantos) return;
  const ja = Number($("rLoteBtn").dataset.n || 0);
  let falta = quantos;
  const esc = escolaEscolhida($("rLoteEscola").value);
  // Repasse: do ano mais recente para o mais antigo; com escola escolhida, só o ano dela
  const anos = ehFormatura() ? [esc && esc.ano ? esc.ano : null] : esc && esc.ano ? [esc.ano] : seg === "lf" ? [ANO()] : anosRepasse();
  $("rLoteBtn").disabled = true;
  try {
    // candidatos: um pouco mais que o necessário, porque outra pessoa pode pegar alguns ao mesmo tempo
    const cand = [];
    for (const a of anos) {
      if (cand.length >= falta * 2) break;
      // (Formatura: a frente vem do campo seg; aluno Caído nunca está "NA FILA", então nunca vem)
      const filtros = [FS.where("etapa", "==", "NA FILA"), ...(a ? [FS.where("ano", "==", a)] : []), ...baseSeg()];
      if (esc) filtros.push(esc.nomes.length > 1 ? FS.where("escola", "in", esc.nomes) : FS.where("escola", "==", esc.nomes[0]));
      const s0 = await FS.getDocs(FS.query(col, ...filtros, FS.orderBy(FS.documentId()), FS.limit(falta * 2 - cand.length)));
      s0.docs.forEach(d => cand.push(d.ref));
    }
    if (!cand.length) {
      U.toast(esc ? "Essa escola não tem mais ninguém na fila." : "A fila acabou! 🎉");
      return;
    }
    // transação: só fica com quem ainda está NA FILA (dois vendedores nunca pegam o mesmo contato)
    const hoje = U.todayStr(),
      agora = new Date().toISOString();
    const pegos = await FS.runTransaction(db, async tx => {
      const lidos = [];
      for (const r of cand) lidos.push(await tx.get(r));
      const livres = lidos.filter(d => d.exists() && d.data().etapa === "NA FILA" && !d.data().excluido).slice(0, falta);
      livres.forEach(d =>
        tx.update(d.ref, {
          etapa: "SEPARADO",
          resp: C.me,
          respEmail: C.email || "",
          separadoEm: hoje,
          separadoSeg: seg,
          followup: hoje,
          atualizadoEm: agora
        })
      );
      return livres;
    });
    if (!pegos.length) {
      U.toast("Outra pessoa separou esses contatos agora. Toque de novo.");
      refreshLote();
      return;
    }
    const total = ja + pegos.length;
    U.toast(
      `${pegos.length} aluno${pegos.length > 1 ? "s" : ""} separado${pegos.length > 1 ? "s" : ""} para você · ${total} hoje` +
        (pegos.length < quantos ? ` (a fila só tinha ${pegos.length})` : "")
    );
    refreshLote();
    refreshStats();
    if (tab !== "hoje") tela.openTab("hoje");
  } catch (e) {
    C.handleErr(e);
  } finally {
    $("rLoteBtn").disabled = false;
  }
}
// nome de cada colégio no cadastro de Instituições (chave → nome), para a lista mostrar "C.E. João Cardoso"
let cadastroNomes = null;
async function nomesDoCadastro() {
  if (cadastroNomes) return cadastroNomes;
  cadastroNomes = {};
  try {
    if (C.pode("colegios") || C.isAdmin)
      (await FS.getDocs(C.carteira("instituicoes", FS.limit(1000)))).forEach(d => {
        const k = chaveColegio(d.data().nome || "");
        if (k) cadastroNomes[k] = d.data().nome;
      });
  } catch (_) {}
  return cadastroNomes;
}
// As listas de escola (lote e busca): uma linha por colégio e ano ("2026 - C.E. João Cardoso").
// Linha de Frente: só o ano atual; Repasse: os anos anteriores.
export let gruposPR = [];
// "Procurar colégio": escreve parte do nome (ex.: "yonne") e a lista mostra só os colégios que batem, com os anos
const norm = t =>
  String(t || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.\-]/g, " ");
export const bateBusca = (rotulo, busca) => {
  const ps = norm(busca).split(/\s+/).filter(Boolean);
  const r = norm(rotulo);
  return ps.every(p => r.includes(p));
};
export function pintarEscolas() {
  const temAno = Object.keys(meta.escolasAno || {}).length;
  gruposPR = temAno ? gruposEscolas(meta, cadastroNomes || {}, a => ehFormatura() || (seg === "lf" ? a >= ANO() : a < ANO())) : [];
  ["rLoteEscola", "rEscola"].forEach(id => {
    const sel = $(id);
    if (!sel) return;
    const cur = sel.value;
    const first0 = sel.options[0];
    sel.innerHTML = "";
    sel.append(first0);
    const busca = id === "rLoteEscola" && $("rLoteBusca") ? $("rLoteBusca").value.trim() : "";
    if (temAno)
      gruposPR
        .filter(g => !busca || bateBusca(g.rotulo, busca))
        .forEach(g => {
          const o = el("option", null, `${g.rotulo} (${g.n})`);
          o.value = g.valor;
          sel.append(o);
        });
    // (antes da atualização de dados: só o nome, sem o ano)
    else
      Object.keys(meta.escolas || {})
        .sort((a, b) => a.localeCompare(b, "pt-BR"))
        .forEach(n => {
          const o = el("option", null, `${title(n)} (${meta.escolas[n]})`);
          o.value = n;
          sel.append(o);
        });
    sel.value = [...sel.options].some(o => o.value === cur) ? cur : "";
    // procurou e achou: já escolhe o primeiro colégio (o mais recente)
    if (busca && !sel.value && sel.options.length > 1) sel.value = sel.options[1].value;
    if (busca) sel.options[0].textContent = sel.options.length > 1 ? "Turmas mais recentes primeiro" : "Nenhum colégio com esse nome";
  });
}
// o valor escolhido numa das listas → { ano, nomes } (ou só o nome, nas listas antigas)
export function escolaEscolhida(valor) {
  if (!valor) return null;
  return escolhaDe(valor, gruposPR) || { ano: null, nomes: [valor], rotulo: title(valor) };
}
export async function loadMeta() {
  try {
    const s = await FS.getDoc(FS.doc(db, "config", metaNome()));
    mudarMeta(s.exists() ? Object.assign({ escolas: {}, anos: {} }, s.data()) : { escolas: {}, anos: {} });
    await nomesDoCadastro();
    pintarEscolas();
    const imp = $("rImport");
    if (imp) imp.hidden = !C.isAdmin;
  } catch (e) {
    avisoErro(e, "carregar a lista de escolas", U.toast);
  }
}
