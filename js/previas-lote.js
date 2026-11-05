// Prévias em lote (só admin, no computador): lê a pasta de um colégio no servidor (uma subpasta por aluno),
// e grava numa pasta escolhida uma prévia por aluno: todas as fotos reduzidas, com marca d'água e o nome do aluno.
// Nada sobe para a internet: depois é só arrastar a pasta de prévias para o Google Drive e compartilhar como Leitor.
// Precisa do Chrome ou Edge no computador (acesso a pastas). As fotos originais nunca são alteradas.
import { el, sheet } from "./ui.js";
import * as U from "./util.js";
import { prep, marca } from "./mockup.js";
import { reduzir, desenharFolha } from "./previa.js";
import { acharAluno } from "./drive-fotos.js";
import { chaveColegio } from "./historico-dados.js";
import { gruposEscolas } from "./escolas-pr.js";
import { nomeDaFoto } from "./foto-nome.js";

// Quem já comprou (venda no app ou "VENDIDO" na planilha) não precisa de prévia: só conta no Dashboard
export const COMPROU = ["PAGO", "ENTREGUE"];
// pastas de alunos que ficam de fora: as dos alunos do app que já compraram (pelo nome e pelo número do ID)
export function pastasDeQuemComprou(pastas, alunosApp, pularSemTel = false) {
  const fora = new Set();
  const itens = pastas.map(p => ({ name: p.nome, pasta: p }));
  alunosApp
    .filter(it => COMPROU.includes(it.etapa) || (pularSemTel && it.etapa === "SEM TELEFONE"))
    .forEach(it => {
      const f = acharAluno(
        itens.filter(x => !fora.has(x.pasta)),
        it
      );
      if (f) fora.add(f.pasta);
    });
  return fora;
}
// alunos do app daquele colégio e ano (lista de escolas da importação: todos os jeitos de escrever o nome)
async function alunosDoColegio(C, colNome, col) {
  const { FS, db } = C;
  const metaNome = { repasse: "repasse_meta", paspatur: "paspatur_meta", formaturaAlunos: "formatura_meta" }[colNome];
  const meta = (await FS.getDoc(FS.doc(db, "config", metaNome))).data() || {};
  const k = chaveColegio(col.nome);
  const simples = c => String(c || "").replace(/([A-Z])\1+/g, "$1");
  const mesmo = c => simples(c) === simples(k) || simples(k).startsWith(simples(c) + " ") || simples(c).startsWith(simples(k) + " ");
  const gs = gruposEscolas(meta).filter(g => mesmo(g.chave) && (!col.ano || g.ano === Number(col.ano)));
  const out = [];
  for (const g of gs)
    for (let i = 0; i < g.nomes.length; i += 30) {
      const s = await FS.getDocs(
        FS.query(FS.collection(db, colNome), FS.where("escola", "in", g.nomes.slice(i, i + 30)), FS.where("ano", "==", g.ano))
      );
      s.forEach(d => out.push(Object.assign({ id: d.id }, d.data())));
    }
  return out;
}

const FOTO = /\.(jpe?g|png|webp)$/i,
  POR_PAGINA = 30,
  MAX_FOTOS = 100;
const limpo = n =>
  String(n || "")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120)
    .replace(/[.\s]+$/, "") || "aluno"; // (o Windows não aceita nome terminando em ponto ou espaço)

// "2022-03-30 - C.E. YONNE MARIA SIQUEIRA - entregue" → { nome: "C.E. YONNE MARIA SIQUEIRA", ano: "2022" }
export function nomeDoColegio(pasta) {
  const s = String(pasta || "");
  const ano = (s.match(/^(20\d\d)-\d\d-\d\d/) || [])[1] || "";
  const nome = s
    .replace(/^20\d\d-\d\d-\d\d\s*-?\s*/, "")
    .replace(/\s*-\s*(entregue|pronto|pronta|ok)\s*$/i, "")
    .trim();
  return { nome: nome || s, ano };
}
// pasta de prévias que o próprio app gerou ("Prévias - 2022 - …"): não é aluno, não entra de novo
export const ehPastaDePrevias = nome => /^pr[ée]vias\s*-/i.test(String(nome || "").trim());
// Todas as pastas que têm fotos (cada uma é um aluno): [{ nome, caminho, arquivos: [FileHandle] }]
export async function pastasComFotos(dir, caminho = []) {
  const out = [],
    fotos = [];
  for await (const h of dir.values()) {
    if (h.kind === "file" && FOTO.test(h.name)) fotos.push(h);
    else if (h.kind === "directory" && !ehPastaDePrevias(h.name)) out.push(...(await pastasComFotos(h, [...caminho, h.name])));
  }
  if (fotos.length)
    out.unshift({
      nome: caminho[caminho.length - 1] || dir.name,
      caminho,
      arquivos: fotos.sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { numeric: true }))
    });
  return out;
}
// nome do arquivo de saída: o da pasta do aluno (com a pasta de cima, se dois alunos tiverem o mesmo nome)
// exato = true (importação livre): o nome fica como está (só sai o que o Windows não aceita em nome de arquivo)
export function nomesDeSaida(alunos, exato = false) {
  const vistos = {};
  const lp = exato ? n => String(n || "").replace(/[\\/:*?"<>|]+/g, "_") || "pasta" : limpo;
  return alunos.map(a => {
    let n = lp(a.nome);
    if (vistos[n]) n = lp(a.caminho.slice(-2).join(" - "));
    while (vistos[n]) n += " (2)";
    vistos[n] = 1;
    return n;
  });
}
const jpg = cv => new Promise(res => cv.toBlob(res, "image/jpeg", 0.72));
async function gravar1(pasta, nome, blob) {
  const f = await pasta.getFileHandle(nome, { create: true });
  const w = await f.createWritable();
  await w.write(blob);
  await w.close();
}
// pasta do Google Drive no computador ou na rede às vezes "some" por um instante: tenta de novo antes de desistir
const espera = ms => new Promise(r => setTimeout(r, ms));
async function gravar(pasta, nome, blob) {
  try {
    await gravar1(pasta, nome, blob);
  } catch (e) {
    await espera(800);
    await gravar1(pasta, nome, blob);
  }
}
// O motivo de uma foto não ter saído, em palavras simples, com o que fazer
export function motivoErro(e, nome = "", tamanho = null, pasta = "") {
  const n = (e && e.name) || "";
  if (/[ .]$/.test(nome) || /[ .]$/.test(pasta))
    return "o nome da pasta ou do arquivo termina com espaço ou ponto: renomeie no servidor (tire o espaço/ponto do fim)";
  if (/[<>:"|?*]/.test(nome + pasta)) return 'o nome tem caractere que o Windows não aceita (< > : " | ? *): renomeie a pasta ou o arquivo';
  if (nome + pasta !== (nome + pasta).normalize("NFC"))
    return "o nome tem acento gravado em outro formato (pasta criada no Mac/celular): renomeie a pasta digitando o nome de novo";
  if (n === "NotFoundError")
    return "o navegador não conseguiu abrir (a foto abre no computador?). Se abre, o mais comum é o caminho da pasta ser comprido demais para o Windows (limite de 260 letras, contando todas as pastas de cima): toque em “📂 Escolher a pasta deste aluno” ou encurte o nome da pasta";
  if (n === "NotReadableError")
    return "o servidor não deixou ler (arquivo aberto em outro programa ou sem permissão): feche o arquivo e tente de novo";
  if (n === "NotAllowedError" || n === "SecurityError") return "sem permissão para ler a pasta: escolha a pasta do colégio de novo";
  if (n === "QuotaExceededError") return "sem espaço no disco onde as prévias são salvas";
  if (tamanho === 0) return "arquivo vazio (0 KB): copie a foto de novo para o servidor";
  if (tamanho > 60 * 1024 * 1024) return `arquivo grande demais (${Math.round(tamanho / 1048576)} MB): salve uma versão menor`;
  if (tamanho != null)
    return "a imagem não abre no navegador (arquivo com defeito ou formato diferente, ex.: CMYK, HEIC ou RAW com nome .jpg): abra e salve de novo como JPG";
  return "não consegui ler: " + ((e && (e.message || e.name)) || "erro desconhecido");
}
// lê e reduz uma foto; se falhar, devolve { erro } com o motivo (tenta 2 vezes)
async function lerFoto(h, pastaNome, comNome = false) {
  let file = null,
    ultimo = null;
  for (let t = 0; t < 2; t++) {
    try {
      file = await h.getFile();
      // folha da turma: o nome do aluno guardado dentro da foto (Título/Assunto), quando o arquivo tem só um código
      return { img: await reduzir(file), nome: comNome ? await nomeDaFoto(file) : "" };
    } catch (e) {
      ultimo = e;
      if (t === 0) await espera(600);
    }
  }
  return { erro: motivoErro(ultimo, h.name, file ? file.size : null, pastaNome) };
}

// Escolher a pasta pela janela comum do navegador (outro caminho de leitura): serve quando o jeito normal dá
// "arquivo não encontrado" mesmo com a foto abrindo no computador. Monta a mesma estrutura de pastas.
export function pastaDeArquivos(files, nome = "") {
  const raiz = { kind: "directory", name: nome, filhos: new Map(), arqs: [] };
  for (const f of files) {
    const partes = String(f.webkitRelativePath || f.name).split("/");
    let d = raiz;
    if (!raiz.name && partes.length > 1) raiz.name = partes[0];
    for (const pt of partes.slice(1, -1)) {
      if (!d.filhos.has(pt)) d.filhos.set(pt, { kind: "directory", name: pt, filhos: new Map(), arqs: [] });
      d = d.filhos.get(pt);
    }
    d.arqs.push({ kind: "file", name: f.name, getFile: async () => f });
  }
  const pronto = d =>
    Object.assign(d, {
      async *values() {
        yield* d.arqs;
        for (const x of d.filhos.values()) yield pronto(x);
      }
    });
  return pronto(raiz);
}
// fotos soltas direto na pasta escolhida (sem uma pasta por aluno) viram uma prévia por foto, com o nome do arquivo
// "01 - Maria Eduarda Souza Lima.jpg" → "Maria Lima" (nome e sobrenome, como está escrito no arquivo)
// O nome do aluno é sempre a última parte do nome do arquivo, depois do último "-":
// "26-(E.PART)LEGACY NIL-01- BERNARDO GOMES (2).jpg" → "BERNARDO GOMES" (sem o "(2)" do fim)
export function nomeSobrenome(arquivo) {
  let s = String(arquivo || "")
    .replace(/\.(jpe?g|png|webp)$/i, "")
    .replace(/[_]+/g, " ")
    .replace(/\s*\(\d+\)\s*$/, "") // "(2)" do fim
    .replace(/[\s-]*\d+\s*$/, "") // numeral solto no fim
    .trim();
  const i = s.lastIndexOf("-");
  if (i >= 0 && /[a-zà-ú]{2}/i.test(s.slice(i + 1))) s = s.slice(i + 1);
  s = s.replace(/^[\s\d.()-]+/, "").trim();
  const ps = s.split(/\s+/).filter(Boolean);
  return ps.length <= 2 ? ps.join(" ") : ps[0] + " " + ps[ps.length - 1];
}
// Importação (Agendamento): as fotos soltas na pasta escolhida viram a FOLHA da turma (20 por página, com o nome de
// cada aluno embaixo); com "fotos individuais" marcado, sai também uma prévia para cada foto
export function montarImportacao(alunos, { individuais = false, titulo = "" } = {}) {
  return alunos.flatMap(a => {
    if (a.caminho.length) return [a]; // pasta por aluno: como antes
    const folha = { nome: titulo || a.nome, caminho: [], arquivos: a.arquivos, folha: true, max: 300 };
    return individuais ? [folha, ...umaPorFoto([a])] : [folha];
  });
}
export const SITE = "www.z7studio.com.br";
export function umaPorFoto(alunos) {
  return alunos.flatMap(a =>
    a.arquivos.length > 1 && !a.caminho.length
      ? a.arquivos.map(h => ({
          nome: h.name.replace(/\.(jpe?g|png|webp)$/i, ""),
          caminho: [...a.caminho, h.name],
          arquivos: [h],
          soltA: true
        }))
      : [a]
  );
}
export function escolherPastaComum() {
  return new Promise((res, rej) => {
    const i = document.createElement("input");
    i.type = "file";
    i.webkitdirectory = true;
    i.multiple = true;
    i.onchange = () =>
      i.files.length ? res(pastaDeArquivos([...i.files])) : rej(Object.assign(new Error("nenhuma"), { name: "AbortError" }));
    i.addEventListener("cancel", () => rej(Object.assign(new Error("nenhuma"), { name: "AbortError" })));
    i.click();
  });
}
// o = { col: "repasse" | "paspatur" | "formaturaAlunos" } (a lista onde procurar quem já comprou)
//     livre: true (Agendamento → Importação): qualquer pasta; nomes dos alunos e das fotos ficam exatamente como estão
export function abrirPreviasLote(C, o = {}) {
  const colNome = o.col || "repasse",
    livre = !!o.livre;
  sheet(livre ? "📥 Importação · prévias de uma pasta" : "🖼️ Gerar prévias de um colégio", (p, close) => {
    p.append(
      el(
        "p",
        "hint",
        livre
          ? "Só a conversão, no seu computador: coloque o colégio e a turma, escolha a pasta com as fotos (uma foto por aluno, com o nome do aluno no arquivo) e onde salvar. Sai a folha da turma, 20 alunos por página, com o nome e sobrenome embaixo de cada foto, marca d'água e o site no rodapé, pronta para mandar pelo WhatsApp. Os nomes ficam como estão nos arquivos. Nada vai para a internet."
          : "No computador: escolha a pasta do colégio no servidor (com uma pasta por aluno) e depois a pasta onde salvar. Para cada aluno sai uma imagem leve (~200 KB) com todas as fotos dele, a marca d'água e o nome. Depois, arraste a pasta de prévias para o Google Drive e compartilhe com o representante como Leitor."
      )
    );
    if (!window.showDirectoryPicker) {
      p.append(el("p", "wait", "Abra o app no Chrome ou no Edge do computador para usar esta função."));
      return;
    }
    const separadas = el("input");
    separadas.type = "checkbox";
    separadas.checked = true;
    const lSep = el("label", "chk");
    lSep.append(
      separadas,
      document.createTextNode(" Também salvar as fotos separadas, numeradas (para montar o quadro e os porta-retratos)")
    );
    p.append(lSep);
    // só quem vai ser trabalhado: quem já comprou fica de fora (o sistema fica mais leve)
    const soTrabalho = el("input");
    soTrabalho.type = "checkbox";
    soTrabalho.checked = !livre;
    const lTrab = el("label", "chk");
    lTrab.append(soTrabalho, document.createTextNode(" Pular quem já comprou (fica só no Dashboard)"));
    const semTel = el("input");
    semTel.type = "checkbox";
    const lSem = el("label", "chk");
    lSem.append(semTel, document.createTextNode(" Pular também quem está sem telefone"));
    if (!livre) p.append(lTrab, lSem);
    else separadas.parentNode.lastChild.textContent = " Também salvar as fotos separadas (com o mesmo nome do arquivo original)";
    // Importação: colégio e turma (vão no cabeçalho da folha) e, se quiser, as fotos individuais também
    const iCol = el("input"),
      iTurma = el("input");
    iCol.placeholder = "ex.: Legacy School Nova Iguaçu";
    iTurma.placeholder = "ex.: 5º ano A";
    const rCT = el("div", "row2");
    const fCol = el("div", "field"),
      fTur = el("div", "field");
    iCol.id = "impColegio";
    iTurma.id = "impTurma";
    const lC = el("label", null, "Colégio (cabeçalho)"),
      lT = el("label", null, "Turma (cabeçalho)");
    lC.htmlFor = iCol.id;
    lT.htmlFor = iTurma.id;
    fCol.append(lC, iCol);
    fTur.append(lT, iTurma);
    rCT.append(fCol, fTur);
    // quantidade de alunos: só aparece no cabeçalho se for preenchida (o app não conta sozinho)
    const iQtd = el("input");
    iQtd.id = "impQtd";
    iQtd.inputMode = "numeric";
    iQtd.placeholder = "em branco = não aparece";
    const fQtd = el("div", "field");
    const lQ = el("label", null, "Quantidade de alunos (opcional)");
    lQ.htmlFor = iQtd.id;
    fQtd.append(lQ, iQtd);
    if (livre) p.append(rCT, fQtd);
    // "Legacy - 5° ano - 87 alunos": o nome da pasta, do arquivo e o cabeçalho (a quantidade só se preencher)
    const tituloImp = () =>
      [iCol.value.trim(), iTurma.value.trim(), iQtd.value.trim() ? iQtd.value.trim().replace(/\s*alunos?$/i, "") + " alunos" : ""]
        .filter(Boolean)
        .join(" - ");
    const porFoto = el("input");
    porFoto.type = "checkbox";
    porFoto.checked = false;
    const lPor = el("label", "chk");
    lPor.append(porFoto, document.createTextNode(" Também fazer as fotos individuais (uma prévia para cada aluno, só quando precisar)"));
    if (livre) p.append(lPor);
    const info = el("p", null, "");
    const barra = el("progress");
    barra.max = 1;
    barra.value = 0;
    barra.hidden = true;
    barra.style.width = "100%";
    const ir = el("button", "btn btn-primary", "Escolher a pasta do colégio");
    ir.type = "button";
    const parar = el("button", "btn", "Parar");
    parar.type = "button";
    parar.hidden = true;
    const fechar = el("button", "btn", "Fechar");
    fechar.type = "button";
    fechar.onclick = close;
    // outro jeito de abrir a pasta (janela comum do navegador): quando o normal diz "arquivo não encontrado"
    const irComum = el("button", "btn", "Abrir a pasta pela janela comum");
    irComum.type = "button";
    irComum.title = "Use se aparecer erro de arquivo não encontrado com as fotos abrindo no computador";
    const acoes = el("div", "panel-actions");
    acoes.append(fechar, parar, irComum, ir);
    const errosBox = el("div", "notes");
    errosBox.hidden = true;
    p.append(info, barra, errosBox, acoes);
    // Só os que deram erro: a lista (para conferir no servidor) e gerar de novo apenas esses alunos
    function mostrarErros(lista, fazer, destinoNome, resumoFotos) {
      errosBox.textContent = "";
      errosBox.hidden = !lista.length;
      if (!lista.length) return;
      errosBox.append(el("b", null, `⚠️ ${lista.length} aluno${lista.length > 1 ? "s" : ""} com foto que não saiu:`));
      lista.forEach(([a]) => {
        const d = el("div", "prev-erro");
        const total = Math.min(a.arquivos.length, a.max || MAX_FOTOS);
        d.append(
          el(
            "div",
            null,
            `• ${(a.caminho.length ? a.caminho : [a.nome]).join(" / ")} — ${a.geradas || 0} de ${total} foto${total > 1 ? "s" : ""} gerada${
              total > 1 ? "s" : ""
            }`
          )
        );
        // os motivos iguais aparecem uma vez só, com quantas fotos
        const porMotivo = {};
        (a.erros || []).forEach(x => (porMotivo[x.motivo] = (porMotivo[x.motivo] || []).concat(x.arquivo ? [x.arquivo] : [])));
        Object.entries(porMotivo).forEach(([m, arqs]) =>
          d.append(
            el(
              "small",
              "hint",
              `   ↳ ${arqs.length ? arqs.length + " foto" + (arqs.length > 1 ? "s" : "") + " (" + arqs.slice(0, 4).join(", ") + (arqs.length > 4 ? "…" : "") + "): " : ""}${m}`
            )
          )
        );
        // a pasta do aluno escolhida direto (caminho curto e acesso novo): resolve quando o lote não consegue abrir
        const esc = U.mkBtn("📂 Escolher a pasta deste aluno", "btn-sm", async () => {
          try {
            // janela comum do navegador: outro caminho de leitura (resolve o "não encontrado" na maioria das vezes)
            const dir = await escolherPastaComum();
            const achadas = (await pastasComFotos(dir)).flatMap(x => x.arquivos);
            if (!achadas.length) return U.toast("Não achei fotos nessa pasta.");
            a.arquivos = achadas.sort((x, y) => x.name.localeCompare(y.name, "pt-BR", { numeric: true }));
            esc.disabled = true;
            info.textContent = `Gerando ${a.nome} (${a.arquivos.length} fotos)…`;
            const i0 = lista.find(([x]) => x === a)[1];
            try {
              await fazer(a, i0);
              info.textContent =
                `✅ ${a.nome}: ${a.geradas} de ${Math.min(a.arquivos.length, a.max || MAX_FOTOS)} fotos geradas. ` +
                (resumoFotos ? resumoFotos() : "");
              mostrarErros(
                lista.filter(([x]) => x !== a),
                fazer,
                destinoNome,
                resumoFotos
              );
            } catch (e) {
              if (!(a.erros || []).length) a.erros = [{ arquivo: "", motivo: motivoErro(e) }];
              info.textContent = `⚠️ ${a.nome}: ainda com erro (motivo abaixo).`;
              mostrarErros(lista, fazer, destinoNome, resumoFotos);
            }
          } catch (e) {
            if (!(e && e.name === "AbortError")) U.toast("Não consegui abrir essa pasta.");
          }
        });
        d.append(esc);
        errosBox.append(d);
      });
      errosBox.append(el("p", "hint", "As outras prévias já estão salvas. Resolva o motivo no servidor e gere de novo só esses:"));
      const de = U.mkBtn("🔁 Gerar de novo só esses", "btn-primary", async () => {
        de.disabled = true;
        const ainda = [];
        let ok = 0;
        for (const [n, [a, i]] of lista.entries()) {
          info.textContent = `Gerando de novo ${n + 1} de ${lista.length}: ${a.nome}…`;
          try {
            await fazer(a, i);
            ok++;
          } catch (e) {
            if (!(a.erros || []).length) a.erros = [{ arquivo: "", motivo: motivoErro(e) }];
            ainda.push([a, i]);
          }
        }
        info.textContent =
          `Tentei de novo ${lista.length} aluno${lista.length > 1 ? "s" : ""}: ${ok} ficou completo${ok === 1 ? "" : "s"}` +
          (ainda.length
            ? `, ${ainda.length} continua${ainda.length > 1 ? "m" : ""} com erro (motivo abaixo). `
            : `. Tudo certo agora ✅ `) +
          (resumoFotos ? resumoFotos() : "") +
          ` Prévias em “${destinoNome}”.`;
        de.disabled = false;
        mostrarErros(ainda, fazer, destinoNome, resumoFotos);
      });
      const cp = U.mkBtn("📋 Copiar a lista", "", () =>
        navigator.clipboard
          .writeText(
            lista
              .map(
                ([a]) =>
                  (a.caminho.length ? a.caminho : [a.nome]).join(" / ") +
                  "\n" +
                  (a.erros || []).map(x => `  - ${x.arquivo}: ${x.motivo}`).join("\n")
              )
              .join("\n")
          )
          .then(() => U.toast("Lista copiada"))
          .catch(() => U.toast("Não consegui copiar"))
      );
      errosBox.append(de, cp);
    }
    let cancelar = false;
    parar.onclick = () => (cancelar = true);
    irComum.onclick = () => ir.onclick(null, true);
    ir.onclick = async (_ev, comum) => {
      let origem, destino;
      try {
        origem = comum ? await escolherPastaComum() : await window.showDirectoryPicker({ id: "z7-fotos", mode: "read" });
        info.textContent = "Procurando as fotos…";
        let alunos = await pastasComFotos(origem);
        if (!alunos.length) return (info.textContent = "Não achei fotos nessa pasta (nem nas pastas de dentro).");
        const titulo = tituloImp();
        if (livre) alunos = montarImportacao(alunos, { individuais: porFoto.checked, titulo });
        const col = nomeDoColegio(origem.name);
        let resumoFora = "";
        if (!livre && (soTrabalho.checked || semTel.checked)) {
          info.textContent = "Conferindo no app quem já comprou…";
          try {
            const doApp = await alunosDoColegio(C, colNome, col);
            const fora = soTrabalho.checked
              ? pastasDeQuemComprou(alunos, doApp, semTel.checked)
              : pastasDeQuemComprou(
                  alunos,
                  doApp.filter(x => x.etapa === "SEM TELEFONE"),
                  true
                );
            const total = alunos.length;
            alunos = alunos.filter(a => !fora.has(a));
            resumoFora = doApp.length
              ? ` ${fora.size} de ${total} ficaram de fora (já compraram${semTel.checked ? " ou sem telefone" : ""}).`
              : ` Não achei esse colégio${col.ano ? " de " + col.ano : ""} no app: vão todos os ${total}.`;
          } catch (e) {
            resumoFora = " Não consegui conferir no app quem já comprou: vão todos.";
            console.warn("[Z7] prévias: quem comprou", e);
          }
          if (!alunos.length) return (info.textContent = "Todos os alunos dessa pasta já compraram: nada a gerar." + resumoFora);
        }
        info.textContent = `${alunos.length} aluno${alunos.length > 1 ? "s" : ""} para trabalhar em “${origem.name}”.${resumoFora} Agora escolha onde salvar as prévias.`;
        destino = await window.showDirectoryPicker({ id: "z7-previas", mode: "readwrite" });
        // salvar dentro da pasta das fotos mistura as prévias com as fotos (na próxima vez elas viram "alunos")
        if (origem.resolve && (await origem.resolve(destino).catch(() => null)))
          return (info.textContent =
            "Escolha outro lugar para salvar: não pode ser a pasta das fotos nem uma pasta dentro dela (senão as prévias se misturam com as fotos dos alunos). Ex.: a Área de Trabalho ou a pasta das prévias no Drive.");
        const pasta = await destino.getDirectoryHandle(
          limpo(livre ? tituloImp() || `Prévias - ${origem.name}` : `Prévias - ${col.ano ? col.ano + " - " : ""}${col.nome}`),
          { create: true }
        );
        await prep();
        const nomes = nomesDeSaida(alunos, livre);
        cancelar = false;
        ir.disabled = true;
        parar.hidden = false;
        barra.hidden = false;
        barra.max = alunos.length;
        let feitos = 0;
        const falharam = [];
        // conta das fotos: quantas havia na pasta e quantas saíram (por aluno e no total)
        const conta = { total: 0, geradas: 0, acima: 0 };
        alunos.forEach(a => {
          conta.total += a.arquivos.length;
          conta.acima += Math.max(0, a.arquivos.length - (a.max || MAX_FOTOS));
        });
        const fazer = async (a, i) => {
          const fotos = [],
            nomesFotos = [];
          a.erros = [];
          a.geradas = 0;
          for (const h of a.arquivos.slice(0, a.max || MAX_FOTOS)) {
            const r = await lerFoto(h, a.nome, !!a.folha);
            if (r.img) {
              // folha da turma: cada foto pequena (até 300 alunos sem pesar na memória)
              let im = r.img;
              if (a.folha && Math.max(im.width, im.height) > 440) {
                const k = 440 / Math.max(im.width, im.height),
                  t = document.createElement("canvas");
                t.width = Math.round(im.width * k);
                t.height = Math.round(im.height * k);
                t.getContext("2d").drawImage(im, 0, 0, t.width, t.height);
                im = t;
              }
              fotos.push(im);
              // o nome do aluno: o que está dentro da foto (se houver) ou o do arquivo
              nomesFotos.push(r.nome || h.name);
            } else a.erros.push({ arquivo: h.name, motivo: r.erro });
          }
          if (!fotos.length) throw Object.assign(new Error("nenhuma foto abriu"), { semFoto: true });
          // no cabeçalho: o nome do aluno sem o código da pasta ("CEYMS 01 - FABIOLA" → "FABIOLA"), e o código ao lado do colégio
          const cod = (a.nome.match(/^([A-Z0-9]+\s*\d+)\s*-\s*/i) || [])[1] || "";
          const cab = [iTurma.value.trim() ? "Turma " + iTurma.value.trim() : ""].filter(Boolean);
          const st = livre
            ? a.folha
              ? {
                  // folha da turma: colégio e turma no cabeçalho, 20 por página, nome e sobrenome embaixo de cada foto
                  nome: tituloImp() || origem.name,
                  sub: "",
                  fotos,
                  legendas: nomesFotos.map(nomeSobrenome),
                  porPagina: 20,
                  cols: 4,
                  site: true,
                  marcaForte: true
                }
              : {
                  nome: a.nome,
                  sub: [iCol.value.trim() || origem.name, ...cab].join(" · "),
                  fotos,
                  rodape: SITE + " · prévia com marca d'água",
                  marcaForte: true
                } // importação: o nome da pasta/arquivo como está
            : {
                nome: a.nome.replace(/^[A-Z0-9]+\s*\d+\s*-\s*/i, "") || a.nome,
                escola: [cod, col.nome, col.ano].filter(Boolean).join(" · "),
                fotos
              };
          // foto individual (Importação): a própria foto com a marca d'água, como para o quadro (sem folha nem página)
          if (livre && a.soltA) {
            const f = fotos[0],
              c = document.createElement("canvas");
            c.width = f.width;
            c.height = f.height;
            const x = c.getContext("2d");
            x.drawImage(f, 0, 0);
            marca(x, 0, 0, c.width, c.height);
            const nomeArq = nomesFotos[0].replace(/\.(png|webp|jpe?g)$/i, "") + ".jpg";
            try {
              await gravar(pasta, nomeArq, await jpg(c));
            } catch (e) {
              a.erros.push({ arquivo: nomeArq, motivo: "não consegui salvar: " + motivoErro(e) });
              throw e;
            }
            a.geradas = 1;
            return;
          }
          const paginas = Math.ceil(fotos.length / (st.porPagina || POR_PAGINA));
          // as fotos separadas (pequenas, com marca e número): o representante monta o quadro e os porta-retratos
          // no app ("🖼️ Prévia e fotos") com as que a família escolher
          // (foto solta = uma prévia por foto: não precisa da pasta com a mesma foto separada)
          if (separadas.checked && !a.soltA && !a.folha) {
            const sub = await pasta.getDirectoryHandle(nomes[i], { create: true });
            let salvas = 0;
            for (const [k, f] of fotos.entries()) {
              const c = document.createElement("canvas");
              c.width = f.width;
              c.height = f.height;
              const x = c.getContext("2d");
              x.drawImage(f, 0, 0);
              marca(x, 0, 0, c.width, c.height);
              const nomeArq = livre
                ? nomesFotos[k].replace(/\.(png|webp|jpe?g)$/i, "") + ".jpg"
                : `${nomes[i]} - foto ${String(k + 1).padStart(2, "0")}.jpg`;
              try {
                await gravar(sub, nomeArq, await jpg(c));
                salvas++;
              } catch (e) {
                // não deixa pasta vazia para trás
                if (!salvas) await pasta.removeEntry(nomes[i]).catch(() => {});
                a.erros.push({ arquivo: nomeArq, motivo: "não consegui salvar: " + motivoErro(e) });
                throw e;
              }
            }
          }
          for (let pg = 0; pg < paginas; pg++) {
            const cv = document.createElement("canvas");
            desenharFolha(cv, st, pg);
            try {
              await gravar(pasta, nomes[i] + (paginas > 1 ? ` - pagina ${pg + 1}` : "") + ".jpg", await jpg(cv));
            } catch (e) {
              a.erros.push({ arquivo: "prévia (página " + (pg + 1) + ")", motivo: "não consegui salvar: " + motivoErro(e) });
              throw e;
            }
          }
          a.geradas = fotos.length;
          // saiu, mas com foto faltando: a prévia fica salva e o aluno entra na lista para gerar de novo completo
          if (a.erros.length) throw Object.assign(new Error("foto faltando"), { parcial: true });
        };
        const somarGeradas = () => (conta.geradas = alunos.reduce((t, a) => t + (a.geradas || 0), 0));
        // um aluno com problema (arquivo que sumiu, pasta do Drive ainda baixando) não para os outros
        for (const [i, a] of alunos.entries()) {
          if (cancelar) break;
          info.textContent = `Aluno ${i + 1} de ${alunos.length}: ${a.nome} (${a.arquivos.length} fotos)…`;
          try {
            await fazer(a, i);
            feitos++;
          } catch (e) {
            console.warn("[Z7] prévia de", a.nome, e);
            if (e && e.parcial) feitos++;
            else if (!(a.erros || []).length) a.erros = [{ arquivo: "", motivo: motivoErro(e) }];
            falharam.push([a, i]);
          }
          barra.value = i + 1;
        }
        // os que falharam: mais uma tentativa no fim
        if (falharam.length && !cancelar) {
          const de = falharam.splice(0);
          for (const [a, i] of de) {
            info.textContent = `Tentando de novo: ${a.nome}…`;
            try {
              await fazer(a, i);
            } catch (e) {
              if (!(a.erros || []).length) a.erros = [{ arquivo: "", motivo: motivoErro(e) }];
              falharam.push([a, i]);
            }
          }
        }
        somarGeradas();
        // a conta sempre fecha: na pasta = geradas + com erro + acima do limite
        const resumoFotos = () => {
          conta.total = alunos.reduce((t, a) => t + a.arquivos.length, 0);
          conta.acima = alunos.reduce((t, a) => t + Math.max(0, a.arquivos.length - (a.max || MAX_FOTOS)), 0);
          const ger = somarGeradas(),
            nao = conta.total - ger,
            comErro = nao - conta.acima;
          const partes = [
            comErro ? `${comErro} dos alunos com erro (lista abaixo)` : "",
            conta.acima ? `${conta.acima} acima do limite de ${MAX_FOTOS} por aluno` : ""
          ].filter(Boolean);
          return `Fotos na pasta: ${conta.total} · geradas: ${ger} · não geradas: ${nao}${partes.length ? " = " + partes.join(" + ") : ""}.`;
        };
        if (falharam.length) mostrarErros(falharam, fazer, pasta.name, resumoFotos);
        info.textContent =
          (cancelar ? `Parado. ` : "Pronto! ") +
          `${feitos} prévia${feitos === 1 ? "" : "s"} salva${feitos === 1 ? "" : "s"} em “${pasta.name}”.` +
          resumoFora +
          " " +
          resumoFotos() +
          (falharam.length ? ` ⚠️ ${falharam.length} aluno${falharam.length > 1 ? "s" : ""} com foto que não saiu (motivo abaixo).` : "") +
          (livre
            ? " As prévias ficam só no seu computador, nessa pasta: é só mandar pelo WhatsApp para quem vai vender."
            : " Agora arraste essa pasta para o Google Drive.");
      } catch (e) {
        if (e && e.name === "AbortError") info.textContent = "Nenhuma pasta escolhida.";
        else {
          info.textContent = "Não deu certo: " + ((e && e.message) || e);
          console.warn("[Z7] prévias em lote", e);
        }
      } finally {
        ir.disabled = false;
        parar.hidden = true;
      }
    };
  });
}
