// Fotos do aluno direto do Google Drive (prévias em baixa, com marca d'água, geradas em "🗂️ Prévias de um colégio").
// A pasta "Z7 – Prévias PR" vai em Ajustes (drivePrevias). Dois jeitos de ler:
//  · fechado (recomendado): a pasta é compartilhada só com os e-mails da equipe e cada pessoa entra com a conta
//    Google dela no app (Ajustes → "ID do cliente Google"); o Drive confere quem pode ver;
//  · aberto: pasta "qualquer pessoa com o link" + chave do Google (quem tiver o link vê as fotos).
// Organização: Z7 – Prévias PR / "Prévias - 2022 - C.E. YONNE MARIA SIQUEIRA" / "CEYMS 02 - DOMINGOS JOSE.jpg" (folha)
//                                                                         / "CEYMS 02 - DOMINGOS JOSE/" (fotos separadas)
// O app lê (chave do Google com a "Google Drive API" ativada). Só o admin grava, com o "📤 Enviar foto" do aluno
// sem foto (a conta Google dele precisa ser Editor da pasta): a prévia sai igual à do gerador de prévias.
import { chaveColegio } from "./historico-dados.js";
import { chave } from "./util.js";
import { lerCodigo } from "./aluno-id.js";

const API = "https://www.googleapis.com/drive/v3/files";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
const PASTA = "application/vnd.google-apps.folder";

// link (ou id) da pasta do Drive → id
export function idDaPasta(link) {
  const s = String(link || "").trim();
  const m = s.match(/\/folders\/([\w-]{10,})/) || s.match(/[?&]id=([\w-]{10,})/) || s.match(/^([\w-]{20,})$/);
  return m ? m[1] : "";
}
// "Prévias - 2022 - C.E. YONNE MARIA SIQUEIRA" → { ano: 2022, chave: "YONNE MARIA SIQUEIRA" }
export function lerPastaColegio(nome) {
  let s = String(nome || "").replace(/^Pr[ée]vias\s*-\s*/i, "");
  let ano = Number((s.match(/^(20\d\d)\s*-\s*/) || [])[1]) || null;
  s = s
    .replace(/^20\d\d\s*-\s*/, "")
    // formaturas: "Formatura (1) - C.E JOÃO PAULO II", "01 - FORMATURA - 2022-08-04 - C.E JOAO PAULO II", "… 2023"
    .replace(/^\d{1,2}\s*-\s*/, "")
    .replace(/^formatura\s*(\(\d+\))?\s*-\s*/i, "")
    .replace(/^(20\d\d)-\d\d-\d\d\s*-\s*/, (x, a) => ((ano = ano || Number(a)), ""));
  const fim = s.match(/\s+(20\d\d)$/);
  if (fim) (ano = ano || Number(fim[1])), (s = s.slice(0, fim.index));
  return { ano, chave: chaveColegio(s) };
}
// "CEYMS 02 - DOMINGOS JOSE" → { cod: "CEYMS 02", num: 2, nome: "DOMINGOS JOSE" }
// também: "CIEP 384 - 07 - MARIA", "CIEP384 07 - MARIA", "EEMZC - 12 - JOAO", "21EEMZC-12 - JOAO"
export function lerNomeAluno(nome) {
  const s = String(nome || "")
    .replace(/\.(jpe?g|png)$/i, "")
    .replace(/\s*-\s*pagina\s*\d+$/i, "")
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .trim();
  const m = s.match(/^(?:\d{2}(?=[A-Za-z]))?([A-Za-z.]*(?:\s*\d{2,4})?)\s*[-–]?\s*(\d{1,4})\s*[-–]\s*(.*\p{L}.*)$/u);
  const r = m ? { cod: `${m[1].trim()} ${m[2]}`.trim(), num: Number(m[2]), nome: m[3].trim() } : { cod: "", num: null, nome: s.trim() };
  // "01 - CIEP 225 - LORENA", "26 -CIEP336- 01 - DAVI", "01 - CIEP 460-2022- JAMILLE", "01-CEPD2025- GRACIELLY":
  // o nome é o último pedaço e o número do aluno é o último número curto antes dele
  if (/-/.test(r.nome)) {
    const partes = s
      .replace(/-\d{1,2}$/, "")
      .split(/\s*-\s*/)
      .filter(Boolean);
    const nome = partes.pop();
    let nums = partes.filter(x => /^\d{1,3}$/.test(x));
    // "2024 - CEPD 08 - NOME": o número vem colado na sigla
    if (!nums.length) nums = partes.map(x => (x.match(/[A-Za-z.]\s*(\d{1,3})$/) || [])[1]).filter(Boolean);
    if (nome && /\p{L}/u.test(nome) && nums.length) return { cod: partes.join(" "), num: Number(nums[nums.length - 1]), nome: nome.trim() };
  }
  return r;
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

// 0 a 1: quanto dois nomes de colégio se parecem (palavras iguais; inicial "S" vale por "SOUZA"; números têm de bater)
export function parecidoColegio(a, b) {
  const norm = x =>
    chaveColegio(x)
      .replace(/([A-Z])\1+/g, "$1")
      .replace(/([BCDFGJKLMNPQRSTVWXZ])H/g, "$1")
      .split(" ")
      .filter(Boolean);
  const A = norm(a),
    B = norm(b);
  if (!A.length || !B.length) return 0;
  const numA = A.filter(w => /\d/.test(w)).join(),
    numB = B.filter(w => /\d/.test(w)).join();
  if (numA !== numB) return 0;
  const bate = (w, v) => w === v || (w.length === 1 && v.startsWith(w)) || (v.length === 1 && w.startsWith(v));
  const [cur, lon] = A.length <= B.length ? [A, B] : [B, A];
  const usados = new Set();
  let n = 0,
    inteiras = 0;
  cur.forEach(w => {
    const j = lon.findIndex((v, i) => !usados.has(i) && bate(w, v));
    if (j >= 0) usados.add(j), n++, w.length > 1 && lon[j].length > 1 && inteiras++;
  });
  return inteiras >= 2 ? n / lon.length : 0;
}
// pasta que agrupa os colégios de um ano: "Prévias 2026", "PRÉVIAS", "Previas"
export const ehPastaAno = nome => /^pr[ée]vias(\s+20\d\d)?$/i.test(String(nome || "").trim());
// nome do arquivo/pasta do aluno no Drive, no formato do gerador de prévias: "CEPNCP 01 - MARIA SILVA"
// (o "acharAluno" acha de volta pelo nome e pelo número do ID)
export function nomeArquivoAluno(it) {
  const nome =
    chave((it && it.nome) || "")
      .replace(/[\\/:*?"<>|]+/g, " ")
      .replace(/-/g, " ")
      .replace(/\s+/g, " ")
      .trim() || "ALUNO";
  const c = lerCodigo((it && (it.codigo || it.codigoOrig)) || "");
  return (c ? `${c.sigla} ${String(c.n).padStart(2, "0")} - ` : "") + nome;
}
// a pasta "Prévias - …" do colégio do aluno (mesmo ano), entre as pastas de colégio do Drive; null se não houver
export function pastaDoColegio(colegios, it) {
  // letras dobradas não contam ("YONE" e "YONNE"); uma chave pode ser o começo da outra ("… SIQUEIRA" e "… SIQUEIRA ANDRADE")
  const simples = c => String(c || "").replace(/([A-Z])\1+/g, "$1");
  const k = simples(chaveColegio(it.escola || ""));
  const mesmo = c0 => {
    const c = simples(c0);
    return !!k && !!c && (c === k || k.startsWith(c + " ") || c.startsWith(k + " "));
  };
  const col = colegios.find(f => {
    const c = lerPastaColegio(f.name);
    return mesmo(c.chave) && (!it.ano || !c.ano || c.ano === Number(it.ano));
  });
  // sem nome igual: o colégio do mesmo ano com o nome mais parecido ("NUTHA" e "NUTA", "S. C." e "SOUZA COELHO")
  return (
    col ||
    colegios
      .map(f => ({ f, c: lerPastaColegio(f.name) }))
      .filter(x => !it.ano || !x.c.ano || x.c.ano === Number(it.ano))
      .map(x => ({ f: x.f, n: parecidoColegio(it.escola || "", x.c.chave) }))
      .filter(x => x.n >= 0.75)
      .sort((a, b) => b.n - a.n)
      .reduce((acc, x, i, arr) => (i === 0 && (arr.length < 2 || arr[1].n < x.n) ? x.f : acc), null)
  );
}
// o aluno tem prévia nessa lista (itens da pasta do colégio): a pasta das fotos separadas ou a folha
export function temFoto(itens, it) {
  return !!(
    acharAluno(
      itens.filter(f => f.mimeType === PASTA),
      it
    ) ||
    acharAluno(
      itens.filter(f => f.mimeType !== PASTA),
      it
    )
  );
}
// corpo do envio de um arquivo ao Drive (metadados + conteúdo, "multipart/related")
export function corpoEnvio(meta, blob, tipo, b) {
  return new Blob([
    `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${b}\r\nContent-Type: ${tipo}\r\n\r\n`,
    blob,
    `\r\n--${b}--`
  ]);
}
// ---------- leitura no Drive ----------
// link da miniatura do Drive ("…=s220") no tamanho pedido (lado maior em pixels)
export const miniaturaGrande = (link, lado) => String(link).replace(/=s\d+(-c)?$/, "") + "=s" + Math.round(lado);
// acesso = a chave do Google (texto) ou uma função que devolve o token da conta Google da pessoa (pasta fechada)
export function criarDrive(acesso, buscar = fetch) {
  const cache = {};
  const comToken = typeof acesso === "function";
  const pedir = async (url, o = {}) =>
    comToken
      ? buscar(url, Object.assign({}, o, { headers: Object.assign({}, o.headers || {}, { Authorization: "Bearer " + (await acesso()) }) }))
      : buscar(url + (url.includes("?") ? "&" : "?") + "key=" + acesso, o);
  async function listar(pai) {
    if (cache[pai]) return cache[pai];
    let out = [],
      token = "";
    do {
      const q = encodeURIComponent(`'${pai}' in parents and trashed = false`);
      const r = await pedir(
        `${API}?q=${q}&fields=nextPageToken,files(id,name,mimeType)&pageSize=1000&orderBy=name&supportsAllDrives=true&includeItemsFromAllDrives=true${token ? "&pageToken=" + token : ""}`
      );
      if (!r.ok) {
        const t = await r.text();
        throw new Error(
          /accessNotConfigured|has not been used|disabled/i.test(t)
            ? "A leitura do Google Drive ainda não está ligada (ativar a Google Drive API no Google Cloud)."
            : /API_KEY|keyInvalid|blocked/i.test(t)
              ? "A chave do Google não pode ler o Drive (libere a Google Drive API nessa chave)."
              : r.status === 404 || r.status === 403
                ? comToken
                  ? "Sua conta Google não tem acesso à pasta das prévias. Peça ao Adriano para compartilhar a pasta com o seu e-mail."
                  : "Não achei a pasta do Drive: confira o link em Ajustes e se ela está como “qualquer pessoa com o link”."
                : "O Google Drive respondeu " + r.status
        );
      }
      const j = await r.json();
      out = out.concat(j.files || []);
      token = j.nextPageToken || "";
    } while (token);
    return (cache[pai] = out);
  }
  async function nomeDe(id) {
    const r = await pedir(`${API}/${id}?fields=name&supportsAllDrives=true`);
    return r.ok ? (await r.json()).name || "" : "";
  }
  // 11/11/2026: o Google às vezes recusa o download direto (alt=media) feito com a chave (sem conta), e a resposta
  // vem sem permissão de leitura para o navegador ("Failed to fetch"). Nesses casos baixa pela miniatura do Drive no
  // tamanho original (lh3.googleusercontent.com, que deixa o navegador ler).
  // (depois da primeira recusa, vai direto pela miniatura: cada foto pedia 3 vezes e demorava)
  let diretoRecusado = false;
  async function baixar(id) {
    let erro = null;
    if (!diretoRecusado)
      try {
        const r = await pedir(`${API}/${id}?alt=media&supportsAllDrives=true`);
        if (r.ok) return await r.blob();
        erro = new Error("Não consegui baixar a foto (" + r.status + ").");
        if (r.status === 403 || r.status === 429) diretoRecusado = true;
      } catch (e) {
        erro = e;
        diretoRecusado = !comToken; // "Failed to fetch": a recusa veio sem permissão de leitura (CORS)
      }
    try {
      const m = await pedir(`${API}/${id}?fields=thumbnailLink,imageMediaMetadata(width,height)&supportsAllDrives=true`);
      const j = m.ok ? await m.json() : {};
      if (j.thumbnailLink) {
        const md = j.imageMediaMetadata || {};
        const lado = Math.max(Number(md.width) || 0, Number(md.height) || 0) || 2400;
        const r2 = await buscar(miniaturaGrande(j.thumbnailLink, lado));
        if (r2.ok) return await r2.blob();
      }
    } catch (e) {
      console.warn("[Z7] foto pela miniatura", e);
    }
    throw erro && /baixar a foto/.test(erro.message) ? erro : new Error("Não consegui baixar a foto.");
  }
  // pastas "Prévias - …" de cada colégio: direto na raiz ou dentro das pastas por ano ("Prévias 2026", "PREVIAS")
  async function pastasColegios(raiz) {
    const itens = (await listar(raiz)).filter(f => f.mimeType === PASTA);
    const anos = itens.filter(f => ehPastaAno(f.name));
    const dentro = (await Promise.all(anos.map(a => listar(a.id)))).flat().filter(f => f.mimeType === PASTA);
    return itens.concat(dentro).filter(f => /^Pr[ée]vias\s*-/i.test(f.name));
  }
  // folha (e as páginas dela) e fotos de uma pasta de colégio, a partir da folha e da pasta escolhidas
  async function montarFotos(itens, folha, pasta) {
    const base = folha && lerNomeAluno(folha.name);
    const folhas = base
      ? itens.filter(f => f.mimeType !== PASTA && lerNomeAluno(f.name).nome === base.nome && lerNomeAluno(f.name).cod === base.cod)
      : [];
    const fotos = pasta ? (await listar(pasta.id)).filter(f => /image\//.test(f.mimeType) || /\.(jpe?g|png)$/i.test(f.name)) : [];
    return { folhas, fotos };
  }
  // os alunos com prévia numa pasta de colégio: [{ nome, cod, folhaId, pastaId }] (para "Trocar as fotos")
  async function alunosDaPasta(colegioId) {
    const itens = await listar(colegioId);
    const m = new Map();
    itens.forEach(f => {
      const a = lerNomeAluno(f.name);
      const k = a.cod + "|" + chave(a.nome);
      const x = m.get(k) || { nome: a.nome, cod: a.cod, folhaId: "", pastaId: "" };
      if (f.mimeType === PASTA) x.pastaId = x.pastaId || f.id;
      else x.folhaId = x.folhaId || f.id;
      m.set(k, x);
    });
    return [...m.values()].sort((a, b) => (a.cod + a.nome).localeCompare(b.cod + b.nome, "pt-BR", { numeric: true }));
  }
  // { folhas: [arquivo], fotos: [arquivo] } do aluno, ou { erro }
  // it.fotosDrive = { colegioId, colegio, folhaId, pastaId }: fotos escolhidas à mão ("Trocar as fotos"); vale antes da busca
  async function fotosDoAluno(raiz, it) {
    const fx = it && it.fotosDrive;
    if (fx && fx.colegioId && (fx.folhaId || fx.pastaId)) {
      const itens = await listar(fx.colegioId);
      const r = await montarFotos(
        itens,
        itens.find(f => f.id === fx.folhaId),
        itens.find(f => f.id === fx.pastaId)
      );
      if (r.folhas.length || r.fotos.length)
        return Object.assign({ colegio: fx.colegio || "", colegioId: fx.colegioId, escolhida: true }, r);
    }
    // a pasta do link pode ser a geral ("Z7 – Prévias PR", com uma pasta por colégio) ou já a de um colégio
    let colegios = await pastasColegios(raiz);
    if (!colegios.length) colegios = [{ id: raiz, name: await nomeDe(raiz) }];
    const col2 = pastaDoColegio(colegios, it);
    if (!col2)
      return { erro: `As prévias de ${it.escola || "este colégio"}${it.ano ? " (" + it.ano + ")" : ""} ainda não estão no Drive.` };
    const itens = await listar(col2.id);
    const pasta = acharAluno(
      itens.filter(f => f.mimeType === PASTA),
      it
    );
    const folha = acharAluno(
      itens.filter(f => f.mimeType !== PASTA),
      it
    );
    const { folhas, fotos } = await montarFotos(itens, folha, pasta);
    if (!folhas.length && !fotos.length)
      return {
        erro: `Não achei as fotos de ${it.nome} nas prévias de ${col2.name.replace(/^Pr[ée]vias\s*-\s*/i, "")}.`,
        colegioId: col2.id,
        colegio: col2.name
      };
    return { colegio: col2.name, colegioId: col2.id, folhas, fotos };
  }
  // ---------- gravação (só admin, com a conta Google que pode editar a pasta) ----------
  async function respostaGravacao(r) {
    if (r.ok) return r.json();
    const t = await r.text().catch(() => "");
    throw new Error(
      r.status === 401
        ? "A entrada no Google venceu. Tente de novo."
        : /insufficient|scope/i.test(t)
          ? "O app ainda não tem permissão para gravar no Drive. Entre de novo e marque a opção de ver, editar e criar arquivos do Google Drive."
          : r.status === 403 || r.status === 404
            ? "Sua conta Google não pode gravar na pasta das prévias. Ela precisa ser Editor da pasta no Drive."
            : "O Google Drive respondeu " + r.status + " ao gravar."
    );
  }
  async function criarPasta(pai, nome) {
    if (!comToken) throw new Error("Para gravar no Drive, ligue a conta Google em Ajustes (ID do cliente Google).");
    const f = await respostaGravacao(
      await pedir(`${API}?supportsAllDrives=true&fields=id,name,mimeType`, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=UTF-8" },
        body: JSON.stringify({ name: nome, mimeType: PASTA, parents: [pai] })
      })
    );
    if (cache[pai]) cache[pai] = cache[pai].concat([f]);
    return f;
  }
  async function enviar(pai, nome, blob, tipo = "image/jpeg") {
    if (!comToken) throw new Error("Para gravar no Drive, ligue a conta Google em Ajustes (ID do cliente Google).");
    const b = "z7" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    const f = await respostaGravacao(
      await pedir(`${UPLOAD}?uploadType=multipart&supportsAllDrives=true&fields=id,name,mimeType`, {
        method: "POST",
        headers: { "Content-Type": "multipart/related; boundary=" + b },
        body: corpoEnvio({ name: nome, parents: [pai] }, blob, tipo, b)
      })
    );
    if (cache[pai]) cache[pai] = cache[pai].concat([f]);
    return f;
  }
  // vai para a lixeira do Drive (dá para recuperar por 30 dias)
  async function lixeira(id) {
    await respostaGravacao(
      await pedir(`${API}/${id}?supportsAllDrives=true&fields=id`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json; charset=UTF-8" },
        body: JSON.stringify({ trashed: true })
      })
    );
  }
  const esquecer = id => (id ? delete cache[id] : Object.keys(cache).forEach(k => delete cache[k]));
  return { listar, baixar, fotosDoAluno, alunosDaPasta, pastasColegios, nomeDe, criarPasta, enviar, lixeira, esquecer };
}
