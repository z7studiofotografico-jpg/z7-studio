// "📤 Enviar prévias para o site" no topo de cada cartão de Instituições (particular, público, faculdade e curso):
// escolhe o colégio e o ano (os que têm alunos no PR ou na Formatura) e abre o envio das prévias em lote.
import { el, sheet } from "./ui.js";
import * as U from "./util.js";
import { gruposEscolas } from "./escolas-pr.js";
import { chaveColegio } from "./historico-dados.js";
import { mesmoColegio } from "./inst-janela.js";

// [{ colNome, g }] dos colégios deste cartão (insts), do ano mais recente ao mais antigo
export function gruposDoCartao(metas, insts) {
  const chaves = insts.map(i => chaveColegio(i.nome || "")).filter(Boolean);
  const out = [];
  metas.forEach(([colNome, meta]) =>
    gruposEscolas(meta || {}, {}, () => true).forEach(g => {
      if (chaves.some(k => mesmoColegio(g.chave, k))) out.push({ colNome, g });
    })
  );
  return out.sort((a, b) => b.g.ano - a.g.ano || a.g.nome.localeCompare(b.g.nome, "pt-BR"));
}

export function abrirEscolherPrevias(C, insts, nomeCartao) {
  sheet("📤 Enviar prévias para o site · " + nomeCartao, async (p, close) => {
    p.append(
      el(
        "p",
        "hint",
        "Escolha o colégio e o ano. Depois, no computador, escolha a pasta do colégio no servidor (uma pasta por aluno): o app faz a prévia de cada aluno e grava no site."
      )
    );
    const info = el("p", "hint", "Carregando os colégios…");
    p.append(info);
    const ler = async n => {
      try {
        const s = await C.FS.getDoc(C.FS.doc(C.db, "config", n));
        return s.exists() ? s.data() : {};
      } catch (_) {
        return {};
      }
    };
    const lista = gruposDoCartao(
      [
        ["repasse", await ler("repasse_meta")],
        ["formaturaAlunos", await ler("formatura_meta")]
      ],
      insts
    );
    if (!lista.length) {
      info.textContent = "Nenhum colégio deste cartão tem alunos importados ainda. Importe a planilha dos alunos primeiro.";
      p.append(U.mkBtn("Fechar", "", close));
      return;
    }
    info.remove();
    const sel = el("select");
    sel.setAttribute("aria-label", "Colégio e ano");
    lista.forEach(({ colNome, g }, i) => {
      const o = el("option", null, `${g.ano} · ${g.nome} · ${colNome === "formaturaAlunos" ? "Formatura" : "PR"} (${g.n} alunos)`);
      o.value = String(i);
      sel.append(o);
    });
    const f = el("div", "field");
    f.append(el("label", null, "Colégio e ano"), sel);
    const acoes = el("div", "panel-actions");
    acoes.append(
      U.mkBtn("Fechar", "", close),
      U.mkBtn("Continuar", "btn-primary", async () => {
        const { colNome, g } = lista[Number(sel.value)];
        close();
        const m = await import("./previas-lote.js");
        m.abrirPreviasLote(C, { site: { colNome, col: { nome: g.nome, ano: g.ano } } });
      })
    );
    p.append(f, acoes);
  });
}
