// Peças comuns a todos os módulos (Regras Gerais 4, 5 e 6):
// - confirmar(): janela Sim / Não antes de excluir, cancelar, avançar ou voltar status;
// - excluir(): o admin exclui de verdade (com registro); a equipe só PEDE: o item some para a equipe e
//   aparece para o Adriano como pendência ("Confirmar exclusão" / "Devolver ao sistema"). Nada some sem aprovação.
// Registro de cada pedido: coleção "exclusoes" = { col, docId, rotulo, resumo, por, porEmail, em, status }.
import { el, sheet } from "./ui.js";
import * as U from "./util.js";

// Janela Sim / Não. Devolve true se tocou em Sim.
export function confirmar(titulo, texto, { sim = "Sim", nao = "Não", perigo = false, extra = null } = {}) {
  return new Promise(res => {
    let decidiu = false;
    const fim = v => {
      if (decidiu) return;
      decidiu = true;
      res(v);
    };
    sheet(
      titulo,
      (p, close) => {
        if (texto) p.append(el("p", null, texto));
        if (extra) p.append(extra);
        const a = el("div", "panel-actions");
        const bN = el("button", "btn", nao);
        bN.type = "button";
        bN.onclick = () => {
          fim(false);
          close();
        };
        const bS = el("button", "btn " + (perigo ? "btn-danger" : "btn-primary"), sim);
        bS.type = "button";
        bS.onclick = () => {
          fim(true);
          close();
        };
        a.append(el("span"), bN, bS);
        a.firstChild.style.flex = "1";
        p.append(a);
        setTimeout(() => bN.focus(), 30);
      },
      { div: true, onClose: () => fim(false) }
    );
  });
}
// "Mudar de X para Y?"
export const confirmarStatus = (de, para) => confirmar("Mudar o status?", `Mudar de “${de}” para “${para}”?`);

// O item está pedido para exclusão (a equipe não vê; o admin vê a pendência)
export const pedidoExclusao = it => !!(it && it.excluido && it.excluido.em);
// (pedido de excluir só um ano: o item continua aparecendo)
export const ocultoParaMim = (C, it) => pedidoExclusao(it) && it.excluido.escopo !== "ano" && !C.isAdmin;

// Excluir (ou pedir a exclusão). o = { col, id, rotulo, resumo, apagar: async () => {}, titulo }
// apagar(): a exclusão de verdade (o admin, ou o admin ao confirmar a pendência); sem ela, apaga só o documento.
export async function excluir(C, o) {
  const { FS, db } = C;
  const ref = FS.doc(db, o.col, o.id);
  const texto =
    (o.resumo ? `Vai ser apagado: ${o.resumo}. ` : "") +
    (C.isAdmin ? "Não dá para desfazer." : "O Adriano recebe o pedido e confirma (ou devolve ao sistema).");
  if (
    !(await confirmar(o.titulo || "Excluir?", `${o.rotulo}. ${texto}`, {
      sim: C.isAdmin ? "Sim, excluir" : "Sim, pedir exclusão",
      perigo: true
    }))
  )
    return false;
  const agora = new Date().toISOString();
  if (C.isAdmin) {
    await (o.apagar ? o.apagar() : FS.deleteDoc(ref));
    await registrar(C, o, "excluido", agora);
    U.toast("Excluído");
    return true;
  }
  const pedido = { por: C.me || "", porEmail: C.email || "", em: agora };
  await FS.updateDoc(ref, { excluido: pedido });
  await FS.setDoc(FS.doc(db, "exclusoes", `${o.col}_${o.id}`), {
    col: o.col,
    docId: o.id,
    rotulo: o.rotulo || "",
    resumo: o.resumo || "",
    status: "pendente",
    ...pedido
  });
  U.toast("Pedido de exclusão enviado ao Adriano");
  return true;
}
async function registrar(C, o, status, agora) {
  try {
    await C.FS.setDoc(
      C.FS.doc(C.db, "exclusoes", `${o.col}_${o.id}`),
      {
        col: o.col,
        docId: o.id,
        rotulo: o.rotulo || "",
        resumo: o.resumo || "",
        status,
        decididoPor: C.me || "",
        decididoEm: agora,
        porEmail: C.email || "",
        em: agora
      },
      { merge: true }
    );
  } catch (e) {
    console.warn("[Z7] registro da exclusão", e);
  }
}

// Faixa na frente do card do item pedido para exclusão (só o admin vê): Confirmar exclusão / Devolver ao sistema.
// apagar(): como excluir de verdade (ex.: a instituição apaga também os alunos dela)
export function faixaExclusao(C, col, it, apagar) {
  if (!C.isAdmin || !pedidoExclusao(it)) return null;
  const x = it.excluido;
  const f = el("div", "pend-exclusao");
  f.append(el("b", null, `🗑️ ${U.first(x.por) || "Alguém da equipe"} pediu para excluir (${U.fmtDate(String(x.em).slice(0, 10))})`));
  const row = el("div", "row");
  row.append(
    U.mkBtn("Confirmar exclusão", "btn-danger", () => decidir(C, col, it, true, apagar)),
    U.mkBtn("Devolver ao sistema", "btn-ok", () => decidir(C, col, it, false))
  );
  f.append(row);
  return f;
}
export async function decidir(C, col, it, confirma, apagar) {
  const { FS, db } = C;
  const ref = FS.doc(db, col, it.id);
  const ok = await confirmar(
    confirma ? "Confirmar a exclusão?" : "Devolver ao sistema?",
    confirma ? "O item é apagado de verdade. Não dá para desfazer." : "O item volta a aparecer para a equipe, como estava.",
    { perigo: confirma }
  );
  if (!ok) return false;
  const agora = new Date().toISOString();
  try {
    if (confirma) await (apagar ? apagar() : FS.deleteDoc(ref));
    else await FS.updateDoc(ref, { excluido: FS.deleteField() });
    await FS.setDoc(
      FS.doc(db, "exclusoes", `${col}_${it.id}`),
      { status: confirma ? "excluido" : "devolvido", decididoPor: C.me || "", decididoEm: agora },
      { merge: true }
    );
    U.toast(confirma ? "Excluído" : "Devolvido ao sistema");
    return true;
  } catch (e) {
    C.handleErr(e);
    return false;
  }
}

// Regra 9: depois de abrir o WhatsApp, só marca "enviado" se a pessoa confirmar ao voltar para o app.
// (no computador o WhatsApp Web abre em outra aba: a pergunta aparece quando a aba do app volta a ficar visível)
export function perguntarSeEnviou(aoConfirmar, texto = "Você enviou a mensagem?") {
  let feito = false;
  const perguntar = async () => {
    if (feito || document.visibilityState !== "visible") return;
    feito = true;
    document.removeEventListener("visibilitychange", perguntar);
    window.removeEventListener("focus", perguntar);
    if (
      await confirmar(texto, "Só confirme se a mensagem saiu mesmo. Com “Não”, o botão continua aqui.", { sim: "Sim, enviei", nao: "Não" })
    )
      aoConfirmar();
  };
  // espera a pessoa sair para o WhatsApp antes de começar a ouvir a volta
  setTimeout(() => {
    document.addEventListener("visibilitychange", perguntar);
    window.addEventListener("focus", perguntar);
    // se o WhatsApp abriu dentro da mesma tela (ou não saiu dela), pergunta depois de alguns segundos
    setTimeout(() => document.hasFocus() && perguntar(), 4000);
  }, 600);
}

// Pede um texto obrigatório (ex.: o motivo do estorno ou do "Caído"). Devolve o texto ou null (cancelou).
export function pedirTexto(titulo, rotulo, { placeholder = "", ok = "Salvar" } = {}) {
  return new Promise(res => {
    let fim = false;
    const acaba = v => {
      if (fim) return;
      fim = true;
      res(v);
    };
    sheet(
      titulo,
      (p, close) => {
        const t = el("textarea");
        t.rows = 3;
        t.maxLength = 500;
        t.required = true;
        t.placeholder = placeholder;
        const f = el("div", "field");
        const l = el("label", null, rotulo);
        f.append(l, t);
        const a = el("div", "panel-actions");
        const bN = el("button", "btn", "Cancelar");
        bN.type = "button";
        bN.onclick = () => {
          acaba(null);
          close();
        };
        const bS = el("button", "btn btn-primary", ok);
        bS.type = "submit";
        a.append(el("span"), bN, bS);
        a.firstChild.style.flex = "1";
        p.append(f, a);
        p.addEventListener("submit", ev => {
          ev.preventDefault();
          if (!t.value.trim()) return;
          acaba(t.value.trim());
          close();
        });
        setTimeout(() => t.focus(), 30);
      },
      { onClose: () => acaba(null) }
    );
  });
}

// Pede uma data (padrão: hoje). Devolve "AAAA-MM-DD" ou null (cancelou). Ex.: "Paga por Pix" com a data do Pix.
export function pedirData(titulo, rotulo, { padrao = "", ok = "Salvar", max = "" } = {}) {
  return new Promise(res => {
    let fim = false;
    const acaba = v => {
      if (fim) return;
      fim = true;
      res(v);
    };
    sheet(
      titulo,
      (p, close) => {
        const t = el("input");
        t.type = "date";
        t.required = true;
        t.value = padrao;
        if (max) t.max = max;
        const f = el("div", "field");
        f.append(el("label", null, rotulo), t);
        const a = el("div", "panel-actions");
        const bN = el("button", "btn", "Cancelar");
        bN.type = "button";
        bN.onclick = () => {
          acaba(null);
          close();
        };
        const bS = el("button", "btn btn-primary", ok);
        bS.type = "submit";
        a.append(el("span"), bN, bS);
        a.firstChild.style.flex = "1";
        p.append(f, a);
        p.addEventListener("submit", ev => {
          ev.preventDefault();
          if (!/^\d{4}-\d{2}-\d{2}$/.test(t.value)) return;
          acaba(t.value);
          close();
        });
      },
      { onClose: () => acaba(null) }
    );
  });
}
