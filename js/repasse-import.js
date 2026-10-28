// PR: importar a planilha de formandos (só admin). Os dados puros ficam em repasse-dados.js.
import { el, carregarLib } from "./ui.js";
import { MAPA, hkey, linhaParaDoc, docId, faltando, norm } from "./repasse-dados.js";
import * as U from "./util.js";
import { indexarFones } from "./pedidos.js";
let C, FS, db;
const loadXLSX = () => carregarLib("xlsx");

// Quais destes identificadores já estão no PR: consultas de 30 em 30 (limite do Firestore), 5 ao mesmo tempo
export async function jaExistem(FS, col, ids) {
  const grupos = [];
  for (let i = 0; i < ids.length; i += 30) grupos.push(ids.slice(i, i + 30));
  const achados = new Set();
  for (let i = 0; i < grupos.length; i += 5)
    await Promise.all(
      grupos
        .slice(i, i + 5)
        .map(async g => (await FS.getDocs(FS.query(col, FS.where(FS.documentId(), "in", g)))).docs.forEach(d => achados.add(d.id)))
    );
  return achados;
}

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
        "Escolha um ou vários arquivos Excel (.xlsx) ou CSV com as colunas da planilha de formandos (pode selecionar todas as planilhas de um ano de uma vez). Os dados vão direto do seu aparelho para o banco do app."
      )
    );
    const inp = el("input");
    inp.type = "file";
    inp.accept = ".xlsx,.xls,.csv";
    inp.multiple = true;
    p.append(field("Arquivos", inp));
    // Ano das fotos: vale para todos os alunos destes arquivos (nas planilhas antigas a DATA é a da venda)
    const anoIn = el("input");
    anoIn.type = "number";
    anoIn.min = "2015";
    anoIn.max = String(new Date().getFullYear() + 1);
    anoIn.placeholder = "ex.: 2021";
    const fAno = field("Ano das fotos (de todos os alunos destes arquivos)", anoIn);
    fAno.hidden = true;
    p.append(fAno);
    const out = el("div", "imp");
    p.append(out);
    const acts = actions(close, "Importar");
    const ok = acts.querySelector("button[type=submit]");
    ok.disabled = true;
    p.append(acts);
    let rows = [],
      brutos = [],
      X = null,
      porArquivo = [];
    inp.onchange = async () => {
      out.innerHTML = "";
      ok.disabled = true;
      rows = [];
      brutos = [];
      porArquivo = [];
      const fs = [...inp.files];
      if (!fs.length) return;
      out.append(el("p", "hint", "Lendo as planilhas…"));
      try {
        X = await loadXLSX();
        const foraDoPR = [];
        for (const f of fs) {
          // planilha com FORMATURA no nome é de colégio de formatura (vai em Formaturas, não no PR)
          if (/FORMATURA/i.test(norm(f.name))) {
            foraDoPR.push(f.name.replace(/\.(xlsx|xls|csv)$/i, ""));
            continue;
          }
          const wb = X.read(await f.arrayBuffer(), { type: "array", cellDates: true });
          const sh = wb.Sheets[wb.SheetNames[0]];
          const m = X.utils.sheet_to_json(sh, { header: 1, defval: "", raw: true });
          const hi = m.findIndex(r => r.some(c => hkey(c) === "FORMANDO"));
          if (hi < 0) throw new Error(`Não achei a coluna FORMANDO na primeira aba de “${f.name}”.`);
          const cols = m[hi].map(h => MAPA[hkey(h)] || null);
          let n = 0;
          for (const r of m.slice(hi + 1)) {
            const o = {};
            cols.forEach((k, i) => {
              if (k && o[k] == null) o[k] = r[i];
            });
            if (!String(o.nome || "").trim()) continue;
            brutos.push(o);
            n++;
          }
          porArquivo.push(`${f.name.replace(/\.(xlsx|xls|csv)$/i, "")}: ${n}`);
        }
        if (foraDoPR.length) porArquivo.push(`fora do PR por ser de formatura: ${foraDoPR.join(", ")}`);
        if (!brutos.length) throw new Error("Nenhuma planilha de PR (as de FORMATURA vão em Formaturas).");
        // ano sugerido: o que estiver no nome dos arquivos (ex.: "2021"); senão o mais comum nas datas
        const doNome = fs.map(f => (f.name.match(/\b(20[12]\d)\b/) || [])[1]).find(Boolean);
        if (!anoIn.value) {
          const cont = {};
          brutos.forEach(o => {
            const a = (linhaParaDoc(o, X).ano || "").toString();
            if (a) cont[a] = (cont[a] || 0) + 1;
          });
          anoIn.value = doNome || (Object.entries(cont).sort((a, b) => b[1] - a[1])[0] || [""])[0];
        }
        fAno.hidden = false;
        montar();
      } catch (e) {
        out.innerHTML = "";
        out.append(el("p", "err", "Não consegui ler o arquivo: " + (e.message || e)));
      }
    };
    anoIn.oninput = () => brutos.length && montar();
    function montar() {
      rows = brutos.map(o => linhaParaDoc(o, X, anoIn.value));
      out.innerHTML = "";
      if (porArquivo.length > 1) out.append(el("p", "hint", `${porArquivo.length} arquivos · ` + porArquivo.join(" · ")));
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
          // quem já comprou (VENDIDO, VENDIDO SITE…) vem desmarcado
          c.checked = temCaido ? /CAID/.test(norm(k)) : !/VENDID/.test(norm(k));
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
      ok.disabled = !rows.every(r => r.ano);
      if (ok.disabled) out.append(el("p", "err", "Coloque o ano das fotos acima."));
    }
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
        // Confere só os alunos desta planilha (de 30 em 30), e não o PR inteiro.
        const ids = new Set(),
          idDe = sel.map((d, i) => {
            let id = docId(d, i);
            while (ids.has(id)) id += "-" + i;
            ids.add(id);
            return id;
          });
        prog.textContent = "Conferindo quem já está no app…";
        const exist = await jaExistem(FS, col, idDe);
        const agora = new Date().toISOString();
        let novos = 0,
          atual = 0;
        const escolas = Object.assign({}, meta.escolas || {}),
          anos = Object.assign({}, meta.anos || {});
        const ops = sel.map((d, i) => {
          const id = idDe[i];
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
        // de 80 em 80 alunos: cada aluno grava 1 documento + até 4 telefones no índice (o lote do Firestore vai até 500)
        for (let i = 0; i < ops.length; i += 80) {
          const b = FS.writeBatch(db);
          ops.slice(i, i + 80).forEach(([id, data, merge]) => {
            if (merge) b.set(FS.doc(db, "repasse", id), data, { merge: true });
            else b.set(FS.doc(db, "repasse", id), data);
            indexarFones(FS, db, b, id, data);
          });
          await b.commit();
          prog.textContent = `Importando… ${Math.min(i + 80, ops.length)} de ${ops.length}`;
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
