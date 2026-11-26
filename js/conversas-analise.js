// 💬 Conversas e dúvidas (26/11/2026, só o Adriano): o que os clientes perguntam e o que trava a venda.
// 1) As dúvidas e objeções marcadas pelos vendedores (aba Conversa do aluno), com quantos desses compraram.
// 2) As conversas do WhatsApp exportadas, para baixar no computador e pedir ao Claude: "analisa as conversas".
import { el, sheet, title } from "./ui.js";
import * as U from "./util.js";
import { API_SITE } from "./site-previas.js";
import { OBJECOES } from "./conversas-wa.js";

const LISTAS = ["repasse", "formaturaAlunos"];
const VENDEU = ["PAGO", "ENTREGUE"];

// conta cada dúvida: quantos alunos, quantos compraram mesmo assim (o que ajuda a escrever a resposta certa)
export function contarObjecoes(alunos) {
  const m = new Map();
  alunos.forEach(a =>
    (a.objecoes || []).forEach(o => {
      const g = m.get(o) || { n: 0, vendeu: 0 };
      g.n++;
      if (VENDEU.includes(a.etapa)) g.vendeu++;
      m.set(o, g);
    })
  );
  return [...m.entries()].sort((a, b) => b[1].n - a[1].n || OBJECOES.indexOf(a[0]) - OBJECOES.indexOf(b[0]));
}

async function alunosComObjecoes(C) {
  const { FS, db } = C;
  const out = [];
  for (const col of LISTAS) {
    const s = await FS.getDocs(FS.query(FS.collection(db, col), FS.where("objecoes", "!=", null)));
    s.forEach(d => out.push(Object.assign({ id: d.id, col }, d.data())));
  }
  return out.filter(a => (a.objecoes || []).length);
}

async function chamar(C, q) {
  const t = await C.token();
  const r = await fetch(API_SITE + "/conversas.php" + q, { headers: { Authorization: "Bearer " + t } });
  if (!r.ok) throw new Error("Conversas: " + r.status);
  return r;
}
async function baixar(C, x) {
  const b = await (await chamar(C, "?baixar=" + encodeURIComponent(x.id))).blob();
  const a = document.createElement("a");
  const nome = `conversa ${x.codigo || ""} ${title(x.nome || "")} ${String(x.em || "").slice(0, 10)}`.replace(/[^\w À-ú-]+/g, " ").trim();
  a.href = URL.createObjectURL(b);
  a.download = nome.replace(/\s+/g, " ") + "." + (x.ext || "txt");
  document.body.append(a);
  a.click();
  setTimeout(() => (URL.revokeObjectURL(a.href), a.remove()), 4000);
}

export function abrirAnalise(C) {
  sheet(
    "💬 Conversas e dúvidas dos clientes",
    async (p, fechar) => {
      const carregando = el("p", "hint", "Carregando…");
      p.append(carregando);
      // 1) dúvidas e objeções
      try {
        const alunos = await alunosComObjecoes(C);
        const linhas = contarObjecoes(alunos);
        p.append(el("h3", null, "🏷️ Dúvidas e objeções"));
        if (!linhas.length) p.append(el("p", "hint", "Nenhuma marcada ainda. Os vendedores marcam na aba Conversa de cada aluno."));
        else {
          p.append(el("p", "hint", `${alunos.length} aluno${alunos.length === 1 ? "" : "s"} com dúvida marcada.`));
          const t = el("table", "rel-tab");
          const h = el("tr");
          ["Dúvida / objeção", "Alunos", "Compraram", "%"].forEach((c, i) => h.append(el("th", i ? "n" : null, c)));
          t.append(h);
          linhas.forEach(([o, g]) => {
            const r = el("tr");
            r.append(
              el("td", null, o),
              el("td", "n", String(g.n)),
              el("td", "n", String(g.vendeu)),
              el("td", "n", Math.round((100 * g.vendeu) / g.n) + "%")
            );
            t.append(r);
          });
          p.append(t);
        }
      } catch (e) {
        p.append(el("p", "hint", "Não consegui contar as dúvidas: " + e.message));
      }
      // 2) conversas exportadas do WhatsApp
      p.append(
        el("h3", null, "📎 Conversas do WhatsApp"),
        el(
          "p",
          "hint",
          "Baixe no computador e peça ao Claude: “analisa as conversas”. Ele lê, transcreve os áudios e devolve as dúvidas e as respostas."
        )
      );
      try {
        const { conversas = [] } = await (await chamar(C, "?lista=1")).json();
        const lista = conversas.filter(x => x.aluno !== "TESTE-apagar").reverse();
        if (!lista.length) p.append(el("p", "hint", "Nenhuma conversa ainda."));
        else {
          const box = el("div", "ja-dados");
          lista.forEach(x => {
            const d = el("div");
            const b = U.mkBtn("⬇️", "btn-sm", () => baixar(C, x).catch(e => C.handleErr(e)));
            b.title = "Baixar esta conversa";
            const sp = el(
              "span",
              null,
              `${x.codigo || ""} ${title(x.nome || "")} · ${x.ext === "zip" ? "com áudios" : "texto"} · ${Math.max(1, Math.round((x.tam || 0) / 1024))} KB `
            );
            sp.append(b);
            d.append(el("small", null, U.fmtDate(String(x.em || "").slice(0, 10))), sp);
            box.append(d);
          });
          const todas = U.mkBtn(`⬇️ Baixar todas (${lista.length})`, "btn-sm btn-primary", async () => {
            todas.disabled = true;
            for (const x of lista) await baixar(C, x).catch(e => C.handleErr(e));
            todas.disabled = false;
            U.toast("Conversas baixadas na pasta Downloads ✅");
          });
          p.append(todas, box);
        }
      } catch (e) {
        p.append(el("p", "hint", "Não consegui listar as conversas: " + e.message));
      }
      carregando.remove();
      const f = el("button", "btn", "Fechar");
      f.type = "button";
      f.onclick = fechar;
      const a = el("div", "actions");
      a.append(f);
      p.append(a);
    },
    { div: true, wide: true }
  );
}
