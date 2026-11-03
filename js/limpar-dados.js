// Ajustes → "🧹 Limpar para reimportar" (só o Adriano): apaga os alunos de PR, Paspatur ou Formatura (por ano ou
// tudo) para mandar as planilhas certas de novo. Pede a cópia de segurança antes, confirma com Sim/Não e respeita
// o limite grátis do Firebase (20 mil gravações por dia): se passar, para no meio e avisa para continuar amanhã.
// O PR também tira os telefones desses alunos do índice "fones"; a lista de escolas (meta) é ajustada junto.
import { el, sheet } from "./ui.js";
import * as U from "./util.js";
import { confirmar } from "./confirmar.js";

export const LISTAS = [
  ["repasse", "PR", "repasse_meta"],
  ["paspatur", "PR · Paspatur", "paspatur_meta"],
  ["formaturaAlunos", "Formatura (Linha de Frente e Repasse)", "formatura_meta"]
];
export const LIMITE_POR_VEZ = 12000;

// meta (escolas, anos, escolasAno) sem os anos apagados; tudo = zera
export function metaSemAnos(meta, anos, tudo) {
  if (tudo) return { escolas: {}, anos: {}, escolasAno: {} };
  const tira = new Set(anos.map(String));
  const escolasAno = Object.fromEntries(Object.entries(meta.escolasAno || {}).filter(([k]) => !tira.has(k.slice(k.lastIndexOf("|") + 1))));
  const escolas = {};
  Object.entries(escolasAno).forEach(([k, n]) => {
    const e = k.slice(0, k.lastIndexOf("|"));
    escolas[e] = (escolas[e] || 0) + n;
  });
  return {
    escolas,
    anos: Object.fromEntries(Object.entries(meta.anos || {}).filter(([a]) => !tira.has(String(a)))),
    escolasAno
  };
}

export async function abrirLimpeza(C) {
  if (!C.isAdmin) return;
  const { FS, db } = C;
  sheet("🧹 Limpar para reimportar", (p, close) => {
    p.append(
      el(
        "p",
        "wait",
        "Isto APAGA alunos de verdade (com histórico e vendas). Use só para mandar as planilhas certas de novo. Antes, baixe a cópia de segurança em Ajustes."
      )
    );
    const sl = el("select");
    LISTAS.forEach(([c, n]) => {
      const o = el("option", null, n);
      o.value = c;
      sl.append(o);
    });
    sl.setAttribute("aria-label", "Qual lista");
    const anosBox = el("div", "quick");
    const info = el("p", "hint");
    const bk = el("label", "chk");
    const cb = el("input");
    cb.type = "checkbox";
    bk.append(cb, " Já baixei a cópia de segurança de hoje");
    const apagar = U.mkBtn("Apagar os anos marcados", "btn-danger", () => rodar());
    p.append(sl, anosBox, info, bk, apagar);
    const a = el("div", "panel-actions");
    a.append(el("span"), U.mkBtn("Fechar", "", close));
    a.firstChild.style.flex = "1";
    p.append(a);
    const lista = () => LISTAS.find(l => l[0] === sl.value);
    let contagem = {};
    async function contar() {
      anosBox.textContent = "";
      info.textContent = "Contando…";
      const [c, , m] = lista();
      const meta = (await FS.getDoc(FS.doc(db, "config", m))).data() || {};
      const anos = [
        ...new Set(Object.keys(meta.anos || {}).concat(Object.keys(meta.escolasAno || {}).map(k => k.slice(k.lastIndexOf("|") + 1))))
      ]
        .map(Number)
        .filter(Boolean)
        .sort((x, y) => y - x);
      const col = FS.collection(db, c);
      contagem = {};
      for (const ano of anos) contagem[ano] = (await FS.getCountFromServer(FS.query(col, FS.where("ano", "==", ano)))).data().count;
      const total = (await FS.getCountFromServer(col)).data().count;
      anos.forEach(ano => {
        const l = el("label", "chk");
        const x = el("input");
        x.type = "checkbox";
        x.value = String(ano);
        l.append(x, ` ${ano} (${contagem[ano]})`);
        anosBox.append(l);
      });
      const lt = el("label", "chk");
      const xt = el("input");
      xt.type = "checkbox";
      xt.value = "tudo";
      lt.append(xt, ` TUDO desta lista (${total}, inclusive sem ano)`);
      anosBox.append(lt);
      contagem.tudo = total;
      info.textContent = `${total} alunos nesta lista.`;
    }
    async function rodar() {
      if (!cb.checked) return U.toast("Marque que já baixou a cópia de segurança.");
      const marcados = [...anosBox.querySelectorAll("input:checked")].map(x => x.value);
      if (!marcados.length) return U.toast("Marque os anos (ou TUDO).");
      const tudo = marcados.includes("tudo");
      const anos = tudo ? [] : marcados.map(Number);
      const n = tudo ? contagem.tudo : anos.reduce((t, a0) => t + (contagem[a0] || 0), 0);
      const [c, nome, m] = lista();
      if (
        !(await confirmar(
          "Apagar de verdade?",
          `Apagar ${n} alunos de ${nome}${tudo ? " (TUDO)" : " de " + anos.join(", ")}? Isso não tem volta (só pela cópia de segurança).`,
          { perigo: true, sim: "Sim, apagar" }
        ))
      )
        return;
      apagar.disabled = true;
      let feitos = 0,
        gravacoes = 0,
        parou = false;
      try {
        const col = FS.collection(db, c);
        const filtros = tudo ? [[]] : anos.map(a0 => [FS.where("ano", "==", a0)]);
        const { entradasFones } = c === "repasse" ? await import("./pedidos.js") : {};
        for (const f of filtros) {
          for (;;) {
            if (gravacoes >= LIMITE_POR_VEZ) {
              parou = true;
              break;
            }
            const s0 = await FS.getDocs(FS.query(col, ...f, FS.limit(200)));
            if (!s0.size) break;
            const b = FS.writeBatch(db);
            let nb = 0;
            s0.docs.forEach(d => {
              if (entradasFones && !tudo)
                entradasFones(d.id, d.data()).forEach(([t]) => {
                  if (nb < 480) {
                    b.set(FS.doc(db, "fones", t), { alunos: { [d.id]: FS.deleteField() } }, { merge: true });
                    nb++;
                  }
                });
              b.delete(d.ref);
              nb++;
            });
            await b.commit();
            gravacoes += nb;
            feitos += s0.size;
            info.textContent = `Apagando… ${feitos} de ${n}`;
          }
          if (parou) break;
        }
        // PR inteiro: o índice de telefones também sai inteiro
        if (!parou && tudo && c === "repasse")
          for (;;) {
            const s0 = await FS.getDocs(FS.query(FS.collection(db, "fones"), FS.limit(400)));
            if (!s0.size || gravacoes >= LIMITE_POR_VEZ) break;
            const b = FS.writeBatch(db);
            s0.docs.forEach(d => b.delete(d.ref));
            await b.commit();
            gravacoes += s0.size;
          }
        const meta = (await FS.getDoc(FS.doc(db, "config", m))).data() || {};
        if (!parou) await FS.setDoc(FS.doc(db, "config", m), Object.assign({}, meta, metaSemAnos(meta, anos, tudo)));
        info.textContent = parou
          ? `Parei em ${feitos} de ${n} para não passar do limite grátis do Firebase. Continue amanhã (toque de novo nos mesmos anos).`
          : `Pronto: ${feitos} alunos apagados de ${nome}. Agora é só importar as planilhas certas.`;
        U.toast(parou ? "Limpeza parcial (limite do dia)" : "Limpeza feita ✅");
        if (!parou) contar();
      } catch (e) {
        C.handleErr(e);
      } finally {
        apagar.disabled = false;
      }
    }
    sl.onchange = () => contar().catch(e => C.handleErr(e));
    contar().catch(e => C.handleErr(e));
  });
}
