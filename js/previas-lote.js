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
  MAX_FOTOS = 90;
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
// Todas as pastas que têm fotos (cada uma é um aluno): [{ nome, caminho, arquivos: [FileHandle] }]
export async function pastasComFotos(dir, caminho = []) {
  const out = [],
    fotos = [];
  for await (const h of dir.values()) {
    if (h.kind === "file" && FOTO.test(h.name)) fotos.push(h);
    else if (h.kind === "directory") out.push(...(await pastasComFotos(h, [...caminho, h.name])));
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
export function nomesDeSaida(alunos) {
  const vistos = {};
  return alunos.map(a => {
    let n = limpo(a.nome);
    if (vistos[n]) n = limpo(a.caminho.slice(-2).join(" - "));
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
async function lerFoto(h) {
  try {
    return await reduzir(await h.getFile());
  } catch (e) {
    await espera(500);
    return reduzir(await h.getFile());
  }
}

// o = { col: "repasse" | "paspatur" | "formaturaAlunos" } (a lista onde procurar quem já comprou)
export function abrirPreviasLote(C, o = {}) {
  const colNome = o.col || "repasse";
  sheet("🖼️ Gerar prévias de um colégio", (p, close) => {
    p.append(
      el(
        "p",
        "hint",
        "No computador: escolha a pasta do colégio no servidor (com uma pasta por aluno) e depois a pasta onde salvar. Para cada aluno sai uma imagem leve (~200 KB) com todas as fotos dele, a marca d'água e o nome. Depois, arraste a pasta de prévias para o Google Drive e compartilhe com o representante como Leitor."
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
    soTrabalho.checked = true;
    const lTrab = el("label", "chk");
    lTrab.append(soTrabalho, document.createTextNode(" Pular quem já comprou (fica só no Dashboard)"));
    const semTel = el("input");
    semTel.type = "checkbox";
    const lSem = el("label", "chk");
    lSem.append(semTel, document.createTextNode(" Pular também quem está sem telefone"));
    p.append(lTrab, lSem);
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
    const acoes = el("div", "panel-actions");
    acoes.append(fechar, parar, ir);
    const errosBox = el("div", "notes");
    errosBox.hidden = true;
    p.append(info, barra, errosBox, acoes);
    // Só os que deram erro: a lista (para conferir no servidor) e gerar de novo apenas esses alunos
    function mostrarErros(lista, fazer, destinoNome) {
      errosBox.textContent = "";
      errosBox.hidden = !lista.length;
      if (!lista.length) return;
      errosBox.append(
        el("b", null, `⚠️ ${lista.length} aluno${lista.length > 1 ? "s" : ""} com erro (foto que não abriu no servidor):`),
        ...lista.map(([a]) => el("div", null, "• " + (a.caminho.length ? a.caminho : [a.nome]).join(" / "))),
        el("p", "hint", "As outras prévias já estão salvas. Confira essas pastas no servidor e gere de novo só elas:")
      );
      const de = U.mkBtn("🔁 Gerar de novo só esses", "btn-primary", async () => {
        de.disabled = true;
        const ainda = [];
        let ok = 0;
        for (const [a, i] of lista) {
          info.textContent = `Gerando de novo: ${a.nome}…`;
          try {
            await fazer(a, i);
            ok++;
          } catch (_) {
            ainda.push([a, i]);
          }
        }
        info.textContent =
          `${ok} prévia${ok === 1 ? "" : "s"} refeita${ok === 1 ? "" : "s"} em “${destinoNome}”.` +
          (ainda.length ? "" : " Tudo certo agora ✅");
        de.disabled = false;
        mostrarErros(ainda, fazer, destinoNome);
      });
      const cp = U.mkBtn("📋 Copiar a lista", "", () =>
        navigator.clipboard
          .writeText(lista.map(([a]) => (a.caminho.length ? a.caminho : [a.nome]).join(" / ")).join("\n"))
          .then(() => U.toast("Lista copiada"))
          .catch(() => U.toast("Não consegui copiar"))
      );
      errosBox.append(de, cp);
    }
    let cancelar = false;
    parar.onclick = () => (cancelar = true);
    ir.onclick = async () => {
      let origem, destino;
      try {
        origem = await window.showDirectoryPicker({ id: "z7-fotos", mode: "read" });
        info.textContent = "Procurando as fotos…";
        let alunos = await pastasComFotos(origem);
        if (!alunos.length) return (info.textContent = "Não achei fotos nessa pasta (nem nas pastas de dentro).");
        const col = nomeDoColegio(origem.name);
        let resumoFora = "";
        if (soTrabalho.checked || semTel.checked) {
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
        const pasta = await destino.getDirectoryHandle(limpo(`Prévias - ${col.ano ? col.ano + " - " : ""}${col.nome}`), { create: true });
        await prep();
        const nomes = nomesDeSaida(alunos);
        cancelar = false;
        ir.disabled = true;
        parar.hidden = false;
        barra.hidden = false;
        barra.max = alunos.length;
        let feitos = 0;
        const falharam = [];
        const fazer = async (a, i) => {
          const fotos = [];
          let faltou = 0;
          for (const h of a.arquivos.slice(0, MAX_FOTOS)) {
            try {
              fotos.push(await lerFoto(h));
            } catch (_) {
              faltou++;
            }
          }
          if (!fotos.length) throw new Error("nenhuma foto abriu");
          // saiu com foto faltando: conta como erro (gera de novo depois, completo)
          if (faltou) {
            throw Object.assign(new Error("foto faltando"), { parcial: true });
          }
          // no cabeçalho: o nome do aluno sem o código da pasta ("CEYMS 01 - FABIOLA" → "FABIOLA"), e o código ao lado do colégio
          const cod = (a.nome.match(/^([A-Z0-9]+\s*\d+)\s*-\s*/i) || [])[1] || "";
          const st = {
            nome: a.nome.replace(/^[A-Z0-9]+\s*\d+\s*-\s*/i, "") || a.nome,
            escola: [cod, col.nome, col.ano].filter(Boolean).join(" · "),
            fotos
          };
          const paginas = Math.ceil(fotos.length / POR_PAGINA);
          // as fotos separadas (pequenas, com marca e número): o representante monta o quadro e os porta-retratos
          // no app ("🖼️ Prévia e fotos") com as que a família escolher
          if (separadas.checked) {
            const sub = await pasta.getDirectoryHandle(nomes[i], { create: true });
            for (const [k, f] of fotos.entries()) {
              const c = document.createElement("canvas");
              c.width = f.width;
              c.height = f.height;
              const x = c.getContext("2d");
              x.drawImage(f, 0, 0);
              marca(x, 0, 0, c.width, c.height);
              await gravar(sub, `${nomes[i]} - foto ${String(k + 1).padStart(2, "0")}.jpg`, await jpg(c));
            }
          }
          for (let pg = 0; pg < paginas; pg++) {
            const cv = document.createElement("canvas");
            desenharFolha(cv, st, pg);
            await gravar(pasta, nomes[i] + (paginas > 1 ? ` - pagina ${pg + 1}` : "") + ".jpg", await jpg(cv));
          }
        };
        // um aluno com problema (arquivo que sumiu, pasta do Drive ainda baixando) não para os outros
        for (const [i, a] of alunos.entries()) {
          if (cancelar) break;
          info.textContent = `Aluno ${i + 1} de ${alunos.length}: ${a.nome} (${a.arquivos.length} fotos)…`;
          try {
            await fazer(a, i);
            feitos++;
          } catch (e) {
            console.warn("[Z7] prévia de", a.nome, e);
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
              feitos++;
            } catch (_) {
              falharam.push([a, i]);
            }
          }
        }
        if (falharam.length) mostrarErros(falharam, fazer, pasta.name);
        info.textContent =
          (cancelar ? `Parado. ` : "Pronto! ") +
          `${feitos} prévia${feitos === 1 ? "" : "s"} salva${feitos === 1 ? "" : "s"} em “${pasta.name}”.` +
          resumoFora +
          (falharam.length ? ` ⚠️ ${falharam.length} com erro (lista abaixo).` : "") +
          " Agora arraste essa pasta para o Google Drive.";
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
