// PR: importar a planilha de formandos (só admin). Os dados puros ficam em repasse-dados.js.
import { el, carregarLib } from "./ui.js";
import { MAPA, hkey, linhaParaDoc, docId, faltando, norm, semTelefone } from "./repasse-dados.js";
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

// turma = colégio · série (ex.: "E.E NUTA BARTLET JAMES · 9 ANO")
const turmaDe = r =>
  [r.escola, r.curso]
    .map(x => String(x || "").trim())
    .filter(Boolean)
    .join(" · ") || "(sem colégio)";
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
    const bloqueadas = new Set();
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
          const wb = X.read(await f.arrayBuffer(), { type: "array", cellDates: true, codepage: 65001 });
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
        el(
          "p",
          "hint",
          "Quais STATUS entram na fila do Repasse? Deixe marcado só quem NÃO comprou. Os desmarcados que já compraram (VENDIDO) entram só como histórico, para o Dashboard (fora de qualquer fila)."
        )
      );
      const box = el("div", "quick");
      Object.entries(porStatus)
        .sort((a, b) => b[1] - a[1])
        .forEach(([k, n]) => {
          const l = el("label", "chk");
          const c = el("input");
          c.type = "checkbox";
          // quem já comprou (VENDIDO, VENDIDO SITE, BRINDE…) vem desmarcado; CAÍDO, cancelado e vazio entram na fila
          c.checked = !/VENDID|BRINDE|ENTREGUE/.test(norm(k));
          c.value = k;
          l.append(c, document.createTextNode(` ${k} (${n})`));
          box.append(l);
        });
      out.append(box);
      // turmas (colégio · série): desmarcada = não entrar em contato (ex.: turma que pediu para não ser procurada)
      const porTurma = {};
      rows.forEach(r => {
        const k = turmaDe(r);
        porTurma[k] = (porTurma[k] || 0) + 1;
      });
      out.append(
        el("p", "hint", "Turmas que entram. Desmarque a turma que NÃO pode ser procurada de novo: os alunos dela ficam fora do app.")
      );
      const boxT = el("div", "quick turmas-imp");
      Object.entries(porTurma)
        .sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))
        .forEach(([k, n]) => {
          const l = el("label", "chk");
          const c = el("input");
          c.type = "checkbox";
          c.checked = !bloqueadas.has(k);
          c.dataset.turma = k;
          c.onchange = () => (c.checked ? bloqueadas.delete(k) : bloqueadas.add(k));
          l.append(c, document.createTextNode(` ${k} (${n})`));
          boxT.append(l);
        });
      out.append(boxT);
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
      const okStatus = new Set(
        [...out.querySelectorAll("input[type=checkbox]:not([data-turma])")].filter(c => c.checked).map(c => c.value)
      );
      // desmarcados que já compraram (VENDIDO…): entram como histórico (comprou naquele ano), fora das filas
      const comprou = r => /VENDID|BRINDE|ENTREGUE/.test(norm(r.statusOrig));
      // turma desmarcada não entra no app (alunos que não podem ser procurados de novo)
      const naTurma = rows.filter(r => !bloqueadas.has(turmaDe(r)));
      const fora = rows.length - naTurma.length;
      const sel = naTurma.filter(r => okStatus.has(r.statusOrig || "(vazio)") || comprou(r));
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
          atual = 0,
          historico = 0,
          semTel = 0;
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
          if (!okStatus.has(d.statusOrig || "(vazio)") && comprou(d)) {
            historico++;
            // histórico: comprou na época (sem data de pagamento no app, para não entrar nas vendas dos meses)
            return [
              id,
              Object.assign({}, d, {
                etapa: "ENTREGUE",
                historico: true,
                semTelefone: semTelefone(d),
                followup: null,
                conferido: true,
                valor: 0,
                resp: "",
                respEmail: "",
                importadoEm: agora,
                atualizadoEm: agora
              }),
              false
            ];
          }
          if (semTelefone(d)) {
            semTel++;
            // sem telefone: fora das filas e dos Incompletos; só conta no Dashboard (PR por ano das fotos)
            return [
              id,
              Object.assign({}, d, {
                etapa: "SEM TELEFONE",
                semTelefone: true,
                followup: null,
                resp: "",
                respEmail: "",
                importadoEm: agora,
                atualizadoEm: agora
              }),
              false
            ];
          }
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
        prog.textContent = `Pronto! ${novos - nInc - historico - semTel} novos na fila${nInc ? `, ${nInc} na aba Incompletos` : ""}${semTel ? `, ${semTel} sem telefone (só para o Dashboard)` : ""}${historico ? `, ${historico} que já compraram (só histórico, para o Dashboard)` : ""}${fora ? `, ${fora} de turma desmarcada ficaram fora do app` : ""}${atual ? ` e ${atual} atualizados` : ""}.`;
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
