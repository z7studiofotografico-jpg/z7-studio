// (19/11/2026) Agendamento ligado ao sistema todo. Na janela do agendamento (Agenda → colégio):
// ① "Becas deste agendamento": as becas que saem na entrega e voltam na devolução (por modelo e tamanho, faixas e
//    capelos), preenchidas pelos alunos do Aluguel de becas ou à mão, com o estoque livre no período e o aviso de falta
//    (outros colégios e avulsos nos mesmos dias). Gravado no próprio agendamento ("becas") e na cópia do estoque
//    (becasUso "evento_<colégio>_<campo>"), que o Aluguel de becas conta pelas datas.
// ② "Este colégio no sistema": as datas agendadas e os atalhos para o Aluguel de becas, o PR e a Formatura.
import { el, field, title, gradeQtd } from "./ui.js";
import * as U from "./util.js";
import { BECAS, TAMANHOS, FAIXAS, CAPELOS, semTamanho, tamanhoBeca } from "./becas-estoque.js";
import { USO, idEvento, usoDeEvento, usoNoPeriodo, conferirPedido, pedidoDosAlunos } from "./becas-uso.js";

const n0 = v => Number(v) || 0;
const soma = o => Object.values(o || {}).reduce((s, v) => s + n0(v), 0);
const maisDias = (d, n) => {
  const x = new Date(d + "T12:00:00");
  x.setDate(x.getDate() + n);
  return U.ds(x);
};
const ehBecas = kind => /^becas\d*$/.test(kind);

// os alunos do aluguel deste colégio no ano (a equipe só lê os do contrato dela)
async function alunosDoColegio(C, it, ano) {
  const { FS, db } = C;
  const f = [FS.where("instId", "==", it.id)];
  if (!C.isAdmin) f.push(FS.where("respEmail", "==", C.email));
  try {
    const s = await FS.getDocs(FS.query(FS.collection(db, "alugueis"), ...f, FS.limit(3000)));
    return s.docs.map(d => Object.assign({ id: d.id }, d.data())).filter(a => !a.excluido && String(a.ano) === String(ano));
  } catch (_) {
    return [];
  }
}
// a 1ª formatura do colégio depois do dia da entrega (a devolução sugerida é o dia seguinte)
function formaturaDepois(it, dia) {
  return Object.keys(it)
    .filter(k => /^formatura\d*$/.test(k) && it[k] && it[k].data && it[k].status !== "recusado" && it[k].data >= dia)
    .map(k => it[k].data)
    .sort()[0];
}

export function blocoBecasEvento(C, it, kind, ev, campo, fechar) {
  if (!ehBecas(kind) || !C.pode("becas")) return null;
  const box = el("div", "imp");
  box.append(el("h3", null, "👘 Becas deste agendamento"));
  box.append(el("p", "hint", "As becas saem na entrega e voltam na devolução. O estoque conta esses dias."));
  const b0 = (ev && ev.becas) || {};
  const dia = (ev && ev.data) || U.todayStr();
  const ano = dia.slice(0, 4);
  // ① alunos do Aluguel de becas
  const alInfo = el("div", "eb-alunos", "Carregando os alunos do Aluguel de becas…");
  box.append(alInfo);
  // ② datas
  const ret = el("input");
  ret.type = "date";
  ret.value = b0.retirada || dia;
  const dev = el("input");
  dev.type = "date";
  const fm = formaturaDepois(it, ret.value);
  dev.value = b0.devolucao || (fm ? maisDias(fm, 1) : "");
  const r = el("div", "row2");
  r.append(field("Saída das becas (entrega)", ret), field("Devolução (recolher)", dev));
  box.append(r);
  if (!b0.devolucao)
    box.append(
      el(
        "p",
        "hint eb-dica",
        fm ? `💡 Devolução sugerida: o dia seguinte à formatura (${U.fmtDate(fm)}).` : "💡 Coloque o dia de recolher as becas."
      )
    );
  // ③ quantidades: modelo e tamanho (o total do modelo é a soma dos tamanhos), faixas e capelos
  const E = C.P.estoque || {};
  const grades = {};
  const totais = {};
  const qBox = el("div", "eb-qtd");
  qBox.append(el("div", "eb-sub", "Quantidades"));
  BECAS.forEach(([tp, nome]) => {
    const tem = n0((E.becas || {})[tp]) || n0((b0.becasQtd || {})[tp]);
    if (!tem) return;
    const d = el("details", "tamtipo");
    const sm = el("summary", null, nome);
    d.append(sm);
    if (semTamanho(tp)) {
      const g = gradeQtd([[tp, "Quantidade (tamanho único)"]], { [tp]: (b0.becasQtd || {})[tp] }, { aoMudar: () => atualizar() });
      grades[tp] = { unico: g.ins[0][1] };
      d.append(g.box);
    } else {
      const g = gradeQtd(TAMANHOS, (b0.tamanhosQtd || {})[tp] || {}, {
        texto: (z, t) => `${t} · estoque ${n0(((E.tamanhos || {})[tp] || {})[z])}`,
        aoMudar: () => atualizar()
      });
      grades[tp] = { tams: g.ins };
      d.append(g.box);
    }
    totais[tp] = sm;
    qBox.append(d);
  });
  const dF = el("details", "tamtipo");
  const smF = el("summary", null, "Faixas");
  const gF = gradeQtd(
    FAIXAS.filter(([k]) => n0((E.faixas || {})[k]) || n0((b0.faixasQtd || {})[k])),
    b0.faixasQtd || {},
    { aoMudar: () => atualizar() }
  );
  dF.append(smF, gF.box);
  const dC = el("details", "tamtipo");
  const smC = el("summary", null, "Capelos");
  const gC = gradeQtd(CAPELOS, b0.capelosQtd || {}, { aoMudar: () => atualizar() });
  dC.append(smC, gC.box);
  qBox.append(dF, dC);
  box.append(qBox);
  const ler = () => {
    const p = { becasQtd: {}, tamanhosQtd: {}, faixasQtd: {}, capelosQtd: {} };
    Object.entries(grades).forEach(([tp, g]) => {
      if (g.unico) p.becasQtd[tp] = n0(g.unico.value);
      else {
        const t = {};
        g.tams.forEach(([z, q]) => n0(q.value) && (t[z] = n0(q.value)));
        p.tamanhosQtd[tp] = t;
        p.becasQtd[tp] = soma(t);
      }
    });
    gF.ins.forEach(([k, q]) => n0(q.value) && (p.faixasQtd[k] = n0(q.value)));
    gC.ins.forEach(([k, q]) => n0(q.value) && (p.capelosQtd[k] = n0(q.value)));
    return p;
  };
  const preencher = p => {
    Object.entries(grades).forEach(([tp, g]) => {
      if (g.unico) g.unico.value = n0((p.becasQtd || {})[tp]) || "";
      else g.tams.forEach(([z, q]) => (q.value = n0(((p.tamanhosQtd || {})[tp] || {})[z]) || ""));
    });
    gF.ins.forEach(([k, q]) => (q.value = n0((p.faixasQtd || {})[k]) || ""));
    gC.ins.forEach(([k, q]) => (q.value = n0((p.capelosQtd || {})[k]) || ""));
    atualizar();
  };
  // ④ estoque no período
  const est = el("div", "est-periodo");
  box.append(est);
  let copias = null;
  C.FS.getDocs(C.FS.collection(C.db, USO))
    .then(s => {
      copias = s.docs.map(d => Object.assign({ id: d.id }, d.data()));
      atualizar();
    })
    .catch(() => {
      est.textContent = "Não foi possível ler o estoque agora.";
    });
  function atualizar() {
    const p = ler();
    Object.entries(totais).forEach(([tp, sm]) => {
      const n = n0(p.becasQtd[tp]);
      sm.textContent = (BECAS.find(b => b[0] === tp) || [tp, tp])[1] + (n ? ` · ${n}` : "");
    });
    smF.textContent = "Faixas" + (soma(p.faixasQtd) ? ` · ${soma(p.faixasQtd)}` : "");
    smC.textContent = "Capelos" + (soma(p.capelosQtd) ? ` · ${soma(p.capelosQtd)}` : "");
    est.innerHTML = "";
    const total = soma(p.becasQtd);
    const topo = el("div", "eb-topo");
    topo.append(el("b", null, "📦 Estoque no período"));
    est.append(topo);
    const aviso = (cls, t) => est.append(el("p", "hint eb-vazio" + (cls ? " " + cls : ""), t));
    if (!copias) return aviso("", "Carregando o estoque…");
    if (!ret.value || !dev.value) return aviso("", "Escolha a saída e a devolução para conferir o estoque.");
    if (dev.value < ret.value) return aviso("err", "A devolução precisa ser depois da saída.");
    // os alunos deste colégio não contam contra ele (as becas deles são as deste agendamento)
    const semEste = copias.filter(c => !(c.tipo === "aluno" && c.instId === it.id && String(c.ano) === ano));
    const { uso, outros } = usoNoPeriodo(semEste, ret.value, dev.value, idEvento(it.id, campo));
    const linhas = conferirPedido(E, uso, p);
    topo.append(
      el("small", null, `${U.fmtDate(ret.value)} a ${U.fmtDate(dev.value)}${total ? ` · ${total} beca${total > 1 ? "s" : ""}` : ""}`)
    );
    if (!linhas.length) return aviso("", "Coloque as quantidades acima para conferir o estoque.");
    const faltam = linhas.filter(x => x.falta);
    topo.append(
      el(
        "span",
        "tag " + (faltam.length ? "late" : "ok"),
        faltam.length ? `⚠️ Falta ${faltam.length} item${faltam.length > 1 ? "s" : ""}` : "✅ Estoque OK"
      )
    );
    const tb = el("table", "eb-tab");
    const th = el("tr");
    ["Item", "Pede", "Livres", ""].forEach(t => th.append(el("th", null, t)));
    tb.append(th);
    linhas.forEach(x => {
      const tr = el("tr", x.falta ? "eb-falta" : "");
      tr.append(
        el("td", null, x.rot),
        el("td", "n", String(x.pede)),
        el("td", "n", String(x.livre)),
        el("td", "n", x.falta ? `faltam ${x.falta}` : "✓")
      );
      tb.append(tr);
    });
    est.append(tb);
    if (outros.length) {
      est.append(el("div", "eb-sub", "Também usando becas nesses dias"));
      const ul = el("div", "eb-outros");
      outros.forEach(o => {
        const l = el("div", "eb-outro");
        l.append(
          el("span", null, title(o.nome)),
          el("small", null, `${o.de ? `${U.fmtDate(o.de)} a ${o.ate ? U.fmtDate(o.ate) : "?"} · ` : ""}${o.n} beca${o.n === 1 ? "" : "s"}`)
        );
        ul.append(l);
      });
      est.append(ul);
    }
  }
  [ret, dev].forEach(i => i.addEventListener("change", atualizar));
  // ⑤ gravar (sem mexer na data do agendamento)
  const err = el("p", "err");
  err.hidden = true;
  // junto = gravado pelo botão do agendamento (só se mudou algo, e sem o aviso)
  let mexeu = false;
  box.addEventListener("change", () => (mexeu = true));
  async function gravar(junto) {
    err.hidden = true;
    const p = ler();
    if (junto && !mexeu) return;
    if (soma(p.becasQtd) && (!ret.value || !dev.value || dev.value < ret.value)) {
      err.textContent = "Coloque a saída e a devolução (a devolução depois da saída).";
      err.hidden = false;
      if (junto) U.toast("As becas não foram salvas: falta a devolução.");
      return;
    }
    const becas = Object.assign(p, { retirada: ret.value, devolucao: dev.value, atualizadoEm: new Date().toISOString(), por: C.me || "" });
    try {
      await C.FS.updateDoc(C.FS.doc(C.db, "instituicoes", it.id), { [campo + ".becas"]: becas, atualizadoEm: new Date().toISOString() });
      if (ev) ev.becas = becas; // o "Salvar" do agendamento mantém as becas
      await espelharEvento(C, it, campo, Object.assign({}, ev || { data: ret.value }, { becas }));
      mexeu = false;
      if (!junto) U.toast(soma(p.becasQtd) ? "Becas salvas ✅ (o estoque já conta essas datas)" : "Becas salvas");
      if (copias && !junto) {
        const s = await C.FS.getDocs(C.FS.collection(C.db, USO));
        copias = s.docs.map(d => Object.assign({ id: d.id }, d.data()));
        atualizar();
      }
    } catch (e) {
      C.handleErr(e);
    }
  }
  box._gravar = gravar;
  const pe = el("div", "eb-acoes");
  pe.append(U.mkBtn("💾 Salvar as becas", "btn-primary", () => gravar(false)));
  box.append(err, pe);
  // os alunos chegam depois (busca no banco)
  alunosDoColegio(C, it, ano).then(al => {
    alInfo.innerHTML = "";
    const vao = al.filter(a => !a.naoParticipa && !a.soPaspatur);
    const ped = pedidoDosAlunos(al);
    const comBeca = soma(ped.becasQtd);
    const ret2 = vao.filter(a => a.status === "Retirou a beca").length;
    const bt = el("div", "eb-bts");
    if (!al.length) {
      alInfo.className = "eb-alunos vazio";
      alInfo.append(
        el("b", null, `Nenhum aluno deste colégio no Aluguel de becas em ${ano}`),
        el("small", null, "Coloque as quantidades abaixo, ou importe a planilha (Agenda → 📥 Importação) para preencher sozinho.")
      );
    } else {
      alInfo.className = "eb-alunos";
      const nums = el("div", "eb-nums");
      [
        [vao.length, "alunos"],
        [comBeca, "com beca"],
        [ped.semMedida, "sem medida"],
        [ret2, "já retiraram"]
      ].forEach(([n, t], i) => {
        if (i > 1 && !n) return;
        const c = el("div", "eb-num" + (t === "sem medida" ? " alerta" : ""));
        c.append(el("b", null, String(n)), el("small", null, t));
        nums.append(c);
      });
      alInfo.append(nums);
      const tams = {};
      vao.filter(a => a.becaTipo).forEach(a => (tams[tamanhoBeca(a)] = (tams[tamanhoBeca(a)] || 0) + 1));
      const ch = el("div", "chips");
      Object.entries(tams).forEach(([t, n]) => ch.append(el("span", "tag", `${t}: ${n}`)));
      if (ch.children.length) alInfo.append(ch);
      if (comBeca) bt.append(U.mkBtn(`⬇️ Usar as quantidades dos alunos (${comBeca})`, "", () => preencher(ped)));
      // ainda sem nada gravado: já vem preenchido com os alunos
      if (!soma(b0.becasQtd) && comBeca) preencher(ped);
    }
    bt.append(U.mkBtn("👥 Ver os alunos do aluguel", "", () => irAluguel(C, it.id, ano, fechar)));
    alInfo.append(bt);
  });
  setTimeout(atualizar, 0);
  return box;
}

// monta os dois blocos no fim da janela do agendamento (p = a janela)
// ponto = o lugar reservado na janela (o import chega depois dos botões)
export function ligarSistema(C, ponto, p, it, kind, ev, campo, close) {
  const b = blocoBecasEvento(C, it, kind, ev, campo, close);
  if (b) {
    ponto.append(b);
    p._salvarBecas = () => b._gravar(true);
  }
  ponto.append(blocoColegio(C, it, campo, close));
}

// grava ou apaga a cópia do estoque do agendamento
export async function espelharEvento(C, it, campo, ev) {
  const ref = C.FS.doc(C.db, USO, idEvento(it.id, campo));
  const u = usoDeEvento(it, campo, ev);
  try {
    if (u) await C.FS.setDoc(ref, u);
    else await C.FS.deleteDoc(ref);
  } catch (e) {
    console.warn("[Z7] cópia do estoque do agendamento", e);
  }
}

async function irAluguel(C, instId, ano, fechar) {
  try {
    const m = await import("./aluguel-alunos.js");
    m.pedirColegio(instId, ano);
    if (fechar) fechar();
    document.querySelectorAll(".sheet:not([id])").forEach(x => x.remove()); // a janela do colégio por baixo (as fixas do Funil ficam)
    C.ir("#becas");
  } catch (e) {
    C.handleErr(e);
  }
}

// ② tudo o que o colégio tem no sistema: datas e atalhos
export function blocoColegio(C, it, campo, fechar) {
  const box = el("div", "imp");
  box.append(el("h3", null, "📋 Este colégio no sistema"));
  const datas = el("div", "eb-datas");
  const ICO = { formatura: "🎓", diaFotos: "📸", diaPaspatur: "🎞️", diaBecas: "👘" };
  Object.keys(it)
    .filter(k => /^(formatura|diaFotos|diaPaspatur|diaBecas)\d*$/.test(k) && it[k] && it[k].data && it[k].status !== "recusado")
    .sort((a, b) => (it[a].data < it[b].data ? -1 : 1))
    .forEach(k => {
      const x = it[k];
      const base = k.replace(/\d+$/, "");
      const nb = x.becas ? soma(x.becas.becasQtd) : 0;
      const l = el("div", "eb-data" + (k === campo ? " atual" : ""));
      const dt = el("div", "eb-dia");
      dt.append(el("b", null, U.fmtDate(x.data)), el("small", null, x.hora || ""));
      const tx = el("div", "eb-txt");
      tx.append(
        el("span", null, `${ICO[base] || "📅"} ${x.obs || (base === "formatura" ? "Formatura" + (x.local ? " · " + x.local : "") : base)}`),
        nb
          ? el("small", null, `👘 ${nb} becas até ${U.fmtDate(x.becas.devolucao)}`)
          : base === "diaBecas"
            ? el("small", "wait", "⚠️ sem as quantidades de becas")
            : el("small")
      );
      l.append(
        dt,
        tx,
        el("span", "tag " + (x.status === "confirmado" ? "ok" : "warn"), x.status === "confirmado" ? "Confirmado" : "Aguardando")
      );
      datas.append(l);
    });
  box.append(datas.children.length ? datas : el("p", "hint", "Nenhuma data marcada ainda."));
  const bt = el("div", "eb-bts");
  if (C.pode("becas"))
    bt.append(U.mkBtn("👘 Aluguel de becas", "", () => irAluguel(C, it.id, (it[campo]?.data || U.todayStr()).slice(0, 4), fechar)));
  bt.append(
    U.mkBtn("🏫 PR e Formatura (alunos)", "", async () => {
      const m = await import("./inst-janela.js");
      if (fechar) fechar();
      m.abrirAlunosDoColegio(C, it);
    })
  );
  box.append(bt);
  return box;
}
