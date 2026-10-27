// Instituições: estado compartilhado pelas partes da tela (lista, formulários, agendar) e a gravação.
import { ESTUDIO } from "./mensagens.js";
import { title } from "./ui.js";
import * as Ev from "./eventos.js";
import * as U from "./util.js";
export let C, FS, db, col;
export let tipo = "particular",
  items = [];
export const mudarTipo = v => (tipo = v);
export const mudarItems = v => (items = v);
export function iniciar(ctx) {
  C = ctx;
  FS = ctx.FS;
  db = ctx.db;
  col = FS.collection(db, "instituicoes");
  Ev.init(ctx);
}
export function eu() {
  const f = U.first(C.me);
  return f ? (/a$/i.test(f) ? "a " : "o ") + f : "a equipe";
}
export function lockInfo(it) {
  const a = it.atendendo;
  if (!a || !a.por || !a.desde) return null;
  const mins = (Date.now() - Date.parse(a.desde)) / 60000;
  if (!(mins >= 0 && mins <= 30)) return null;
  return { por: a.por, desde: a.desde, mine: a.por === C.me };
}
// Preços por tipo de instituição (colégio particular e público têm preços diferentes)

// ---------- mensagens prontas para o WhatsApp ----------
export function mensagem(it, c) {
  const n = c && c.nome ? U.first(title(c.nome)) : "";
  const oi = n ? `Olá, ${n}!` : "Olá!";
  const nome = title(it.nome);
  const ult = (it.visitas || [])[0];
  const apres =
    ult && ult.apresentou && ult.apresentou.length ? ` (${ult.apresentou.map(p => p.nome.replace(/ \(.*\)$/, "")).join(", ")})` : "";
  if (it.etapa === "A VISITAR" || it.etapa === "AGENDAR VISITA")
    return `${oi} Aqui é ${eu()}, do ${ESTUDIO.nome} 📸 Trabalhamos com fotos de formatura em escolas da região há mais de 15 anos. Gostaria de agendar uma visita rápida ${it.tipo === "faculdade" ? "com a comissão de formatura" : "ao " + nome} para apresentar os nossos kits. Qual o melhor dia e horário?`;
  if (it.etapa === "VISITADO" || it.etapa === "PROPOSTA ENVIADA")
    return `${oi} Aqui é ${eu()}, do ${ESTUDIO.nome}. Passando para saber se conseguiram conversar sobre a proposta das fotos de formatura${apres}. Posso ajudar com alguma dúvida? 😊`;
  if (it.etapa === "NÃO FECHOU")
    return `${oi} Aqui é ${eu()}, do ${ESTUDIO.nome}. Já conversamos sobre as fotos de formatura${nome ? " do " + nome : ""}. Estamos organizando a agenda de ${new Date().getFullYear() + (new Date().getMonth() >= 8 ? 1 : 0)}: podemos marcar uma visita rápida para mostrar as novidades?`;
  return "";
}

// ---------- gravação ----------
export async function save(it, patch, msg) {
  try {
    patch.atualizadoEm = new Date().toISOString();
    await FS.updateDoc(FS.doc(db, "instituicoes", it.id), patch);
    U.toast(msg || "Salvo");
  } catch (e) {
    C.handleErr(e);
  }
}
export function claim(it) {
  if (!C.me) return;
  const li = lockInfo(it);
  if (li && li.mine) return;
  save(it, { atendendo: { por: C.me, desde: new Date().toISOString() } }, "O outro aparelho vai ver: " + U.first(C.me) + " está atendendo");
}
