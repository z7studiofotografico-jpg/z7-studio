// ID do ensaio fechado no Funil: ano + tipo + número em sequência (26EST-00001).
// EST = estúdio (formatura no estúdio e retrato), EXT = externo, COP = corporativo. Turma e "Outro" não têm ID.
// O número segue por ano e por tipo (26EST-00001, 26EST-00002…; 26EXT-00001…) e nunca repete:
// o último número usado fica em ids/ensaio_<aa><tipo>, reservado numa transação (igual ao ID do aluno).
// O ano é o do fechamento da venda. Depois de dado, o ID não muda (nem se o serviço for corrigido).
export const TIPOS_ID = { EST: "Estúdio", EXT: "Externo", COP: "Corporativo" };
const sem = s =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
export function tipoIdEnsaio(servico) {
  const s = sem(servico);
  if (/corporativ/.test(s)) return "COP";
  if (/extern/.test(s)) return "EXT";
  if (/estudio|retrato/.test(s)) return "EST";
  return "";
}
export const fmtCodigoEnsaio = (ano, tipo, n) => `${String(ano).slice(-2)}${tipo}-${String(n).padStart(5, "0")}`;
export function lerCodigoEnsaio(c) {
  const m = /^(\d{2})(EST|EXT|COP)-(\d{1,})$/.exec(
    String(c || "")
      .toUpperCase()
      .trim()
  );
  return m ? { aa: m[1], tipo: m[2], n: Number(m[3]) } : null;
}
export const anoDoFechamento = l => Number(String((l && l.fechadoEm) || "").slice(0, 4)) || new Date().getFullYear();
// venda fechada que ainda não tem ID (e é de um tipo que tem ID)
export const precisaCodigo = l => !!l && l.etapa === "FECHADO" && !l.codigoEnsaio && !!tipoIdEnsaio(l.servico);
// maior número já usado neste ano e tipo, entre os leads que o aparelho tem (proteção extra do contador)
export function maiorEnsaio(ano, tipo, leads) {
  const aa = String(ano).slice(-2);
  return (leads || []).reduce((m, l) => {
    const c = lerCodigoEnsaio(l && l.codigoEnsaio);
    return c && c.aa === aa && c.tipo === tipo ? Math.max(m, c.n) : m;
  }, 0);
}
// Dá o ID a uma venda fechada, numa transação só: lê o lead (se já tem ID, devolve o mesmo), sobe o contador
// e grava o ID no lead. Dois aparelhos ao mesmo tempo nunca pegam o mesmo número nem dão dois IDs ao mesmo lead.
// Sem internet a transação falha: devolve "" e o app tenta de novo depois (nunca chuta um número).
export async function darCodigoEnsaio(FS, db, leadId, leads) {
  const leadRef = FS.doc(db, "leads", leadId);
  try {
    return await FS.runTransaction(db, async tx => {
      const ls = await tx.get(leadRef);
      if (!ls.exists()) return "";
      const l = ls.data();
      if (l.codigoEnsaio) return l.codigoEnsaio;
      if (!precisaCodigo(l)) return "";
      const ano = anoDoFechamento(l),
        tipo = tipoIdEnsaio(l.servico);
      const ref = FS.doc(db, "ids", `ensaio_${String(ano).slice(-2)}${tipo}`);
      const s = await tx.get(ref);
      const n = Math.max(s.exists() ? Number(s.data().ultimo) || 0 : 0, maiorEnsaio(ano, tipo, leads)) + 1;
      const codigo = fmtCodigoEnsaio(ano, tipo, n);
      tx.set(ref, { ultimo: n });
      tx.update(leadRef, { codigoEnsaio: codigo });
      return codigo;
    });
  } catch (e) {
    console.warn("[Z7] ID do ensaio", e);
    return "";
  }
}
