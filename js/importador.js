// Importação de planilha comum aos módulos (Regra 7): .xlsx ou .csv com as colunas em qualquer ordem; reconhece os
// cabeçalhos por nome e sinônimos e LEMBRA o mapeamento (config/importMapas); mostra a CONFERÊNCIA antes de gravar
// (colunas reconhecidas e não reconhecidas, que dá para ajustar na hora; linhas com campos faltando; duplicados);
// só grava depois do "Importar"; e cada importação pode ser DESFEITA (registro em "importacoes").
// Sem tela de módulo aqui: cada módulo passa a configuração (campos, como vira documento, onde grava).
import { el, sheet, sel, carregarLib } from "./ui.js";
import * as U from "./util.js";
import { confirmar } from "./confirmar.js";
import { lerCodigo, fmtCodigo, codigoBusca } from "./aluno-id.js";

export const chaveCab = h =>
  String(h || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
// Cabeçalho → campo: primeiro o mapeamento lembrado; depois nome e sinônimos (sem acento, sem espaço)
export function mapearColunas(cabecalho, campos, lembrado = {}) {
  const usados = new Set();
  return cabecalho.map(h => {
    const k = chaveCab(h);
    if (!k) return "";
    let c = lembrado[k];
    if (c === "_ignorar") return "";
    if (!c || !campos.some(f => f.k === c))
      c = (campos.find(f => [f.nome, f.k, ...(f.sinonimos || [])].some(s => chaveCab(s) === k)) || {}).k || "";
    if (c && usados.has(c)) return "";
    if (c) usados.add(c);
    return c;
  });
}
// a linha do cabeçalho: a que tem mais nomes conhecidos entre as 15 primeiras
export function acharCabecalho(linhas, campos) {
  let melhor = 0,
    idx = 0;
  linhas.slice(0, 15).forEach((r, i) => {
    const n = mapearColunas(r || [], campos).filter(Boolean).length;
    if (n > melhor) {
      melhor = n;
      idx = i;
    }
  });
  return idx;
}
// Status da planilha → status do app (ex.: "11 CAIDO" e "CAÍDO 03" → "Caído")
export function statusDaPlanilha(v) {
  const k = chaveCab(v).replace(/\d+/g, "");
  if (!k) return "";
  if (/^CA[IÍ]?DO$|^CAIDO/.test(k) || k.includes("CAIDO")) return "Caído";
  if (/VENDID|VENDA/.test(k)) return "Vendido";
  return String(v).trim();
}

// cfg = { modulo, titulo, col, campos: [{ k, nome, sinonimos, obrigatorio }], paraDoc(obj, extra) → doc,
//         chave(doc) → texto p/ achar duplicado, existentes: Set de chaves já no app, extra: {} (ex.: instituição e ano),
//         camposExtras(p) → função que lê os campos da tela (instituição, ano), antes de gravar }
export function abrirImportador(C, cfg) {
  sheet(
    cfg.titulo || "Importar planilha",
    (p, close) => {
      p.append(
        el(
          "p",
          "hint",
          "Escolha o arquivo (.xlsx ou .csv). As colunas podem estar em qualquer ordem: confira na próxima tela antes de gravar."
        ),
        U.mkBtn("⬇️ Baixar modelo em branco (.xlsx)", "btn-sm", () => baixarModelo(cfg).catch(e => C.handleErr(e)))
      );
      const extraBox = el("div");
      p.append(extraBox);
      const lerExtra = cfg.camposExtras ? cfg.camposExtras(extraBox) : () => ({});
      const inp = el("input");
      inp.type = "file";
      inp.accept = ".xlsx,.xls,.csv";
      const out = el("div", "imp");
      p.append(inp, out);
      inp.onchange = async () => {
        out.innerHTML = "";
        const f = inp.files[0];
        if (!f) return;
        try {
          const X = await carregarLib("xlsx");
          const wb = X.read(await f.arrayBuffer(), { type: "array", cellDates: true, codepage: 65001 });
          const linhas = X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "", raw: true });
          let lembrado = {};
          try {
            const m = await C.FS.getDoc(C.FS.doc(C.db, "config", "importMapas"));
            lembrado = (m.exists() && m.data()[cfg.modulo]) || {};
          } catch (_) {}
          conferir(C, cfg, out, linhas, lembrado, f.name, lerExtra, close);
        } catch (e) {
          out.append(el("p", "err", "Não consegui ler o arquivo: " + ((e && e.message) || e)));
        }
      };
    },
    { div: true, wide: true }
  );
}

function conferir(C, cfg, out, linhas, lembrado, arquivo, lerExtra, close) {
  const hi = acharCabecalho(linhas, cfg.campos);
  const cab = (linhas[hi] || []).map(h => String(h || "").trim());
  let mapa = mapearColunas(cab, cfg.campos, lembrado);
  const dados = linhas.slice(hi + 1).filter(r => (r || []).some(c => String(c ?? "").trim()));
  const tabela = el("div", "imp-cols");
  const resumo = el("div");
  const desenhar = () => {
    tabela.innerHTML = "";
    tabela.append(el("b", null, "Colunas da planilha → campo do app"));
    cab.forEach((h, i) => {
      if (!h) return;
      const s = sel([["", "— ignorar —"], ...cfg.campos.map(f => [f.k, f.nome])], mapa[i]);
      s.setAttribute("aria-label", "Campo para a coluna " + h);
      s.onchange = () => {
        mapa = mapa.map((m, j) => (j !== i && m === s.value && s.value ? "" : m));
        mapa[i] = s.value;
        desenhar();
      };
      const r = el("div", "prow " + (mapa[i] ? "" : "imp-nao"));
      r.append(el("span", null, (mapa[i] ? "✓ " : "? ") + h), s);
      tabela.append(r);
    });
    analisar();
  };
  let prontos = [];
  const analisar = () => {
    resumo.innerHTML = "";
    const objs = dados.map(r => {
      const o = {};
      mapa.forEach((k, i) => {
        if (k && o[k] == null) o[k] = r[i];
      });
      return o;
    });
    const faltaCampo = cfg.campos.filter(f => f.obrigatorio && !mapa.includes(f.k));
    const ext = lerExtra();
    const vistos = new Set();
    const erros = [],
      dup = [];
    prontos = [];
    objs.forEach((o, i) => {
      const d = cfg.paraDoc(o, ext);
      const falta = cfg.campos.filter(f => f.obrigatorio && !String(d[f.k] ?? o[f.k] ?? "").trim()).map(f => f.nome);
      if (d.__falta) falta.push(...d.__falta);
      delete d.__falta;
      const k = cfg.chave ? cfg.chave(d) : "";
      if (falta.length) return erros.push(`Linha ${hi + 2 + i}: falta ${falta.join(", ")}`);
      if (k && (vistos.has(k) || (cfg.existentes && cfg.existentes.has(k)))) return dup.push(`Linha ${hi + 2 + i}: ${d.nome || k}`);
      if (k) vistos.add(k);
      prontos.push(d);
    });
    if (faltaCampo.length)
      resumo.append(
        el("p", "err", "Coluna obrigatória não reconhecida: " + faltaCampo.map(f => f.nome).join(", ") + ". Escolha acima qual coluna é.")
      );
    resumo.append(
      el(
        "p",
        null,
        `${dados.length} linhas: ${prontos.length} prontas para gravar, ${erros.length} com campo faltando, ${dup.length} duplicadas (não entram).`
      )
    );
    const lista = (t, l) => {
      if (!l.length) return;
      const d = el("details", "notes");
      d.append(el("summary", null, `${t} (${l.length})`));
      l.slice(0, 200).forEach(x => d.append(el("div", null, x)));
      resumo.append(d);
    };
    lista("⚠️ Falta no cadastro", erros);
    lista("Duplicados", dup);
    ok.disabled = !prontos.length || !!faltaCampo.length;
  };
  const a = el("div", "panel-actions");
  const can = U.mkBtn("Cancelar", "", close);
  const ok = U.mkBtn("Importar", "btn-primary", async () => {
    if (
      !(await confirmar(
        "Gravar a importação?",
        `${prontos.length} registro${prontos.length === 1 ? "" : "s"} vão entrar em ${cfg.titulo || cfg.modulo}. Depois dá para desfazer esta importação.`
      ))
    )
      return;
    ok.disabled = true;
    try {
      const r = await gravar(C, cfg, prontos, arquivo, cab, mapa);
      out.innerHTML = "";
      out.append(
        el("p", null, `Pronto! ${r.n} registro${r.n === 1 ? "" : "s"} importado${r.n === 1 ? "" : "s"}.`),
        U.mkBtn("↩️ Desfazer esta importação", "btn-danger", () => desfazer(C, r.id).then(ok2 => ok2 && close()))
      );
    } catch (e) {
      ok.disabled = false;
      C.handleErr(e);
    }
  });
  a.append(el("span"), can, ok);
  a.firstChild.style.flex = "1";
  out.append(tabela, resumo, a);
  desenhar();
  // campos da tela (instituição, ano) mudam a análise
  out.closest(".panel").addEventListener("change", ev => {
    if (!tabela.contains(ev.target)) analisar();
  });
}

async function gravar(C, cfg, docs, arquivo, cab, mapa) {
  const { FS, db } = C;
  const imp = FS.doc(FS.collection(db, "importacoes"));
  const ids = [];
  const agora = new Date().toISOString();
  for (let i = 0; i < docs.length; i += 400) {
    const b = FS.writeBatch(db);
    docs.slice(i, i + 400).forEach(d => {
      const ref = FS.doc(FS.collection(db, cfg.col));
      ids.push(ref.id);
      b.set(ref, Object.assign({}, d, { importacao: imp.id, importadoEm: agora, criadoPor: C.me || "", criadoPorEmail: C.email || "" }));
    });
    await b.commit();
  }
  await FS.setDoc(imp, {
    modulo: cfg.modulo,
    col: cfg.col,
    ids: ids.slice(0, 5000),
    n: ids.length,
    arquivo,
    em: agora,
    por: C.me || "",
    porEmail: C.email || "",
    status: "ativa"
  });
  // lembra o mapeamento das colunas para a próxima vez
  try {
    const m = {};
    cab.forEach((h, i) => {
      const k = chaveCab(h);
      if (k) m[k] = mapa[i] || "_ignorar";
    });
    await FS.setDoc(FS.doc(db, "config", "importMapas"), { [cfg.modulo]: m }, { merge: true });
  } catch (_) {}
  return { id: imp.id, n: ids.length };
}
// Desfazer: apaga o que a importação criou (só o admin)
export async function desfazer(C, id) {
  const { FS, db } = C;
  const s = await FS.getDoc(FS.doc(db, "importacoes", id));
  if (!s.exists()) return false;
  const x = s.data();
  if (x.status === "desfeita") {
    U.toast("Esta importação já foi desfeita");
    return false;
  }
  if (
    !(await confirmar(
      "Desfazer a importação?",
      `Apaga os ${x.n} registros que entraram com “${x.arquivo || "a planilha"}”, mesmo os que já foram mexidos depois.`,
      { perigo: true }
    ))
  )
    return false;
  // PR: tira também os telefones desses alunos do índice "fones" (senão o app acharia "repetidos" que não existem);
  // PR, Paspatur e Formatura: a contagem de alunos por colégio e ano (lista de escolas) diminui junto
  const META = { repasse: "repasse_meta", paspatur: "paspatur_meta", formaturaAlunos: "formatura_meta" }[x.col];
  const { entradasFones } = x.col === "repasse" ? await import("./pedidos.js") : {};
  const menos = { escolas: {}, anos: {}, escolasAno: {} };
  const soma1 = (o, k) => k && (o[k] = (o[k] || 0) + 1);
  for (let i = 0; i < x.ids.length; i += 200) {
    const b = FS.writeBatch(db);
    for (const id0 of x.ids.slice(i, i + 200)) {
      if (META) {
        const d = await FS.getDoc(FS.doc(db, x.col, id0));
        if (d.exists()) {
          const v = d.data();
          if (entradasFones)
            entradasFones(id0, v).forEach(([t]) => b.set(FS.doc(db, "fones", t), { alunos: { [id0]: FS.deleteField() } }, { merge: true }));
          soma1(menos.escolas, v.escola);
          soma1(menos.anos, v.ano ? String(v.ano) : "");
          soma1(menos.escolasAno, v.escola && v.ano ? v.escola + "|" + v.ano : "");
        }
      }
      b.delete(FS.doc(db, x.col, id0));
    }
    await b.commit();
  }
  if (META) {
    const m = (await FS.getDoc(FS.doc(db, "config", META))).data() || {};
    const tira = (o, dm) => {
      const r = Object.assign({}, o || {});
      Object.entries(dm).forEach(([k, n]) => {
        r[k] = (Number(r[k]) || 0) - n;
        if (r[k] <= 0) delete r[k];
      });
      return r;
    };
    await FS.setDoc(
      FS.doc(db, "config", META),
      Object.assign({}, m, {
        escolas: tira(m.escolas, menos.escolas),
        anos: tira(m.anos, menos.anos),
        escolasAno: tira(m.escolasAno, menos.escolasAno)
      })
    );
  }
  await FS.updateDoc(FS.doc(db, "importacoes", id), { status: "desfeita", desfeitaEm: new Date().toISOString(), desfeitaPor: C.me || "" });
  U.toast("Importação desfeita");
  return true;
}
// Mudar o ano de uma importação (Formatura/Paspatur; só o admin): o ID do documento começa com 9999 - ano,
// então cada aluno é regravado com o ID do ano novo e o antigo é apagado. O código do aluno (26CJPI-100) troca o ano junto.
export const idComAno = (id, ano) => String(9999 - Number(ano)).padStart(4, "0") + String(id).slice(4);
export function docComAno(v, ano, agora = new Date()) {
  const x = lerCodigo(v.codigo);
  const codigo = x ? fmtCodigo(ano, x.sigla, x.n) : v.codigo || "";
  const out = Object.assign({}, v, { ano: Number(ano), codigo, codigoBusca: codigo ? codigoBusca(codigo) : "", atualizadoEm: agora.toISOString() });
  if (v.seg) out.seg = Number(ano) >= agora.getFullYear() ? "lf" : "rep";
  return out;
}
export async function mudarAno(C, id) {
  const { FS, db } = C;
  const s = await FS.getDoc(FS.doc(db, "importacoes", id));
  if (!s.exists()) return false;
  const x = s.data();
  if (x.col === "repasse") return U.toast("No PR use Desfazer e importe de novo"), false;
  const novo = Number(String(prompt(`Novo ano para os ${x.n} registros de “${x.arquivo || "a planilha"}”:`) || "").trim());
  if (!(novo >= 2000 && novo <= 2100)) return false;
  if (!(await confirmar("Mudar o ano?", `Os ${x.n} registros passam para ${novo}.`))) return false;
  const META = { paspatur: "paspatur_meta", formaturaAlunos: "formatura_meta" }[x.col];
  const delta = { anos: {}, escolasAno: {} };
  const soma = (o, k, n) => k && (o[k] = (o[k] || 0) + n);
  const novos = [];
  for (let i = 0; i < x.ids.length; i += 200) {
    const b = FS.writeBatch(db);
    for (const id0 of x.ids.slice(i, i + 200)) {
      const d = await FS.getDoc(FS.doc(db, x.col, id0));
      if (!d.exists()) continue;
      const v = d.data();
      const id1 = idComAno(id0, novo);
      novos.push(id1);
      if (id1 === id0) continue;
      b.set(FS.doc(db, x.col, id1), docComAno(v, novo));
      b.delete(FS.doc(db, x.col, id0));
      soma(delta.anos, v.ano ? String(v.ano) : "", -1);
      soma(delta.anos, String(novo), 1);
      if (v.escola) {
        soma(delta.escolasAno, v.ano ? v.escola + "|" + v.ano : "", -1);
        soma(delta.escolasAno, v.escola + "|" + novo, 1);
      }
    }
    await b.commit();
  }
  if (META) {
    const m = (await FS.getDoc(FS.doc(db, "config", META))).data() || {};
    const aplica = (o, dm) => {
      const r = Object.assign({}, o || {});
      Object.entries(dm).forEach(([k, n]) => {
        r[k] = (Number(r[k]) || 0) + n;
        if (r[k] <= 0) delete r[k];
      });
      return r;
    };
    await FS.setDoc(FS.doc(db, "config", META), Object.assign({}, m, { anos: aplica(m.anos, delta.anos), escolasAno: aplica(m.escolasAno, delta.escolasAno) }));
  }
  await FS.updateDoc(FS.doc(db, "importacoes", id), { ids: novos, n: novos.length, anoMudadoPara: novo, anoMudadoEm: new Date().toISOString() });
  U.toast(`Ano mudado para ${novo}`);
  return true;
}
// As últimas importações de um módulo, com o botão de desfazer
export async function ultimasImportacoes(C, modulo, box) {
  const { FS, db } = C;
  const s = await FS.getDocs(FS.query(FS.collection(db, "importacoes"), FS.where("modulo", "==", modulo), FS.limit(30)));
  const l = s.docs.map(d => Object.assign({ id: d.id }, d.data())).sort((a, b) => String(b.em).localeCompare(String(a.em)));
  box.innerHTML = "";
  if (!l.length) return box.append(el("p", "hint", "Nenhuma importação ainda."));
  l.slice(0, 10).forEach(x => {
    const r = el("div", "prow");
    r.append(
      el(
        "span",
        null,
        `${U.fmtDate(String(x.em).slice(0, 10))} · ${x.arquivo || ""} · ${x.n} registros${x.status === "desfeita" ? " (desfeita)" : ""}`
      )
    );
    if (x.status !== "desfeita")
      r.append(U.mkBtn("Desfazer", "btn-sm btn-danger", () => desfazer(C, x.id).then(() => ultimasImportacoes(C, modulo, box))));
    if (x.status !== "desfeita" && x.col && x.col !== "repasse")
      r.append(U.mkBtn("Mudar ano", "btn-sm", () => mudarAno(C, x.id).then(() => ultimasImportacoes(C, modulo, box))));
    box.append(r);
  });
}
// Modelo em branco: só o cabeçalho com os nomes dos campos
export async function baixarModelo(cfg) {
  const X = await carregarLib("xlsx");
  const ws = X.utils.aoa_to_sheet([cfg.campos.map(f => f.nome)]);
  const wb = X.utils.book_new();
  X.utils.book_append_sheet(wb, ws, "Planilha");
  X.writeFile(wb, `modelo-${cfg.modulo}.xlsx`);
}
