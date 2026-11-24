// Contrato de locação de becas do colégio (24/11/2026): monta o HTML pronto para imprimir/salvar em PDF,
// no modelo do contrato do Legacy, com os dados do sistema (alunos, becas, faixas, datas, valores e entradas).
// Sem imports: quem chama passa os nomes (beca, faixa, item) — assim dá para testar no node.

export const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
export const brlC = v =>
  "R$ " +
  (Number(v) || 0)
    .toFixed(2)
    .replace(".", ",")
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const DIAS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
export const dataLonga = d => {
  if (!d) return "";
  const [a, m, di] = d.split("-").map(Number);
  return `${String(di).padStart(2, "0")}/${String(m).padStart(2, "0")}/${a} (${DIAS[new Date(a, m - 1, di).getDay()]})`;
};
const UN = [
  "zero",
  "um",
  "dois",
  "três",
  "quatro",
  "cinco",
  "seis",
  "sete",
  "oito",
  "nove",
  "dez",
  "onze",
  "doze",
  "treze",
  "catorze",
  "quinze",
  "dezesseis",
  "dezessete",
  "dezoito",
  "dezenove"
];
const DZ = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const CT = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];
function ate999(n) {
  if (n === 100) return "cem";
  const c = Math.floor(n / 100),
    r = n % 100,
    p = [];
  if (c) p.push(CT[c]);
  if (r) p.push(r < 20 ? UN[r] : DZ[Math.floor(r / 10)] + (r % 10 ? " e " + UN[r % 10] : ""));
  return p.join(" e ");
}
export function porExtenso(n) {
  n = Math.round(Number(n) || 0);
  if (!n) return "zero";
  const mil = Math.floor(n / 1000),
    r = n % 1000;
  const a = mil ? (mil === 1 ? "mil" : ate999(mil) + " mil") : "";
  return a && r ? a + (r < 100 || r % 100 === 0 ? " e " : ", ") + ate999(r) : a || ate999(r);
}
export const reaisExt = v => `${brlC(v)} (${porExtenso(v)} rea${Math.round(v) === 1 ? "l" : "is"})`;
export const CSS_CONTRATO = `@page{size:A4;margin:14mm 16mm}
body{font-family:"Liberation Sans",Arial,sans-serif;font-size:9.6pt;line-height:1.32;color:#111;margin:0}
h1{font-size:13pt;text-align:center;margin:0 0 4pt}
.sub{text-align:center;font-size:9pt;margin:0 0 8pt}
h2{font-size:10pt;margin:9pt 0 3pt;text-transform:uppercase}
p{margin:0 0 4pt;text-align:justify}
table{border-collapse:collapse;width:100%;margin:2pt 0 5pt;font-size:9pt}
th,td{border:1px solid #999;padding:2pt 5pt;text-align:left} th{background:#eee} td.n{text-align:right}
tr.t td{font-weight:bold;background:#f4f4f4}
.l{display:inline-block;border-bottom:1px solid #000;height:12pt;vertical-align:bottom}
.rep{margin:4pt 0 6pt;line-height:2.2}
.ass{display:flex;gap:28pt;margin-top:40pt}
.ass div{flex:1;border-top:1px solid #000;padding-top:3pt;font-size:9pt}
.ass .f{display:block;margin-top:10pt}
.nao-imprime{position:sticky;top:0;background:#fff8e1;border-bottom:1px solid #e0c060;padding:8px;text-align:center;font:14px Arial}
.nao-imprime button{font-size:15px;padding:6px 14px;margin:0 4px}
.pg{max-width:178mm;margin:0 auto;padding:10px}
@media print{.nao-imprime{display:none}.pg{padding:0}}
`;
export const BARRA_IMPRIMIR = `<div class="nao-imprime"><button onclick="print()">🖨️ Imprimir / Salvar em PDF</button> Confira os dados antes de imprimir. Para mudar algo, ajuste no sistema e gere de novo.</div>`;
export const linha = w => `<span class="l" style="width:${w}mm"></span>`;

// d = { inst, contrato, alunos, pags, ano, nomeBeca(tipo), nomeFaixa(k), nomeItem(id), hoje "AAAA-MM-DD" }
export function dadosContratoAluguel(d) {
  const c = d.contrato || {};
  const al = (d.alunos || []).filter(a => !a.naoParticipa);
  const turmas = new Map();
  for (const a of al.filter(a => !a.soPaspatur && !a.semBeca)) {
    const t = [a.serie, a.turma].filter(Boolean).join(" ") || "Sem turma";
    const k = [t, a.becaTipo || "", a.faixa || ""].join("|");
    if (!turmas.has(k))
      turmas.set(k, {
        turma: t,
        serie: a.serie || "",
        beca: a.becaTipo,
        faixa: a.faixa,
        qtd: 0,
        tam: {},
        ret: a.retirada || "",
        dev: a.devolucao || ""
      });
    const g = turmas.get(k);
    g.qtd++;
    if (a.tamanho) g.tam[a.tamanho] = (g.tam[a.tamanho] || 0) + 1;
    if (a.retirada && (!g.ret || a.retirada < g.ret)) g.ret = a.retirada;
    if (a.devolucao && (!g.dev || a.devolucao > g.dev)) g.dev = a.devolucao;
  }
  const precos = c.precos || {};
  const itens = new Map();
  let totalAlunos = 0;
  for (const a of al) {
    totalAlunos += Number(a.valor) || 0;
    for (const it of a.pacote || []) itens.set(it, (itens.get(it) || 0) + 1);
  }
  const rec = c.recepcionista && c.recepcionista.tem ? c.recepcionista : null;
  const valorRec = rec ? Number(rec.valor) || 0 : 0;
  const entradas = (d.pags || [])
    .filter(p => p.tipo === "antecipacao" || p.alunoId === "__colegio")
    .sort((a, b) => String(a.data).localeCompare(String(b.data)));
  const pagoAlunos = (d.pags || []).filter(p => !entradas.includes(p)).reduce((s, p) => s + (Number(p.valor) || 0), 0);
  const pagoEntradas = entradas.reduce((s, p) => s + (Number(p.valor) || 0), 0);
  const total = Number(c.valor) > 0 && c.quemPaga === "colegio" ? Number(c.valor) : totalAlunos + valorRec;
  return {
    c,
    al,
    turmas: [...turmas.values()].sort((a, b) => (a.ret || "z").localeCompare(b.ret || "z") || a.turma.localeCompare(b.turma)),
    itens: [...itens.entries()].map(([id, q]) => ({ id, nome: d.nomeItem(id), q, preco: Number(precos[id]) || 0 })),
    totalAlunos,
    rec,
    valorRec,
    entradas,
    pagoEntradas,
    pagoAlunos,
    total,
    saldo: Math.max(0, total - pagoEntradas - pagoAlunos)
  };
}

export function htmlContratoAluguel(d) {
  const x = dadosContratoAluguel(d);
  const { c, turmas } = x;
  const inst = d.inst || {};
  const e = inst.endereco || {};
  const ender = [[e.rua, e.numero].filter(Boolean).join(", "), e.bairro, e.cidade ? e.cidade + "/RJ" : ""].filter(Boolean).join(" – ");
  const nome = String(inst.nome || "").toUpperCase();
  const colegioPaga = c.quemPaga === "colegio";
  const qtd = x.al.length;
  const qb = turmas.reduce((s, g) => s + g.qtd, 0);
  const kitUnit = qtd ? x.totalAlunos / qtd : 0;
  const tamTxt = g =>
    Object.entries(g.tam)
      .map(([t, q]) => `${q} ${t}`)
      .join(", ") || "a medir";
  const datasIguais = turmas.every(g => g.ret === g.dev);

  const linhasItens = x.itens
    .map(
      i =>
        `<tr><td>${esc(i.id === "beca" ? "Locação de beca com faixa" : i.nome)}${i.id === "beca" ? "" : " (fica com o aluno)"}</td><td class="n">${i.preco ? brlC(i.preco) : "—"}</td><td class="n">${i.q}</td><td class="n">${i.preco ? brlC(i.preco * i.q) : "—"}</td></tr>`
    )
    .join("");
  const linhasEntr = x.entradas
    .map(
      p =>
        `<tr><td colspan="3">(–) Entrada já paga em ${esc(
          String(p.data || "")
            .split("-")
            .reverse()
            .join("/")
        )}${p.forma ? " (" + esc(p.forma) + ")" : ""}</td><td class="n">– ${brlC(p.valor)}</td></tr>`
    )
    .join("");

  let n = 0;
  const cl = t => `<h2>Cláusula ${++n} – ${t}</h2>`;
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Contrato de locação de becas · ${esc(inst.nome)} · ${d.ano}</title><style>
${CSS_CONTRATO}</style></head><body>
${BARRA_IMPRIMIR}
<div class="pg">
<h1>CONTRATO DE LOCAÇÃO DE BECAS – FORMATURA ${d.ano}<br>${esc(nome)}</h1>
<p class="sub">${qtd} aluno${qtd === 1 ? "" : "s"} · ${turmas.length} turma${turmas.length === 1 ? "" : "s"} · dados do sistema Z7 em ${esc(
    String(d.hoje || "")
      .split("-")
      .reverse()
      .join("/")
  )}</p>

${cl("Das partes")}
<p>1.1. <b>LOCADORA:</b> STUDIO Z7 PRODUÇÕES LTDA, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº 28.336.346/0001-84, com sede na Estrada Doutor Rufino Gonçalves Ferreira, 290 – Centro, Nilópolis/RJ, neste ato representada por seu(sua) representante legal:</p>
<p class="rep">Nome: ${linha(95)} &nbsp; CPF: ${linha(45)}</p>
<p>1.2. <b>LOCATÁRIA:</b> ${esc(nome)}, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº ${inst.cnpj ? esc(inst.cnpj) : linha(45)}, com sede ${ender ? "em " + esc(ender) : "na " + linha(110)}, neste ato representada por seu(sua) representante legal:</p>
<p class="rep">Nome: ${linha(95)} &nbsp; CPF: ${linha(45)}</p>
<p>As partes acima têm entre si justo e contratado o presente Contrato de Locação de Bens Móveis, regido pelos arts. 565 a 578 do Código Civil (Lei nº 10.406/2002), pelas cláusulas a seguir.</p>

${cl("Do objeto")}
<p>${n}.1. O objeto deste contrato é a locação de ${qb} (${porExtenso(qb)}) beca${qb === 1 ? "" : "s"} com faixa, uma por aluno, para a cerimônia de formatura ${d.ano} da LOCATÁRIA, assim distribuídas:</p>
<table><tr><th>Turma</th><th>Beca</th><th>Faixa</th><th class="n">Qtd.</th><th>Tamanhos</th></tr>
${turmas.map(g => `<tr><td>${esc(g.turma)}</td><td>${esc(d.nomeBeca(g.beca) || "—")}</td><td>${esc(g.faixa ? d.nomeFaixa(g.faixa) : "—")}</td><td class="n">${g.qtd}</td><td>${esc(tamTxt(g))}</td></tr>`).join("")}
</table>
${
  x.itens.some(i => i.id !== "beca")
    ? `<p>${n}.2. Fazem parte do kit de cada aluno, e ficam com ele após a formatura: ${x.itens
        .filter(i => i.id !== "beca")
        .map(i => esc(i.nome.toLowerCase()))
        .join(", ")}.</p>`
    : ""
}
${x.rec ? `<p>${n}.${x.itens.some(i => i.id !== "beca") ? 3 : 2}. A LOCADORA também envia recepcionista${x.rec.nome ? " (" + esc(x.rec.nome) + ")" : ""} para ajudar os alunos a vestir as becas no dia da cerimônia.</p>` : ""}

${cl("Dos valores e do pagamento")}
<p>${n}.1. O valor do kit por aluno é de ${reaisExt(kitUnit)}, assim composto:</p>
<table><tr><th>Item</th><th class="n">Valor unitário</th><th class="n">Quantidade</th><th class="n">Subtotal</th></tr>
${linhasItens}
<tr class="t"><td>Kit por aluno</td><td class="n">${brlC(kitUnit)}</td><td class="n">${qtd}</td><td class="n">${brlC(x.totalAlunos)}</td></tr>
${x.valorRec ? `<tr><td>Recepcionista no dia (${x.rec.quemPaga === "alunos" ? "dividido entre os alunos" : "pago pelo colégio"})</td><td class="n"></td><td class="n"></td><td class="n">${brlC(x.valorRec)}</td></tr>` : ""}
<tr class="t"><td colspan="3">Valor total do contrato</td><td class="n">${brlC(x.total)}</td></tr>
${linhasEntr}
${x.pagoAlunos ? `<tr><td colspan="3">(–) Já pago pelos alunos até hoje</td><td class="n">– ${brlC(x.pagoAlunos)}</td></tr>` : ""}
${x.entradas.length || x.pagoAlunos ? `<tr class="t"><td colspan="3">Saldo a pagar</td><td class="n">${brlC(x.saldo)}</td></tr>` : ""}
</table>
${
  colegioPaga
    ? `<p>${n}.2. O saldo de ${reaisExt(x.saldo)} será pago pela LOCATÁRIA no ato da entrega das becas, por Pix ou boleto em nome da LOCADORA (CNPJ 28.336.346/0001-84). A LOCADORA emitirá recibo de cada pagamento.</p>
<p>${n}.3. O atraso no pagamento sujeita a LOCATÁRIA a multa de 2% (dois por cento) sobre o valor em atraso, juros de mora de 1% (um por cento) ao mês e correção monetária pelo IPCA, nos termos dos arts. 395 e 406 do Código Civil.</p>`
    : `<p>${n}.2. Cada aluno (ou seu responsável) paga o próprio kit, no valor de ${brlC(kitUnit)}, diretamente à LOCADORA, por Pix, cartão ou dinheiro, até o dia da retirada da beca. A LOCADORA emitirá recibo de cada pagamento.</p>
<p>${n}.3. Cabe à LOCATÁRIA divulgar às famílias o valor e o prazo de pagamento. O aluno que não tiver pago até a data da retirada só recebe a beca após o pagamento.</p>`
}
<p>${n}.4. A desistência de aluno depois que o seu canudo ou item personalizado já foi produzido não reduz o valor devido por ele, pois o material é personalizado.</p>

${cl("Das datas, da retirada e da devolução das becas")}
<table><tr><th>Turma</th><th>${datasIguais ? "Data da formatura (entrega e recolhimento)" : "Retirada"}</th>${datasIguais ? "" : "<th>Devolução</th>"}</tr>
${turmas.map(g => `<tr><td>${esc(g.turma)}</td><td>${esc(dataLonga(g.ret)) || "a combinar"}</td>${datasIguais ? "" : `<td>${esc(dataLonga(g.dev)) || "a combinar"}</td>`}</tr>`).join("")}
</table>
<p>${n}.1. ${datasIguais ? "As becas serão entregues no dia da formatura de cada turma e recolhidas pela LOCADORA no mesmo dia, ao final do evento" : "As becas serão retiradas e devolvidas nas datas acima"}, conferidas por lista de devolução assinada pelas partes. A LOCATÁRIA organiza a devolução pelos alunos.</p>
<p>${n}.2. As becas são locadas e continuam sendo da LOCADORA. Beca não devolvida, rasgada, manchada de forma permanente ou com a faixa extraviada será cobrada da LOCATÁRIA pelo valor de reposição de uma peça nova do mesmo modelo, comprovado pela LOCADORA (art. 569, IV, do Código Civil). O desgaste normal de uso não é cobrado.</p>
<p>${n}.3. As datas acima seguem a agenda combinada com a LOCATÁRIA. Mudança de data depende de disponibilidade de becas e de agenda da LOCADORA.</p>

${cl("Das obrigações das partes")}
<p>${n}.1. Cabe à LOCADORA: entregar as becas higienizadas, passadas e em bom estado, nos tamanhos medidos de cada aluno; produzir e entregar os itens do kit; trocar, no dia, beca com defeito por outra do mesmo modelo, se houver no estoque.</p>
<p>${n}.2. Cabe à LOCATÁRIA: informar à LOCADORA a lista final de alunos e as mudanças de turma; garantir o acesso da equipe da LOCADORA ao local da cerimônia; distribuir e recolher as becas, respondendo por elas até a devolução; repassar às famílias as informações deste contrato.</p>

${cl("Dos dados dos alunos")}
<p>${n}.1. Os dados dos alunos (nome, turma, tamanho da beca e telefone do responsável) serão usados somente para cumprir este contrato e para o contato com as famílias sobre ele, nos termos da Lei Geral de Proteção de Dados (Lei nº 13.709/2018) e do Estatuto da Criança e do Adolescente (Lei nº 8.069/1990). A LOCADORA os guardará com sigilo e os eliminará em até 6 (seis) meses após a devolução das becas, salvo obrigação legal de guarda.</p>

${cl("Do cancelamento")}
<p>${n}.1. A LOCATÁRIA que cancelar este contrato sem culpa da LOCADORA pagará os itens personalizados já produzidos e multa de 20% (vinte por cento) sobre o valor da locação das becas, nos termos dos arts. 408 a 416 do Código Civil. As entradas já pagas serão abatidas desses valores.</p>
<p>${n}.2. Se a LOCADORA não puder entregar as becas por culpa sua, devolverá à LOCATÁRIA os valores pagos pela locação, sem prejuízo das perdas e danos comprovados.</p>

${cl("Disposições gerais")}
<p>${n}.1. Qualquer mudança deste contrato só vale se feita por escrito e assinada pelas partes. Fica eleito o foro da Comarca de Nilópolis/RJ para resolver qualquer questão deste contrato.</p>
<p>E, por estarem de acordo, as partes assinam este contrato em 2 (duas) vias de igual teor, na presença de 2 (duas) testemunhas.</p>
<p style="margin-top:10pt">Nilópolis/RJ, ${linha(10)} de ${linha(35)} de ${d.ano}.</p>
<div class="ass"><div>STUDIO Z7 PRODUÇÕES LTDA<br>Locadora</div><div>${esc(nome)}<br>Locatária</div></div>
<div class="ass"><div>Testemunha 1<span class="f">Nome: ${linha(55)}</span><span class="f">CPF: ${linha(40)}</span></div><div>Testemunha 2<span class="f">Nome: ${linha(55)}</span><span class="f">CPF: ${linha(40)}</span></div></div>
</div></body></html>`;
}
