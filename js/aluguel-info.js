// Aluguel: a cor da linha do aluno e o resumo dele na janela (separado de aluguel-alunos.js, que passava de 850 linhas)
import * as U from "./util.js";
import { title } from "./ui.js";
import { telRelatorio } from "./aluno-id.js";
import { atrasadoAluguel } from "./aluguel-relatorio.js";
import { nomeItem } from "./contrato-colegio-regras.js";
import { tamanhoBeca } from "./becas-estoque.js";

// Lista compacta (o mesmo formato do PR, Formatura e Instituições): uma linha por aluno; tocar abre a janela
// Cores: vermelho atrasado na devolução · amarelo pronto para retirada · azul com a beca · verde devolvida · cinza o resto
export function corAluguel(a, hoje = U.todayStr()) {
  if (atrasadoAluguel(a, hoje)) return "vermelho";
  const st = a.status || "Cadastrado";
  if (st === "Devolvida") return "verde";
  if (st === "Retirou a beca") return "azul";
  if (st === "Pronto para retirada") return "amarelo";
  return "cinza";
}
// a linha completa do aluno na janela: beca, kit e contato
export function infoAluguel(a) {
  const kit = (a.pacote || []).map(nomeItem).join(" + ");
  const beca = a.becaTipo ? "👘 Beca " + tamanhoBeca(a).toLowerCase() : "";
  const p = a.naoParticipa ? "🚫 Não vai participar da formatura" : a.soPaspatur ? "📒 Só o Paspatur" : a.semBeca ? "📦 Sem beca" : beca;
  return [
    p,
    kit ? "Kit: " + kit : "",
    a.responsavel ? "Responsável: " + title(a.responsavel) : "",
    a.tel ? "📱 " + telRelatorio(a.tel) : ""
  ]
    .filter(Boolean)
    .join(" · ");
}
