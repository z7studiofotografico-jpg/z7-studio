// (19/11/2026) Histórico de alterações: quem criou, mudou ou apagou o quê no Aluguel de becas, nos contratos e na
// Agenda. Cada gravação do app nessas coleções deixa um registro em "historico" (só o nome dos campos, sem os
// valores: nada de telefone ou dado do aluno). Só o admin lê, em Ajustes → 📜 Histórico de alterações.
// (As gravações em lote, como a importação de planilha, têm o registro da própria importação.)
import { el, sheet, title } from "./ui.js";
import * as U from "./util.js";

export const COLECAO = "historico";
// coleções acompanhadas (a 1ª parte do caminho; os pagamentos ficam dentro do contrato)
export const ACOMPANHADAS = ["alugueis", "becas", "contratosColegio", "contratos", "agenda", "ensaios", "instituicoes"];
const NOMES = {
  alugueis: "Aluguel · aluno",
  becas: "Aluguel avulso",
  contratosColegio: "Contrato do colégio",
  contratos: "Contrato da formatura",
  agenda: "Agenda",
  ensaios: "Agenda · ensaio",
  instituicoes: "Colégio"
};

// caminho de um documento ("alugueis/abc" ou "contratosColegio/x/pagamentos/y"), do Firebase ou do teste
export function caminho(ref) {
  if (!ref) return "";
  if (ref.path) return String(ref.path);
  return ref.n && ref.id ? ref.n + "/" + ref.id : "";
}
// o registro (ou null se a coleção não é acompanhada); acao = criou | mudou | apagou
export function registro(path, acao, dados, quem) {
  const partes = String(path || "").split("/");
  if (partes.length < 2 || !ACOMPANHADAS.includes(partes[0])) return null;
  const campos = Object.keys(dados && typeof dados === "object" ? dados : {})
    .filter(k => k !== "atualizadoEm")
    .slice(0, 30);
  const st = dados && typeof dados.status === "string" ? dados.status.slice(0, 40) : "";
  return {
    col: partes[0],
    doc: partes.slice(1).join("/").slice(0, 300),
    acao,
    campos,
    status: st,
    por: String(quem.nome || "").slice(0, 80),
    porEmail: quem.email || "",
    em: new Date().toISOString()
  };
}
// grava o registro sem atrapalhar quem gravou (se falhar, só avisa no console)
export function registrar(FS, db, path, acao, dados, quem) {
  const r = registro(path, acao, dados, quem);
  if (!r || !quem.email) return;
  FS.addDoc(FS.collection(db, COLECAO), r).catch(e => console.warn("[Z7] histórico de alterações", e));
}

// Ajustes → 📜 Histórico de alterações (admin): os últimos 300, do mais novo para o mais antigo
export async function abrirHistorico(C) {
  const { FS, db } = C;
  const s = await FS.getDocs(FS.query(FS.collection(db, COLECAO), FS.orderBy("em", "desc"), FS.limit(300)));
  const itens = s.docs.map(d => d.data());
  sheet(
    "📜 Histórico de alterações",
    p => {
      p.append(el("p", "hint", "Quem criou, mudou ou apagou no Aluguel de becas, nos contratos e na Agenda (os 300 mais recentes)."));
      const q = el("input", "search");
      q.type = "search";
      q.placeholder = "Procurar por pessoa, campo ou tipo";
      p.append(q);
      const lista = el("div", "eb-datas");
      const desenhar = () => {
        lista.innerHTML = "";
        const t = U.chave(q.value || "");
        const vis = itens.filter(
          x => !t || U.chave([x.por, x.porEmail, NOMES[x.col], x.acao, (x.campos || []).join(" "), x.status].join(" ")).includes(t)
        );
        if (!vis.length) lista.append(el("p", "hint", "Nada encontrado."));
        vis.forEach(x => {
          const l = el("div", "eb-data");
          const dt = el("div", "eb-dia");
          dt.append(el("b", null, U.fmtDate((x.em || "").slice(0, 10))), el("small", null, (x.em || "").slice(11, 16)));
          const tx = el("div", "eb-txt");
          tx.append(
            el("span", null, `${title(x.por || x.porEmail || "?")} ${x.acao} · ${NOMES[x.col] || x.col}`),
            el(
              "small",
              null,
              [x.status && "status: " + x.status, (x.campos || []).length ? "campos: " + x.campos.join(", ") : ""]
                .filter(Boolean)
                .join(" · ")
            )
          );
          l.append(dt, tx);
          lista.append(l);
        });
      };
      q.oninput = desenhar;
      desenhar();
      p.append(lista);
    },
    { div: true, wide: true }
  );
}
