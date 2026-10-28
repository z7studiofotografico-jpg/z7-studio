// Histórico por ano (planilhas "PERCENTUAL PR" de cada ano): leitura e contas, sem tela.
// Cada planilha tem uma linha por colégio: INSTITUIÇÃO, ALUNOS, VENDAS, DEVOLUÇÃO, (ABERTO), TICKET, DINHEIRO,
// CARTÃO, BOLETO, VALOR ALUNO, TOTAL VENDAS e, em alguns anos, ALUGUEL DE BECA e uma coluna sem título com observação.
// Dinheiro guardado em centavos (como no resto do app). Testado em tests/historico-dados.test.mjs.
import { chave } from "./util.js";

const hk = h => chave(h).replace(/[^A-Z0-9]/g, "");
const COLS = {
  INSTITUICAO: "nome",
  COLEGIO: "nome",
  ESCOLA: "nome",
  ALUNOS: "alunos",
  VENDAS: "vendas",
  DEVOLUCAO: "devolucoes",
  DEVOLUCOES: "devolucoes",
  ABERTO: "aberto",
  DINHEIRO: "dinheiro",
  CARTAO: "cartao",
  BOLETO: "boleto",
  TOTALVENDAS: "total",
  ALUGUELDEBECA: "beca"
};
// número da planilha: aceita 1234.5, "1.234,50", "407,36", erros de fórmula (#DIV/0!, #REF!) e vazio
export function numero(v) {
  if (typeof v === "number") return isFinite(v) ? v : 0;
  let t = String(v == null ? "" : v)
    .replace(/[R$\s]/g, "")
    .trim();
  if (!t || t.startsWith("#")) return 0;
  if (/,\d{1,2}$/.test(t)) t = t.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, ""); // "1.234" = mil duzentos e trinta e quatro
  const n = Number(t.replace(/[^\d.-]/g, ""));
  return isFinite(n) ? n : 0;
}
const cent = v => Math.round(numero(v) * 100);

// "FORMATURA - C. E. JOAO PAULO II - 2025" → { nome: "C. E. JOAO PAULO II", tipo: "formatura", turma: 2025 }
export function limparNome(bruto) {
  let n = String(bruto || "")
    .replace(/\s+/g, " ")
    .trim();
  const tipo = /FORMATURA/i.test(n) ? "formatura" : "pr";
  const turma = Number((n.match(/(?:^|[\s-])(20\d\d)\s*$/) || [])[1]) || null;
  n = n
    .replace(/\(\s*FORMATURA\s*\)/gi, "")
    .replace(/^\s*(FORMATURA|PR)\b\s*-?\s*/i, "")
    .replace(/[\s-]+20\d\d\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
  return { nome: n, tipo, turma };
}

// Chave para achar o mesmo colégio em anos diferentes ("C.E JOÃO CARDOSO (NILOPOLIS)" = "JOAO CARDOSO")
export function chaveColegio(nome) {
  return chave(nome)
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .replace(
      /\b(COLEGIO ESTADUAL|COLEGIO|ESCOLA MUNICIPAL|ESCOLA ESTADUAL|ESCOLA|GET|PROFESSORA|PROFESSOR|PROF|DOUTOR|DR|SAO|DE|DA|DO|DAS|DOS|R LAGOS)\b/g,
      " "
    )
    .replace(/\b(C E M|C E|E E M|E E|E M|C M|CE|EE|EM|EEM)\b/g, " ")
    .replace(/\bCIEP\s*(\d+)\b.*/, "CIEP $1") // CIEP: o número basta
    .replace(/\s+/g, " ")
    .trim();
}
// Chave curta (1ª palavra + começo da 2ª): junta erros de digitação ("NUTA BARLET" = "NUTA BARTLET JAMES")
const chaveCurta = k => {
  const [a = "", b = ""] = k.split(" ");
  return a === "CIEP" ? k : a + " " + b.slice(0, 3);
};

// Lê a aba (linhas como vêm do sheet_to_json com header:1). ano = o ano da planilha (do nome do arquivo).
export function lerPercentual(linhas, ano) {
  const hi = linhas.findIndex(r => (r || []).some(c => COLS[hk(c)] === "nome"));
  if (hi < 0) throw new Error("Não achei a coluna INSTITUIÇÃO.");
  const cab = linhas[hi].map(h => COLS[hk(h)] || null);
  // coluna sem título depois das outras = observação (ex.: "407,36 DEVENDO FORMATURA")
  const ultima = cab.reduce((u, k, i) => (k ? i : u), -1);
  const obsIdx = linhas[hi].findIndex((h, i) => i > ultima && !String(h || "").trim());
  const colegios = [];
  let atualizadoEm = "";
  for (const r of linhas.slice(hi + 1)) {
    const cel = k => r[cab.indexOf(k)];
    const nomeBruto = String(cel("nome") || "").trim();
    const linhaTxt = (r || []).map(x => String(x || "")).join(" ");
    const m = linhaTxt.match(/ULTIMA ATUALIZA[ÇC][ÃA]O/i);
    if (m) {
      const d = (r || []).find(x => x instanceof Date || /\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4}/.test(String(x)));
      atualizadoEm = d instanceof Date ? d.toISOString().slice(0, 10) : String(d || "").slice(0, 10);
      continue;
    }
    if (!nomeBruto || /^TOTAL$/i.test(nomeBruto)) continue;
    const alunos = Math.round(numero(cel("alunos")));
    if (!alunos && !numero(cel("vendas")) && !numero(cel("total"))) continue;
    const { nome, tipo, turma } = limparNome(nomeBruto);
    const c = {
      nome,
      tipo,
      turma,
      chave: chaveColegio(nome),
      alunos,
      vendas: Math.round(numero(cel("vendas"))),
      devolucoes: Math.round(numero(cel("devolucoes"))),
      dinheiro: cent(cel("dinheiro")),
      cartao: cent(cel("cartao")),
      boleto: cent(cel("boleto")),
      total: cent(cel("total")),
      beca: cent(cel("beca"))
    };
    // TOTAL VENDAS vazio: soma das formas de pagamento
    if (!c.total) c.total = c.dinheiro + c.cartao + c.boleto;
    const obs = obsIdx >= 0 ? String(r[obsIdx] || "").trim() : "";
    if (obs) c.obs = obs;
    colegios.push(c);
  }
  return { ano: Number(ano), colegios, atualizadoEm };
}

// Ano da planilha: o do nome do arquivo ("2023 - PERCENTUAL PR.xlsx") ou o da aba ("ANO 2021")
export function anoDaPlanilha(nomeArquivo, abas) {
  const re = /(?<!\d)(20\d\d)(?!\d)/; // "2021_-_PERCENTUAL" também (o _ conta como letra para o \b)
  const m = String(nomeArquivo || "").match(re) || (abas || []).map(a => String(a).match(re)).find(Boolean);
  return m ? Number(m[1]) : null;
}

// Somas de uma lista de colégios (dinheiro em centavos)
export function somar(lista) {
  const t = { colegios: lista.length, alunos: 0, vendas: 0, devolucoes: 0, dinheiro: 0, cartao: 0, boleto: 0, total: 0, beca: 0 };
  lista.forEach(c => Object.keys(t).forEach(k => k !== "colegios" && (t[k] += Number(c[k]) || 0)));
  t.conversao = t.alunos ? t.vendas / t.alunos : 0;
  t.ticket = t.vendas ? Math.round(t.total / t.vendas) : 0;
  t.porAluno = t.alunos ? Math.round(t.total / t.alunos) : 0;
  return t;
}
export const resumoDoAno = h => ({
  ano: h.ano,
  geral: somar(h.colegios),
  pr: somar(h.colegios.filter(c => c.tipo === "pr")),
  formatura: somar(h.colegios.filter(c => c.tipo === "formatura"))
});

// O mesmo colégio em vários anos (só PR), para ver a tendência: [{ nome, anos: { 2021: {...}, 2022: {...} } }]
// Junta pela chave curta, menos quando o mesmo ano tem dois colégios diferentes com a mesma chave curta
// (ex.: "Santo Antônio" e "Santo Antônio de Pádua"): aí cada um fica com a chave completa.
export function colegiosNosAnos(historicos) {
  const conflito = new Set();
  historicos.forEach(h => {
    const vistos = new Map();
    h.colegios
      .filter(c => c.tipo === "pr" && c.chave)
      .forEach(c => {
        const k = chaveCurta(c.chave);
        if (vistos.has(k) && vistos.get(k) !== c.chave) conflito.add(k);
        vistos.set(k, c.chave);
      });
  });
  const m = new Map();
  historicos.forEach(h =>
    h.colegios
      .filter(c => c.tipo === "pr" && c.chave)
      .forEach(c => {
        const kc = chaveCurta(c.chave);
        const k = conflito.has(kc) ? c.chave : kc;
        const x = m.get(k) || { nome: c.nome, anoNome: h.ano, anos: {} };
        if (h.ano >= x.anoNome) Object.assign(x, { nome: c.nome, anoNome: h.ano }); // o nome mais recente
        const a = x.anos[h.ano] || { alunos: 0, vendas: 0, total: 0 };
        a.alunos += c.alunos;
        a.vendas += c.vendas;
        a.total += c.total;
        x.anos[h.ano] = a;
        m.set(k, x);
      })
  );
  return [...m.values()].filter(x => Object.keys(x.anos).length > 1).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

// Destaques automáticos do ano (frases curtas): melhor e pior conversão (colégios com 10+ alunos) e a variação
export function destaques(h, anterior) {
  const out = [];
  const ok = h.colegios.filter(c => c.alunos >= 10);
  const conv = c => c.vendas / c.alunos;
  const pc = v => Math.round(v * 100) + "%";
  if (ok.length) {
    const ord = ok.slice().sort((a, b) => conv(b) - conv(a));
    out.push(`Melhor conversão: ${ord[0].nome} (${pc(conv(ord[0]))}, ${ord[0].vendas} de ${ord[0].alunos}).`);
    const pior = ord[ord.length - 1];
    if (ord.length > 1) out.push(`Pior conversão: ${pior.nome} (${pc(conv(pior))}, ${pior.vendas} de ${pior.alunos}).`);
    const maior = ok.slice().sort((a, b) => b.alunos - b.vendas - (a.alunos - a.vendas))[0];
    out.push(
      `Mais alunos que não compraram: ${maior.nome} (${maior.alunos - maior.vendas} alunos). É onde o Repasse tem mais para buscar.`
    );
  }
  if (anterior) {
    const a = resumoDoAno(h).geral,
      b = resumoDoAno(anterior).geral;
    const dp = Math.round((a.conversao - b.conversao) * 100);
    out.push(
      `Conversão ${dp >= 0 ? "subiu" : "caiu"} ${Math.abs(dp)} ponto${Math.abs(dp) === 1 ? "" : "s"} em relação a ${anterior.ano} (${pc(b.conversao)} → ${pc(a.conversao)}).`
    );
    if (b.total) {
      const dv = Math.round(((a.total - b.total) / b.total) * 100);
      out.push(`Faturamento ${dv >= 0 ? "subiu" : "caiu"} ${Math.abs(dv)}% em relação a ${anterior.ano}.`);
    }
  }
  return out;
}
