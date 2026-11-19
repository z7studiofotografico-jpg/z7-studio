// Ficha de identificação e autorização para imprimir (18/11/2026): uma só, para PR, Formatura e Paspatur.
// Folha A4 deitada com 2 fichas iguais (corta no meio): a frente é a identificação, em quadradinhos para letra de
// forma (uma letra por quadrado: a família escreve melhor e o 🤖 Cadastro automático lê melhor); o verso é a
// autorização (sem visita; o material fica 3 dias com o representante; ☐ NÃO autorizo o mural).
// Imprimir frente e verso, virando pela borda curta (as duas metades são iguais, então o verso sempre casa).

const SITE = "www.z7studio.com.br";
const ZAP = "(21) 3743-0000";
const EMAIL = "z7studiofotografico@gmail.com";

// uma ficha só para PR, Formatura e Paspatur (como a antiga): o mesmo texto para tudo (18/11/2026)
const TEXTO =
  "A Z7 Studio Fotográfico vai fotografar o(a) aluno(a) identificado(a) na frente desta ficha, na escola, vestindo beca de formatura, para um trabalho de recordação escolar. A sessão de fotos é gratuita e sem compromisso de compra.";

const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
// n quadradinhos (com o texto já escrito, quando vem preenchido); sep = posições com / ou - entre os quadrados
function caixas(n, txt = "", sep = {}) {
  const t = String(txt || "").toUpperCase();
  let h = "";
  for (let i = 0; i < n; i++) {
    if (sep[i]) h += `<i class="sep">${sep[i]}</i>`;
    h += `<b>${esc(t[i] || "")}</b>`;
  }
  return `<span class="cx">${h}</span>`;
}
const campo = (rot, n, txt, sep, cls = "") => `<div class="campo ${cls}"><label>${rot}</label>${caixas(n, txt, sep)}</div>`;
const DATA = { 2: "/", 4: "/" };
const CEL = { 0: "(", 2: ")" };

function frente(o) {
  return `<section class="ficha">
  <header class="topo">
    <img src="${o.logo}" alt="">
    <div><h1>Z7 Studio Fotográfico</h1><p>${SITE} · WhatsApp ${ZAP}</p></div>
    <div class="num"><small>Nº da ficha</small>${caixas(3)}<em>não preencher</em></div>
  </header>
  <h2>Ficha de identificação</h2>
  <p class="aviso">Escreva com <b>LETRA DE FORMA</b>, uma letra em cada quadrado ${caixas(5, "MARIA")}<br><b>Deixe um quadrado vazio entre as palavras</b></p>
  ${campo("Colégio", 22, o.colegio)}
  <div class="linha">${campo("Série", 6, o.serie)}${campo("Turma", 5, o.turma)}${campo("Data da foto", 8, o.data, DATA)}</div>
  ${campo("Nome completo do(a) aluno(a)", 22)}
  ${campo("", 22, "", {}, "cont")}
  <div class="linha">${campo("Nascimento do(a) aluno(a)", 8, "", DATA)}${campo("WhatsApp do(a) aluno(a)", 11, "", CEL)}</div>
  ${campo("Nome da mãe ou responsável", 22)}
  <div class="linha">${campo("WhatsApp da mãe ou responsável", 11, "", CEL)}${campo("Parentesco", 6)}</div>
  ${campo("Nome do pai", 22)}
  ${campo("WhatsApp do pai", 11, "", CEL)}
  ${campo("Endereço (rua, avenida)", 22)}
  <div class="linha">${campo("Nº", 5)}${campo("Bairro", 15)}</div>
  <div class="linha">${campo("Cidade", 12)}${campo("CEP", 8, "", { 5: "-" })}</div>
  ${campo("E-mail", 22)}
  <p class="obrig">Preenchimento obrigatório · entraremos em contato pelo WhatsApp</p>
</section>`;
}

function verso(o) {
  return `<section class="ficha verso">
  <header class="topo">
    <img src="${o.logo}" alt="">
    <div><h1>Z7 Studio Fotográfico</h1><p>${SITE} · WhatsApp ${ZAP}</p></div>
  </header>
  <h2>Autorização</h2>
  <ol class="termos">
    <li>${TEXTO}</li>
    <li><b>3 dias para decidir.</b> Depois de apresentado, o material fica 3 dias com o representante, para a família decidir com calma.</li>
    <li><b>Sem compromisso.</b> Quem não quiser adquirir não paga nada, e as fotos são descartadas.</li>
  </ol>
  <div class="opc"><span>☐ Quero que o(a) aluno(a) faça a foto para decidir se vamos comprar, mas <b>NÃO</b> autorizo a foto no quadro mural da escola.</span></div>
  <p class="info">Os dados desta ficha são usados só para entrarmos em contato.</p>
  <p class="decl">Sou responsável pelo(a) aluno(a) identificado(a) na frente desta ficha e autorizo a sessão de fotos nas condições acima.</p>
  ${campo("Nome do responsável", 22)}
  ${campo("", 22, "", {}, "cont")}
  <div class="linha">${campo("Parentesco", 6)}${campo("Data", 8, "", DATA)}</div>
  <div class="assin"><span></span><small>Assinatura do responsável</small></div>
  <p class="rodape">Aluno(a) com 18 anos ou mais pode assinar por si. · ${EMAIL}</p>
</section>`;
}

const CSS = `
@page { size: A4 landscape; margin: 0; }
* { box-sizing: border-box; }
body { margin: 0; font-family: "Source Sans 3", Arial, sans-serif; color: #1f1f1f; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.folha { width: 297mm; height: 210mm; display: grid; grid-template-columns: 1fr 1fr; page-break-after: always; break-after: page; position: relative; }
.folha::after { content: ""; position: absolute; left: 148.5mm; top: 6mm; bottom: 6mm; border-left: 0.3mm dashed #bbb; }
.ficha { padding: 7mm 8mm 6mm; display: flex; flex-direction: column; gap: 1.3mm; border: 0.5mm solid #2e2e2e; outline: 0.25mm solid #2e2e2e; outline-offset: -1.6mm; margin: 4mm; height: 202mm; overflow: hidden; }
.topo { display: flex; align-items: center; gap: 3mm; border-bottom: 0.6mm solid #b3141c; padding-bottom: 2mm; }
.topo img { width: 13mm; height: 13mm; }
.topo h1 { font-family: "Cormorant Garamond", Georgia, serif; font-size: 17pt; margin: 0; letter-spacing: .02em; line-height: 1; }
.topo p { margin: .6mm 0 0; font-size: 7.5pt; color: #555; }
.topo > div:nth-child(2) { flex: 1; }
.num { border: 0.4mm solid #2e2e2e; border-radius: 1.5mm; padding: 1mm 2mm 1.5mm; text-align: center; }
.num small { display: block; margin-bottom: .6mm; }
.num em { display: block; font-size: 6pt; font-style: normal; text-transform: uppercase; letter-spacing: .05em; color: #b3141c; font-weight: 700; margin-top: .5mm; }
.num .cx b { width: 6.5mm; height: 8mm; border: 0.25mm solid #8a8a8a; margin-right: 0.6mm; }
.num small { font-size: 6.5pt; text-transform: uppercase; letter-spacing: .05em; color: #555; }
h2 { font-family: "Cormorant Garamond", Georgia, serif; font-size: 16pt; color: #b3141c; margin: .6mm 0 0; text-align: center; }
.aviso { margin: 0; font-size: 9pt; line-height: 1.45; text-align: center; background: #f3f1ec; border-radius: 1.2mm; padding: 1.2mm; }
.aviso .cx b { width: 3.6mm; height: 4.6mm; font-size: 7pt; }
.campo label { display: block; font-size: 6.3pt; text-transform: uppercase; letter-spacing: .06em; color: #555; margin-bottom: .3mm; }
.campo.cont { margin-top: -1.2mm; }
.cx { display: inline-flex; }
.cx b { display: inline-flex; align-items: flex-end; justify-content: center; width: 5.5mm; height: 6.2mm; border: 0.25mm solid #8a8a8a; border-top: 0; margin-right: -0.25mm; font: 600 11pt "Source Sans 3", Arial, sans-serif; padding-bottom: .4mm; }
.cx .sep { font-style: normal; font-size: 9pt; padding: 0 .6mm; align-self: flex-end; color: #555; }
.linha { display: flex; gap: 4mm; flex-wrap: nowrap; }
.obrig { margin: 0; text-align: center; font-size: 6.8pt; text-transform: uppercase; letter-spacing: .08em; color: #b3141c; font-weight: 700; }
.termos { margin: 1mm 0 0; padding-left: 5mm; font-size: 10pt; line-height: 1.5; display: flex; flex-direction: column; gap: 2mm; }
.opc { display: flex; flex-direction: column; gap: 1mm; font-size: 10pt; margin-top: 2mm; border: 0.3mm solid #8a8a8a; border-radius: 1.5mm; padding: 2mm 3mm; padding-left: 4.5mm; }
.info { margin: 2mm 0 0; font-size: 8.4pt; color: #555; }
.decl { margin: 2mm 0 1mm; font-size: 9.6pt; font-style: italic; }
.assin { margin-top: 12mm; text-align: center; }
.assin span { display: block; border-bottom: 0.3mm solid #2e2e2e; margin: 0 8mm; }
.assin small { font-size: 7pt; color: #555; }
.rodape { margin: auto 0 0; text-align: center; font-size: 6.6pt; color: #777; }
.barra { position: sticky; top: 0; background: #2e2e2e; color: #fff; padding: 10px; text-align: center; font-family: "Source Sans 3", Arial, sans-serif; z-index: 2; }
.barra button { font: inherit; font-weight: 700; padding: 8px 16px; border: 0; border-radius: 6px; background: #b3141c; color: #fff; cursor: pointer; margin: 0 4px; }
@media print { .barra { display: none; } }
@media screen { body { background: #888; } .folha { background: #fff; margin: 10px auto; box-shadow: 0 2px 10px rgba(0,0,0,.3); } }
`;

// o documento inteiro: frente (2 fichas) + verso (2 autorizações); o = { colegio, turma, data, logo }
export function htmlFichas(o) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Ficha de identificação · Z7 Studio Fotográfico</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;0,700;1,500&family=Source+Sans+3:wght@400;600;700&display=swap">
<style>${CSS}</style></head><body>
<div class="barra">Ficha de identificação · imprima frente e verso (virar pela borda curta) e corte no meio
  <button onclick="print()">🖨️ Imprimir</button></div>
<div class="folha">${frente(o)}${frente(o)}</div>
<div class="folha">${verso(o)}${verso(o)}</div>
</body></html>`;
}

// abre as fichas numa aba nova, prontas para imprimir
export function abrirFichas(o) {
  const logo = new URL("icons/icon-192.png", location.href).href;
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.open();
  w.document.write(htmlFichas(Object.assign({ logo }, o)));
  w.document.close();
  return true;
}

// o botão "🖨️ Fichas" (na Agenda): a mesma ficha para tudo; se quiser, já sai com o colégio, a turma e a
// data da foto escritos; em branco, a família escreve tudo
export async function escolherFichas() {
  const { el, field, sheet, botoes } = await import("./ui.js");
  sheet("Fichas para imprimir", (p, close) => {
    p.append(
      el(
        "p",
        "hint",
        "2 fichas por folha A4 (corta no meio): na frente a identificação, em quadradinhos para letra de forma; no verso a autorização. Imprima frente e verso, virando pela borda curta."
      )
    );
    const col = el("input");
    col.placeholder = "em branco = a família escreve";
    const ser = el("input");
    ser.placeholder = "ex.: 3º ano";
    const tur = el("input");
    tur.placeholder = "ex.: 3003";
    const dt = el("input");
    dt.type = "date";
    const r = el("div", "row3");
    r.append(field("Série (opcional)", ser), field("Turma (opcional)", tur), field("Data da foto (opcional)", dt));
    p.append(field("Colégio (opcional)", col), r, botoes(close, "🖨️ Abrir para imprimir"));
    p.addEventListener("submit", ev => {
      ev.preventDefault();
      const d = dt.value ? dt.value.split("-").reverse().join("") : "";
      if (!abrirFichas({ colegio: col.value.trim(), serie: ser.value.trim(), turma: tur.value.trim(), data: d }))
        alert("O navegador bloqueou a janela nova. Libere as janelas (pop-ups) deste site e tente de novo.");
      else close();
    });
  });
}
