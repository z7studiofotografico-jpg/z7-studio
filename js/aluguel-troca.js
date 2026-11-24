// Aluguel de becas · troca de tamanho quando acaba o estoque (24/11/2026). O estoque é o limite: o aluno não
// reserva um tamanho que não tem livre no dia. Em vez de só travar, o sistema sugere o tamanho mais perto que tem
// livre na mesma beca (primeiro o maior, que serve; depois o menor) e troca com um toque, anotando no histórico.
import { TAMANHOS, semTamanho } from "./becas-estoque.js";

const ORDEM = TAMANHOS.map(([t]) => t);
// o tamanho sugerido para o aluno (ou "" quando nenhum tem livre)
export function sugerirTamanho(a, faltaNoDia) {
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

// (24/11/2026) o problema do aluno em Cadastrado, para aparecer em vermelho na própria lista (sem abrir o aluno):
// esperando a beca ideal, sem tipo ou tamanho, sem kit, ou sem a beca livre no estoque do dia
export function problemaCadastro(a, faltaNoDia) {
  if ((a.status || "Cadastrado") !== "Cadastrado" || a.naoParticipa || a.soPaspatur || a.semBeca) return "";
  if (a.esperaBeca) return `⏳ Esperando a beca ideal (${a.esperaBeca}) · se não chegar: Avançar → 🔁 Trocar`;
  if (!a.becaTipo || (!a.tamanho && !semTamanho(a.becaTipo))) return "⚠️ Falta o tipo e o tamanho da beca: toque em Editar";
  if (!(a.pacote || []).length && !Number(a.valor)) return "⚠️ Sem kit: coloque o kit ou marque Não vai participar";
  const { dia, falta } = faltaNoDia(a);
  if (falta.length) return `⚠️ Sem ${falta.join(", ")} livre no dia ${dia.slice(8, 10)}/${dia.slice(5, 7)}: Avançar sugere outro tamanho`;
  return "";
}
