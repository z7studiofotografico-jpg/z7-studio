// Instituições: lista compacta (uma linha por colégio) e a janela do colégio, no mesmo formato do PR e da Formatura.
// Tocar na linha abre a janela com abas: Resumo (o cartão completo, com todos os botões) · Alunos (atalhos para os
// alunos do colégio no PR e na Formatura, por ano) · Agendamentos (dia de fotos, formatura, Paspatur e becas) · Visitas.
// A janela ouve o próprio colégio no banco: o que mudar (aqui ou em outro aparelho) aparece na hora.
import { el, title, sheet } from "./ui.js";
import * as U from "./util.js";
import { KINDS, linhaEvento, openEvento } from "./eventos.js";
import { chaveColegio } from "./historico-dados.js";
import { gruposEscolas } from "./escolas-pr.js";

// cor da linha: vermelho atrasado · amarelo hoje · verde fechado · apagado não fechou/arquivado · cinza o resto
export function corInst(it, s) {
  if (it.arquivado || it.etapa === "NÃO FECHOU") return "fim";
  if (it.etapa === "FECHADO" || s === "won") return "verde";
  if (s === "late") return "vermelho";
  if (s === "today") return "amarelo";
  return "cinza";
}

// o mesmo colégio nas listas do PR/Formatura: chave igual, ou uma contida na outra (nome mais curto na planilha)
export function mesmoColegio(chaveA, chaveB) {
  if (!chaveA || !chaveB) return false;
  if (chaveA === chaveB) return true;
  const [curta, longa] = chaveA.length < chaveB.length ? [chaveA, chaveB] : [chaveB, chaveA];
  return curta.length >= 5 && (" " + longa + " ").includes(" " + curta + " ");
}

// grupos (colégio + ano) do PR ou da Formatura que são deste colégio, do ano mais recente ao mais antigo
export function gruposDoColegio(meta, nome) {
  const ch = chaveColegio(nome || "");
  return gruposEscolas(meta || {}, {}, () => true).filter(g => mesmoColegio(g.chave, ch));
}

// uma linha da lista. o = { C, status, passo(it, s), abrir(it) }
export function linhaInst(it, o) {
  const s = o.status(it);
  const box = el("div", "lc-item");
  const l = el("button", "lc-linha lc-" + corInst(it, s));
  l.type = "button";
  l.setAttribute("aria-haspopup", "dialog");
  const nome = el("div", "lc-nome");
  nome.append(el("b", null, title(it.nome) || "Sem nome"));
  const quem = o.C.nomeDe(it) ? "👤 " + U.first(o.C.nomeDe(it)) : "Livre";
  const onde = [title(it.endereco?.bairro), title(it.endereco?.cidade)].filter(Boolean).join(" · ");
  nome.append(el("small", null, [quem, onde].filter(Boolean).join(" · ")));
  nome.append(el("small", "lc-passo" + (s === "late" ? " late" : s === "today" ? " today" : ""), o.passo(it, s)));
  l.append(nome, el("span", "lc-selo", it.arquivado ? "ARQUIVADA" : it.etapa || ""));
  l.onclick = () => o.abrir(it);
  box.append(l);
  return box;
}

const ABAS = [
  ["resumo", "Resumo"],
  ["alunos", "Alunos"],
  ["agenda", "Agendamentos"],
  ["visitas", "Visitas"]
];
let abaAtual = "resumo";

// o = { C, card(it), passo(it, s), status(it), visita(it) }
export function abrirJanelaInst(it0, o) {
  const { C } = o;
  let it = it0;
  let unsub = null;
  sheet(
    null,
    (p, close) => {
      p.classList.add("janela-aluno");
      const topo = el("div", "ja-topo");
      const abas = el("div", "ja-abas");
      abas.setAttribute("role", "tablist");
      const corpo = el("div", "ja-corpo");
      p.append(topo, abas, corpo);
      const desenhar = () => {
        topo.innerHTML = "";
        const nome = el("div", "ja-nome");
        nome.append(
          el("h2", null, title(it.nome) || "Sem nome"),
          el(
            "small",
            null,
            [o.C.nomeDe(it) ? "👤 " + U.first(o.C.nomeDe(it)) : "Livre", title(it.endereco?.bairro), title(it.endereco?.cidade)]
              .filter(Boolean)
              .join(" · ")
          )
        );
        topo.append(
          U.mkBtn("‹ Voltar para a lista", "btn-sm", close),
          nome,
          el("span", "lc-selo ja-selo", it.arquivado ? "ARQUIVADA" : it.etapa || "")
        );
        abas.innerHTML = "";
        ABAS.forEach(([k, t]) => {
          const b = el("button", "chip", t);
          b.type = "button";
          b.setAttribute("role", "tab");
          b.setAttribute("aria-selected", String(abaAtual === k));
          b.setAttribute("aria-pressed", String(abaAtual === k));
          b.onclick = () => {
            abaAtual = k;
            desenhar();
          };
          abas.append(b);
        });
        corpo.innerHTML = "";
        if (abaAtual === "resumo") corpo.append(o.card(it));
        else if (abaAtual === "alunos") alunos(corpo, it, C, close);
        else if (abaAtual === "agenda") agenda(corpo, it, C);
        else visitas(corpo, it, o);
      };
      desenhar();
      try {
        unsub = C.FS.onSnapshot(
          C.FS.doc(C.db, "instituicoes", it.id),
          s => {
            if (!s.exists()) return close();
            it = Object.assign({ id: s.id }, s.data());
            // não redesenha a aba Alunos (ela busca no banco) a cada mudança do colégio
            if (abaAtual !== "alunos") desenhar();
          },
          () => {}
        );
      } catch (_) {}
    },
    { div: true, wide: true, onClose: () => unsub && unsub() }
  );
}

// Alunos: quantos alunos o colégio tem em cada ano, no PR e na Formatura, com o atalho para a lista deles
async function alunos(box, it, C, fechar) {
  box.append(el("p", "hint", "Os alunos deste colégio, por ano. Toque em “Ver alunos” para abrir a lista deles."));
  const lista = el("div", "lc-lista grid");
  box.append(lista);
  lista.append(el("p", "hint", "Carregando…"));
  const ano = new Date().getFullYear();
  const ler = async nome => {
    try {
      const s = await C.FS.getDoc(C.FS.doc(C.db, "config", nome));
      return s.exists() ? s.data() : {};
    } catch (_) {
      return {};
    }
  };
  const fontes = [];
  if (C.pode("lf") || C.pode("rep")) fontes.push(["pr", "PR", await ler("repasse_meta")]);
  if (C.pode("formaturas")) fontes.push(["formatura", "Formatura", await ler("formatura_meta")]);
  lista.innerHTML = "";
  let n = 0;
  fontes.forEach(([k, nomeFonte, meta]) => {
    gruposDoColegio(meta, it.nome).forEach(g => {
      // PR: este ano é a Linha de Frente; os anteriores, o Repasse (a equipe pode não ter acesso ao Repasse)
      const segPR = g.ano >= ano ? "lf" : "rep";
      const pode = k === "formatura" || C.pode(segPR);
      const frente = k === "formatura" ? "Formatura" : segPR === "lf" ? "PR · Linha de Frente" : "PR · Repasse";
      const linha = el("div", "lc-linha lc-" + (g.ano >= ano ? "azul" : "cinza"));
      const nm = el("div", "lc-nome");
      nm.append(el("b", null, `${g.ano} · ${frente}`), el("small", null, `${g.n} aluno${g.n === 1 ? "" : "s"} · ${title(it.nome)}`));
      linha.append(nm);
      if (pode)
        linha.append(
          U.mkBtn("Ver alunos", "btn-sm btn-primary", () =>
            irParaAlunos(C, { formatura: k === "formatura", seg: segPR, valor: g.valor, rotulo: g.rotulo }, fechar)
          )
        );
      lista.append(linha);
      n++;
    });
  });
  if (!n)
    lista.append(
      el(
        "div",
        "empty",
        fontes.length
          ? "Nenhum aluno deste colégio no PR ou na Formatura ainda. Se o nome na planilha for muito diferente, procure pelo nome na Busca do PR."
          : "Você não tem acesso às listas de alunos."
      )
    );
}

// abre o PR (ou a Formatura) já na Busca, com este colégio e ano escolhidos
async function irParaAlunos(C, pedido, fechar) {
  try {
    const m = await import("./repasse.js");
    m.pedirEscola(pedido);
    if (pedido.formatura) {
      const f = await import("./formaturas.js");
      f.irParte("lf");
    }
    fechar();
    C.ir(pedido.formatura ? "#formaturas" : "#pr");
  } catch (e) {
    C.handleErr(e);
  }
}

// Agendamentos: as datas do colégio (cada uma com aprovação da Luciana) e o botão para marcar ou mudar
function agenda(box, it, C) {
  box.append(el("p", "hint", "As datas deste colégio. A data fica segurada na agenda até a Luciana aprovar."));
  Object.keys(KINDS).forEach(k => {
    const K = KINDS[k];
    const ev = it[K.campo];
    const linha = el("div", "ja-ev");
    linha.append(linhaEvento(it, k) || el("div", "fu none", `${K.ico} ${K.nome}: sem data marcada`));
    linha.append(U.mkBtn(ev && ev.data ? "Ver / mudar" : "Marcar data", "btn-sm", () => openEvento(it, k)));
    box.append(linha);
  });
  if (C.pode("agenda")) box.append(U.mkBtn("📅 Abrir a Agenda", "", () => C.ir("#agenda")));
}

// Visitas: todas as visitas e contatos registrados, da mais nova para a mais antiga
function visitas(box, it, o) {
  box.append(U.mkBtn("📝 Registrar visita / contato", "btn-primary", () => o.visita(it)));
  const vs = it.visitas || [];
  if (!vs.length) return box.append(el("div", "empty", "Nenhuma visita registrada ainda."));
  const ano = U.todayStr().slice(0, 4);
  vs.forEach(v => {
    const quando = v.data ? U.fmtDate(v.data) + (v.data.slice(0, 4) !== ano ? "/" + v.data.slice(0, 4) : "") : "";
    const cab = [quando, v.por ? U.first(v.por) : "planilha", v.falouCom ? "falou com " + v.falouCom : "", v.resultado || ""]
      .filter(Boolean)
      .join(" · ");
    const linhas = [cab];
    if (v.apresentou && v.apresentou.length)
      linhas.push("Apresentou: " + v.apresentou.map(p => `${p.nome} ${U.money(p.preco)}`).join(", "));
    if (v.obs) linhas.push(v.obs);
    box.append(el("p", "notes", linhas.join("\n")));
  });
}
