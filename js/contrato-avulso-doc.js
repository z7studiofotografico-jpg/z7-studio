// Contrato de locação de beca avulsa (24/11/2026): o cliente que aluga no estúdio (pessoa física ou grupo).
// Monta o HTML pronto para imprimir/salvar em PDF com os dados do aluguel (coleção "becas"). Sem imports do navegador.
import { esc, brlC, dataLonga, porExtenso, reaisExt, CSS_CONTRATO, BARRA_IMPRIMIR, linha, folha } from "./contrato-aluguel-doc.js";

const n0 = v => Number(v) || 0;
// medidas das becas (cm), dos contratos antigos do estúdio: [tamanho, manga, comprimento, largura]
const MEDIDAS_ADULTO = [
  ["PP", 58, 136, 125],
  ["P", 58, 138, 130],
  ["M", 60, 140, 135],
  ["G", 64, 144, 140],
  ["GG", 66, 148, 145],
  ["EG", 68, 152, 150],
  ["XGG", 72, 166, 160]
];
const MEDIDAS_INFANTIL = [
  ["PP", 42, 100],
  ["P", 46, 105],
  ["M", 48, 110],
  ["G", 48, 115],
  ["GG", 50, 120],
  ["EG", 52, 130]
];
const tabMedidas = (tit, m) =>
  `<table><tr><th>${tit}</th>${m.map(r => `<th class="n">${r[0]}</th>`).join("")}</tr><tr><td>Manga (ombro ao punho)</td>${m.map(r => `<td class="n">${r[1]}</td>`).join("")}</tr><tr><td>Comprimento (ombro ao pé)</td>${m.map(r => `<td class="n">${r[2]}</td>`).join("")}</tr>${m[0][3] ? `<tr><td>Largura</td>${m.map(r => `<td class="n">${r[3]}</td>`).join("")}</tr>` : ""}</table>`;

// d = { x (o aluguel), becas [[k, nome]], nomeFaixa(k), nomeCapelo(k), hoje }
export function htmlContratoAvulso(d) {
  const x = d.x || {};
  const becas = (d.becas || []).filter(([k]) => n0((x.becasQtd || {})[k]));
  const tot = x.becasQtd ? Object.values(x.becasQtd).reduce((s, v) => s + n0(v), 0) : n0(x.qtd);
  const tam = k => {
    const t = (x.tamanhosQtd || {})[k] || {};
    return Object.entries(t)
      .filter(([, q]) => n0(q))
      .map(([s, q]) => `${q} ${s}`)
      .join(", ");
  };
  const faixas = Object.keys(x.faixasQtd || {})
    .filter(k => n0(x.faixasQtd[k]))
    .map(k => `${x.faixasQtd[k]} ${d.nomeFaixa(k).toLowerCase()}`);
  const capelos = Object.keys(x.capelosQtd || {})
    .filter(k => n0(x.capelosQtd[k]))
    .map(k => `${x.capelosQtd[k]} ${d.nomeCapelo(k).toLowerCase()}`);
  const valor = n0(x.valor),
    pago = Math.min(valor, n0(x.pago)),
    falta = Math.max(0, valor - pago),
    caucao = n0(x.caucao);
  const cliente = String(x.cliente || "").toUpperCase();
  let n = 0;
  const cl = t => `<h2>Cláusula ${++n} – ${t}</h2>`;
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Contrato de locação de beca · ${esc(x.cliente)}</title><style>${CSS_CONTRATO}</style></head><body>
${BARRA_IMPRIMIR}
${folha(
  d.logo,
  `<h1>CONTRATO DE LOCAÇÃO DE BECA${tot > 1 ? "S" : ""}</h1>
<p class="sub">${tot} beca${tot === 1 ? "" : "s"}${x.evento ? " · " + esc(x.evento) : ""}${x.dataEvento ? " · evento em " + esc(dataLonga(x.dataEvento)) : ""}</p>

${cl("Das partes")}
<p>1.1. <b>LOCADORA:</b> STUDIO Z7 PRODUÇÕES LTDA, inscrita no CNPJ sob o nº 28.336.346/0001-84, com sede na Estrada Doutor Rufino Gonçalves Ferreira, 290 – Centro, Nilópolis/RJ.</p>
<p>1.2. <b>LOCATÁRIO(A):</b> ${esc(cliente) || linha(110)}</p>
<p class="rep">Nacionalidade: ${linha(48)} &nbsp; Profissão: ${linha(58)}<br>Identidade (RG): ${linha(44)} &nbsp; CPF: ${linha(52)}<br>Endereço: ${linha(140)}<br>Bairro: ${linha(42)} &nbsp; Cidade: ${linha(40)} &nbsp; UF: ${linha(8)} &nbsp; CEP: ${linha(22)}<br>Celular (WhatsApp): ${x.tel ? esc(x.tel) : linha(40)} &nbsp; E-mail: ${linha(62)}</p>
<p>As partes acima têm entre si justo e contratado o presente Contrato de Locação de Bens Móveis, regido pelos arts. 565 a 578 do Código Civil (Lei nº 10.406/2002), pelas cláusulas a seguir.</p>

${cl("Do objeto")}
<p>${n}.1. A LOCADORA aluga ao(à) LOCATÁRIO(A) ${tot} (${porExtenso(tot)}) beca${tot === 1 ? "" : "s"}${x.evento ? ", para uso no evento " + esc(x.evento) : ""}${x.dataEvento ? ", em " + esc(dataLonga(x.dataEvento)) : ""}:</p>
<table><tr><th>Beca</th><th class="n">Qtd.</th><th>Tamanhos</th></tr>
${becas.map(([k, t]) => `<tr><td>${esc(t)}</td><td class="n">${n0(x.becasQtd[k])}</td><td>${esc(tam(k)) || "—"}</td></tr>`).join("") || `<tr><td>Beca</td><td class="n">${tot}</td><td>${esc(x.tamanhos || "—")}</td></tr>`}
</table>
${faixas.length || capelos.length ? `<p>${n}.2. Acompanham a locação: ${[faixas.length ? "faixas (" + faixas.join(", ") + ")" : "", capelos.length ? capelos.join(", ") : ""].filter(Boolean).join("; ")}.</p>` : ""}

${
  becas.length
    ? `<p>${n}.${faixas.length || capelos.length ? 3 : 2}. As becas são entregues nos tamanhos acima, escolhidos pelo(a) LOCATÁRIO(A) pelas medidas da LOCADORA (em cm):</p>
${becas.some(([k]) => /^inf/.test(k)) ? tabMedidas("Beca infantil", MEDIDAS_INFANTIL) : ""}${becas.some(([k]) => !/^inf|pelerine/.test(k)) ? tabMedidas("Beca adulto", MEDIDAS_ADULTO) : ""}`
    : ""
}

${cl("Do valor e do pagamento")}
<table>
<tr><td>Valor da locação</td><td class="n">${brlC(valor)}</td></tr>
${pago ? `<tr><td>(–) Já pago${x.formaPag ? " (" + esc(x.formaPag) + ")" : ""}</td><td class="n">– ${brlC(pago)}</td></tr>` : ""}
<tr class="t"><td>Falta pagar</td><td class="n">${brlC(falta)}</td></tr>
${caucao ? `<tr><td>Caução (devolvida na devolução das becas em bom estado)</td><td class="n">${brlC(caucao)}</td></tr>` : ""}
</table>
<p>${n}.1. O valor da locação é de ${reaisExt(valor)}${falta ? `, e o que falta, ${reaisExt(falta)}, será pago até a retirada` : ", já quitado"}. A LOCADORA emitirá recibo de cada pagamento.</p>
${caucao ? `<p>${n}.2. A caução de ${reaisExt(caucao)} será devolvida ao(à) LOCATÁRIO(A) na devolução das becas, depois da conferência. Havendo dano ou falta de peça, o valor será abatido da caução, conforme a Cláusula 4.</p>` : ""}

${cl("Da retirada e da devolução")}
<table><tr><th>Retirada no estúdio</th><th>Devolução no estúdio</th></tr>
<tr><td>${esc(dataLonga(x.retirada)) || "a combinar"}${x.retiradaHora ? " às " + esc(x.retiradaHora) : ""}</td><td>${esc(dataLonga(x.devolucao)) || "a combinar"}</td></tr></table>
<p>${n}.1. As becas são entregues higienizadas e em bom estado, conferidas na retirada pelas partes, e continuam sendo da LOCADORA.</p>
<p>${n}.2. O(A) LOCATÁRIO(A) devolverá as becas no estúdio até a data acima. Se não devolver no prazo, pagará o aluguel proporcional pelos dias de atraso, enquanto as becas estiverem com ele(a) (art. 575 do Código Civil).</p>
<p>${n}.3. Beca não devolvida, rasgada, manchada de forma permanente, ou com faixa ou capelo extraviado, será cobrada pelo valor de reposição de uma peça nova do mesmo modelo (art. 569, IV, do Código Civil). O desgaste normal de uso não é cobrado. Não é permitido lavar, cortar ou ajustar as becas.</p>

${cl("Da desistência")}
<p>${n}.1. A entrada paga reserva a data e as becas para o(a) LOCATÁRIO(A). Se ele(a) desistir da locação, a entrada não é devolvida, pois vale como sinal (arras), nos termos dos arts. 418 e seguintes do Código Civil.</p>

${cl("Disposições gerais")}
<p>${n}.1. Os dados do(a) LOCATÁRIO(A) são usados somente para este contrato (Lei nº 13.709/2018). Fica eleito o foro da Comarca de Nilópolis/RJ para resolver qualquer questão deste contrato.</p>
<p style="margin-top:10pt">Nilópolis/RJ, ${linha(10)} de ${linha(35)} de ${linha(18)}.</p>
<div class="ass" style="margin-top:30pt"><div>STUDIO Z7 PRODUÇÕES LTDA<br>Locadora</div><div>${esc(cliente) || "&nbsp;"}<br>Locatário(a)</div></div>
`
)}</body></html>`;
}
