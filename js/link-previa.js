// Link da prévia no site (11/11/2026): em vez de mandar só a imagem pelo WhatsApp, a equipe manda um link
// z7studio.com.br/previa/?c=<código>. A família abre no site do estúdio, vê as fotos (as prévias com marca d'água
// que a cópia da madrugada já pôs no site), o kit, o preço, o vídeo de amostra e um botão do WhatsApp.
// O código é aleatório (ninguém adivinha o link de outro aluno). O app guarda o código no aluno ("linkPrevia") e mostra
// quantas vezes a família abriu e se tocou no WhatsApp (a página soma +1 nos campos "vistos" e "cliques").
import { el } from "./ui.js";
import * as U from "./util.js";
import { noComputador, abrirWhatsAppWeb } from "./enviar-computador.js";

export const SITE_LINK = "https://z7studio.com.br/previa/?c=";
export const COLECAO = "previasSite";
const LETRAS = "abcdefghjkmnpqrstuvwxyz23456789"; // sem 0/o, 1/l/i (a família pode digitar)
export const MAX_FOTOS = 60;
const DIAS = 30; // o link vale 30 dias (depois a página pede para chamar no WhatsApp)

export function codigoNovo(aleatorio = n => crypto.getRandomValues(new Uint8Array(n))) {
  return [...aleatorio(10)].map(b => LETRAS[b % LETRAS.length]).join("");
}
const titulo = s =>
  String(s || "")
    .toLowerCase()
    .replace(/(^|\s)\S/g, c => c.toUpperCase())
    .replace(/\s+/g, " ")
    .trim();
// "MARIA DA SILVA SANTOS" → "Maria Santos" (o primeiro e o último nome: a página é pública para quem tem o link)
export function nomeCurto(nome) {
  const p = titulo(nome).split(" ").filter(Boolean);
  return p.length > 1 ? p[0] + " " + p[p.length - 1] : p[0] || "";
}
// infantil (educação infantil e 1º ao 5º ano) ou adulto: só escolhe qual vídeo de amostra a página abre primeiro
export function idadeDe(it) {
  const t = [it.turma, it.serie, it.escola].filter(Boolean).join(" ");
  if (/\bem\b|m[ée]dio|t[ée]cnico|faculdade|universidade|eja\b/i.test(t)) return "adulto";
  return /infantil|maternal|creche|pr[ée]-?escola|\b[1-5]\s*[ºo°]?\s*ano\b|\bpr[ée]\s*(i{1,2}|[12])\b/i.test(t) ? "infantil" : "adulto";
}
// o documento público (nada de telefone, e-mail ou valores internos)
// r = resultado de fotosDoAluno ({ folhas, fotos }); preco = o texto do preço do kit; agora = Date (testes)
export function dadosLink(it, r, preco, por, agora = new Date(), cartao = "") {
  const fotos = (r.fotos && r.fotos.length ? r.fotos : r.folhas || []).slice(0, MAX_FOTOS).map(f => String(f.id));
  return {
    nome: nomeCurto(it.nome).slice(0, 80),
    escola: titulo(it.escola).slice(0, 120),
    kit: it.vendaComo === "paspatur" ? "paspatur" : "pr",
    idade: idadeDe(it),
    fotos,
    preco: /\[/.test(preco || "") ? "" : String(preco || "").slice(0, 40),
    cartao: /\[/.test(preco || "") ? "" : String(cartao || "").slice(0, 90),
    por: U.first(por || "").slice(0, 40),
    criadoEm: agora.toISOString(),
    ate: new Date(agora.getTime() + DIAS * 864e5).toISOString()
  };
}
export const mensagemLink = (it, codigo) =>
  `Olá! As fotos de ${U.first(titulo(it.nome))} estão prontas 📸\n` +
  `Veja aqui, com o kit e o valor: ${SITE_LINK}${codigo}\n` +
  "Qualquer dúvida, é só me chamar 😊";

// Cria (ou atualiza) o link e abre o WhatsApp com a mensagem. o = { tel, precoTxt, salvar(patch, msg) }
export async function mandarLinkPrevia(C, it, r, o = {}) {
  const FS = C.FS;
  const d = dadosLink(it, r, o.precoTxt, C.me, new Date(), o.cartaoTxt);
  if (!d.fotos.length) return U.toast("Este aluno ainda não tem fotos no Drive.");
  let codigo = it.linkPrevia;
  if (codigo) {
    // já tem link: atualiza as fotos e o preço, e renova o prazo de 30 dias (os números de visitas continuam)
    const { nome, escola, kit, fotos, preco, cartao, ate } = d;
    await FS.updateDoc(FS.doc(C.db, COLECAO, codigo), { nome, escola, kit, fotos, preco, cartao, ate });
  } else {
    codigo = codigoNovo();
    await FS.setDoc(FS.doc(C.db, COLECAO, codigo), Object.assign(d, { vistos: 0, cliques: 0, vistoEm: null, cliqueEm: null }));
    if (o.salvar) await o.salvar({ linkPrevia: codigo }, "Link da prévia criado");
  }
  const texto = mensagemLink(it, codigo);
  const tel = U.digits(o.tel || ""); // já com o 55
  try {
    await navigator.clipboard.writeText(texto);
  } catch (_) {
    // sem área de transferência: a mensagem já vai escrita no WhatsApp
  }
  if (noComputador()) abrirWhatsAppWeb(tel, texto);
  else window.open(`https://wa.me/${tel}?text=${encodeURIComponent(texto)}`, "_blank", "noopener");
  U.toast("Link da prévia na mensagem do WhatsApp (e copiado) ✅");
  return codigo;
}

// "👀 Abriu 3 vezes · último 11/11 14:20 · tocou no WhatsApp 1 vez" (ou "ainda não abriu")
export function textoVisitas(d) {
  if (!d) return "";
  const v = Number(d.vistos) || 0,
    c = Number(d.cliques) || 0;
  const quando = x => {
    const t = x && (typeof x.toDate === "function" ? x.toDate() : new Date(x));
    return t && !isNaN(t)
      ? ` · último ${String(t.getDate()).padStart(2, "0")}/${String(t.getMonth() + 1).padStart(2, "0")} ${U.hhmm(t)}`
      : "";
  };
  const venceu = d.ate && new Date(d.ate) < new Date() ? "⏰ O link venceu: toque em “Mandar o link da prévia de novo”. " : "";
  if (!v) return venceu + "👀 A família ainda não abriu o link.";
  return (
    venceu +
    `👀 Abriu ${v} ${v === 1 ? "vez" : "vezes"}${quando(d.vistoEm)}` +
    (c ? ` · tocou no WhatsApp ${c} ${c === 1 ? "vez" : "vezes"}` : " · ainda não tocou no WhatsApp")
  );
}
// a linha das visitas na janela do aluno (lê o documento uma vez)
export function linhaVisitas(C, it) {
  const p = el("p", "hint");
  if (!it.linkPrevia) return p;
  C.FS.getDoc(C.FS.doc(C.db, COLECAO, it.linkPrevia))
    .then(s => (p.textContent = s.exists() ? textoVisitas(s.data()) : ""))
    .catch(() => {});
  return p;
}
