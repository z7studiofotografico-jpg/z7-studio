// Prévias em lote (só admin, no computador): lê a pasta de um colégio no servidor (uma subpasta por aluno),
// e grava numa pasta escolhida uma prévia por aluno: todas as fotos reduzidas, com marca d'água e o nome do aluno.
// Nada sobe para a internet: depois é só arrastar a pasta de prévias para o Google Drive e compartilhar como Leitor.
// Precisa do Chrome ou Edge no computador (acesso a pastas). As fotos originais nunca são alteradas.
import { el, sheet } from "./ui.js";
import { prep } from "./mockup.js";
import { reduzir, desenharFolha } from "./previa.js";

const FOTO = /\.(jpe?g|png|webp)$/i,
  POR_PAGINA = 30,
  MAX_FOTOS = 90;
const limpo = n =>
  String(n || "")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120) || "aluno";

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
async function gravar(pasta, nome, blob) {
  const f = await pasta.getFileHandle(nome, { create: true });
  const w = await f.createWritable();
  await w.write(blob);
  await w.close();
}

export function abrirPreviasLote(C) {
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
    p.append(info, barra, acoes);
    let cancelar = false;
    parar.onclick = () => (cancelar = true);
    ir.onclick = async () => {
      let origem, destino;
      try {
        origem = await window.showDirectoryPicker({ id: "z7-fotos", mode: "read" });
        info.textContent = "Procurando as fotos…";
        const alunos = await pastasComFotos(origem);
        if (!alunos.length) return (info.textContent = "Não achei fotos nessa pasta (nem nas pastas de dentro).");
        info.textContent = `${alunos.length} aluno${alunos.length > 1 ? "s" : ""} com fotos em “${origem.name}”. Agora escolha onde salvar as prévias.`;
        destino = await window.showDirectoryPicker({ id: "z7-previas", mode: "readwrite" });
        const pasta = await destino.getDirectoryHandle(limpo("Prévias - " + origem.name), { create: true });
        await prep();
        const nomes = nomesDeSaida(alunos);
        cancelar = false;
        ir.disabled = true;
        parar.hidden = false;
        barra.hidden = false;
        barra.max = alunos.length;
        let feitos = 0,
          puladas = 0;
        for (const [i, a] of alunos.entries()) {
          if (cancelar) break;
          info.textContent = `Aluno ${i + 1} de ${alunos.length}: ${a.nome} (${a.arquivos.length} fotos)…`;
          const fotos = [];
          for (const h of a.arquivos.slice(0, MAX_FOTOS)) {
            try {
              fotos.push(await reduzir(await h.getFile()));
            } catch (_) {
              puladas++;
            }
          }
          if (!fotos.length) continue;
          const st = { nome: a.nome, escola: origem.name, fotos };
          const paginas = Math.ceil(fotos.length / POR_PAGINA);
          for (let pg = 0; pg < paginas; pg++) {
            const cv = document.createElement("canvas");
            desenharFolha(cv, st, pg);
            await gravar(pasta, nomes[i] + (paginas > 1 ? ` - pagina ${pg + 1}` : "") + ".jpg", await jpg(cv));
          }
          feitos++;
          barra.value = i + 1;
        }
        info.textContent =
          (cancelar ? `Parado. ` : "Pronto! ") +
          `${feitos} prévia${feitos === 1 ? "" : "s"} salva${feitos === 1 ? "" : "s"} em “${pasta.name}”.` +
          (puladas ? ` ${puladas} foto${puladas > 1 ? "s" : ""} não abriu (arquivo com problema) e ficou de fora.` : "") +
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
