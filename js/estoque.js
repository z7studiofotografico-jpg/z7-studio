// Estoque em 3 estados (item 6.3): Disponível → Reservado (separado para venda; desfaz num toque) → Baixado (só com a
// entrega confirmada). Voltar atrás depois da baixa = ESTORNO com motivo (nunca mudar a quantidade à mão).
// Cada mudança é uma transação (dois aparelhos ao mesmo tempo não deixam o número errado) e fica registrada em
// "movEstoque". Nada fica negativo: sem estoque, a reserva é recusada; insumo que acabou para em zero (com aviso).
// Os insumos (papel, tinta, plastificação) baixam pelo consumo estimado na ficha do produto.
import { montarCatalogo } from "./catalogo.js";

const n = v => Number(v) || 0;
const r2 = v => Math.round(v * 100) / 100;
export async function carregarCatalogo(C) {
  const s = await C.FS.getDocs(C.FS.collection(C.db, "produtos"));
  return montarCatalogo(Object.fromEntries(s.docs.map(d => [d.id, d.data()])));
}
// itens = [{ produto: id, qtd }]; o = { ref, modulo, motivo }
async function mover(C, tipo, itens, o = {}) {
  const { FS, db } = C;
  const cat = await carregarCatalogo(C);
  const porId = Object.fromEntries(cat.map(p => [p.id, p]));
  const avisos = [];
  await FS.runTransaction(db, async tx => {
    // soma o que cada documento vai mudar (o produto e os insumos da ficha)
    const delta = {}; // id → { fisico, reservado }
    const add = (id, k, v) => {
      delta[id] = delta[id] || { fisico: 0, reservado: 0 };
      delta[id][k] = r2(delta[id][k] + v);
    };
    for (const it of itens) {
      const p = porId[it.produto];
      const q = n(it.qtd);
      if (!p || !q) continue;
      if (tipo === "reserva" && p.controla) add(p.id, "reservado", q);
      if (tipo === "desfaz" && p.controla) add(p.id, "reservado", -q);
      if (tipo === "baixa" || tipo === "baixaDireta") {
        if (p.controla) {
          add(p.id, "fisico", -q);
          if (tipo === "baixa") add(p.id, "reservado", -q);
        }
        (p.ficha || []).forEach(f => add(f.insumo, "fisico", -n(f.qtd) * q));
      }
      if (tipo === "estorno") {
        if (p.controla) add(p.id, "fisico", q);
        (p.ficha || []).forEach(f => add(f.insumo, "fisico", n(f.qtd) * q));
      }
      if (tipo === "entrada") add(p.id, "fisico", q);
    }
    const ids = Object.keys(delta);
    const atuais = {};
    for (const id of ids) {
      const s = await tx.get(FS.doc(db, "produtos", id));
      atuais[id] = s.exists() ? s.data() : {};
    }
    for (const id of ids) {
      const a = atuais[id],
        d = delta[id];
      let fisico = r2(n(a.fisico) + d.fisico),
        reservado = r2(n(a.reservado) + d.reservado);
      const p = porId[id] || { nome: id };
      if (tipo === "reserva" && d.reservado > 0 && reservado > n(a.fisico))
        throw Object.assign(
          new Error(`Sem estoque de ${p.nome}: disponível ${Math.max(0, n(a.fisico) - n(a.reservado))}, pedido ${d.reservado}.`),
          {
            code: "sem-estoque"
          }
        );
      if (fisico < 0) {
        // produto vendido sem estoque físico cadastrado: recusa; insumo: para em zero e avisa
        if (p.categoria !== "insumo" && (tipo === "baixa" || tipo === "baixaDireta"))
          throw Object.assign(new Error(`Estoque de ${p.nome} insuficiente para dar baixa (tem ${n(a.fisico)}).`), { code: "sem-estoque" });
        avisos.push(`${p.nome} acabou (o consumo estimado passou do estoque)`);
        fisico = 0;
      }
      if (reservado < 0) reservado = 0;
      if (reservado > fisico) reservado = fisico;
      tx.set(FS.doc(db, "produtos", id), { fisico, reservado, atualizadoEm: new Date().toISOString() }, { merge: true });
    }
    tx.set(FS.doc(FS.collection(db, "movEstoque")), {
      tipo,
      itens: itens.filter(i => n(i.qtd)).map(i => ({ produto: i.produto, qtd: n(i.qtd) })),
      ref: o.ref || "",
      modulo: o.modulo || "",
      motivo: o.motivo || "",
      por: C.me || "",
      porEmail: C.email || "",
      em: new Date().toISOString()
    });
  });
  return { avisos };
}
export const reservar = (C, itens, o) => mover(C, "reserva", itens, o);
export const desfazerReserva = (C, itens, o) => mover(C, "desfaz", itens, o);
export const baixar = (C, itens, o) => mover(C, "baixa", itens, o);
// venda entregue na hora, sem reserva antes
export const baixarDireto = (C, itens, o) => mover(C, "baixaDireta", itens, o);
export function estornar(C, itens, o) {
  if (!o || !String(o.motivo || "").trim()) return Promise.reject(new Error("O estorno precisa de um motivo."));
  return mover(C, "estorno", itens, o);
}
export function entrada(C, itens, o) {
  return mover(C, "entrada", itens, Object.assign({ motivo: "compra / entrada" }, o));
}
