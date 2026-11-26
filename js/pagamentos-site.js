// Pagamento do kit pela página da prévia (17/11/2026). A família toca em "💳 Pagar" no link da prévia e paga na
// InfinitePay; o site confere o pagamento com a InfinitePay e guarda (site/publico/previas-api/pago.php).
// Com o app aberto no login do administrador, este módulo busca esses pagamentos a cada 2 minutos e marca o aluno
// (o que tem aquele link da prévia) como Pago, com a forma, as parcelas e o comprovante. Ninguém precisa digitar.
import * as U from "./util.js";
import { API_SITE } from "./site-previas.js";

const LISTAS = ["repasse", "paspatur"];
const COMPROU = ["PAGO", "ENTREGUE"];

async function chamar(C, caminho, o = {}) {
  const t = C.token ? await C.token() : "";
  const r = await fetch(API_SITE + caminho, Object.assign({}, o, { headers: { Authorization: "Bearer " + t } }));
  if (!r.ok) throw new Error("pagamentos do site: " + r.status);
  return r.json();
}

// o que gravar no aluno (o mesmo de "Registrar venda", já conferido: o dinheiro entrou na InfinitePay)
export function patchPago(p, hoje = U.todayStr()) {
  const parc = Number(p.parcelas) || 1;
  return {
    etapa: "PAGO",
    valor: Math.round(Number(p.valor) || 0) / 100,
    formaPag: p.forma === "pix" ? "Pix" : "Cartão",
    comprovante: p.recibo || "InfinitePay " + String(p.transaction_nsu || "").slice(0, 40),
    valorForaTabela: false,
    conferido: true,
    conferidoPor: "InfinitePay (pago pelo site)",
    conferidoEm: hoje,
    pagoEm: hoje,
    pagoPeloSite: {
      transacao: String(p.transaction_nsu || ""),
      parcelas: p.forma === "pix" ? 1 : parc,
      em: String(p.em || "")
    },
    followup: null,
    atendendo: null
  };
}

// (25/11/2026) o sinal do ensaio (Funil) também paga pelo site: o lead guarda o código em "linkSinal"
export const ONDE = [...LISTAS.map(col => [col, "linkPrevia"]), ["leads", "linkSinal"]];
export function patchSinal(p, hoje = U.todayStr(), lead = {}) {
  const sinal = {
    valor: Math.round(Number(p.valor) || 0) / 100,
    forma: p.forma === "pix" ? "Pix" : "Cartão",
    transacao: String(p.transaction_nsu || ""),
    recibo: p.recibo || "",
    em: hoje
  };
  // o sinal pago fecha a venda (já conferida: o dinheiro entrou na InfinitePay); o valor do ensaio não muda
  return lead.etapa === "FECHADO"
    ? { sinalPago: sinal }
    : { etapa: "FECHADO", fechadoEm: hoje, conferido: true, sinalPago: sinal, followup: "", atendendo: null };
}
async function alunoDoLink(C, codigo) {
  const { FS, db } = C;
  for (const [col, campo] of ONDE) {
    const s = await FS.getDocs(FS.query(FS.collection(db, col), FS.where(campo, "==", codigo)));
    if (!s.empty) return { col, id: s.docs[0].id, it: s.docs[0].data() };
  }
  return null;
}

export async function registrarPagamentos(C) {
  if (!C.isAdmin) return 0;
  const { pagamentos = [] } = await chamar(C, "/pagamentos.php");
  let n = 0;
  for (const p of pagamentos) {
    try {
      const a = await alunoDoLink(C, p.codigo);
      if (!a) {
        console.warn("[Z7] pagamento do site sem aluno com o link", p.codigo);
        continue; // fica na lista do site até o link aparecer em um aluno
      }
      if (a.col === "leads") {
        if (!a.it.sinalPago) {
          await C.FS.updateDoc(
            C.FS.doc(C.db, "leads", a.id),
            Object.assign(patchSinal(p, U.todayStr(), a.it), { atualizadoEm: new Date().toISOString() })
          );
          U.toast(`💳 ${U.first(a.it.nome || "")} pagou o sinal do ensaio (${p.forma === "pix" ? "Pix" : "cartão"}) ✅`);
          n++;
        }
      } else if (!COMPROU.includes(a.it.etapa)) {
        await C.FS.updateDoc(C.FS.doc(C.db, a.col, a.id), patchPago(p));
        U.toast(`💳 ${U.first(a.it.nome || "")} pagou o kit pelo site (${p.forma === "pix" ? "Pix" : "cartão"}) ✅`);
        n++;
      }
      const f = new FormData();
      f.append("feito", p.transaction_nsu);
      await chamar(C, "/pagamentos.php", { method: "POST", body: f });
    } catch (e) {
      console.warn("[Z7] pagamento do site", e);
    }
  }
  return n;
}

let ligado = null;
export function ligarPagamentosSite(C) {
  if (ligado || !C.isAdmin) return;
  const vez = () => (document.hidden ? null : registrarPagamentos(C).catch(e => console.warn("[Z7] pagamentos do site", e)));
  setTimeout(vez, 8000);
  ligado = setInterval(vez, 2 * 60 * 1000);
}
