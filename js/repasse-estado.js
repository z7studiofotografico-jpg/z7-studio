// PR: estado compartilhado pelas partes da tela (lista, cartão, janelas, lote) e as regras pequenas do contato.
// As outras partes leem o estado daqui (as variáveis exportadas acompanham as mudanças) e mudam pelas funções "mudar...".
import * as U from "./util.js";
export let C, FS, db, col;
export let tab = "hoje",
  seg = "lf",
  items = [],
  meta = { escolas: {}, anos: {} };
export const mudarTab = v => (tab = v);
export const mudarSeg = v => (seg = v);
export const mudarItems = v => (items = v);
export const mudarMeta = v => (meta = v);
// Ligações com a tela principal (repasse.js preenche): quem grava avisa a lista para redesenhar
export const tela = { renderList() {}, openTab() {} };
export function iniciar(ctx) {
  C = ctx;
  FS = ctx.FS;
  db = ctx.db;
  col = FS.collection(db, "repasse");
  try {
    seg = localStorage.getItem("z7seg") || "lf";
  } catch (_) {}
}
// Assumir o contato: quem não é admin só assume o que está sem responsável (ou já é seu)
export const assumir = it => (!C.isAdmin && it.respEmail && it.respEmail !== C.email ? {} : { resp: C.me, respEmail: C.email || "" });
export const ANO = () => new Date().getFullYear();
export const ANO_MIN = 2015;
// Em qual frente o formando está. Sem ano (incompleto) aparece nas duas.
export function segDe(it) {
  return !it.ano ? null : it.ano >= ANO() ? "lf" : "rep";
}
export function noSeg(it) {
  const s0 = segDe(it);
  return !s0 || s0 === seg;
}
export const segNome = s0 => (s0 === "lf" ? "Linha de Frente " + ANO() : "Repasse");
// Quem só tem a Linha de Frente só pode ler ensaios do ano atual (as regras do Firebase também exigem isso),
// então as buscas da Linha de Frente sempre filtram pelo ano.
export const segsPermitidas = () => ["lf", "rep"].filter(k => C.pode(k));
export const baseLF = () => [FS.where("ano", "==", ANO())];
// A equipe trabalha só a própria carteira (o admin vê tudo): filtro das abas e dos números
export const soMinha = () => (C.isAdmin ? [] : [FS.where("respEmail", "==", C.email || "")]);
export const $ = id => document.getElementById(id);

export const ETAPAS = ["INCOMPLETO", "NA FILA", "SEPARADO", "CONTATADO", "INTERESSADO", "PAGO", "ENTREGUE", "NÃO QUER", "SEM CONTATO"];
export const ABERTAS = ["SEPARADO", "CONTATADO", "INTERESSADO"];

// ---------- utilidades ----------
export function eu() {
  const f = U.first(C.me);
  return f ? (/a$/i.test(f) ? "a " : "o ") + f : "a equipe";
}
export function precoTxt(it) {
  const P = C.P;
  if (it ? segDe(it) === "lf" : seg === "lf") return P.lfPix ? U.money(P.lfPix) : P.kitPreco ? U.money(P.kitPreco) : "[valor do kit]";
  if (P.kitPromo) return U.money(P.kitPromo);
  if (P.kitPreco) return U.money(P.kitPreco);
  return "[valor do kit]";
}
export function ofertaTxt(it) {
  const P = C.P;
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
  return it && segDe(it) === "lf" && C.P.lfParcelas ? C.P.lfParcelas : C.P.parcelas;
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
export function contatoPadrao(it) {
  const cs = it.contatos || [];
  return cs.find(c => c.tipo === "Mãe") || cs.find(c => c.tipo === "Pai") || cs.find(c => c.tipo === "Formando") || cs[0] || null;
}

// ---------- gravação ----------
export async function save(it, patch, msg) {
  try {
    patch.atualizadoEm = new Date().toISOString();
    await FS.updateDoc(FS.doc(db, "repasse", it.id), patch);
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
