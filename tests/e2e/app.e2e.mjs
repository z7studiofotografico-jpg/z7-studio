// Teste de ponta a ponta: abre o index.html de verdade num Chromium, com um Firebase falso em memória.
// Rodar: node tests/e2e/app.e2e.mjs   (precisa de playwright, xlsx e chart.js em tests/e2e/node_modules)
import { chromium } from "playwright";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const RAIZ = new URL("../../", import.meta.url).pathname, AQUI = new URL("./", import.meta.url).pathname;
const tipos = { ".js": "text/javascript", ".mjs": "text/javascript", ".html": "text/html", ".css": "text/css", ".png": "image/png", ".json": "application/json", ".webmanifest": "application/manifest+json" };
const srv = http.createServer((q, r) => { const f = path.join(RAIZ, decodeURIComponent(q.url.split("?")[0]));
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { "content-type": tipos[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r); }).listen(8790);
const URLAPP = "http://localhost:8790/index.html";
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium", args: ["--headless=new"], headless: false });
let falhas = 0; const ok = (cond, msg) => { console.log((cond ? "  ✓ " : "  ✗ ") + msg); if (!cond) falhas++; };
const ADRIANO = "z7studiofotografico@gmail.com", PEDRO = "pedro@vendas.com", NOVO = "novo@equipe.com";
const hoje = new Date(), iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
import { feriado } from "../../js/feriados.js";
// dia n a partir de hoje, pulando feriado (o app bloqueia feriado e o teste ficaria instável)
const dia = n => { const d = new Date(hoje); d.setDate(d.getDate() + n); while (n > 0 && feriado(iso(d))) d.setDate(d.getDate() + 1); return iso(d); };
const base = {
  ["usuarios/" + PEDRO]: { nome: "Pedro Vendedor", papel: "equipe", ativo: true, modulos: ["lf", "agenda", "colegios"] },
  ["usuarios/" + NOVO]: { nome: "Novo", papel: "equipe", ativo: true },
  "config/app": { individual: 450, sinal: 100, prazo: 15, comissao: {} },
  "leads/l1": { nome: "Erica Souza", telefone: "21988887777", etapa: "NOVO LEAD", followup: dia(0), servico: "Formatura individual (estúdio)", origem: "WhatsApp" },
  "instituicoes/i1": { nome: "COLEGIO ALFA", tipo: "particular", etapa: "FECHADO", fechadoEm: dia(-20), resp: "Pedro Vendedor", contatos: [], visitas: [{ data: dia(-20), por: "Pedro Vendedor", como: "Visita presencial" }] },
  "formandos/f1": { instId: "i1", instNome: "COLEGIO ALFA", nome: "LUCAS SILVA", tel: "21977776666", contrato: "album", kit: "Kit 04", valor: 850, parcelas: 10, pagas: 1, primeiroVenc: dia(-40), formaPag: "Cartão", status: "ativo", resp: "Pedro Vendedor", vendidoEm: dia(-40) },
  "instituicoes/i2": { nome: "COLEGIO BETA", tipo: "particular", etapa: "A VISITAR", resp: "", respEmail: "", contatos: [], visitas: [] },
  "repasse/r1": { nome: "ANA", ano: hoje.getFullYear(), etapa: "PAGO", valor: 350, formaPag: "Pix", pagoEm: dia(0), resp: "Pedro Vendedor" },
  "ensaios/c1": { kind: "pessoal", titulo: "Consulta médica", obs: "", particular: true, deQuem: "Luciana", data: dia(2), diaInteiro: true, status: "confirmado" },
  ["agenda/" + dia(9)]: { data: dia(9), kind: "fotos", status: "pendente", instId: "i1", instNome: "COLEGIO ALFA", pedidoPor: "Pedro Vendedor" }
};
async function abrir(email, dados){
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, serviceWorkers: "block" });
  const pg = await ctx.newPage(); const erros = [];
  pg.on("pageerror", e => erros.push(e.message)); pg.on("console", m => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) erros.push(m.text()); });
  await ctx.route(/gstatic\.com\/firebasejs\/10\.12\.2\/(firebase-\w+)\.js/, (rt, rq) => rt.fulfill({ path: AQUI + "fake/" + rq.url().match(/(firebase-\w+)\.js/)[1] + ".js", contentType: "text/javascript" }));
  await ctx.route(/cdnjs\.cloudflare\.com\/ajax\/libs\/Chart\.js/, rt => rt.fulfill({ path: AQUI + "node_modules/chart.js/dist/chart.umd.js", contentType: "text/javascript" }));
  await ctx.route(/cdnjs\.cloudflare\.com\/ajax\/libs\/xlsx/, rt => rt.fulfill({ path: AQUI + "node_modules/xlsx/dist/xlsx.full.min.js", contentType: "text/javascript" }));
  await pg.addInitScript(([em, d]) => { window.__EMAIL = em; window.__store = new Map(Object.entries(d)); window.open = u => { window.__aberto = u; return null; }; }, [email, dados]);
  await pg.goto(URLAPP);
  try { await pg.waitForSelector("#viewHome:not([hidden])", { timeout: 8000 }); } catch (e) { console.log("Não abriu a tela inicial. Erros:", erros.join("\n")); throw e; }
  await pg.waitForTimeout(600);
  return { pg, erros, ctx, store: () => pg.evaluate(() => Object.fromEntries(window.__store)) };
}
const ir = async (pg, h) => { await pg.evaluate(h => { location.hash = h; }, h); await pg.waitForTimeout(500); };
const visiveis = pg => pg.$$eval(".tile[data-mod]", ts => ts.filter(t => !t.hidden).map(t => t.dataset.mod));

console.log("Adriano (admin), com dados antigos:");
{
  const { pg, erros, store } = await abrir(ADRIANO, base);
  await pg.waitForTimeout(800);
  let s = await store();
  ok(s["config/app"].versaoDados === 3, "migração rodou (versaoDados 3)");
  ok(s["instituicoes/i1"].respEmail === PEDRO, "colégio ganhou o e-mail do responsável");
  ok(Array.isArray(s["formandos/f1"].pagamentos) && s["formandos/f1"].pagamentos.length === 1 && s["formandos/f1"].respEmail === PEDRO, "formando: pagamentos e responsável migrados");
  ok(s["formandos/f1"].proxVenc === dia(-40).replace(/-(\d\d)$/, "") || /^\d{4}-\d{2}-\d{2}$/.test(s["formandos/f1"].proxVenc), "formando: próximo vencimento gravado (" + s["formandos/f1"].proxVenc + ")");
  ok(s["repasse/r1"].respEmail === PEDRO && s["agenda/" + dia(9)].pedidoEmail === PEDRO, "PR e agenda com e-mail");
  ok(s["ensaios/c1"].titulo === "" && s["privado/c1"] && s["privado/c1"].titulo === "Consulta médica", "assunto particular foi para 'privado'");
  ok((await visiveis(pg)).length === 7, "admin vê os 7 cards");
  ok(/1 para hoje/.test(await pg.textContent("#tFunil")), "card do Funil conta o contato de hoje");
  ok(/atrasad/.test(await pg.textContent("#tFormaturas")), "card Formaturas mostra parcela atrasada");
  // Ajustes: 9.5 não pode virar 95
  await pg.click("#btnPrices"); await pg.waitForTimeout(200);
  await pg.fill('#comTab input[data-l="pr"][data-f="Boleto"]', "9.5"); await pg.click("#pSave"); await pg.waitForTimeout(300);
  s = await store(); ok(s["config/app"].comissao.pr.Boleto === 9.5, "comissão 9.5 grava 9,5% (antes virava 95%) → " + s["config/app"].comissao.pr.Boleto);
  // Funil: valor no formato brasileiro
  await ir(pg, "#funil");
  ok(await pg.locator("#list .card").count() === 1, "Funil abre (módulo novo) com o lead");
  await pg.locator("#list .card").getByText("Editar").click(); await pg.fill("#fValor", "1.350,50"); await pg.click("#btnSave"); await pg.waitForTimeout(300);
  s = await store(); ok(s["leads/l1"].valor === 1350.5, "valor R$ 1.350,50 gravado como 1350.5");
  // Formaturas: registrar parcela (transação)
  await ir(pg, "#formaturas");
  ok(/Lucas Silva/.test(await pg.textContent("#fmCorpo")), "cobranças mostram o formando atrasado");
  await pg.locator("#fmCorpo .card").filter({ hasText: "Lucas" }).getByText("✅ Parcela paga").click(); await pg.waitForTimeout(400);
  s = await store(); ok(s["formandos/f1"].pagamentos.length === 2 && s["formandos/f1"].pagas === 2 && s["formandos/f1"].pagamentos[1].valor === 85, "parcela registrada com valor e data");
  // Turma: novo formando com 400 em 3x
  await pg.locator("#fmChips").getByText("Turmas").click(); await pg.waitForTimeout(200);
  await pg.getByText("👥 Formandos e parcelas").click(); await pg.waitForTimeout(400);
  await pg.locator(".panel.wide").getByRole("button", { name: "+ Formando" }).click(); await pg.waitForTimeout(200);
  const f = pg.locator(".sheet").last();
  await f.getByLabel("Nome").fill("Julia Costa"); await f.getByLabel("Valor total").fill("400"); await f.getByLabel("Parcelas", { exact: true }).fill("3"); await f.getByLabel("Parcelas", { exact: true }).dispatchEvent("input");
  ok(/3x de R\$ 133,33 \(a 1ª de R\$ 133,34\)/.test(await f.locator(".hint").first().textContent()), "divide 400 em 3x sem perder centavo");
  await f.locator("button[type=submit]").click(); await pg.waitForTimeout(300);
  s = await store(); const ju = Object.values(s).find(x => x.nome === "Julia Costa");
  ok(ju && ju.valor === 400 && ju.respEmail === PEDRO && ju.proxVenc, "formando novo com responsável do colégio e próximo vencimento");
  await pg.locator(".panel.wide").getByRole("button", { name: "Fechar" }).click();
  // Dashboard
  await ir(pg, "#vendas"); await pg.waitForTimeout(1500);
  s = await store(); ok(!!s["resumos/dashboard"], "Dashboard gravou o resumo (abre lendo 1 documento)");
  const tab = await pg.textContent(".vdtab"); ok((tab.match(/Pedro/g) || []).length === 1 && /R\$ 82,75/.test(tab), "Pedro aparece uma vez, comissão R$ 70 (PR Pix 20%) + R$ 12,75 (parcela 85 × 15%): " + tab.replace(/\s+/g, " ").slice(0, 160));
  ok(await pg.locator("#viewVendas canvas").count() === 2, "gráficos desenhados");
  // Agenda: admin vê o assunto particular, marca ensaio e compromisso particular
  await ir(pg, "#agenda"); await pg.waitForTimeout(400);
  ok(/Consulta médica/.test(await pg.textContent("#viewAgenda")), "admin vê o assunto do compromisso particular");
  ok(await pg.getByRole("button", { name: "+ Agendar colégio" }).count() === 1, "admin também tem o botão Agendar colégio");
  await pg.getByRole("button", { name: "+ Marcar ensaio" }).click(); await pg.waitForTimeout(200);
  let sh = pg.locator(".sheet").last();
  await sh.getByLabel("Cliente").fill("Rita Lima"); await sh.getByLabel("Tipo de ensaio").selectOption("Retrato");
  await sh.getByLabel("Dia").fill(dia(5)); await sh.getByLabel("Dia").dispatchEvent("change"); await sh.getByLabel("Horário").fill("10:00");
  await sh.getByLabel("Valor do ensaio").fill("280,50"); await sh.locator("button[type=submit]").click(); await pg.waitForTimeout(300);
  s = await store(); const rita = Object.values(s).find(x => x.cliente === "Rita Lima");
  ok(rita && rita.valor === 280.5 && rita.marcadoEmail === ADRIANO, "ensaio marcado com valor 280,50 e e-mail de quem marcou");
  await pg.getByRole("button", { name: "+ Compromisso" }).click(); await pg.waitForTimeout(200);
  sh = pg.locator(".sheet").last();
  await sh.getByLabel("O que é").fill("Exame de sangue"); await sh.getByLabel("Dia", { exact: true }).fill(dia(6)); await sh.getByText("Dia inteiro").click();
  await sh.locator("button[type=submit]").click(); await pg.waitForTimeout(300);
  s = await store(); const comp = Object.entries(s).find(([k, x]) => k.startsWith("ensaios/") && x.kind === "pessoal" && x.data === dia(6));
  ok(comp && comp[1].titulo === "" && s["privado/" + comp[0].split("/")[1]] && s["privado/" + comp[0].split("/")[1]].titulo === "Exame de sangue", "compromisso particular: assunto guardado só em 'privado'");
  // Becas
  await ir(pg, "#becas"); await pg.waitForTimeout(300);
  await pg.getByRole("button", { name: "+ Aluguel" }).click(); await pg.waitForTimeout(200);
  sh = pg.locator(".sheet").last();
  await sh.getByLabel("Cliente").fill("Igreja Central"); await sh.getByLabel("Data do evento").fill(dia(10)); await sh.getByLabel("Data do evento").dispatchEvent("change");
  await sh.getByLabel("Beca tradicional preta", { exact: true }).fill("12"); await sh.getByLabel("Valor total").fill("1.200,00"); await sh.getByLabel("Já pago").fill("300");
  await sh.locator("button[type=submit]").click(); await pg.waitForTimeout(200);
  if (await pg.locator(".sheet").count()) { await pg.locator(".sheet").last().locator("button[type=submit]").click(); await pg.waitForTimeout(300); }
  s = await store(); const bc = Object.values(s).find(x => x.cliente === "Igreja Central");
  ok(bc && bc.valor === 1200 && bc.pago === 300 && bc.qtd === 12 && bc.porEmail === ADRIANO, "aluguel de becas com R$ 1.200,00 e 12 becas");
  ok(/Falta receber R\$ 900/.test(await pg.textContent("#bcLista")), "falta receber R$ 900 (conta em centavos)");
  ok(erros.length === 0, "sem erros no console" + (erros.length ? ": " + erros.slice(0, 3).join(" | ") : ""));
}

console.log("Pedro (vendedor: Linha de Frente, Agendamento, Instituições):");
{
  const migrado = Object.assign({}, base, {
    "config/app": Object.assign({}, base["config/app"], { versaoDados: 3 }),
    "instituicoes/i1": Object.assign({}, base["instituicoes/i1"], { respEmail: PEDRO }),
    "formandos/f1": Object.assign({}, base["formandos/f1"], { respEmail: PEDRO, pagamentos: [{ data: dia(-40), valor: 85 }], proxVenc: dia(-10) }),
    "ensaios/c1": Object.assign({}, base["ensaios/c1"], { titulo: "" }), "privado/c1": { titulo: "Consulta médica" }
  });
  const { pg, erros, store } = await abrir(PEDRO, migrado);
  const vs = await visiveis(pg);
  ok(vs.join() === "agenda,instituicoes,pr" || (vs.includes("agenda") && vs.includes("colegios") && vs.includes("pr") && !vs.includes("vendas") && !vs.includes("formaturas") && !vs.includes("funil")), "vê só os módulos dele: " + vs.join(", "));
  await ir(pg, "#agenda"); await pg.waitForTimeout(400);
  const ag = await pg.textContent("#viewAgenda");
  ok(/ocupado/.test(ag) && !/Consulta/.test(ag), "compromisso particular aparece só como ocupado");
  ok(!(await pg.getByRole("button", { name: "+ Marcar ensaio" }).count()), "não marca ensaio");
  // Agendar colégio direto pela agenda (dia de fotos do PR)
  await pg.getByRole("button", { name: "+ Agendar colégio" }).click(); await pg.waitForTimeout(400);
  let sa = pg.locator(".sheet").last(); await sa.getByLabel("Colégio").fill("Colegio Beta"); await sa.locator("button[type=submit]").click(); await pg.waitForTimeout(300);
  sa = pg.locator(".sheet").last(); await sa.locator("input[type=date]").first().fill(dia(15));
  await sa.locator("button[type=submit]").click(); await pg.waitForTimeout(200);
  ok(/média de alunos/i.test(await sa.locator(".err").last().textContent()), "sem a média de alunos não agenda");
  await sa.getByLabel("Média de alunos (obrigatório)").fill("120"); await sa.locator("button[type=submit]").click(); await pg.waitForTimeout(200);
  ok(/WhatsApp/.test(await sa.locator(".err").last().textContent()), "sem o WhatsApp do responsável não agenda");
  await sa.getByLabel("Nome", { exact: true }).fill("Marta Diretora"); await sa.getByLabel("WhatsApp", { exact: true }).fill("21 98888-1111"); await sa.getByLabel("E-mail", { exact: true }).fill("marta@beta.com");
  await sa.locator("button[type=submit]").click(); await pg.waitForTimeout(500);
  const av = pg.locator(".sheet").last(); ok(/Avisar o colégio/i.test(await av.locator("h2").textContent()) && /pré-agendado/.test(await av.textContent()) && /120 alunos/.test(await av.textContent()), "depois de agendar, oferece a mensagem pronta para o responsável");
  await av.getByRole("button", { name: /Enviar no WhatsApp/ }).click(); await pg.waitForTimeout(200);
  ok(/wa\.me\/5521988881111/.test(await pg.evaluate(() => window.__aberto)), "abre o WhatsApp da diretora com a mensagem");
  const sAg = await store(); ok(sAg["instituicoes/i2"].mediaAlunos === 120 && sAg["instituicoes/i2"].alunosEstimado === true && sAg["instituicoes/i2"].contatos.some(c => c.email === "marta@beta.com") && sAg["agenda/" + dia(15)].contato.tel === "21988881111", "média de alunos e responsável gravados");
  ok(sAg["agenda/" + dia(15)] && sAg["agenda/" + dia(15)].instNome === "COLEGIO BETA" && sAg["agenda/" + dia(15)].pedidoEmail === PEDRO && sAg["instituicoes/i2"].diaFotos, "vendedor agenda o dia de fotos do colégio pela agenda");
  // Colégio novo cadastrado pela própria agenda
  await pg.getByRole("button", { name: "+ Agendar colégio" }).click(); await pg.waitForTimeout(400);
  sa = pg.locator(".sheet").last(); await sa.getByLabel("O que vai marcar").selectOption("formatura");
  await sa.getByLabel("Colégio").fill("Colégio Delta Novo"); await sa.getByLabel("Colégio").dispatchEvent("change");
  await sa.getByLabel("Tipo").selectOption("publico"); await sa.getByLabel("Média de alunos").fill("80"); await sa.getByLabel("Bairro").fill("Centro"); await sa.getByLabel("WhatsApp do responsável").fill("21 3333-4444"); await sa.getByLabel("Responsável", { exact: true }).fill("João Diretor");
  await sa.locator("button[type=submit]").click(); await pg.waitForTimeout(500);
  sa = pg.locator(".sheet").last(); ok(/Formatura do Colégio Delta Novo/i.test(await sa.locator("h2").textContent()), "depois de cadastrar, abre a formatura do colégio novo");
  const sNovo = await store(); const delta = Object.values(sNovo).find(x => x.nome === "Colégio Delta Novo");
  ok(delta && delta.tipo === "publico" && delta.respEmail === PEDRO && delta.etapa === "A VISITAR" && delta.contatos.length === 1 && delta.mediaAlunos === 80, "colégio novo cadastrado pela agenda (tipo, média de alunos, responsável)");
  await sa.getByText("Cancelar").click();
  await ir(pg, "#pr"); await pg.waitForTimeout(600);
  ok((await pg.textContent("#viewRepasse")).length > 50, "PR (Linha de Frente) abre");
  await ir(pg, "#inst-particular"); await pg.waitForTimeout(400);
  await pg.locator("#iChips").getByText("Todas").click(); await pg.waitForTimeout(200);
  // visita num colégio sem responsável: ele assume (por e-mail) e a visita guarda quem foi
  await pg.locator("#iList .card").filter({ hasText: "Beta" }).getByText("📝 Registrar visita / contato").click(); await pg.waitForTimeout(200);
  let sh = pg.locator(".sheet").last();
  await sh.getByLabel("Resultado").selectOption("Vai decidir em reunião"); await sh.locator("button[type=submit]").click(); await pg.waitForTimeout(400);
  let s = await store();
  ok(s["instituicoes/i2"].respEmail === PEDRO && s["instituicoes/i2"].visitas[0].porEmail === PEDRO && s["instituicoes/i2"].etapa === "VISITADO", "visita registrada em transação; Pedro vira responsável pelo e-mail");
  await pg.locator("#iList .card").filter({ hasText: "Beta" }).getByRole("button", { name: "📸 Dia de fotos" }).click(); await pg.waitForTimeout(200);
  sh = pg.locator(".sheet").last(); await sh.locator("input[type=date]").first().fill(dia(12)); await sh.locator("button[type=submit]").click(); await pg.waitForTimeout(400);
  if (await pg.locator(".sheet").count()) await pg.locator(".sheet").last().getByRole("button", { name: "Agora não" }).click().catch(() => {});
  s = await store(); ok(s["agenda/" + dia(12)] && s["agenda/" + dia(12)].pedidoEmail === PEDRO && s["agenda/" + dia(12)].status === "pendente", "pedido de data com o e-mail de quem pediu");
  await pg.getByText("👥 Formandos e parcelas").click(); await pg.waitForTimeout(400);
  const t = await pg.textContent(".panel.wide");
  ok(!/Parcela paga/.test(t) && /lançados pelo Adriano/.test(t), "na turma não registra pagamento");
  await pg.locator(".panel.wide").getByText("Editar").first().click(); await pg.waitForTimeout(200);
  ok(await pg.locator(".sheet").last().getByLabel("Valor total").isDisabled(), "não edita valor do formando");
  ok(erros.length === 0, "sem erros no console" + (erros.length ? ": " + erros.slice(0, 3).join(" | ") : ""));
}

console.log("Cadastro sem módulos:");
{
  const { pg } = await abrir(NOVO, Object.assign({}, base, { "config/app": { versaoDados: 3 } }));
  ok((await visiveis(pg)).length === 0, "não vê nenhum card");
}
await browser.close(); srv.close();
console.log(falhas ? `\n${falhas} falha(s)` : "\nTudo certo ✅");
process.exit(falhas ? 1 : 0);
