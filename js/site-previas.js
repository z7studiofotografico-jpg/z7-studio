// Prévias direto no site (17/11/2026): o app grava a prévia do aluno em z7studio.com.br (site/publico/previas-api) e
// o "Fotos do aluno" procura primeiro no site; as antigas, que estão no Google Drive, continuam aparecendo.
// Cada aluno que abre uma prévia conta como visita no site.
import * as U from "./util.js";

export const API_SITE = "https://z7studio.com.br/previas-api";
// a chave do aluno no site: o ID (26CIEP433-71) ou o nome (igual ao z7_chave do PHP)
export const chaveSite = (s, max = 60) =>
  U.chave(s)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max) || "SEM-NOME";
export const chaveAlunoSite = it => (it.codigo ? chaveSite(it.codigo, 30) : chaveSite(it.nome, 40));

async function chamar(C, caminho, o = {}) {
  const t = C.token ? await C.token() : "";
  const r = await fetch(API_SITE + caminho, Object.assign({}, o, { headers: { Authorization: "Bearer " + t } }));
  let j = {};
  try {
    j = await r.json();
  } catch (_) {}
  if (!r.ok) throw new Error(j.erro || "O site respondeu " + r.status + ". Tente de novo.");
  return j;
}

// grava uma foto (tipo "folha" = a folha com todas as fotos; "foto" = foto separada) e devolve o endereço
export async function enviarParaSite(C, it, blob, tipo) {
  const f = new FormData();
  f.append("ano", String(it.ano || ""));
  f.append("escola", String(it.escola || ""));
  f.append("nome", title0(it.nome));
  f.append("codigo", String(it.codigo || ""));
  f.append("chave", chaveAlunoSite(it));
  f.append("tipo", tipo);
  f.append("arquivo", blob, (tipo === "folha" ? "folha" : "foto") + ".jpg");
  return (await chamar(C, "/enviar.php", { method: "POST", body: f })).url;
}
const title0 = s => String(s || "").trim();

// as prévias do colégio no site (guardadas por alguns minutos)
const cache = new Map();
export async function listaDoSite(C, ano, escola) {
  const k = ano + "|" + chaveSite(escola);
  const c = cache.get(k);
  if (c && Date.now() - c.em < 5 * 60 * 1000) return c.j;
  const j = await chamar(C, `/lista.php?ano=${encodeURIComponent(ano || "")}&escola=${encodeURIComponent(escola || "")}`);
  cache.set(k, { em: Date.now(), j });
  return j;
}
export const esquecerSite = () => cache.clear();

// as fotos do aluno no site, no mesmo formato do Drive ({ id, name }; o id é o endereço), ou null se não tiver
export async function fotosDoAlunoNoSite(C, it) {
  if (!it || !it.escola) return null;
  let j;
  try {
    j = await listaDoSite(C, it.ano, it.escola);
  } catch (e) {
    console.warn("[Z7] prévias no site", e);
    return null;
  }
  const a = (j.alunos || {})[chaveAlunoSite(it)];
  if (!a || (!(a.folhas || []).length && !(a.fotos || []).length)) return null;
  const item = (u, i, nome) => ({ id: u, name: `${nome} ${String(i + 1).padStart(2, "0")}.jpg`, site: true });
  return {
    colegio: j.escola || it.escola,
    folhas: (a.folhas || []).map((u, i) => item(u, i, "folha")),
    fotos: (a.fotos || []).map((u, i) => item(u, i, "foto")),
    noSite: true
  };
}
// baixa uma foto do site
export async function baixarDoSite(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error("Não consegui baixar a foto do site (" + r.status + ").");
  return r.blob();
}
// apaga a prévia do aluno no site (para enviar de novo)
export async function apagarDoSite(C, it) {
  const f = new FormData();
  f.append("apagar", "1");
  f.append("ano", String(it.ano || ""));
  f.append("escola", String(it.escola || ""));
  f.append("aluno", chaveAlunoSite(it));
  await chamar(C, "/lista.php", { method: "POST", body: f });
  esquecerSite();
}
