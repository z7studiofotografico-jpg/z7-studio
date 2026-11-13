// 📋 Alunos por colégio: escolhe o colégio (e o ano) e marca o que sai na lista. Sai em ordem de ID,
// para imprimir (ou salvar em PDF) ou como planilha. A escolha das colunas fica guardada para a próxima vez.
import { el, sheet, field, title } from "./ui.js";
import * as U from "./util.js";
import { gruposEscolas, escolhaDe } from "./escolas-pr.js";
import { ordemCodigo } from "./aluno-id.js";
import { linhasPlanilha, TEL_ALUNO, COLUNAS_CONTATOS, COLUNAS_ENDERECO } from "./cadastro-regras.js";
import { abrirRelatorio } from "./relatorio.js";

// [campo, título, já vem marcado?]
export const COLUNAS_RELATORIO = [
  ["codigo", "ID", true],
  ["nome", "Aluno", true],
  [TEL_ALUNO[0], TEL_ALUNO[1], true],
  ["turma", "Turma", true],
  ["nascimento", "Nascimento", false],
  ["email", "E-mail", false],
  ...COLUNAS_CONTATOS.map(([k, t]) => [k, t, k.startsWith("c:Mãe") || k.startsWith("c:Responsável")]),
  ...COLUNAS_ENDERECO.map(([k, t]) => [k, t, false]),
  ["vendaComo", "Kit", false],
  ["etapa", "Etapa", true],
  ["resp", "Responsável na equipe", false],
  ["valor", "Valor", false],
  ["formaPag", "Forma de pagamento", false],
  ["pagoEm", "Pago em", false],
  ["obs", "Observação", false]
];
const GUARDA = "z7relAlunosCols";
function colunasGuardadas() {
  try {
    const v = JSON.parse(localStorage.getItem(GUARDA) || "null");
    if (Array.isArray(v) && v.length) return new Set(v);
  } catch (_) {}
  return new Set(COLUNAS_RELATORIO.filter(c => c[2]).map(c => c[0]));
}
function guardarColunas(set) {
  try {
    localStorage.setItem(GUARDA, JSON.stringify([...set]));
  } catch (_) {}
}

// as colunas marcadas, na ordem da lista acima
export const colunasEscolhidas = set => COLUNAS_RELATORIO.filter(c => set.has(c[0])).map(([k, t]) => [k, t]);

// tabela do relatório: os alunos em ordem de ID; nome com letra maiúscula, telefone como está
export function tabelaAlunos(alunos, campos) {
  const [cab, ...linhas] = linhasPlanilha([...alunos].sort(ordemCodigo), campos);
  const iNome = campos.findIndex(c => c[0] === "nome");
  if (iNome >= 0) linhas.forEach(l => (l[iNome] = title(l[iNome])));
  return { cols: cab, linhas: linhas.map(l => l.map(v => (v == null ? "" : String(v)))) };
}

async function alunosDe(C, colNome, escolha) {
  const out = [];
  for (let i = 0; i < escolha.nomes.length; i += 30) {
    const s = await C.FS.getDocs(
      C.FS.query(
        C.FS.collection(C.db, colNome),
        C.FS.where("escola", "in", escolha.nomes.slice(i, i + 30)),
        ...(escolha.ano ? [C.FS.where("ano", "==", escolha.ano)] : [])
      )
    );
    s.forEach(d => out.push(Object.assign({ id: d.id }, d.data())));
  }
  return out.filter(x => !x.historico);
}

// o = { C, colNome ("repasse" | "formaturaAlunos"), meta (config/..._meta), cadastro (nomes do cadastro), escolha (valor já escolhido), nomeTipo }
export function abrirRelatorioAlunos(o) {
  const { C, colNome } = o;
  const grupos = gruposEscolas(o.meta || {}, o.cadastro || {});
  const marcadas = colunasGuardadas();
  sheet(
    "📋 Alunos por colégio",
    (p, fechar) => {
      p.append(el("p", "hint", "Escolha o colégio e marque o que sai na lista. Os alunos saem em ordem de ID."));
      const busca = el("input");
      busca.type = "search";
      busca.placeholder = "Procurar colégio (ex.: ciep 433)";
      const s = el("select");
      s.id = "relAlunosEscola";
      const pintar = () => {
        const q = U.chave(busca.value);
        const cur = s.value || o.escolha || "";
        s.innerHTML = "";
        const z = el("option", null, grupos.length ? "Escolha o colégio" : "Nenhum colégio na lista");
        z.value = "";
        s.append(z);
        grupos
          .filter(g => !q || q.split(/\s+/).every(w => U.chave(g.rotulo).includes(w)))
          .forEach(g => {
            const op = el("option", null, `${g.rotulo} (${g.n})`);
            op.value = g.valor;
            s.append(op);
          });
        s.value = [...s.options].some(x => x.value === cur) ? cur : q && s.options.length > 1 ? s.options[1].value : "";
      };
      busca.oninput = pintar;
      pintar();
      p.append(field("Colégio", busca), s);

      p.append(el("h4", null, "O que sai na lista"));
      const cx = el("div", "rel-cols");
      COLUNAS_RELATORIO.forEach(([k, t]) => {
        const l = el("label", "chk");
        const c = el("input");
        c.type = "checkbox";
        c.checked = marcadas.has(k);
        c.dataset.campo = k;
        c.onchange = () => {
          if (c.checked) marcadas.add(k);
          else marcadas.delete(k);
          guardarColunas(marcadas);
        };
        l.append(c, document.createTextNode(" " + t));
        cx.append(l);
      });
      const marcarTudo = sim => {
        cx.querySelectorAll("input").forEach(c => {
          c.checked = sim;
          if (sim) marcadas.add(c.dataset.campo);
          else marcadas.delete(c.dataset.campo);
        });
        guardarColunas(marcadas);
      };
      const atalhos = el("div", "row");
      atalhos.append(
        U.mkBtn("Marcar tudo", "btn-sm", () => marcarTudo(true)),
        U.mkBtn("Desmarcar tudo", "btn-sm", () => marcarTudo(false))
      );
      p.append(atalhos, cx);

      const msg = el("p", "hint");
      const gerar = async modo => {
        const escolha = escolhaDe(s.value, grupos);
        if (!escolha) return U.toast("Escolha o colégio primeiro.");
        const campos = colunasEscolhidas(marcadas);
        if (!campos.length) return U.toast("Marque pelo menos uma coluna.");
        msg.textContent = "Carregando os alunos…";
        try {
          const alunos = await alunosDe(C, colNome, escolha);
          msg.textContent = "";
          if (!alunos.length) return U.toast("Nenhum aluno desse colégio.");
          if (modo === "planilha") {
            const m = await import("./cadastro-aluno.js");
            const nome =
              "alunos-" +
              U.chave(escolha.rotulo)
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-|-$/g, "");
            return m.baixarPlanilha(nome, [...alunos].sort(ordemCodigo), campos);
          }
          fechar();
          abrirRelatorio(
            {
              titulo: "Alunos · " + escolha.rotulo,
              subtitulo: [o.nomeTipo, alunos.length + (alunos.length === 1 ? " aluno" : " alunos"), "em ordem de ID"]
                .filter(Boolean)
                .join(" · "),
              secoes: [{ tabela: tabelaAlunos(alunos, campos), vazio: "Nenhum aluno." }]
            },
            C.me
          );
        } catch (e) {
          msg.textContent = "";
          console.warn("[Z7] alunos por colégio", e);
          U.toast("Não foi possível carregar os alunos agora.");
        }
      };
      const acoes = el("div", "actions");
      acoes.append(
        U.mkBtn("🖨️ Imprimir ou PDF", "btn-primary", () => gerar("imprimir")),
        U.mkBtn("⬇️ Planilha", "", () => gerar("planilha")),
        U.mkBtn("Fechar", "", fechar)
      );
      p.append(msg, acoes);
    },
    { div: true }
  );
}
