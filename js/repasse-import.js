// PR: importar a planilha de formandos (só admin). Os dados puros ficam em repasse-dados.js.
import { el, carregarLib } from "./ui.js";
import { MAPA, hkey, linhaParaDoc, docId, faltando, norm } from "./repasse-dados.js";
import * as U from "./util.js";
let C, FS, db;
const loadXLSX = () => carregarLib("xlsx");

// ui = { sheet, field, actions, meta } (janelinhas do PR e escolas/anos já importados); aoTerminar() recarrega escolas e números
export function openImport(ctx, ui, aoTerminar) {
  C = ctx;
  FS = ctx.FS;
  db = ctx.db;
  const { sheet, field, actions, meta } = ui,
    col = FS.collection(db, "repasse");
  if (!C.isAdmin) return;
  sheet("Importar planilha", (p, close) => {
    p.append(
      el(
        "p",
        "hint",
        "Escolha o arquivo Excel (.xlsx) ou CSV com as colunas da planilha de formandos. Os dados vão direto do seu aparelho para o banco do app."
      )
    );
    const inp = el("input");
    inp.type = "file";
    inp.accept = ".xlsx,.xls,.csv";
    p.append(field("Arquivo", inp));
    const out = el("div", "imp");
    p.append(out);
    const acts = actions(close, "Importar");
    const ok = acts.querySelector("button[type=submit]");
    ok.disabled = true;
    p.append(acts);
    let rows = [];
    inp.onchange = async () => {
      out.innerHTML = "";
      ok.disabled = true;
      rows = [];
      const f = inp.files[0];
      if (!f) return;
      out.append(el("p", "hint", "Lendo a planilha…"));
      try {
        const X = await loadXLSX();
        const wb = X.read(await f.arrayBuffer(), { type: "array", cellDates: true });
        const sh = wb.Sheets[wb.SheetNames[0]];
        const m = X.utils.sheet_to_json(sh, { header: 1, defval: "", raw: true });
        const hi = m.findIndex(r => r.some(c => hkey(c) === "FORMANDO"));
        if (hi < 0) throw new Error("Não achei a coluna FORMANDO na primeira aba.");
        const cols = m[hi].map(h => MAPA[hkey(h)] || null);
        for (const r of m.slice(hi + 1)) {
          const o = {};
          cols.forEach((k, i) => {
            if (k && o[k] == null) o[k] = r[i];
          });
          if (!String(o.nome || "").trim()) continue;
          rows.push(linhaParaDoc(o, X));
        }
        out.innerHTML = "";
        const incompletos = rows.filter(r => faltando(r).length);
        out.append(
          el(
            "p",
            null,
            `${rows.length} formandos encontrados: ${rows.length - incompletos.length} completos e ${incompletos.length} incompletos.`
          )
        );
        if (incompletos.length) {
          const cont = {};
          incompletos.forEach(r =>
            faltando(r).forEach(f => {
              cont[f] = (cont[f] || 0) + 1;
            })
          );
          out.append(
            el(
              "p",
              "hint",
              "Os incompletos não entram na fila: ficam na aba Incompletos para vocês completarem. Falta " +
                Object.entries(cont)
                  .map(([f, n]) => `${f} em ${n}`)
                  .join(", ") +
                "."
            )
          );
        }
        const porStatus = {};
        rows.forEach(r => {
          const k = r.statusOrig || "(vazio)";
          porStatus[k] = (porStatus[k] || 0) + 1;
        });
        out.append(
          el("p", "hint", "Quais STATUS entram no Repasse? Deixe marcado só quem NÃO comprou (CAÍDO). Quem está como VENDIDO já tem o kit.")
        );
        const box = el("div", "quick");
        const temCaido = Object.keys(porStatus).some(k => /CA[IÍ]D/i.test(norm(k)));
        Object.entries(porStatus)
          .sort((a, b) => b[1] - a[1])
          .forEach(([k, n]) => {
            const l = el("label", "chk");
            const c = el("input");
            c.type = "checkbox";
            c.checked = temCaido ? /CAID/.test(norm(k)) : true;
            c.value = k;
            l.append(c, document.createTextNode(` ${k} (${n})`));
            box.append(l);
          });
        out.append(box);
        const porAno = {};
        rows.forEach(r => {
          const k = r.ano || "sem data";
          porAno[k] = (porAno[k] || 0) + 1;
        });
        out.append(
          el(
            "p",
            "hint",
            "Por ano: " +
              Object.entries(porAno)
                .sort()
                .reverse()
                .map(([a, n]) => `${a}: ${n}`)
                .join(" · ")
          )
        );
        ok.disabled = false;
      } catch (e) {
        out.innerHTML = "";
        out.append(el("p", "err", "Não consegui ler o arquivo: " + (e.message || e)));
      }
    };
    p.addEventListener("submit", async ev => {
      ev.preventDefault();
      if (!rows.length) return;
      const okStatus = new Set([...out.querySelectorAll("input[type=checkbox]")].filter(c => c.checked).map(c => c.value));
      const sel = rows.filter(r => okStatus.has(r.statusOrig || "(vazio)"));
      ok.disabled = true;
      inp.disabled = true;
      const prog = el("p", "hint", "Preparando…");
      out.append(prog);
      try {
        // Quem já existe mantém a etapa e o histórico; só os dados da planilha são atualizados.
        const exist = new Set();
        const cnt = await FS.getCountFromServer(col);
        if (cnt.data().count) {
          prog.textContent = "Conferindo quem já está no app…";
          (await FS.getDocs(col)).docs.forEach(d => exist.add(d.id));
        }
        const ids = new Set();
        const agora = new Date().toISOString();
        let novos = 0,
          atual = 0;
        const escolas = Object.assign({}, meta.escolas || {}),
          anos = Object.assign({}, meta.anos || {});
        const ops = sel.map((d, i) => {
          let id = docId(d, i);
          while (ids.has(id)) id += "-" + i;
          ids.add(id);
          if (exist.has(id)) {
            atual++;
            return [id, Object.assign({}, d, { atualizadoEm: agora }), true];
          }
          novos++;
          if (d.escola) escolas[d.escola] = (escolas[d.escola] || 0) + 1;
          if (d.ano) anos[d.ano] = (anos[d.ano] || 0) + 1;
          return [
            id,
            Object.assign({}, d, {
              etapa: faltando(d).length ? "INCOMPLETO" : "NA FILA",
              followup: null,
              tentativas: 0,
              tentInteresse: 0,
              resp: "",
              respEmail: "",
              importadoEm: agora,
              atualizadoEm: agora
            }),
            false
          ];
        });
        for (let i = 0; i < ops.length; i += 400) {
          const b = FS.writeBatch(db);
          ops
            .slice(i, i + 400)
            .forEach(([id, data, merge]) =>
              merge ? b.set(FS.doc(db, "repasse", id), data, { merge: true }) : b.set(FS.doc(db, "repasse", id), data)
            );
          await b.commit();
          prog.textContent = `Importando… ${Math.min(i + 400, ops.length)} de ${ops.length}`;
        }
        await FS.setDoc(FS.doc(db, "config", "repasse_meta"), { escolas, anos, importadoEm: agora }, { merge: true });
        const nInc = ops.filter(([, d, m]) => !m && d.etapa === "INCOMPLETO").length;
        prog.textContent = `Pronto! ${novos - nInc} novos na fila${nInc ? `, ${nInc} na aba Incompletos` : ""}${atual ? ` e ${atual} atualizados` : ""}.`;
        U.toast("Planilha importada ✅");
        aoTerminar();
        const fechar = U.mkBtn("Fechar", "btn-primary", close);
        out.append(fechar);
      } catch (e) {
        console.warn(e);
        prog.textContent = "";
        out.append(
          el(
            "p",
            "err",
            e.code === "permission-denied"
              ? "Só administradores podem importar."
              : "A importação parou no meio. Pode importar o mesmo arquivo de novo: quem já entrou não é duplicado."
          )
        );
        ok.disabled = false;
        inp.disabled = false;
      }
    });
  });
}
