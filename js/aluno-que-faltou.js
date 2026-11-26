// ➕ Aluno que faltou (26/11/2026). Em "📂 Fotos numa pasta só", o app separa os alunos pela foto da ficha. Se ele não
// achou a ficha de um aluno (papel torto, mão na frente), as fotos dele ficam junto com as do aluno anterior.
// Aqui: escolhe a pasta onde as fotos foram parar, marca as fotos do aluno que faltou, e o app cria a ficha dele em
// "✍️ Preencher à mão" (digita os dados da ficha em papel e confirma, como as outras). As fotos saem da pasta do outro.
import { el, title, sheet } from "./ui.js";
import * as U from "./util.js";
import { fotoDaFicha, idFicha } from "./fichas.js";
import { COLECAO, pastasACriar, chavePasta, lerPasta, liberar, miniatura } from "./fichas-separar.js";

export function abrirAlunoQueFaltou(C, depois) {
  sheet(
    "➕ Incluir o aluno que faltou",
    async (p, fechar) => {
      p.append(
        el(
          "p",
          "hint",
          "Quando o app não acha a ficha de um aluno, as fotos dele vão para a pasta do aluno anterior. Escolha essa pasta, marque as fotos do aluno que faltou (a da ficha e as seguintes) e toque em Criar."
        )
      );
      let itens = [];
      try {
        itens = (await pastasACriar(C)).sort((a, b) => String(a.codigo).localeCompare(String(b.codigo), "pt-BR", { numeric: true }));
      } catch (e) {
        return C.handleErr(e);
      }
      if (!itens.length) {
        p.append(
          el(
            "p",
            "hint",
            "Nenhuma pasta esperando para ser criada. (Depois de criadas, as fotos já estão nas pastas: inclua o aluno pelo ➕ Cadastrar aluno.)"
          )
        );
        p.append(U.mkBtn("Fechar", "", fechar));
        return;
      }
      const s = el("select");
      s.setAttribute("aria-label", "Pasta onde estão as fotos do aluno que faltou");
      // (26/11/2026) a pasta com fotos demais (bem mais que a maioria) é quase sempre a que tem o aluno que faltou
      const qts = itens.map(x => x.fotos.length).sort((a, b) => a - b);
      const mediana = qts[Math.floor(qts.length / 2)] || 0;
      const demais = x => mediana && x.fotos.length >= Math.max(mediana + 3, Math.ceil(mediana * 1.6));
      itens.forEach((x, i) => {
        const o = el("option", null, `${demais(x) ? "⚠️ " : ""}${x.codigo || ""} · ${title(x.nome || "")} · ${x.fotos.length} fotos`);
        o.value = String(i);
        s.append(o);
      });
      const suspeita = itens.findIndex(demais);
      if (suspeita >= 0) s.value = String(suspeita);
      // o número que falta na sequência dos IDs (ex.: 21, 23 → falta o 22)
      const porSigla = {};
      itens.forEach(x => {
        const m = String(x.codigo || "").match(/^(.*-)(\d+)$/);
        if (m) (porSigla[m[1]] = porSigla[m[1]] || []).push(Number(m[2]));
      });
      const faltam = [];
      Object.entries(porSigla).forEach(([pre, ns]) => {
        const max = Math.max(...ns);
        for (let n = 1; n < max; n++) if (!ns.includes(n)) faltam.push(pre + String(n).padStart(2, "0"));
      });
      if (suspeita >= 0 || faltam.length)
        p.append(
          el(
            "p",
            "notice",
            [
              faltam.length ? `Faltam na sequência: ${faltam.slice(0, 8).join(", ")}.` : "",
              suspeita >= 0
                ? `A pasta ${itens[suspeita].codigo} tem ${itens[suspeita].fotos.length} fotos (a maioria tem ${mediana}): o aluno que faltou deve estar nela.`
                : ""
            ]
              .filter(Boolean)
              .join(" ")
          )
        );
      const grade = el("div", "faltou-grade");
      const msg = el("p", "hint", "");
      let marcadas = new Set(),
        arquivos = new Map(); // nome → File (quando a pasta do computador está liberada)
      const desenhar = () => {
        const x = itens[Number(s.value)];
        grade.innerHTML = "";
        x.fotos.forEach((nome, i) => {
          const b = el("button", "faltou-foto");
          b.type = "button";
          b.setAttribute("aria-pressed", String(marcadas.has(nome)));
          const leg = el("small", null, `${i + 1}. ${nome}`);
          const f = arquivos.get(nome);
          if (f)
            miniatura(f).then(u => {
              if (u) {
                const im = el("img");
                im.src = u;
                im.alt = nome;
                b.prepend(im);
              }
            });
          b.append(leg);
          b.onclick = () => {
            if (marcadas.has(nome)) marcadas.delete(nome);
            else marcadas.add(nome);
            b.setAttribute("aria-pressed", String(marcadas.has(nome)));
            msg.textContent = marcadas.size ? `${marcadas.size} foto(s) marcada(s) para o aluno que faltou.` : "";
          };
          grade.append(b);
        });
      };
      s.onchange = () => {
        marcadas = new Set();
        msg.textContent = "";
        desenhar();
      };
      const ver = U.mkBtn("📷 Mostrar as fotos (pasta do computador)", "btn-sm", async () => {
        const x = itens[Number(s.value)];
        let dir = await lerPasta(chavePasta(x.escola, x.ano, x.origem));
        if (!dir || !(await liberar(dir).catch(() => false))) {
          try {
            dir = await window.showDirectoryPicker({ id: "z7-ensaio", mode: "readwrite" });
          } catch (_) {
            return;
          }
        }
        for (const nome of x.fotos)
          try {
            arquivos.set(nome, await (await dir.getFileHandle(nome)).getFile());
          } catch (_) {
            // a foto não está mais na pasta: fica só o nome
          }
        desenhar();
      });
      const ate = U.mkBtn("⤵ Marcar da 1ª marcada até o fim", "btn-sm", () => {
        const x = itens[Number(s.value)];
        const i = x.fotos.findIndex(n => marcadas.has(n));
        if (i < 0) return U.toast("Toque primeiro na foto da ficha do aluno que faltou.");
        x.fotos.slice(i).forEach(n => marcadas.add(n));
        msg.textContent = `${marcadas.size} foto(s) marcada(s) para o aluno que faltou.`;
        desenhar();
      });
      const criar = U.mkBtn("➕ Criar o aluno com essas fotos", "btn-primary", async () => {
        const x = itens[Number(s.value)];
        const fotos = x.fotos.filter(n => marcadas.has(n));
        if (!fotos.length) return U.toast("Marque as fotos do aluno que faltou.");
        if (fotos.length === x.fotos.length) return U.toast("Deixe pelo menos uma foto com o aluno da pasta.");
        criar.disabled = true;
        try {
          let img = "";
          const f0 = arquivos.get(fotos[0]);
          if (f0) img = (await fotoDaFicha(f0)).img;
          const pasta = `Aluno que faltou (${fotos[0].replace(/\.[^.]+$/, "")})`;
          const ficha = {
            escola: x.escola,
            ano: x.ano || null,
            colNome: x.colNome || "repasse",
            pasta,
            arquivo: fotos[0],
            img,
            semPapel: true,
            status: "nova",
            fotos,
            origem: x.origem || "",
            criadoEm: new Date().toISOString(),
            por: C.me || ""
          };
          await C.FS.setDoc(C.FS.doc(C.db, "fichas", idFicha(x.escola, x.ano, pasta)), ficha);
          await C.FS.updateDoc(C.FS.doc(C.db, COLECAO, x.id), { fotos: x.fotos.filter(n => !marcadas.has(n)) });
          U.toast("✅ Pronto. Agora toque em “✍️ Preencher à mão” no colégio e digite os dados da ficha.");
          fechar();
          if (depois) depois();
        } catch (e) {
          criar.disabled = false;
          C.handleErr(e);
        }
      });
      const linha = el("div", "quick");
      linha.append(ver, ate);
      p.append(s, linha, msg, grade);
      const ac = el("div", "actions");
      ac.append(criar, U.mkBtn("Cancelar", "", fechar));
      p.append(ac);
      desenhar();
    },
    { div: true, wide: true }
  );
}
