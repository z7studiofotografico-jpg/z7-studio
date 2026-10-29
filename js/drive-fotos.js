// Fotos do aluno direto do Google Drive (prévias em baixa, com marca d'água, geradas em "🗂️ Prévias de um colégio").
// A pasta "Z7 – Prévias PR" fica como "qualquer pessoa com o link pode ver" e o link vai em Ajustes (drivePrevias).
// Organização: Z7 – Prévias PR / "Prévias - 2022 - C.E. YONNE MARIA SIQUEIRA" / "CEYMS 02 - DOMINGOS JOSE.jpg" (folha)
//                                                                         / "CEYMS 02 - DOMINGOS JOSE/" (fotos separadas)
// O app só lê (chave do Google com a "Google Drive API" ativada); nada é gravado no Drive.
import { chaveColegio } from "./historico-dados.js";
import { chave } from "./util.js";

const API = "https://www.googleapis.com/drive/v3/files";
const PASTA = "application/vnd.google-apps.folder";

// link (ou id) da pasta do Drive → id
export function idDaPasta(link) {
  const s = String(link || "").trim();
  const m = s.match(/\/folders\/([\w-]{10,})/) || s.match(/[?&]id=([\w-]{10,})/) || s.match(/^([\w-]{20,})$/);
  return m ? m[1] : "";
}
// "Prévias - 2022 - C.E. YONNE MARIA SIQUEIRA" → { ano: 2022, chave: "YONNE MARIA SIQUEIRA" }
export function lerPastaColegio(nome) {
  const s = String(nome || "").replace(/^Pr[ée]vias\s*-\s*/i, "");
  const ano = Number((s.match(/^(20\d\d)\s*-\s*/) || [])[1]) || null;
  return { ano, chave: chaveColegio(s.replace(/^20\d\d\s*-\s*/, "")) };
}
// "CEYMS 02 - DOMINGOS JOSE" → { cod: "CEYMS 02", num: 2, nome: "DOMINGOS JOSE" }
export function lerNomeAluno(nome) {
  const s = String(nome || "")
    .replace(/\.(jpe?g|png)$/i, "")
    .replace(/\s*-\s*pagina\s*\d+$/i, "");
  const m = s.match(/^([A-Za-z]*\s*(\d+))\s*-\s*(.*)$/);
  return m ? { cod: m[1].trim(), num: Number(m[2]), nome: m[3].trim() } : { cod: "", num: null, nome: s.trim() };
}
const parecido = (a, b) => {
  const x = chave(a),
    y = chave(b);
  if (!x || !y) return 0;
  if (x === y) return 3;
  const px = x.split(" "),
    py = y.split(" ");
  // nome da pasta abreviado ("TUPIARA C. DE OLIVEIRA") ou o do app mais curto: todas as palavras de um estão no outro
  const curto = px.length <= py.length ? px : py,
    longo = curto === px ? py : px;
  const ok = curto.filter(w => w.length > 2 || /^\w$/.test(w)).every(w => longo.some(l => l === w || (w.length === 1 && l.startsWith(w))));
  return ok && curto[0] === longo[0] ? 2 : 0;
};
// a pasta (ou folha) do aluno entre as do colégio: pelo nome; empate, pelo número do ID
export function acharAluno(itens, it) {
  const num = Number(String(it.codigoOrig || it.codigo || "").match(/(\d+)\s*$/)?.[1]) || null;
  const pont = itens
    .map(f => {
      const a = lerNomeAluno(f.name);
      return { f, p: parecido(a.nome, it.nome) + (num && a.num === num ? 1 : 0) };
    })
    .filter(x => x.p >= 2)
    .sort((a, b) => b.p - a.p);
  return pont.length ? pont[0].f : null;
}

// ---------- leitura no Drive (com a chave do Google do app) ----------
export function criarDrive(chaveApi, buscar = fetch) {
  const cache = {};
  async function listar(pai) {
    if (cache[pai]) return cache[pai];
    let out = [],
      token = "";
    do {
      const q = encodeURIComponent(`'${pai}' in parents and trashed = false`);
      const r = await buscar(
        `${API}?q=${q}&fields=nextPageToken,files(id,name,mimeType)&pageSize=1000&orderBy=name&supportsAllDrives=true&includeItemsFromAllDrives=true&key=${chaveApi}${token ? "&pageToken=" + token : ""}`
      );
      if (!r.ok) {
        const t = await r.text();
        throw new Error(
          /accessNotConfigured|has not been used|disabled/i.test(t)
            ? "A leitura do Google Drive ainda não está ligada (ativar a Google Drive API no Google Cloud)."
            : /API_KEY|keyInvalid|blocked/i.test(t)
              ? "A chave do Google não pode ler o Drive (libere a Google Drive API nessa chave)."
              : r.status === 404
                ? "Não achei a pasta do Drive: confira o link em Ajustes e se ela está como “qualquer pessoa com o link”."
                : "O Google Drive respondeu " + r.status
        );
      }
      const j = await r.json();
      out = out.concat(j.files || []);
      token = j.nextPageToken || "";
    } while (token);
    return (cache[pai] = out);
  }
  async function baixar(id) {
    const r = await buscar(`${API}/${id}?alt=media&supportsAllDrives=true&key=${chaveApi}`);
    if (!r.ok) throw new Error("Não consegui baixar a foto (" + r.status + ").");
    return r.blob();
  }
  // { folhas: [arquivo], fotos: [arquivo] } do aluno, ou { erro }
  async function fotosDoAluno(raiz, it) {
    const colegios = (await listar(raiz)).filter(f => f.mimeType === PASTA);
    const k = chaveColegio(it.escola || "");
    // mesmo colégio: a chave igual, ou uma começa com a outra ("YONNE MARIA SIQUEIRA" e "YONNE MARIA SIQUEIRA ANDRADE")
    const mesmo = c => !!k && !!c && (c === k || k.startsWith(c + " ") || c.startsWith(k + " "));
    const col = colegios.find(f => {
      const c = lerPastaColegio(f.name);
      return mesmo(c.chave) && (!it.ano || !c.ano || c.ano === Number(it.ano));
    });
    if (!col) return { erro: `As prévias de ${it.escola || "este colégio"}${it.ano ? " (" + it.ano + ")" : ""} ainda não estão no Drive.` };
    const itens = await listar(col.id);
    const pasta = acharAluno(
      itens.filter(f => f.mimeType === PASTA),
      it
    );
    const folha = acharAluno(
      itens.filter(f => f.mimeType !== PASTA),
      it
    );
    const base = folha && lerNomeAluno(folha.name);
    const folhas = base
      ? itens.filter(f => f.mimeType !== PASTA && lerNomeAluno(f.name).nome === base.nome && lerNomeAluno(f.name).cod === base.cod)
      : [];
    const fotos = pasta ? (await listar(pasta.id)).filter(f => /image\//.test(f.mimeType) || /\.(jpe?g|png)$/i.test(f.name)) : [];
    if (!folhas.length && !fotos.length)
      return { erro: `Não achei as fotos de ${it.nome} nas prévias de ${col.name.replace(/^Pr[ée]vias\s*-\s*/i, "")}.` };
    return { colegio: col.name, folhas, fotos };
  }
  return { listar, baixar, fotosDoAluno };
}
