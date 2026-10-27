// Tela inicial: os números de cada cartão (para hoje, atrasados, pedidos), contados sem baixar coleções inteiras.
import * as FS from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { collection, query, where, getCountFromServer } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { avisoErro } from "./ui.js";
import { todayStr, addDays, first } from "./util.js";
const $ = id => document.getElementById(id);
// ctx = o mesmo do app (me, isAdmin, pode, email, aprovador, P, carteira); Funil = módulo do funil (contagem dos leads)
export function criarInicio(ctx, Funil) {
  const db = ctx.db,
    pode = m => ctx.pode(m);
  let repCount = { at: 0, n: null };
  function renderHome() {
    const h = new Date().getHours();
    $("hello").textContent = (h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite") + (ctx.me ? ", " + first(ctx.me) : "") + "!";
    const { late, today } = Funil.contagem();
    $("tVendas").textContent = ctx.isAdmin ? "Abrir" : "Meu desempenho";
    document.querySelectorAll(".tile[data-mod]").forEach(t => {
      t.hidden = !pode(t.dataset.mod);
    });
    $("tFunil").textContent =
      late + today ? `${late + today} para hoje` + (late ? ` · ${late} atrasado${late > 1 ? "s" : ""}` : "") : "Nada pendente hoje ✓";
    if (Date.now() - repCount.at > 5 * 60000) {
      repCount.at = Date.now();
      if (pode("rep") && ctx.isAdmin)
        getCountFromServer(query(collection(db, "repasse"), where("followup", "<=", todayStr())))
          .then(c => {
            repCount.n = c.data().count;
            paintRep();
          })
          .catch(e => avisoErro(e, "contar o PR"));
      // equipe do Repasse: só os contatos dela
      else if (pode("rep"))
        FS.getDocs(
          query(
            collection(db, "repasse"),
            where("respEmail", "==", ctx.email),
            where("etapa", "in", ["SEPARADO", "CONTATADO", "INTERESSADO"]),
            FS.limit(500)
          )
        )
          .then(s => {
            repCount.n = s.docs.filter(d => (d.data().followup || "9") <= todayStr()).length;
            paintRep();
          })
          .catch(e => avisoErro(e, "contar o PR"));
      else if (pode("lf"))
        FS.getDocs(
          query(
            collection(db, "repasse"),
            where("ano", "==", new Date().getFullYear()),
            where("etapa", "in", ["SEPARADO", "CONTATADO", "INTERESSADO"]),
            FS.limit(300)
          )
        )
          .then(s => {
            repCount.n = s.docs.filter(
              d => (d.data().followup || "9") <= todayStr() && (!d.data().respEmail || d.data().respEmail === ctx.email)
            ).length;
            paintRep();
          })
          .catch(e => avisoErro(e, "contar o PR"));
    }
    // pedidos de aluno repetido no PR esperando a decisão do admin
    if (ctx.isAdmin && Date.now() - (repCount.pedAt || 0) > 60000) {
      repCount.pedAt = Date.now();
      getCountFromServer(query(collection(db, "pedidos"), where("status", "==", "pendente")))
        .then(c => {
          repCount.ped = c.data().count;
          paintRep();
        })
        .catch(() => {});
    }
    paintRep();
    contarInst();
    contarAgenda();
    contarFormBecas();
  }
  // Cartões Formaturas e Becas: parcelas atrasadas e devoluções atrasadas
  let fbCount = { at: 0 };
  function contarFormBecas() {
    if (Date.now() - fbCount.at < 60000) return;
    fbCount.at = Date.now();
    const hoje = todayStr();
    // Parcelas atrasadas = próximo vencimento em aberto (proxVenc) antes de hoje. O admin conta no servidor, sem baixar nada.
    const pinta = n => {
      $("tFormaturas").textContent = n ? `⚠️ ${n} parcela${n > 1 ? "s" : ""} atrasada${n > 1 ? "s" : ""}` : "Abrir";
    };
    if (pode("formaturas")) {
      if (ctx.isAdmin)
        getCountFromServer(query(collection(db, "formandos"), where("proxVenc", ">", ""), where("proxVenc", "<", hoje)))
          .then(c => pinta(c.data().count))
          .catch(e => avisoErro(e, "contar parcelas atrasadas"));
      else
        FS.getDocs(query(collection(db, "formandos"), where("respEmail", "==", ctx.email), FS.limit(2000)))
          .then(s => pinta(s.docs.map(d => d.data()).filter(f => f.proxVenc && f.proxVenc < hoje).length))
          .catch(e => avisoErro(e, "contar parcelas atrasadas"));
    }
    if (pode("becas"))
      FS.getDocs(query(collection(db, "becas"), where("status", "in", ["reservado", "retirado"]), FS.limit(500)))
        .then(s => {
          const l = s.docs.map(d => d.data()),
            at = l.filter(b => b.status === "retirado" && b.devolucao && b.devolucao < hoje).length,
            ret = l.filter(b => b.status === "reservado" && b.retirada && b.retirada <= addDays(1)).length;
          const p = [];
          if (at) p.push(`⚠️ ${at} devolução${at > 1 ? "ões" : ""} atrasada${at > 1 ? "s" : ""}`);
          if (ret) p.push(`${ret} retirada${ret > 1 ? "s" : ""} hoje/amanhã`);
          $("tBecas").textContent = p.join(" · ") || "Abrir";
        })
        .catch(e => avisoErro(e, "contar as becas"));
  }
  // Cartão do Agendamento: para a Luciana, quantas datas esperam aprovação
  let agCount = { at: 0 };
  function contarAgenda() {
    if (!pode("agenda") && !pode("colegios")) return;
    if (Date.now() - agCount.at < 60000) return;
    agCount.at = Date.now();
    const eu = ctx.aprovador;
    const falhou = (onde, v) => e => {
      avisoErro(e, onde);
      return v;
    };
    const ens = ctx.isAdmin
      ? FS.getDocs(query(collection(db, "ensaios"), where("data", "==", addDays(1)), FS.limit(100)))
          .then(s => s.docs.map(d => d.data()))
          .catch(falhou("ver os ensaios de amanhã", []))
      : Promise.resolve([]);
    const ana =
      ctx.isAdmin && eu
        ? getCountFromServer(query(collection(db, "ensaios"), where("status", "==", "analisar")))
            .then(c => c.data().count)
            .catch(falhou("contar ensaios para analisar", 0))
        : Promise.resolve(0);
    const prz = Number(ctx.P.prazo) || 15;
    const atr = ctx.isAdmin
      ? FS.getDocs(query(collection(db, "ensaios"), where("data", ">=", addDays(-90)), FS.limit(600)))
          .then(
            s =>
              s.docs
                .map(d => d.data())
                .filter(
                  e =>
                    e.kind !== "pessoal" &&
                    e.status !== "faltou" &&
                    e.status !== "remarcar" &&
                    e.data <= addDays(-prz) &&
                    !(e.entrega && e.entrega.etapa === "Entregue")
                ).length
          )
          .catch(falhou("contar entregas", 0))
      : Promise.resolve(0);
    Promise.all([
      getCountFromServer(query(collection(db, "agenda"), where("status", "==", "pendente")))
        .then(c => c.data().count)
        .catch(falhou("contar datas pendentes", 0)),
      ana,
      ens,
      atr
    ]).then(([n, a, amanha, at]) => {
      const p = [];
      if (eu && n + a) p.push(`${n + a} para analisar`);
      else if (n) p.push(`${n} aguardando a Luciana`);
      const lem = amanha.filter(e => e.status !== "remarcar" && !e.lembrado && e.tel).length;
      if (lem) p.push(`${lem} lembrete${lem > 1 ? "s" : ""} para amanhã`);
      if (at) p.push(`⚠️ ${at} entrega${at > 1 ? "s" : ""} atrasada${at > 1 ? "s" : ""}`);
      $("tAgenda").textContent = p.join(" · ") || "Abrir";
    });
  }
  // Retornos de hoje por tipo de instituição (cartões da tela Instituições e da tela inicial)
  let instCount = { at: 0, por: null };
  function contarInst(force) {
    if (!pode("colegios")) return;
    if (!force && Date.now() - instCount.at < 120000 && instCount.por) return paintInst();
    instCount.at = Date.now();
    const hj = todayStr();
    (ctx.isAdmin
      ? Promise.all([
          FS.getDocs(query(collection(db, "instituicoes"), where("followup", "<=", hj), FS.limit(500))),
          FS.getDocs(query(collection(db, "instituicoes"), where("formatura.status", "in", ["pendente", "confirmado"]), FS.limit(500)))
        ])
      : FS.getDocs(ctx.carteira("instituicoes")).then(s => {
          const docs = s.docs;
          const f = fn => ({ docs: docs.filter(d => fn(d.data())) });
          return [f(x => x.followup && x.followup <= hj), f(x => x.formatura && ["pendente", "confirmado"].includes(x.formatura.status))];
        })
    )
      .then(([s1, s2]) => {
        const por = {},
          vistos = new Set();
        s1.docs.forEach(d => {
          const x = d.data();
          if (x.etapa !== "FECHADO") {
            por[x.tipo] = (por[x.tipo] || 0) + 1;
            vistos.add(d.id);
          }
        });
        // pendência: formatura sem o dia de medir beca + ensaio
        s2.docs.forEach(d => {
          const x = d.data();
          const df = x.diaFotos;
          if (!vistos.has(d.id) && !(df && df.data && df.status !== "recusado")) por[x.tipo] = (por[x.tipo] || 0) + 1;
        });
        instCount.por = por;
        paintInst();
      })
      .catch(e => avisoErro(e, "contar os retornos das instituições"));
  }
  function paintInst() {
    const por = instCount.por || {};
    document.querySelectorAll(".tile[data-inst]").forEach(t => {
      const n = t.dataset.inst === "superior" ? (por.faculdade || 0) + (por.profissionalizante || 0) : por[t.dataset.inst] || 0;
      t.querySelector(".tile-n").textContent = n ? `${n} para hoje` : "Nada pendente hoje ✓";
    });
    const tot = Object.values(por).reduce((a, b) => a + b, 0),
      tile = document.querySelector('.tile[data-mod="colegios"] .tile-n');
    if (tile) tile.textContent = instCount.por ? (tot ? `${tot} para hoje` : "Nada pendente hoje ✓") : "Abrir";
  }
  function paintRep() {
    const base = repCount.n == null ? "" : repCount.n ? `${repCount.n} para hoje` : "Nada pendente hoje ✓";
    $("tRepasse").textContent = base + (repCount.ped ? ` · 📩 ${repCount.ped} pedido${repCount.ped > 1 ? "s" : ""} de aluno repetido` : "");
  }
  return { renderHome, contarInst };
}
