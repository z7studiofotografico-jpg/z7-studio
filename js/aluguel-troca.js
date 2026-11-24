// Aluguel de becas · troca de tamanho quando acaba o estoque (24/11/2026). O estoque é o limite: o aluno não
// reserva um tamanho que não tem livre no dia. Em vez de só travar, o sistema sugere o tamanho mais perto que tem
// livre na mesma beca (primeiro o maior, que serve; depois o menor) e troca com um toque, anotando no histórico.
import { TAMANHOS } from "./becas-estoque.js";
import { faltaNoDia } from "./aluguel-alunos.js";

const ORDEM = TAMANHOS.map(([t]) => t);
// o tamanho sugerido para o aluno (ou "" quando nenhum tem livre)
export function sugerirTamanho(a) {
  const i = ORDEM.indexOf(a.tamanho);
  if (i < 0) return "";
  const cand = [];
  for (let d = 1; d < ORDEM.length; d++) cand.push(ORDEM[i + d], ORDEM[i - d]); // o maior antes do menor
  return cand.filter(Boolean).find(z => !faltaNoDia(Object.assign({}, a, { tamanho: z, menosLonga: false })).falta.length) || "";
}
// troca o tamanho (com o motivo no histórico) e passa o aluno para a etapa
export async function trocarEAvancar(C, a, z, para, mudarStatus) {
  const em = new Date().toISOString();
  const historico = [...(a.historico || []), { em, por: C.me || "", o: `tamanho ${a.tamanho} → ${z} (acabou o ${a.tamanho} no estoque)` }];
  await C.FS.updateDoc(C.FS.doc(C.db, "alugueis", a.id), { tamanho: z, menosLonga: false, historico, atualizadoEm: em });
  const novo = Object.assign(a, { tamanho: z, menosLonga: false, historico });
  const r = await mudarStatus(novo, para, true);
  if (r === "ok") novo.status = para;
  return r;
}
