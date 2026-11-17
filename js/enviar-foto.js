// "📤 Enviar foto" (só admin, no computador): o aluno sem prévia ganha a prévia na hora, sem importar
// a pasta do colégio de novo. O admin escolhe as fotos do aluno (do servidor), o app faz a prévia igual à do
// gerador de prévias (folha com todas as fotos, marca d'água e nome + as fotos separadas e numeradas).
// 17/11/2026: grava direto no site (z7studio.com.br/previas), não mais no Google Drive: cada aluno que abre a
// prévia vira visita no site. As fotos originais não mudam.
import { el, sheet, title } from "./ui.js";
import * as U from "./util.js";
import { prep, marca } from "./mockup.js";
import { reduzir, desenharFolha } from "./previa.js";
import { pastaDoColegio, nomeArquivoAluno, ehPastaAno, lerNomeAluno } from "./drive-fotos.js";
import { esquecerListas } from "./fotos-aluno.js";
import { enviarParaSite, fotosDoAlunoNoSite, apagarDoSite, esquecerSite } from "./site-previas.js";

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

// o: { aoGravar() quando a prévia está no site (ex.: marcar na lista), verFotos() para o botão "Ver as fotos" }
export function enviarFotoAluno(C, it, o = {}) {
  sheet("📤 Enviar foto de " + U.first(title(it.nome || "")), (p, close) => {
    if (!it.escola) {
      p.append(el("p", "wait", "Este aluno está sem colégio. Coloque o colégio antes de enviar a prévia."), U.mkBtn("Fechar", "", close));
      return;
    }
    p.append(
      el(
        "p",
        "hint",
        `Escolha as fotos de ${title(it.nome || "")} no computador (pode marcar várias de uma vez ou escolher a pasta do aluno). ` +
          "O app faz a prévia com marca d'água, igual à do gerador de prévias, e grava no site do Z7. As fotos originais não mudam."
      ),
      el("p", "hint", `${it.escola}${it.ano ? " · " + it.ano : ""}${it.codigo ? " · " + it.codigo : ""}`)
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
    const bGravar = U.mkBtn("📤 Gravar no site", "btn-primary", () => gravar());
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
        ". Toque em “Gravar no site”.";
      bGravar.hidden = false;
    }

    let comecou = false;
    async function gravar() {
      comecou = false;
      bGravar.disabled = bFotos.disabled = bPasta.disabled = true;
      try {
        info.textContent = "Conferindo o site…";
        esquecerSite();
        // não grava duas vezes: se a prévia já está no site, só avisa
        if (await fotosDoAlunoNoSite(C, it)) {
          info.textContent = `${title(it.nome || "")} já tem prévia no site. Nada foi gravado.`;
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
          info.textContent = `Gravando no site ${feitos} de ${total}${t ? " · " + t : ""}…`;
        };
        comecou = true;
        // 1) as fotos separadas, com marca e número (para montar o quadro e os porta-retratos)
        for (const [k, f] of fotos.entries()) {
          const c = document.createElement("canvas");
          c.width = f.width;
          c.height = f.height;
          const x = c.getContext("2d");
          x.drawImage(f, 0, 0);
          marca(x, 0, 0, c.width, c.height);
          await enviarParaSite(C, it, await jpg(c), "foto");
          passo("foto " + (k + 1));
        }
        // 2) a folha com todas as fotos (a que vai pelo WhatsApp)
        for (let pg = 0; pg < paginas; pg++) {
          const cv = document.createElement("canvas");
          desenharFolha(cv, st, pg);
          await enviarParaSite(C, it, await jpg(cv), "folha");
          passo("folha");
        }
        esquecerSite();
        esquecerListas();
        barra.hidden = true;
        info.textContent = `✅ Prévia de ${title(it.nome || "")} gravada no site (${fotos.length} foto${fotos.length > 1 ? "s" : ""}).`;
        U.toast("Prévia no site ✅");
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
        // não deixa prévia pela metade no site (senão o aluno pareceria ter foto): apaga o que já foi
        if (comecou) await apagarDoSite(C, it).catch(() => {});
        esquecerListas();
        info.className = "wait";
        info.textContent = (e && e.message) || "Não consegui gravar no site agora. Verifique a internet e tente de novo.";
        bGravar.disabled = bFotos.disabled = bPasta.disabled = false;
      }
    }
  });
}
