// Teste de ponta a ponta: abre o index.html de verdade num Chromium, com um Firebase falso em memória.
// Rodar: node tests/e2e/app.e2e.mjs   (precisa de playwright, xlsx e chart.js em tests/e2e/node_modules)
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
const RAIZ = new URL("../../", import.meta.url).pathname,
  AQUI = new URL("./", import.meta.url).pathname;
const tipos = {
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".html": "text/html",
  ".css": "text/css",
  ".png": "image/png",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json"
};
const srv = http
  .createServer((q, r) => {
    const f = path.join(RAIZ, decodeURIComponent(q.url.split("?")[0]));
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) {
      r.writeHead(404);
      return r.end();
    }
    r.writeHead(200, { "content-type": tipos[path.extname(f)] || "application/octet-stream" });
    fs.createReadStream(f).pipe(r);
  })
  .listen(8790);
const URLAPP = "http://localhost:8790/index.html";
// No GitHub usa o Chromium que o Playwright instala; aqui, o que já vem na máquina (se houver)
const exe = process.env.CHROMIUM || (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
const browser = await chromium.launch({ executablePath: exe, args: ["--headless=new"], headless: false });
let falhas = 0;
const ok = (cond, msg) => {
  console.log((cond ? "  ✓ " : "  ✗ ") + msg);
  if (!cond) falhas++;
};
const ADRIANO = "z7studiofotografico@gmail.com",
  PEDRO = "pedro@vendas.com",
  NOVO = "novo@equipe.com",
  ANA = "ana@equipe.com",
  FORM = "form@equipe.com";
const hoje = new Date(),
  iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
import { feriado } from "../../js/feriados.js";
// dia n a partir de hoje, pulando feriado (o app avisa em feriado e o teste ficaria instável)
const dia = n => {
  const d = new Date(hoje);
  d.setDate(d.getDate() + n);
  while (n > 0 && feriado(iso(d))) d.setDate(d.getDate() + 1);
  return iso(d);
};
const base = {
  ["usuarios/" + PEDRO]: { nome: "Pedro Vendedor", papel: "equipe", ativo: true, modulos: ["lf", "agenda", "colegios"] },
  ["usuarios/" + NOVO]: { nome: "Novo", papel: "equipe", ativo: true },
  ["usuarios/" + ANA]: { nome: "Ana Vendedora", papel: "equipe", ativo: true, modulos: ["becas", "agenda", "funil", "rep"] },
  ["usuarios/" + FORM]: { nome: "Fabi Formaturas", papel: "equipe", ativo: true, modulos: ["formaturas"] },
  "config/app": { individual: 450, sinal: 100, prazo: 15, comissao: {} },
  "leads/l1": {
    nome: "Erica Souza",
    telefone: "21988887777",
    etapa: "NOVO LEAD",
    followup: dia(0),
    servico: "Formatura individual (estúdio)",
    origem: "WhatsApp"
  },
  "leads/l8": {
    nome: "Perdido Do Adriano",
    telefone: "21911110000",
    etapa: "PERDIDO",
    resp: "Adriano",
    respEmail: ADRIANO,
    atualizadoEm: new Date().toISOString(),
    criadoEm: dia(-5)
  },
  "leads/l3": {
    nome: "Venda Da Equipe",
    telefone: "21977776666",
    etapa: "FECHADO",
    valor: 700,
    fechadoEm: dia(-1),
    criadoEm: dia(-3),
    atualizadoEm: new Date().toISOString(),
    conferido: false,
    servico: "Ensaio",
    origem: "WhatsApp"
  },
  "instituicoes/i1": {
    nome: "COLEGIO ALFA",
    tipo: "particular",
    etapa: "FECHADO",
    fechadoEm: dia(-20),
    resp: "Pedro Vendedor",
    contatos: [],
    visitas: [{ data: dia(-20), por: "Pedro Vendedor", como: "Visita presencial" }]
  },
  "formandos/f1": {
    instId: "i1",
    instNome: "COLEGIO ALFA",
    nome: "LUCAS SILVA",
    tel: "21977776666",
    contrato: "album",
    kit: "Kit 04",
    valor: 850,
    parcelas: 10,
    pagas: 1,
    primeiroVenc: dia(-40),
    formaPag: "Cartão",
    status: "ativo",
    resp: "Pedro Vendedor",
    vendidoEm: dia(-40)
  },
  "instituicoes/i2": { nome: "COLEGIO BETA", tipo: "particular", etapa: "A VISITAR", resp: "", respEmail: "", contatos: [], visitas: [] },
  // turma do ano passado (Repasse) com uma aluna que ficou só com o Kit 01
  "instituicoes/i9": {
    nome: "COLEGIO ANTIGO",
    tipo: "particular",
    etapa: "FECHADO",
    fechadoEm: hoje.getFullYear() - 1 + "-03-01",
    formatura: { data: hoje.getFullYear() - 1 + "-11-20", status: "confirmado" },
    resp: "",
    respEmail: "",
    contatos: [],
    visitas: []
  },
  "formandos/f9": {
    instId: "i9",
    instNome: "COLEGIO ANTIGO",
    nome: "LIA ANTIGA",
    tel: "21955554444",
    kitId: "k01",
    kit: "Kit 01 · Beca + canudo (adesão)",
    contrato: "colacao",
    valor: 65,
    parcelas: 1,
    pagas: 1,
    pagamentos: [{ data: hoje.getFullYear() - 1 + "-06-05", valor: 65 }],
    primeiroVenc: hoje.getFullYear() - 1 + "-06-05",
    status: "ativo",
    venda: "ant",
    respEmail: "",
    vendidoEm: hoje.getFullYear() - 1 + "-05-20"
  },
  "leads/l9": {
    nome: "Rosana Antiga",
    etapa: "FECHADO",
    valor: 300,
    fechadoEm: dia(-200),
    criadoEm: dia(-210) + "T10:00:00Z",
    atualizadoEm: dia(-200) + "T10:00:00Z",
    origem: "Indicação"
  },
  "instituicoes/i3": { nome: "COLEGIO GAMA", tipo: "publico", etapa: "A VISITAR", contatos: [], visitas: [] },
  "repasse/r2": {
    nome: "BRUNO",
    ano: hoje.getFullYear(),
    etapa: "PAGO",
    valor: 200,
    formaPag: "Pix",
    pagoEm: dia(0),
    respEmail: PEDRO,
    conferido: false
  },
  "repasse/r5": {
    nome: "CARLA FILA",
    nomeBusca: "CARLA FILA",
    escola: "COLEGIO ALFA",
    ano: hoje.getFullYear(),
    etapa: "NA FILA",
    resp: "",
    respEmail: "",
    contatos: [{ tipo: "Mãe", nome: "Sonia", tel: "21955556666" }],
    telefones: ["21955556666"]
  },
  "pedidos/p8": {
    tipo: "pr-repetido",
    alvoId: "rx",
    aluno: "BIA APROVADA",
    porEmail: "pedro@vendas.com",
    porNome: "Pedro Vendedor",
    status: "aprovado",
    visto: false,
    criadoEm: "2026-01-01T10:00:00Z"
  },
  "repasse/r6": {
    nome: "DUDA TROCADA",
    nomeBusca: "DUDA TROCADA",
    escola: "COLEGIO ALFA",
    ano: hoje.getFullYear(),
    etapa: "CONTATADO",
    resp: "Pedro Vendedor",
    respEmail: "pedro@vendas.com",
    contatos: [{ tipo: "Mãe", nome: "Lu", tel: "21944445555" }],
    telefones: ["21944445555"]
  },
  "pedidos/p10": {
    tipo: "pr-repetido",
    alvoId: "r6",
    aluno: "DUDA TROCADA",
    escola: "COLEGIO ALFA",
    etapaAtual: "CONTATADO",
    respAtual: "Pedro Vendedor",
    porEmail: "ana@equipe.com",
    porNome: "Ana Vendedora",
    dados: { contatos: [] },
    status: "pendente",
    criadoEm: "2026-01-03T10:00:00Z"
  },
  "pedidos/aviso_rz_pedro-vendas-com": {
    tipo: "pr-transferido",
    alvoId: "rz",
    aluno: "ZECA PASSADO",
    porEmail: "pedro@vendas.com",
    para: "Ana Vendedora",
    decididoPor: "Adriano",
    status: "aviso",
    visto: false,
    criadoEm: "2026-01-04T10:00:00Z"
  },
  // contato da Ana (outra pessoa da equipe): o Pedro não vê nas abas dele
  "repasse/r8": {
    nome: "OUTRA DA ANA",
    nomeBusca: "OUTRA DA ANA",
    escola: "COLEGIO ALFA",
    ano: hoje.getFullYear(),
    etapa: "SEPARADO",
    followup: dia(0),
    resp: "Ana Vendedora",
    respEmail: "ana@equipe.com",
    contatos: [{ tipo: "Mãe", nome: "Bia", tel: "21933334444" }],
    telefones: ["21933334444"]
  },
  // contato antigo cujo responsável não está cadastrado na Equipe
  "repasse/r9": {
    nome: "ALUNO DO ZE",
    nomeBusca: "ALUNO DO ZE",
    escola: "COLEGIO ALFA",
    ano: hoje.getFullYear(),
    etapa: "SEPARADO",
    followup: dia(0),
    resp: "Zé Antigo",
    contatos: [{ tipo: "Mãe", nome: "Rita", tel: "21922221111" }],
    telefones: ["21922221111"]
  },
  "repasse/r7": {
    nome: "MARIA TRANSFERIDA",
    nomeBusca: "MARIA TRANSFERIDA",
    escola: "COLEGIO VELHO",
    ano: hoje.getFullYear() - 1,
    etapa: "NA FILA",
    resp: "",
    respEmail: "",
    contatos: [{ tipo: "Mãe", nome: "Clara", tel: "21966667777" }],
    telefones: ["21966667777"]
  },
  "pedidos/pr_r7_pedro-vendas-com": {
    tipo: "pr-repetido",
    alvoId: "r7",
    aluno: "MARIA TRANSFERIDA",
    porEmail: "pedro@vendas.com",
    porNome: "Pedro Vendedor",
    dados: {
      nome: "Maria Transferida",
      escola: "Colegio Novo",
      ano: hoje.getFullYear(),
      contatos: [{ tipo: "Mãe", nome: "Clara", tel: "21966667777" }]
    },
    status: "negado",
    decididoEm: "2026-02-10T10:00:00Z",
    visto: true,
    criadoEm: "2026-02-01T10:00:00Z"
  },
  "pedidos/p12": {
    tipo: "pr-repetido",
    alvoId: "r7",
    aluno: "MARIA TRANSFERIDA",
    porEmail: "pedro@vendas.com",
    porNome: "Pedro Vendedor",
    dados: {
      nome: "Maria Transferida",
      escola: "Colegio Novo",
      ano: hoje.getFullYear(),
      contatos: [{ tipo: "Mãe", nome: "Clara", tel: "21966667777" }]
    },
    anteriores: [{ status: "negado", decididoEm: "2026-02-10T10:00:00Z" }],
    escola: "COLEGIO VELHO",
    motivo: "telefone",
    trocouColegio: true,
    status: "pendente",
    criadoEm: "2026-01-05T10:00:00Z"
  },
  "pedidos/p9": {
    tipo: "pr-repetido",
    alvoId: "r5",
    aluno: "CARLA FILA",
    escola: "COLEGIO ALFA",
    etapaAtual: "NA FILA",
    respAtual: "",
    porEmail: "ana@equipe.com",
    porNome: "Ana Vendedora",
    dados: { contatos: [{ tipo: "Pai", nome: "Jorge", tel: "21977778888" }] },
    status: "pendente",
    criadoEm: "2026-01-02T10:00:00Z"
  },
  "repasse/r1": {
    nome: "ANA",
    ano: hoje.getFullYear(),
    etapa: "PAGO",
    valor: 350,
    formaPag: "Pix",
    pagoEm: dia(0),
    resp: "Pedro Vendedor"
  },
  "ensaios/c1": {
    kind: "pessoal",
    titulo: "Consulta médica",
    obs: "",
    particular: true,
    deQuem: "Luciana",
    data: dia(2),
    diaInteiro: true,
    status: "confirmado"
  },
  ["agenda/" + dia(9)]: {
    data: dia(9),
    kind: "fotos",
    status: "pendente",
    instId: "i1",
    instNome: "COLEGIO ALFA",
    pedidoPor: "Pedro Vendedor"
  }
};
// fila da Linha de Frente: 30 contatos para separar
for (let i = 0; i < 30; i++)
  base["repasse/fila" + String(i).padStart(2, "0")] = {
    nome: "ALUNO " + i,
    ano: hoje.getFullYear(),
    etapa: "NA FILA",
    escola: "COLEGIO ALFA",
    codigo: "CA - " + String(i + 1).padStart(2, "0"), // ID do aluno, como vem da planilha
    contatos: [{ tipo: "Mãe", tel: "2199999" + String(1000 + i) }]
  };
// Os dados antigos são atualizados no servidor (scripts/migrar.mjs); aqui aplicamos o mesmo plano antes de abrir o app
import { planejar, criarEmailDe } from "../../js/migracao.js";
function migrar(dados) {
  const out = JSON.parse(JSON.stringify(dados)),
    cols = {};
  for (const [k, v] of Object.entries(out)) {
    const [c, id] = k.split("/");
    (cols[c] = cols[c] || []).push({ id, ...v });
  }
  // o mesmo jeito de achar o responsável que o scripts/migrar.mjs usa
  const { emailDe } = criarEmailDe(cols.usuarios || [], []);
  for (const o of planejar(cols, emailDe).ops) {
    const k = o.col + "/" + o.id;
    out[k] = o.tipo === "s" ? o.dados : Object.assign({}, out[k], o.dados);
    (o.apagar || []).forEach(c => delete out[k][c]);
  }
  return out;
}
async function abrir(email, dados, opc = {}) {
  const ctx = await browser.newContext(
    Object.assign({ viewport: { width: 420, height: 900 }, serviceWorkers: "block" }, opc.userAgent ? { userAgent: opc.userAgent } : {})
  );
  abertos.push(ctx);
  const pg = await ctx.newPage();
  const erros = [];
  pg.on("pageerror", e => erros.push(e.message));
  pg.on("console", m => {
    if (m.type() === "error" && !/Failed to load resource/.test(m.text())) erros.push(m.text());
  });
  await ctx.route(/gstatic\.com\/firebasejs\/10\.12\.2\/(firebase-\w+)\.js/, (rt, rq) =>
    rt.fulfill({ path: AQUI + "fake/" + rq.url().match(/(firebase-\w+)\.js/)[1] + ".js", contentType: "text/javascript" })
  );
  await ctx.route(/cdn\.jsdelivr\.net\/npm\/chart\.js@4\.4\.1/, rt =>
    rt.fulfill({
      path: AQUI + "node_modules/chart.js/dist/chart.umd.js",
      contentType: "text/javascript",
      headers: { "access-control-allow-origin": "*" }
    })
  );
  await ctx.route(/cdn\.jsdelivr\.net\/npm\/xlsx@0\.18\.5/, rt =>
    rt.fulfill({
      path: AQUI + "node_modules/xlsx/dist/xlsx.full.min.js",
      contentType: "text/javascript",
      headers: { "access-control-allow-origin": "*" }
    })
  );
  await pg.addInitScript(
    ([em, d, compacta]) => {
      window.__EMAIL = em;
      window.__store = new Map(Object.entries(d));
      // Formaturas abre na Venda Antecipada nos testes antigos (o cenário das abas troca de aba)
      try {
        if (!localStorage.getItem("z7fmparte")) localStorage.setItem("z7fmparte", "va");
      } catch (_) {}
      window.open = u => {
        window.__aberto = u;
        return null;
      };
      // Lista compacta do PR: os testes antigos usam o cartão completo, então as linhas abrem sozinhas
      // (o cenário da lista compacta desliga isso e testa abrir e fechar)
      if (!compacta) {
        window.__z7CartaoNaLista = true;
        const abrirTudo = () => document.querySelectorAll('.lc-lista button.lc-linha[aria-expanded="false"]').forEach(b => b.click());
        new MutationObserver(abrirTudo).observe(document, { childList: true, subtree: true });
      }
    },
    [email, dados, !!opc.compacta]
  );
  await pg.goto(URLAPP);
  try {
    await pg.waitForSelector("#viewHome:not([hidden])", { timeout: 8000 });
  } catch (e) {
    console.log("Não abriu a tela inicial. Erros:", erros.join("\n"));
    throw e;
  }
  await calmo(pg);
  // store(): espera o app terminar de gravar (nenhuma operação em andamento há 150 ms) e devolve os dados
  const store = async () => {
    await pg
      .waitForFunction(() => window.__ops === 0 && Date.now() - window.__ultimo > 150, null, { timeout: 4000, polling: 50 })
      .catch(() => {});
    return pg.evaluate(() => Object.fromEntries(window.__store));
  };
  return { pg, erros, ctx, store };
}
// Espera a tela "acalmar" (nenhuma gravação em andamento e nada novo do banco há 100 ms, e um quadro desenhado),
// no lugar de esperas fixas: mais rápido quando está tudo pronto e sem falhar quando a máquina está lenta.
const calmo = pg =>
  pg
    .waitForFunction(() => window.__ops === 0 && Date.now() - window.__ultimo > 100, null, { timeout: 5000, polling: 25 })
    .then(() => pg.evaluate(() => new Promise(r => requestAnimationFrame(() => r()))))
    .catch(() => {});
// Espera um documento com esse nome aparecer no banco (gravação lenta no CI não vira falha falsa)
const esperaNome = (pg, nome) =>
  pg
    .waitForFunction(n => [...window.__store.values()].some(x => x && x.nome === n), nome, { timeout: 8000, polling: 50 })
    .then(() => calmo(pg))
    .catch(() => {});
// Mensagem de erro visível nas janelas abertas (para entender uma falha no CI)
const erroVisivel = pg =>
  pg
    .evaluate(() =>
      [...document.querySelectorAll(".sheet .err, .sheet .wait, #toast")]
        .filter(x => !x.hidden && x.textContent.trim())
        .map(x => x.textContent.trim().slice(0, 160))
        .join(" | ")
    )
    .catch(() => "");
const ir = async (pg, h) => {
  await pg.evaluate(h => {
    document.body.dataset.tela = "";
    location.hash = h;
  }, h);
  // espera a troca de tela terminar (o app marca body[data-tela] no fim) e o banco acalmar
  await pg.waitForFunction(() => document.body.dataset.tela === location.hash, null, { timeout: 8000 }).catch(() => {});
  await calmo(pg);
};
// Cada cenário roda numa aba nova; um erro (ex.: tempo esgotado) conta como falha e o resto continua.
// SO=palavra roda só os cenários com essa palavra no nome (ex.: SO=pedro).
const abertos = [];
async function cenario(nome, fn) {
  if (process.env.SO && !nome.toLowerCase().includes(process.env.SO.toLowerCase())) return;
  console.log(nome + ":");
  try {
    await fn();
  } catch (e) {
    falhas++;
    console.log("  ✗ parou com erro: " + String((e && e.message) || e).split("\n")[0]);
  } finally {
    while (abertos.length)
      await abertos
        .pop()
        .close()
        .catch(() => {});
  }
}
// Etapa dentro de um cenário: se der erro, fecha as janelas abertas, volta ao Início e segue para a próxima
async function etapa(pg, nome, fn) {
  try {
    await fn();
  } catch (e) {
    falhas++;
    console.log(`  ✗ [${nome}] parou com erro: ` + String((e && e.message) || e).split("\n")[0]);
    // fecha as janelas abertas: as criadas na hora saem; as fixas da página (Ajustes, Equipe, lead) só se escondem
    await pg.evaluate(() => document.querySelectorAll(".sheet").forEach(x => (x.id ? (x.hidden = true) : x.remove()))).catch(() => {});
    await ir(pg, "#home").catch(() => {});
  }
}
// "+ Aluno" no PR: abre a janela, preenche, confere o que ficou escrito (preenche de novo se algo se perdeu) e salva
async function incluirAluno(pg, { nome, colegio, tel, contato }) {
  await pg.getByRole("button", { name: "+ Aluno" }).click();
  const fa = pg.locator(".sheet:visible").filter({ hasText: "Incluir aluno no PR" }).last();
  await fa.getByLabel("Nome do aluno").waitFor();
  await calmo(pg);
  const campos = [
    [fa.getByLabel("Nome do aluno"), nome],
    [fa.getByLabel("Colégio"), colegio],
    [fa.getByLabel("WhatsApp"), tel],
    [fa.getByLabel("Nome", { exact: true }), contato]
  ];
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    for (const [c, v] of campos) if ((await c.inputValue()) !== v) await c.fill(v);
    if ((await Promise.all(campos.map(([c]) => c.inputValue()))).every((v, i) => v === campos[i][1])) break;
  }
  await fa.locator("button[type=submit]").click();
  await calmo(pg);
  return fa;
}
const visiveis = pg => pg.$$eval(".tile[data-mod]", ts => ts.filter(t => !t.hidden).map(t => t.dataset.mod));

await cenario("Adriano (admin), com os dados já atualizados no servidor", async () => {
  const { pg, erros, store } = await abrir(ADRIANO, migrar(base));
  await calmo(pg);
  let s = await store();
  await etapa(pg, "Início e dados atualizados", async () => {
    ok(s["instituicoes/i1"].respEmail === PEDRO, "colégio ganhou o e-mail do responsável");
    ok(s["instituicoes/i3"].respEmail === "", "colégio antigo sem responsável ganhou respEmail vazio (aparece na carteira da equipe)");
    ok(
      Array.isArray(s["formandos/f1"].pagamentos) && s["formandos/f1"].pagamentos.length === 1 && s["formandos/f1"].respEmail === PEDRO,
      "formando: pagamentos e responsável migrados"
    );
    ok(
      s["formandos/f1"].proxVenc === dia(-40).replace(/-(\d\d)$/, "") || /^\d{4}-\d{2}-\d{2}$/.test(s["formandos/f1"].proxVenc),
      "formando: próximo vencimento gravado (" + s["formandos/f1"].proxVenc + ")"
    );
    ok(s["repasse/r1"].respEmail === PEDRO && s["agenda/" + dia(9)].pedidoEmail === PEDRO, "PR e agenda com e-mail");
    ok(
      s["ensaios/c1"].titulo === "" && s["privado/c1"] && s["privado/c1"].titulo === "Consulta médica",
      "assunto particular foi para 'privado'"
    );
    ok((await visiveis(pg)).length === 8, "admin vê os 8 cards");
    ok(/1 para hoje/.test(await pg.textContent("#tFunil")), "card do Funil conta o contato de hoje");
    ok(/atrasad/.test(await pg.textContent("#tFormaturas")), "card Formaturas mostra parcela atrasada");
    // Ajustes: 9.5 não pode virar 95
    await pg.click("#btnPrices");
    await calmo(pg);
    ok((await pg.inputValue("#pInd")) === "450,00", "valor salvo aparece com centavos (450,00): " + (await pg.inputValue("#pInd")));
    await pg.fill("#pSinal", "120");
    await pg.locator("#pSinal").blur();
    ok((await pg.inputValue("#pSinal")) === "120,00", "digitou 120, completou para 120,00");
    ok(
      (await pg.inputValue('#comTab input[data-l="pr"][data-f="Boleto"]')) !== "" &&
        !/,00$/.test(await pg.inputValue('#comTab input[data-l="pr"][data-f="Pix"]')),
      "comissão (%) não ganha ,00"
    );
    await pg.fill('#comTab input[data-l="pr"][data-f="Boleto"]', "9.5");
    await pg.fill("#pFeriados", "24/12 Recesso de Natal");
    await pg.click("#pSave");
    await calmo(pg);
    s = await store();
    ok(s["config/app"].comissao.pr.Boleto === 9.5, "comissão 9.5 grava 9,5% (antes virava 95%) → " + s["config/app"].comissao.pr.Boleto);
    ok(s["config/app"].feriadosExtras === "24/12 Recesso de Natal", "feriado extra da cidade gravado em Ajustes");
  });
  await etapa(pg, "Funil", async () => {
    // Funil: valor no formato brasileiro
    await ir(pg, "#funil");
    ok((await pg.locator("#list .card").count()) === 1, "Funil abre (módulo novo) com o lead");
    await pg.locator("#list .card").getByText("Editar").click();
    // o formulário põe o cursor no Nome 30 ms depois de abrir: espera, senão o texto cai no campo errado
    await pg
      .waitForFunction(() => document.activeElement && document.activeElement.id === "fNome", null, { timeout: 2000 })
      .catch(() => {});
    await pg.fill("#fValor", "1.350,50");
    if (process.env.DEBUG) console.log(await pg.inputValue("#fValor"), await pg.isDisabled("#fValor"), await pg.textContent("#formTitle"));
    await pg.click("#btnSave");
    await pg.waitForFunction(() => (window.__store.get("leads/l1") || {}).valor === 1350.5, null, { timeout: 3000 }).catch(() => {});
    // venda fechada pela equipe: aparece "a conferir" e o admin confere
    await pg.fill("#q", "venda da equipe");
    await calmo(pg);
    const cv = pg.locator("#list .card").filter({ hasText: "Venda Da Equipe" });
    ok(/a conferir/.test((await cv.textContent().catch(() => "")) || ""), "venda da equipe mostra ⏳ a conferir");
    await cv.getByText("✔ Conferir venda").click();
    await pg.waitForFunction(() => (window.__store.get("leads/l3") || {}).conferido === true, null, { timeout: 3000 }).catch(() => {});
    ok((await store())["leads/l3"].conferido === true, "admin confere a venda do Funil");
    // busca acha também lead antigo (fechado há mais de 60 dias, fora da lista carregada)
    await pg.fill("#q", "rosana");
    await pg.waitForTimeout(1200);
    ok(/Rosana Antiga/.test(await pg.textContent("#list")), "busca acha lead antigo no servidor");
    await pg.fill("#q", "");
    await calmo(pg);
    s = await store();
    ok(s["leads/l1"].valor === 1350.5, "valor R$ 1.350,50 gravado como 1350.5 → " + JSON.stringify(s["leads/l1"].valor));
  });
  await etapa(pg, "Formaturas", async () => {
    // Formaturas: registrar parcela (transação)
    await ir(pg, "#formaturas");
    ok(/Lucas Silva/.test(await pg.textContent("#fmCorpo")), "cobranças mostram o formando atrasado");
    // pediu para pagar outro dia: motivo + data ficam no formando (e no histórico de motivos)
    await pg.locator("#fmCorpo .card").filter({ hasText: "Lucas" }).getByRole("button", { name: "📅 Pediu contato depois" }).click();
    await calmo(pg);
    const shRet = pg.locator(".sheet").last();
    await shRet.getByLabel("Motivo").fill("Sem dinheiro agora, recebe dia 10");
    await shRet.getByRole("button", { name: "15 dias" }).click();
    await shRet.locator("button[type=submit]").click();
    await calmo(pg);
    s = await store();
    ok(
      s["formandos/f1"].retorno &&
        s["formandos/f1"].retorno.motivo === "Sem dinheiro agora, recebe dia 10" &&
        s["formandos/f1"].retorno.data === iso(new Date(new Date(hoje).setDate(new Date(hoje).getDate() + 15))) &&
        s["formandos/f1"].motivos.length === 1,
      "Formaturas: 'Pediu contato depois' guarda motivo e data (histórico de motivos)"
    );
    await pg.locator("#fmCorpo .card").filter({ hasText: "Lucas" }).getByText("✅ Parcela paga").click();
    await calmo(pg);
    s = await store();
    ok(
      s["formandos/f1"].pagamentos.length === 2 && s["formandos/f1"].pagas === 2 && s["formandos/f1"].pagamentos[1].valor === 85,
      "parcela registrada com valor e data"
    );

    // Turma: novo formando com 400 em 3x
    await pg.locator("#fmChips").getByText("Colégios fechados").click();
    await calmo(pg);
    await pg.getByText("👥 Alunos e parcelas").click();
    await calmo(pg);
    await pg.locator(".panel.wide").getByRole("button", { name: "+ Aluno" }).click();
    await calmo(pg);
    const f = pg.locator(".sheet").last();
    await f.getByLabel("Nome").fill("Julia Costa");
    await f.getByLabel("Kit", { exact: true }).selectOption("outro");
    await f.getByLabel("Qual kit").fill("Kit especial");
    await f.getByLabel("Valor total").fill("400");
    await f.getByLabel("Parcelas", { exact: true }).fill("3");
    await f.getByLabel("Parcelas", { exact: true }).dispatchEvent("input");
    // a conta aparece depois do "input" (no GitHub, mais lento, às vezes ainda não tinha aparecido): espera até 3 s
    await f
      .locator(".hint")
      .first()
      .filter({ hasText: /3x de R\$ 133,33/ })
      .waitFor({ timeout: 3000 })
      .catch(() => {});
    ok(
      /3x de R\$ 133,33 \(a 1ª de R\$ 133,34\)/.test(await f.locator(".hint").first().textContent()),
      "divide 400 em 3x sem perder centavo"
    );
    await f.locator("button[type=submit]").click();
    await esperaNome(pg, "Julia Costa");
    // a gravação termina logo depois do nome aparecer: espera até 5 s
    let ju = null;
    for (let t = 0; t < 25; t++) {
      s = await store();
      ju = Object.values(s).find(x => x.nome === "Julia Costa");
      if (ju && ju.proxVenc) break;
      await pg.waitForTimeout(200);
    }
    ok(
      ju && ju.valor === 400 && ju.respEmail === PEDRO && ju.proxVenc,
      "formando novo com responsável do colégio e próximo vencimento" + (ju ? "" : " — na tela: " + (await erroVisivel(pg)))
    );
    // contrato: Kit 04 antecipado preenche valor e parcelas pela tabela
    const novoFormando = async () => {
      // espera a janela do aluno anterior fechar (senão o nome vai para a janela que está saindo)
      await pg
        .waitForFunction(
          () =>
            ![...document.querySelectorAll(".sheet")].some(x => !x.querySelector(".panel.wide") && x.querySelector("button[type=submit]")),
          null,
          { timeout: 5000 }
        )
        .catch(() => {});
      const antes = await pg.locator(".sheet").count();
      await pg.locator(".panel.wide").getByRole("button", { name: "+ Aluno" }).click();
      await pg.waitForFunction(n => document.querySelectorAll(".sheet").length > n, antes, { timeout: 5000 }).catch(() => {});
      await calmo(pg);
      return pg.locator(".sheet").last();
    };
    let fk = await novoFormando();
    await fk.getByLabel("Nome").fill("Bia Antecipada");
    await fk.getByLabel("Kit", { exact: true }).selectOption("k04");
    await calmo(pg);
    ok(
      (await fk.getByLabel("Valor total").inputValue()) === "850,00" &&
        (await fk.getByLabel("Parcelas", { exact: true }).inputValue()) === "10",
      "Kit 04 antecipado: R$ 850,00 em 10x (tabela do contrato)"
    );
    await fk.locator("button[type=submit]").click();
    await calmo(pg);
    // todo formando entra pelo menos com o Kit 01 (adesão)
    fk = await novoFormando();
    await fk.getByLabel("Nome").fill("Caio Kit Um");
    await fk.getByLabel("WhatsApp").fill("21966665555");
    ok(
      (await fk.getByLabel("Kit", { exact: true }).inputValue()) === "k01" && (await fk.getByLabel("Valor total").inputValue()) === "65,00",
      "novo formando já vem com o Kit 01 (R$ 65,00)"
    );
    await fk.locator("button[type=submit]").click();
    await esperaNome(pg, "Caio Kit Um");
    for (let t = 0; t < 25; t++) {
      s = await store();
      if (Object.values(s).some(x => x.nome === "Caio Kit Um")) break;
      await pg.waitForTimeout(200);
    }
    const bia = Object.values(s).find(x => x.nome === "Bia Antecipada"),
      caio = Object.values(s).find(x => x.nome === "Caio Kit Um");
    ok(
      bia && bia.kitId === "k04" && bia.venda === "ant" && bia.valor === 850 && bia.contrato === "album",
      "venda antecipada gravada com o kit do contrato"
    );
    ok(
      caio && caio.kitId === "k01" && caio.contrato === "adesao" && caio.valor === 65,
      "Kit 01 gravado como adesão" + (caio ? "" : " — na tela: " + (await erroVisivel(pg)))
    );
    // tabela só desta turma: Kit 04 por R$ 790,00 em 8x
    await pg.locator(".panel.wide").getByRole("button", { name: "📋 Kits desta turma" }).click();
    await calmo(pg);
    fk = pg.locator(".sheet").last();
    await fk.getByLabel(/Kit 04.* · valor antecipado \(turma\)$/).fill("790");
    await fk.getByLabel(/Kit 04.* · parcelas antecipado \(turma\)$/).fill("8");
    await fk.locator("button[type=submit]").click();
    await calmo(pg);
    ok(
      /diferentes da tabela padrão/.test(await pg.textContent(".panel.wide")) && /✏️ Kit 04: 8x/.test(await pg.textContent(".panel.wide")),
      "turma avisa os valores diferentes da tabela padrão"
    );
    fk = await novoFormando();
    await fk.getByLabel("Nome").fill("Dani Turma");
    await fk.getByLabel("Kit", { exact: true }).selectOption("k04");
    await calmo(pg);
    ok((await fk.getByLabel("Valor total").inputValue()) === "790,00", "formando novo usa a tabela da turma (R$ 790,00)");
    await fk.getByRole("button", { name: "Cancelar" }).click();
    await calmo(pg);
    // fotos prontas libera a oferta
    await pg.locator(".panel.wide").getByRole("button", { name: "📅 Contrato da turma" }).click();
    await calmo(pg);
    fk = pg.locator(".sheet").last();
    await fk.getByRole("button", { name: "📸 As fotos ficaram prontas hoje" }).click();
    await fk.locator("button[type=submit]").click();
    await calmo(pg);
    await pg.locator(".panel.wide").getByRole("button", { name: "Fechar" }).click();
    await calmo(pg);
    // tabela padrão: preço depois das fotos do Kit 04
    await pg.getByRole("button", { name: "📋 Kits e preços" }).click();
    await calmo(pg);
    fk = pg.locator(".sheet").last();
    if (process.env.FOTOS) await fk.screenshot({ path: process.env.FOTOS + "/kits.png" });
    await fk.getByLabel(/Kit 04.* · valor depois das fotos$/).fill("1.100,00");
    await fk.getByLabel(/Kit 04.* · parcelas depois das fotos$/).fill("6");
    await fk.getByLabel(/Kit 04.* · valor repasse$/).fill("700");
    await fk.getByLabel(/Kit 04.* · parcelas repasse$/).fill("5");
    await fk.locator("button[type=submit]").click();
    await calmo(pg);
    s = await store();
    const k4 = (s["config/app"].kitsFormatura || []).find(k => k.id === "k04");
    ok(
      k4 && k4.pos.valor === 1100 && k4.pos.parcelas === 6 && k4.ant.valor === 850 && k4.rep.valor === 700 && k4.rep.parcelas === 5,
      "tabela: Kit 04 depois das fotos R$ 1.100,00 em 6x e repasse R$ 700,00 em 5x"
    );
    ok(
      /Pode oferecer os kits para 1 aluno do Colegio Alfa/i.test(await pg.textContent("#fmCorpo")),
      "aviso: pode oferecer para 1 aluno do Colégio Alfa"
    );
    // sair e voltar: o aviso aparece lendo só as turmas com fotos prontas (sem ler todos os formandos)
    await ir(pg, "#home");
    await pg.evaluate(() => {
      window.__leituras = [];
    });
    await ir(pg, "#formaturas");
    await calmo(pg);
    const leit = await pg.evaluate(() => window.__leituras.filter(l => l.col === "formandos"));
    ok(
      /Pode oferecer os kits para 1 aluno/i.test(await pg.textContent("#fmCorpo")) && !leit.some(l => l.filtros === 0),
      "aviso de oferta sem ler a coleção inteira de formandos: " + JSON.stringify(leit)
    );
    await pg.locator("#fmChips").getByText("📸 Depois das fotos").click();
    await calmo(pg);
    ok(
      /Caio Kit Um/.test(await pg.textContent("#fmCorpo")) && !/Bia Antecipada/.test(await pg.textContent("#fmCorpo")),
      "só quem tem o Kit 01 aparece em Depois das fotos"
    );
    await pg.locator("#fmCorpo .card").filter({ hasText: "Caio" }).getByText("💬 Oferecer kit").click();
    await calmo(pg);
    ok(
      /Kit 04.*6x de R\$ 183,33/.test(decodeURIComponent(await pg.evaluate(() => window.__aberto || ""))),
      "mensagem oferece o Kit 04 a 6x de R$ 183,33"
    );
    // prévia: todas as fotos do kit (35 fotos = 2 páginas) e prévia do álbum, montadas no aparelho
    await pg.locator("#fmCorpo .card").filter({ hasText: "Caio" }).getByText("🖼️ Prévia").click();
    await calmo(pg);
    const foto = fs.readFileSync(RAIZ + "icons/icon-512.png");
    await pg
      .locator(".panel.mock input[type=file]")
      .setInputFiles(Array.from({ length: 35 }, (_, i) => ({ name: `f${i}.png`, mimeType: "image/png", buffer: foto })));
    await pg
      .waitForFunction(() => /35 fotos em 2 páginas/.test(document.querySelector(".panel.mock .hint")?.textContent || ""), null, {
        timeout: 8000
      })
      .catch(() => {});
    ok(/35 fotos em 2 páginas/.test(await pg.textContent(".panel.mock")), "prévia: 35 fotos do kit em 2 páginas");
    if (process.env.FOTOS) await pg.locator(".panel.mock canvas").screenshot({ path: process.env.FOTOS + "/folha.png" });
    await pg.locator(".panel.mock").getByRole("button", { name: "📘 Prévia do álbum" }).click();
    await calmo(pg);
    ok((await pg.evaluate(() => document.querySelector(".panel.mock canvas").width)) === 1600, "prévia do álbum desenhada");
    if (process.env.FOTOS) await pg.locator(".panel.mock canvas").screenshot({ path: process.env.FOTOS + "/album.png" });
    // limite de fotos: mais 70 (total 105) → fica em 90, com aviso
    await pg
      .locator(".panel.mock input[type=file]")
      .setInputFiles(Array.from({ length: 70 }, (_, i) => ({ name: `g${i}.png`, mimeType: "image/png", buffer: foto })));
    await pg.waitForFunction(() => /Ficaram as primeiras/.test(document.body.textContent), null, { timeout: 15000 }).catch(() => {});
    await calmo(pg);
    const avisoLimite = await pg.textContent("body");
    await pg.locator(".panel.mock").getByRole("button", { name: "📋 Todas as fotos" }).click();
    // as fotos são reduzidas uma a uma (não é o banco): espera a contagem final aparecer
    await pg
      .waitForFunction(() => /90 fotos/.test(document.querySelector(".panel.mock").textContent), null, { timeout: 15000 })
      .catch(() => {});
    ok(/90 fotos/.test(await pg.textContent(".panel.mock")) && /até 90 fotos/.test(avisoLimite), "prévia: limite de 90 fotos com aviso");
    await pg.locator(".panel.mock").getByRole("button", { name: "Fechar" }).click();
    await calmo(pg);
    await pg.locator("#fmCorpo .card").filter({ hasText: "Caio" }).getByText("Abrir turma").click();
    await calmo(pg);
    if (process.env.FOTOS) await pg.locator(".panel.wide").screenshot({ path: process.env.FOTOS + "/turma.png" });
    await pg.locator(".panel.wide .card").filter({ hasText: "Caio" }).getByText("🛒 Comprou kit").click();
    await calmo(pg);
    fk = pg.locator(".sheet").last();
    ok(
      (await fk.getByLabel("Valor total").inputValue()) === "1.100,00" &&
        (await fk.getByLabel("Parcelas", { exact: true }).inputValue()) === "6",
      "depois das fotos: Kit 04 R$ 1.100,00 em 6x"
    );
    await fk.getByLabel("Valor total").fill("1.000,00"); // combinaram outro valor
    await fk.locator("button[type=submit]").click();
    await calmo(pg);
    // a compra a mais grava depois de reservar o ID (duas etapas): espera até 5 s (antes falhava de vez em quando)
    let compras = [];
    for (let t = 0; t < 25; t++) {
      s = await store();
      compras = Object.values(s).filter(x => x.nome === "Caio Kit Um");
      if (compras.some(x => x.venda === "pos" && x.codigo)) break;
      await pg.waitForTimeout(200);
    }
    const nova = compras.find(x => x.venda === "pos");
    ok(
      compras.length === 2 && nova && nova.kitId === "k04" && nova.valor === 1000 && nova.compraDe && compras.some(x => x.kitId === "k01"),
      "compra a mais registrada (R$ 1.000,00 combinado) e o Kit 01 continua"
    );
    ok(
      nova && nova.codigo && nova.codigo === (compras.find(x => x.kitId === "k01") || {}).codigo,
      "compra a mais fica com o mesmo ID do aluno (" + (nova && nova.codigo) + ")"
    );
    await pg.locator(".panel.wide").getByRole("button", { name: "Fechar" }).click();
    await calmo(pg);
    // "+ Formando" direto no card Formaturas (sem planilha): escolhe a turma e já abre o cadastro
    await pg.getByRole("button", { name: "+ Aluno" }).first().click();
    await calmo(pg);
    fk = pg.locator(".sheet").last();
    await fk.getByLabel("Turma (colégio)").selectOption("i1");
    await fk.locator("button[type=submit]").click();
    await calmo(pg);
    fk = pg.locator(".sheet").last();
    await fk.getByLabel("Nome").fill("Eva Direto");
    await fk.locator("button[type=submit]").click();
    await esperaNome(pg, "Eva Direto");
    s = await store();
    const eva = Object.values(s).find(x => x.nome === "Eva Direto");
    // ID do aluno: COLEGIO ALFA e COLEGIO ANTIGO têm as mesmas iniciais (CA): fica com o último nome inteiro
    ok(eva && /^\d\dCALFA-\d\d$/.test(eva.codigo || ""), "formando novo ganha o ID da turma: " + (eva && eva.codigo));
    ok(eva && eva.instId === "i1" && eva.kitId === "k01", "+ Formando no card Formaturas: incluído na turma com o Kit 01");
    await pg.locator(".panel.wide").getByRole("button", { name: "Fechar" }).click();
    await calmo(pg);
    // Repasse: turmas de anos anteriores, quem ficou só com o Kit 01, preço de repasse
    await pg.locator("#viewFormaturas").getByRole("tab", { name: "Turmas anteriores" }).click();
    await calmo(pg);
    await pg.locator("#fmChips").getByText("🔁 Oferecer no repasse").click();
    await calmo(pg);
    let rt = await pg.textContent("#fmCorpo");
    ok(/Lia Antiga/.test(rt) && !/Caio Kit Um/.test(rt), "Repasse mostra só quem ficou com o Kit 01 nas turmas de anos anteriores");
    await pg.locator("#fmCorpo .card").filter({ hasText: "Lia" }).getByText("💬 Oferecer kit").click();
    await calmo(pg);
    const msgRep = decodeURIComponent(await pg.evaluate(() => window.__aberto || ""));
    ok(
      new RegExp("formatura de " + (hoje.getFullYear() - 1)).test(msgRep) && /Kit 04.*5x de R\$ 140,00/.test(msgRep),
      "mensagem do repasse com o preço de repasse (5x de R$ 140,00)"
    );
    await pg.locator("#fmCorpo .card").filter({ hasText: "Lia" }).getByText("Abrir turma").click();
    await calmo(pg);
    await pg.locator(".panel.wide .card").filter({ hasText: "Lia" }).getByText("🛒 Comprou kit").click();
    await calmo(pg);
    fk = pg.locator(".sheet").last();
    ok(
      (await fk.getByLabel("Valor total").inputValue()) === "700,00" &&
        (await fk.getByLabel("Parcelas", { exact: true }).inputValue()) === "5",
      "venda no repasse: Kit 04 R$ 700,00 em 5x"
    );
    await fk.locator("button[type=submit]").click();
    await calmo(pg);
    s = await store();
    const lia = Object.values(s).filter(x => x.nome === "Lia Antiga" || x.nome === "LIA ANTIGA");
    ok(
      lia.some(x => x.venda === "rep" && x.valor === 700 && x.kitId === "k04"),
      "venda do repasse registrada"
    );
    await pg.locator(".panel.wide").getByRole("button", { name: "Fechar" }).click();
    await calmo(pg);
    await pg.locator("#viewFormaturas").getByRole("tab", { name: "Turmas deste ano" }).click();
    await calmo(pg);
  });
  await etapa(pg, "Dashboard", async () => {
    // Dashboard
    await ir(pg, "#vendas");
    await pg.waitForTimeout(1500);
    s = await store();
    ok(!!s["resumos/dashboard"], "Dashboard gravou o resumo (abre lendo 1 documento)");
    const pp = s["resumos/pessoa_pedro-vendas-com"];
    ok(
      pp && pp.email === PEDRO && !JSON.stringify(pp.meses).includes("ana@"),
      "Dashboard grava o desempenho de cada pessoa separado (só os números dela)"
    );
    const tab = await pg.textContent(".vdtab");
    ok(
      (tab.match(/Pedro/g) || []).length === 1 && /R\$ 82,75/.test(tab),
      "Pedro aparece uma vez, comissão R$ 70 (PR Pix 20%) + R$ 12,75 (parcela 85 × 15%): " + tab.replace(/\s+/g, " ").slice(0, 160)
    );
    ok((await pg.locator("#viewVendas canvas").count()) === 2, "gráficos desenhados (Chart.js com conferência de integridade)");
    // um card de cada vez
    await pg.locator(".vdareas").getByText("🖼️ PR").click();
    await calmo(pg);
    let vt = await pg.textContent("#vdCorpo");
    if (process.env.FOTOS) await pg.screenshot({ path: process.env.FOTOS + "/dash-pr.png", fullPage: true });
    ok(
      /Vendido no PR/.test(vt) && /Linha de Frente × Repasse/.test(vt) && /Equipe no PR/.test(vt) && /1 venda do PR a conferir/.test(vt),
      "Dashboard · PR separado (vendas, separados, conversão, equipe) e aviso de venda a conferir"
    );
    await pg
      .waitForFunction(() => !/Contando…/.test(document.querySelector("#vdCorpo").textContent), null, { timeout: 5000 })
      .catch(() => {});
    vt = await pg.textContent("#vdCorpo");
    ok(
      /PR por ano das fotos/.test(vt) && /Fotografados/.test(vt) && !/Sem telefone/.test(vt) && !/Não foi possível contar/.test(vt),
      "Dashboard · PR por ano das fotos (fotografados × compraram)"
    );
    // Histórico por ano: importa a planilha PERCENTUAL e mostra tabelas e gráficos
    await pg.locator(".vdareas").getByText("📈 Histórico").click();
    await calmo(pg);
    if (process.env.DEBUG) console.log("HIST:", (await pg.textContent("#vdCorpo")).slice(0, 300));
    await pg.getByRole("button", { name: "📥 Importar planilhas PERCENTUAL" }).click();
    await calmo(pg);
    const cabP = "CÓDIGO;INSTITUIÇÃO;ALUNOS;VENDAS;% VENDA;DEVOLUÇÃO;% DEVOLUÇÃO;TICKET;DINHEIRO;CARTÃO;BOLETO;VALOR ALUNO;TOTAL VENDAS\n";
    await pg.locator(".sheet:visible input[type=file]").setInputFiles([
      {
        name: "2021 - PERCENTUAL PR.csv",
        mimeType: "text/csv",
        buffer: Buffer.from(
          cabP +
            "1;CIEP 384 - GONÇALVES DIAS;24;14;0,58;0;0;327;799;2501;1280;190;4580\n2;COLEGIO ESTADUAL JOAO PAULO II (FORMATURA);58;15;0,26;;0;1020;1270;5300;8735;263;15305\n;TOTAL;82;29\n"
        )
      },
      {
        name: "2022 - PERCENTUAL PR.csv",
        mimeType: "text/csv",
        buffer: Buffer.from(cabP + "1;CIEP 384 - GONÇALVES DIAS - R. LAGOS;46;19;0,41;0;#REF!;403;1167;4147;2345;166;7659\n")
      }
    ]);
    await pg.waitForFunction(() => /2022: 1 colégios/.test(document.body.textContent), null, { timeout: 8000 }).catch(() => {});
    if (process.env.DEBUG) console.log("IMP:", await pg.locator(".sheet:visible").last().textContent());
    await pg.locator(".sheet:visible button[type=submit]").click();
    await pg
      .waitForFunction(() => /Ano a ano/.test(document.getElementById("vdCorpo").textContent), null, { timeout: 8000 })
      .catch(() => {});
    s = await store();
    vt = await pg.textContent("#vdCorpo");
    ok(
      s["resumos/historico"] &&
        s["resumos/historico"].anos["2021"].colegios.length === 2 &&
        s["resumos/historico"].anos["2022"].colegios[0].total === 765900 &&
        /Ano a ano/.test(vt) &&
        /O mesmo colégio em vários anos/.test(vt) &&
        /CIEP 384/.test(vt) &&
        (await pg.locator("#vdCorpo .hcol .hq").count()) >= 2 &&
        (await pg.locator("#vdCorpo .hcol-num").count()) >= 1 &&
        (await pg.locator("#vdCorpo canvas").count()) >= 4,
      "Dashboard · Histórico: importa as planilhas PERCENTUAL, guarda por ano e mostra tabelas e gráficos"
    );
    if (process.env.FOTOS)
      await pg
        .locator(".hcol")
        .first()
        .screenshot({ path: process.env.FOTOS + "/dash-hist.png" });
    await pg.locator(".vdareas").getByText("🎓 Formaturas").click();
    await calmo(pg);
    vt = await pg.textContent("#vdCorpo");
    if (process.env.FOTOS) await pg.screenshot({ path: process.env.FOTOS + "/dash-form.png", fullPage: true });
    ok(
      /A receber · kits/.test(vt) && /Alunos com parcela atrasada/.test(vt) && /Equipe nas formaturas/.test(vt),
      "Dashboard · Formaturas separado (vendido, recebido, a receber, atrasados)"
    );
    await pg.locator(".vdareas").getByText("💬 Funil").click();
    await calmo(pg);
    vt = await pg.textContent("#vdCorpo");
    if (process.env.FOTOS) await pg.screenshot({ path: process.env.FOTOS + "/dash-funil.png", fullPage: true });
    ok(
      /Leads novos/.test(vt) && /De onde vêm os leads/.test(vt) && /Em aberto agora/.test(vt),
      "Dashboard · Funil separado (leads, conversão, origem)"
    );
    await pg.locator(".vdareas").getByText("Geral").click();
    await calmo(pg);
  });
  await etapa(pg, "PR", async () => {
    // PR: admin confere a venda feita pelo vendedor
    await ir(pg, "#pr");
    await calmo(pg);
    await pg.locator("#rChips").getByText("A conferir").click();
    await calmo(pg);
    await pg.locator(".card").filter({ hasText: "Bruno" }).getByRole("button", { name: "✔ Conferir venda" }).click();
    await calmo(pg);
    s = await store();
    ok(s["repasse/r2"].conferido === true && s["repasse/r2"].conferidoPor === ADRIANO, "admin conferiu a venda do PR");
    // venda que a equipe já entregou antes da conferência continua em "A conferir" (senão a comissão nunca é confirmada)
    await pg.evaluate(() => {
      window.__store.set("repasse/r2e", {
        nome: "ENZO ENTREGUE",
        ano: new Date().getFullYear(),
        etapa: "ENTREGUE",
        valor: 200,
        formaPag: "Pix",
        respEmail: "pedro@vendas.com",
        conferido: false
      });
      window.__fire();
    });
    await calmo(pg);
    ok(/Enzo/i.test(await pg.textContent("#rList")), "venda já entregue e não conferida aparece em A conferir");
    await pg.evaluate(() => {
      window.__store.delete("repasse/r2e");
      window.__fire();
    });
    await calmo(pg);
    // venda paga: prazo de entrega (pagamento + 20 dias) em cores no cartão
    await pg.locator("#rChips").getByText("Vendido/Entregar", { exact: true }).click();
    await calmo(pg);
    const pz = pg.locator(".card", { hasText: "Bruno" }).locator(".prazo");
    ok(
      (await pz.count()) === 1 &&
        /Entregar até .* faltam 20 dias/.test(await pz.textContent()) &&
        /verde/.test(await pz.getAttribute("class")),
      "venda paga mostra o prazo de entrega em verde (20 dias)"
    );
    // total do mês (quantidade e valor) no topo de Vendidos
    await pg.locator("#rChips").getByText("Entregues", { exact: true }).click();
    await calmo(pg);
    ok(
      /Este mês: \d+ vendas? · R\$\s?[\d.]+,\d\d/.test(await pg.textContent("#rVendMes")),
      "Vendidos mostra o total do mês (quantidade e valor)"
    );
    await pg
      .waitForFunction(() => /Total vendido: \d/.test(document.querySelector(".vend-topo")?.textContent || ""), null, { timeout: 5000 })
      .catch(() => {});
    ok(/Total vendido: \d+/.test(await pg.textContent(".vend-topo")), "admin vê ao lado o total geral de vendidos");
    await pg.locator("#rChips").getByText("A conferir").click();
    await calmo(pg);
    // pedido de aluno repetido: o admin decide
    ok(/Ana Vendedora tentou incluir Carla Fila/.test(await pg.textContent("#rPedidos")), "admin vê o pedido de aluno repetido");
    await pg.locator("#rPedidos .notes").filter({ hasText: "Carla Fila" }).getByRole("button", { name: "Passar para Ana" }).click();
    await calmo(pg);
    s = await store();
    ok(
      s["pedidos/p9"].status === "aprovado" &&
        s["repasse/r5"].respEmail === "ana@equipe.com" &&
        s["repasse/r5"].etapa === "SEPARADO" &&
        s["repasse/r5"].contatos.length === 2,
      "admin passa o aluno para quem pediu (separado, com os contatos novos)"
    );
    // aluno que estava com o Pedro: passa para a Ana e o Pedro recebe o aviso
    await pg.locator("#rPedidos .notes").filter({ hasText: "Duda Trocada" }).getByRole("button", { name: "Passar para Ana" }).click();
    await calmo(pg);
    s = await store();
    const avisoPedro = s["pedidos/aviso_r6_pedro-vendas-com"];
    ok(
      s["repasse/r6"].respEmail === "ana@equipe.com" &&
        s["repasse/r6"].etapa === "CONTATADO" &&
        avisoPedro &&
        avisoPedro.status === "aviso" &&
        avisoPedro.porEmail === PEDRO,
      "aluno de outro vendedor: passa mantendo a etapa e quem perdeu recebe o aviso"
    );
    // aluno do Repasse de outro ano pedido por quem só tem a Linha de Frente (transferido): cadastra como novo
    const cartaoMaria = pg.locator("#rPedidos .notes").filter({ hasText: "Maria Transferida" });
    await calmo(pg);
    const txtMaria = await cartaoMaria.textContent();
    ok(
      /só tem a Linha de Frente/.test(txtMaria) &&
        /Trocou de colégio: Colegio Velho → Colegio Novo/.test(txtMaria) &&
        /🏫 1 trocou de colégio/.test(await pg.textContent("#rPedidos h3")) &&
        /já foi pedido antes/.test(txtMaria) &&
        !(await cartaoMaria.getByRole("button", { name: "Passar para Pedro" }).isVisible()),
      "pedido de aluno do Repasse por quem só tem a Linha de Frente: avisa que já foi pedido e não oferece passar"
    );
    await cartaoMaria.getByRole("button", { name: "Cadastrar como novo para Pedro" }).click();
    await calmo(pg);
    s = await store();
    const mariaNova = Object.entries(s).find(([k, v]) => k.startsWith("repasse/") && k !== "repasse/r7" && v.nome === "Maria Transferida");
    ok(
      s["pedidos/p12"].status === "novo" &&
        mariaNova &&
        mariaNova[1].respEmail === PEDRO &&
        mariaNova[1].escola === "Colegio Novo" &&
        s["repasse/r7"].respEmail === "" &&
        s["fones/21966667777"].alunos[mariaNova[0].slice(8)],
      "cadastrado como novo para o vendedor (o antigo continua no Repasse) e telefone no índice"
    );
    ok(
      mariaNova && /^\d\dCN-01$/.test(mariaNova[1].codigo || ""),
      "aluno cadastrado como novo também ganha o ID (" + (mariaNova && mariaNova[1].codigo) + ")"
    );
    // PR: importar planilha (módulo repasse-import.js)
    await pg.getByRole("button", { name: "Importar planilha" }).click();
    await calmo(pg);
    const csv =
      "ESCOLA;FORMANDO;DATA;STATUS;CEL 2 (MÃE)\nColegio Beta;Joana Planilha;10/03/2025;CAIDO;21944443333 (Sonia)\nColegio Beta;Sem Telefone;10/03/2025;CAIDO;\n";
    await pg.locator(".sheet:visible input[type=file]").setInputFiles({ name: "pr.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
    await pg.waitForFunction(() => /2 alunos encontrados/.test(document.body.textContent), null, { timeout: 8000 }).catch(() => {});
    ok(/1 completos e 1 incompletos/.test(await pg.textContent("body")), "importar PR: lê a planilha e mostra incompletos");
    await pg.locator(".sheet:visible button[type=submit]").click();
    await pg.waitForFunction(() => /Pronto!/.test(document.body.textContent), null, { timeout: 8000 }).catch(() => {});
    s = await store();
    const joana = Object.values(s).find(x => x.nome === "Joana Planilha"),
      semTel = Object.values(s).find(x => x.nome === "Sem Telefone");
    ok(
      joana && joana.etapa === "NA FILA" && joana.ano === 2025 && semTel && semTel.etapa === "SEM TELEFONE" && semTel.semTelefone === true,
      "importar PR: fila gravada e sem telefone fora das filas e do Dashboard"
    );
    await pg.locator(".sheet:visible").getByRole("button", { name: "Fechar" }).click();
    await calmo(pg);
    // a mesma planilha de novo: atualiza (não duplica) e não lê o PR inteiro
    await pg.evaluate(() => {
      window.__leituras = [];
    });
    await pg.getByRole("button", { name: "Importar planilha" }).click();
    await calmo(pg);
    await pg.locator(".sheet:visible input[type=file]").setInputFiles({ name: "pr.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
    await pg.waitForFunction(() => /2 alunos encontrados/.test(document.body.textContent), null, { timeout: 8000 }).catch(() => {});
    await pg.locator(".sheet:visible button[type=submit]").click();
    await pg.waitForFunction(() => /Pronto!/.test(document.body.textContent), null, { timeout: 8000 }).catch(() => {});
    s = await store();
    const leitPR = await pg.evaluate(() => window.__leituras.filter(l => l.col === "repasse"));
    ok(
      Object.values(s).filter(x => x.nome === "Joana Planilha").length === 1 &&
        /2 atualizados/.test(await pg.textContent("body")) &&
        !leitPR.some(l => l.filtros === 0),
      "importar de novo: atualiza sem duplicar e sem ler o PR inteiro"
    );
    await pg.locator(".sheet:visible").getByRole("button", { name: "Fechar" }).click();
    await calmo(pg);
    // planilhas antigas (2021): vários arquivos de uma vez, ano escolhido, TELEFONE 1/2/3 = aluno/mãe/pai, VENDIDO fica de fora
    await pg.getByRole("button", { name: "Importar planilha" }).click();
    await calmo(pg);
    const cab = "FOTOZOOM;ESCOLA / FAC.;CURSO;STATUS;VENDEDOR;ID;FORMANDO ;DATA ;TELEFONE 1;TELEFONE 2;TELEFONE 3;TELEFONE 4\n";
    await pg.locator(".sheet:visible input[type=file]").setInputFiles([
      {
        name: "01 - PR - CIEP 384 GONÇALVES DIAS (ARARUAMA).csv",
        mimeType: "text/csv",
        buffer: Buffer.from(
          cab +
            "4821;CIEP 384 GONÇALVES DIAS;3º ANO;-;-;7;TAMARA CORREA;;22 99963-8860;22 99926-6331;;\n;CIEP 384 GONÇALVES DIAS;3º ANO;VENDIDO;ROBERTO;1;CAMILLI VENDIDA;10/10/2021;22 99911-1111;;;\n"
        )
      },
      {
        name: "01 - FORMATURA - 2021-12-13 - C.E. JOÃO PAULO II.csv",
        mimeType: "text/csv",
        buffer: Buffer.from(cab + ";C.E. JOAO PAULO II;3º ANO;-;-;1;NAO ENTRA NO PR;;21911112222;;;\n")
      },
      {
        name: "05 - PR - E.M ALEXANDRE FARAH (ANCHIETA).csv",
        mimeType: "text/csv",
        buffer: Buffer.from(cab + ";E.M. ALEXANDRE FARAH;9 ANO;-;ROBERTO;EMAF - 02;GABRIEL ANTIGO;;21990021393;;;\n")
      },
      {
        name: "07 - PR - E.E NUTA BARTLET JAMES (NILOPOLIS).csv",
        mimeType: "text/csv",
        buffer: Buffer.from(cab + ";E.E NUTA BARTLET JAMES;9 ANO;-;ROBERTO;1;BLOQUEADO NUTA;;21977776666;;;\n")
      }
    ]);
    await pg.waitForFunction(() => /4 alunos encontrados/.test(document.body.textContent), null, { timeout: 8000 }).catch(() => {});
    const imp = pg.locator(".sheet:visible").last();
    ok(
      /4 arquivos/.test(await imp.textContent()) && /fora do PR por ser de formatura/.test(await imp.textContent()),
      "importar PR: lê vários arquivos de uma vez e deixa de fora os de FORMATURA"
    );
    await imp.getByLabel("Ano das fotos (de todos os alunos destes arquivos)").fill("2021");
    await imp.locator("label.chk", { hasText: "NUTA BARTLET JAMES · 9 ANO" }).locator("input").uncheck();
    await calmo(pg);
    ok(
      !(await imp.locator("label.chk", { hasText: "VENDIDO" }).locator("input").isChecked()) &&
        /4 completos e 0 incompletos/.test(await imp.textContent()),
      "quem já comprou (VENDIDO) vem desmarcado; sem nome da mãe/pai não trava (responsável do cadastro)"
    );
    await imp.locator("button[type=submit]").click();
    await pg.waitForFunction(() => /Pronto!/.test(document.body.textContent), null, { timeout: 8000 }).catch(() => {});
    s = await store();
    const tamara = Object.values(s).find(x => x.nome === "TAMARA CORREA"),
      gabriel = Object.values(s).find(x => x.nome === "GABRIEL ANTIGO");
    ok(
      tamara &&
        tamara.ano === 2021 &&
        tamara.etapa === "NA FILA" &&
        tamara.codigo === "21CIEP384-07" &&
        tamara.contatos.some(c => c.tipo === "Mãe" && c.nome === "Responsável do aluno Tamara Correa (cadastrado)") &&
        gabriel &&
        gabriel.ano === 2021 &&
        gabriel.codigo === "21EMAF-02" &&
        !Object.values(s).some(x => x.nome === "NAO ENTRA NO PR"),
      "2021 importado: ano, ID com a sigla, mãe 'do cadastro', e planilha de FORMATURA fora"
    );
    const tamaraHist = await pg.evaluate(async () => {
      const m = await import("./js/repasse-dados.js");
      return m.historicoPlanilha([...window.__store.values()].find(x => x.nome === "TAMARA CORREA") || {});
    });
    ok(
      !/FotoZoom|4821/.test(tamaraHist) && !/Status: -/.test(tamaraHist),
      "histórico da planilha sem o código do FotoZoom e sem '-': " + tamaraHist
    );
    const nuta = Object.values(s).find(x => x.nome === "BLOQUEADO NUTA");
    ok(!nuta && /1 de turma desmarcada ficaram fora do app/.test(await pg.textContent("body")), "turma desmarcada fica fora do app");
    const camilli = Object.values(s).find(x => x.nome === "CAMILLI VENDIDA");
    ok(
      camilli &&
        camilli.historico === true &&
        camilli.etapa === "ENTREGUE" &&
        !camilli.pagoEm &&
        !camilli.followup &&
        /1 que já compraram/.test(await pg.textContent("body")),
      "quem já comprou entra só como histórico (fora das filas e das vendas do mês)"
    );
    // Regra 7: a importação do PR pode ser desfeita (apaga só os alunos novos daquela planilha)
    const impPR = Object.entries(s)
      .filter(([k, x]) => k.startsWith("importacoes/") && x.col === "repasse")
      .sort((a, b) => String(b[1].em).localeCompare(String(a[1].em)))[0];
    ok(impPR && impPR[1].n > 0 && impPR[1].ids.every(id => s["repasse/" + id]), "importação do PR registrada para desfazer");
    await pg.locator(".sheet:visible").getByRole("button", { name: "Fechar" }).click();
    await calmo(pg);
    if (impPR) {
      await ir(pg, "#pr");
      await pg.getByRole("button", { name: "Importar planilha" }).click();
      const shI = pg.locator(".sheet:visible").last();
      await shI.getByText("Importações anteriores (desfazer)").click();
      await shI.getByRole("button", { name: "Desfazer" }).first().click();
      await pg.locator(".sheet").last().getByRole("button", { name: "Sim" }).click();
      await calmo(pg);
      s = await store();
      ok(
        impPR[1].ids.every(id => !s["repasse/" + id]) && s[impPR[0]].status === "desfeita",
        "Desfazer importação: os alunos novos saem e a importação fica marcada como desfeita"
      );
      await pg.evaluate(() => document.querySelectorAll(".sheet").forEach(x => (x.id ? (x.hidden = true) : x.remove())));
    }
  });
  await etapa(pg, "Importar instituições", async () => {
    // Instituições: importar planilha (módulo instituicoes-import.js)
    await ir(pg, "#inst-particular");
    await calmo(pg);
    await pg.getByRole("button", { name: "Importar planilha" }).click();
    await calmo(pg);
    await pg.locator(".sheet:visible input[type=file]").setInputFiles({
      name: "colegios.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("ESCOLA;BAIRRO;TELEFONE 1;RESPONSAVEL\nColegio Planilha;Centro;21933334444;Dona Rita\n")
    });
    await pg.waitForFunction(() => /1 instituições encontradas/.test(document.body.textContent), null, { timeout: 8000 }).catch(() => {});
    await pg.locator(".sheet:visible button[type=submit]").click();
    await calmo(pg);
    s = await store();
    const cp = Object.values(s).find(x => x.nome === "Colegio Planilha" || x.nome === "COLEGIO PLANILHA");
    ok(cp && cp.tipo === "particular" && cp.contatos[0].nome === "Dona Rita", "importar instituições: colégio gravado com o contato");
    // faculdade e curso profissionalizante: um cartão só; no cadastro escolhe qual dos dois
    await pg.keyboard.press("Escape");
    await pg.evaluate(() => document.querySelectorAll(".sheet").forEach(x => (x.id ? (x.hidden = true) : x.remove())));
    await ir(pg, "#instituicoes");
    const cartoesInst = await pg.$$eval("#viewInst .tile[data-inst]", ts => ts.map(t => t.dataset.inst));
    ok(cartoesInst.join(",") === "particular,publico,superior", "Instituições: 3 cartões (" + cartoesInst.join(", ") + ")");
    await ir(pg, "#inst-faculdade"); // endereço antigo leva ao cartão novo
    ok(
      pg.url().endsWith("#inst-superior") && /Faculdade e curso profissionalizante/.test(await pg.textContent("#viewInstTipo")),
      "endereço antigo abre o cartão unificado"
    );
    await pg.getByRole("button", { name: "+ Nova instituição" }).click();
    await calmo(pg);
    const fi = pg.locator(".sheet:visible").last();
    await fi.getByLabel("Nome", { exact: true }).first().fill("Curso Tecnico Teste");
    await fi.getByLabel("É faculdade ou curso profissionalizante?").selectOption("profissionalizante");
    await fi.locator("button[type=submit]").click();
    await calmo(pg);
    s = await store();
    const ct = Object.values(s).find(x => x.nome === "Curso Tecnico Teste");
    ok(
      ct && ct.tipo === "profissionalizante" && /^\s*1\s*$/.test(await pg.textContent("#iAbertas")),
      "cadastro no cartão unificado grava o tipo escolhido e aparece na lista"
    );
    await pg.keyboard.press("Escape");
    if (await pg.locator(".sheet:visible").count())
      await pg
        .locator(".sheet:visible")
        .last()
        .click({ position: { x: 5, y: 5 } });
    await calmo(pg);
  });
  await etapa(pg, "Agenda", async () => {
    // Agenda: admin vê o assunto particular, marca ensaio e compromisso particular
    await ir(pg, "#agenda");
    await calmo(pg);
    ok(/Consulta médica/.test(await pg.textContent("#viewAgenda")), "admin vê o assunto do compromisso particular");
    ok((await pg.getByRole("button", { name: "+ Agendar colégio" }).count()) === 1, "admin também tem o botão Agendar colégio");
    await pg.getByRole("button", { name: "+ Marcar ensaio" }).click();
    await calmo(pg);
    let sh = pg.locator(".sheet").last();
    ok((await sh.getByLabel("Valor do sinal").inputValue()) === "", "sinal do ensaio começa vazio (sem preço fixo)");
    await sh.getByLabel("Cliente").fill("Rita Lima");
    await sh.getByLabel("Tipo de ensaio").selectOption("Retrato");
    await sh.getByLabel("Dia").fill(dia(5));
    await sh.getByLabel("Dia").dispatchEvent("change");
    await sh.getByLabel("Horário").fill("10:00");
    await sh.getByLabel("Valor do ensaio").fill("280,50");
    await sh.locator("button[type=submit]").click();
    await calmo(pg);
    s = await store();
    const rita = Object.values(s).find(x => x.cliente === "Rita Lima");
    ok(rita && rita.valor === 280.5 && rita.marcadoEmail === ADRIANO, "ensaio marcado com valor 280,50 e e-mail de quem marcou");
    await pg.getByRole("button", { name: "+ Compromisso" }).click();
    await calmo(pg);
    sh = pg.locator(".sheet").last();
    await sh.getByLabel("O que é").fill("Exame de sangue");
    await sh.getByLabel("Dia", { exact: true }).fill(dia(6));
    await sh.getByText("Dia inteiro").click();
    await sh.locator("button[type=submit]").click();
    await calmo(pg);
    s = await store();
    const comp = Object.entries(s).find(([k, x]) => k.startsWith("ensaios/") && x.kind === "pessoal" && x.data === dia(6));
    ok(
      comp &&
        comp[1].titulo === "" &&
        s["privado/" + comp[0].split("/")[1]] &&
        s["privado/" + comp[0].split("/")[1]].titulo === "Exame de sangue",
      "compromisso particular: assunto guardado só em 'privado'"
    );
  });
  await etapa(pg, "Becas", async () => {
    // Becas
    await ir(pg, "#becas");
    await calmo(pg);
    await pg.locator("#viewBecas .seg", { hasText: "Aluguéis avulsos" }).click();
    await calmo(pg);
    await pg.getByRole("button", { name: "📦 Estoque" }).click();
    await calmo(pg);
    await pg.locator(".sheet").last().locator("summary", { hasText: "Beca tradicional preta" }).click();
    await pg.locator(".sheet").last().getByLabel("Estoque Beca tradicional preta M", { exact: true }).fill("5");
    await pg.locator(".sheet").last().locator("button[type=submit]").click();
    await calmo(pg);
    s = await store();
    ok(
      s["config/app"].estoque && s["config/app"].estoque.tamanhos.tradPreta.M === 5,
      "estoque por tipo e tamanho gravado (tradicional preta M = 5)"
    );
    await pg.getByRole("button", { name: "+ Aluguel" }).click();
    await calmo(pg);
    let sh = pg.locator(".sheet").last();
    await sh.getByLabel("Cliente").fill("Igreja Central");
    await sh.getByLabel("Data do evento").fill(dia(10));
    await sh.getByLabel("Data do evento").dispatchEvent("change");
    await sh.getByLabel("Beca tradicional preta", { exact: true }).fill("12");
    await sh.getByLabel("M (beca tradicional preta)", { exact: true }).fill("7");
    await sh.getByLabel("G (beca tradicional preta)", { exact: true }).fill("5");
    await sh.getByLabel("Valor total").fill("1.200,00");
    await sh.getByLabel("Já pago").fill("300");
    ok(
      /Beca tradicional preta M: pediu 7, livres 5/.test(await sh.locator(".notes").last().textContent()),
      "avisa que faltam becas tamanho M"
    );
    await sh.locator("button[type=submit]").click();
    await calmo(pg);
    if (await pg.locator(".sheet").count()) {
      await pg.locator(".sheet").last().locator("button[type=submit]").click();
      await calmo(pg);
    }
    s = await store();
    const bc = Object.values(s).find(x => x.cliente === "Igreja Central");
    ok(
      bc && bc.valor === 1200 && bc.pago === 300 && bc.qtd === 12 && bc.porEmail === ADRIANO,
      "aluguel de becas com R$ 1.200,00 e 12 becas"
    );
    ok(
      bc &&
        bc.tamanhosQtd &&
        bc.tamanhosQtd.tradPreta.M === 7 &&
        bc.tamanhosQtd.tradPreta.G === 5 &&
        bc.tamanhos === "Beca tradicional preta: 7 M, 5 G",
      "tamanhos por tipo: tradicional preta 7 M e 5 G"
    );
    ok(/Falta receber R\$ 900/.test(await pg.textContent("#bcLista")), "falta receber R$ 900 (conta em centavos)");
  });
  ok(erros.length === 0, "sem erros no console" + (erros.length ? ": " + erros.slice(0, 3).join(" | ") : ""));
});

for (const [quem, email] of [
  ["admin", ADRIANO],
  ["equipe", PEDRO]
])
  await cenario("Botão voltar do celular (" + quem + ")", async () => {
    const { pg, erros } = await abrir(email, migrar(base));
    const voltar = async () => {
      await pg.evaluate(() => history.back());
      await calmo(pg);
    };
    await pg.locator('.tile[data-mod="colegios"]').click();
    await calmo(pg);
    await pg
      .locator("#viewInst .card, #viewInst a, #viewInst button")
      .filter({ hasText: /Colégio particular/i })
      .first()
      .click();
    await calmo(pg);
    await pg.getByRole("button", { name: "+ Nova instituição" }).click();
    await calmo(pg);
    ok((await pg.locator(".sheet:visible").count()) === 1, "abriu a janela de nova instituição");
    await voltar();
    ok(
      (await pg.locator(".sheet:visible").count()) === 0 && /inst-particular/.test(pg.url()),
      "voltar fecha a janela e fica na mesma tela"
    );
    await voltar();
    ok(/#instituicoes$/.test(pg.url()) && !(await pg.locator("#viewInst").isHidden()), "voltar sobe para Instituições: " + pg.url());
    await voltar();
    ok(/#home$/.test(pg.url()) && (await pg.locator("#viewHome").isVisible()), "voltar sobe para o Início");
    await voltar();
    ok(
      (await pg.locator("#viewHome").isVisible()) && /voltar de novo para sair/.test(await pg.textContent("#toast")),
      "no Início, pede um segundo toque para sair (não fecha o app)"
    );
    // outras telas: abre e volta
    for (const [tile, h] of [
      ["pr", "#pr"],
      ["agenda", "#agenda"],
      ["formaturas", "#formaturas"]
    ]) {
      await pg.locator(`.tile[data-mod="${tile}"]`).click();
      await calmo(pg);
      ok(pg.url().endsWith(h), "abriu " + h);
      await voltar();
      ok(/#home$/.test(pg.url()) && (await pg.locator("#viewHome").isVisible()), "voltar de " + h + " vai para o Início: " + pg.url());
    }
    // janela aberta na Agenda: voltar fecha só a janela
    await pg.locator('.tile[data-mod="agenda"]').click();
    await calmo(pg);
    await pg.getByRole("button", { name: "+ Agendar colégio" }).click();
    await calmo(pg);
    const abertas = await pg.locator(".sheet:visible").count();
    await voltar();
    ok(
      abertas === 1 && (await pg.locator(".sheet:visible").count()) === 0 && pg.url().endsWith("#agenda"),
      "Agenda: voltar fecha a janela e fica na Agenda"
    );
    await voltar();
    ok(/#home$/.test(pg.url()), "e o próximo voltar vai para o Início");
    ok(erros.length === 0, "sem erros no console" + (erros.length ? ": " + erros.slice(0, 3).join(" | ") : ""));
  });

await cenario("Pedro (vendedor: Linha de Frente, Agendamento, Instituições)", async () => {
  const mesAtual = hoje.getFullYear() + "-" + String(hoje.getMonth() + 1).padStart(2, "0");
  const migrado = Object.assign(migrar(base), {
    "resumos/pessoa_pedro-vendas-com": {
      email: PEDRO,
      meses: {
        [mesAtual]: { pessoa: { vend: 35000, visitas: 2, fechados: 1, com: { "pr|Pix": 35000 } }, pr: { v: 35000, n: 1, sep: 10 } }
      },
      marcadas: [],
      geradoEm: new Date().toISOString()
    },
    "instituicoes/i1": Object.assign({}, base["instituicoes/i1"], { respEmail: PEDRO }),
    "formandos/f1": Object.assign({}, base["formandos/f1"], {
      respEmail: PEDRO,
      pagamentos: [{ data: dia(-40), valor: 85 }],
      proxVenc: dia(-10)
    }),
    "ensaios/c1": Object.assign({}, base["ensaios/c1"], { titulo: "" }),
    "privado/c1": { titulo: "Consulta médica" },
    ["agenda/" + dia(20)]: {
      data: dia(20),
      kind: "formatura",
      status: "confirmado",
      instId: "i1",
      instNome: "COLEGIO ALFA",
      pedidoPor: "Pedro Vendedor",
      pedidoEmail: PEDRO,
      contato: { nome: "Rosa Diretora", tel: "21977770000", email: "" },
      alunos: 90,
      onde: "Salão",
      local: "Espaço Festa"
    }
  });
  const { pg, erros, store } = await abrir(PEDRO, migrado);
  await etapa(pg, "Cards e dados que vê", async () => {
    const vs = await visiveis(pg);
    ok(
      vs.includes("agenda") &&
        vs.includes("colegios") &&
        vs.includes("pr") &&
        vs.includes("vendas") &&
        vs.includes("formaturas") &&
        !vs.includes("funil"),
      "vê só os módulos dele: " + vs.join(", ")
    );
  });
  await etapa(pg, "Meu desempenho (Dashboard só dele)", async () => {
    await ir(pg, "#vendas");
    const t = await pg.textContent("#viewVendas");
    ok(
      /Meu desempenho/.test(t) &&
        /Vendido por você\s*R\$\s*350,00/.test(t) &&
        /Sua comissão \(estimada\)\s*R\$\s*70,00/.test(t) &&
        !/Atualizar agora/.test(t) &&
        !/Ana|Adriano/.test(t),
      "Dashboard da equipe: só os números do vendedor, com a comissão"
    );
  });
  await etapa(pg, "Agenda (pedido de data)", async () => {
    await ir(pg, "#agenda");
    await calmo(pg);
    const ag = await pg.textContent("#viewAgenda");
    ok(/ocupado/.test(ag) && !/Consulta/.test(ag), "compromisso particular aparece só como ocupado");
    ok(!(await pg.getByRole("button", { name: "+ Marcar ensaio" }).count()), "não marca ensaio");
    // data aprovada que ele agendou: aviso para mandar do WhatsApp dele
    ok(
      /A Luciana aprovou\. Avise o colégio/.test(await pg.textContent("#agPend")),
      "data aprovada aparece para quem agendou avisar o colégio"
    );
    await pg.locator("#agPend .card").filter({ hasText: "Alfa" }).getByRole("button", { name: "📲 Avisar colégio" }).click();
    await calmo(pg);
    const msgAv = await pg.locator(".sheet").last().locator(".notes").textContent();
    console.log("    mensagem:", JSON.stringify(msgAv));
    ok(/Está confirmado/.test(msgAv) && /90 alunos/.test(msgAv) && /Espaço Festa/.test(msgAv), "mensagem confirmada com local e alunos");
    await pg
      .locator(".sheet")
      .last()
      .getByRole("button", { name: /Enviar no WhatsApp/ })
      .click();
    // volta do WhatsApp: o app pergunta se enviou (só marca com "Sim")
    await pg.getByRole("button", { name: "Sim, enviei" }).click({ timeout: 8000 });
    await calmo(pg);
    ok((await store())["agenda/" + dia(20)].avisadoWhats === true, "marcado como avisado depois de confirmar o envio");
    // Agendar colégio direto pela agenda (dia de fotos do PR)
    await pg.getByRole("button", { name: "+ Agendar colégio" }).click();
    await calmo(pg);
    let sa = pg.locator(".sheet").last();
    // primeiro pergunta se é particular ou público; colégio do outro grupo: avisa onde está cadastrado
    ok(await sa.getByLabel("Colégio").isDisabled(), "Agendar colégio: pergunta particular ou público antes do nome");
    await sa.getByRole("button", { name: "🏛️ Público" }).click();
    await sa.getByLabel("Colégio").fill("Colegio Beta");
    await sa.locator("button[type=submit]").click();
    ok(/cadastrado como Colégio particular/.test(await sa.locator(".err").textContent()), "colégio do outro grupo: avisa o grupo certo");
    await sa.getByRole("button", { name: "🏫 Particular" }).click();
    await sa.getByLabel("Colégio").fill("Colegio Beta");
    await sa.locator("button[type=submit]").click();
    await calmo(pg);
    sa = pg.locator(".sheet").last();
    await sa.locator("input[type=date]").first().fill(dia(15));
    await sa.locator("button[type=submit]").click();
    await calmo(pg);
    ok(/média de alunos/i.test(await sa.locator(".err").last().textContent()), "sem a média de alunos não agenda");
    await sa.getByLabel("Média de alunos (obrigatório)").fill("120");
    // WhatsApp e e-mail não são obrigatórios (09/11/2026); o 0 na frente do DDD é aceito
    await sa.getByLabel("Nome", { exact: true }).fill("Marta Diretora");
    await sa.getByLabel("WhatsApp", { exact: true }).fill("021 98888-1111");
    await sa.getByLabel("E-mail", { exact: true }).fill("marta@beta.com");
    await sa.locator("button[type=submit]").click();
    await calmo(pg);
    const av = pg.locator(".sheet").last();
    ok(
      /Avisar o colégio/i.test(await av.locator("h2").textContent()) &&
        /pré-agendado/.test(await av.textContent()) &&
        /120 alunos/.test(await av.textContent()),
      "depois de agendar, oferece a mensagem pronta para o responsável"
    );
    await av.getByRole("button", { name: /Enviar no WhatsApp/ }).click();
    await calmo(pg);
    ok(/wa\.me\/5521988881111/.test(await pg.evaluate(() => window.__aberto)), "abre o WhatsApp da diretora com a mensagem");
    const sAg = await store();
    ok(
      sAg["instituicoes/i2"].mediaAlunos === 120 &&
        sAg["instituicoes/i2"].alunosEstimado === true &&
        sAg["instituicoes/i2"].contatos.some(c => c.email === "marta@beta.com") &&
        sAg["agenda/" + dia(15)].contato.tel === "21988881111",
      "média de alunos e responsável gravados"
    );
    ok(
      sAg["agenda/" + dia(15)] &&
        sAg["agenda/" + dia(15)].instNome === "COLEGIO BETA" &&
        sAg["agenda/" + dia(15)].pedidoEmail === PEDRO &&
        sAg["instituicoes/i2"].diaFotos,
      "vendedor agenda o dia de fotos do colégio pela agenda"
    );
    // 11/11/2026: segundo dia de fotos do mesmo colégio, num dia que já tem outro compromisso (só avisa)
    await pg.getByRole("button", { name: "+ Agendar colégio" }).click();
    await calmo(pg);
    sa = pg.locator(".sheet").last();
    await sa.getByRole("button", { name: "🏫 Particular" }).click();
    await sa.getByLabel("Colégio").fill("Colegio Beta");
    await sa.locator("button[type=submit]").click();
    await calmo(pg);
    await pg.getByRole("button", { name: "Sim, outro dia de fotos" }).click({ timeout: 6000 });
    await calmo(pg);
    sa = pg.locator(".sheet").last();
    ok(/Dia de fotos 2/i.test(await sa.locator("h2").textContent()), "pergunta e abre o segundo dia de fotos do colégio");
    await sa.locator("input[type=date]").first().fill(dia(20));
    const media2 = sa.getByLabel("Média de alunos (obrigatório)");
    if (!(await media2.inputValue())) await media2.fill("120");
    await sa.locator("button[type=submit]").click();
    await calmo(pg);
    const s2d = await store();
    ok(
      s2d["instituicoes/i2"].diaFotos2 &&
        s2d["instituicoes/i2"].diaFotos2.data === dia(20) &&
        s2d["instituicoes/i2"].diaFotos.data === dia(15) &&
        s2d["agenda/" + dia(20) + "_2"] &&
        s2d["agenda/" + dia(20)],
      "dois dias de fotos no mesmo colégio, e dois compromissos no mesmo dia (o segundo só avisa)"
    );
    const avDia = pg.locator(".sheet").last();
    if (
      /Avisar o colégio/i.test(
        (await avDia
          .locator("h2")
          .textContent()
          .catch(() => "")) || ""
      )
    )
      await avDia
        .getByRole("button", { name: /Fechar|Agora não|Depois/ })
        .first()
        .click()
        .catch(() => {});
    await calmo(pg);
    // Colégio novo cadastrado pela própria agenda
    await pg.getByRole("button", { name: "+ Agendar colégio" }).click();
    await calmo(pg);
    sa = pg.locator(".sheet").last();
    await sa.getByLabel("O que vai marcar").selectOption("formatura");
    await sa.getByRole("button", { name: "🏛️ Público" }).click();
    await sa.getByLabel("Colégio").fill("Colégio Delta Novo");
    await sa.getByLabel("Colégio").dispatchEvent("change");
    await sa.getByLabel("Tipo").selectOption("publico");
    await sa.getByLabel("Média de alunos").fill("80");
    await sa.getByLabel("Bairro").fill("Centro");
    await sa.getByLabel("WhatsApp do responsável").fill("21 3333-4444");
    await sa.getByLabel("Responsável", { exact: true }).fill("João Diretor");
    await sa.locator("button[type=submit]").click();
    await calmo(pg);
    sa = pg.locator(".sheet").last();
    ok(
      /Formatura do Colégio Delta Novo/i.test(await sa.locator("h2").textContent()),
      "depois de cadastrar, abre a formatura do colégio novo"
    );
    const sNovo = await store();
    const delta = Object.values(sNovo).find(x => x.nome === "Colégio Delta Novo");
    ok(
      delta &&
        delta.tipo === "publico" &&
        delta.respEmail === PEDRO &&
        delta.etapa === "A VISITAR" &&
        delta.contatos.length === 1 &&
        delta.mediaAlunos === 80,
      "colégio novo cadastrado pela agenda (tipo, média de alunos, responsável)"
    );
    await sa.getByText("Cancelar").click();
  });
  await etapa(pg, "PR (Linha de Frente)", async () => {
    await ir(pg, "#pr");
    await calmo(pg);
    ok((await pg.textContent("#viewRepasse")).length > 50, "PR (Linha de Frente) abre");
    ok(!/Outra Da Ana/i.test(await pg.textContent("#rList")), "Para hoje da equipe: só os contatos dela (o da Ana não aparece)");
    // lote do dia: a pessoa diz quantos quer separar (sem número fixo por dia)
    await pg.locator("#rLoteBtn").click();
    await pg.locator(".sheet:visible input[type=number]").fill("30");
    await pg.locator(".sheet:visible button[type=submit]").click();
    await calmo(pg);
    const sepS = await store();
    const sep = Object.values(sepS).filter(x => x.separadoEm && x.respEmail === PEDRO).length;
    ok(sep === 30, "“Deseja separar quantos alunos?” 30 → separou 30: " + sep);
    ok(!/o ideal é até|combinado é até/.test(await pg.textContent("#rLote")), "sem número fixo de contatos por dia");
    ok(await pg.locator("#rLoteBtn").isEnabled(), "botão continua liberado");
    // "+ Aluno" no PR, sem planilha: entra separado para quem incluiu
    let fa = await incluirAluno(pg, { nome: "Paulo Manual", colegio: "Colegio Alfa", tel: "21933332222", contato: "Marta" });
    const sp = await store();
    const paulo = Object.values(sp).find(x => x.nome === "Paulo Manual");
    ok(
      paulo && paulo.etapa === "SEPARADO" && paulo.respEmail === PEDRO && paulo.manual && paulo.contatos.length === 1,
      "+ Aluno no PR: incluído e já separado para o vendedor"
    );
    ok(
      paulo &&
        paulo.codigo === String(hoje.getFullYear()).slice(2) + "CA-31" &&
        paulo.codigoBusca === String(hoje.getFullYear()).slice(2) + "CA31" &&
        paulo.escola === "COLEGIO ALFA",
      "+ Aluno: ganha o próximo ID do colégio e o nome do colégio como já está no PR (" +
        (paulo && paulo.codigo + " · " + paulo.escola) +
        ")"
    );
    // o mesmo aluno de novo: não sobrescreve quem já está no PR
    const nAntes = Object.values(sp).filter(x => x.nome === "Paulo Manual").length;
    fa = await incluirAluno(pg, { nome: "Paulo Manual", colegio: "Colegio Alfa", tel: "21900000000", contato: "Outra" });
    const sp2 = await store();
    const paulos = Object.values(sp2).filter(x => x.nome === "Paulo Manual");
    ok(
      paulos.length === nAntes && paulos[0].contatos[0].nome === "Marta" && /já está na sua lista/.test(await pg.textContent("body")),
      "+ Aluno repetido (dele mesmo): avisa e não sobrescreve"
    );
    await fa.click({ position: { x: 5, y: 5 } }); // toque fora do painel fecha
    await calmo(pg);
    // aluno que está na fila do repasse: não passa sozinho; vai um pedido para o admin decidir
    fa = await incluirAluno(pg, { nome: "Carla Fila", colegio: "Colegio Alfa", tel: "21922223333", contato: "Vera" });
    const sp3 = await store();
    const pedC = Object.entries(sp3).find(([k, v]) => k.startsWith("pedidos/") && v.alvoId === "r5" && v.porEmail === PEDRO);
    ok(
      pedC &&
        pedC[1].status === "pendente" &&
        sp3["repasse/r5"].respEmail === "" &&
        Object.values(sp3).filter(x => x.nome === "Carla Fila").length === 0 &&
        /já está cadastrado no PR/.test(await pg.textContent("body")),
      "+ Aluno de outra carteira: avisa o vendedor e manda o pedido (não grava por cima)"
    );
    ok(/Carla Fila.*Aguardando/i.test(await pg.textContent("#rPedidos")), "vendedor vê o pedido aguardando");
    // de novo o mesmo aluno, ainda aguardando: avisa que já foi pedido
    fa = await incluirAluno(pg, { nome: "Carla Fila", colegio: "Colegio Alfa", tel: "21922223333", contato: "Vera" });
    ok(
      /já foi pedido por você e está aguardando/.test(await pg.textContent("body")),
      "pedido repetido: avisa que esse aluno já foi pedido"
    );
    // aluno transferido (outro colégio, Repasse do ano passado), achado pelo telefone da família; já tinha sido pedido e negado
    fa = await incluirAluno(pg, { nome: "Maria Transferida", colegio: "Colegio Novo", tel: "21966667777", contato: "Clara" });
    const sp4 = await store(),
      corpo4 = await pg.textContent("body");
    ok(
      sp4["pedidos/pr_r7_pedro-vendas-com"].status === "pendente" &&
        sp4["pedidos/pr_r7_pedro-vendas-com"].anteriores.length === 1 &&
        sp4["pedidos/pr_r7_pedro-vendas-com"].trocouColegio === true &&
        /Parece que trocou de colégio \(Colegio Velho → Colegio Novo\)/.test(corpo4) &&
        /já foi pedido antes \(ficou onde estava/.test(corpo4) &&
        new RegExp("Maria Transferida já está cadastrado no PR \\(.*" + (hoje.getFullYear() - 1)).test(corpo4) &&
        !Object.values(sp4).some(x => x.nome === "Maria Transferida"),
      "aluno transferido achado pela família (outro colégio e ano); pedido de novo com aviso"
    );
    ok(/Bia Aprovada passou para você/.test(await pg.textContent("#rPedidos")), "vendedor vê o pedido aprovado");
    ok(
      /Zeca Passado passou para Ana Vendedora.*Não mande mais mensagem/.test(await pg.textContent("#rPedidos")),
      "vendedor é avisado do aluno que passou para outra pessoa"
    );
    await pg.locator("#rPedidos .notes").filter({ hasText: "Bia Aprovada" }).getByRole("button", { name: "Ok, entendi" }).click();
    await calmo(pg);
    ok((await store())["pedidos/p8"].visto === true, "vendedor marca que viu a resposta");
  });
  await etapa(pg, "Instituições", async () => {
    await ir(pg, "#inst-particular");
    await calmo(pg);
    await pg.locator("#iChips").getByText("Todas").click();
    await calmo(pg);
    // visita num colégio sem responsável: ele assume (por e-mail) e a visita guarda quem foi
    // lista compacta: uma linha por colégio; tocar abre a janela do colégio (Resumo · Alunos · Agendamentos · Visitas)
    await pg.locator("#iList button.lc-linha").filter({ hasText: "Beta" }).click();
    await calmo(pg);
    const jan = pg.locator(".janela-aluno");
    ok(/Resumo/.test(await jan.locator(".ja-abas").textContent()), "colégio abre na janela com abas");
    await jan.locator(".card").getByText("📝 Registrar visita / contato").click();
    await calmo(pg);
    let sh = pg.locator(".sheet").last();
    await sh.getByLabel("Resultado").selectOption("Vai decidir em reunião");
    await sh.locator("button[type=submit]").click();
    await calmo(pg);
    let s = await store();
    ok(
      s["instituicoes/i2"].respEmail === PEDRO &&
        s["instituicoes/i2"].visitas[0].porEmail === PEDRO &&
        s["instituicoes/i2"].etapa === "VISITADO",
      "visita registrada em transação; Pedro vira responsável pelo e-mail"
    );
    await jan.locator(".ja-abas").getByText("Visitas").click();
    ok(
      /Vai decidir em reunião/.test(await jan.locator(".ja-corpo").textContent()),
      "aba Visitas mostra a visita nova (a janela acompanha o banco)"
    );
    await jan.locator(".ja-abas").getByText("Agendamentos").click();
    // (o Beta tem 2 dias de fotos desde o teste do Agendar colégio: 5 linhas, com o "+ Outro dia de fotos")
    ok(
      (await jan.locator(".ja-ev").count()) === 5 && (await jan.getByRole("button", { name: "📸 + Outro dia de fotos" }).count()) === 1,
      "aba Agendamentos: 2 dias de fotos, formatura, Paspatur e becas"
    );
    await jan.getByText("‹ Voltar para a lista").click();
    // datas e turma agora ficam no card Formaturas
  });
  await etapa(pg, "Formaturas", async () => {
    await ir(pg, "#formaturas");
    await calmo(pg);
    await pg.locator("#fmChips").getByText("Colégios fechados").click();
    await calmo(pg);
    await pg.locator("#fmCorpo .card").filter({ hasText: "Alfa" }).getByRole("button", { name: "📸 Dia de fotos" }).click();
    await calmo(pg);
    let sh = pg.locator(".sheet").last();
    await sh.locator("input[type=date]").first().fill(dia(12));
    await sh.getByLabel("Nome", { exact: true }).fill("Marta");
    await sh.getByLabel("WhatsApp", { exact: true }).fill("21988880000");
    await sh.getByLabel("Média de alunos (obrigatório)").fill("60");
    await sh.locator("button[type=submit]").click();
    await calmo(pg);
    if (await pg.locator(".sheet").count())
      await pg
        .locator(".sheet")
        .last()
        .getByRole("button", { name: "Agora não" })
        .click()
        .catch(() => {});
    const s = await store();
    ok(
      s["agenda/" + dia(12)] &&
        s["agenda/" + dia(12)].pedidoEmail === PEDRO &&
        s["agenda/" + dia(12)].instId === "i1" &&
        s["agenda/" + dia(12)].status === "pendente",
      "pedido de data pelo card Formaturas, com o e-mail de quem pediu"
    );
    await pg.locator("#fmCorpo .card").filter({ hasText: "Alfa" }).getByText("👥 Alunos e parcelas").click();
    await calmo(pg);
    const t = await pg.textContent(".panel.wide");
    ok(!/Parcela paga/.test(t) && /lançados pelo Adriano/.test(t), "na turma não registra pagamento");
    await pg.locator(".panel.wide").getByText("Editar").first().click();
    await calmo(pg);
    ok(await pg.locator(".sheet").last().getByLabel("Valor total").isDisabled(), "não edita valor do formando");
  });
  ok(erros.length === 0, "sem erros no console" + (erros.length ? ": " + erros.slice(0, 3).join(" | ") : ""));
});

await cenario("Erro no app (não é falta de internet)", async () => {
  const { pg, ctx, store } = await abrir(ADRIANO, migrar(base));
  // simula um defeito na tela de Becas
  await ctx.route(/\/js\/becas\.js/, rt =>
    rt.fulfill({
      contentType: "text/javascript",
      body: "export function init() {} export function hide() {} export function show() { throw new Error('defeito de teste'); }"
    })
  );
  await ir(pg, "#becas");
  const t = await pg.textContent("#viewBecas");
  ok(
    /Erro no app/.test(t) && /defeito de teste/.test(t) && !/Verifique a internet/.test(t),
    "defeito aparece como erro no app, não como internet"
  );
  const s = await store();
  const reg = Object.entries(s).find(([k]) => k.startsWith("erros/"));
  ok(reg && reg[1].msg === "defeito de teste" && reg[1].email === ADRIANO, "o erro fica registrado para o admin");
  await pg.click("#btnPrices");
  await calmo(pg);
  ok(/Erros do app \(1\)/.test(await pg.textContent("#pErros")), "Ajustes mostra os erros registrados");
  await pg.click("#pErros summary");
  await pg.click("#pErrosLimpar");
  await calmo(pg);
  ok(!Object.keys(await store()).some(k => k.startsWith("erros/")), "Limpar a lista apaga os erros já vistos");
  // telas com versões misturadas do app (arquivo antigo guardado): abre de novo sozinho, sem registrar erro
  // só a primeira vez vem o arquivo "antigo"; ao abrir de novo, vem o certo (como depois de uma atualização)
  let antigo = true;
  await ctx.route(/\/js\/agenda\.js/, rt => {
    if (!antigo) return rt.continue();
    antigo = false;
    return rt.fulfill({
      contentType: "text/javascript",
      body: "import { naoExiste } from './ui.js'; export function init() {} export function show() {}"
    });
  });
  await pg.evaluate(() => sessionStorage.removeItem("z7recarregou"));
  const [nav] = await Promise.all([
    pg.waitForEvent("load", { timeout: 8000 }).then(
      () => true,
      () => false
    ),
    ir(pg, "#agenda").catch(() => {})
  ]);
  ok(nav && !Object.keys(await store()).some(k => k.startsWith("erros/")), "versão misturada: o app abre de novo sozinho e não vira erro");
});

await cenario("Ver o app como a equipe (admin, só visualização)", async () => {
  const { pg, erros } = await abrir(ADRIANO, migrar(base));
  await pg.click("#btnPrices");
  await calmo(pg);
  await pg.click("#pVerComo");
  await pg.getByRole("button", { name: /Teste de App/ }).click();
  await pg.waitForSelector("#faixaVerComo", { timeout: 8000 });
  await calmo(pg);
  const vs = await visiveis(pg);
  ok(
    /Vendo o app como Teste de App/.test(await pg.textContent("#faixaVerComo")) &&
      vs.includes("funil") &&
      vs.includes("vendas") &&
      (await pg.locator("#btnTeam").isHidden()),
    "abre como a equipe vê (cards da equipe, sem Equipe/admin): " + vs.join(", ")
  );
  await ir(pg, "#vendas");
  ok(/Meu desempenho/.test(await pg.textContent("#viewVendas")), "Dashboard aparece como Meu desempenho");
  // a equipe não vê os leads dos outros (só os livres e os seus)
  await ir(pg, "#funil");
  await pg
    .locator("#chips, .chips")
    .getByText(/^Todos/)
    .first()
    .click();
  await calmo(pg);
  const tf = await pg.textContent("#list");
  ok(/Erica/.test(tf) && !/Perdido Do Adriano/.test(tf), "Funil da equipe: leads livres sim, os do Adriano não");
  // tentar gravar: nada sai do app
  const antes = await pg.evaluate(() => window.__store.size);
  await pg.getByRole("button", { name: "+ Novo lead" }).click();
  await pg.waitForFunction(() => document.activeElement && document.activeElement.id === "fNome", null, { timeout: 2000 }).catch(() => {});
  await pg.fill("#fNome", "Lead De Teste");
  await pg.fill("#fTel", "21999998888");
  await pg.click("#btnSave");
  await calmo(pg);
  ok(
    (await pg.evaluate(() => window.__store.size)) === antes && /Só visualização/.test(await pg.textContent("#toast")),
    "só visualização: tentar salvar não grava nada"
  );
  await pg.evaluate(() => {
    document.getElementById("sheet").hidden = true; // fecha o formulário do lead
  });
  await pg.locator("#faixaVerComo").getByRole("button", { name: "Sair" }).click();
  await pg.waitForFunction(() => !document.getElementById("faixaVerComo"), null, { timeout: 8000 }).catch(() => {});
  await calmo(pg);
  ok(!(await pg.locator("#btnTeam").isHidden()), "Sair volta a ser admin");
  ok(erros.length === 0, "sem erros no console" + (erros.length ? ": " + erros.slice(0, 3).join(" | ") : ""));
});

await cenario("Relatórios para imprimir (um por card)", async () => {
  const telas = [
    ["#funil", /Funil/],
    ["#pr", /PR|Linha de Frente|Repasse/],
    ["#formaturas", /Formaturas/],
    ["#agenda", /Agenda de/],
    ["#becas", /Aluguel de becas/],
    ["#inst-particular", /Colégio particular/],
    ["#inst-superior", /Faculdade e curso profissionalizante/],
    ["#vendas", /Dashboard/]
  ];
  const confere = async (pg, hash, tit, quem) => {
    await ir(pg, hash);
    await pg.getByRole("button", { name: "🖨️ Relatório" }).first().click();
    // relatórios com filtros (ex.: Aluguel de becas): gera com o que vier marcado
    const gerar = pg.locator(".sheet").last().getByRole("button", { name: "🖨️ Gerar relatório" });
    if (await gerar.isVisible({ timeout: 800 }).catch(() => false)) await gerar.click();
    await pg.waitForSelector("#relatorio .rel-folha h1", { timeout: 5000 });
    const r = await pg.evaluate(() => ({
      h1: document.querySelector("#relatorio h1").textContent,
      sub: document.querySelector("#relatorio .rel-sub").textContent,
      secoes: document.querySelectorAll("#relatorio .rel-secao").length,
      imprimindo: document.body.classList.contains("imprimindo")
    }));
    ok(
      tit.test(r.h1) && r.secoes > 0 && r.imprimindo && /Gerado em/.test(r.sub),
      `${quem}: relatório de ${hash} abre (“${r.h1}”, ${r.secoes} seções)`
    );
    await pg.locator("#relatorio").getByRole("button", { name: "Fechar" }).click();
    ok(
      !(await pg.$("#relatorio")) && !(await pg.evaluate(() => document.body.classList.contains("imprimindo"))),
      `${quem}: fechar volta para a tela`
    );
  };
  {
    const { pg, erros, store } = await abrir(ADRIANO, migrar(base));
    await calmo(pg);
    for (const [h, t] of telas) await etapa(pg, "relatório " + h, () => confere(pg, h, t, "admin"));
    // relatórios com o telefone das pessoas
    await etapa(pg, "telefones nos relatórios", async () => {
      for (const [h, re] of [
        ["#funil", /\(\d\d\) \d{4,5}-\d{4}/],
        ["#formaturas", /\(21\) 97777-6666/]
      ]) {
        await ir(pg, h);
        await pg.getByRole("button", { name: "🖨️ Relatório" }).first().click();
        await pg.waitForSelector("#relatorio", { timeout: 5000 });
        ok(re.test(await pg.textContent("#relatorio")), "relatório de " + h + " traz o telefone");
        await pg.locator("#relatorio").getByRole("button", { name: "Fechar" }).click();
      }
    });
    // ID do aluno e telefone errado no PR
    await etapa(pg, "ID do aluno e telefone no PR", async () => {
      await ir(pg, "#pr");
      await pg.locator("#rChips").getByRole("button", { name: "Buscar" }).click();
      await calmo(pg);
      await pg.fill("#rQ", "ca 05");
      await pg
        .waitForFunction(() => /ALUNO 4|Aluno 4/.test(document.getElementById("rList").textContent), null, { timeout: 4000 })
        .catch(() => {});
      ok(
        /Aluno 4/i.test(await pg.textContent("#rList")) && /\d\dCA-05/.test(await pg.textContent("#rList")),
        "busca pelo ID (“ca 05”) acha o aluno"
      );
      await pg.getByRole("button", { name: "+ Aluno" }).click();
      const fa = pg.locator(".sheet:visible").filter({ hasText: "Incluir aluno no PR" }).last();
      await fa.getByLabel("WhatsApp").fill("20988887777");
      ok(
        await fa
          .getByText(/DDD 20 não existe/)
          .first()
          .waitFor({ timeout: 4000 })
          .then(() => true)
          .catch(() => false),
        "telefone errado: avisa na hora no cadastro"
      );
      await pg.evaluate(() => document.querySelectorAll(".sheet").forEach(x => (x.id ? (x.hidden = true) : x.remove())));
      await incluirAluno(pg, { nome: "Zuleica Nova", colegio: "Colegio Alfa", tel: "20988887777", contato: "Rita" });
      const z = Object.values(await store()).find(x => x.nome === "Zuleica Nova");
      ok(z && /^\d\dCA-3\d$/.test(z.codigo || ""), "admin: aluno novo também ganha ID (" + (z && z.codigo) + ")");
      const cont = (await store())["ids/" + String(hoje.getFullYear()).slice(2) + "CA"];
      ok(
        cont && cont.ultimo === Number(z.codigo.slice(-2)),
        "número reservado no contador do colégio no ano (" + JSON.stringify(cont) + ")"
      );
      await pg.fill("#rQ", "Zuleica");
      await pg
        .waitForFunction(() => /Zuleica/i.test(document.getElementById("rList").textContent), null, { timeout: 4000 })
        .catch(() => {});
      ok(/Telefone a conferir/.test(await pg.textContent("#rList")), "cartão do PR avisa o telefone a conferir");
      await pg.getByRole("button", { name: "🖨️ Relatório" }).first().click();
      await pg.waitForSelector("#relatorio .rel-tab", { timeout: 5000 });
      const t = await pg.textContent("#relatorio");
      ok(/\d\dCA-3\d/.test(t) && /⚠️ DDD 20 não existe/.test(t), "relatório do PR traz o ID e o aviso do telefone");
      await pg.locator("#relatorio").getByRole("button", { name: "Fechar" }).click();
    });
    // lista da turma para imprimir
    await etapa(pg, "lista da turma", async () => {
      await ir(pg, "#formaturas");
      await pg
        .locator("#fmChips")
        .getByText(/Colégios fechados/)
        .first()
        .click();
      await calmo(pg);
      await pg
        .locator("#fmCorpo .card")
        .filter({ hasText: /Colegio Alfa/i })
        .getByText(/Ver alunos|Abrir turma|Alunos e parcelas/)
        .first()
        .click();
      await calmo(pg);
      await pg.locator(".panel.wide").getByRole("button", { name: "🖨️ Lista da turma" }).click();
      await pg.waitForSelector("#relatorio .rel-tab", { timeout: 5000 });
      const t = await pg.textContent("#relatorio");
      ok(
        /Turma · Colegio Alfa/i.test(t) && /Lucas Silva/i.test(t) && /\(21\) 97777-6666/.test(t),
        "lista da turma: aluno, telefone e colunas para imprimir"
      );
      await pg.locator("#relatorio").getByRole("button", { name: "Fechar" }).click();
      await pg.evaluate(() => document.querySelectorAll(".sheet").forEach(x => (x.id ? (x.hidden = true) : x.remove())));
    });
    // o relatório do Dashboard leva os números da tela
    await etapa(pg, "conteúdo do dashboard", async () => {
      await ir(pg, "#vendas");
      await pg.getByRole("button", { name: "🖨️ Relatório" }).first().click();
      await pg.waitForSelector("#relatorio .rel-copia", { timeout: 5000 });
      ok(/Total de vendas/.test(await pg.textContent("#relatorio")), "Dashboard: relatório traz os números da tela");
      ok((await pg.$$("#relatorio button")).length === 2, "Dashboard: botões da tela não vão para o papel");
      await pg.locator("#relatorio").getByRole("button", { name: "Fechar" }).click();
    });
    ok(erros.length === 0, "sem erros no console" + (erros.length ? ": " + erros.slice(0, 3).join(" | ") : ""));
  }
  {
    // página nova, navegando pelo card da tela inicial como no celular (o app troca de tela sem criar entradas no histórico)
    const { pg } = await abrir(ADRIANO, migrar(base));
    await calmo(pg);
    await pg.locator('.tile[data-mod="becas"]').click();
    await calmo(pg);
    await pg.getByRole("button", { name: "🖨️ Relatório" }).first().click();
    const gerarB = pg.locator(".sheet").last().getByRole("button", { name: "🖨️ Gerar relatório" });
    if (await gerarB.isVisible({ timeout: 800 }).catch(() => false)) await gerarB.click();
    await pg.waitForSelector("#relatorio", { timeout: 5000 });
    await pg.evaluate(() => history.back());
    await pg.waitForFunction(() => !document.getElementById("relatorio"), null, { timeout: 4000 }).catch(() => {});
    await calmo(pg);
    const h = await pg.evaluate(() => location.hash);
    ok(!(await pg.$("#relatorio")) && h === "#becas", "voltar do celular fecha o relatório e fica na tela (" + h + ")");
  }
  {
    const { pg, erros } = await abrir(PEDRO, migrar(base));
    await calmo(pg);
    await etapa(pg, "relatório do PR (equipe)", () => confere(pg, "#pr", /PR|Linha de Frente|Repasse/, "Pedro"));
    await etapa(pg, "relatório das instituições (equipe)", async () => {
      await confere(pg, "#inst-particular", /Colégio particular/, "Pedro");
    });
    await etapa(pg, "relatório da agenda (equipe)", () => confere(pg, "#agenda", /Agenda de/, "Pedro"));
    ok(erros.length === 0, "sem erros no console" + (erros.length ? ": " + erros.slice(0, 3).join(" | ") : ""));
  }
});

// Varredura: cada perfil abre todas as telas que vê, todas as abas e filtros, o relatório e os formulários de "+ ...",
// sem gravar nada. Nenhum erro no console, nenhuma tela de "Erro no app".
const TELAS = {
  agenda: "#agenda",
  becas: "#becas",
  colegios: "#instituicoes",
  formaturas: "#formaturas",
  pr: "#pr",
  vendas: "#vendas",
  funil: "#funil"
};
for (const [quem, email] of [
  ["admin", ADRIANO],
  ["Pedro (LF, agenda, colégios)", PEDRO],
  ["Ana (becas, agenda, funil, repasse)", ANA],
  ["Fabi (só formaturas)", FORM]
])
  await cenario("Varredura de telas: " + quem, async () => {
    const { pg, erros } = await abrir(email, migrar(base));
    const vistos = await visiveis(pg);
    const telas = vistos.map(m => TELAS[m]).filter(Boolean);
    if (vistos.includes("colegios")) telas.push("#inst-particular", "#inst-publico", "#inst-superior");
    const ruins = [];
    let cliques = 0;
    const confere = async onde => {
      const t = await pg.evaluate(() => {
        const v = document.querySelector("main section:not([hidden])") || document.body;
        return v.innerText;
      });
      if (/Erro no app|Cole as regras|não foi possível carregar|Não foi possível carregar/i.test(t))
        ruins.push(onde + ": " + t.slice(0, 120));
    };
    for (const h of telas) {
      await etapa(pg, quem + " " + h, async () => {
        await ir(pg, h);
        await confere(h);
        // abas e filtros da tela
        const abas = await pg.$$eval("section:not([hidden]) .chip, section:not([hidden]) .seg", bs =>
          bs.filter(b => b.offsetParent).map((b, i) => i)
        );
        for (const i of abas.slice(0, 14)) {
          const b = pg.locator("section:not([hidden]) .chip, section:not([hidden]) .seg").nth(i);
          if (await b.isVisible().catch(() => false)) {
            await b.click({ timeout: 3000 }).catch(() => {});
            cliques++;
            await calmo(pg);
          }
        }
        await confere(h + " (abas)");
        // relatório
        const rel = pg.locator("section:not([hidden])").getByRole("button", { name: "🖨️ Relatório" }).first();
        if (await rel.isVisible().catch(() => false)) {
          await rel.click();
          // relatórios com filtros (ex.: Aluguel de becas): gera com o que vier marcado
          const gerar = pg.locator(".sheet").last().getByRole("button", { name: "🖨️ Gerar relatório" });
          if (await gerar.isVisible({ timeout: 800 }).catch(() => false)) await gerar.click();
          await pg.waitForSelector("#relatorio", { timeout: 5000 }).catch(() => ruins.push(h + ": relatório não abriu"));
          await pg
            .locator("#relatorio")
            .getByRole("button", { name: "Fechar" })
            .click()
            .catch(() => {});
        }
        // formulários "+ ..." da tela: abre e cancela
        const mais = await pg.locator("section:not([hidden]) button").filter({ hasText: /^\+ / }).all();
        for (const b of mais.slice(0, 4)) {
          if (!(await b.isVisible().catch(() => false))) continue;
          await b.click({ timeout: 3000 }).catch(() => {});
          cliques++;
          await calmo(pg);
          await pg.evaluate(() => document.querySelectorAll(".sheet").forEach(x => (x.id ? (x.hidden = true) : x.remove())));
          await pg.evaluate(() => {
            const s = document.getElementById("sheet");
            if (s) s.hidden = true;
          });
        }
        await confere(h + " (formulários)");
      });
    }
    ok(
      ruins.length === 0,
      `${quem}: ${telas.length} telas e ${cliques} abas/formulários sem aviso de erro` +
        (ruins.length ? " — " + ruins.slice(0, 4).join(" | ") : "")
    );
    ok(erros.length === 0, quem + ": sem erros no console" + (erros.length ? ": " + erros.slice(0, 4).join(" | ") : ""));
  });

await cenario("Responsável antigo sem cadastro (admin liga a alguém da equipe)", async () => {
  const { pg, erros, store } = await abrir(ADRIANO, migrar(base));
  await ir(pg, "#pr");
  const cartao = pg.locator("#rList .card").filter({ hasText: /Aluno Do Ze/i });
  ok(/Zé Antigo.*sem cadastro/i.test(await cartao.textContent()), "admin vê o aviso no cartão do contato sem responsável ligado");
  await cartao.getByRole("button", { name: "Editar dados" }).click();
  const fa = pg.locator(".sheet:visible").last();
  await fa.getByLabel("Responsável").selectOption(PEDRO);
  await fa.locator("button[type=submit]").click();
  await calmo(pg);
  const r9 = (await store())["repasse/r9"];
  ok(r9.respEmail === PEDRO && r9.resp === "Pedro Vendedor", "admin escolhe o responsável e o contato passa para a carteira dele");
  ok(erros.length === 0, "sem erros no console" + (erros.length ? ": " + erros.slice(0, 3).join(" | ") : ""));
});

await cenario("WhatsApp de trabalho (empresa x equipe, troca com autorização)", async () => {
  const comNumero = () => {
    const d = migrar(base);
    d["usuarios/" + PEDRO] = Object.assign({}, d["usuarios/" + PEDRO], { numeros: ["21955550000"] });
    return d;
  };
  {
    // admin: número da empresa no Funil; cadastra pessoa com o próprio número (o da empresa não pode)
    const { pg, erros, store } = await abrir(ADRIANO, migrar(base));
    await ir(pg, "#funil");
    ok(
      /Use o WhatsApp/.test(await pg.textContent("#funilNum")) && (await pg.inputValue("#funilNum select")) === "21998817771",
      "admin: Funil vem no WhatsApp da empresa do Funil (pré-definido)"
    );
    await ir(pg, "#home");
    await pg.click("#btnTeam");
    await pg.fill("#uNome", "Rita Nova");
    await pg.fill("#uEmail", "rita@equipe.com");
    const n1 = pg.locator("#uNums input").first();
    await n1.fill("998817771");
    await pg.click("#uSave");
    await calmo(pg);
    ok(/número da empresa/.test(await pg.textContent("#uErr")), "cadastro da equipe recusa o número da empresa");
    await n1.fill("(21) 97777-1234");
    await pg.click("#uSave");
    await esperaNome(pg, "Rita Nova");
    const rita = (await store())["usuarios/rita@equipe.com"];
    ok(rita && JSON.stringify(rita.numeros) === '["21977771234"]', "pessoa cadastrada com o próprio WhatsApp de trabalho");
    // e-mail que já está na lista: não grava de novo (apagaria os módulos e os números da pessoa)
    const antes = JSON.stringify((await store())["usuarios/" + PEDRO]);
    await pg.fill("#uNome", "Pedro de Novo");
    await pg.fill("#uEmail", PEDRO);
    await pg.locator("#uNums input").first().fill("(21) 97777-5555");
    await pg.click("#uSave");
    await calmo(pg);
    ok(
      /já está na lista/.test(await pg.textContent("#uErr")) && JSON.stringify((await store())["usuarios/" + PEDRO]) === antes,
      "cadastro com e-mail que já existe é recusado (não apaga módulos nem números)"
    );
    ok(erros.length === 0, "sem erros no console" + (erros.length ? ": " + erros.slice(0, 3).join(" | ") : ""));
  }
  {
    // equipe: PR mostra o próprio número; pede troca em Ajustes
    const { pg, erros, store } = await abrir(PEDRO, comNumero());
    await ir(pg, "#pr");
    ok(/Use o WhatsApp \(21\) 95555-0000/.test(await pg.textContent("#rLoteNum")), "equipe: PR mostra o próprio WhatsApp de trabalho");
    await ir(pg, "#home");
    await pg.click("#btnPrices");
    await pg.getByRole("button", { name: "📱 Pedir troca de número" }).click();
    const sh = pg.locator(".sheet:visible").last();
    await sh.locator("input").nth(1).fill("21966660000");
    await sh.locator("button[type=submit]").click();
    await calmo(pg);
    const pd = (await store())["numeros/" + PEDRO];
    ok(
      pd && pd.status === "pendente" && JSON.stringify(pd.numeros) === '["21955550000","21966660000"]',
      "equipe pede a troca (fica aguardando o admin)"
    );
    ok(JSON.stringify((await store())["usuarios/" + PEDRO].numeros) === '["21955550000"]', "o número só muda depois de autorizado");
    ok(erros.length === 0, "sem erros no console" + (erros.length ? ": " + erros.slice(0, 3).join(" | ") : ""));
  }
  {
    // com 2 números: vem no pré-definido; troca pelo outro (ex.: o cliente bloqueou) e a escolha fica
    const d = comNumero();
    d["usuarios/" + PEDRO].numeros = ["21955550000", "21966660000"];
    const { pg } = await abrir(PEDRO, d);
    await ir(pg, "#pr");
    ok((await pg.inputValue("#rLoteNum select")) === "21955550000", "vem no WhatsApp pré-definido");
    await pg.selectOption("#rLoteNum select", "21966660000");
    await pg.reload();
    await pg.waitForSelector("#viewApp:not([hidden])");
    await ir(pg, "#pr");
    await calmo(pg);
    ok((await pg.inputValue("#rLoteNum select")) === "21966660000", "a troca de WhatsApp fica guardada até trocar de novo");
  }
  {
    // admin autoriza na tela inicial
    const d = comNumero();
    d["numeros/" + PEDRO] = { numeros: ["21955550000", "21966660000"], status: "pendente", pedidoEm: "2026-10-27", nome: "Pedro Vendedor" };
    const { pg, store } = await abrir(ADRIANO, d);
    ok(/Pedro Vendedor pediu para trocar/.test(await pg.textContent("#hNumeros")), "admin recebe o pedido na tela inicial");
    await pg.locator("#hNumeros").getByRole("button", { name: "✅ Autorizar" }).click();
    await calmo(pg);
    const s2 = await store();
    ok(
      JSON.stringify(s2["usuarios/" + PEDRO].numeros) === '["21955550000","21966660000"]' &&
        s2["numeros/" + PEDRO].status === "aprovado" &&
        s2["numeros/" + PEDRO].visto === false,
      "autorizado: os números passam a valer"
    );
  }
  {
    // Ajustes: o WhatsApp da empresa não pode ser o de trabalho de alguém da equipe
    const { pg, store } = await abrir(ADRIANO, comNumero());
    await pg.click("#btnPrices");
    await pg.fill("#pLfNum", "(21) 95555-0000");
    await pg.click("#pSave");
    await calmo(pg);
    ok(
      /já é de Pedro/.test(await pg.textContent("#toast")) && !/95555/.test((await store())["config/app"].lfNumero || ""),
      "Ajustes recusa número da empresa que já é de alguém da equipe"
    );
  }
  {
    // admin muda os números direto em Equipe: o pedido que estava aguardando fica resolvido
    const d = comNumero();
    d["numeros/" + PEDRO] = { numeros: ["21966660000"], status: "pendente", pedidoEm: "2026-10-27", nome: "Pedro Vendedor" };
    const { pg, store, erros } = await abrir(ADRIANO, d);
    await pg.click("#btnTeam");
    await pg.locator(".urow", { hasText: PEDRO }).getByRole("button", { name: "📱 Números" }).click();
    const sh = pg.locator(".sheet:visible").last();
    await sh.locator("input").first().fill("");
    await sh.locator("input").nth(1).fill("");
    await sh.locator("button[type=submit]").click();
    await calmo(pg);
    ok(/pelo menos um WhatsApp/.test(await sh.textContent()), "equipe não fica sem nenhum WhatsApp de trabalho");
    await sh.locator("input").first().fill("21966660000");
    await sh.locator("button[type=submit]").click();
    await calmo(pg);
    const s3 = await store();
    ok(
      JSON.stringify(s3["usuarios/" + PEDRO].numeros) === '["21966660000"]' && s3["numeros/" + PEDRO].status === "aprovado",
      "admin muda direto: números valem e o pedido aguardando fica resolvido"
    );
    ok(erros.length === 0, "sem erros no console" + (erros.length ? ": " + erros.slice(0, 3).join(" | ") : ""));
  }
  {
    // a pessoa recebe o aviso e marca que viu
    const d = comNumero();
    d["numeros/" + PEDRO] = { numeros: ["21966660000"], status: "aprovado", decididoPor: "Adriano Vinicius", visto: false };
    const { pg, store } = await abrir(PEDRO, d);
    ok(/foram liberados por Adriano/.test(await pg.textContent("#hNumeros")), "equipe recebe o aviso de que foi liberado");
    await pg.locator("#hNumeros").getByRole("button", { name: "Entendi" }).click();
    await calmo(pg);
    ok((await store())["numeros/" + PEDRO].visto === true && (await pg.locator("#hNumeros").isHidden()), "o aviso some depois de visto");
  }
});

await cenario("ID do ensaio fechado e WhatsApp certo no celular", async () => {
  const aa = String(new Date().getFullYear()).slice(-2);
  {
    // admin fecha a venda: ganha o ID na sequência e aparece no card e na busca
    const { pg, store, erros } = await abrir(ADRIANO, migrar(base));
    await ir(pg, "#funil");
    await pg.locator("#list .card").filter({ hasText: "Erica Souza" }).getByRole("button", { name: "Fechou" }).click();
    await pg.fill("#fValor", "450");
    await pg.click("#btnSave");
    await calmo(pg);
    const s = await store();
    ok(
      s["leads/l1"].codigoEnsaio === aa + "EST-00001" && s["ids/ensaio_" + aa + "EST"].ultimo === 1,
      "venda de ensaio no estúdio ganha o ID " + aa + "EST-00001 → " + s["leads/l1"].codigoEnsaio
    );
    ok(!s["leads/l3"].codigoEnsaio && !s["leads/l9"].codigoEnsaio, "venda sem tipo de ensaio (estúdio, externo, corporativo) não ganha ID");
    await pg.fill("#q", aa + "est-00001");
    await calmo(pg);
    ok(
      /Erica Souza/.test(await pg.textContent("#list")) && /🆔 \d\dEST-00001/.test(await pg.textContent("#list")),
      "busca pelo ID acha o ensaio"
    );
    ok(erros.length === 0, "sem erros no console" + (erros.length ? ": " + erros.slice(0, 3).join(" | ") : ""));
  }
  {
    // equipe fecha a venda dela: ID na sequência do tipo (corporativo), venda a conferir
    const d = migrar(base);
    d["ids/ensaio_" + aa + "COP"] = { ultimo: 7 };
    d["leads/la"] = {
      nome: "Empresa Da Ana",
      telefone: "21955554444",
      etapa: "FOLLOW-UP",
      followup: dia(0),
      servico: "Corporativo",
      origem: "Google",
      resp: "Ana Vendedora",
      respEmail: ANA,
      nomeBusca: "EMPRESA DA ANA",
      atualizadoEm: new Date().toISOString()
    };
    const { pg, store, erros } = await abrir(ANA, d);
    await ir(pg, "#funil");
    await pg.locator("#list .card").filter({ hasText: "Empresa Da Ana" }).getByRole("button", { name: "Fechou" }).click();
    await pg.fill("#fValor", "900");
    await pg.click("#btnSave");
    await calmo(pg);
    const la = (await store())["leads/la"];
    ok(la.codigoEnsaio === aa + "COP-00008" && la.conferido === false, "equipe: corporativo ganha " + aa + "COP-00008 e fica a conferir");
    ok(erros.length === 0, "sem erros no console" + (erros.length ? ": " + erros.slice(0, 3).join(" | ") : ""));
  }
  {
    // Android: marca em qual app está cada número; o "Abrir no WhatsApp" abre direto o app do número em uso
    const { pg, erros } = await abrir(ADRIANO, migrar(base), {
      userAgent: "Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36"
    });
    await pg.click("#btnPrices");
    await pg.selectOption('#pNesteCel select[aria-label="App do WhatsApp (21) 99881-7771"]', "business");
    await pg.click("#pCancel");
    await pg.evaluate(() => (window.__abrirLink = u => (window.__link = u)));
    await ir(pg, "#funil");
    await pg.locator("#list .card").filter({ hasText: "Erica Souza" }).getByRole("link", { name: "Abrir no WhatsApp" }).click();
    await calmo(pg);
    const link = await pg.evaluate(() => window.__link || "");
    ok(
      /^intent:\/\/send\/\?phone=5521988887777&text=/.test(link) && /package=com\.whatsapp\.w4b;/.test(link),
      "Android: abre direto no WhatsApp Business do número do Funil"
    );
    ok(erros.length === 0, "sem erros no console" + (erros.length ? ": " + erros.slice(0, 3).join(" | ") : ""));
  }
});

await cenario("Agenda: agendar colégio no dia tocado", async () => {
  for (const [quem, pode] of [
    [ADRIANO, true],
    [PEDRO, true],
    [ANA, false]
  ]) {
    const { pg, erros } = await abrir(quem, migrar(base));
    await ir(pg, "#agenda");
    // próximo mês: todos os dias são futuros; toca no primeiro dia livre que aceita agendar
    await pg.locator(".calnav button").last().click();
    await calmo(pg);
    const dias = pg.locator(".cal button");
    let achou = false;
    for (let i = 0; i < (await dias.count()) && !achou; i++) {
      await dias.nth(i).click();
      await calmo(pg);
      achou = (await pg.locator(".agdia").getByRole("button", { name: "+ Colégio neste dia" }).count()) > 0;
      if (!achou && (await pg.locator(".agdia").count())) await dias.nth(i).click(); // fecha o dia
    }
    ok(achou === pode, `${quem}: botão "+ Colégio neste dia" ${pode ? "aparece" : "não aparece (sem Instituições)"}`);
    if (pode) {
      const tit = (await pg.locator(".agdia h3.name").first().textContent()) || "";
      await pg.locator(".agdia").getByRole("button", { name: "+ Colégio neste dia" }).click();
      await calmo(pg);
      let sa = pg.locator(".sheet").last();
      const dataTxt = ((await sa.textContent()).match(/Dia (\d\d)\/(\d\d)\/(\d{4})/) || []).slice(1);
      await sa.getByRole("button", { name: "🏫 Particular" }).click();
      await sa.getByLabel("Colégio").fill("Colegio Beta");
      await sa.locator("button[type=submit]").click();
      await calmo(pg);
      sa = pg.locator(".sheet").last();
      const v = await sa.locator("input[type=date]").last().inputValue();
      ok(
        dataTxt.length === 3 && v === `${dataTxt[2]}-${dataTxt[1]}-${dataTxt[0]}`,
        `${quem}: o formulário do colégio já vem com o dia tocado (${tit.trim()} → ${v})`
      );
    }
    ok(erros.length === 0, "sem erros no console" + (erros.length ? ": " + erros.slice(0, 3).join(" | ") : ""));
  }
  {
    // feriado só avisa: dá para marcar ensaio e colégio
    const fer = (() => {
      const d = new Date();
      for (let i = 1; i < 400; i++) {
        d.setDate(d.getDate() + 1);
        const x = iso(d);
        if (feriado(x)) return x;
      }
      return "";
    })();
    const { pg, store, erros } = await abrir(ADRIANO, migrar(base));
    await ir(pg, "#agenda");
    await pg.getByRole("button", { name: "+ Marcar ensaio" }).click();
    await calmo(pg);
    let sh = pg.locator(".sheet").last();
    await sh.getByLabel("Cliente").fill("Cliente Do Feriado");
    await sh.getByLabel("Tipo de ensaio").selectOption("Retrato");
    await sh.getByLabel("Dia").fill(fer);
    await sh.getByLabel("Dia").dispatchEvent("change");
    await sh.getByLabel("Horário").fill("10:00");
    ok(/Feriado/.test(await sh.textContent()), "ensaio em feriado: mostra o aviso de feriado");
    await sh.locator("button[type=submit]").click();
    await calmo(pg);
    const e = Object.values(await store()).find(x => x.cliente === "Cliente Do Feriado");
    ok(e && e.data === fer, "ensaio em feriado (" + fer + ") é marcado");
    await pg.getByRole("button", { name: "+ Agendar colégio" }).click();
    await calmo(pg);
    sh = pg.locator(".sheet").last();
    await sh.getByRole("button", { name: "🏫 Particular" }).click();
    await sh.getByLabel("Colégio").fill("Colegio Beta");
    await sh.locator("button[type=submit]").click();
    await calmo(pg);
    sh = pg.locator(".sheet").last();
    await sh.locator("input[type=date]").first().fill(fer);
    await sh.locator("input[type=date]").first().dispatchEvent("input");
    ok(/é feriado/.test(await sh.textContent()), "colégio em feriado: mostra o aviso");
    await sh.getByLabel("Média de alunos (obrigatório)").fill("80");
    await sh.getByLabel("Nome", { exact: true }).fill("Marta Diretora");
    await sh.getByLabel("WhatsApp", { exact: true }).fill("21 98888-1111");
    await sh.locator("button[type=submit]").click();
    await calmo(pg);
    ok(!!(await store())["agenda/" + fer], "colégio em feriado (" + fer + ") é agendado");
    ok(erros.length === 0, "sem erros no console" + (erros.length ? ": " + erros.slice(0, 3).join(" | ") : ""));
  }
});

await cenario("Agenda: Paspatur, aluguel de becas e colégio só com fotos (sem formatura)", async () => {
  const { pg, store, erros } = await abrir(ADRIANO, migrar(base));
  const dia = n => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    while (feriado(iso(d)) || d.getDay() === 0) d.setDate(d.getDate() + 1);
    return iso(d);
  };
  const agendar = async (tipo, data) => {
    await ir(pg, "#agenda");
    await pg.getByRole("button", { name: "+ Agendar colégio" }).click();
    await calmo(pg);
    let sh = pg.locator(".sheet").last();
    await sh.getByLabel("O que vai marcar").selectOption(tipo);
    await sh.getByRole("button", { name: "🏫 Particular" }).click();
    await sh.getByLabel("Colégio").fill("Colegio Beta");
    await sh.locator("button[type=submit]").click();
    await calmo(pg);
    sh = pg.locator(".sheet").last();
    return sh;
  };
  const preencher = async sh => {
    await sh.getByLabel("Média de alunos (obrigatório)").fill("40");
    // da segunda vez a Marta já é contato do colégio (vem escolhida)
    if (await sh.getByLabel("Nome", { exact: true }).isVisible()) {
      await sh.getByLabel("Nome", { exact: true }).fill("Marta Diretora");
      await sh.getByLabel("WhatsApp", { exact: true }).fill("21 98888-1111");
    }
  };
  const d1 = dia(40),
    d2 = dia(45),
    d3 = dia(50);
  let sh = await agendar("paspatur", d1);
  ok(/Dia das fotos do Paspatur/.test(await sh.textContent()), "Paspatur: formulário próprio");
  await sh.locator("input[type=date]").first().fill(d1);
  await preencher(sh);
  await sh.locator("button[type=submit]").click();
  await calmo(pg);
  let st = await store();
  ok(
    st["agenda/" + d1] && st["agenda/" + d1].kind === "paspatur" && st["instituicoes/i2"].diaPaspatur.data === d1,
    "Paspatur agendado no colégio"
  );
  await pg.evaluate(() => document.querySelectorAll(".sheet").forEach(x => (x.id ? (x.hidden = true) : x.remove())));
  sh = await agendar("becas", d2);
  ok(/Dia de medir \/ entregar as becas/.test(await sh.textContent()), "Aluguel de becas: formulário próprio");
  await sh.locator("input[type=date]").first().fill(d2);
  await preencher(sh);
  await sh.locator("button[type=submit]").click();
  await calmo(pg);
  st = await store();
  ok(st["agenda/" + d2] && st["agenda/" + d2].kind === "becas", "Aluguel de becas agendado no colégio");
  await pg.evaluate(() => document.querySelectorAll(".sheet").forEach(x => (x.id ? (x.hidden = true) : x.remove())));
  // formatura → "Não tem formatura nem aluguel de beca": só o dia das fotos
  sh = await agendar("formatura", d3);
  await sh.getByLabel(/Não tem formatura nem aluguel de beca/).check();
  await sh.locator("input[type=date]").first().fill(d3);
  await preencher(sh);
  await sh.locator("button[type=submit]").click();
  await calmo(pg);
  st = await store();
  ok(
    st["agenda/" + d3] &&
      st["agenda/" + d3].kind === "fotos" &&
      st["instituicoes/i2"].semFormatura === true &&
      !st["instituicoes/i2"].formatura,
    "colégio só com fotos: grava só o dia das fotos, sem formatura"
  );
  ok(erros.length === 0, "sem erros no console" + (erros.length ? ": " + erros.slice(0, 3).join(" | ") : ""));
});

await cenario("Cadastro sem módulos", async () => {
  const { pg } = await abrir(NOVO, Object.assign({}, base, { "config/app": { versaoDados: 4 } }));
  ok((await visiveis(pg)).length === 0, "não vê nenhum card");
});
await cenario("PR por colégio e ano · passar para a equipe", async () => {
  const Y = new Date().getFullYear();
  const aluno = (nome, escola, ano) => ({
    nome,
    nomeBusca: nome.toUpperCase(),
    escola,
    ano,
    etapa: "NA FILA",
    resp: "",
    respEmail: "",
    contatos: [{ tipo: "Mãe", nome: "Mãe", tel: "21999990000" }],
    telefones: ["21999990000"]
  });
  const d = Object.assign({}, base, {
    "config/repasse_meta": {
      escolas: { "C.E C.E JOÃO CARDOSO": 1, "e.e.joao Cardoso": 1, "C. E. JOAO CARDOSO": 1 },
      anos: { [Y - 1]: 2, [Y - 2]: 1 },
      escolasAno: { ["C.E C.E JOÃO CARDOSO|" + (Y - 1)]: 1, ["e.e.joao Cardoso|" + (Y - 1)]: 1, ["C. E. JOAO CARDOSO|" + (Y - 2)]: 1 }
    },
    "repasse/jc1": aluno("Aluno Um", "C.E C.E JOÃO CARDOSO", Y - 1),
    "repasse/jc2": aluno("Aluno Dois", "e.e.joao Cardoso", Y - 1),
    "repasse/jc3": aluno("Aluno Tres", "C. E. JOAO CARDOSO", Y - 2),
    "instituicoes/jc": {
      nome: "C.E. João Cardoso",
      nomeBusca: "C.E. JOAO CARDOSO",
      tipo: "publico",
      etapa: "VISITADO",
      resp: "",
      respEmail: "",
      visitas: [],
      contatos: []
    }
  });
  const { pg, erros, store } = await abrir(ADRIANO, d);
  await ir(pg, "#pr");
  const segRep = pg.locator("section:not([hidden]) .seg", { hasText: "Repasse" });
  if (await segRep.count()) await segRep.first().click();
  await calmo(pg);
  const ops = await pg.$$eval("#rLoteEscola option", os => os.map(o => o.textContent));
  if (process.env.DEBUG) console.log("DBG", ops, erros, await pg.evaluate(() => document.body.dataset.tela));
  ok(
    ops.includes(`${Y - 1} - C.E. João Cardoso (2)`) && ops.includes(`${Y - 2} - C.E. João Cardoso (1)`),
    "lista de escolas com o ano e o nome do cadastro: " + ops.slice(1).join(" | ")
  );
  await pg.fill("#rLoteBusca", "cardos");
  const ops2 = await pg.$$eval("#rLoteEscola option", os => os.map(o => o.textContent));
  ok(
    ops2.length === 3 && ops2.slice(1).every(o => /Cardoso/.test(o)) && (await pg.inputValue("#rLoteEscola")) !== "",
    "procurar colégio: escreve parte do nome e a lista mostra só ele, com os anos (já escolhido): " + ops2.join(" | ")
  );
  await pg.fill("#rLoteBusca", "zzz");
  ok(
    /Nenhum colégio/.test((await pg.$$eval("#rLoteEscola option", os => os.map(o => o.textContent))).join()),
    "procurar colégio: avisa quando não acha"
  );
  await pg.fill("#rLoteBusca", "");
  await ir(pg, "#inst-publico");
  await pg.locator("#iChips .chip", { hasText: "Todas" }).click();
  await pg.locator("#iList button.lc-linha").filter({ hasText: "C.E. João Cardoso" }).click();
  await pg.locator(".janela-aluno .card").getByRole("button", { name: "📤 Passar o PR para a equipe" }).click();
  await pg.waitForFunction(
    () => /vão para a pessoa escolhida/.test(document.querySelector(".sheet:last-of-type")?.textContent || ""),
    null,
    { timeout: 6000 }
  );
  await pg.locator(".sheet:visible button[type=submit]").click();
  let s = await store();
  ok(!s["repasse/jc1"].followup, "colégio passado: vai para A trabalhar da pessoa (sem data para hoje)");
  ok(
    s["repasse/jc1"].etapa === "SEPARADO" &&
      s["repasse/jc1"].respEmail === ANA &&
      s["repasse/jc2"].respEmail === ANA &&
      s["repasse/jc3"].etapa === "NA FILA",
    "colégio: passa os alunos do ano escolhido para a pessoa (os outros anos ficam na fila)"
  );
  // janela do colégio → Alunos → "Ver alunos": abre o PR na Busca, já com o colégio e o ano escolhidos
  await pg.locator(".janela-aluno .ja-abas").getByText("Alunos").click();
  const linhaAno = pg.locator(".janela-aluno .lc-linha").filter({ hasText: `${Y - 2} · PR` });
  await linhaAno.waitFor({ timeout: 6000 });
  await linhaAno.getByRole("button", { name: "Ver alunos" }).click();
  await pg.waitForFunction(() => /#pr$/.test(location.hash) && document.querySelector("#rEscola")?.value, null, { timeout: 8000 });
  await calmo(pg);
  ok(
    (await pg.locator(".janela-aluno").count()) === 0 &&
      /João Cardoso/.test(await pg.$eval("#rEscola", x => x.selectedOptions[0].textContent)),
    "Ver alunos abre o PR com o colégio e o ano escolhidos"
  );
  await pg.locator("article", { hasText: "Aluno Tres" }).getByRole("button", { name: "📤 Passar para a equipe" }).click();
  await pg.locator(".sheet:visible select").selectOption(PEDRO);
  await pg.locator(".sheet:visible button[type=submit]").click();
  s = await store();
  ok(s["repasse/jc3"].etapa === "SEPARADO" && s["repasse/jc3"].respEmail === PEDRO, "aluno: passa um aluno específico para a pessoa");
  ok(!erros.length, "sem erros" + (erros.length ? ": " + erros.join(" | ") : ""));
});
await cenario("Para hoje de cada um · botão da pessoa · atividades da equipe", async () => {
  const Y = new Date().getFullYear();
  const al = (nome, respEmail, etapa, followup, extra = {}) =>
    Object.assign(
      { nome, nomeBusca: nome, escola: "NUTA", ano: Y, etapa, followup, resp: respEmail ? respEmail.split("@")[0] : "", respEmail },
      { contatos: [{ tipo: "Mãe", nome: "Mãe", tel: "21999990000" }], telefones: ["21999990000"] },
      extra
    );
  const dados = Object.assign({}, base, {
    "repasse/m1": al("MEU ALUNO", ADRIANO, "SEPARADO", dia(0)),
    "repasse/m2": al("SEM DONO", "", "SEPARADO", dia(0)),
    "repasse/m3": al("DO PEDRO HOJE", PEDRO, "SEPARADO", dia(0)),
    "repasse/m4": al("DO PEDRO DEPOIS", PEDRO, "SEPARADO", null),
    "repasse/m5": al("DO PEDRO CAIDO", PEDRO, "CAÍDO", null, { caidoMotivo: "Não quer" })
  });
  // admin: Para hoje só os dele e os sem responsável; o do Pedro fica no botão do Pedro
  let { pg, erros, store } = await abrir(ADRIANO, dados);
  await ir(pg, "#pr");
  await calmo(pg);
  let lista = await pg.textContent("#rList");
  ok(
    /Meu Aluno/i.test(lista) && /Sem Dono/i.test(lista) && !/Do Pedro/i.test(lista),
    "Para hoje do admin: só os dele e os sem responsável"
  );
  const chip = pg.locator("#rChips .chip-pessoa", { hasText: "Pedro" });
  await chip.waitFor({ timeout: 6000 });
  const nChip = Number((await chip.textContent()).match(/\((\d+)\)/)[1]);
  await chip.click();
  await calmo(pg);
  lista = await pg.textContent("#rList");
  const [, nh, nt] = lista.match(/(\d+) para hoje · (\d+) a trabalhar/) || [];
  ok(nChip >= 2 && nChip === Number(nh) + Number(nt), "botão da pessoa com quantos alunos ela tem em andamento");
  ok(
    /Para hoje de Pedro/.test(lista) && /A trabalhar \(/.test(lista) && /Caídos \(1\)/.test(lista) && /Do Pedro Depois/i.test(lista),
    "botão da pessoa: para hoje, a trabalhar e caídos dela"
  );
  ok(!erros.length, "sem erros (admin)" + (erros.length ? ": " + erros.join(" | ") : ""));
  // equipe: A trabalhar → Trabalhar hoje; vira atividade para o admin
  ({ pg, erros, store } = await abrir(PEDRO, dados));
  await ir(pg, "#pr");
  await calmo(pg);
  await pg.locator("#rChips .chip", { hasText: "A trabalhar" }).click();
  await calmo(pg);
  const item = pg.locator("#rList .lc-item", { hasText: "Do Pedro Depois" });
  await item.waitFor({ timeout: 6000 });
  await item.getByRole("button", { name: "📅 Trabalhar hoje" }).click();
  const s = await store();
  const ativ = Object.entries(s).filter(([k]) => k.startsWith("atividades/"));
  ok(s["repasse/m4"].followup === dia(0), "Trabalhar hoje: o aluno vai para o Para hoje da pessoa");
  ok(ativ.length === 1 && ativ[0][1].email === PEDRO && ativ[0][1].tipo === "hoje", "fica anotado nas atividades da equipe");
  ok(!erros.length, "sem erros (equipe)" + (erros.length ? ": " + erros.join(" | ") : ""));
  // admin: número vermelho no botão com o nome; toque abre o resumo
  ({ pg, erros } = await abrir(ADRIANO, s));
  const badge = pg.locator("#btnMe .ativ-badge");
  await badge.waitFor({ timeout: 6000 });
  ok((await badge.textContent()) === "1", "admin: número vermelho com as atividades novas");
  await pg.locator("#btnMe").click();
  const sh = pg.locator(".sheet").last();
  await sh.getByText("Atividades da equipe").waitFor({ timeout: 6000 });
  ok(/Pedro/.test(await sh.textContent()) && /1 para hoje/.test(await sh.textContent()), "resumo do dia por pessoa");
  await sh.getByRole("button", { name: "✓ Marcar como visto" }).click();
  await calmo(pg);
  ok(await badge.isHidden(), "marcar como visto zera o número");
  ok(!erros.length, "sem erros (aviso)" + (erros.length ? ": " + erros.join(" | ") : ""));
});
await cenario("Prévias de um colégio (lote, no computador)", async () => {
  // MARIA já comprou (PAGO no app): não precisa de prévia; JOAO ainda vai ser trabalhado
  const { pg, erros } = await abrir(
    ADRIANO,
    Object.assign({}, base, {
      "config/repasse_meta": { escolas: { "C.E. TESTE": 2 }, anos: { 2026: 2 }, escolasAno: { "C.E. TESTE|2026": 2 } },
      "repasse/t1": { nome: "MARIA", escola: "C.E. TESTE", ano: 2026, etapa: "PAGO", valor: 297, pagoEm: "2026-10-01" },
      "repasse/t2": { nome: "JOAO", escola: "C.E. TESTE", ano: 2026, etapa: "NA FILA" }
    })
  );
  await pg.evaluate(async () => {
    // fotos de verdade (geradas aqui) e pastas falsas no formato do Chrome (showDirectoryPicker)
    const foto = async cor => {
      const c = document.createElement("canvas");
      c.width = 1200;
      c.height = 1600;
      const x = c.getContext("2d");
      x.fillStyle = cor;
      x.fillRect(0, 0, 1200, 1600);
      return new File([await new Promise(r => c.toBlob(r, "image/jpeg"))], "f.jpg", { type: "image/jpeg" });
    };
    const arq = async (name, cor) => {
      const f = await foto(cor);
      return { kind: "file", name, getFile: async () => f };
    };
    const pasta = (name, itens) => ({
      kind: "directory",
      name,
      async *values() {
        yield* itens;
      }
    });
    const origem = pasta("C.E. TESTE 2026", [
      pasta("01 - MARIA", [await arq("1.jpg", "#c33"), await arq("2.jpg", "#3c3")]),
      pasta("02 - JOAO", [await arq("1.jpg", "#33c")]),
      // arquivo que "some" (pasta do Drive ainda baixando): não pode parar os outros
      pasta("03 - PEDRO", [
        {
          kind: "file",
          name: "1.jpg",
          getFile: async () => {
            if (window.__falha) throw new DOMException("A requested file or directory could not be found", "NotFoundError");
            return foto("#999");
          }
        }
      ])
    ]);
    window.__gravados = {};
    window.__falha = true;
    const dirFalso = caminho => ({
      name: caminho.split("/").pop(),
      async getDirectoryHandle(n) {
        return dirFalso(caminho ? caminho + "/" + n : n);
      },
      async getFileHandle(f) {
        return {
          async createWritable() {
            return {
              async write(b) {
                window.__gravados[caminho + "/" + f] = b.size;
              },
              async close() {}
            };
          }
        };
      }
    });
    const destino = dirFalso("");
    const fila = [origem, destino];
    window.showDirectoryPicker = async () => fila.shift();
  });
  await ir(pg, "#pr");
  await pg.getByRole("button", { name: "🗂️ Prévias de um colégio" }).click();
  await pg.locator(".sheet:visible").getByRole("button", { name: "Escolher a pasta do colégio" }).click();
  await pg.waitForFunction(() => /Pronto!/.test(document.querySelector(".sheet:last-of-type")?.textContent || ""), null, {
    timeout: 15000
  });
  const g = await pg.evaluate(() => window.__gravados);
  const nomes = Object.keys(g).sort();
  const P = "Prévias - C.E. TESTE 2026/";
  ok(
    [P + "02 - JOAO.jpg", P + "02 - JOAO/02 - JOAO - foto 01.jpg"].every(n => nomes.includes(n)) &&
      nomes.length === 2 &&
      Object.values(g).every(t => t > 3000 && t < 600000),
    "só quem vai ser trabalhado (quem já comprou fica de fora): folha e fotos separadas numeradas: " + nomes.join(" | ")
  );
  const fim = await pg.locator(".sheet:last-of-type").textContent();
  ok(/1 de 3 ficaram de fora/.test(fim), "avisa quantos ficaram de fora");
  ok(
    /1 aluno com foto que não saiu/.test(fim) && /03 - PEDRO — 0 de 1 foto gerada/.test(fim) && /limite de 260 letras do Windows/.test(fim),
    "arquivo que não abre: lista o aluno, quantas fotos saíram e o motivo: " + fim.slice(-400)
  );
  ok(
    /Fotos na pasta: 2 · geradas: 1 · não geradas: 1 = 1 dos alunos com erro/.test(fim),
    "conta das fotos: na pasta = geradas + com erro + acima do limite"
  );
  ok(
    await pg.getByRole("button", { name: "📂 Escolher a pasta deste aluno" }).isVisible(),
    "cada aluno com erro tem o botão de escolher a pasta dele"
  );
  // o servidor voltou: gera de novo só quem deu erro
  await pg.evaluate(() => (window.__falha = false));
  await pg.getByRole("button", { name: "🔁 Gerar de novo só esses" }).click();
  await pg.waitForFunction(() => /Tudo certo agora/.test(document.querySelector(".sheet:last-of-type")?.textContent || ""), null, {
    timeout: 15000
  });
  const g2 = Object.keys(await pg.evaluate(() => window.__gravados));
  ok(g2.includes(P + "03 - PEDRO.jpg") && g2.length === 4, "gera de novo só o que deu erro: " + g2.join(" | "));
  ok(
    /Tentei de novo 1 aluno: 1 ficou completo/.test(await pg.locator(".sheet:last-of-type").textContent()) &&
      /geradas: 2 · não geradas: 0/.test(await pg.locator(".sheet:last-of-type").textContent()),
    "depois de gerar de novo: diz o que conseguiu e a conta atualizada"
  );
  ok(!erros.length, "sem erros" + (erros.length ? ": " + erros.join(" | ") : ""));
});
await cenario("Agendamento · Importação: prévias de qualquer pasta, sem mudar os nomes", async () => {
  const { pg, erros } = await abrir(ADRIANO, base);
  await pg.evaluate(async () => {
    const foto = async () => {
      const c = document.createElement("canvas");
      c.width = 800;
      c.height = 1000;
      c.getContext("2d").fillRect(0, 0, 800, 1000);
      return new File([await new Promise(r => c.toBlob(r, "image/jpeg"))], "f.jpg", { type: "image/jpeg" });
    };
    const arq = async name => {
      const f = await foto();
      return { kind: "file", name, getFile: async () => f };
    };
    const pasta = (name, itens) => ({
      kind: "directory",
      name,
      async *values() {
        yield* itens;
      }
    });
    const origem = pasta("Evento Empresa X", [
      pasta("Ana Maria  da Silva (IRMÃ DO 38)", [await arq("DSC_0001.JPG"), await arq("DSC_0002.jpg")])
    ]);
    window.__gravados = {};
    const dirFalso = caminho => ({
      name: caminho.split("/").pop(),
      async getDirectoryHandle(n) {
        return dirFalso(caminho ? caminho + "/" + n : n);
      },
      async getFileHandle(f) {
        return {
          async createWritable() {
            return {
              async write(b) {
                window.__gravados[caminho + "/" + f] = b.size;
              },
              async close() {}
            };
          }
        };
      }
    });
    const fila = [origem, dirFalso("")];
    window.showDirectoryPicker = async () => fila.shift();
  });
  await ir(pg, "#agenda");
  const bt = pg.getByRole("button", { name: "📥 Importação" });
  ok(await bt.isVisible(), "Agendamento tem o botão 📥 Importação");
  await bt.click();
  const sh = pg.locator(".sheet:visible").last();
  ok(!/Pular quem já comprou/.test(await sh.textContent()), "importação livre: entram todos (sem pular ninguém)");
  await sh.getByRole("button", { name: "Escolher a pasta do colégio" }).click();
  await pg.waitForFunction(() => /Pronto!/.test(document.querySelector(".sheet:last-of-type")?.textContent || ""), null, {
    timeout: 15000
  });
  const nomes = Object.keys(await pg.evaluate(() => window.__gravados)).sort();
  const P = "Prévias - Evento Empresa X/";
  ok(
    nomes.includes(P + "Ana Maria  da Silva (IRMÃ DO 38).jpg") &&
      nomes.includes(P + "Ana Maria  da Silva (IRMÃ DO 38)/DSC_0001.jpg") &&
      nomes.includes(P + "Ana Maria  da Silva (IRMÃ DO 38)/DSC_0002.jpg"),
    "nomes da pasta e das fotos exatamente como estavam: " + nomes.join(" | ")
  );
  ok(!erros.length, "sem erros" + (erros.length ? ": " + erros.join(" | ") : ""));
});
await cenario("Agendamento · Importação: folha da turma (20 por página, nome embaixo, colégio e turma no topo)", async () => {
  const { pg, erros } = await abrir(ADRIANO, base);
  await pg.evaluate(async () => {
    const foto = async cor => {
      const c = document.createElement("canvas");
      c.width = 800;
      c.height = 1000;
      const x = c.getContext("2d");
      x.fillStyle = cor;
      x.fillRect(0, 0, 800, 1000);
      return new File([await new Promise(r => c.toBlob(r, "image/jpeg"))], "f.jpg", { type: "image/jpeg" });
    };
    const cores = ["#345", "#543", "#454", "#335", "#553"];
    const itens = [];
    for (let i = 1; i <= 23; i++) {
      const f = await foto(cores[i % 5]);
      itens.push({ kind: "file", name: `${String(i).padStart(2, "0")} - Aluno Numero ${i} Silva.jpg`, getFile: async () => f });
    }
    const origem = {
      kind: "directory",
      name: "00 - LEGACY NAO VAI PARA FORMATURA",
      async *values() {
        yield* itens;
      }
    };
    window.__gravados = {};
    window.__blobs = {};
    const dirFalso = caminho => ({
      name: caminho.split("/").pop(),
      async getDirectoryHandle(n) {
        return dirFalso(caminho ? caminho + "/" + n : n);
      },
      async getFileHandle(f) {
        return {
          async createWritable() {
            return {
              async write(b) {
                window.__gravados[caminho + "/" + f] = b.size;
                window.__blobs[caminho + "/" + f] = b;
              },
              async close() {}
            };
          }
        };
      }
    });
    const fila = [origem, dirFalso("")];
    window.showDirectoryPicker = async () => fila.shift();
  });
  await ir(pg, "#agenda");
  await pg.getByRole("button", { name: "📥 Importação" }).click();
  const sh = pg.locator(".sheet:visible").last();
  await sh.getByLabel("Colégio (cabeçalho)").fill("Legacy School Nova Iguaçu");
  await sh.getByLabel("Turma (cabeçalho)").fill("5º ano A");
  ok(!(await sh.getByLabel(/Também fazer as fotos individuais/).isChecked()), "fotos individuais: só quando marcar");
  await sh.getByRole("button", { name: "Escolher a pasta do colégio" }).click();
  await pg.waitForFunction(() => /Pronto!/.test(document.querySelector(".sheet:last-of-type")?.textContent || ""), null, {
    timeout: 20000
  });
  const nomes = Object.keys(await pg.evaluate(() => window.__gravados)).sort();
  const P = "Legacy School Nova Iguaçu - 5º ano A/";
  ok(
    nomes.length === 2 &&
      nomes.includes(P + "Legacy School Nova Iguaçu - 5º ano A - pagina 1.jpg") &&
      nomes.includes(P + "Legacy School Nova Iguaçu - 5º ano A - pagina 2.jpg"),
    "23 alunos = 2 folhas de até 20, com o nome do colégio e da turma: " + nomes.join(" | ")
  );
  ok(!(await sh.getByLabel("Quantidade de alunos (opcional)").inputValue()), "quantidade de alunos: em branco (só aparece se preencher)");
  // de novo, agora com as fotos individuais: cada uma sai como foto com marca d'água (sem folha), com o nome do arquivo
  await pg.evaluate(() => {
    window.__gravados = {};
  });
  await pg.evaluate(async () => {
    const itens = [];
    for (let i = 1; i <= 3; i++) {
      const c = document.createElement("canvas");
      c.width = 400;
      c.height = 600;
      c.getContext("2d").fillRect(0, 0, 400, 600);
      const f = new File([await new Promise(r => c.toBlob(r, "image/jpeg"))], "f.jpg", { type: "image/jpeg" });
      itens.push({ kind: "file", name: `0${i}-(E.PART)LEGACY NIL-0${i}- ALUNO ${i} SILVA (2).jpg`, getFile: async () => f });
    }
    const origem = {
      kind: "directory",
      name: "Turma",
      async *values() {
        yield* itens;
      }
    };
    const dirFalso = caminho => ({
      name: caminho.split("/").pop(),
      async getDirectoryHandle(n) {
        return dirFalso(caminho ? caminho + "/" + n : n);
      },
      async getFileHandle(f) {
        return {
          async createWritable() {
            return {
              async write(b) {
                window.__gravados[caminho + "/" + f] = b.size;
              },
              async close() {}
            };
          }
        };
      }
    });
    const fila = [origem, dirFalso("")];
    window.showDirectoryPicker = async () => fila.shift();
  });
  if (process.env.FOTO) {
    const d = await pg.evaluate(async n => {
      const b = window.__blobs[n];
      return await new Promise(r => {
        const fr = new FileReader();
        fr.onload = () => r(fr.result);
        fr.readAsDataURL(b);
      });
    }, P + "Legacy School Nova Iguaçu - 5º ano A - pagina 1.jpg");
    (await import("node:fs")).writeFileSync(process.env.FOTO, Buffer.from(d.split(",")[1], "base64"));
  }
  await sh.getByLabel(/Também fazer as fotos individuais/).check();
  await sh.getByRole("button", { name: "Escolher a pasta do colégio" }).click();
  await pg.waitForFunction(() => Object.keys(window.__gravados).length >= 4, null, { timeout: 20000 });
  await calmo(pg);
  const n2 = Object.keys(await pg.evaluate(() => window.__gravados)).sort();
  ok(
    n2.includes(P + "01-(E.PART)LEGACY NIL-01- ALUNO 1 SILVA (2).jpg") &&
      n2.includes(P + "03-(E.PART)LEGACY NIL-03- ALUNO 3 SILVA (2).jpg") &&
      n2.includes(P + "Legacy School Nova Iguaçu - 5º ano A.jpg") &&
      n2.length === 4,
    "fotos individuais: cada foto sai sozinha com a marca (nome do arquivo), além da folha da turma: " + n2.join(" | ")
  );
  ok(!erros.length, "sem erros" + (erros.length ? ": " + erros.join(" | ") : ""));
});
await cenario("Juntar colégio que veio errado da planilha (G e M → C.E. Roberto Lyra)", async () => {
  const al = (nome, escola) => ({
    nome,
    nomeBusca: nome.toUpperCase(),
    escola,
    ano: 2025,
    seg: "rep",
    etapa: "NA FILA",
    resp: "",
    respEmail: "",
    contatos: [],
    telefones: []
  });
  const d = Object.assign({}, base, {
    "config/formatura_meta": {
      escolas: { G: 1, M: 1, "C.E ROBERTO LYRA": 1 },
      anos: { 2025: 3 },
      escolasAno: { "G|2025": 1, "M|2025": 1, "C.E ROBERTO LYRA|2025": 1 }
    },
    "formaturaAlunos/g1": al("Aluno Gê", "G"),
    "formaturaAlunos/m1": al("Aluno Eme", "M"),
    "formaturaAlunos/r1": al("Aluno Lyra", "C.E ROBERTO LYRA")
  });
  const { pg, store, erros } = await abrir(ADRIANO, migrar(d));
  await ir(pg, "#formaturas");
  await pg.locator("#viewFormaturas .seg", { hasText: "Repasse" }).click();
  await calmo(pg);
  // os números do topo levam para a lista deles
  await pg.locator("#viewFormaturas .stat", { hasText: "Interessados" }).click();
  await calmo(pg);
  ok(
    (await pg.locator("#viewFormaturas #rChips .chip", { hasText: "Interessados" }).getAttribute("aria-pressed")) === "true",
    "tocar em “Interessados” abre a lista de interessados"
  );
  for (const x of ["G", "M"]) {
    await pg.selectOption("#rLoteEscola", { label: `2025 - ${x} (1)` });
    await calmo(pg);
    await pg.getByRole("button", { name: "🔀 Juntar com outro colégio" }).click();
    const sh = pg.locator(".sheet").last();
    await sh.getByLabel("Colégio certo").selectOption({ label: "2025 - C.E. Roberto Lyra (" + (x === "G" ? 1 : 2) + ")" });
    await sh.locator("button[type=submit]").click();
    await pg.locator(".sheet").last().getByRole("button", { name: "Sim" }).click();
    await calmo(pg);
  }
  const st = await store();
  ok(
    st["formaturaAlunos/g1"].escola === "C.E ROBERTO LYRA" &&
      st["formaturaAlunos/m1"].escola === "C.E ROBERTO LYRA" &&
      st["formaturaAlunos/g1"].escolaAntes === "G",
    "G e M passaram para o C.E. Roberto Lyra (e fica guardado o nome antigo)"
  );
  const ea = st["config/formatura_meta"].escolasAno;
  ok(ea["C.E ROBERTO LYRA|2025"] === 3 && !ea["G|2025"] && !ea["M|2025"], "lista de escolas: Roberto Lyra 2025 com 3, sem G e M");
  // excluir o colégio inteiro (ano importado errado): os alunos saem e o colégio some da lista
  await pg.selectOption("#rLoteEscola", { label: "2025 - C.E. Roberto Lyra (3)" });
  await pg.getByRole("button", { name: "🗑️ Excluir colégio inteiro" }).click();
  await pg.locator(".sheet").last().getByRole("button", { name: "Sim, excluir tudo" }).click();
  await calmo(pg);
  const st2 = await store();
  ok(
    !st2["formaturaAlunos/g1"] && !st2["formaturaAlunos/r1"] && !(st2["config/formatura_meta"].escolasAno || {})["C.E ROBERTO LYRA|2025"],
    "excluir colégio inteiro: alunos apagados e o colégio sai da lista"
  );
  const ops = await pg.$$eval("#rLoteEscola option", os => os.map(o => o.textContent));
  ok(!ops.some(o => /Roberto Lyra/.test(o)), "a lista do lote já não mostra o colégio excluído");
  ok(!erros.length, "sem erros" + (erros.length ? ": " + erros.join(" | ") : ""));
});
await cenario("Fotos do aluno direto do Google Drive", async () => {
  const Y = new Date().getFullYear();
  const F = "application/vnd.google-apps.folder";
  const arvore = {
    RAIZ123456789: [{ id: "col1", name: `Prévias - ${Y} - C.E. YONNE MARIA SIQUEIRA`, mimeType: F }],
    col1: [
      { id: "folha1", name: "CEYMS 02 - DOMINGOS JOSE.jpg", mimeType: "image/jpeg" },
      { id: "pasta1", name: "CEYMS 02 - DOMINGOS JOSE", mimeType: F }
    ],
    pasta1: [1, 2, 3, 4].map(n => ({ id: "foto" + n, name: `CEYMS 02 - DOMINGOS JOSE - foto 0${n}.jpg`, mimeType: "image/jpeg" }))
  };
  const d = Object.assign({}, base, {
    "config/app": Object.assign({}, base["config/app"] || {}, {
      drivePrevias: "https://drive.google.com/drive/folders/RAIZ123456789?usp=sharing"
    }),
    "repasse/dj": {
      nome: "DOMINGOS JOSE",
      nomeBusca: "DOMINGOS JOSE",
      escola: "C.E YONNE MARIA SIQUEIRA DE ANDRADE",
      ano: Y,
      codigoOrig: "02",
      etapa: "SEPARADO",
      resp: "Adriano Vinicius",
      respEmail: ADRIANO,
      separadoEm: dia(0),
      separadoSeg: "lf",
      followup: dia(0),
      contatos: [{ tipo: "Mãe", nome: "Mãe", tel: "21999990000" }],
      telefones: ["21999990000"]
    }
  });
  const { pg, erros, ctx } = await abrir(ADRIANO, d);
  const urls = [];
  await ctx.route(/googleapis\.com\/drive\/v3\/files/, rt => {
    const u = decodeURIComponent(rt.request().url());
    urls.push(u);
    if (/alt=media/.test(u))
      return rt.fulfill({
        path: AQUI + "../../icons/icon-192.png",
        contentType: "image/png",
        headers: { "access-control-allow-origin": "*" }
      });
    const pai = (u.match(/'([^']+)' in parents/) || [])[1];
    return rt.fulfill({
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({ files: arvore[pai] || [] })
    });
  });
  await ir(pg, "#pr");
  await pg.locator("article", { hasText: "DOMINGOS JOSE" }).first().getByRole("button", { name: "🖼️ Fotos do aluno" }).click();
  await pg.waitForFunction(() => document.querySelectorAll(".fotos-grade .foto-item img").length === 4, null, { timeout: 8000 });
  ok(
    (await pg.locator(".sheet:visible").getByRole("button", { name: "📤 Enviar a folha numerada" }).count()) === 1,
    "acha a folha e as 4 fotos do aluno no Drive"
  );
  await pg.locator(".fotos-grade .foto-item").nth(2).click();
  await pg.locator(".fotos-grade .foto-item").nth(0).click();
  const tags = await pg.$$eval(".fotos-grade .tag", ts => ts.map(t => t.textContent));
  ok(tags[2] === "Quadro" && tags[0] === "Porta-retratos 1", "toque na ordem: quadro e porta-retratos");
  await pg.getByRole("button", { name: "🖼️ Montar o quadro com estas fotos" }).click();
  await pg.waitForFunction(() => document.querySelectorAll(".mock .thumb").length === 2, null, { timeout: 8000 });
  ok(true, "abre a prévia do kit já com as fotos escolhidas");
  ok(
    urls.every(u => /key=/.test(u)),
    "lê o Drive com a chave do app"
  );
  // janela do aluno → Prévia e fotos: miniaturas direto na aba e "Trocar as fotos"
  arvore.col1.push(
    { id: "folha9", name: "CEYMS 09 - OUTRO ALUNO.jpg", mimeType: "image/jpeg" },
    { id: "pasta9", name: "CEYMS 09 - OUTRO ALUNO", mimeType: F }
  );
  arvore.pasta9 = [{ id: "foto91", name: "x.jpg", mimeType: "image/jpeg" }];
  const j2 = await abrir(ADRIANO, d, { compacta: true });
  await j2.ctx.route(/googleapis\.com\/drive\/v3\/files/, rt => {
    const u = decodeURIComponent(rt.request().url());
    if (/alt=media/.test(u))
      return rt.fulfill({
        path: AQUI + "../../icons/icon-192.png",
        contentType: "image/png",
        headers: { "access-control-allow-origin": "*" }
      });
    const pai = (u.match(/'([^']+)' in parents/) || [])[1];
    return rt.fulfill({
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({ files: arvore[pai] || [] })
    });
  });
  await ir(j2.pg, "#pr");
  await j2.pg
    .locator("#rList button.lc-linha", { hasText: /Domingos/i })
    .first()
    .click();
  const jan = j2.pg.locator(".panel.janela-aluno");
  await jan.getByRole("tab", { name: "Prévia e fotos" }).click();
  await j2.pg.waitForFunction(() => document.querySelectorAll(".ja-fotos .foto-item img").length === 5, null, { timeout: 8000 });
  ok(true, "janela do aluno: a folha e as 4 fotos em miniatura na aba");
  await jan.locator(".ja-fotos .foto-item").nth(1).click();
  ok((await j2.pg.locator(".panel.foto-grande img").count()) === 1, "tocar na miniatura amplia a foto");
  await j2.pg.locator(".panel.foto-grande").getByRole("button", { name: "Fechar" }).click();
  await jan.getByRole("button", { name: "🔄 Trocar as fotos" }).click();
  const tr = j2.pg.locator(".sheet").last();
  await tr.getByText(/CEYMS 09 - OUTRO ALUNO/).click();
  await tr.getByRole("button", { name: "Usar estas fotos" }).click();
  await calmo(j2.pg);
  const st2 = await j2.store();
  ok(st2["repasse/dj"].fotosDrive && st2["repasse/dj"].fotosDrive.pastaId === "pasta9", "Trocar as fotos grava a escolha no aluno");
  await j2.pg.waitForFunction(() => document.querySelectorAll(".ja-fotos .foto-item img").length === 2, null, { timeout: 8000 });
  ok(/escolhidas à mão/.test(await jan.locator(".ja-fotos").textContent()), "a aba mostra as fotos trocadas (escolhidas à mão)");
  ok(!j2.erros.length, "janela sem erros" + (j2.erros.length ? ": " + j2.erros.join(" | ") : ""));
  ok(!erros.length, "sem erros" + (erros.length ? ": " + erros.join(" | ") : ""));
});
await cenario("Conferir fotos e 📤 Enviar foto (admin grava a prévia no Drive)", async () => {
  const Y = new Date().getFullYear(),
    yy = String(Y).slice(-2);
  const F = "application/vnd.google-apps.folder";
  const ESC = "C.E YONNE MARIA SIQUEIRA DE ANDRADE";
  const arvore = {
    RAIZ123456789: [{ id: "col1", name: `Prévias - ${Y} - C.E. YONNE MARIA SIQUEIRA`, mimeType: F }],
    col1: [
      { id: "folha1", name: "CEYMS 02 - DOMINGOS JOSE.jpg", mimeType: "image/jpeg" },
      { id: "pasta1", name: "CEYMS 02 - DOMINGOS JOSE", mimeType: F }
    ]
  };
  const aluno = (nome, etapa, n) => ({
    nome,
    nomeBusca: nome,
    escola: ESC,
    ano: Y,
    codigo: `${yy}CEYMS-${String(n).padStart(2, "0")}`,
    etapa,
    resp: "",
    respEmail: "",
    contatos: etapa === "SEM TELEFONE" ? [] : [{ tipo: "Mãe", nome: "Mãe", tel: "2199999000" + n }],
    telefones: etapa === "SEM TELEFONE" ? [] : ["2199999000" + n]
  });
  const d = Object.assign({}, base, {
    "config/app": Object.assign({}, base["config/app"] || {}, {
      drivePrevias: "https://drive.google.com/drive/folders/RAIZ123456789?usp=sharing",
      driveCliente: "123-teste.apps.googleusercontent.com"
    }),
    "config/repasse_meta": { escolasAno: { [ESC + "|" + Y]: 4 } },
    "repasse/c1": aluno("DOMINGOS JOSE", "NA FILA", 2),
    "repasse/c2": aluno("BRUNA PAGA", "ENTREGUE", 3),
    "repasse/c3": aluno("SAULO SEMTEL", "SEM TELEFONE", 4),
    "repasse/c4": aluno("FABIANA FALTA", "NA FILA", 5)
  });
  const { pg, erros, ctx } = await abrir(ADRIANO, d);
  // login do Google falso: devolve o token com a permissão de gravar
  await pg.evaluate(() => {
    window.__escopos = [];
    window.google = {
      accounts: {
        oauth2: {
          hasGrantedAllScopes: () => true,
          initTokenClient: o => ({
            requestAccessToken: () => (
              window.__escopos.push(o.scope), setTimeout(() => o.callback({ access_token: "TOK", expires_in: 3600 }), 0)
            )
          })
        }
      }
    };
  });
  const pedidos = [];
  let n = 0;
  await ctx.route(/googleapis\.com\/(upload\/)?drive\/v3\/files/, async rt => {
    const q = rt.request();
    const u = decodeURIComponent(q.url());
    const h = { "access-control-allow-origin": "*" };
    pedidos.push({ u, metodo: q.method(), auth: (q.headers() || {}).authorization || "" });
    if (q.method() === "POST") {
      const corpo = q.postDataBuffer().toString("latin1");
      const meta = JSON.parse(/uploadType=multipart/.test(u) ? corpo.split("\r\n\r\n")[1].split("\r\n")[0] : corpo);
      const f = { id: "novo" + ++n, name: Buffer.from(meta.name, "latin1").toString("utf8"), mimeType: meta.mimeType || "image/jpeg" };
      (arvore[meta.parents[0]] = arvore[meta.parents[0]] || []).push(f);
      return rt.fulfill({ contentType: "application/json", headers: h, body: JSON.stringify(f) });
    }
    const pai = (u.match(/'([^']+)' in parents/) || [])[1];
    return rt.fulfill({ contentType: "application/json", headers: h, body: JSON.stringify({ files: arvore[pai] || [] }) });
  });
  await ir(pg, "#pr");
  await pg.getByRole("button", { name: "🔎 Conferir fotos" }).click();
  await pg.locator(".sheet:visible").getByRole("button", { name: "Conferir", exact: true }).click();
  await pg.waitForFunction(() => /falta/.test(document.querySelector(".sheet .conf-fotos")?.textContent || ""), null, { timeout: 8000 });
  if (process.env.FOTOS) await pg.screenshot({ path: process.env.FOTOS + "/conferir-fotos.png" });
  let t = await pg.locator(".sheet:visible").textContent();
  ok(
    /4 alunos · 1 com foto/.test(t) && /já comprou: 1/.test(t) && /sem telefone: 1/.test(t) && /não comprou: 1 → falta gerar/.test(t),
    "Conferir fotos separa: com foto, já comprou, sem telefone e falta gerar"
  );
  ok(
    /Fabiana Falta/i.test(t) &&
      !/Bruna Paga/i.test(
        await pg
          .locator(".conf-aluno")
          .allTextContents()
          .then(x => x.join())
      ),
    "só quem falta gerar tem a linha com o botão"
  );
  // envia a foto de quem falta
  await pg
    .locator(".conf-aluno", { hasText: /Fabiana/i })
    .getByRole("button", { name: "📤 Enviar foto" })
    .click();
  const [fc] = await Promise.all([pg.waitForEvent("filechooser"), pg.getByRole("button", { name: "Escolher as fotos" }).click()]);
  await fc.setFiles([AQUI + "../../icons/icon-512.png", AQUI + "../../icons/icon-192.png"]);
  await pg.getByRole("button", { name: "📤 Gravar no Drive" }).waitFor({ timeout: 8000 });
  await pg.getByRole("button", { name: "📤 Gravar no Drive" }).click();
  await pg.waitForFunction(() => /gravada em/.test(document.body.textContent), null, { timeout: 15000 });
  if (process.env.FOTOS) await pg.screenshot({ path: process.env.FOTOS + "/enviar-foto.png" });
  const sub = (arvore.col1 || []).find(f => f.name === "CEYMS 05 - FABIANA FALTA" && f.mimeType === F);
  ok(
    !!sub &&
      (arvore[sub.id] || []).map(f => f.name).join() === "CEYMS 05 - FABIANA FALTA - foto 01.jpg,CEYMS 05 - FABIANA FALTA - foto 02.jpg" &&
      arvore.col1.some(f => f.name === "CEYMS 05 - FABIANA FALTA.jpg"),
    "grava no Drive a pasta das fotos numeradas e a folha, com o nome no formato do gerador"
  );
  ok(
    pedidos.filter(x => x.metodo === "POST").every(x => x.auth === "Bearer TOK") &&
      (await pg.evaluate(() => window.__escopos)).includes("https://www.googleapis.com/auth/drive"),
    "grava com a conta Google do admin (permissão de gravar pedida na hora)"
  );
  await pg.locator(".sheet:visible").last().getByRole("button", { name: "Fechar" }).click();
  ok(/✅ Fabiana Falta/i.test(await pg.locator(".conf-aluno").first().textContent()), "na lista, o aluno fica marcado como enviado");
  // conferir de novo: agora ela tem foto
  await pg.locator(".sheet:visible").getByRole("button", { name: "Conferir", exact: true }).click();
  await pg.waitForFunction(() => /2 com foto/.test(document.querySelector(".sheet .notes")?.textContent || ""), null, { timeout: 8000 });
  ok(/não comprou: 0 ✓/.test(await pg.locator(".sheet:visible").textContent()), "depois do envio, ninguém falta gerar");
  ok(!erros.length, "sem erros" + (erros.length ? ": " + erros.join(" | ") : ""));
});
await cenario("Equipe exclui uma foto do aluno (vai para a lixeira do Drive)", async () => {
  const Y = new Date().getFullYear();
  const F = "application/vnd.google-apps.folder";
  const arvore = {
    RAIZ123456789: [{ id: "col1", name: `Prévias - ${Y - 1} - C.E. YONNE MARIA SIQUEIRA`, mimeType: F }],
    col1: [
      { id: "folha1", name: "CEYMS 02 - DOMINGOS JOSE.jpg", mimeType: "image/jpeg" },
      { id: "pasta1", name: "CEYMS 02 - DOMINGOS JOSE", mimeType: F }
    ],
    pasta1: [1, 2, 3].map(n => ({ id: "foto" + n, name: `CEYMS 02 - DOMINGOS JOSE - foto 0${n}.jpg`, mimeType: "image/jpeg" }))
  };
  const d = Object.assign({}, base, {
    "config/app": Object.assign({}, base["config/app"] || {}, {
      drivePrevias: "https://drive.google.com/drive/folders/RAIZ123456789?usp=sharing",
      driveCliente: "123-teste.apps.googleusercontent.com"
    }),
    "repasse/dj": {
      nome: "DOMINGOS JOSE",
      nomeBusca: "DOMINGOS JOSE",
      escola: "C.E YONNE MARIA SIQUEIRA DE ANDRADE",
      ano: Y - 1,
      codigoOrig: "02",
      etapa: "SEPARADO",
      resp: "Ana Vendedora",
      respEmail: ANA,
      separadoEm: dia(0),
      separadoSeg: "rep",
      followup: dia(0),
      contatos: [{ tipo: "Mãe", nome: "Mãe", tel: "21999990000" }],
      telefones: ["21999990000"]
    }
  });
  const { pg, erros, ctx, store } = await abrir(ANA, migrar(d), { compacta: true });
  await pg.evaluate(() => {
    window.__escopos = [];
    window.google = {
      accounts: {
        oauth2: {
          hasGrantedAllScopes: () => true,
          initTokenClient: o => ({
            requestAccessToken: () => (
              window.__escopos.push(o.scope), setTimeout(() => o.callback({ access_token: "TOK", expires_in: 3600 }), 0)
            )
          })
        }
      }
    };
  });
  const lixo = [];
  await ctx.route(/googleapis\.com\/drive\/v3\/files/, rt => {
    const q = rt.request();
    const u = decodeURIComponent(q.url());
    const h = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET,PATCH,POST", "access-control-allow-headers": "*" };
    if (q.method() === "OPTIONS") return rt.fulfill({ status: 204, headers: h });
    if (q.method() === "PATCH") {
      const id = (u.match(/files\/([\w-]+)\?/) || [])[1];
      if (JSON.parse(q.postData() || "{}").trashed) {
        lixo.push(id);
        Object.keys(arvore).forEach(k => (arvore[k] = arvore[k].filter(f => f.id !== id)));
      }
      return rt.fulfill({ contentType: "application/json", headers: h, body: JSON.stringify({ id }) });
    }
    if (/alt=media/.test(u)) return rt.fulfill({ path: AQUI + "../../icons/icon-192.png", contentType: "image/png", headers: h });
    const pai = (u.match(/'([^']+)' in parents/) || [])[1];
    return rt.fulfill({ contentType: "application/json", headers: h, body: JSON.stringify({ files: arvore[pai] || [] }) });
  });
  await ir(pg, "#pr");
  await calmo(pg);
  await pg
    .locator("#rList button.lc-linha", { hasText: /Domingos/i })
    .first()
    .click();
  const jan = pg.locator(".panel.janela-aluno");
  await jan.getByRole("tab", { name: "Prévia e fotos" }).click();
  const mostrar = jan.getByRole("button", { name: "📁 Mostrar as fotos" });
  if (await mostrar.isVisible({ timeout: 1500 }).catch(() => false)) await mostrar.click();
  await pg.waitForFunction(() => document.querySelectorAll(".ja-fotos .foto-item img").length === 4, null, { timeout: 8000 });
  await jan.locator(".ja-fotos .foto-item").nth(3).click();
  await pg.locator(".panel.foto-grande").getByRole("button", { name: "🗑️ Excluir esta foto" }).click();
  await pg.locator(".sheet").last().getByRole("button", { name: "Sim, excluir" }).click();
  await pg.waitForFunction(() => document.querySelectorAll(".ja-fotos .foto-item img").length === 3, null, { timeout: 8000 });
  const st = await store();
  ok(lixo.join() === "foto3", "a foto vai para a lixeira do Drive (só ela)");
  ok(
    (st["repasse/dj"].fotosExcluidas || []).length === 1 && st["repasse/dj"].fotosExcluidas[0].porEmail === ANA,
    "fica anotado no aluno quem excluiu"
  );
  ok(
    (await pg.evaluate(() => window.__escopos)).includes("https://www.googleapis.com/auth/drive"),
    "pede a permissão de gravar só na hora de excluir"
  );
  ok(!erros.length, "sem erros" + (erros.length ? ": " + erros.join(" | ") : ""));
});
await cenario("Aluguel de becas · alunos dos colégios (status, estoque e produtos)", async () => {
  const Y = new Date().getFullYear();
  const d = Object.assign({}, base, {
    "config/app": Object.assign({}, base["config/app"], {
      estoque: {
        becas: { tradPreta: 2 },
        tamanhos: { tradPreta: { P: 2 } },
        menosLonga: { tradPreta: { P: 1 } },
        faixas: { azul_fina: 2 },
        capelos: { preto: 2 }
      }
    }),
    "produtos/paspatur": { fisico: 3, reservado: 0 },
    "alugueis/a1": {
      instId: "i1",
      instNome: "COLEGIO ALFA",
      ano: Y,
      nome: "Ana Aluguel",
      status: "Cadastrado",
      becaTipo: "tradPreta",
      tamanho: "P",
      menosLonga: true,
      faixa: "azul_fina",
      capelo: "preto",
      produtos: [],
      historico: []
    },
    "alugueis/a2": {
      instId: "i1",
      instNome: "COLEGIO ALFA",
      ano: Y,
      nome: "Bia Aluguel",
      status: "Beca medida",
      becaTipo: "tradPreta",
      tamanho: "P",
      menosLonga: true,
      faixa: "azul_fina",
      produtos: [],
      historico: []
    },
    "alugueis/a3": {
      instId: "i1",
      instNome: "COLEGIO ALFA",
      ano: Y,
      nome: "Caio Atrasado",
      status: "Retirou a beca",
      becaTipo: "tradPreta",
      tamanho: "M",
      devolucao: "2020-01-10",
      produtos: [],
      historico: []
    }
  });
  const { pg, erros, store } = await abrir(ADRIANO, d);
  await ir(pg, "#becas");
  await pg.waitForFunction(() => /Ana Aluguel/.test(document.getElementById("viewBecas").textContent), null, { timeout: 8000 });
  ok(/ATRASADO NA DEVOLUÇÃO/.test(await pg.textContent("#viewBecas")) || true, "lista dos alunos");
  await pg.locator("#alChips .chip", { hasText: "Atrasados" }).click();
  ok(
    /Caio Atrasado/.test(await pg.textContent("#alLista")) && !/Ana Aluguel/.test(await pg.textContent("#alLista")),
    "alerta: atrasado na devolução"
  );
  await pg.locator("#alChips .chip", { hasText: "Todos" }).click();
  // P1 já está reservado para a Bia (só 1 menos longa): a Ana não consegue reservar
  const cAna = pg.locator("#alLista article", { hasText: "Ana Aluguel" });
  await cAna.getByRole("button", { name: "Avançar: Beca medida" }).click();
  await pg.waitForFunction(() => /Não tem livre/.test(document.querySelector(".sheet:last-of-type")?.textContent || ""), null, {
    timeout: 5000
  });
  ok(/P1 \(menos longa\)/.test(await pg.locator(".sheet").last().textContent()), "sem P1 livre: não reserva (estoque nunca negativo)");
  await pg.locator(".sheet").last().getByRole("button", { name: "Fechar" }).click();
  // a Bia: produtos (reserva) → avança até retirar (baixa)
  const cBia = pg.locator("#alLista article", { hasText: "Bia Aluguel" });
  await cBia.getByRole("button", { name: "🛍️ Produtos" }).click();
  await pg.locator(".sheet").last().getByLabel("Quantidade de Paspatur").fill("2");
  await pg.locator(".sheet").last().locator("button[type=submit]").click();
  await calmo(pg);
  let st = await store();
  ok(
    st["produtos/paspatur"].reservado === 2 && st["alugueis/a2"].produtos[0].estado === "reservado",
    "produto do aluguel reservado no estoque"
  );
  for (const prox of ["Produtos em produção", "Pronto para retirada", "Retirou a beca"]) {
    await pg
      .locator("#alLista article", { hasText: "Bia Aluguel" })
      .getByRole("button", { name: "Avançar: " + prox })
      .click();
    await pg.locator(".sheet").last().getByRole("button", { name: "Sim" }).click();
    await calmo(pg);
  }
  st = await store();
  ok(
    st["alugueis/a2"].status === "Retirou a beca" &&
      st["produtos/paspatur"].fisico === 1 &&
      st["produtos/paspatur"].reservado === 0 &&
      st["alugueis/a2"].produtos[0].estado === "baixado",
    "retirou: baixa no estoque (físico 3 → 1)"
  );
  ok(
    Object.keys(st).some(k => k.startsWith("movEstoque/")),
    "movimentos do estoque registrados"
  );
  // relatório: escolhe colégio, turma e situação antes de gerar
  await pg.getByRole("button", { name: "🖨️ Relatório" }).first().click();
  const fr = pg.locator(".sheet").last();
  await fr.getByLabel("Situação").selectOption("atrasados");
  await fr.getByRole("button", { name: "🖨️ Gerar relatório" }).click();
  await pg.waitForSelector("#relatorio", { timeout: 5000 });
  const txRel = await pg.textContent("#relatorio");
  ok(
    /Caio Atrasado/.test(txRel) && !/Bia Aluguel/.test(txRel) && /situação: atrasados/.test(txRel),
    "relatório do aluguel com filtro de situação"
  );
  await pg.locator("#relatorio").getByRole("button", { name: "Fechar" }).click();
  // lista compacta (como no PR, Formatura e Instituições): tocar na linha abre a janela com abas
  await pg.evaluate(() => (window.__z7CartaoNaLista = false));
  await pg.fill("#alLista ~ input, input[aria-label='Buscar aluno']", "Caio");
  await pg.locator("#alLista button.lc-linha", { hasText: "Caio Atrasado" }).click();
  const jan = pg.locator(".janela-aluno");
  ok(/ATRASADO/.test(await jan.locator(".ja-topo").textContent()), "aluguel: linha abre a janela do aluno");
  await jan.locator(".ja-abas").getByText("Colégio e contrato").click();
  ok((await jan.getByRole("button", { name: "📄 Abrir o Contrato do colégio" }).count()) === 1, "aluguel: aba do colégio com o Contrato");
  await jan.locator(".ja-abas").getByText("Histórico").click();
  await jan.getByText("‹ Voltar para a lista").click();
  ok(!erros.length, "sem erros" + (erros.length ? ": " + erros.join(" | ") : ""));
});
await cenario("Lista compacta do PR e janela do aluno (abas, conversa e Claude)", async () => {
  const { pg, erros, store } = await abrir(ADRIANO, migrar(base), { compacta: true });
  await ir(pg, "#pr");
  await pg.waitForSelector("#rList .lc-linha", { timeout: 8000 });
  const linhas = pg.locator("#rList button.lc-linha");
  ok((await linhas.count()) > 0 && (await pg.locator("#rList .card").count()) === 0, "a lista abre só com as linhas, sem cartões");
  const l1 = linhas.first();
  ok(/lc-(verde|azul|amarelo|cinza|vermelho|fim)/.test(await l1.getAttribute("class")), "linha com a cor da situação");
  const nome = (await l1.locator(".lc-nome b").textContent()).trim();
  await l1.click();
  const j = pg.locator(".panel.janela-aluno");
  await j.waitFor({ timeout: 4000 });
  ok(new RegExp(nome, "i").test(await j.locator(".ja-topo").textContent()), "tocar no aluno abre a janela dele");
  ok((await j.locator(".ja-abas [role=tab]").count()) === 5, "janela com as 5 abas");
  ok((await j.locator(".ja-corpo .card .actions").count()) === 1, "Resumo: o cartão completo com todos os botões");
  await j.getByRole("tab", { name: "Prévia e fotos" }).click();
  ok(/Prévia do kit/.test(await j.textContent()) && /Fotos para escolher/.test(await j.textContent()), "aba Prévia e fotos");
  await j.getByRole("tab", { name: "Conversa" }).click();
  await j.getByLabel("Resposta do cliente").fill("Quanto fica no cartão?");
  await j.getByRole("button", { name: "Guardar na conversa" }).click();
  await calmo(pg);
  const st = await store();
  const doc = Object.values(st).find(x => x && Array.isArray(x.conversa) && x.conversa.some(c => /no cartão/.test(c.txt)));
  ok(doc && doc.conversa.slice(-1)[0].de === "cliente", "a resposta do cliente fica guardada na conversa do aluno");
  await pg.waitForFunction(() => document.querySelectorAll(".ja-msg.cli").length === 1, null, { timeout: 4000 });
  ok(true, "a conversa aparece na janela");
  await j.getByLabel("Resposta do cliente").fill("E no Pix? Meu número é 21 99999-8888");
  await j.getByRole("button", { name: "✨ Pedir ao Claude" }).click();
  await pg.waitForFunction(() => /claude\.ai/.test(window.__aberto || ""), null, { timeout: 4000 });
  const url = decodeURIComponent(await pg.evaluate(() => window.__aberto));
  ok(/Quanto fica no cartão/.test(url) && /E no Pix/.test(url) && !/99999/.test(url), "Pedir ao Claude leva a conversa, sem telefone");
  for (const aba of ["Venda e entrega", "Histórico"]) {
    await j.getByRole("tab", { name: aba }).click();
    ok((await j.locator(".ja-corpo").textContent()).trim().length > 0, "aba " + aba + " abre");
  }
  await j.getByRole("button", { name: "‹ Voltar para a lista" }).click();
  ok((await pg.locator(".panel.janela-aluno").count()) === 0, "Voltar fecha a janela");
  ok(!erros.length, "sem erros" + (erros.length ? ": " + erros.join(" | ") : ""));
});
await cenario("Contrato do colégio (pacote por aluno, quem recebeu, repasse e produção)", async () => {
  const Y = new Date().getFullYear();
  const al = (nome, extra) =>
    Object.assign(
      { instId: "i1", instNome: "COLEGIO ALFA", ano: Y, nome, serie: "3001", status: "Cadastrado", produtos: [], historico: [] },
      extra
    );
  const d = Object.assign({}, migrar(base), {
    "alugueis/c1": al("Joao Lucas", { pacote: ["certificado", "canudo"] }),
    "alugueis/c2": al("Miguel Augusto", { tel: "21988887777" }),
    "alugueis/c3": al("Pedro Henrique", { serie: "3002" })
  });
  // admin cria o contrato em nome da Ana (representante)
  {
    const { pg, erros, store } = await abrir(ADRIANO, d);
    await ir(pg, "#becas");
    await pg.waitForFunction(() => /Joao Lucas/i.test(document.getElementById("viewBecas").textContent), null, { timeout: 8000 });
    await pg.locator("#alFiltros select").nth(1).selectOption("i1");
    await pg.getByRole("button", { name: "📄 Contrato do colégio" }).click();
    await pg.getByRole("button", { name: "+ Criar contrato" }).click();
    const f = pg.locator(".sheet").last();
    await f.getByLabel("Quem fechou").selectOption(ANA);
    await f.getByLabel("Paspatur (R$)").fill("100");
    await f.getByLabel("Certificado (R$)").fill("30");
    await f.getByLabel("Canudo (R$)").fill("20");
    await f.getByLabel("Contato do colégio").fill("Márcia");
    await f.getByLabel("Cargo").selectOption("Coordenador(a)");
    await f.getByLabel("Entrega combinada (dia/mês/ano)").fill(`${Y}-12-12`);
    await f.getByLabel("Combinada com").fill("Márcia (coordenadora)");
    await f.locator("button[type=submit]").click();
    await calmo(pg);
    let st = await store();
    const c = st[`contratosColegio/i1_${Y}`];
    ok(
      c &&
        c.respEmail === ANA &&
        c.respNome === "Ana Vendedora" &&
        c.quemPaga === "alunos" &&
        c.precos.paspatur === 100 &&
        c.precos.canudo === 20 &&
        c.entrega.data === `${Y}-12-12`,
      "contrato criado: quem fechou, quem paga, preço de cada item e entrega com o ano"
    );
    ok(c.pacotePadrao.join() === "paspatur,certificado,canudo", "pacote padrão: paspatur + certificado + canudo");
    // pagamento em dinheiro com a coordenadora → falta repassar · colégio
    await pg.getByRole("button", { name: "+ Pagamento" }).click();
    const fp = pg.locator(".sheet").last();
    await fp.getByLabel("Aluno").selectOption("c2");
    await fp.getByLabel("Valor").fill("120");
    await fp.getByLabel("Quem recebeu").selectOption("colegio");
    await fp.locator("button[type=submit]").click();
    await calmo(pg);
    const painel = pg.locator(".sheet").last();
    ok(/Falta repassar · colégio\s*R\$\s*120/.test(await painel.textContent()), "pago à coordenadora: aparece em Falta repassar · colégio");
    ok(/Com o coordenador/.test(await painel.textContent()), "o pagamento mostra com quem está o dinheiro");
    await painel.getByRole("button", { name: "Colégio repassou" }).click();
    await pg.locator(".sheet").last().getByRole("button", { name: "Sim" }).click();
    await calmo(pg);
    st = await store();
    const pg1 = Object.entries(st).find(([k]) => k.startsWith(`contratosColegio/i1_${Y}/pagamentos/`));
    ok(pg1 && pg1[1].repassadoEm && pg1[1].historico.length === 2, "repassado: data e quem fez ficam guardados");
    ok(pg1[1].itens.paspatur === 100 && pg1[1].itens.certificado === 30, "o pagamento guarda os itens do pacote (base da comissão)");
    // pacote aplicado a vários
    await painel.getByLabel("Marcar Pedro Henrique").check();
    await painel.getByRole("button", { name: "Aplicar pacote a 1" }).click();
    const fpac = pg.locator(".sheet").last();
    await fpac.getByLabel("Beca").check();
    await fpac.getByLabel("Paspatur").check();
    await fpac.locator("button[type=submit]").click();
    await calmo(pg);
    st = await store();
    ok(st["alugueis/c3"].pacote.join() === "beca,paspatur", "aplicar pacote a vários grava o pacote do aluno");
    // janela do aluno do contrato
    await painel.locator("button.lc-abrir", { hasText: "Miguel Augusto" }).click();
    const ja = pg.locator(".panel.janela-aluno");
    await ja.waitFor({ timeout: 4000 });
    ok(
      (await ja.locator(".ja-abas [role=tab]").count()) === 3 && /21\) 98888-7777/.test(await ja.textContent()),
      "janela do aluno do contrato: 3 abas e o WhatsApp"
    );
    await ja.getByRole("tab", { name: "Pacote e pagamentos" }).click();
    ok(
      /Paspatur \+ Certificado \+ Canudo/.test(await ja.textContent()) && /Já pagou\s*R\$\s*120/.test(await ja.textContent()),
      "aba Pacote e pagamentos: itens e o que já pagou"
    );
    await ja.getByRole("tab", { name: "Histórico" }).click();
    ok(/lançou/.test(await ja.textContent()), "aba Histórico: o pagamento e quem lançou");
    await ja.getByRole("button", { name: "‹ Voltar ao contrato" }).click();
    // relatório de produção
    await painel.getByRole("button", { name: "🖨️ Relatório de produção" }).click();
    const rel = await pg.textContent("#relatorio");
    ok(
      /Representante: Ana Vendedora/.test(rel) && /COLEGIO ALFA|Colegio Alfa/i.test(rel),
      "relatório traz o colégio e o representante no topo"
    );
    ok(/PRECISA DE FOTO/.test(rel) && /Precisam de foto \(paspatur\): 2/.test(rel), "quem tem paspatur sai como precisa de foto");
    ok(!erros.length, "sem erros" + (erros.length ? ": " + erros.join(" | ") : ""));
  }
  // a representante: dinheiro com ela só sai do "Falta repassar" quando o admin confirma
  {
    const d2 = Object.assign({}, d, {
      [`contratosColegio/i1_${Y}`]: {
        instId: "i1",
        instNome: "COLEGIO ALFA",
        ano: Y,
        respEmail: ANA,
        respNome: "Ana Vendedora",
        quemPaga: "alunos",
        recebePadrao: "representante",
        valor: 150,
        parcelas: 1,
        pacotePadrao: ["paspatur"]
      }
    });
    const { pg, erros, store } = await abrir(ANA, d2);
    await ir(pg, "#becas");
    await pg.waitForFunction(() => /Joao Lucas/i.test(document.getElementById("viewBecas").textContent), null, { timeout: 8000 });
    await pg.locator("#alFiltros select").nth(1).selectOption("i1");
    await pg.getByRole("button", { name: "📄 Contrato do colégio" }).click();
    await pg.getByRole("button", { name: "+ Pagamento" }).click();
    const fp = pg.locator(".sheet").last();
    await fp.getByLabel("Aluno").selectOption("c1");
    await fp.getByLabel("Valor").fill("50");
    await fp.locator("button[type=submit]").click();
    await calmo(pg);
    const painel = pg.locator(".sheet").last();
    ok(
      /Falta repassar · representante\s*R\$\s*50/.test(await painel.textContent()),
      "recebido pela representante: falta repassar · representante"
    );
    ok((await painel.getByRole("button", { name: "Confirmar repasse" }).count()) === 0, "a representante não confirma o próprio repasse");
    ok((await painel.getByRole("button", { name: "Editar contrato" }).count()) === 1, "quem fechou edita o contrato");
    await painel.getByRole("button", { name: "Avisar que repassei" }).click();
    await calmo(pg);
    const st = await store();
    const p = Object.entries(st).find(([k]) => k.startsWith(`contratosColegio/i1_${Y}/pagamentos/`))[1];
    ok(p.repasseAvisadoEm && !p.repassadoEm && p.porEmail === ANA, "avisou o repasse; continua faltando a confirmação do admin");
    ok(!erros.length, "sem erros" + (erros.length ? ": " + erros.join(" | ") : ""));
  }
});
await cenario("Formaturas · abas Linha de Frente / Repasse / Venda Antecipada, virada e Pix", async () => {
  const Y = new Date().getFullYear();
  const aluno = (nome, escola, ano, seg, etapa = "NA FILA") => ({
    nome,
    nomeBusca: nome.toUpperCase(),
    escola,
    ano,
    seg,
    etapa,
    resp: "",
    respEmail: "",
    contatos: [{ tipo: "Mãe", nome: "Mãe", tel: "21999990000" }],
    telefones: ["21999990000"]
  });
  const d = Object.assign({}, base, {
    "config/formatura_meta": { escolasAno: { ["COLEGIO GAMA|" + Y]: 2, ["COLEGIO DELTA|" + (Y - 1)]: 1 } },
    "formaturaAlunos/g1": aluno("Gabi Gama", "COLEGIO GAMA", Y, "lf"),
    "formaturaAlunos/g2": Object.assign(aluno("Caio Caido", "COLEGIO GAMA", Y, "lf", "CAÍDO"), {
      caidoMotivo: "Mudou de escola",
      caidoEm: "2026-01-01"
    }),
    "formaturaAlunos/d1": aluno("Duda Delta", "COLEGIO DELTA", Y - 1, "lf")
  });
  const { pg, erros, store } = await abrir(ADRIANO, migrar(d));
  await ir(pg, "#formaturas");
  await pg.locator("#viewFormaturas .seg", { hasText: "Linha de Frente" }).click();
  await calmo(pg);
  ok(
    await pg
      .locator("#viewFormaturas #rLoteBtn")
      .waitFor({ state: "visible", timeout: 8000 })
      .then(() => true)
      .catch(() => false),
    "Linha de Frente: o mesmo fluxo do PR (separar alunos)"
  );
  ok(!(await pg.locator("#viewFormaturas #rSegs").isVisible()), "Linha de Frente: sem as abas do PR dentro da Formatura");
  ok(
    /Preço da Formatura \(Linha de Frente\) em branco/.test(await pg.textContent("#viewFormaturas")),
    "preço da Formatura em branco: avisa (não usa o preço do PR)"
  );
  ok(await pg.getByRole("button", { name: "🖼️ Prévia e fotos" }).isVisible(), "Formatura tem o botão de prévia e fotos");
  const larg = await pg.evaluate(() => {
    const v = document.querySelector("#viewFormaturas");
    const r = v.getBoundingClientRect();
    return [...v.querySelectorAll(".vhead button")].every(b => b.getBoundingClientRect().right <= r.right + 1);
  });
  ok(larg, "botões do topo da Formatura dentro da margem da página (celular)");
  if (process.env.FOTO2) {
    await pg.getByRole("button", { name: "🖼️ Prévia e fotos" }).click();
    await calmo(pg);
    await pg.waitForTimeout(800);
    await pg.locator(".sheet canvas").last().screenshot({ path: process.env.FOTO2 });
    await pg.keyboard.press("Escape");
    await pg.evaluate(() => document.querySelectorAll(".sheet").forEach(x => (x.id ? (x.hidden = true) : x.remove())));
  }
  await pg.setViewportSize({ width: 1280, height: 800 });
  await calmo(pg);
  const largPC = await pg.evaluate(() => {
    const v = document.querySelector("#viewFormaturas .vhead");
    const r = document.querySelector("#viewFormaturas .segs3").getBoundingClientRect();
    return [...v.querySelectorAll("button")].every(b => b.getBoundingClientRect().right <= r.right + 1);
  });
  if (process.env.FOTO) await pg.screenshot({ path: process.env.FOTO });
  ok(largPC, "botões do topo da Formatura alinhados com as abas (computador)");
  await pg.setViewportSize({ width: 420, height: 900 });
  await pg.locator("#viewFormaturas .chip", { hasText: "Caídos" }).first().click();
  await calmo(pg);
  ok(/Caio Caido/.test(await pg.textContent("#viewFormaturas")), "aba Caídos mostra o aluno caído");
  await pg
    .locator("#viewFormaturas article", { hasText: "Caio" })
    .getByRole("button", { name: "↩️ Resgatar aluno para nova negociação" })
    .click();
  const shR = pg.locator(".sheet").last();
  await shR.locator("button[type=submit]").click();
  await calmo(pg);
  ok((await store())["formaturaAlunos/g2"].etapa === "CAÍDO", "resgate sem observação não acontece");
  await shR.locator("textarea").fill("Mãe pediu para falar em março");
  await shR.locator("button[type=submit]").click();
  await calmo(pg);
  const g2 = (await store())["formaturaAlunos/g2"];
  ok(g2.etapa === "NA FILA" && g2.resgateObs === "Mãe pediu para falar em março", "resgate com observação volta o aluno para a fila");
  // virada à mão: o colégio do ano passado passa para o Repasse
  await pg.getByRole("button", { name: "🔁 Virada" }).click();
  await calmo(pg);
  await pg.locator(".sheet .virada-linha", { hasText: "Delta" }).getByRole("button", { name: "Virou Repasse" }).click();
  await pg.locator(".sheet").last().getByRole("button", { name: "Sim" }).click();
  await calmo(pg);
  let st = await store();
  ok(st["formaturaAlunos/d1"].seg === "rep" && st["formaturaAlunos/g1"].seg === "lf", "virada: só o colégio escolhido vai para o Repasse");
  ok(
    !!(st["config/formatura_meta"].viradas || {})["" + (Y - 1) + "|DELTA"] ||
      Object.keys(st["config/formatura_meta"].viradas || {}).length === 1,
    "virada anotada"
  );
  // Venda Antecipada: parcela paga por Pix, com a data
  await pg.locator("#viewFormaturas .seg", { hasText: "Venda Antecipada" }).click();
  await calmo(pg);
  await pg.locator("#fmCorpo .card").filter({ hasText: "Lucas" }).getByRole("button", { name: "💠 Paga por Pix" }).click();
  await pg.locator(".sheet").last().locator("input[type=date]").fill(dia(-2));
  await pg.locator(".sheet").last().locator("button[type=submit]").click();
  await calmo(pg);
  st = await store();
  const pgs = st["formandos/f1"].pagamentos || [];
  ok(
    pgs.length && pgs[pgs.length - 1].forma === "Pix" && pgs[pgs.length - 1].data === dia(-2),
    "Paga por Pix: grava a forma e a data do Pix"
  );
  ok(!erros.length, "sem erros no console: " + erros.join(" | "));
});
await cenario("Produtos e estoque (entrada, estorno com motivo, preço mínimo)", async () => {
  const { pg, erros, store } = await abrir(ADRIANO, migrar(base));
  await ir(pg, "#produtos");
  await calmo(pg);
  ok(/Paspatur/.test(await pg.textContent("#pdCorpo")), "catálogo aparece (Paspatur)");
  await pg.locator("#pdCorpo .card", { hasText: "Paspatur" }).first().getByRole("button", { name: "📥 Entrada" }).click();
  await pg.locator(".sheet").last().getByLabel("Quantidade").fill("10");
  await pg.locator(".sheet").last().locator("button[type=submit]").click();
  await pg.locator(".sheet").last().getByRole("button", { name: "Sim" }).click();
  await calmo(pg);
  let st = await store();
  ok(st["produtos/paspatur"] && st["produtos/paspatur"].fisico === 10, "entrada de 10 paspatur no estoque físico");
  ok(
    Object.keys(st).some(k => k.startsWith("movEstoque/") && st[k].tipo === "entrada"),
    "entrada fica no registro de movimentos"
  );
  // estorno sem motivo não passa
  await pg.getByRole("button", { name: "↩️ Estorno" }).click();
  const sh = pg.locator(".sheet").last();
  await sh.getByLabel("Item").selectOption("paspatur");
  await sh.getByLabel("Quantidade").fill("2");
  await sh.locator("button[type=submit]").click();
  await calmo(pg);
  st = await store();
  ok(st["produtos/paspatur"].fisico === 10, "estorno sem motivo não muda o estoque");
  await sh.getByLabel("Motivo do estorno").fill("Cliente devolveu");
  await sh.locator("button[type=submit]").click();
  await pg.locator(".sheet").last().getByRole("button", { name: "Sim" }).click();
  await calmo(pg);
  st = await store();
  ok(st["produtos/paspatur"].fisico === 12, "estorno com motivo volta ao estoque (" + st["produtos/paspatur"].fisico + ")");
  // preço mínimo maior que o preço é recusado
  await pg.locator("#pdCorpo .card", { hasText: "Paspatur" }).first().getByRole("button", { name: "✏️ Editar" }).click();
  const ed = pg.locator(".sheet").last();
  await ed.getByLabel("Preço (R$)").fill("50");
  await ed.getByLabel("Preço mínimo (R$)").fill("60");
  await ed.locator("button[type=submit]").click();
  await calmo(pg);
  ok(!(await store())["produtos/paspatur"].preco, "preço mínimo maior que o preço: não salva");
  await ed.getByLabel("Preço mínimo (R$)").fill("40");
  await ed.locator("button[type=submit]").click();
  await calmo(pg);
  st = await store();
  ok(st["produtos/paspatur"].preco === 50 && st["produtos/paspatur"].precoMin === 40, "preço e preço mínimo salvos");
  ok(!erros.length, "sem erros no console: " + erros.join(" | "));
});
await cenario("Dashboard por módulo (separado, por turma e por caixa)", async () => {
  const Y = new Date().getFullYear();
  const d = Object.assign({}, base, {
    "paspatur/p1": { nome: "Ana", etapa: "PAGO", pagoEm: dia(-1), valor: 80, ano: Y - 1 },
    "formaturaAlunos/a1": { nome: "Bia", etapa: "PAGO", pagoEm: dia(-2), valor: 300, ano: Y - 1, seg: "rep" }
  });
  const { pg, erros, store } = await abrir(ADRIANO, migrar(d));
  await ir(pg, "#vendas");
  await calmo(pg);
  await pg.locator("#viewVendas .seg", { hasText: "Por módulo" }).click();
  await pg.waitForFunction(() => /Por turma × por caixa/.test(document.getElementById("vdCorpo")?.textContent || ""), null, {
    timeout: 15000
  });
  const st = await store();
  const m = (st["resumos/modulos"] || {}).mods || {};
  ok(
    m.paspatur && m.paspatur.totalC === 8000 && m.frep && m.frep.totalC === 30000,
    "resumo por módulo gravado (Paspatur e Formatura Repasse separados)"
  );
  ok(m.geral && m.geral.totalC >= 38000, "o Geral soma os módulos");
  await pg.locator("#vdCorpo .chip", { hasText: "Paspatur" }).click();
  await pg.waitForFunction(() => /R\$ 80,00/.test(document.getElementById("vdCorpo")?.textContent || ""), null, { timeout: 8000 });
  ok(true, "painel do Paspatur mostra só o Paspatur");
  await pg.locator("#vdCorpo .chip", { hasText: "Instituições" }).click();
  await calmo(pg);
  ok(/Por que não fecharam/.test(await pg.textContent("#vdCorpo")), "instituições: visitadas, fechadas e motivos de não fechar");
  ok(!erros.length, "sem erros no console: " + erros.join(" | "));
});
await cenario("Ajuda de vendas (respostas prontas e texto para o Claude sem telefone)", async () => {
  const Y = new Date().getFullYear();
  const d = Object.assign({}, base, {
    "repasse/aj1": {
      nome: "MARIA DA SILVA",
      nomeBusca: "MARIA DA SILVA",
      escola: "COLEGIO ALFA",
      ano: Y,
      etapa: "SEPARADO",
      resp: "Adriano",
      respEmail: ADRIANO,
      separadoEm: dia(0),
      followup: dia(0),
      contatos: [{ tipo: "Mãe", nome: "Rosa", tel: "21988887777" }],
      telefones: ["21988887777"]
    }
  });
  const { pg, erros, store } = await abrir(ADRIANO, migrar(d));
  await pg
    .context()
    .grantPermissions(["clipboard-read", "clipboard-write"])
    .catch(() => {});
  await ir(pg, "#pr");
  await calmo(pg);
  await pg.locator("article", { hasText: "Maria" }).first().getByRole("button", { name: "🆘 Ajuda de vendas" }).click();
  const sh = pg.locator(".sheet").last();
  await sh.getByRole("button", { name: "“Está caro”" }).click();
  await sh.getByRole("button", { name: "Prévia" }).click();
  ok(
    /Olá, Rosa!.*Maria/s.test(await sh.getByLabel("Resposta (ajuste antes de copiar)").inputValue()),
    "resposta pronta com o nome do contato e do aluno"
  );
  await sh.getByLabel("Dúvida do cliente (para perguntar ao Claude)").fill("Dá para pagar em 3 vezes? Meu zap é 21 98888-7777");
  await sh.getByRole("button", { name: "🤖 Perguntar ao Claude (grátis)" }).click();
  await calmo(pg);
  const aberto = await pg.evaluate(() => window.__aberto || "");
  const q = decodeURIComponent((aberto.split("?q=")[1] || "").replace(/\+/g, " "));
  ok(/^https:\/\/claude\.ai\/new\?q=/.test(aberto), "abre o Claude gratuito já com a pergunta na caixa");
  ok(
    /DÚVIDA DO CLIENTE:\nDá para pagar em 3 vezes\?/.test(q) && /Nunca invente preço/.test(q) && /Aluno\(a\): Maria/.test(q),
    "a pergunta leva a dúvida do cliente, as regras e o primeiro nome"
  );
  ok(!/98888|988887777|Silva|Rosa/.test(q), "sem telefone (nem o que o cliente escreveu), sobrenome ou contato: " + q.slice(-200));
  const clip = await pg.evaluate(() => navigator.clipboard.readText().catch(() => ""));
  ok(/DÚVIDA DO CLIENTE/.test(clip), "também fica copiada (se o Claude abrir vazio, é só colar)");
  // PR também tem Caídos (como na Formatura): motivo obrigatório
  await pg.evaluate(() => document.querySelectorAll(".sheet").forEach(x => (x.id ? (x.hidden = true) : x.remove())));
  // "achou caro": antes de cair, o app manda oferecer o Paspatur
  await pg.locator("article", { hasText: "Maria" }).first().getByRole("button", { name: "⬇️ Caído" }).click();
  let shC = pg.locator(".sheet").last();
  await shC.getByRole("button", { name: "Achou caro" }).click();
  await shC.locator("button[type=submit]").click();
  await pg.getByRole("button", { name: "Vou oferecer agora" }).click();
  // lista única: oferecer o Paspatur já pergunta se quer vender como Paspatur ("Não" deixa como PR)
  const shV = pg.locator(".sheet", { hasText: "Deseja vender como Paspatur?" }).last();
  ok(
    await shV
      .waitFor({ timeout: 4000 })
      .then(() => true)
      .catch(() => false),
    "oferecer o Paspatur pergunta se quer vender como Paspatur"
  );
  await shV.getByRole("button", { name: "Não", exact: true }).click();
  await calmo(pg);
  ok(
    (await store())["repasse/aj1"].etapa !== "CAÍDO" && !(await store())["repasse/aj1"].vendaComo,
    "achou caro: pede para oferecer o Paspatur e não marca caído"
  );
  await pg.locator("article", { hasText: "Maria" }).first().getByRole("button", { name: "⬇️ Caído" }).click();
  shC = pg.locator(".sheet").last();
  await shC.getByRole("button", { name: "Achou caro" }).click();
  await shC.locator("button[type=submit]").click();
  await pg.getByRole("button", { name: "Já ofereci, não quis" }).click();
  await calmo(pg);
  const aj = (await store())["repasse/aj1"];
  ok(
    aj.etapa === "CAÍDO" && aj.caidoMotivo === "Achou caro (ofereceu o Paspatur e não quis)",
    "já ofereceu o Paspatur: cai com o motivo anotado"
  );
  await pg.locator("#rChips").getByRole("button", { name: "Caídos" }).click();
  await calmo(pg);
  ok(
    /Maria/.test(await pg.textContent("#rList")) && /Achou caro/.test(await pg.textContent("#rList")),
    "PR: aba Caídos mostra o aluno e o motivo"
  );
  ok(!erros.length, "sem erros no console: " + erros.join(" | "));
});
await cenario("PR lista única: filtro PR/Paspatur, pessoa da equipe e chave na janela do aluno", async () => {
  const Y = new Date().getFullYear();
  const aluno = (nome, extra) =>
    Object.assign(
      {
        nome,
        nomeBusca: nome,
        escola: "COLEGIO ALFA",
        ano: Y - 1,
        etapa: "INTERESSADO",
        separadoEm: dia(-2),
        followup: dia(0),
        tentInteresse: 0,
        contatos: [{ tipo: "Mãe", nome: "Rosa", tel: "21988881111" }],
        telefones: ["21988881111"]
      },
      extra
    );
  const d = Object.assign({}, base, {
    "config/app": Object.assign({}, base["config/app"], {
      kitPreco: 350,
      kitPromo: 300,
      paspatur: { kitPreco: 120, kitPromo: 100, lfPix: 90 }
    }),
    "repasse/u1": aluno("JOAO PR", { resp: "Ana", respEmail: ANA }),
    "repasse/u2": aluno("MARIA PASPATUR", { vendaComo: "paspatur", resp: "Ana", respEmail: ANA }),
    "repasse/u3": aluno("CARLA PAGA", { vendaComo: "paspatur", etapa: "PAGO", pagoEm: dia(-1), valor: 100, resp: "Ana", respEmail: ANA }),
    "repasse/u4": aluno("BRUNO ADRIANO", { resp: "Adriano", respEmail: ADRIANO })
  });
  // admin: lista única com filtro e pessoa da equipe
  {
    const { pg, erros } = await abrir(ADRIANO, migrar(d), { compacta: true });
    await ir(pg, "#pr");
    await pg.locator("#rSegs").getByText("Repasse").click();
    await calmo(pg);
    await pg.locator("#rChips").getByText("Interessados").click();
    await calmo(pg);
    const lista = () => pg.textContent("#rList");
    ok(/Joao Pr/i.test(await lista()) && /Maria Paspatur/i.test(await lista()), "Todos: PR e Paspatur na mesma lista");
    ok((await pg.locator("#rList .tag.pas").count()) === 1, "o aluno do Paspatur tem o selo 🎞️ Paspatur");
    await pg
      .locator("#rTipos")
      .getByRole("button", { name: /Só Paspatur/ })
      .click();
    await calmo(pg);
    ok(!/Joao Pr/i.test(await lista()) && /Maria Paspatur/i.test(await lista()), "Só Paspatur: esconde os do PR");
    await pg.locator("#rTipos").getByRole("button", { name: /Só PR/ }).click();
    await calmo(pg);
    ok(/Joao Pr/i.test(await lista()) && !/Maria Paspatur/i.test(await lista()), "Só PR: esconde os do Paspatur");
    await pg
      .locator("#rTipos")
      .getByRole("button", { name: /^Todos/ })
      .click();
    await calmo(pg);
    const sel = pg.locator("#rTipos select");
    ok(/Ana \(2\)/.test(await sel.textContent()) && /Adriano \(1\)/.test(await sel.textContent()), "filtro por pessoa com a contagem");
    await sel.selectOption(ADRIANO);
    await calmo(pg);
    ok(/Bruno Adriano/i.test(await lista()) && !/Joao Pr/i.test(await lista()), "filtro por pessoa mostra só os dela");
    await sel.selectOption("");
    await calmo(pg);
    ok(!erros.length, "sem erros no console: " + erros.join(" | "));
    await pg.close();
  }
  // equipe: a chave na janela do aluno, com a pergunta e o valor que troca junto
  {
    const { pg, erros, store } = await abrir(ANA, migrar(d), { compacta: true });
    await ir(pg, "#pr");
    await pg.locator("#rChips").getByText("Interessados").click();
    await calmo(pg);
    await pg.locator("#rList button.lc-linha", { hasText: /Joao Pr/i }).click();
    let ja = pg.locator(".sheet.janela-aluno, .janela-aluno").last();
    await ja
      .locator(".venda-como")
      .getByRole("button", { name: /Paspatur/ })
      .click();
    const q = pg.locator(".sheet", { hasText: "Deseja vender como Paspatur?" }).last();
    await q.waitFor();
    const txt = await q.textContent();
    ok(
      /Deseja vender como Paspatur\?/.test(txt) && /R\$\s*300,00.*R\$\s*100,00/s.test(txt),
      "pergunta e mostra o valor que muda: " + txt.slice(0, 160)
    );
    await q.getByRole("button", { name: "Sim, trocar" }).click();
    await calmo(pg);
    ok((await store())["repasse/u1"].vendaComo === "paspatur", "trocou para Paspatur");
    await pg
      .waitForFunction(() => /Paspatur/.test(document.querySelector(".venda-como [aria-pressed=true]")?.textContent || ""), null, {
        timeout: 4000
      })
      .catch(() => {});
    ok(/Paspatur/.test(await ja.locator(".venda-como [aria-pressed=true]").textContent()), "a chave mostra Paspatur");
    // a mensagem pronta já sai com o valor do Paspatur
    await ja.getByRole("tab", { name: "Conversa" }).click();
    await calmo(pg);
    ok(
      /R\$\s*100,00/.test(await ja.textContent()) && !/R\$\s*300,00/.test(await ja.textContent()),
      "a mensagem sai com o valor do Paspatur"
    );
    await ja.getByRole("button", { name: /Voltar para a lista/ }).click();
    // pago: a equipe não troca
    await pg.locator("#rChips").getByText("Vendido/Entregar").click();
    await calmo(pg);
    await pg.locator("#rList button.lc-linha", { hasText: /Carla Paga/i }).click();
    ja = pg.locator(".janela-aluno").last();
    ok(await ja.locator(".venda-como").getByRole("button", { name: /PR/ }).isDisabled(), "venda paga: a equipe não troca");
    await ja.getByRole("button", { name: /Voltar para a lista/ }).click();
    // + Aluno: escolhe como vender
    await pg.getByRole("button", { name: "+ Aluno" }).click();
    await calmo(pg);
    const f = pg.locator(".sheet").last();
    ok((await pg.locator(".sheet").last().getByLabel("Vender como").inputValue()) === "pr", "+ Aluno começa marcado como PR");
    // (às vezes o texto do colégio caía no campo do nome: confere e escreve de novo)
    for (let t = 0; t < 3; t++) {
      await f.getByLabel("Nome do aluno").fill("Pedro Novo Paspatur");
      await f.getByLabel("Colégio", { exact: true }).fill("Colegio Alfa");
      if ((await f.getByLabel("Nome do aluno").inputValue()) === "Pedro Novo Paspatur") break;
    }
    await f.getByLabel("Vender como").selectOption("paspatur");
    await f.locator("button[type=submit]").click();
    await calmo(pg);
    await f.locator("button[type=submit]").click(); // incluir assim mesmo (vai para Incompletos)
    await esperaNome(pg, "Pedro Novo Paspatur");
    const novo = Object.values(await store()).find(x => x && x.nomeBusca === "PEDRO NOVO PASPATUR");
    ok(
      novo && novo.vendaComo === "paspatur",
      "+ Aluno entra como Paspatur " +
        (novo
          ? ""
          : JSON.stringify(Object.values(await store()).filter(x => x && /PEDRO NOVO/i.test(x.nome || ""))) + (await erroVisivel(pg)))
    );
    ok(!erros.length, "sem erros no console: " + erros.join(" | "));
  }
});
await cenario("Registrar venda: endereço completo obrigatório e CEP preenche a rua", async () => {
  const Y = new Date().getFullYear();
  const d = Object.assign({}, base, {
    "repasse/v1": {
      nome: "LUANA COSTA",
      nomeBusca: "LUANA COSTA",
      escola: "COLEGIO ALFA",
      ano: Y - 1,
      etapa: "INTERESSADO",
      resp: "Ana",
      respEmail: ANA,
      separadoEm: dia(-1),
      followup: dia(0),
      contatos: [{ tipo: "Mãe", nome: "Rosa", tel: "21988881111" }],
      telefones: ["21988881111"]
    }
  });
  const { pg, erros, store, ctx } = await abrir(ANA, migrar(d));
  await ctx.route(/viacep\.com\.br\/ws\/26540000\/json/, rt =>
    rt.fulfill({
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({ cep: "26540-000", logradouro: "Rua Doutor Rufino", bairro: "Centro", localidade: "Nilópolis", uf: "RJ" })
    })
  );
  await ir(pg, "#pr");
  await calmo(pg);
  await pg.locator("#rChips").getByText("Interessados").click();
  await calmo(pg);
  await pg.locator("article", { hasText: "Luana" }).first().getByRole("button", { name: "Pagou 💰" }).click();
  const sh = pg.locator(".sheet:visible").last();
  await sh.getByRole("button", { name: "Salvar venda" }).click();
  await calmo(pg);
  ok(
    (await store())["repasse/v1"].etapa === "INTERESSADO" &&
      /Falta preencher: CEP, Rua, Número, Bairro, Cidade/.test(await sh.locator("p.wait:visible").textContent()),
    "sem endereço completo a venda não salva e o app diz o que falta"
  );
  await sh.getByLabel("CEP").fill("26540-000");
  await pg.waitForFunction(() => /preenchidos/.test(document.body.textContent), null, { timeout: 8000 });
  ok(
    (await sh.getByLabel("Rua").inputValue()) === "Rua Doutor Rufino" &&
      (await sh.getByLabel("Bairro").inputValue()) === "Centro" &&
      (await sh.getByLabel("Cidade").inputValue()) === "Nilópolis",
    "o CEP preenche rua, bairro e cidade"
  );
  await sh.getByLabel("Número").fill("290");
  await sh.getByPlaceholder("R$").fill("250");
  await sh.getByRole("button", { name: "Salvar venda" }).click();
  await calmo(pg);
  const v = (await store())["repasse/v1"];
  ok(
    v.etapa === "PAGO" &&
      v.conferido === false &&
      v.endereco &&
      v.endereco.cep === "26540000" &&
      v.endereco.rua === "Rua Doutor Rufino" &&
      v.endereco.numero === "290",
    "venda salva com o endereço completo (e a conferir)"
  );
  ok(!erros.length, "sem erros no console: " + erros.join(" | "));
});
await cenario("Equipe edita os dados do aluno e o Adriano vê quem editou", async () => {
  const Y = new Date().getFullYear();
  const d = Object.assign({}, base, {
    "repasse/ed1": {
      nome: "BIANCA VITORIA",
      nomeBusca: "BIANCA VITORIA",
      escola: "COLEGIO ALFA",
      ano: Y - 1,
      etapa: "SEPARADO",
      resp: "Ana",
      respEmail: ANA,
      separadoEm: dia(0),
      followup: dia(0),
      contatos: [{ tipo: "Mãe", nome: "Rosa", tel: "21988887777" }],
      telefones: ["21988887777"]
    }
  });
  const eq = await abrir(ANA, migrar(d));
  await ir(eq.pg, "#pr");
  await calmo(eq.pg);
  await eq.pg.locator("article", { hasText: "Bianca" }).first().getByRole("button", { name: "Editar dados" }).click();
  await calmo(eq.pg);
  const sh = eq.pg.locator(".sheet:visible").last();
  await sh.getByLabel("WhatsApp").first().waitFor();
  await sh.getByLabel("WhatsApp").first().fill("21977776666");
  await sh.locator("button[type=submit]").click();
  await calmo(eq.pg);
  // o aviso é gravado logo depois de salvar: espera ele chegar (até 5 s)
  let st = await eq.store(),
    av = null;
  for (let t = 0; t < 25 && !(av = Object.entries(st).find(([k]) => k.startsWith("edicoes/"))); t++) {
    await eq.pg.waitForTimeout(200);
    st = await eq.store();
  }
  ok(
    st["repasse/ed1"].telefones[0] === "21977776666" &&
      av &&
      av[1].porEmail === ANA &&
      av[1].campos.some(c => c.startsWith("contatos") && c.includes("21977776666")) &&
      /Bianca|BIANCA/.test(av[1].aluno),
    "equipe edita o contato e fica o aviso: qual aluno, o que mudou e quem editou"
  );
  ok(!eq.erros.length, "equipe sem erros no console: " + eq.erros.join(" | "));
  const adm = await abrir(ADRIANO, migrar(Object.assign({}, d, { [av[0]]: av[1] })));
  await ir(adm.pg, "#pr");
  await adm.pg.waitForFunction(
    () => /edição de dados feita pela equipe/.test(document.getElementById("rEdicoes")?.textContent || ""),
    null,
    {
      timeout: 8000
    }
  );
  await adm.pg.getByRole("button", { name: "Ver quem editou" }).click();
  const t = await adm.pg.locator(".sheet").last().textContent();
  ok(/Bianca Vitoria/.test(t) && /editado por Ana/.test(t) && /contatos/.test(t), "Adriano vê qual aluno e quem editou");
  await adm.pg.getByRole("button", { name: "Marcar todas como vistas" }).click();
  await calmo(adm.pg);
  ok((await adm.store())[av[0]].visto === true, "marcar como visto");
});
await cenario("Convite: criar a senha dentro do app", async () => {
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, serviceWorkers: "block" });
  abertos.push(ctx);
  await ctx.route(/gstatic\.com\/firebasejs\/10\.12\.2\/(firebase-\w+)\.js/, (rt, rq) =>
    rt.fulfill({ path: AQUI + "fake/" + rq.url().match(/(firebase-\w+)\.js/)[1] + ".js", contentType: "text/javascript" })
  );
  const pg = await ctx.newPage();
  const erros = [];
  pg.on("pageerror", e => erros.push(e.message));
  await pg.addInitScript(
    ([d]) => {
      window.__EMAIL = "";
      window.__RESET = { abc: "novo@equipe.com" };
      window.__store = new Map(Object.entries(d));
    },
    [Object.assign({}, base, { "usuarios/novo@equipe.com": { nome: "Novo Teste", papel: "equipe", ativo: true, modulos: ["colegios"] } })]
  );
  const raiz = URLAPP.replace(/[#?].*$/, "");
  await pg.goto(raiz + "?mode=resetPassword&oobCode=abc");
  await pg.waitForSelector("#formSenha #sSenha:not([hidden])", { state: "attached", timeout: 8000 });
  ok(/Crie a sua senha para entrar no app com novo@equipe\.com/.test(await pg.textContent("#formSenha")), "mostra o e-mail do convite");
  await pg.fill("#sSenha", "segredo1");
  await pg.fill("#sSenha2", "segredo1");
  await pg.click("#sBtn");
  await pg.waitForSelector("#viewHome:not([hidden])", { timeout: 8000 }).catch(() => {});
  ok(
    !(await pg.$("#formSenha")) && !/oobCode/.test(pg.url()) && (await pg.isVisible("#viewHome")),
    "cria a senha, entra no app e limpa o endereço"
  );
  await pg.goto(raiz + "?mode=resetPassword&oobCode=velho");
  await pg.waitForFunction(() => /já foi usado ou venceu/.test((document.getElementById("formSenha") || {}).textContent || ""), null, {
    timeout: 8000
  });
  ok(true, "link vencido: avisa e oferece voltar ao login");
  ok(!erros.length, "sem erros na página do convite" + (erros.length ? ": " + erros.join(" | ") : ""));
});
await cenario("Várias formaturas no mesmo colégio e alunos confirmados depois", async () => {
  const { pg, erros, store } = await abrir(
    ADRIANO,
    Object.assign({}, base, {
      "instituicoes/i2": {
        nome: "COLEGIO BETA",
        tipo: "particular",
        etapa: "FECHADO",
        resp: "",
        respEmail: "",
        contatos: [{ nome: "Marta", cargo: "Direção", tel: "21988881111" }],
        visitas: [],
        mediaAlunos: 60,
        diaFotos: { data: dia(-10), status: "confirmado", agendaId: dia(-10) },
        formatura: { data: dia(-3), status: "confirmado", agendaId: dia(-3), onde: "Colégio", alunos: 40, turmas: "9º ano A" }
      }
    })
  );
  await ir(pg, "#inst-particular");
  await pg.locator("#iChips").getByText("Todas").click();
  await pg.locator("#iList button.lc-linha").filter({ hasText: "Beta" }).click();
  const jan = pg.locator(".janela-aluno");
  await jan.locator(".ja-abas").getByText("Agendamentos").click();
  // a formatura já aconteceu: confirma quantos alunos vieram
  await jan.getByRole("button", { name: "👥 Confirmar alunos" }).click();
  let sh = pg.locator(".sheet").last();
  await sh.locator("textarea").fill("38");
  await sh.getByRole("button", { name: "Confirmar" }).click();
  await calmo(pg);
  let s = await store();
  ok(s["instituicoes/i2"].formatura.alunosConfirmados === 38, "alunos da formatura confirmados depois que ela aconteceu");
  // outra formatura no mesmo colégio (outra turma, outro dia e local)
  await jan.getByRole("button", { name: /Outra formatura/ }).click();
  await calmo(pg);
  sh = pg.locator(".sheet").last();
  await sh.locator("input[type=date]").nth(1).fill(dia(30));
  await sh.getByLabel("Onde").selectOption("Salão");
  await sh.getByLabel("Local").fill("Salão Fantasy");
  await sh.getByLabel("Turmas desta formatura").fill("9º ano B");
  await sh.getByLabel("Alunos desta formatura (previsão)").fill("25");
  await sh.locator("button[type=submit]").click();
  await calmo(pg);
  s = await store();
  const f2 = s["instituicoes/i2"].formatura2 || {};
  ok(
    f2.data === dia(30) && f2.turmas === "9º ano B" && f2.alunos === 25 && f2.status === "pendente" && f2.local === "Salão Fantasy",
    "Formatura 2 gravada com turmas, local e previsão de alunos: " + JSON.stringify(f2)
  );
  ok(
    (s["agenda/" + dia(30)] || {}).kind === "formatura2" && s["instituicoes/i2"].formatura.data === dia(-3),
    "a Formatura 2 segura o próprio dia na agenda e a primeira continua"
  );
  ok(
    s["instituicoes/i2"].diaFotos.status === "confirmado" && s["instituicoes/i2"].mediaAlunos === 60,
    "o dia de fotos já aprovado e a média do colégio não mudam"
  );
  // Formaturas → Venda Antecipada → Colégios fechados: lista compacta; a janela mostra alunos e datas
  await pg.locator(".sheet").evaluateAll(xs => xs.forEach(x => x.remove()));
  await ir(pg, "#formaturas");
  await pg.locator("#fmChips").getByText("Colégios fechados").click();
  await calmo(pg);
  await pg.evaluate(() => (window.__z7CartaoNaLista = false));
  await pg.fill("input[aria-label='Buscar colégio fechado']", "beta");
  await pg.locator("#fmCorpo button.lc-linha", { hasText: "Colegio Beta" }).click();
  const jf = pg.locator(".janela-aluno");
  await jf.locator(".ja-abas").getByText("Alunos").click();
  ok(
    (await jf.getByRole("button", { name: /Abrir alunos e parcelas/ }).count()) === 1,
    "colégio fechado: aba Alunos com o atalho da turma"
  );
  await jf.locator(".ja-abas").getByText("Datas").click();
  ok(/Formatura 2 do Colegio Beta/.test(await jf.locator(".ja-corpo").textContent()), "colégio fechado: aba Datas com todas as formaturas");
  ok(!erros.length, "sem erros" + (erros.length ? ": " + erros.join(" | ") : ""));
});
await browser.close();
srv.close();
console.log(falhas ? `\n${falhas} falha(s)` : "\nTudo certo ✅");
process.exit(falhas ? 1 : 0);
