// "🔎 Conferir fotos" (só admin): compara os alunos do app com as prévias no Google Drive, por colégio e ano.
// Quem está sem foto fica separado em: já comprou (normal: o gerador de prévias pula quem comprou),
// sem telefone (fora das filas e do Dashboard) e falta gerar (precisa de prévia). Cada um que falta tem o "📤 Enviar foto".
import { el, sheet, title } from "./ui.js";
import * as U from "./util.js";
import { idDaPasta, pastaDoColegio, temFoto } from "./drive-fotos.js";
import { abrirDrive, abrirFotosDoAluno } from "./fotos-aluno.js";
import { gruposEscolas } from "./escolas-pr.js";

// as mesmas regras do gerador de prévias
export const COMPROU = ["PAGO", "ENTREGUE"];
// separa os alunos de um colégio: { com, comprou, semTel, faltam } (itens = o que há na pasta do colégio no Drive)
export function separarFotos(alunos, itens) {
  const r = { com: [], comprou: [], semTel: [], faltam: [] };
  alunos.forEach(it => {
    if (itens.length && temFoto(itens, it)) r.com.push(it);
    else if (COMPROU.includes(it.etapa)) r.comprou.push(it);
    else if (it.etapa === "SEM TELEFONE") r.semTel.push(it);
    else r.faltam.push(it);
  });
  const ordem = (a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR");
  Object.values(r).forEach(l => l.sort(ordem));
  return r;
}
const META = { repasse: "repasse_meta", paspatur: "paspatur_meta", formaturaAlunos: "formatura_meta" };
const NOME_LISTA = { repasse: "PR", paspatur: "Paspatur", formaturaAlunos: "Formatura" };

export function abrirConferirFotos(C, colNome = "repasse") {
  sheet(
    "🔎 Conferir fotos · " + NOME_LISTA[colNome],
    async (p, close) => {
      const { FS, db } = C;
      const raiz = idDaPasta(C.P.drivePrevias);
      p.append(
        el(
          "p",
          "hint",
          "Compara os alunos do app com as prévias do Google Drive. Sem foto e já comprou é normal (o gerador pula quem comprou). " +
            "Quem falta gerar tem o botão 📤 Enviar foto: escolha as fotos do aluno no computador e o app grava a prévia na pasta do colégio."
        )
      );
      if (!raiz) {
        p.append(el("p", "wait", "A pasta das prévias no Google Drive ainda não foi ligada ao app (Ajustes)."), U.mkBtn("Fechar", "", close));
        return;
      }
      const info = el("p", "hint", "Carregando os colégios…");
      p.append(info);
      let grupos = [];
      try {
        const meta = (await FS.getDoc(FS.doc(db, "config", META[colNome]))).data() || {};
        grupos = gruposEscolas(meta);
      } catch (e) {
        info.className = "wait";
        info.textContent = "Não consegui carregar os colégios. Verifique a internet.";
        p.append(U.mkBtn("Fechar", "", close));
        return;
      }
      const anos = [...new Set(grupos.map(g => g.ano))].sort((a, b) => b - a);
      if (!anos.length) {
        info.textContent = "Ainda não há alunos importados nesta lista.";
        p.append(U.mkBtn("Fechar", "", close));
        return;
      }
      info.textContent = "";
      const selAno = el("select");
      selAno.setAttribute("aria-label", "Ano");
      anos.forEach(a => selAno.append(new Option(String(a), String(a))));
      const anoAtual = new Date().getFullYear();
      selAno.value = String(anos.includes(anoAtual) ? anoAtual : anos[0]);
      const selCol = el("select");
      selCol.setAttribute("aria-label", "Colégio");
      const pintarCols = () => {
        selCol.textContent = "";
        selCol.append(new Option("Todos os colégios", ""));
        grupos.filter(g => g.ano === Number(selAno.value)).forEach(g => selCol.append(new Option(g.nome, g.valor)));
      };
      pintarCols();
      selAno.onchange = pintarCols;
      const linha = el("div", "row2");
      linha.append(selAno, selCol);
      const ir = U.mkBtn("Conferir", "btn-primary", () => conferir());
      const parar = U.mkBtn("Parar", "", () => (cancelar = true));
      parar.hidden = true;
      const barra = el("progress");
      barra.hidden = true;
      barra.style.width = "100%";
      const total = el("div", "notes");
      total.hidden = true;
      const lista = el("div");
      const acoes = el("div", "panel-actions");
      acoes.append(U.mkBtn("Fechar", "", close), parar, ir);
      p.append(linha, acoes, barra, total, lista);

      let cancelar = false;
      async function alunosDe(g) {
        const out = [];
        for (let i = 0; i < g.nomes.length; i += 30) {
          const s = await FS.getDocs(
            FS.query(FS.collection(db, colNome), FS.where("escola", "in", g.nomes.slice(i, i + 30)), FS.where("ano", "==", g.ano))
          );
          s.forEach(d => out.push(Object.assign({ id: d.id }, d.data())));
        }
        return out.filter(it => !(it.excluido && it.excluido.em));
      }
      async function conferir() {
        const ano = Number(selAno.value);
        const gs = grupos.filter(g => g.ano === ano && (!selCol.value || g.valor === selCol.value));
        if (!gs.length) return;
        cancelar = false;
        ir.disabled = selAno.disabled = selCol.disabled = true;
        parar.hidden = false;
        barra.hidden = false;
        barra.max = gs.length;
        barra.value = 0;
        lista.textContent = "";
        total.hidden = true;
        const soma = { alunos: 0, com: 0, comprou: 0, semTel: 0, faltam: 0 };
        const blocos = [];
        try {
          const D = abrirDrive(C);
          D.esquecer();
          let colegios = await D.pastasColegios(raiz);
          if (!colegios.length) colegios = [{ id: raiz, name: await D.nomeDe(raiz) }];
          for (const [i, g] of gs.entries()) {
            if (cancelar) break;
            info.className = "hint";
            info.textContent = `Conferindo ${i + 1} de ${gs.length}: ${g.nome}…`;
            const alunos = await alunosDe(g);
            const pasta = pastaDoColegio(colegios, { escola: g.nome, ano: g.ano });
            const itens = pasta ? await D.listar(pasta.id) : [];
            const r = separarFotos(alunos, itens);
            soma.alunos += alunos.length;
            ["com", "comprou", "semTel", "faltam"].forEach(k => (soma[k] += r[k].length));
            blocos.push({ g, pasta, r, n: alunos.length });
            barra.value = i + 1;
          }
        } catch (e) {
          console.warn("[Z7] conferir fotos", e);
          info.className = "wait";
          info.textContent = (e && e.message) || "Não consegui ler o Google Drive agora.";
        } finally {
          ir.disabled = selAno.disabled = selCol.disabled = false;
          parar.hidden = true;
          barra.hidden = true;
        }
        if (!blocos.length) return;
        if (info.className === "hint") info.textContent = (cancelar ? "Parado. " : "") + `${blocos.length} colégio${blocos.length > 1 ? "s" : ""} de ${ano} conferido${blocos.length > 1 ? "s" : ""}.`;
        total.hidden = false;
        total.textContent = "";
        total.append(
          el("b", null, `${soma.alunos} alunos · ${soma.com} com foto`),
          el("div", null, `Sem foto, já comprou: ${soma.comprou} (normal, não precisa)`),
          el("div", null, `Sem foto, sem telefone: ${soma.semTel} (fora das filas e do Dashboard, não precisa)`),
          el("div", null, `Sem foto, não comprou: ${soma.faltam}${soma.faltam ? " → falta gerar a prévia" : " ✓"}`)
        );
        if (soma.faltam) {
          // lista para conferir no servidor
          total.append(
            U.mkBtn("📋 Copiar a lista dos que faltam", "", () =>
              navigator.clipboard
                .writeText(
                  blocos
                    .filter(b => b.r.faltam.length)
                    .map(b => `${b.g.nome} (${b.g.ano})\n` + b.r.faltam.map(it => `  - ${title(it.nome || "")}${it.codigo ? " · " + it.codigo : ""}`).join("\n"))
                    .join("\n\n")
                )
                .then(() => U.toast("Lista copiada"))
                .catch(() => U.toast("Não consegui copiar"))
            )
          );
        }
        // primeiro os colégios com aluno faltando prévia
        blocos.sort((a, b) => b.r.faltam.length - a.r.faltam.length || a.g.nome.localeCompare(b.g.nome, "pt-BR"));
        blocos.forEach(b => lista.append(blocoColegio(b)));
      }
      function blocoColegio({ g, pasta, r, n }) {
        const box = el("div", "notes conf-fotos");
        box.append(el("b", null, `${g.nome} · ${g.ano}`));
        box.append(
          el(
            "div",
            "hint",
            `${n} aluno${n === 1 ? "" : "s"} · ${r.com.length} com foto · sem foto: ${r.comprou.length} já compraram · ${r.semTel.length} sem telefone · ${r.faltam.length} falta${r.faltam.length === 1 ? "" : "m"} gerar`
          )
        );
        if (!pasta) box.append(el("small", "wait", "Este colégio ainda não tem pasta de prévias no Drive (o primeiro envio cria)."));
        r.faltam.forEach(it => {
          const lin = el("div", "conf-aluno");
          const txt = el("span", null, `${title(it.nome || "")}${it.codigo ? " · " + it.codigo : ""}${it.etapa ? " · " + it.etapa.toLowerCase() : ""}`);
          const b = U.mkBtn("📤 Enviar foto", "", () =>
            import("./enviar-foto.js")
              .then(m =>
                m.enviarFotoAluno(C, it, {
                  aoGravar: () => {
                    b.remove();
                    txt.textContent = "✅ " + txt.textContent;
                  },
                  verFotos: () => abrirFotosDoAluno(C, it, "")
                })
              )
              .catch(e => C.handleErr(e))
          );
          lin.append(txt, b);
          box.append(lin);
        });
        return box;
      }
    },
    { div: true, wide: true }
  );
}
