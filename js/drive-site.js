// As prévias antigas (que vieram do Google Drive) pela lista guardada no site (17/11/2026): a cópia da madrugada
// grava quem é quem (previas/drive/), e o app lê por site/publico/previas-api/drive.php, sem falar com o Google.
// As fotos já estão no site (previas/<id>.jpg). Assim o "Fotos do aluno" abre rápido e não depende do Drive.
import { API_SITE } from "./site-previas.js";

const pastas = new Map(),
  paiDaFoto = new Map(),
  nomes = new Map();

async function pedir(C, caminho, o = {}) {
  const t = C.token ? await C.token() : "";
  return fetch(API_SITE + caminho, Object.assign({}, o, { headers: { Authorization: "Bearer " + t } }));
}
// os itens de uma pasta ({ id, name, mimeType }), ou null se ela ainda não estiver no site
export async function listarNoSite(C, id) {
  if (pastas.has(id)) return pastas.get(id);
  const r = await pedir(C, "/drive.php?id=" + encodeURIComponent(id));
  if (!r.ok) return null;
  const j = await r.json();
  // vem o pedaço inteiro (o colégio com as pastas dos alunos): guarda tudo, as próximas não perguntam de novo
  Object.entries(j.pastas || {}).forEach(([p, itens]) => {
    pastas.set(p, itens);
    itens.forEach(x => paiDaFoto.set(x.id, p));
  });
  Object.entries(j.nomes || {}).forEach(([k, v]) => nomes.set(k, v));
  return pastas.get(id) || null;
}
export const nomeNoSite = id => nomes.get(id) || "";
export const fonteSite = C => ({ listar: id => listarNoSite(C, id), nome: nomeNoSite });
// a foto sai da lista do site (o aluno não vê mais); devolve false se ela não é de uma pasta guardada no site
export async function tirarDoSite(C, fotoId) {
  const pasta = paiDaFoto.get(fotoId);
  if (!pasta) return false;
  const f = new FormData();
  f.append("tirar", fotoId);
  f.append("pasta", pasta);
  const r = await pedir(C, "/drive.php", { method: "POST", body: f });
  if (!r.ok) throw new Error("Não consegui tirar a foto agora (" + r.status + ").");
  pastas.set(
    pasta,
    (pastas.get(pasta) || []).filter(x => x.id !== fotoId)
  );
  return true;
}
export function esquecerDriveSite() {
  pastas.clear();
  paiDaFoto.clear();
  nomes.clear();
}
