// Cálculo do Dashboard de vendas, sem tela: usado pelo app ("Atualizar agora") e pelo
// script noturno do GitHub, que grava o resumo pronto em resumos/dashboard.
// Assim o Dashboard abre lendo 1 documento em vez de milhares.
import { centavos, reais, pagamentosDe, formaDe, ehColacao, emAberto, atrasado, LEAD, PR, INST, BECA, ENSAIO } from "./regras.js";

const mes = d => {
  const m = String(d || "").slice(0, 7);
  return /^\d{4}-\d{2}$/.test(m) ? m : "";
};
// soma num mapa de objetos: soma(mapa, "chave", "campo", valor)
const soma = (o, k, campo, v) => {
  const x = (o[k] = o[k] || {});
  x[campo] = (x[campo] || 0) + v;
};
// Números de cada card, por mês (valores em centavos)
const novoPR = () => ({ v: 0, n: 0, separados: 0, lf: {}, rep: {}, forma: {}, pessoas: {} });
const novoForm = () => ({ vendCol: {}, vendAlb: {}, recCol: 0, recAlb: 0, colegios: 0, pessoas: {} });
const novoFunil = () => ({ criados: 0, fechados: 0, perdidos: 0, v: 0, origem: {}, servico: {}, pessoas: {} });
// fontes = { leads, prs, forms, insts, ens, becas } (listas de documentos); hoje = "AAAA-MM-DD"
// emailPorNome: { "Pedro Vendedor": "pedro@..." } para juntar registros antigos (só com o nome) na mesma pessoa
export function resumir(fontes, hoje, emailPorNome) {
  const mapa = emailPorNome || {};
  // Quem é a pessoa: e-mail quando tiver (não muda), senão o e-mail achado pelo nome, senão o nome
  const quem = (email, nome) => String(email || "").toLowerCase() || mapa[nome] || String(nome || "");
  const { leads = [], prs = [], forms = [], insts = [], ens = [], becas = [] } = fontes;
  const meses = {};
  const M = m =>
    (meses[m] = meses[m] || { total: 0, n: 0, origem: {}, produto: {}, pessoas: {}, pr: novoPR(), form: novoForm(), funil: novoFunil() });
  const P = (m, k) => {
    const b = M(m).pessoas;
    return (b[k] = b[k] || { vend: 0, visitas: 0, fechados: 0, com: {} });
  };
  const venda = (data, valor, produto, origem, pessoa) => {
    const m = mes(data);
    if (!m) return;
    const c = centavos(valor),
      b = M(m);
    b.total += c;
    b.n++;
    const o = (b.origem[origem] = b.origem[origem] || { v: 0, n: 0 });
    o.v += c;
    o.n++;
    const p = (b.produto[produto] = b.produto[produto] || { v: 0, n: 0 });
    p.v += c;
    p.n++;
    if (pessoa) P(m, pessoa).vend += c;
  };
  // base de comissão: soma por "linha|forma" (a taxa é aplicada na tela, com os percentuais de Ajustes)
  const comissao = (data, base, linha, forma, pessoa) => {
    const m = mes(data);
    if (!m || !pessoa) return;
    const k = linha + "|" + (forma || ""),
      c = P(m, pessoa).com;
    c[k] = (c[k] || 0) + centavos(base);
  };
  const instPorId = Object.fromEntries(insts.map(i => [i.id, i]));

  // Funil: entradas (criados), vendas (fechados) e perdidos, por mês, origem e pessoa
  const agoraFunil = { abertos: 0, atrasados: 0, emNegociacao: 0 };
  leads.forEach(l => {
    const pessoa = quem(l.respEmail, l.resp),
      origem = l.origem || "Sem origem";
    const mc = mes(l.criadoEm);
    if (mc) {
      const F = M(mc).funil;
      F.criados++;
      soma(F.origem, origem, "criados", 1);
    }
    if (l.etapa === LEAD.FECHADO) {
      const d = l.fechadoEm || String(l.criadoEm || "").slice(0, 10),
        mf = mes(d);
      venda(d, l.valor, l.servico || "Ensaio", "Funil", pessoa);
      if (mf) {
        const F = M(mf).funil,
          c = centavos(l.valor);
        F.fechados++;
        F.v += c;
        soma(F.origem, origem, "fechados", 1);
        soma(F.origem, origem, "v", c);
        soma(F.servico, l.servico || "Outro", "v", c);
        soma(F.servico, l.servico || "Outro", "n", 1);
        if (pessoa) {
          soma(F.pessoas, pessoa, "fechados", 1);
          soma(F.pessoas, pessoa, "v", c);
        }
      }
    } else if (l.etapa === LEAD.PERDIDO) {
      const mp = mes(l.atualizadoEm || l.criadoEm);
      if (mp) M(mp).funil.perdidos++;
    } else {
      agoraFunil.abertos++;
      agoraFunil.emNegociacao += centavos(l.valor);
      if (l.followup && l.followup < hoje) agoraFunil.atrasados++;
    }
  });
  let aConferir = 0;
  prs
    .filter(r => r.etapa === PR.PAGO || r.etapa === PR.ENTREGUE)
    .forEach(r => {
      const d = r.pagoEm || "",
        pessoa = quem(r.respEmail, r.resp);
      const lf = Number(r.ano) >= Number(d.slice(0, 4)),
        c = centavos(r.valor),
        mp = mes(d);
      venda(d, r.valor, lf ? "Kit PR · Linha de Frente" : "Kit PR · Repasse", "PR", pessoa);
      if (mp) {
        const R = M(mp).pr;
        R.v += c;
        R.n++;
        soma(R, lf ? "lf" : "rep", "v", c);
        soma(R, lf ? "lf" : "rep", "n", 1);
        soma(R.forma, formaDe(r.formaPag) || "Sem forma", "v", c);
        soma(R.forma, formaDe(r.formaPag) || "Sem forma", "n", 1);
        if (pessoa) {
          soma(R.pessoas, pessoa, "v", c);
          soma(R.pessoas, pessoa, "n", 1);
        }
      }
      // comissão só depois da conferência do comprovante (vendas antigas, sem o campo, contam)
      if (r.conferido !== false) comissao(d, r.valor, "pr", formaDe(r.formaPag), pessoa);
      else aConferir++;
    });
  // PR: contatos separados no mês (para a taxa de conversão)
  (fontes.separados || []).forEach(r => {
    const m = mes(r.separadoEm);
    if (!m) return;
    const R = M(m).pr,
      pessoa = quem(r.respEmail, r.resp);
    R.separados++;
    soma(R, r.separadoSeg === "rep" ? "rep" : "lf", "sep", 1);
    if (pessoa) soma(R.pessoas, pessoa, "sep", 1);
  });
  let aReceber = 0;
  const agoraForm = { aReceberCol: 0, aReceberAlb: 0, atrasados: 0, atrasadoValor: 0, alunos: 0 };
  forms
    .filter(f => f.status !== "desistiu")
    .forEach(f => {
      const inst = instPorId[f.instId] || {},
        pessoa = quem(f.respEmail || inst.respEmail, f.resp || inst.resp),
        col = ehColacao(f);
      const dv = f.vendidoEm || String(f.criadoEm || "").slice(0, 10),
        cv = centavos(f.valor),
        ab = centavos(emAberto(f));
      venda(dv, f.valor, col ? "Colação de grau" : f.kit || "Álbum de formatura", "Formaturas", pessoa);
      aReceber += ab;
      agoraForm[col ? "aReceberCol" : "aReceberAlb"] += ab;
      agoraForm.alunos++;
      if (atrasado(f, hoje)) {
        agoraForm.atrasados++;
        agoraForm.atrasadoValor += ab;
      }
      if (mes(dv)) {
        const Fo = M(mes(dv)).form;
        soma(Fo, col ? "vendCol" : "vendAlb", "v", cv);
        soma(Fo, col ? "vendCol" : "vendAlb", "n", 1);
        if (pessoa) soma(Fo.pessoas, pessoa, "vend", cv);
      }
      pagamentosDe(f).forEach(p => {
        comissao(p.data || f.vendidoEm, p.valor, col ? "colacao" : "form", col ? "Boleto" : formaDe(f.formaPag), pessoa);
        const mpg = mes(p.data || f.vendidoEm);
        if (mpg) {
          const Fo = M(mpg).form,
            c = centavos(p.valor);
          Fo[col ? "recCol" : "recAlb"] += c;
          if (pessoa) soma(Fo.pessoas, pessoa, "rec", c);
        }
      });
    });
  ens
    .filter(e => e.kind !== "pessoal" && !e.leadId && centavos(e.valor) && e.status !== ENSAIO.FALTOU && e.data <= hoje)
    .forEach(e => venda(e.data, e.valor, e.tipo || "Ensaio", "Estúdio", quem(e.marcadoEmail, e.marcadoPor)));
  becas
    .filter(b => b.status !== BECA.CANCELADO && centavos(b.valor))
    .forEach(b =>
      venda(b.retirada || String(b.criadoEm || "").slice(0, 10), b.valor, "Aluguel de becas", "Becas", quem(b.porEmail, b.por))
    );

  const marcadas = [];
  insts.forEach(i => {
    (i.visitas || []).forEach(v => {
      if (v.data && /visita/i.test(v.como || "Visita")) P(mes(v.data), quem(v.porEmail, v.por)).visitas++;
    });
    if (i.etapa === INST.FECHADO && i.fechadoEm) {
      const pe = quem(i.respEmail, i.resp);
      P(mes(i.fechadoEm), pe).fechados++;
      const Fo = M(mes(i.fechadoEm)).form;
      Fo.colegios++;
      if (pe) soma(Fo.pessoas, pe, "colegios", 1);
    }
    if (
      i.followup &&
      i.followup >= hoje &&
      i.etapa !== INST.FECHADO &&
      i.etapa !== INST.NAO_FECHOU &&
      (i.proximoPasso === "Voltar para visita" || i.etapa === INST.AGENDAR_VISITA || i.followupHora)
    )
      marcadas.push({ data: i.followup, hora: i.followupHora || "", por: quem(i.respEmail, i.resp), inst: i.nome || "" });
  });
  marcadas.sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora));
  // guarda só os últimos 24 meses
  const corte = mes(hoje).replace(/^(\d{4})/, y => String(Number(y) - 2));
  Object.keys(meses).forEach(m => {
    if (m < corte) delete meses[m];
  });
  return {
    meses,
    aReceber: reais(aReceber),
    aConferir,
    marcadas: marcadas.slice(0, 40),
    agora: { funil: agoraFunil, form: agoraForm },
    geradoEm: new Date().toISOString(),
    hoje
  };
}

// Soma os meses de um período (lista de "AAAA-MM")
export function periodo(resumo, listaMeses) {
  const out = { total: 0, n: 0, origem: {}, produto: {}, pessoas: {} };
  listaMeses.forEach(m => {
    const b = resumo.meses[m];
    if (!b) return;
    out.total += b.total;
    out.n += b.n;
    for (const [k, v] of Object.entries(b.origem)) {
      const o = (out.origem[k] = out.origem[k] || { v: 0, n: 0 });
      o.v += v.v;
      o.n += v.n;
    }
    for (const [k, v] of Object.entries(b.produto)) {
      const o = (out.produto[k] = out.produto[k] || { v: 0, n: 0 });
      o.v += v.v;
      o.n += v.n;
    }
    for (const [k, v] of Object.entries(b.pessoas)) {
      const o = (out.pessoas[k] = out.pessoas[k] || { vend: 0, visitas: 0, fechados: 0, com: {} });
      o.vend += v.vend;
      o.visitas += v.visitas;
      o.fechados += v.fechados;
      for (const [kk, c] of Object.entries(v.com)) o.com[kk] = (o.com[kk] || 0) + c;
    }
  });
  out.pr = juntar(listaMeses.map(m => (resumo.meses[m] || {}).pr).filter(Boolean));
  out.form = juntar(listaMeses.map(m => (resumo.meses[m] || {}).form).filter(Boolean));
  out.funil = juntar(listaMeses.map(m => (resumo.meses[m] || {}).funil).filter(Boolean));
  return out; // valores em centavos
}
// Soma objetos de mesma forma (números somam, objetos somam por dentro)
export function juntar(lista) {
  const out = {};
  const add = (dst, src) => {
    for (const [k, v] of Object.entries(src || {})) {
      if (typeof v === "number") dst[k] = (dst[k] || 0) + v;
      else if (v && typeof v === "object") add((dst[k] = dst[k] || {}), v);
    }
  };
  lista.forEach(x => add(out, x));
  return out;
}
// Comissão em centavos de uma pessoa, aplicando as taxas (linha|forma → %)
export function comissaoDe(pessoa, taxaFn) {
  let total = 0,
    semForma = 0;
  for (const [k, base] of Object.entries(pessoa.com || {})) {
    const [linha, forma] = k.split("|");
    if (!forma && linha !== "colacao") {
      semForma++;
      continue;
    }
    total += Math.round((base * taxaFn(linha, forma)) / 100);
  }
  return { total, semForma };
}
