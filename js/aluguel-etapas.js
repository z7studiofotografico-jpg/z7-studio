// Etapas do aluno de aluguel (24/11/2026: separado de aluguel-alunos.js, que passou do tamanho)
export const STATUS_ALUGUEL = ["Cadastrado", "Beca medida", "Produtos em produção", "Pronto para retirada", "Retirou a beca", "Devolvida"];
// as etapas de cada aluno (17/11/2026): Produtos em produção para quem tem Paspatur, Canudo, Certificado, quadro ou
// fotos (no kit ou nos produtos); só a beca vai direto para Pronto para retirada. Só o Paspatur não tem beca:
// Cadastrado → Produtos em produção → Pronto para retirada → Paspatur entregue. Quem não vai participar não anda.
export const temProducao = a => (a.pacote || []).some(k => k !== "beca") || (a.produtos || []).some(x => x.estado !== "estornado");
// (24/11/2026) kit sem beca (ex.: só certificado + canudo): anda como o "só o Paspatur", sem medir beca
export const semBeca = a => !!(a && (a.soPaspatur || a.semBeca));
export function etapasDe(a) {
  if (a.naoParticipa) return ["Cadastrado"];
  if (semBeca(a)) return ["Cadastrado", "Produtos em produção", "Pronto para retirada", "Retirou a beca"];
  return STATUS_ALUGUEL.filter(s => s !== "Produtos em produção" || temProducao(a));
}
export function proximoStatus(a) {
  const e = etapasDe(a);
  const i = e.indexOf(a.status || "Cadastrado");
  return (i < 0 ? e[0] : e[i + 1]) || null;
}
export function anteriorStatus(a) {
  const e = etapasDe(a);
  const i = e.indexOf(a.status || "Cadastrado");
  return i > 0 ? e[i - 1] : null;
}
// "Retirou a beca" do aluno só do Paspatur é a entrega do Paspatur
export const nomeEtapa = (a, s) => (semBeca(a) && s === "Retirou a beca" ? (a.soPaspatur ? "Paspatur entregue" : "Kit entregue") : s);

