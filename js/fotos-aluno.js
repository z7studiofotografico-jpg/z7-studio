// "🖼️ Fotos do aluno" (cartão do PR): busca no Google Drive a folha numerada e as fotos separadas do aluno,
// para mandar a folha pelo WhatsApp e, com as fotos que a família escolher, montar o quadro e os porta-retratos.
import { el, sheet, title } from "./ui.js";
import * as U from "./util.js";
import { criarDrive, idDaPasta } from "./drive-fotos.js";
import { openMockup } from "./mockup.js";

let drive = null,
  chaveUsada = "";
function abrirDrive(C) {
  const k = C.P.driveChave || ((self.Z7_CONFIG || {}).firebase || {}).apiKey || "";
  if (!drive || chaveUsada !== k) {
    drive = criarDrive(k, (u, o) => fetch(u, o));
    chaveUsada = k;
  }
  return drive;
}
const NOMES = ["Quadro", "Porta-retratos 1", "Porta-retratos 2"];

// precoTxt: o texto do preço do kit (o mesmo da prévia)
export function abrirFotosDoAluno(C, it, precoTxt) {
  sheet("🖼️ Fotos de " + U.first(title(it.nome || "")), async (p, close) => {
    const raiz = idDaPasta(C.P.drivePrevias);
    if (!raiz) {
      p.append(
        el("p", "wait", "A pasta das prévias no Google Drive ainda não foi ligada ao app (o administrador cola o link em Ajustes)."),
        U.mkBtn("Fechar", "", close)
      );
      return;
    }
    const info = el("p", "hint", "Procurando as fotos no Google Drive…");
    p.append(info);
    const D = abrirDrive(C);
    let r;
    try {
      r = await D.fotosDoAluno(raiz, it);
    } catch (e) {
      info.className = "wait";
      info.textContent = e.message || "Não consegui ler o Google Drive agora.";
      p.append(U.mkBtn("Fechar", "", close));
      return;
    }
    if (r.erro) {
      info.className = "wait";
      info.textContent = r.erro;
      p.append(U.mkBtn("Fechar", "", close));
      return;
    }
    info.textContent = `${r.fotos.length} foto${r.fotos.length === 1 ? "" : "s"} · ${r.colegio.replace(/^Pr[ée]vias\s*-\s*/i, "")}`;
    // 1) a folha numerada: para a família escolher
    const folhas = [];
    if (r.folhas.length) {
      const bFolha = U.mkBtn("📤 Enviar a folha numerada", "btn-primary", async () => {
        try {
          bFolha.disabled = true;
          if (!folhas.length) for (const f of r.folhas) folhas.push(new File([await D.baixar(f.id)], f.name, { type: "image/jpeg" }));
          const texto = `Olá! Aqui estão as fotos de ${U.first(title(it.nome))} 📸 Escolha 1 foto para o quadro e 2 para os porta-retratos e me responda com os números 😊`;
          if (navigator.canShare && navigator.canShare({ files: folhas })) await navigator.share({ files: folhas, text: texto });
          else
            folhas.forEach(f => {
              const a = el("a");
              a.href = URL.createObjectURL(f);
              a.download = f.name;
              a.click();
              setTimeout(() => URL.revokeObjectURL(a.href), 5000);
            });
        } catch (e) {
          if (!(e && e.name === "AbortError")) C.handleErr(e);
        } finally {
          bFolha.disabled = false;
        }
      });
      p.append(bFolha);
    }
    // 2) as fotos separadas: toque na ordem quadro → porta-retratos
    if (!r.fotos.length) return p.append(U.mkBtn("Fechar", "", close));
    p.append(el("p", "hint", "Toque nas fotos que a família escolheu, na ordem: primeiro a do quadro, depois as 2 dos porta-retratos."));
    const grade = el("div", "fotos-grade");
    p.append(grade);
    const escolha = []; // índices
    const blobs = [];
    const montar = U.mkBtn("🖼️ Montar o quadro com estas fotos", "btn-primary", () => {
      close();
      openMockup({
        nome: title(it.nome || ""),
        escola: title(it.escola || ""),
        preco: precoTxt,
        toast: U.toast,
        fotos: escolha.map(i => blobs[i])
      });
    });
    montar.disabled = true;
    const pintar = () => {
      [...grade.children].forEach((b, i) => {
        const k = escolha.indexOf(i);
        b.classList.toggle("on", k >= 0);
        b.querySelector(".tag").textContent = k >= 0 ? NOMES[k] : "";
      });
      montar.disabled = !escolha.length;
    };
    r.fotos.forEach((f, i) => {
      const b = el("button", "foto-item");
      b.type = "button";
      b.append(el("span", "num", String(i + 1)), el("span", "tag", ""));
      b.disabled = true;
      b.onclick = () => {
        const k = escolha.indexOf(i);
        if (k >= 0) escolha.splice(k, 1);
        else if (escolha.length < 3) escolha.push(i);
        else U.toast("Já escolheu as 3 (quadro e 2 porta-retratos). Toque numa para tirar.");
        pintar();
      };
      grade.append(b);
    });
    p.append(montar, U.mkBtn("Fechar", "", close));
    // baixa as fotos uma a uma (pequenas: ~60 KB cada)
    for (const [i, f] of r.fotos.entries()) {
      if (!p.isConnected) return;
      try {
        blobs[i] = await D.baixar(f.id);
        const img = el("img");
        img.alt = "Foto " + (i + 1);
        img.src = URL.createObjectURL(blobs[i]);
        grade.children[i].prepend(img);
        grade.children[i].disabled = false;
      } catch (e) {
        grade.children[i].append(el("small", "wait", "não abriu"));
      }
    }
  });
}
