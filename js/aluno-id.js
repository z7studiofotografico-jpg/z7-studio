// ID do aluno (usado pelo estúdio para separar as fotos e identificar o aluno no ano): "SIGLA - NN".
// SIGLA = iniciais do nome do colégio (COLEGIO ESTADUAL PROFESSOR NEY CIDADE PALMEIRO → CEPNCP);
// CIEP usa o número (CIEP 225 → CIEP225); se outro colégio já usa as mesmas iniciais,
// fica com as iniciais e o último nome inteiro (CEPNC + PALMEIRO → CEPNCPALMEIRO).
// NN = número do aluno no colégio, em sequência.
// Também avalia telefones: não dá para saber se o número existe sem mandar mensagem,
// mas dá para pegar os que com certeza estão errados (DDD que não existe, celular sem o 9, número repetido).
// Sem tela: testado em tests/aluno-id.test.mjs.
import { chave } from "./util.js";

const LIGA = new Set(["DE", "DA", "DO", "DAS", "DOS", "E", "D"]);
const palavras = nome =>
  chave(nome)
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);

export function siglaDe(nome, ocupadas) {
  const p = palavras(nome);
  if (!p.length) return "";
  // CIEP: "CIEP 225 ...", "CIEP225 ..." ou "CIEP Nº 225"
  const i = p.findIndex(w => /^CIEP\d*$/.test(w));
  if (i >= 0) {
    const n = p[i].slice(4) || (p.slice(i + 1).find(w => /^\d+$/.test(w)) || "").replace(/^0+(?=\d)/, "");
    return "CIEP" + n;
  }
  const q = p.filter(w => !LIGA.has(w));
  const sig = q.map(w => (/^\d+$/.test(w) ? w : w[0])).join("");
  if (!(ocupadas || []).includes(sig) || q.length < 2) return sig;
  // mesmas iniciais de outro colégio: iniciais + o último nome inteiro
  return (
    q
      .slice(0, -1)
      .map(w => (/^\d+$/.test(w) ? w : w[0]))
      .join("") + q[q.length - 1]
  );
}

// "CEPNCP - 01", "cepncp-1", "CIEP225 - 3" → { sigla, n }; outro formato → null
export function lerCodigo(c) {
  const m = chave(c).match(/^([A-Z0-9]+(?: [A-Z0-9]+)*?)\s*-\s*(\d{1,4})$/);
  if (!m) return null;
  return { sigla: m[1].replace(/\s+/g, ""), n: Number(m[2]) };
}
export const fmtCodigo = (sigla, n) => `${sigla} - ${String(n).padStart(2, "0")}`;
// Forma única para buscar (sem espaço e com o número em 2 dígitos): "CEPNCP01"
export function codigoBusca(c) {
  const x = lerCodigo(c);
  if (x) return x.sigla + String(x.n).padStart(2, "0");
  return chave(c).replace(/[^A-Z0-9]/g, "");
}
// O texto digitado na busca parece um ID? ("CEPNCP 05", "cepncp-5", "CIEP225 - 03")
export function pareceCodigo(t) {
  return /^[A-Za-z][A-Za-z0-9]{1,15}\s*[-\s]\s*\d{1,4}$/.test(String(t || "").trim());
}
export function codigoDaBusca(t) {
  const m = chave(t).match(/^([A-Z][A-Z0-9]{1,15})\s*[-\s]\s*(\d{1,4})$/);
  return m ? m[1] + m[2].padStart(2, "0") : "";
}

// Sigla que um colégio já usa (a mais comum entre os IDs dos alunos dele), ou "" se ninguém tem ID
export function siglaUsada(codigos) {
  const n = {};
  (codigos || []).forEach(c => {
    const x = lerCodigo(c);
    if (x) n[x.sigla] = (n[x.sigla] || 0) + 1;
  });
  const top = Object.entries(n).sort((a, b) => b[1] - a[1])[0];
  return top ? top[0] : "";
}
// Próximo ID do colégio: depois do maior número já usado com essa sigla
export function proximoCodigo(sigla, codigos) {
  if (!sigla) return "";
  let max = 0;
  (codigos || []).forEach(c => {
    const x = lerCodigo(c);
    if (x && x.sigla === sigla && x.n > max) max = x.n;
  });
  return fmtCodigo(sigla, max + 1);
}
// Ordem da lista por ID (sigla, número); quem não tem ID vai para o fim, por nome
export function ordemCodigo(a, b) {
  const x = lerCodigo(a.codigo),
    y = lerCodigo(b.codigo);
  if (x && y) return x.sigla.localeCompare(y.sigla) || x.n - y.n;
  if (x || y) return x ? -1 : 1;
  return String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR");
}

// DDDs que existem no Brasil
const DDDS = new Set(
  "11 12 13 14 15 16 17 18 19 21 22 24 27 28 31 32 33 34 35 37 38 41 42 43 44 45 46 47 48 49 51 53 54 55 61 62 63 64 65 66 67 68 69 71 73 74 75 77 79 81 82 83 84 85 86 87 88 89 91 92 93 94 95 96 97 98 99".split(
    " "
  )
);
// "" = parece certo; senão, o motivo (para mostrar "⚠️ ..."). Só pega o que com certeza está errado.
export function avisoTel(tel) {
  const d = String(tel || "")
    .replace(/\D/g, "")
    .replace(/^55(?=\d{10,11}$)/, "");
  if (!d) return "";
  if (d.length < 10 || d.length > 11) return "número incompleto";
  if (!DDDS.has(d.slice(0, 2))) return "DDD " + d.slice(0, 2) + " não existe";
  const num = d.slice(2);
  if (/^9?(\d)\1+$/.test(num) || /12345678|98765432/.test(num)) return "número parece inventado";
  if (d.length === 11 && num[0] !== "9") return "celular sem o 9 na frente";
  if (d.length === 10 && /[6-9]/.test(num[0])) return "celular sem o 9 (falta um dígito)";
  if (d.length === 10) return "telefone fixo (pode não ter WhatsApp)";
  return "";
}
// Telefone para o relatório: (21) 98888-7777, com o aviso quando parece errado
export function telRelatorio(tel) {
  const d = String(tel || "").replace(/\D/g, "");
  if (!d) return "";
  const f =
    d.length === 11
      ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
      : d.length === 10
        ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
        : d;
  const a = avisoTel(d);
  return a ? `${f} ⚠️ ${a}` : f;
}
