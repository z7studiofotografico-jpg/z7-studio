// Formaturas: Ficha do contrato de cada colégio (Etapa 5). Os dados do contrato + o PDF assinado anexado.
// O PDF fica no próprio documento (contratos/{instId}), em texto base64, para não precisar do Storage (que é pago).
// "Ler o PDF" sugere os campos a partir do texto do arquivo; a pessoa confere antes de salvar (nada é gravado sozinho).
// Sem CPF, RG ou data de nascimento (LGPD): só o nome de quem assinou pela comissão.
import { el, sheet, field, title } from "./ui.js";
import * as U from "./util.js";

export const MAX_PDF = 600 * 1024; // o documento do Firebase vai até 1 MB; o base64 aumenta o arquivo em 1/3
const PDFJS = {
  url: "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js",
  sri: "sha384-/1qUCSGwTur9vjf/z9lmu/eCUYbpOTgSjmpbMQZ1/CtX2v/WcAIKqRv+U1DUCG6e",
  worker: "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js"
};
export const CAMPOS_FICHA = [
  ["numero", "Nº do contrato", "text"],
  ["assinadoEm", "Assinado em", "date"],
  ["comissao", "Quem assinou pela comissão (nome)", "text"],
  ["formandos", "Quantidade de alunos", "number"],
  ["valorTotal", "Valor total (R$)", "text"],
  ["parcelas", "Parcelas", "number"],
  ["primeiroVenc", "1º vencimento", "date"],
  ["dataFormatura", "Data da formatura", "date"],
  ["local", "Local da formatura", "text"],
  ["obs", "Observações", "textarea"]
];

const dataISO = (d, m, a) => {
  const ano = String(a).length === 2 ? "20" + a : String(a);
  const dd = String(d).padStart(2, "0"),
    mm = String(m).padStart(2, "0");
  return Number(mm) >= 1 && Number(mm) <= 12 && Number(dd) >= 1 && Number(dd) <= 31 ? `${ano}-${mm}-${dd}` : "";
};
const MESES = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
// "10/03/2026", "10.03.26" ou "10 de março de 2026" → "2026-03-10"
export function lerData(t) {
  const s = U.chave(t).toLowerCase();
  let m = s.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})\b/);
  if (m) return dataISO(m[1], m[2], m[3]);
  m = s.match(/(\d{1,2}) de ([a-z]+) de (\d{4})/);
  if (m && MESES.includes(m[2])) return dataISO(m[1], MESES.indexOf(m[2]) + 1, m[3]);
  return "";
}
// sugestões a partir do texto do PDF: { campo: valor } só com o que foi achado
export function sugerirDoTexto(texto) {
  const t = String(texto || "").replace(/\s+/g, " ");
  const k = U.chave(t).toLowerCase();
  const out = {};
  const perto = (re, n = 80) => {
    const m = k.match(re);
    return m ? t.slice(m.index, m.index + m[0].length + n) : "";
  };
  let m = k.match(/contrato\s*(?:n[ºo°.]*|numero)\s*[:.]?\s*([\w/.-]{1,20})/);
  if (m) out.numero = m[1].toUpperCase();
  m = t.match(/R\$\s*([\d.]+,\d{2})/);
  const total = perto(/valor (?:total|global)/, 60).match(/R\$\s*([\d.]+,\d{2})/);
  if (total || m) out.valorTotal = (total || m)[1];
  m = k.match(/(\d{1,3})\s*(?:\(\s*[a-z ]+\)\s*)?(?:parcelas|prestacoes)/);
  if (m) out.parcelas = Number(m[1]);
  m = k.match(/(\d{1,4})\s*(?:\(\s*[a-z ]+\)\s*)?(?:formandos|alunos)/);
  if (m) out.formandos = Number(m[1]);
  const df = lerData(perto(/(?:data d[ao] (?:formatura|evento|colacao)|realizad[ao] (?:em|no dia))/));
  if (df) out.dataFormatura = df;
  const v1 = lerData(perto(/(?:primeir[ao] (?:parcela|vencimento)|1[ºo°a]? (?:parcela|vencimento))/));
  if (v1) out.primeiroVenc = v1;
  // a data da assinatura costuma ser a última por extenso ("Rio de Janeiro, 10 de março de 2026")
  const ext = [...k.matchAll(/\d{1,2} de [a-z]+ de \d{4}/g)];
  const ass = ext.length ? lerData(ext[ext.length - 1][0]) : "";
  if (ass) out.assinadoEm = ass;
  return out;
}

async function carregarPdfjs() {
  if (window.pdfjsLib) return window.pdfjsLib;
  await new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = PDFJS.url;
    s.integrity = PDFJS.sri;
    s.crossOrigin = "anonymous";
    s.onload = res;
    s.onerror = rej;
    document.head.append(s);
  });
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS.worker;
  return window.pdfjsLib;
}
async function textoDoPdf(buf) {
  const lib = await carregarPdfjs();
  const pdf = await lib.getDocument({ data: buf }).promise;
  const partes = [];
  for (let i = 1; i <= Math.min(pdf.numPages, 15); i++) {
    const pg = await pdf.getPage(i);
    partes.push((await pg.getTextContent()).items.map(x => x.str).join(" "));
  }
  return partes.join("\n");
}
const paraBase64 = buf => {
  let s = "";
  const b = new Uint8Array(buf);
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return btoa(s);
};
function baixarPdf(ficha) {
  const bin = atob(ficha.pdf);
  const b = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([b], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = ficha.pdfNome || "contrato.pdf";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export async function abrirFicha(C, inst) {
  const { FS, db } = C;
  const ref = FS.doc(db, "contratos", inst.id);
  let ficha = {};
  try {
    const s = await FS.getDoc(ref);
    if (s.exists()) ficha = s.data();
  } catch (e) {
    return C.handleErr(e);
  }
  const podeEditar = C.isAdmin || C.pode("formaturas");
  sheet("Ficha do contrato · " + title(inst.nome), (p, close) => {
    const ins = {};
    const sug = el("p", "hint");
    sug.hidden = true;
    CAMPOS_FICHA.forEach(([k, rot, tipo]) => {
      const i = el(tipo === "textarea" ? "textarea" : "input");
      if (tipo !== "textarea") i.type = tipo === "number" ? "number" : tipo;
      if (tipo === "number") i.min = "0";
      i.value = ficha[k] ?? "";
      i.disabled = !podeEditar;
      ins[k] = i;
      p.append(field(rot, i));
    });
    // PDF assinado
    let pdfNovo = null;
    const box = el("div", "field");
    const arq = el("input");
    arq.type = "file";
    arq.accept = "application/pdf,.pdf";
    arq.disabled = !podeEditar;
    box.append(el("label", null, "📎 PDF do contrato assinado (até 600 KB)"), arq);
    if (ficha.pdf) box.append(U.mkBtn(`⬇️ Baixar ${ficha.pdfNome || "contrato.pdf"}`, "", () => baixarPdf(ficha)));
    const ler = U.mkBtn("🔎 Ler o PDF e sugerir os campos", "", async () => {
      if (!pdfNovo) return U.toast("Escolha o PDF primeiro.");
      ler.disabled = true;
      try {
        const s0 = sugerirDoTexto(await textoDoPdf(pdfNovo.buf.slice(0)));
        const achou = Object.keys(s0).filter(k => ins[k] && !String(ins[k].value).trim());
        achou.forEach(k => {
          ins[k].value = s0[k];
          ins[k].classList.add("sugerido");
        });
        sug.hidden = false;
        sug.textContent = achou.length
          ? `Sugeri ${achou.length} campo${achou.length > 1 ? "s" : ""} (marcados em amarelo). Confira com o contrato antes de salvar.`
          : "Não achei nada novo no texto do PDF (se for uma foto escaneada, preencha à mão).";
      } catch (e) {
        console.warn(e);
        U.toast("Não consegui ler o texto do PDF. Preencha à mão.");
      } finally {
        ler.disabled = false;
      }
    });
    ler.hidden = !podeEditar;
    arq.onchange = async () => {
      const f = arq.files[0];
      pdfNovo = null;
      if (!f) return;
      if (f.size > MAX_PDF) {
        arq.value = "";
        return U.toast(
          `O PDF tem ${Math.round(f.size / 1024)} KB. O limite é 600 KB: diminua o arquivo (ex.: "comprimir PDF") e tente de novo.`
        );
      }
      pdfNovo = { nome: f.name, buf: await f.arrayBuffer() };
    };
    p.append(box, ler, sug);
    const a = el("div", "panel-actions");
    a.append(el("span"), U.mkBtn("Fechar", "", close));
    a.firstChild.style.flex = "1";
    if (podeEditar)
      a.append(
        U.mkBtn("Salvar", "btn-primary", async ev => {
          ev.target.disabled = true;
          const dados = {};
          CAMPOS_FICHA.forEach(([k, , tipo]) => {
            const v = String(ins[k].value || "").trim();
            dados[k] = tipo === "number" ? Number(v) || 0 : v;
          });
          Object.assign(dados, {
            instId: inst.id,
            instNome: inst.nome || "",
            atualizadoEm: new Date().toISOString(),
            atualizadoPor: C.me || ""
          });
          if (pdfNovo) Object.assign(dados, { pdf: paraBase64(pdfNovo.buf), pdfNome: pdfNovo.nome, pdfEm: U.todayStr() });
          try {
            await FS.setDoc(ref, dados, { merge: true });
            U.toast("Ficha do contrato salva ✅");
            close();
          } catch (e) {
            ev.target.disabled = false;
            C.handleErr(e);
          }
        })
      );
    p.append(a);
  });
}
