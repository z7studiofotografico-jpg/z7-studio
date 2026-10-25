// Cálculo do Dashboard de vendas, sem tela: usado pelo app ("Atualizar agora") e pelo
// script noturno do GitHub, que grava o resumo pronto em resumos/dashboard.
// Assim o Dashboard abre lendo 1 documento em vez de milhares.
import { centavos, reais, pagamentosDe, formaDe, ehColacao, emAberto, LEAD, PR, INST, BECA, ENSAIO } from "./regras.js";

const mes = d => String(d || "").slice(0, 7);
// fontes = { leads, prs, forms, insts, ens, becas } (listas de documentos); hoje = "AAAA-MM-DD"
// emailPorNome: { "Pedro Vendedor": "pedro@..." } para juntar registros antigos (só com o nome) na mesma pessoa
export function resumir(fontes, hoje, emailPorNome){
  const mapa = emailPorNome || {};
  // Quem é a pessoa: e-mail quando tiver (não muda), senão o e-mail achado pelo nome, senão o nome
  const quem = (email, nome) => String(email || "").toLowerCase() || mapa[nome] || String(nome || "");
  const { leads = [], prs = [], forms = [], insts = [], ens = [], becas = [] } = fontes;
  const meses = {};
  const M = m => (meses[m] = meses[m] || { total: 0, n: 0, origem: {}, produto: {}, pessoas: {} });
  const P = (m, k) => { const b = M(m).pessoas; return (b[k] = b[k] || { vend: 0, visitas: 0, fechados: 0, com: {} }); };
  const venda = (data, valor, produto, origem, pessoa) => {
    const m = mes(data); if (!m) return; const c = centavos(valor), b = M(m);
    b.total += c; b.n++;
    const o = (b.origem[origem] = b.origem[origem] || { v: 0, n: 0 }); o.v += c; o.n++;
    const p = (b.produto[produto] = b.produto[produto] || { v: 0, n: 0 }); p.v += c; p.n++;
    if (pessoa) P(m, pessoa).vend += c;
  };
  // base de comissão: soma por "linha|forma" (a taxa é aplicada na tela, com os percentuais de Ajustes)
  const comissao = (data, base, linha, forma, pessoa) => { const m = mes(data); if (!m || !pessoa) return; const k = linha + "|" + (forma || ""), c = P(m, pessoa).com; c[k] = (c[k] || 0) + centavos(base); };
  const instPorId = Object.fromEntries(insts.map(i => [i.id, i]));

  leads.filter(l => l.etapa === LEAD.FECHADO).forEach(l => venda(l.fechadoEm || String(l.criadoEm || "").slice(0, 10), l.valor, l.servico || "Ensaio", "Funil", quem(l.respEmail, l.resp)));
  prs.filter(r => r.etapa === PR.PAGO || r.etapa === PR.ENTREGUE).forEach(r => {
    const d = r.pagoEm || "", pessoa = quem(r.respEmail, r.resp);
    venda(d, r.valor, Number(r.ano) >= Number(d.slice(0, 4)) ? "Kit PR · Linha de Frente" : "Kit PR · Repasse", "PR", pessoa);
    comissao(d, r.valor, "pr", formaDe(r.formaPag), pessoa);
  });
  let aReceber = 0;
  forms.filter(f => f.status !== "desistiu").forEach(f => {
    const inst = instPorId[f.instId] || {}, pessoa = quem(f.respEmail || inst.respEmail, f.resp || inst.resp), col = ehColacao(f);
    venda(f.vendidoEm || String(f.criadoEm || "").slice(0, 10), f.valor, col ? "Colação de grau" : f.kit || "Álbum de formatura", "Formaturas", pessoa);
    aReceber += centavos(emAberto(f));
    pagamentosDe(f).forEach(p => comissao(p.data || f.vendidoEm, p.valor, col ? "colacao" : "form", col ? "Boleto" : formaDe(f.formaPag), pessoa));
  });
  ens.filter(e => e.kind !== "pessoal" && !e.leadId && centavos(e.valor) && e.status !== ENSAIO.FALTOU && e.data <= hoje)
    .forEach(e => venda(e.data, e.valor, e.tipo || "Ensaio", "Estúdio", quem(e.marcadoEmail, e.marcadoPor)));
  becas.filter(b => b.status !== BECA.CANCELADO && centavos(b.valor))
    .forEach(b => venda(b.retirada || String(b.criadoEm || "").slice(0, 10), b.valor, "Aluguel de becas", "Becas", quem(b.porEmail, b.por)));

  const marcadas = [];
  insts.forEach(i => {
    (i.visitas || []).forEach(v => { if (v.data && /visita/i.test(v.como || "Visita")) P(mes(v.data), quem(v.porEmail, v.por)).visitas++; });
    if (i.etapa === INST.FECHADO && i.fechadoEm) P(mes(i.fechadoEm), quem(i.respEmail, i.resp)).fechados++;
    if (i.followup && i.followup >= hoje && i.etapa !== INST.FECHADO && i.etapa !== INST.NAO_FECHOU && (i.proximoPasso === "Voltar para visita" || i.etapa === INST.AGENDAR_VISITA || i.followupHora))
      marcadas.push({ data: i.followup, hora: i.followupHora || "", por: quem(i.respEmail, i.resp), inst: i.nome || "" });
  });
  marcadas.sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora));
  // guarda só os últimos 24 meses
  const corte = mes(hoje).replace(/^(\d{4})/, y => String(Number(y) - 2));
  Object.keys(meses).forEach(m => { if (m < corte) delete meses[m]; });
  return { meses, aReceber: reais(aReceber), marcadas: marcadas.slice(0, 40), geradoEm: new Date().toISOString(), hoje };
}

// Soma os meses de um período (lista de "AAAA-MM")
export function periodo(resumo, listaMeses){
  const out = { total: 0, n: 0, origem: {}, produto: {}, pessoas: {} };
  listaMeses.forEach(m => {
    const b = resumo.meses[m]; if (!b) return;
    out.total += b.total; out.n += b.n;
    for (const [k, v] of Object.entries(b.origem)) { const o = (out.origem[k] = out.origem[k] || { v: 0, n: 0 }); o.v += v.v; o.n += v.n; }
    for (const [k, v] of Object.entries(b.produto)) { const o = (out.produto[k] = out.produto[k] || { v: 0, n: 0 }); o.v += v.v; o.n += v.n; }
    for (const [k, v] of Object.entries(b.pessoas)) {
      const o = (out.pessoas[k] = out.pessoas[k] || { vend: 0, visitas: 0, fechados: 0, com: {} });
      o.vend += v.vend; o.visitas += v.visitas; o.fechados += v.fechados;
      for (const [kk, c] of Object.entries(v.com)) o.com[kk] = (o.com[kk] || 0) + c;
    }
  });
  return out; // valores em centavos
}
// Comissão em centavos de uma pessoa, aplicando as taxas (linha|forma → %)
export function comissaoDe(pessoa, taxaFn){
  let total = 0, semForma = 0;
  for (const [k, base] of Object.entries(pessoa.com || {})) {
    const [linha, forma] = k.split("|");
    if (!forma && linha !== "colacao") { semForma++; continue; }
    total += Math.round(base * taxaFn(linha, forma) / 100);
  }
  return { total, semForma };
}
