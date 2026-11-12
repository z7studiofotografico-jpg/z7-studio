// ⬇️ Planilha (backup): a lista que está na tela numa planilha, uma informação por coluna
// (contatos separados: nome numa coluna e telefone na outra). Aluguel e PR usam CAMPOS_ALUGUEL e CAMPOS_PR do cadastro.
import * as U from "./util.js";

const contatosNumerados = n =>
  Array.from({ length: n }, (_, j) => j + 1).flatMap(i => [
    [`n:${i}:nome`, `Contato ${i}`],
    [`n:${i}:cargo`, `Cargo ${i}`],
    [`n:${i}:tel`, `Telefone ${i}`],
    [`n:${i}:email`, `E-mail ${i}`]
  ]);
export const CAMPOS_INST = [
  ["nome", "Colégio"],
  ["sigla", "Sigla"],
  ["tipo", "Tipo"],
  ["etapa", "Etapa"],
  ["resp", "Representante"],
  ["mediaAlunos", "Alunos (média)"],
  ["endereco.rua", "Rua"],
  ["endereco.numero", "Número"],
  ["endereco.bairro", "Bairro"],
  ["endereco.cidade", "Cidade"],
  ["email", "E-mail do colégio"],
  ["horario", "Horário"],
  ...contatosNumerados(3),
  ["notas", "Notas"]
];
export const CAMPOS_LEADS = [
  ["codigoEnsaio", "ID"],
  ["nome", "Nome"],
  ["telefone", "WhatsApp"],
  ["servico", "Serviço"],
  ["origem", "Origem"],
  ["etapa", "Etapa"],
  ["followup", "Próximo contato"],
  ["resp", "Responsável na equipe"],
  ["valor", "Valor"],
  ["fechadoEm", "Fechado em"],
  ["criadoEm", "Criado em"],
  ["notas", "Notas"]
];
export const CAMPOS_FORMANDOS = [
  ["codigo", "ID"],
  ["nome", "Aluno"],
  ["tel", "WhatsApp do responsável"],
  ["serie", "Série"],
  ["kit", "Kit"],
  ["venda", "Venda (ant = antecipada · pos = depois das fotos)"],
  ["valor", "Valor"],
  ["parcelas", "Parcelas"],
  ["pagas", "Parcelas pagas"],
  ["primeiroVenc", "1º vencimento"],
  ["formaPag", "Forma de pagamento"],
  ["status", "Situação"],
  ["entregueEm", "Entregue em"],
  ["obs", "Observação"]
];
// botão pronto: lista() devolve o que está na tela na hora do toque
export function botaoPlanilha(nome, lista, campos, aoErro) {
  return U.mkBtn("⬇️ Planilha", "btn-sm", () =>
    import("./cadastro-aluno.js").then(m => m.baixarPlanilha(nome, lista(), campos)).catch(aoErro)
  );
}
