// PR: estado compartilhado pelas partes da tela (lista, cartão, janelas, lote) e as regras pequenas do contato.
// As outras partes leem o estado daqui (as variáveis exportadas acompanham as mudanças) e mudam pelas funções "mudar...".
import { comAlteracao } from "./alteracoes.js";
import { atividadeDoPatch, registrarAtividade } from "./atividades.js";
import * as U from "./util.js";
import { comPrecoDoColegio, ouvirPrecosColegio, aoMudarPrecos } from "./precos-colegio.js";
export let C, FS, db, col;
export let tab = "hoje",
  seg = "lf",
  items = [],
  meta = { escolas: {}, anos: {} };
export const mudarTab = v => (tab = v);
export const mudarSeg = v => (seg = v);
export const mudarItems = v => (items = v);
export const mudarMeta = v => (meta = v);
// vendas pagas no mês (admin: de todos; equipe: só as dela), contadas no topo; aparecem também em Vendidos/Minhas vendas
export const vendasMes = { n: 0, v: 0, pronto: false };
export const textoVendasMes = () =>
  vendasMes.pronto
    ? `Este mês: ${vendasMes.n} venda${vendasMes.n === 1 ? "" : "s"} · ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(vendasMes.v)}`
    : "Este mês: contando…";
// Ligações com a tela principal (repasse.js preenche): quem grava avisa a lista para redesenhar
export const tela = { renderList() {}, openTab() {} };
// Lista única (08/11/2026): PR e Paspatur ficam na mesma coleção (repasse). Cada aluno diz como está sendo
// vendido no campo vendaComo ("paspatur"; vazio = PR) e o preço, as mensagens e a comissão seguem esse campo
// (Ajustes → paspatur = { kitPreco, kitPromo, … }: o que estiver em branco fica em branco, nunca usa o do PR).
// O filtro "Todos / Só PR / Só Paspatur" (filtroVenda) só escolhe o que aparece na lista.
// O mesmo motor também trabalha a Linha de Frente e o Repasse da FORMATURA (Etapa 5): tipo "formatura", coleção
// formaturaAlunos (separada do PR). Lá a frente não vem do ano: vem do campo "seg" ("lf" até o Adriano virar o
// colégio para Repasse, à mão).
export let tipoPR = "pr";
export const ehFormatura = () => tipoPR === "formatura";
export const colNome = () => (tipoPR === "formatura" ? "formaturaAlunos" : "repasse");
export const metaNome = () => (tipoPR === "formatura" ? "formatura_meta" : "repasse_meta");
let ctx0 = null;
export function mudarTipoPR(v) {
  tipoPR = v === "formatura" ? v : "pr";
  col = FS.collection(db, colNome());
}
// filtro da lista do PR: "todos" | "pr" | "paspatur" (fica guardado no aparelho)
export let filtroVenda = "todos";
export function mudarFiltroVenda(v) {
  filtroVenda = v === "pr" || v === "paspatur" ? v : "todos";
  try {
    localStorage.setItem("z7filtroVenda", filtroVenda);
  } catch (_) {}
}
// filtro por pessoa da equipe (só o admin): "" = todos; senão o e-mail do responsável ("-" = sem responsável)
export let filtroPessoa = "";
export const mudarFiltroPessoa = v => (filtroPessoa = v || "");
// como o aluno está sendo vendido: "paspatur" ou "pr" (Formatura: "formatura")
export const vendaDe = it => (ehFormatura() ? "formatura" : it && it.vendaComo === "paspatur" ? "paspatur" : "pr");
export const NOME_VENDA = { pr: "PR", paspatur: "Paspatur", formatura: "Formatura" };
export const naVenda = it => filtroVenda === "todos" || ehFormatura() || vendaDe(it) === filtroVenda;
// tabela de preços de um tipo de venda (Ajustes)
function precosDoTipo(t) {
  const P = (ctx0 && ctx0.P) || {};
  if (t === "paspatur") return Object.assign({}, P, SEM_PRECO, limpo(P.paspatur));
  if (t === "formatura") return Object.assign({}, P, SEM_PRECO, limpo(P.formatura));
  return P;
}
// preços do aluno: os do colégio dele (cadastrados pelo Adriano na hora do trabalho); sem preço do colégio, os valores
// ficam zerados e semPrecoColegio = true (bloqueia mensagem com valor e venda). Sem aluno: os da lista aberta.
export const precos = it => {
  const t = it ? vendaDe(it) : ehFormatura() ? "formatura" : filtroVenda === "paspatur" ? "paspatur" : "pr";
  return it ? comPrecoDoColegio(precosDoTipo(t), it, t) : precosDoTipo(t);
};
export const semPreco = it => !!(it && precos(it).semPrecoColegio);
export function iniciar(ctx) {
  ctx0 = ctx;
  ouvirPrecosColegio(ctx);
  aoMudarPrecos(() => tela.renderList());
  // C.P: os preços da lista aberta (PR ou Formatura). Para um aluno, use precos(it).
  C = Object.create(ctx, { P: { get: () => precosDoTipo(ehFormatura() ? "formatura" : "pr") } });
  FS = ctx.FS;
  db = ctx.db;
  tipoPR = "pr";
  try {
    const f = localStorage.getItem("z7filtroVenda");
    filtroVenda = f === "pr" || f === "paspatur" ? f : "todos";
  } catch (_) {}
  col = FS.collection(db, colNome());
  try {
    seg = localStorage.getItem("z7seg") || "lf";
  } catch (_) {}
}
// Paspatur e Formatura têm preços próprios: o que estiver em branco fica em branco (nunca usa o preço do PR)
export const CAMPOS_PRECO = ["lfPix", "lfCartao", "kitPreco", "kitPromo", "kitCartao", "kitFinal"];
const SEM_PRECO = Object.fromEntries(CAMPOS_PRECO.map(k => [k, 0]));
// aviso na tela: preço da aba ainda não cadastrado em Ajustes
// (13/11/2026: o preço agora é de cada colégio, cadastrado na hora do trabalho; o aviso fica no cartão do aluno)
export function precoFaltando() {
  return "";
}
const limpo = o => Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v !== "" && v != null && v !== 0));
// Assumir o contato: quem não é admin só assume o que está sem responsável (ou já é seu)
export const assumir = it => (!C.isAdmin && it.respEmail && it.respEmail !== C.email ? {} : { resp: C.me, respEmail: C.email || "" });
export const ANO = () => new Date().getFullYear();
export const ANO_MIN = 2015;
// Em qual frente o formando está. Sem ano (incompleto) aparece nas duas.
export function segDe(it) {
  if (ehFormatura()) return it.seg === "rep" ? "rep" : "lf";
  return !it.ano ? null : it.ano >= ANO() ? "lf" : "rep";
}
export function noSeg(it) {
  const s0 = segDe(it);
  return !s0 || s0 === seg;
}
export const segNome = s0 => (s0 === "lf" ? "Linha de Frente" + (ehFormatura() ? "" : " " + ANO()) : "Repasse");
// Quem só tem a Linha de Frente só pode ler ensaios do ano atual (as regras do Firebase também exigem isso),
// então as buscas da Linha de Frente sempre filtram pelo ano.
export const segsPermitidas = () => (ehFormatura() ? (C.pode("formaturas") ? ["lf", "rep"] : []) : ["lf", "rep"].filter(k => C.pode(k)));
export const baseLF = () => (ehFormatura() ? [FS.where("seg", "==", "lf")] : [FS.where("ano", "==", ANO())]);
// filtro da frente aberta (Formatura): Linha de Frente ou Repasse
export const baseSeg = () => (ehFormatura() ? [FS.where("seg", "==", seg)] : []);
// A equipe trabalha só a própria carteira (o admin vê tudo): filtro das abas e dos números
export const soMinha = () => (C.isAdmin ? [] : [FS.where("respEmail", "==", C.email || "")]);
// Para hoje (10/11/2026): cada um vê só os seus. O admin vê os seus e os que ainda não têm responsável; o que está
// com alguém da equipe fica no botão daquela pessoa ("Roberto (32)"), não mais misturado no Para hoje dele.
export const meuOuLivre = it => (it.respEmail || "") === (C.email || "") || !it.respEmail;
// aba "equipe": a pessoa aberta pelo botão (e-mail e nome)
export let pessoaAberta = { email: "", nome: "" };
export const mudarPessoaAberta = v => (pessoaAberta = v || { email: "", nome: "" });
export const $ = id => document.getElementById(id);

export const ETAPAS = [
  "INCOMPLETO",
  "NA FILA",
  "SEPARADO",
  "CONTATADO",
  "INTERESSADO",
  "PAGO",
  "ENTREGUE",
  "NÃO QUER",
  "SEM CONTATO",
  "CAÍDO"
];
export const ABERTAS = ["SEPARADO", "CONTATADO", "INTERESSADO"];

// ---------- utilidades ----------
export function eu() {
  const f = U.first(C.me);
  return f ? (/a$/i.test(f) ? "a " : "o ") + f : "a equipe";
}
export function precoTxt(it) {
  const P = precos(it);
  if (it ? segDe(it) === "lf" : seg === "lf") return P.lfPix ? U.money(P.lfPix) : P.kitPreco ? U.money(P.kitPreco) : "[valor do kit]";
  if (P.kitPromo) return U.money(P.kitPromo);
  if (P.kitPreco) return U.money(P.kitPreco);
  return "[valor do kit]";
}
export function ofertaTxt(it) {
  const P = precos(it);
  if (segDe(it) === "lf") {
    const pix = P.lfPix || P.kitPreco;
    if (!pix) return "Tudo por [valor do kit]";
    return (
      `${U.money(pix)} no Pix` + (P.lfCartao ? ` ou ${U.money(P.lfCartao)} no cartão${parcDe(it) ? ` (até ${parcDe(it)}x)` : ""}` : "")
    );
  }
  const pix = P.kitPromo || P.kitPreco;
  if (!pix) return "Tudo por [valor do kit]";
  let t =
    P.kitPreco && P.kitPromo && P.kitPreco > P.kitPromo
      ? `De ${U.money(P.kitPreco)} por apenas ${U.money(P.kitPromo)} no Pix`
      : `Tudo por ${U.money(pix)} no Pix`;
  if (P.kitCartao) t += ` ou ${U.money(P.kitCartao)} no cartão${P.parcelas ? ` (até ${P.parcelas}x)` : ""}`;
  return t;
}
// Prazo da última oferta: a próxima sexta que esteja a pelo menos 3 dias de hoje.
// Parcelas no cartão: a Linha de Frente tem o seu próprio número.
export function parcDe(it) {
  const P = precos(it);
  return it && segDe(it) === "lf" && P.lfParcelas ? P.lfParcelas : P.parcelas;
}
export function sextaTxt() {
  const d = new Date();
  let add = (5 - d.getDay() + 7) % 7;
  if (add < 3) add += 7;
  d.setDate(d.getDate() + add);
  return U.pad(d.getDate()) + "/" + U.pad(d.getMonth() + 1);
}
export function entregaTxt() {
  return C.P.entrega || "em casa ou para retirada no estúdio";
}
export function status(it) {
  if (it.etapa === "PAGO" || it.etapa === "ENTREGUE") return "won";
  if (!ABERTAS.includes(it.etapa) || !it.followup) return "none";
  const t = U.todayStr();
  return it.followup < t ? "late" : it.followup === t ? "today" : "later";
}
export function lockInfo(it) {
  const a = it.atendendo;
  if (!a || !a.por || !a.desde) return null;
  const mins = (Date.now() - Date.parse(a.desde)) / 60000;
  if (!(mins >= 0 && mins <= 30)) return null;
  return { por: a.por, desde: a.desde, mine: a.por === C.me };
}
// o contato escolhido em "Mandar para:" (mãe, pai, formando…): a prévia abre o WhatsApp Web na conversa dele
// (fica só na tela, não é gravado; sem escolha, vale o contato padrão)
export function escolherContato(it, c) {
  if (it) Object.defineProperty(it, "_contatoSel", { value: c, writable: true, configurable: true, enumerable: false });
}
export const contatoAtual = it => (it && it._contatoSel) || contatoPadrao(it || {});
export function contatoPadrao(it) {
  const cs = it.contatos || [];
  return cs.find(c => c.tipo === "Mãe") || cs.find(c => c.tipo === "Pai") || cs.find(c => c.tipo === "Formando") || cs[0] || null;
}

// ---------- gravação ----------
// Mudança de etapa pede "Mudar de X para Y?" (Regra 5); janelas que já são um formulário passam semConfirmar
export async function save(it, patch, msg, o = {}) {
  if (patch.etapa && patch.etapa !== it.etapa && !o.semConfirmar) {
    const { confirmarStatus } = await import("./confirmar.js");
    if (!(await confirmarStatus(it.etapa || "—", patch.etapa))) return false;
  }
  try {
    patch.atualizadoEm = new Date().toISOString();
    comAlteracao(it, patch, C.me);
    const ativ = atividadeDoPatch(it, patch, U.todayStr());
    await FS.updateDoc(FS.doc(db, colNome(), it.id), patch);
    if (ativ) registrarAtividade(C, Object.assign(ativ, { lista: vendaDe(it) }));
    Object.assign(it, patch);
    if (tab === "buscar") tela.renderList();
    U.toast(msg || "Salvo");
  } catch (e) {
    C.handleErr(e);
  }
}
export function claim(it) {
  if (!C.me) return;
  const li = lockInfo(it);
  if (li && li.mine) return;
  save(
    it,
    { atendendo: { por: C.me, desde: new Date().toISOString() } },
    "O outro aparelho vai ver: " + U.first(C.me) + " está respondendo"
  );
}
