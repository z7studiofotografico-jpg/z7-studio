// Venda Antecipada → "Importar planilha" (18/11/2026): a planilha do colégio como o estúdio já preenche
// (uma coluna por mês com o valor da parcela, OBS com pagou/atrasado/quitou). A leitura fica em
// va-importar-regras.js; aqui é a tela: escolher o colégio, ver o que entendi, gravar.
// Grava: cada aluno na Venda Antecipada (coleção "formandos", com as parcelas pagas pela OBS; sem kit = "ainda não
// comprou"). Quem não tem kit de fotos (só o Kit 01, ou nada) vai para a Linha de Frente ("formaturaAlunos"), para a venda depois das
// fotos — só quando mandar, pelo botão na turma (va-linha-frente.js). A gravação fica em "importacoes" (desfazer).
import { lerPlanilhaVA } from "./va-importar-regras.js";
import { kitsDe } from "./contrato.js";
import { brl, proxVenc } from "./regras.js";
import { el, sel, field, sheet, botoes, title, carregarLib } from "./ui.js";
import * as U from "./util.js";
import { codigoBusca, siglaDe } from "./aluno-id.js";

export async function abrirImportarVA(C, aoTerminar = () => {}) {
  const { FS, db } = C;
  const insts = (await FS.getDocs(FS.query(FS.collection(db, "instituicoes"), FS.limit(2000)))).docs
    .map(d => Object.assign({ id: d.id }, d.data()))
    .sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));
  sheet(
    "Importar planilha · Venda Antecipada",
    (p, close) => {
      p.append(
        el(
          "p",
          "hint",
          "A planilha do colégio, como vocês já preenchem: uma linha por aluno e uma coluna por mês (PG JUNHO, PG JULHO…) com o valor da parcela. O kit sai do total; o que já foi pago sai da OBS (Quitou = tudo; pagou = em dia até este mês; atrasado = falta a deste mês). Confira antes de gravar."
        )
      );
      const sInst = sel(
        insts.map(i => [i.id, `${title(i.nome)}${i.etapa === "FECHADO" ? "" : " · " + String(i.etapa || "").toLowerCase()}`]),
        "",
        "escolha o colégio"
      );
      sInst.setAttribute("aria-label", "Colégio");
      const ano = el("input");
      ano.inputMode = "numeric";
      ano.value = String(new Date().getFullYear());
      const file = el("input");
      file.type = "file";
      file.accept = ".xlsx,.xls,.csv";
      // o colégio sozinho na linha (o nome inteiro aparece); embaixo, o ano e o arquivo (18/11/2026)
      const r = el("div");
      const r2 = el("div", "row2");
      r2.append(field("Ano da formatura", ano), field("Planilha", file));
      r.append(field("Colégio", sInst), r2);
      const out = el("div", "va-imp");
      const fechar = el("label", "chk");
      const cbFechar = el("input");
      cbFechar.type = "checkbox";
      cbFechar.checked = true;
      fechar.append(cbFechar, document.createTextNode(" Marcar o colégio como Fechado (é o que faz a turma aparecer na Venda Antecipada)"));
      const a = botoes(close, "Importar");
      a.ok.disabled = true;
      const ant = el("details", "notes");
      ant.append(el("summary", null, "Importações anteriores (desfazer)"));
      const antBox = el("div");
      ant.append(antBox);
      ant.addEventListener("toggle", () => {
        if (ant.open) import("./importador.js").then(m => m.ultimasImportacoes(C, "vendaAntecipada", antBox)).catch(e => C.handleErr(e));
      });
      p.append(r, out, ant, a);
      let lido = null,
        cab = [],
        linhas = [];
      const inst = () => insts.find(i => i.id === sInst.value);
      const analisar = async () => {
        out.innerHTML = "";
        a.ok.disabled = true;
        lido = null;
        if (!cab.length) return;
        const i = inst();
        lido = lerPlanilhaVA(cab, linhas, {
          kits: kitsDe(C.P, i || {}),
          ano: Number(ano.value),
          hoje: U.todayStr(),
          sigla: i ? i.sigla || siglaDe(i.nome, []) : ""
        });
        if (!i && lido.escola) {
          const k = U.chave(lido.escola).replace(/[^A-Z0-9]/g, "");
          const ach = insts.find(x => {
            const n = U.chave(x.nome).replace(/[^A-Z0-9]/g, "");
            return n && (n.includes(k) || k.includes(n));
          });
          if (ach) {
            sInst.value = ach.id;
            return analisar();
          }
        }
        if (!i) return out.append(el("p", "err", "Escolha o colégio."));
        // quem já está na Venda Antecipada deste colégio não entra de novo (pelo ID ou pelo nome)
        const ja = (await FS.getDocs(FS.query(FS.collection(db, "formandos"), FS.where("instId", "==", i.id)))).docs.map(d => d.data());
        const jaTem = x => ja.some(f => (x.codigo && f.codigo === x.codigo) || U.chave(f.nome) === U.chave(x.nome));
        lido.alunos.forEach(x => (x.repetido = jaTem(x.comum)));
        const novos = lido.alunos.filter(x => !x.repetido);
        const conta = s => novos.filter(x => x.resumo.situacao === s).length;
        const kpi = (t, n) => {
          const b = el("div", "kpi");
          b.append(el("small", null, t), el("b", null, String(n)));
          return b;
        };
        const k = el("div", "kpis");
        k.append(
          kpi("Alunos na planilha", lido.alunos.length),
          kpi("Quitados", conta("quitado")),
          kpi("Em dia", conta("em dia")),
          kpi("Atrasados", conta("atrasado")),
          kpi("Para conferir", conta("conferir")),
          kpi("Sem kit de fotos", novos.filter(x => x.lf).length)
        );
        out.append(k);
        // por kit
        const porKit = {};
        novos.forEach(x => {
          const t = (porKit[x.resumo.kit] = porKit[x.resumo.kit] || { n: 0, v: 0 });
          t.n++;
          t.v += x.resumo.total;
        });
        out.append(
          el(
            "p",
            "hint",
            Object.entries(porKit)
              .map(([kk, t]) => `${kk}: ${t.n} (${brl(t.v)})`)
              .join(" · ")
          )
        );
        const rep = lido.alunos.length - novos.length;
        if (rep) out.append(el("p", "hint", `${rep} já estão na Venda Antecipada deste colégio e não entram de novo.`));
        // o que precisa de atenção
        const at = novos.filter(x => x.avisos.length);
        if (at.length) {
          const d = el("details");
          d.open = true;
          d.append(el("summary", null, `⚠️ Para conferir depois (${at.length}) · entram mesmo assim`));
          at.forEach(x =>
            d.append(el("div", "imp-erro", `Linha ${x.linha} · ${x.comum.codigo || ""} ${title(x.comum.nome)}: ${x.avisos.join("; ")}`))
          );
          out.append(d);
        }
        if (lido.ignorados.length)
          out.append(el("p", "hint", "Fora da importação: " + lido.ignorados.map(x => `${title(x.nome)} (${x.motivo})`).join(", ")));
        // a lista, para conferir aluno por aluno
        const lista = el("details");
        lista.append(el("summary", null, `Ver os ${novos.length} alunos`));
        const t = el("table", "rel-tabela");
        const th = el("tr");
        ["ID", "Aluno", "Turma", "Kit", "Pagas", "Total", "Situação", "Sem kit de fotos"].forEach(h => th.append(el("th", null, h)));
        t.append(th);
        novos.forEach(x => {
          const tr = el("tr");
          [
            x.comum.codigo,
            title(x.comum.nome),
            x.comum.sala,
            x.resumo.kit,
            x.resumo.parcelas ? `${x.resumo.pagas}/${x.resumo.parcelas}` : "—",
            x.resumo.total ? brl(x.resumo.total) : "—",
            x.resumo.situacao,
            x.lf ? "sim" : ""
          ].forEach(v => tr.append(el("td", null, v)));
          t.append(tr);
        });
        lista.append(t);
        out.append(lista);
        if (i.etapa !== "FECHADO") out.append(fechar);
        out.append(
          el(
            "p",
            "hint",
            "Quem não tem kit de fotos fica na Venda Antecipada; para a Linha de Frente vai só quando você mandar (botão na turma)."
          )
        );
        a.ok.disabled = !novos.length;
        a.ok.textContent = `Importar ${novos.length} aluno${novos.length === 1 ? "" : "s"}`;
      };
      file.onchange = async () => {
        out.textContent = "Lendo…";
        try {
          const XLSX = await carregarLib("xlsx");
          const wb = XLSX.read(await file.files[0].arrayBuffer(), { cellDates: true });
          const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "", raw: true });
          cab = (rows[0] || []).map(String);
          linhas = rows.slice(1);
          await analisar();
        } catch (e) {
          out.textContent = "Não consegui ler a planilha.";
          C.handleErr(e);
        }
      };
      sInst.addEventListener("change", analisar);
      ano.addEventListener("change", analisar);
      p.addEventListener("submit", async ev => {
        ev.preventDefault();
        if (!lido) return;
        const i = inst();
        const novos = lido.alunos.filter(x => !x.repetido);
        a.ok.disabled = true;
        try {
          const n = await gravarVA(C, i, Number(ano.value), novos, {
            fechar: i.etapa !== "FECHADO" && cbFechar.checked,
            arquivo: file.files[0] ? file.files[0].name : ""
          });
          close();
          U.toast(`${n.va} na Venda Antecipada`);
          aoTerminar();
        } catch (e) {
          a.ok.disabled = false;
          C.handleErr(e);
        }
      });
    },
    { wide: true }
  );
}

// grava em lotes (cada lote entra inteiro ou não entra) e deixa o registro para desfazer
export async function gravarVA(C, inst, ano, alunos, o) {
  const { FS, db } = C;
  const agora = new Date().toISOString();
  const hoje = U.todayStr();
  const imp = { va: FS.doc(FS.collection(db, "importacoes")) };
  const ids = { va: [] };
  const docs = [];
  alunos.forEach(x => {
    if (x.doc) {
      const d = Object.assign({}, x.doc, {
        codigoBusca: codigoBusca(x.doc.codigo),
        instId: inst.id,
        instNome: inst.nome,
        instTipo: inst.tipo || "",
        ano,
        resp: inst.resp || "",
        respEmail: inst.respEmail || "",
        vendidoEm: x.doc.primeiroVenc || hoje,
        criadoEm: agora,
        por: C.me || "",
        importacao: imp.va.id,
        importadoEm: agora
      });
      d.proxVenc = proxVenc(d);
      const ref = FS.doc(FS.collection(db, "formandos"));
      ids.va.push(ref.id);
      docs.push([ref, d]);
    }
  });
  for (let i = 0; i < docs.length; i += 400) {
    const b = FS.writeBatch(db);
    docs.slice(i, i + 400).forEach(([ref, d]) => b.set(ref, d, { merge: true }));
    await b.commit();
  }
  const reg = (col, modulo, lst) =>
    FS.setDoc(imp.va, {
      modulo,
      col,
      ids: lst,
      n: lst.length,
      arquivo: o.arquivo,
      em: agora,
      por: C.me || "",
      porEmail: C.email || "",
      status: "ativa"
    });
  if (ids.va.length) await reg("formandos", "vendaAntecipada", ids.va);
  if (o.fechar)
    await FS.updateDoc(FS.doc(db, "instituicoes", inst.id), {
      etapa: "FECHADO",
      contratoTurma: Object.assign({}, inst.contratoTurma || {}, {
        inicio:
          (inst.contratoTurma || {}).inicio ||
          alunos
            .map(x => x.doc && x.doc.primeiroVenc)
            .filter(Boolean)
            .sort()[0] ||
          ""
      }),
      atualizadoEm: agora
    });
  return { va: ids.va.length };
}
