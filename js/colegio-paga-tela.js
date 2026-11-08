// Depois de marcar "o colégio paga" no cadastro: passar os alunos do PR que já estão no app (ano atual) para vendido
import * as U from "./util.js";
import { confirmar } from "./confirmar.js";
import { alunosDoColegioParaVendido, passarParaVendido } from "./colegio-paga.js";

export async function oferecerVendido(C, nomeColegio) {
  const { FS, db } = C;
  const ano = new Date().getFullYear();
  const lista = await alunosDoColegioParaVendido(FS, db, nomeColegio, ano);
  if (!lista.length) return U.toast(`Os alunos de ${ano} deste colégio vão entrar como vendidos ao importar`);
  const ok = await confirmar(
    "Passar os alunos para vendido?",
    `${lista.length} aluno${lista.length > 1 ? "s" : ""} do PR de ${ano} de ${nomeColegio} já ${lista.length > 1 ? "estão" : "está"} no app. ` +
      "Como o colégio paga, passar todos para vendido (pagos, para produzir e entregar no colégio)? Eles saem das filas da equipe.",
    { sim: "Passar para vendido", nao: "Agora não" }
  );
  if (!ok) return;
  try {
    const n = await passarParaVendido(FS, db, lista, U.todayStr(), C.email);
    U.toast(`${n} aluno${n > 1 ? "s" : ""} passado${n > 1 ? "s" : ""} para vendido ✅`);
  } catch (e) {
    C.handleErr(e);
  }
}
