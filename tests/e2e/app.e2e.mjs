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
  NOVO = "novo@equipe.com";
const hoje = new Date(),
  iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
import { feriado } from "../../js/feriados.js";
// dia n a partir de hoje, pulando feriado (o app bloqueia feriado e o teste ficaria instável)
const dia = n => {
  const d = new Date(hoje);
  d.setDate(d.getDate() + n);
  while (n > 0 && feriado(iso(d))) d.setDate(d.getDate() + 1);
  return iso(d);
};
const base = {
  ["usuarios/" + PEDRO]: { nome: "Pedro Vendedor", papel: "equipe", ativo: true, modulos: ["lf", "agenda", "colegios"] },
  ["usuarios/" + NOVO]: { nome: "Novo", papel: "equipe", ativo: true },
  "config/app": { individual: 450, sinal: 100, prazo: 15, comissao: {} },
  "leads/l1": {
    nome: "Erica Souza",
    telefone: "21988887777",
    etapa: "NOVO LEAD",
    followup: dia(0),
    servico: "Formatura individual (estúdio)",
    origem: "WhatsApp"
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
    contatos: [{ tipo: "Mãe", tel: "2199999" + String(1000 + i) }]
  };
// Os dados antigos são atualizados no servidor (scripts/migrar.mjs); aqui aplicamos o mesmo plano antes de abrir o app
import { planejar } from "../../js/migracao.js";
function migrar(dados) {
  const out = JSON.parse(JSON.stringify(dados)),
    cols = {};
  for (const [k, v] of Object.entries(out)) {
    const [c, id] = k.split("/");
    (cols[c] = cols[c] || []).push({ id, ...v });
  }
  const nomes = Object.fromEntries(
    Object.entries(out)
      .filter(([k, v]) => k.startsWith("usuarios/") && v.nome)
      .map(([k, v]) => [v.nome, k.slice(9)])
  );
  for (const o of planejar(cols, n => nomes[n] || "").ops) {
    const k = o.col + "/" + o.id;
    out[k] = o.tipo === "s" ? o.dados : Object.assign({}, out[k], o.dados);
  }
  return out;
}
async function abrir(email, dados) {
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, serviceWorkers: "block" });
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
    ([em, d]) => {
      window.__EMAIL = em;
      window.__store = new Map(Object.entries(d));
      window.open = u => {
        window.__aberto = u;
        return null;
      };
    },
    [email, dados]
  );
  await pg.goto(URLAPP);
  try {
    await pg.waitForSelector("#viewHome:not([hidden])", { timeout: 8000 });
  } catch (e) {
    console.log("Não abriu a tela inicial. Erros:", erros.join("\n"));
    throw e;
  }
  await pg.waitForTimeout(600);
  // store(): espera o app terminar de gravar (nenhuma operação em andamento há 150 ms) e devolve os dados
  const store = async () => {
    await pg
      .waitForFunction(() => window.__ops === 0 && Date.now() - window.__ultimo > 150, null, { timeout: 4000, polling: 50 })
      .catch(() => {});
    return pg.evaluate(() => Object.fromEntries(window.__store));
  };
  return { pg, erros, ctx, store };
}
const ir = async (pg, h) => {
  await pg.evaluate(h => {
    location.hash = h;
  }, h);
  await pg.waitForTimeout(500);
};
const visiveis = pg => pg.$$eval(".tile[data-mod]", ts => ts.filter(t => !t.hidden).map(t => t.dataset.mod));

console.log("Adriano (admin), com os dados já atualizados no servidor:");
{
  const { pg, erros, store } = await abrir(ADRIANO, migrar(base));
  await pg.waitForTimeout(800);
  let s = await store();
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
  ok((await visiveis(pg)).length === 7, "admin vê os 7 cards");
  ok(/1 para hoje/.test(await pg.textContent("#tFunil")), "card do Funil conta o contato de hoje");
  ok(/atrasad/.test(await pg.textContent("#tFormaturas")), "card Formaturas mostra parcela atrasada");
  // Ajustes: 9.5 não pode virar 95
  await pg.click("#btnPrices");
  await pg.waitForTimeout(200);
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
  await pg.waitForTimeout(300);
  s = await store();
  ok(s["config/app"].comissao.pr.Boleto === 9.5, "comissão 9.5 grava 9,5% (antes virava 95%) → " + s["config/app"].comissao.pr.Boleto);
  ok(s["config/app"].feriadosExtras === "24/12 Recesso de Natal", "feriado extra da cidade gravado em Ajustes");
  // Funil: valor no formato brasileiro
  await ir(pg, "#funil");
  ok((await pg.locator("#list .card").count()) === 1, "Funil abre (módulo novo) com o lead");
  await pg.locator("#list .card").getByText("Editar").click();
  // o formulário põe o cursor no Nome 30 ms depois de abrir: espera, senão o texto cai no campo errado
  await pg.waitForFunction(() => document.activeElement && document.activeElement.id === "fNome", null, { timeout: 2000 }).catch(() => {});
  await pg.fill("#fValor", "1.350,50");
  if (process.env.DEBUG) console.log(await pg.inputValue("#fValor"), await pg.isDisabled("#fValor"), await pg.textContent("#formTitle"));
  await pg.click("#btnSave");
  await pg.waitForFunction(() => (window.__store.get("leads/l1") || {}).valor === 1350.5, null, { timeout: 3000 }).catch(() => {});
  // venda fechada pela equipe: aparece "a conferir" e o admin confere
  await pg.fill("#q", "venda da equipe");
  await pg.waitForTimeout(600);
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
  await pg.waitForTimeout(200);
  s = await store();
  ok(s["leads/l1"].valor === 1350.5, "valor R$ 1.350,50 gravado como 1350.5 → " + JSON.stringify(s["leads/l1"].valor));
  // Formaturas: registrar parcela (transação)
  await ir(pg, "#formaturas");
  ok(/Lucas Silva/.test(await pg.textContent("#fmCorpo")), "cobranças mostram o formando atrasado");
  await pg.locator("#fmCorpo .card").filter({ hasText: "Lucas" }).getByText("✅ Parcela paga").click();
  await pg.waitForTimeout(400);
  s = await store();
  ok(
    s["formandos/f1"].pagamentos.length === 2 && s["formandos/f1"].pagas === 2 && s["formandos/f1"].pagamentos[1].valor === 85,
    "parcela registrada com valor e data"
  );
  // Turma: novo formando com 400 em 3x
  await pg.locator("#fmChips").getByText("Turmas").click();
  await pg.waitForTimeout(200);
  await pg.getByText("👥 Formandos e parcelas").click();
  await pg.waitForTimeout(400);
  await pg.locator(".panel.wide").getByRole("button", { name: "+ Formando" }).click();
  await pg.waitForTimeout(200);
  const f = pg.locator(".sheet").last();
  await f.getByLabel("Nome").fill("Julia Costa");
  await f.getByLabel("Kit", { exact: true }).selectOption("outro");
  await f.getByLabel("Qual kit").fill("Kit especial");
  await f.getByLabel("Valor total").fill("400");
  await f.getByLabel("Parcelas", { exact: true }).fill("3");
  await f.getByLabel("Parcelas", { exact: true }).dispatchEvent("input");
  ok(/3x de R\$ 133,33 \(a 1ª de R\$ 133,34\)/.test(await f.locator(".hint").first().textContent()), "divide 400 em 3x sem perder centavo");
  await f.locator("button[type=submit]").click();
  await pg.waitForTimeout(300);
  s = await store();
  const ju = Object.values(s).find(x => x.nome === "Julia Costa");
  ok(ju && ju.valor === 400 && ju.respEmail === PEDRO && ju.proxVenc, "formando novo com responsável do colégio e próximo vencimento");
  // contrato: Kit 04 antecipado preenche valor e parcelas pela tabela
  const novoFormando = async () => {
    await pg.locator(".panel.wide").getByRole("button", { name: "+ Formando" }).click();
    await pg.waitForTimeout(200);
    return pg.locator(".sheet").last();
  };
  let fk = await novoFormando();
  await fk.getByLabel("Nome").fill("Bia Antecipada");
  await fk.getByLabel("Kit", { exact: true }).selectOption("k04");
  await pg.waitForTimeout(150);
  ok(
    (await fk.getByLabel("Valor total").inputValue()) === "850,00" &&
      (await fk.getByLabel("Parcelas", { exact: true }).inputValue()) === "10",
    "Kit 04 antecipado: R$ 850,00 em 10x (tabela do contrato)"
  );
  await fk.locator("button[type=submit]").click();
  await pg.waitForTimeout(300);
  // todo formando entra pelo menos com o Kit 01 (adesão)
  fk = await novoFormando();
  await fk.getByLabel("Nome").fill("Caio Kit Um");
  await fk.getByLabel("WhatsApp").fill("21966665555");
  ok(
    (await fk.getByLabel("Kit", { exact: true }).inputValue()) === "k01" && (await fk.getByLabel("Valor total").inputValue()) === "65,00",
    "novo formando já vem com o Kit 01 (R$ 65,00)"
  );
  await fk.locator("button[type=submit]").click();
  await pg.waitForTimeout(300);
  s = await store();
  const bia = Object.values(s).find(x => x.nome === "Bia Antecipada"),
    caio = Object.values(s).find(x => x.nome === "Caio Kit Um");
  ok(
    bia && bia.kitId === "k04" && bia.venda === "ant" && bia.valor === 850 && bia.contrato === "album",
    "venda antecipada gravada com o kit do contrato"
  );
  ok(caio && caio.kitId === "k01" && caio.contrato === "colacao" && caio.valor === 65, "Kit 01 gravado como adesão");
  // tabela só desta turma: Kit 04 por R$ 790,00 em 8x
  await pg.locator(".panel.wide").getByRole("button", { name: "📋 Kits desta turma" }).click();
  await pg.waitForTimeout(200);
  fk = pg.locator(".sheet").last();
  await fk.getByLabel(/Kit 04.* · valor antecipado \(turma\)$/).fill("790");
  await fk.getByLabel(/Kit 04.* · parcelas antecipado \(turma\)$/).fill("8");
  await fk.locator("button[type=submit]").click();
  await pg.waitForTimeout(300);
  ok(
    /diferentes da tabela padrão/.test(await pg.textContent(".panel.wide")) && /✏️ Kit 04: 8x/.test(await pg.textContent(".panel.wide")),
    "turma avisa os valores diferentes da tabela padrão"
  );
  fk = await novoFormando();
  await fk.getByLabel("Nome").fill("Dani Turma");
  await fk.getByLabel("Kit", { exact: true }).selectOption("k04");
  await pg.waitForTimeout(150);
  ok((await fk.getByLabel("Valor total").inputValue()) === "790,00", "formando novo usa a tabela da turma (R$ 790,00)");
  await fk.getByRole("button", { name: "Cancelar" }).click();
  await pg.waitForTimeout(200);
  // fotos prontas libera a oferta
  await pg.locator(".panel.wide").getByRole("button", { name: "📅 Contrato da turma" }).click();
  await pg.waitForTimeout(200);
  fk = pg.locator(".sheet").last();
  await fk.getByRole("button", { name: "📸 As fotos ficaram prontas hoje" }).click();
  await fk.locator("button[type=submit]").click();
  await pg.waitForTimeout(300);
  await pg.locator(".panel.wide").getByRole("button", { name: "Fechar" }).click();
  await pg.waitForTimeout(300);
  // tabela padrão: preço depois das fotos do Kit 04
  await pg.getByRole("button", { name: "📋 Kits e preços" }).click();
  await pg.waitForTimeout(200);
  fk = pg.locator(".sheet").last();
  if (process.env.FOTOS) await fk.screenshot({ path: process.env.FOTOS + "/kits.png" });
  await fk.getByLabel(/Kit 04.* · valor depois das fotos$/).fill("1.100,00");
  await fk.getByLabel(/Kit 04.* · parcelas depois das fotos$/).fill("6");
  await fk.getByLabel(/Kit 04.* · valor repasse$/).fill("700");
  await fk.getByLabel(/Kit 04.* · parcelas repasse$/).fill("5");
  await fk.locator("button[type=submit]").click();
  await pg.waitForTimeout(400);
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
  await pg.waitForTimeout(800);
  const leit = await pg.evaluate(() => window.__leituras.filter(l => l.col === "formandos"));
  ok(
    /Pode oferecer os kits para 1 aluno/i.test(await pg.textContent("#fmCorpo")) && !leit.some(l => l.filtros === 0),
    "aviso de oferta sem ler a coleção inteira de formandos: " + JSON.stringify(leit)
  );
  await pg.locator("#fmChips").getByText("📸 Depois das fotos").click();
  await pg.waitForTimeout(400);
  ok(
    /Caio Kit Um/.test(await pg.textContent("#fmCorpo")) && !/Bia Antecipada/.test(await pg.textContent("#fmCorpo")),
    "só quem tem o Kit 01 aparece em Depois das fotos"
  );
  await pg.locator("#fmCorpo .card").filter({ hasText: "Caio" }).getByText("💬 Oferecer kit").click();
  await pg.waitForTimeout(200);
  ok(
    /Kit 04.*6x de R\$ 183,33/.test(decodeURIComponent(await pg.evaluate(() => window.__aberto || ""))),
    "mensagem oferece o Kit 04 a 6x de R$ 183,33"
  );
  // prévia: todas as fotos do kit (35 fotos = 2 páginas) e prévia do álbum, montadas no aparelho
  await pg.locator("#fmCorpo .card").filter({ hasText: "Caio" }).getByText("🖼️ Prévia").click();
  await pg.waitForTimeout(500);
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
  await pg.waitForTimeout(600);
  ok((await pg.evaluate(() => document.querySelector(".panel.mock canvas").width)) === 1600, "prévia do álbum desenhada");
  if (process.env.FOTOS) await pg.locator(".panel.mock canvas").screenshot({ path: process.env.FOTOS + "/album.png" });
  await pg.locator(".panel.mock").getByRole("button", { name: "Fechar" }).click();
  await pg.waitForTimeout(200);
  await pg.locator("#fmCorpo .card").filter({ hasText: "Caio" }).getByText("Abrir turma").click();
  await pg.waitForTimeout(500);
  if (process.env.FOTOS) await pg.locator(".panel.wide").screenshot({ path: process.env.FOTOS + "/turma.png" });
  await pg.locator(".panel.wide .card").filter({ hasText: "Caio" }).getByText("🛒 Comprou kit").click();
  await pg.waitForTimeout(200);
  fk = pg.locator(".sheet").last();
  ok(
    (await fk.getByLabel("Valor total").inputValue()) === "1.100,00" &&
      (await fk.getByLabel("Parcelas", { exact: true }).inputValue()) === "6",
    "depois das fotos: Kit 04 R$ 1.100,00 em 6x"
  );
  await fk.getByLabel("Valor total").fill("1.000,00"); // combinaram outro valor
  await fk.locator("button[type=submit]").click();
  await pg.waitForTimeout(300);
  s = await store();
  const compras = Object.values(s).filter(x => x.nome === "Caio Kit Um");
  const nova = compras.find(x => x.venda === "pos");
  ok(
    compras.length === 2 && nova && nova.kitId === "k04" && nova.valor === 1000 && nova.compraDe && compras.some(x => x.kitId === "k01"),
    "compra a mais registrada (R$ 1.000,00 combinado) e o Kit 01 continua"
  );
  await pg.locator(".panel.wide").getByRole("button", { name: "Fechar" }).click();
  await pg.waitForTimeout(200);
  // "+ Formando" direto no card Formaturas (sem planilha): escolhe a turma e já abre o cadastro
  await pg.getByRole("button", { name: "+ Formando" }).first().click();
  await pg.waitForTimeout(300);
  fk = pg.locator(".sheet").last();
  await fk.getByLabel("Turma (colégio)").selectOption("i1");
  await fk.locator("button[type=submit]").click();
  await pg.waitForTimeout(600);
  fk = pg.locator(".sheet").last();
  await fk.getByLabel("Nome").fill("Eva Direto");
  await fk.locator("button[type=submit]").click();
  await pg.waitForTimeout(400);
  s = await store();
  const eva = Object.values(s).find(x => x.nome === "Eva Direto");
  ok(eva && eva.instId === "i1" && eva.kitId === "k01", "+ Formando no card Formaturas: incluído na turma com o Kit 01");
  await pg.locator(".panel.wide").getByRole("button", { name: "Fechar" }).click();
  await pg.waitForTimeout(200);
  // Repasse: turmas de anos anteriores, quem ficou só com o Kit 01, preço de repasse
  await pg.locator("#viewFormaturas .segs").getByText("Repasse", { exact: true }).click();
  await pg.waitForTimeout(400);
  await pg.locator("#fmChips").getByText("🔁 Oferecer no repasse").click();
  await pg.waitForTimeout(400);
  let rt = await pg.textContent("#fmCorpo");
  ok(/Lia Antiga/.test(rt) && !/Caio Kit Um/.test(rt), "Repasse mostra só quem ficou com o Kit 01 nas turmas de anos anteriores");
  await pg.locator("#fmCorpo .card").filter({ hasText: "Lia" }).getByText("💬 Oferecer kit").click();
  await pg.waitForTimeout(200);
  const msgRep = decodeURIComponent(await pg.evaluate(() => window.__aberto || ""));
  ok(
    new RegExp("formatura de " + (hoje.getFullYear() - 1)).test(msgRep) && /Kit 04.*5x de R\$ 140,00/.test(msgRep),
    "mensagem do repasse com o preço de repasse (5x de R$ 140,00)"
  );
  await pg.locator("#fmCorpo .card").filter({ hasText: "Lia" }).getByText("Abrir turma").click();
  await pg.waitForTimeout(500);
  await pg.locator(".panel.wide .card").filter({ hasText: "Lia" }).getByText("🛒 Comprou kit").click();
  await pg.waitForTimeout(200);
  fk = pg.locator(".sheet").last();
  ok(
    (await fk.getByLabel("Valor total").inputValue()) === "700,00" &&
      (await fk.getByLabel("Parcelas", { exact: true }).inputValue()) === "5",
    "venda no repasse: Kit 04 R$ 700,00 em 5x"
  );
  await fk.locator("button[type=submit]").click();
  await pg.waitForTimeout(300);
  s = await store();
  const lia = Object.values(s).filter(x => x.nome === "Lia Antiga" || x.nome === "LIA ANTIGA");
  ok(
    lia.some(x => x.venda === "rep" && x.valor === 700 && x.kitId === "k04"),
    "venda do repasse registrada"
  );
  await pg.locator(".panel.wide").getByRole("button", { name: "Fechar" }).click();
  await pg.waitForTimeout(200);
  await pg
    .locator("#viewFormaturas .segs")
    .getByText(/Linha de Frente/)
    .click();
  await pg.waitForTimeout(200);
  // Dashboard
  await ir(pg, "#vendas");
  await pg.waitForTimeout(1500);
  s = await store();
  ok(!!s["resumos/dashboard"], "Dashboard gravou o resumo (abre lendo 1 documento)");
  const tab = await pg.textContent(".vdtab");
  ok(
    (tab.match(/Pedro/g) || []).length === 1 && /R\$ 82,75/.test(tab),
    "Pedro aparece uma vez, comissão R$ 70 (PR Pix 20%) + R$ 12,75 (parcela 85 × 15%): " + tab.replace(/\s+/g, " ").slice(0, 160)
  );
  ok((await pg.locator("#viewVendas canvas").count()) === 2, "gráficos desenhados (Chart.js com conferência de integridade)");
  // um card de cada vez
  await pg.locator(".vdareas").getByText("🖼️ PR").click();
  await pg.waitForTimeout(400);
  let vt = await pg.textContent("#vdCorpo");
  if (process.env.FOTOS) await pg.screenshot({ path: process.env.FOTOS + "/dash-pr.png", fullPage: true });
  ok(
    /Vendido no PR/.test(vt) && /Linha de Frente × Repasse/.test(vt) && /Equipe no PR/.test(vt) && /1 venda do PR a conferir/.test(vt),
    "Dashboard · PR separado (vendas, separados, conversão, equipe) e aviso de venda a conferir"
  );
  await pg.locator(".vdareas").getByText("🎓 Formaturas").click();
  await pg.waitForTimeout(400);
  vt = await pg.textContent("#vdCorpo");
  if (process.env.FOTOS) await pg.screenshot({ path: process.env.FOTOS + "/dash-form.png", fullPage: true });
  ok(
    /A receber · kits/.test(vt) && /Formandos com parcela atrasada/.test(vt) && /Equipe nas formaturas/.test(vt),
    "Dashboard · Formaturas separado (vendido, recebido, a receber, atrasados)"
  );
  await pg.locator(".vdareas").getByText("💬 Funil").click();
  await pg.waitForTimeout(400);
  vt = await pg.textContent("#vdCorpo");
  if (process.env.FOTOS) await pg.screenshot({ path: process.env.FOTOS + "/dash-funil.png", fullPage: true });
  ok(
    /Leads novos/.test(vt) && /De onde vêm os leads/.test(vt) && /Em aberto agora/.test(vt),
    "Dashboard · Funil separado (leads, conversão, origem)"
  );
  await pg.locator(".vdareas").getByText("Geral").click();
  await pg.waitForTimeout(300);
  // PR: admin confere a venda feita pelo vendedor
  await ir(pg, "#pr");
  await pg.waitForTimeout(400);
  await pg.locator("#rChips").getByText("A conferir").click();
  await pg.waitForTimeout(400);
  await pg.locator(".card").filter({ hasText: "Bruno" }).getByRole("button", { name: "✔ Conferir venda" }).click();
  await pg.waitForTimeout(300);
  s = await store();
  ok(s["repasse/r2"].conferido === true && s["repasse/r2"].conferidoPor === ADRIANO, "admin conferiu a venda do PR");
  // Agenda: admin vê o assunto particular, marca ensaio e compromisso particular
  await ir(pg, "#agenda");
  await pg.waitForTimeout(400);
  ok(/Consulta médica/.test(await pg.textContent("#viewAgenda")), "admin vê o assunto do compromisso particular");
  ok((await pg.getByRole("button", { name: "+ Agendar colégio" }).count()) === 1, "admin também tem o botão Agendar colégio");
  await pg.getByRole("button", { name: "+ Marcar ensaio" }).click();
  await pg.waitForTimeout(200);
  let sh = pg.locator(".sheet").last();
  ok((await sh.getByLabel("Valor do sinal").inputValue()) === "", "sinal do ensaio começa vazio (sem preço fixo)");
  await sh.getByLabel("Cliente").fill("Rita Lima");
  await sh.getByLabel("Tipo de ensaio").selectOption("Retrato");
  await sh.getByLabel("Dia").fill(dia(5));
  await sh.getByLabel("Dia").dispatchEvent("change");
  await sh.getByLabel("Horário").fill("10:00");
  await sh.getByLabel("Valor do ensaio").fill("280,50");
  await sh.locator("button[type=submit]").click();
  await pg.waitForTimeout(300);
  s = await store();
  const rita = Object.values(s).find(x => x.cliente === "Rita Lima");
  ok(rita && rita.valor === 280.5 && rita.marcadoEmail === ADRIANO, "ensaio marcado com valor 280,50 e e-mail de quem marcou");
  await pg.getByRole("button", { name: "+ Compromisso" }).click();
  await pg.waitForTimeout(200);
  sh = pg.locator(".sheet").last();
  await sh.getByLabel("O que é").fill("Exame de sangue");
  await sh.getByLabel("Dia", { exact: true }).fill(dia(6));
  await sh.getByText("Dia inteiro").click();
  await sh.locator("button[type=submit]").click();
  await pg.waitForTimeout(300);
  s = await store();
  const comp = Object.entries(s).find(([k, x]) => k.startsWith("ensaios/") && x.kind === "pessoal" && x.data === dia(6));
  ok(
    comp &&
      comp[1].titulo === "" &&
      s["privado/" + comp[0].split("/")[1]] &&
      s["privado/" + comp[0].split("/")[1]].titulo === "Exame de sangue",
    "compromisso particular: assunto guardado só em 'privado'"
  );
  // Becas
  await ir(pg, "#becas");
  await pg.waitForTimeout(300);
  await pg.getByRole("button", { name: "📦 Estoque" }).click();
  await pg.waitForTimeout(200);
  await pg.locator(".sheet").last().locator("summary", { hasText: "Beca tradicional preta" }).click();
  await pg.locator(".sheet").last().getByLabel("Estoque Beca tradicional preta M", { exact: true }).fill("5");
  await pg.locator(".sheet").last().locator("button[type=submit]").click();
  await pg.waitForTimeout(300);
  s = await store();
  ok(
    s["config/app"].estoque && s["config/app"].estoque.tamanhos.tradPreta.M === 5,
    "estoque por tipo e tamanho gravado (tradicional preta M = 5)"
  );
  await pg.getByRole("button", { name: "+ Aluguel" }).click();
  await pg.waitForTimeout(200);
  sh = pg.locator(".sheet").last();
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
  await pg.waitForTimeout(200);
  if (await pg.locator(".sheet").count()) {
    await pg.locator(".sheet").last().locator("button[type=submit]").click();
    await pg.waitForTimeout(300);
  }
  s = await store();
  const bc = Object.values(s).find(x => x.cliente === "Igreja Central");
  ok(bc && bc.valor === 1200 && bc.pago === 300 && bc.qtd === 12 && bc.porEmail === ADRIANO, "aluguel de becas com R$ 1.200,00 e 12 becas");
  ok(
    bc &&
      bc.tamanhosQtd &&
      bc.tamanhosQtd.tradPreta.M === 7 &&
      bc.tamanhosQtd.tradPreta.G === 5 &&
      bc.tamanhos === "Beca tradicional preta: 7 M, 5 G",
    "tamanhos por tipo: tradicional preta 7 M e 5 G"
  );
  ok(/Falta receber R\$ 900/.test(await pg.textContent("#bcLista")), "falta receber R$ 900 (conta em centavos)");
  ok(erros.length === 0, "sem erros no console" + (erros.length ? ": " + erros.slice(0, 3).join(" | ") : ""));
}

console.log("Botão voltar do celular:");
{
  const { pg, erros } = await abrir(ADRIANO, migrar(base));
  const voltar = async () => {
    await pg.evaluate(() => history.back());
    await pg.waitForTimeout(500);
  };
  await pg.locator('.tile[data-mod="colegios"]').click();
  await pg.waitForTimeout(500);
  await pg
    .locator("#viewInst .card, #viewInst a, #viewInst button")
    .filter({ hasText: /Colégio particular/i })
    .first()
    .click();
  await pg.waitForTimeout(600);
  await pg.getByRole("button", { name: "+ Nova instituição" }).click();
  await pg.waitForTimeout(300);
  ok((await pg.locator(".sheet:visible").count()) === 1, "abriu a janela de nova instituição");
  await voltar();
  ok((await pg.locator(".sheet:visible").count()) === 0 && /inst-particular/.test(pg.url()), "voltar fecha a janela e fica na mesma tela");
  await voltar();
  ok(/#instituicoes$/.test(pg.url()) && !(await pg.locator("#viewInst").isHidden()), "voltar sobe para Instituições: " + pg.url());
  await voltar();
  ok(/#home$/.test(pg.url()) && (await pg.locator("#viewHome").isVisible()), "voltar sobe para o Início");
  await voltar();
  ok(
    (await pg.locator("#viewHome").isVisible()) && /voltar de novo para sair/.test(await pg.textContent("#toast")),
    "no Início, pede um segundo toque para sair (não fecha o app)"
  );
  ok(erros.length === 0, "sem erros no console" + (erros.length ? ": " + erros.slice(0, 3).join(" | ") : ""));
}

console.log("Pedro (vendedor: Linha de Frente, Agendamento, Instituições):");
{
  const migrado = Object.assign(migrar(base), {
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
  const vs = await visiveis(pg);
  ok(
    vs.includes("agenda") &&
      vs.includes("colegios") &&
      vs.includes("pr") &&
      !vs.includes("vendas") &&
      vs.includes("formaturas") &&
      !vs.includes("funil"),
    "vê só os módulos dele: " + vs.join(", ")
  );
  await ir(pg, "#agenda");
  await pg.waitForTimeout(400);
  const ag = await pg.textContent("#viewAgenda");
  ok(/ocupado/.test(ag) && !/Consulta/.test(ag), "compromisso particular aparece só como ocupado");
  ok(!(await pg.getByRole("button", { name: "+ Marcar ensaio" }).count()), "não marca ensaio");
  // data aprovada que ele agendou: aviso para mandar do WhatsApp dele
  ok(
    /A Luciana aprovou\. Avise o colégio/.test(await pg.textContent("#agPend")),
    "data aprovada aparece para quem agendou avisar o colégio"
  );
  await pg.locator("#agPend .card").filter({ hasText: "Alfa" }).getByRole("button", { name: "📲 Avisar colégio" }).click();
  await pg.waitForTimeout(200);
  const msgAv = await pg.locator(".sheet").last().locator(".notes").textContent();
  console.log("    mensagem:", JSON.stringify(msgAv));
  ok(/Está confirmado/.test(msgAv) && /90 alunos/.test(msgAv) && /Espaço Festa/.test(msgAv), "mensagem confirmada com local e alunos");
  await pg
    .locator(".sheet")
    .last()
    .getByRole("button", { name: /Enviar no WhatsApp/ })
    .click();
  await pg.waitForTimeout(400);
  ok((await store())["agenda/" + dia(20)].avisadoWhats === true, "marcado como avisado depois de abrir o WhatsApp");
  // Agendar colégio direto pela agenda (dia de fotos do PR)
  await pg.getByRole("button", { name: "+ Agendar colégio" }).click();
  await pg.waitForTimeout(400);
  let sa = pg.locator(".sheet").last();
  await sa.getByLabel("Colégio").fill("Colegio Beta");
  await sa.locator("button[type=submit]").click();
  await pg.waitForTimeout(300);
  sa = pg.locator(".sheet").last();
  await sa.locator("input[type=date]").first().fill(dia(15));
  await sa.locator("button[type=submit]").click();
  await pg.waitForTimeout(200);
  ok(/média de alunos/i.test(await sa.locator(".err").last().textContent()), "sem a média de alunos não agenda");
  await sa.getByLabel("Média de alunos (obrigatório)").fill("120");
  await sa.locator("button[type=submit]").click();
  await pg.waitForTimeout(200);
  ok(/WhatsApp/.test(await sa.locator(".err").last().textContent()), "sem o WhatsApp do responsável não agenda");
  await sa.getByLabel("Nome", { exact: true }).fill("Marta Diretora");
  await sa.getByLabel("WhatsApp", { exact: true }).fill("21 98888-1111");
  await sa.getByLabel("E-mail", { exact: true }).fill("marta@beta.com");
  await sa.locator("button[type=submit]").click();
  await pg.waitForTimeout(500);
  const av = pg.locator(".sheet").last();
  ok(
    /Avisar o colégio/i.test(await av.locator("h2").textContent()) &&
      /pré-agendado/.test(await av.textContent()) &&
      /120 alunos/.test(await av.textContent()),
    "depois de agendar, oferece a mensagem pronta para o responsável"
  );
  await av.getByRole("button", { name: /Enviar no WhatsApp/ }).click();
  await pg.waitForTimeout(200);
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
  // Colégio novo cadastrado pela própria agenda
  await pg.getByRole("button", { name: "+ Agendar colégio" }).click();
  await pg.waitForTimeout(400);
  sa = pg.locator(".sheet").last();
  await sa.getByLabel("O que vai marcar").selectOption("formatura");
  await sa.getByLabel("Colégio").fill("Colégio Delta Novo");
  await sa.getByLabel("Colégio").dispatchEvent("change");
  await sa.getByLabel("Tipo").selectOption("publico");
  await sa.getByLabel("Média de alunos").fill("80");
  await sa.getByLabel("Bairro").fill("Centro");
  await sa.getByLabel("WhatsApp do responsável").fill("21 3333-4444");
  await sa.getByLabel("Responsável", { exact: true }).fill("João Diretor");
  await sa.locator("button[type=submit]").click();
  await pg.waitForTimeout(500);
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
  await ir(pg, "#pr");
  await pg.waitForTimeout(600);
  ok((await pg.textContent("#viewRepasse")).length > 50, "PR (Linha de Frente) abre");
  // lote do dia: não trava, avisa depois de 25
  for (let i = 0; i < 3; i++) {
    await pg.locator("#rLoteBtn").click();
    await pg.waitForTimeout(700);
  }
  const sepS = await store();
  const sep = Object.values(sepS).filter(x => x.separadoEm && x.respEmail === PEDRO).length;
  ok(sep === 30, "separou 30 contatos sem travar no limite: " + sep);
  ok(
    (await pg.locator("#rLoteAviso").isVisible()) &&
      /já separou 30 contatos hoje \(o combinado é até 25\)/.test(await pg.textContent("#rLoteAviso")),
    "mostra o aviso depois de 25 na Linha de Frente"
  );
  ok(await pg.locator("#rLoteBtn").isEnabled(), "botão continua liberado");
  // "+ Aluno" no PR, sem planilha: entra separado para quem incluiu
  await pg.getByRole("button", { name: "+ Aluno" }).click();
  await pg.waitForTimeout(300);
  let fa = pg.locator(".sheet").last();
  await fa.getByLabel("Nome do aluno").fill("Paulo Manual");
  await fa.getByLabel("Colégio").fill("Colegio Alfa");
  await fa.getByLabel("WhatsApp").fill("21933332222");
  await fa.getByLabel("Nome", { exact: true }).fill("Marta");
  await fa.locator("button[type=submit]").click();
  await pg.waitForTimeout(500);
  const sp = await store();
  const paulo = Object.values(sp).find(x => x.nome === "Paulo Manual");
  ok(
    paulo && paulo.etapa === "SEPARADO" && paulo.respEmail === PEDRO && paulo.manual && paulo.contatos.length === 1,
    "+ Aluno no PR: incluído e já separado para o vendedor"
  );
  await ir(pg, "#inst-particular");
  await pg.waitForTimeout(400);
  await pg.locator("#iChips").getByText("Todas").click();
  await pg.waitForTimeout(200);
  // visita num colégio sem responsável: ele assume (por e-mail) e a visita guarda quem foi
  await pg.locator("#iList .card").filter({ hasText: "Beta" }).getByText("📝 Registrar visita / contato").click();
  await pg.waitForTimeout(200);
  let sh = pg.locator(".sheet").last();
  await sh.getByLabel("Resultado").selectOption("Vai decidir em reunião");
  await sh.locator("button[type=submit]").click();
  await pg.waitForTimeout(400);
  let s = await store();
  ok(
    s["instituicoes/i2"].respEmail === PEDRO &&
      s["instituicoes/i2"].visitas[0].porEmail === PEDRO &&
      s["instituicoes/i2"].etapa === "VISITADO",
    "visita registrada em transação; Pedro vira responsável pelo e-mail"
  );
  ok(
    (await pg.locator("#iList .card").filter({ hasText: "Beta" }).getByRole("button", { name: "📸 Dia de fotos" }).count()) === 0,
    "cartão da instituição não marca mais datas (só cadastro e visitas)"
  );
  // datas e turma agora ficam no card Formaturas
  await ir(pg, "#formaturas");
  await pg.waitForTimeout(500);
  await pg.locator("#fmChips").getByText("Turmas").click();
  await pg.waitForTimeout(400);
  await pg.locator("#fmCorpo .card").filter({ hasText: "Alfa" }).getByRole("button", { name: "📸 Dia de fotos" }).click();
  await pg.waitForTimeout(200);
  sh = pg.locator(".sheet").last();
  await sh.locator("input[type=date]").first().fill(dia(12));
  await sh.getByLabel("Nome", { exact: true }).fill("Marta");
  await sh.getByLabel("WhatsApp", { exact: true }).fill("21988880000");
  await sh.getByLabel("Média de alunos (obrigatório)").fill("60");
  await sh.locator("button[type=submit]").click();
  await pg.waitForTimeout(400);
  if (await pg.locator(".sheet").count())
    await pg
      .locator(".sheet")
      .last()
      .getByRole("button", { name: "Agora não" })
      .click()
      .catch(() => {});
  s = await store();
  ok(
    s["agenda/" + dia(12)] &&
      s["agenda/" + dia(12)].pedidoEmail === PEDRO &&
      s["agenda/" + dia(12)].instId === "i1" &&
      s["agenda/" + dia(12)].status === "pendente",
    "pedido de data pelo card Formaturas, com o e-mail de quem pediu"
  );
  await pg.locator("#fmCorpo .card").filter({ hasText: "Alfa" }).getByText("👥 Formandos e parcelas").click();
  await pg.waitForTimeout(400);
  const t = await pg.textContent(".panel.wide");
  ok(!/Parcela paga/.test(t) && /lançados pelo Adriano/.test(t), "na turma não registra pagamento");
  await pg.locator(".panel.wide").getByText("Editar").first().click();
  await pg.waitForTimeout(200);
  ok(await pg.locator(".sheet").last().getByLabel("Valor total").isDisabled(), "não edita valor do formando");
  ok(erros.length === 0, "sem erros no console" + (erros.length ? ": " + erros.slice(0, 3).join(" | ") : ""));
}

console.log("Cadastro sem módulos:");
{
  const { pg } = await abrir(NOVO, Object.assign({}, base, { "config/app": { versaoDados: 4 } }));
  ok((await visiveis(pg)).length === 0, "não vê nenhum card");
}
await browser.close();
srv.close();
console.log(falhas ? `\n${falhas} falha(s)` : "\nTudo certo ✅");
process.exit(falhas ? 1 : 0);
