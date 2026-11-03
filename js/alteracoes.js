// Histórico de alterações (revisão): quem mudou o quê e quando, guardado no próprio aluno (as últimas 40).
// alteracoes: [{ em, por, campos: [...], de?, para? }] — "de/para" só quando muda a etapa (status).
const IGNORAR = new Set(["atualizadoEm", "atendendo", "alteracoes"]);
export function comAlteracao(it, patch, por) {
  const campos = Object.keys(patch).filter(k => !IGNORAR.has(k));
  if (!campos.length) return patch;
  const e = { em: new Date().toISOString(), por: por || "", campos };
  if (patch.etapa && it && patch.etapa !== it.etapa) Object.assign(e, { de: it.etapa || "", para: patch.etapa });
  return Object.assign(patch, { alteracoes: [...((it && it.alteracoes) || []), e].slice(-40) });
}
export function linhasAlteracoes(it) {
  return [...((it && it.alteracoes) || [])]
    .reverse()
    .map(
      a =>
        `${String(a.em).slice(8, 10)}/${String(a.em).slice(5, 7)} ${String(a.em).slice(11, 16)} · ${a.por || "?"} · ${a.de ? a.de + " → " + a.para : a.campos.join(", ")}`
    );
}
