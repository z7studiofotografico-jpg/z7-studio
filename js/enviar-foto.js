// "📤 Enviar foto" (só admin, no computador): o aluno sem prévia no Drive ganha a prévia na hora, sem importar
// a pasta do colégio de novo. O admin escolhe as fotos do aluno (do servidor), o app faz a prévia igual à do
// gerador de prévias (folha com todas as fotos, marca d'água e nome + as fotos separadas e numeradas) e grava na
// pasta do colégio no Google Drive ("Prévias - 2026 - CEPD 117"; se não houver, cria). As fotos originais não mudam.
import { el, sheet, title } from "./ui.js";
import * as U from "./util.js";
import { prep, marca } from "./mockup.js";
import { reduzir, desenharFolha } from "./previa.js";
import { idDaPasta, pastaDoColegio, temFoto, nomeArquivoAluno, ehPastaAno, lerNomeAluno } from "./drive-fotos.js";
import { abrirDriveEscrita, esquecerListas } from "./fotos-aluno.js";

const MAX_FOTOS = 250,
  POR_PAGINA = 30,
  FOTO = /\.(jpe?g|png|webp)$/i;
const jpg = cv => new Promise(res => cv.toBlob(res, "image/jpeg", 0.72));

// a pasta do colégio no Drive (a mesma que o "🖼️ Fotos do aluno" lê); se não existir, cria
// "Prévias - ANO - COLÉGIO" dentro da pasta do ano ("Prévias 2026"), se houver, ou na pasta das prévias
export async function pastaParaGravar(D, raiz, it) {
  let colegios = await D.pastasColegios(raiz);
  if (!colegios.length) colegios = [{ id: raiz, name: await D.nomeDe(raiz) }];
  const achada = pastaDoColegio(colegios, it);
  if (achada) return { pasta: achada, criada: false };
  const doRaiz = (await D.listar(raiz)).filter(f => f.mimeType === "application/vnd.google-apps.folder");
  const doAno = doRaiz.find(f => ehPastaAno(f.name) && (!it.ano || new RegExp("\\b" + it.ano + "\\b").test(f.name)));
  const nome = ["Prévias", it.ano, String(it.escola || "Colégio").trim()].filter(Boolean).join(" - ");
  return { pasta: await D.criarPasta(doAno ? doAno.id : raiz, nome.replace(/[\\/]+/g, " ")), criada: true };
}

// o: { aoGravar() quando a prévia está no Drive (ex.: marcar na lista), verFotos() para o botão "Ver as fotos" }
export function enviarFotoAluno(C, it, o = {}) {
  sheet("📤 Enviar foto de " + U.first(title(it.nome || "")), (p, close) => {
    const raiz = idDaPasta(C.P.drivePrevias);
    const D = abrirDriveEscrita(C);
    if (!raiz || !D) {
      p.append(
        el(
          "p",
          "wait",
          !raiz
            ? "A pasta das prévias no Google Drive ainda não foi ligada ao app (Ajustes)."
            : "Para enviar fotos, a conta Google precisa estar ligada ao app: em Ajustes, preencha o “ID do cliente Google”."
        ),
        U.mkBtn("Fechar", "", close)
      );
      return;
    }
    p.append(
      el(
        "p",
        "hint",
        `Escolha as fotos de ${title(it.nome || "")} no computador (pode marcar várias de uma vez ou escolher a pasta do aluno). ` +
          "O app faz a prévia com marca d'água, igual à do gerador de prévias, e grava na pasta do colégio no Google Drive. As fotos originais não mudam."
      ),
      el("p", "hint", `${it.escola || "Sem colégio"}${it.ano ? " · " + it.ano : ""}${it.codigo ? " · " + it.codigo : ""}`)
    );
    const info = el("p", null, "");
    const barra = el("progress");
    barra.hidden = true;
    barra.style.width = "100%";
    const erros = el("div", "notes");
    erros.hidden = true;
    const escolher = (pasta = false) => {
      const i = document.createElement("input");
      i.type = "file";
      i.multiple = true;
      i.accept = "image/jpeg,image/png,image/webp";
      if (pasta) i.webkitdirectory = true;
      i.onchange = () => preparar([...i.files].filter(f => FOTO.test(f.name)));
      i.click();
    };
    const bFotos = U.mkBtn("Escolher as fotos", "btn-primary", () => escolher(false));
    const bPasta = U.mkBtn("Escolher a pasta do aluno", "", () => escolher(true));
    const bGravar = U.mkBtn("📤 Gravar no Drive", "btn-primary", () => gravar());
    bGravar.hidden = true;
    const acoes = el("div", "panel-actions");
    acoes.append(U.mkBtn("Fechar", "", close), bPasta, bFotos, bGravar);
    p.append(info, barra, erros, acoes);

    let fotos = [];
    async function preparar(files) {
      erros.hidden = true;
      erros.textContent = "";
      if (!files.length) return (info.textContent = "Nenhuma foto escolhida (JPG, PNG ou WEBP).");
      files.sort((a, b) => (a.webkitRelativePath || a.name).localeCompare(b.webkitRelativePath || b.name, "pt-BR", { numeric: true }));
      const usar = files.slice(0, MAX_FOTOS);
      fotos = [];
      const falhas = [];
      bFotos.disabled = bPasta.disabled = true;
      barra.hidden = false;
      barra.max = usar.length;
      for (const [k, f] of usar.entries()) {
        info.textContent = `Lendo a foto ${k + 1} de ${usar.length}…`;
        try {
          fotos.push(await reduzir(f));
        } catch (e) {
          falhas.push(f.name);
        }
        barra.value = k + 1;
      }
      barra.hidden = true;
      bFotos.disabled = bPasta.disabled = false;
      if (falhas.length) {
        erros.hidden = false;
        erros.append(
          el(
            "small",
            "hint",
            `⚠️ ${falhas.length} foto${falhas.length > 1 ? "s não abriram" : " não abriu"} (${falhas.slice(0, 4).join(", ")}${falhas.length > 4 ? "…" : ""}): abra e salve de novo como JPG.`
          )
        );
      }
      if (!fotos.length) return (info.textContent = "Nenhuma das fotos abriu.");
      info.textContent =
        `${fotos.length} foto${fotos.length > 1 ? "s" : ""} pronta${fotos.length > 1 ? "s" : ""}` +
        (files.length > MAX_FOTOS ? ` (só as ${MAX_FOTOS} primeiras)` : "") +
        ". Toque em “Gravar no Drive”.";
      bGravar.hidden = false;
    }

    const gravados = [];
    async function gravar() {
      gravados.length = 0;
      bGravar.disabled = bFotos.disabled = bPasta.disabled = true;
      try {
        info.textContent = "Entrando no Google…";
        const { pasta, criada } = await pastaParaGravar(D, raiz, it);
        // não grava duas vezes: se a prévia já está lá (outra pessoa enviou, ou o gerador já rodou), só avisa
        if (!criada && temFoto(await D.listar(pasta.id), it)) {
          info.textContent = `${title(it.nome || "")} já tem foto em “${pasta.name}”. Nada foi gravado.`;
          esquecerListas();
          if (o.aoGravar) o.aoGravar();
          return;
        }
        await prep();
        const nome = nomeArquivoAluno(it);
        const cod = lerNomeAluno(nome).cod;
        const st = {
          nome: nome.replace(/^.*? - /, "") || nome,
          escola: [cod, it.escola, it.ano].filter(Boolean).join(" · "),
          fotos
        };
        const paginas = Math.ceil(fotos.length / POR_PAGINA);
        const total = fotos.length + paginas;
        let feitos = 0;
        barra.hidden = false;
        barra.max = total;
        const passo = t => {
          feitos++;
          barra.value = feitos;
          info.textContent = `Gravando no Drive ${feitos} de ${total}${t ? " · " + t : ""}…`;
        };
        // 1) as fotos separadas, com marca e número (para montar o quadro e os porta-retratos)
        const sub = await D.criarPasta(pasta.id, nome);
        gravados.push(sub.id);
        for (const [k, f] of fotos.entries()) {
          const c = document.createElement("canvas");
          c.width = f.width;
          c.height = f.height;
          const x = c.getContext("2d");
          x.drawImage(f, 0, 0);
          marca(x, 0, 0, c.width, c.height);
          await D.enviar(sub.id, `${nome} - foto ${String(k + 1).padStart(2, "0")}.jpg`, await jpg(c));
          passo("foto " + (k + 1));
        }
        // 2) a folha com todas as fotos (a que vai pelo WhatsApp)
        for (let pg = 0; pg < paginas; pg++) {
          const cv = document.createElement("canvas");
          desenharFolha(cv, st, pg);
          gravados.push((await D.enviar(pasta.id, nome + (paginas > 1 ? ` - pagina ${pg + 1}` : "") + ".jpg", await jpg(cv))).id);
          passo("folha");
        }
        esquecerListas();
        barra.hidden = true;
        info.textContent = `✅ Prévia de ${title(it.nome || "")} gravada em “${pasta.name}” (${fotos.length} foto${fotos.length > 1 ? "s" : ""}).`;
        U.toast("Foto enviada ✅");
        bGravar.hidden = true;
        acoes.textContent = "";
        acoes.append(
          U.mkBtn("Fechar", "", close),
          ...(o.verFotos
            ? [
                U.mkBtn("🖼️ Ver as fotos", "btn-primary", () => {
                  close();
                  o.verFotos();
                })
              ]
            : [])
        );
        if (o.aoGravar) o.aoGravar();
      } catch (e) {
        barra.hidden = true;
        console.warn("[Z7] enviar foto", e);
        // não deixa prévia pela metade no Drive (senão o aluno pareceria ter foto): o que já foi gravado vai para a lixeira
        for (const id of gravados.splice(0)) await D.lixeira(id).catch(() => {});
        esquecerListas();
        info.className = "wait";
        info.textContent = (e && e.message) || "Não consegui gravar no Drive agora. Verifique a internet e tente de novo.";
        bGravar.disabled = bFotos.disabled = bPasta.disabled = false;
      }
    }
  });
}
