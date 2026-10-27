// O que o resumo do Dashboard lê (o mesmo no botão "Atualizar agora" e no resumo da madrugada no GitHub).
// O Dashboard guarda 24 meses: lê só o que pode mudar esses meses (e o que ainda está em aberto),
// em vez de coleções inteiras que só crescem.
// ler(colecao, filtros) → lista de { id, ...dados }; filtros = [[campo, operador, valor], ...]
// versaoDados < 7 (a atualização que grava "ultimoPag" ainda não rodou): lê todos os formandos, como antes.
import { somaDias } from "./regras.js";

export async function lerFontes(ler, hoje, versaoDados = 99) {
  const corte = somaDias(hoje, -730);
  const juntar = (...listas) => [...new Map(listas.flat().map(x => [x.id, x])).values()];
  const desde = campo => [[campo, ">=", corte]];
  const [leadsNovos, leadsFechados, prsPagos, fAbertos, fVendidos, fPagos, fDevolvidos, insts, ens, becasRet, becasCri, separados] =
    await Promise.all([
      ler("leads", desde("criadoEm")),
      ler("leads", desde("fechadoEm")),
      ler("repasse", desde("pagoEm")),
      // formandos: com parcela em aberto (a receber), vendidos ou com pagamento nos 24 meses, e devoluções
      ler("formandos", versaoDados < 7 ? [] : [["proxVenc", "!=", ""]]),
      versaoDados < 7 ? [] : ler("formandos", desde("vendidoEm")),
      versaoDados < 7 ? [] : ler("formandos", desde("ultimoPag")),
      versaoDados < 7 ? [] : ler("formandos", desde("devolucao.em")),
      ler("instituicoes", []), // poucas (centenas); as visitas de cada uma entram nos meses
      ler("ensaios", desde("data")),
      ler("becas", desde("retirada")),
      ler("becas", desde("criadoEm")),
      ler("repasse", desde("separadoEm"))
    ]);
  return {
    leads: juntar(leadsNovos, leadsFechados),
    prs: prsPagos.filter(r => ["PAGO", "ENTREGUE"].includes(r.etapa)),
    forms: juntar(fAbertos, fVendidos, fPagos, fDevolvidos),
    insts,
    ens,
    becas: juntar(becasRet, becasCri),
    separados
  };
}
