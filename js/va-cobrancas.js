// Formaturas → Venda Antecipada → Cobranças (18/11/2026: no mesmo desenho das outras listas do app).
// Em cima: a busca (nome, ID ou telefone) e o colégio; os botões da régua ("📣 Lembretes de hoje" / "Todas do mês");
// embaixo, uma linha por aluno (ID, nome, colégio · turma · kit, a parcela e o selo). Tocar abre o cartão com os botões.
import { cobrarWa, registrarPagamento, pagaPorPix, umaVez, atrasado, retornoFormando } from "./turma.js";
import { linhasRetorno } from "./retorno.js";
import { brl, pagasDe, nParcelas, valorParcela, esperadas, ehKit01, quitado, vencDa, somar, recebido, emAberto } from "./regras.js";
import { etapaHoje, filtroLembretes } from "./va-regua.js";
import { linhaGenerica } from "./lista-compacta.js";
import { el, title } from "./ui.js";
import * as U from "./util.js";

let busca = "",
  colegio = "";

// o = { C, soHoje, mudarHoje, insts, abrirTurma, ajuda }
export function renderCobrancas(corpo, cob, o) {
  return lista(corpo, cob, o, { regua: true });
}

// Adesão (Kit 01) e Kits 02 a 05 (18/11/2026): a mesma lista, com todos os alunos (pagos ou não) e o total embaixo
export function renderAlunosVA(corpo, fs, o, tipo) {
  const itens = fs
    .slice()
    .sort((a, b) => String(a.codigo || "~").localeCompare(String(b.codigo || "~"), "pt-BR", { numeric: true }))
    .map(f => ({ f, venc: quitado(f) ? "" : vencDa(f, pagasDe(f) + 1) }));
  return lista(corpo, itens, o, {
    regua: false,
    vazio:
      tipo === "adesao"
        ? "Nenhuma adesão (Kit 01) ainda. Importe a planilha do colégio ou abra a turma e inclua os alunos."
        : "Nenhum kit vendido ainda. Importe a planilha do colégio ou abra a turma e inclua os alunos."
  });
}

function lista(corpo, cob, o, cfg) {
  const hoje = U.todayStr();
  if (!cob.length && !cfg.regua) return corpo.append(el("div", "empty", cfg.vazio));
  if (!cob.length) {
    const e = el("div", "empty");
    e.append(
      el("strong", null, "Nenhuma parcela para cobrar este mês ✓"),
      el("span", null, "Aqui aparecem as parcelas atrasadas e as que vencem até o fim do mês, de todas as turmas.")
    );
    corpo.append(e);
    return;
  }
  // busca e colégio (como no PR)
  const topo = el("div", "rbusca va-busca");
  const colBox = el("div"); // o colégio e, embaixo dele, a busca do colégio (como em todas as janelas)
  const q = el("input", "search");
  q.type = "search";
  q.placeholder = "Nome do aluno, ID ou telefone";
  q.setAttribute("aria-label", "Buscar aluno");
  q.value = busca;
  const cont = {};
  cob.forEach(({ f }) => (cont[f.instNome || "?"] = (cont[f.instNome || "?"] || 0) + 1));
  const sCol = el("select", "search");
  sCol.setAttribute("aria-label", "Colégio");
  const o0 = el("option", null, `Todos os colégios (${cob.length})`);
  o0.value = "";
  sCol.append(o0);
  Object.keys(cont)
    .sort((a, b) => a.localeCompare(b, "pt-BR"))
    .forEach(n => {
      const op = el("option", null, `${title(n)} (${cont[n]})`);
      op.value = n;
      sCol.append(op);
    });
  sCol.value = cont[colegio] ? colegio : "";
  colBox.append(sCol);
  topo.append(q, colBox);
  corpo.append(topo);
  const lista = el("div", "lc-lista");
  lista.className = "lc-lista";
  const desenhar = () => {
    lista.innerHTML = "";
    const t = U.chave(busca).trim(),
      dig = busca.replace(/\D/g, "");
    let l = cob.filter(
      ({ f }) =>
        (!colegio || (f.instNome || "?") === colegio) &&
        (!t ||
          U.chave(f.nome).includes(t) ||
          U.chave(f.codigo || "")
            .replace(/[^A-Z0-9]/g, "")
            .includes(t.replace(/[^A-Z0-9]/g, "")) ||
          (dig.length >= 4 && String(f.tel || "").includes(dig)))
    );
    if (cfg.regua) {
      const caixa = el("div");
      l = filtroLembretes(caixa, l, hoje, o.soHoje, o.mudarHoje);
      lista.append(caixa);
      if (!l) return;
    } else {
      // o total do que está na tela
      const fs = l.map(x => x.f);
      const atr = fs.filter(atrasado).length;
      lista.append(
        el(
          "p",
          "hint",
          `${fs.length} aluno${fs.length === 1 ? "" : "s"} · vendido ${brl(somar(fs.map(f => f.valor)))} · recebido ${brl(somar(fs.map(recebido)))} · em aberto ${brl(somar(fs.map(emAberto)))}${atr ? ` · ${atr} atrasado${atr > 1 ? "s" : ""}` : ""}`
        )
      );
    }
    if (!l.length) return lista.append(el("div", "empty", "Ninguém com esse nome ou colégio."));
    l.forEach(({ f, venc }) => lista.append(linha(f, venc, hoje, o)));
  };
  q.addEventListener("input", () => {
    busca = q.value;
    desenhar();
  });
  sCol.addEventListener("change", () => {
    colegio = sCol.value;
    desenhar();
  });
  corpo.append(lista);
  desenhar();
}

function linha(f, venc, hoje, o) {
  const at = atrasado(f);
  const et = etapaHoje(f, hoje);
  const pg = pagasDe(f);
  const q0 = quitado(f);
  const kit = (f.kit || (ehKit01(f) ? "Kit 01" : "Kit")).split(" · ")[0];
  return linhaGenerica({
    id: "cob-" + f.id,
    cor: at ? "vermelho" : q0 ? "azul" : "cinza",
    idAluno: f.codigo,
    titulo: title(f.nome),
    sub: [title(f.instNome), f.sala || f.serie, kit].filter(Boolean).join(" · "),
    passo: q0
      ? `${nParcelas(f)}/${nParcelas(f)} parcelas pagas ✓`
      : `Parcela ${pg + 1}/${nParcelas(f)} · ${brl(valorParcela(f, pg + 1))} · ${at ? "venceu" : "vence"} ${U.fmtDate(venc)}` +
        (et && !et.enviado ? ` · 📣 lembrete: ${et.txt}` : ""),
    passoCls: at ? "late" : q0 ? "" : "today",
    selo: at ? "ATRASADO" : q0 ? "QUITADO" : "EM DIA",
    card: () => cartao(f, venc, et, at, o)
  });
}

function cartao(f, venc, et, at, o) {
  const { C } = o;
  const e = el("article", "card " + (at ? "late" : "today"));
  const meta = el("div", "meta");
  [title(f.instNome), (ehKit01(f) ? "🎓 " : "📘 ") + (f.kit || (ehKit01(f) ? "Kit 01 · adesão" : "Kit")), f.serie, f.tel]
    .filter(Boolean)
    .forEach((t, i) => meta.append(el("span", "tag" + (i === 1 ? " svc" : ""), t)));
  e.append(meta);
  linhasRetorno(f).forEach(x => e.append(x));
  // régua: o lembrete de hoje (ou quando é o próximo)
  if (et)
    e.append(
      el(
        "div",
        "hint",
        et.enviado ? `✓ Lembrete “${et.txt}” já enviado · próximo em ${U.fmtDate(et.proxima)}` : `📣 Lembrete de hoje: ${et.txt}`
      )
    );
  const pg = pagasDe(f),
    emAtraso = esperadas(f, U.todayStr()) - pg;
  if (quitado(f)) e.append(el("div", "fu", `${nParcelas(f)}/${nParcelas(f)} parcelas pagas ✓ · ${brl(f.valor)}`));
  else
    e.append(
      el(
        "div",
        "fu " + (at ? "late" : "today"),
        `Parcela ${pg + 1}/${nParcelas(f)} · ${brl(valorParcela(f, pg + 1))} · ${at ? "venceu" : "vence"} ${U.fmtDate(venc)}` +
          (at && emAtraso > 1 ? ` · ${emAtraso} em atraso` : "")
      )
    );
  const act = el("div", "actions");
  if (C.isAdmin && !quitado(f))
    act.append(
      U.mkBtn(
        "✅ Parcela paga",
        "btn-ok",
        umaVez(() => registrarPagamento(C, f))
      ),
      U.mkBtn(
        "💠 Paga por Pix",
        "",
        umaVez(() => pagaPorPix(C, f))
      )
    );
  if (f.tel && !quitado(f))
    act.append(
      U.mkBtn(et && !et.enviado ? "💬 Mandar lembrete" : "💬 Cobrar", at || (et && !et.enviado) ? "btn-primary" : "", () =>
        cobrarWa(C, f, et)
      )
    );
  act.append(o.ajuda(f));
  act.append(U.mkBtn("📅 Pediu contato depois", "", () => retornoFormando(C, f)));
  const inst = o.insts.find(i => i.id === f.instId);
  if (inst) act.append(U.mkBtn("Ver turma", "", () => o.abrirTurma(inst)));
  e.append(act);
  return e;
}
