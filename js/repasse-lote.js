// PR: números do topo, lote do dia (separar contatos da fila) e a lista de escolas
import { el, title, avisoErro } from "./ui.js";
import * as U from "./util.js";
import { pintarSeletor } from "./numeros-tela.js";
import { C, FS, db, col, tab, seg, meta, mudarMeta, ANO, ANO_MIN, ABERTAS, baseLF, soMinha, noSeg, $, tela } from "./repasse-estado.js";

export async function refreshStats() {
  const today = U.todayStr(),
    mes = today.slice(0, 8) + "01",
    Y = ANO();
  const set = (id, v) => {
    const x = $(id);
    if (x) x.textContent = v;
  };
  try {
    const lf = seg === "lf";
    const [h, i, m] = await Promise.all(
      lf
        ? [
            FS.getDocs(FS.query(col, ...baseLF(), ...soMinha(), FS.where("etapa", "in", ABERTAS), FS.limit(300))),
            FS.getDocs(FS.query(col, ...baseLF(), ...soMinha(), FS.where("etapa", "==", "INTERESSADO"), FS.limit(300))),
            FS.getDocs(FS.query(col, ...baseLF(), ...soMinha(), FS.where("etapa", "in", ["PAGO", "ENTREGUE"]), FS.limit(1000)))
          ]
        : C.isAdmin
          ? [
              FS.getDocs(FS.query(col, FS.where("followup", "<=", today), FS.limit(300))),
              FS.getDocs(FS.query(col, FS.where("etapa", "==", "INTERESSADO"), FS.limit(300))),
              FS.getDocs(FS.query(col, FS.where("pagoEm", ">=", mes), FS.limit(500)))
            ]
          : [
              FS.getDocs(FS.query(col, ...soMinha(), FS.where("etapa", "in", ABERTAS), FS.limit(500))),
              FS.getDocs(FS.query(col, ...soMinha(), FS.where("etapa", "==", "INTERESSADO"), FS.limit(300))),
              FS.getDocs(FS.query(col, ...soMinha(), FS.where("etapa", "in", ["PAGO", "ENTREGUE"]), FS.limit(1000)))
            ]
    );
    const docs = s0 => s0.docs.map(d => d.data()).filter(noSeg);
    set("rsHoje", docs(h).filter(x => ABERTAS.includes(x.etapa) && x.followup && x.followup <= today).length);
    set("rsInt", docs(i).length);
    set(
      "rsMes",
      U.money(
        docs(m)
          .filter(x => (x.pagoEm || "") >= mes)
          .reduce((a, x) => a + (Number(x.valor) || 0), 0)
      )
    );
    // Fila: conta por ano (só filtros de igualdade, não precisa de índice extra no Firebase)
    const anos = seg === "lf" ? [Y] : anosRepasse();
    const cs = await Promise.all(
      anos.map(a => FS.getCountFromServer(FS.query(col, FS.where("etapa", "==", "NA FILA"), FS.where("ano", "==", a))))
    );
    set(
      "rsFila",
      cs.reduce((a, c) => a + c.data().count, 0)
    );
  } catch (e) {
    console.warn(e);
  }
}
export function anosRepasse() {
  const Y = ANO(),
    conhecidos = Object.keys(meta.anos || {})
      .map(Number)
      .filter(a => a && a < Y);
  const de = conhecidos.length ? Math.min(...conhecidos) : ANO_MIN;
  const out = [];
  for (let a = Y - 1; a >= de; a--) out.push(a);
  return out;
}
// Não há limite: o app só avisa quando a pessoa passa do número de Ajustes (padrão: Linha de Frente 25, Repasse 20 por dia)
const avisoSeg = () => (seg === "lf" ? C.P.lfAvisoDia || 25 : C.P.avisoDia || 20);
const POR_VEZ = 10; // quantos contatos cada toque separa
export async function refreshLote() {
  const av = avisoSeg();
  // qual WhatsApp usar: o da empresa (admin) ou os da própria pessoa (equipe); aparece mesmo sem internet para contar
  pintarSeletor($("rLoteNum"), C, seg);
  try {
    const c = await FS.getCountFromServer(
      FS.query(
        col,
        FS.where("resp", "==", C.me),
        FS.where("separadoEm", "==", U.todayStr()),
        FS.where("separadoSeg", "==", seg),
        ...(seg === "lf" ? baseLF() : [])
      )
    );
    const n = c.data().count;
    $("rLoteTxt").textContent = n
      ? ` ${n} separado${n > 1 ? "s" : ""} hoje.`
      : ` Separe os contatos novos de hoje (o ideal é até ${av} por dia).`;
    const alerta = $("rLoteAviso");
    alerta.hidden = n < av;
    alerta.textContent = `⚠️ Você já separou ${n} contatos hoje (o combinado é até ${av}). Mandar muitas mensagens novas no mesmo dia pode fazer o WhatsApp bloquear o número. Pode continuar, mas vá com calma.`;
    $("rLote").classList.toggle("lote-aviso", n >= av);
    $("rLoteBtn").disabled = false;
    $("rLoteBtn").textContent = n ? `Separar mais ${POR_VEZ}` : `Separar ${POR_VEZ} contatos`;
    $("rLoteBtn").dataset.n = n;
  } catch (e) {
    console.warn(e);
    $("rLoteTxt").textContent = " Não foi possível contar agora.";
  }
}
export async function separarLote() {
  if (!C.me) return;
  const ja = Number($("rLoteBtn").dataset.n || 0),
    av = avisoSeg();
  let falta = POR_VEZ;
  const esc = $("rLoteEscola").value;
  const anos = seg === "lf" ? [ANO()] : anosRepasse(); // Repasse: do ano mais recente para o mais antigo
  $("rLoteBtn").disabled = true;
  try {
    // candidatos: um pouco mais que o necessário, porque outra pessoa pode pegar alguns ao mesmo tempo
    const cand = [];
    for (const a of anos) {
      if (cand.length >= falta * 2) break;
      const filtros = [FS.where("etapa", "==", "NA FILA"), FS.where("ano", "==", a)];
      if (esc) filtros.push(FS.where("escola", "==", esc));
      const s0 = await FS.getDocs(FS.query(col, ...filtros, FS.orderBy(FS.documentId()), FS.limit(falta * 2 - cand.length)));
      s0.docs.forEach(d => cand.push(d.ref));
    }
    if (!cand.length) {
      U.toast(esc ? "Essa escola não tem mais ninguém na fila." : "A fila acabou! 🎉");
      return;
    }
    // transação: só fica com quem ainda está NA FILA (dois vendedores nunca pegam o mesmo contato)
    const hoje = U.todayStr(),
      agora = new Date().toISOString();
    const pegos = await FS.runTransaction(db, async tx => {
      const lidos = [];
      for (const r of cand) lidos.push(await tx.get(r));
      const livres = lidos.filter(d => d.exists() && d.data().etapa === "NA FILA").slice(0, falta);
      livres.forEach(d =>
        tx.update(d.ref, {
          etapa: "SEPARADO",
          resp: C.me,
          respEmail: C.email || "",
          separadoEm: hoje,
          separadoSeg: seg,
          followup: hoje,
          atualizadoEm: agora
        })
      );
      return livres;
    });
    if (!pegos.length) {
      U.toast("Outra pessoa separou esses contatos agora. Toque de novo.");
      refreshLote();
      return;
    }
    const total = ja + pegos.length;
    U.toast(
      `${pegos.length} contato${pegos.length > 1 ? "s" : ""} separado${pegos.length > 1 ? "s" : ""} para você hoje` +
        (total >= av ? ` · ⚠️ já são ${total} hoje (combinado: até ${av})` : "")
    );
    refreshLote();
    refreshStats();
    if (tab !== "hoje") tela.openTab("hoje");
  } catch (e) {
    C.handleErr(e);
  } finally {
    $("rLoteBtn").disabled = false;
  }
}
export async function loadMeta() {
  try {
    const s = await FS.getDoc(FS.doc(db, "config", "repasse_meta"));
    mudarMeta(s.exists() ? Object.assign({ escolas: {}, anos: {} }, s.data()) : { escolas: {}, anos: {} });
    const names = Object.keys(meta.escolas || {}).sort((a, b) => a.localeCompare(b, "pt-BR"));
    ["rLoteEscola", "rEscola"].forEach(id => {
      const sel = $(id);
      const cur = sel.value;
      const first0 = sel.options[0];
      sel.innerHTML = "";
      sel.append(first0);
      names.forEach(n => {
        const o = el("option", null, `${title(n)} (${meta.escolas[n]})`);
        o.value = n;
        sel.append(o);
      });
      sel.value = cur;
    });
    const imp = $("rImport");
    if (imp) imp.hidden = !C.isAdmin;
  } catch (e) {
    avisoErro(e, "carregar a lista de escolas", U.toast);
  }
}
