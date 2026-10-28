// Agenda: janelinhas de marcar ensaio no estúdio e compromisso (separadas de agenda.js).
import { el, field, sheet, botoes, avisoErro } from "./ui.js";
import { lerReais } from "./regras.js";
import { feriado } from "./feriados.js";
import { nomeEvento } from "./instituicoes.js";
import * as U from "./util.js";
import { TIPOS_ENSAIO, diaTxt, min, fimDe, conflitosEm, resumoDiaEm, tipoDoLead } from "./agenda-tempo.js";
let C, FS, db, colE, estado;
// estado() → { ensaios, items, comps } da agenda aberta (para avisar de horário que bate)
export function initForm(ctx, estadoAtual) {
  C = ctx;
  FS = ctx.FS;
  db = ctx.db;
  colE = FS.collection(db, "ensaios");
  estado = estadoAtual;
}
const conflitos = (...a) => conflitosEm(estado(), ...a);
const resumoDia = (data, ignora) => resumoDiaEm(estado(), data, ignora, nomeEvento);
const DURACOES = [
  [30, "30 min"],
  [60, "1 hora"],
  [90, "1h30"],
  [120, "2 horas"],
  [180, "3 horas"],
  [240, "4 horas"]
];

const DE_QUEM = ["Luciana", "Adriano", "Estúdio"];
let leadsCache = null;
async function carregarLeads() {
  if (leadsCache || !C.pode("funil")) return leadsCache || [];
  try {
    const s = await FS.getDocs(FS.query(FS.collection(db, "leads"), FS.limit(600)));
    leadsCache = s.docs.map(d => Object.assign({ id: d.id }, d.data())).filter(l => l.nome);
  } catch (e) {
    avisoErro(e, "carregar os clientes do Funil");
    leadsCache = [];
  }
  return leadsCache;
}
export function openEnsaio(x, pre) {
  pre = pre || {};
  sheet(x ? "Editar ensaio" : "Marcar ensaio no estúdio", (p, close) => {
    const nome = el("input");
    nome.required = true;
    nome.maxLength = 120;
    nome.placeholder = "nome do cliente";
    nome.value = x ? x.cliente || "" : pre.cliente || "";
    const dl = el("datalist");
    dl.id = "agLeads";
    nome.setAttribute("list", "agLeads");
    const tel = el("input");
    tel.inputMode = "tel";
    tel.maxLength = 30;
    tel.placeholder = "(21) 9…";
    tel.value = x ? x.tel || "" : pre.tel || "";
    let leadId = x ? x.leadId || "" : pre.leadId || "";
    let codigo = x ? x.codigo || "" : pre.codigo || ""; // ID do ensaio fechado no Funil (26EST-00001)
    const r1 = el("div", "row2");
    r1.append(field("Cliente", nome), field("WhatsApp", tel));
    p.append(r1, dl);
    const hintLead = el("p", "hint", "");
    hintLead.hidden = true;
    p.append(hintLead);
    carregarLeads().then(ls => {
      ls.slice(0, 600).forEach(l => {
        const o = el("option");
        o.value = l.nome;
        o.label = [l.servico, l.telefone].filter(Boolean).join(" · ");
        dl.append(o);
      });
      if (ls.length) {
        hintLead.textContent = "Comece a digitar o nome para puxar um cliente do Funil.";
        hintLead.hidden = false;
      }
    });
    nome.addEventListener("change", () => {
      const l = (leadsCache || []).find(l => l.nome.trim().toLowerCase() === nome.value.trim().toLowerCase());
      if (!l) {
        leadId = "";
        codigo = "";
        return;
      }
      leadId = l.id;
      codigo = l.codigoEnsaio || "";
      if (!tel.value && l.telefone) tel.value = l.telefone;
      const t = tipoDoLead(l.servico);
      if (t && !tipo.value) tipo.value = t;
    });
    const tipo = el("select");
    {
      const o = el("option", null, "escolha o tipo");
      o.value = "";
      tipo.append(o);
    }
    TIPOS_ENSAIO.forEach(t => {
      const o = el("option", null, t);
      o.value = t;
      tipo.append(o);
    });
    tipo.required = true;
    tipo.value = x ? x.tipo || "" : pre.tipo || tipoDoLead(pre.servico) || "";
    const dur = el("select");
    DURACOES.forEach(([m, t]) => {
      const o = el("option", null, t);
      o.value = String(m);
      dur.append(o);
    });
    dur.value = String(x ? x.duracao || 60 : 60);
    const r2 = el("div", "row2");
    r2.append(field("Tipo de ensaio", tipo), field("Duração", dur));
    p.append(r2);
    const data = el("input");
    data.type = "date";
    data.required = true;
    data.min = U.todayStr();
    data.value = x ? x.data : pre.data || "";
    const hora = el("input");
    hora.type = "time";
    hora.required = true;
    hora.step = 900;
    hora.min = "08:00";
    hora.max = "20:00";
    hora.value = x ? x.hora || "" : "";
    const r3 = el("div", "row2");
    r3.append(field("Dia", data), field("Horário", hora));
    p.append(r3);
    const diaBox = el("p", "notes");
    diaBox.hidden = true;
    p.append(diaBox);
    const err = el("p", "err");
    err.hidden = true;
    const mostraDia = () => {
      err.hidden = true;
      p._ok = false;
      if (!data.value) {
        diaBox.hidden = true;
        return;
      }
      const r = resumoDia(data.value, x && x.id);
      diaBox.textContent = feriado(data.value)
        ? `🚫 Feriado: ${feriado(data.value)}. O estúdio não trabalha.`
        : r.length
          ? "Nesse dia já tem:\n" + r.join("\n")
          : "Dia livre ✅";
      diaBox.hidden = false;
    };
    data.addEventListener("change", () => {
      p._okc = false;
      mostraDia();
    });
    hora.addEventListener("change", () => {
      err.hidden = true;
      p._ok = false;
      p._okc = false;
    });
    dur.addEventListener("change", () => {
      p._ok = false;
    });
    if (x || pre.data) mostraDia();
    const sinL = el("label", "chk");
    const sinC = el("input");
    sinC.type = "checkbox";
    sinC.checked = x ? !!x.sinalPago : !!pre.sinalPago;
    sinL.append(sinC, document.createTextNode(" 💰 Sinal pago"));
    const sinV = el("input");
    sinV.inputMode = "decimal";
    sinV.maxLength = 12;
    sinV.className = "preco";
    sinV.placeholder = "R$";
    sinV.setAttribute("aria-label", "Valor do sinal");
    sinV.value = x ? x.sinalValor || "" : "";
    const tot = el("input");
    tot.inputMode = "decimal";
    tot.maxLength = 12;
    tot.className = "preco";
    tot.placeholder = "R$";
    tot.setAttribute("aria-label", "Valor do ensaio");
    tot.value = x ? x.valor || "" : pre.valor || "";
    const rs = el("div", "prow");
    rs.append(sinL, sinV);
    const rt = el("div", "prow");
    rt.append(el("span", null, "Valor do ensaio"), tot);
    const fs0 = el("div", "field");
    fs0.append(el("label", null, "Pagamento"), rs, rt);
    p.append(fs0);
    const obs = el("textarea");
    obs.rows = 2;
    obs.maxLength = 1000;
    obs.placeholder = "ex.: vem com a mãe e o cachorro";
    obs.value = x ? x.obs || "" : pre.obs || "";
    p.append(field("Observação", obs), err);
    const a = botoes(close, x ? "Salvar" : "Marcar ensaio");
    if (x) {
      const del = el("button", "btn btn-danger", "Excluir");
      del.type = "button";
      a.prepend(del);
      del.onclick = async () => {
        if (!p._del) {
          p._del = true;
          del.textContent = "Toque de novo para excluir";
          return;
        }
        try {
          await FS.deleteDoc(FS.doc(db, "ensaios", x.id));
          U.toast("Ensaio excluído");
          close();
        } catch (e) {
          C.handleErr(e);
        }
      };
    }
    p.append(a);
    p.addEventListener("submit", async ev => {
      ev.preventDefault();
      if (!nome.value.trim() || !tipo.value || !data.value || !hora.value) return;
      if (feriado(data.value)) {
        err.textContent = `${U.fmtDate(data.value)} é feriado (${feriado(data.value)}) e o estúdio não trabalha. Escolha outro dia.`;
        err.hidden = false;
        return;
      }
      const { doDia, encavala, colegio, compBate } = conflitos(data.value, hora.value, dur.value, x && x.id);
      if (compBate.length && !p._okc) {
        p._okc = true;
        a.ok.textContent = "Marcar mesmo assim";
        err.textContent =
          "Nesse horário tem compromisso: " +
          compBate
            .map(c => `${c.titulo || "Compromisso"} (${c.deQuem || ""}) ${c.diaInteiro ? "dia inteiro" : c.hora + "–" + fimDe(c)}`)
            .join(", ") +
          ". Toque de novo para marcar mesmo assim.";
        err.hidden = false;
        err.scrollIntoView({ block: "center" });
        return;
      }
      // Horário em cima de outro ensaio: avisa antes de salvar
      if (encavala.length && !p._ok) {
        p._ok = true;
        a.ok.textContent = "Marcar mesmo assim";
        err.textContent =
          "Esse horário bate com: " +
          encavala.map(e => `${e.hora}–${fimDe(e)} ${U.first(e.cliente)}`).join(", ") +
          ". Toque de novo para marcar mesmo assim.";
        err.hidden = false;
        err.scrollIntoView({ block: "center" });
        return;
      }
      // Quando o dia já tem algo, a Luciana analisa (a não ser que seja ela marcando)
      const motivos = [];
      if (colegio) motivos.push(nomeEvento(colegio.kind, colegio.instNome));
      if (doDia.length) motivos.push(`${doDia.length} ensaio${doDia.length > 1 ? "s" : ""} no mesmo dia`);
      if (encavala.length) motivos.push("horário encavalado");
      if (compBate.length) motivos.push("compromisso: " + compBate.map(c => c.titulo || "compromisso").join(", "));
      const mudouDia = !x || x.data !== data.value || x.hora !== hora.value || String(x.duracao) !== dur.value;
      let status = x ? (x.status === "remarcar" ? "confirmado" : x.status || "confirmado") : "confirmado";
      if (mudouDia || (x && x.status === "remarcar")) status = !C.aprovador && motivos.length ? "analisar" : "confirmado";
      const body = {
        cliente: nome.value.trim(),
        tel: tel.value.trim(),
        tipo: tipo.value,
        duracao: Number(dur.value),
        data: data.value,
        hora: hora.value,
        obs: obs.value.trim(),
        status,
        conflito: motivos.join(" · "),
        leadId,
        codigo,
        sinalPago: sinC.checked,
        sinalValor: lerReais(sinV.value),
        valor: lerReais(tot.value),
        atualizadoEm: new Date().toISOString()
      };
      if (mudouDia) body.lembrado = false;
      try {
        if (x) await FS.updateDoc(FS.doc(db, "ensaios", x.id), body);
        else
          await FS.addDoc(
            colE,
            Object.assign(body, { marcadoPor: C.me || "", marcadoEmail: C.email || "", criadoEm: new Date().toISOString() })
          );
        U.toast(
          status === "analisar"
            ? "Marcado. A Luciana vai analisar, porque o dia já tem: " + motivos.join(", ")
            : `Ensaio marcado: ${diaTxt(data.value)} às ${hora.value} ✅`
        );
        close();
      } catch (e) {
        C.handleErr(e);
      }
    });
    setTimeout(() => (x ? data : nome).focus(), 30);
  });
}

export function openComp(x, diaPre) {
  sheet(x ? "Editar compromisso" : "Novo compromisso", (p, close) => {
    p.append(el("p", "hint", "Consulta médica, banco, viagem, outros afazeres. O vendedor vê que o horário está ocupado."));
    const tit = el("input");
    tit.required = true;
    tit.maxLength = 80;
    tit.placeholder = "ex.: Consulta médica";
    tit.value = x ? x.titulo || "" : "";
    const sug = el("div", "quick");
    ["Consulta médica", "Exame", "Banco", "Viagem", "Folga", "Reunião"].forEach(t => {
      const b = el("button", "chip chip-sm", t);
      b.type = "button";
      b.onclick = () => {
        tit.value = t;
      };
      sug.append(b);
    });
    const quem = el("select");
    DE_QUEM.forEach(q => {
      const o = el("option", null, q);
      o.value = q;
      quem.append(o);
    });
    quem.value = x ? x.deQuem || "Estúdio" : /luciana/i.test(C.me || "") ? "Luciana" : /adriano/i.test(C.me || "") ? "Adriano" : "Estúdio";
    const r1 = el("div", "row2");
    r1.append(field("O que é", tit), field("De quem", quem));
    p.append(r1, sug);
    const data = el("input");
    data.type = "date";
    data.required = true;
    data.min = U.todayStr();
    data.value = x ? x.data : diaPre || "";
    const intL = el("label", "chk");
    const intC = el("input");
    intC.type = "checkbox";
    intC.checked = x ? !!x.diaInteiro : false;
    intL.append(intC, document.createTextNode(" Dia inteiro (bloqueia formatura e dia de fotos)"));
    const h1 = el("input");
    h1.type = "time";
    h1.step = 900;
    h1.value = x && !x.diaInteiro ? x.hora || "" : "";
    const h2 = el("input");
    h2.type = "time";
    h2.step = 900;
    h2.value = x && !x.diaInteiro && x.hora ? fimDe(x) : "";
    const r2 = el("div", "row3");
    r2.append(field("Dia", data), field("Das", h1), field("Até", h2));
    p.append(r2, intL);
    const sync = () => {
      h1.disabled = h2.disabled = intC.checked;
      h1.required = h2.required = !intC.checked;
    };
    intC.onchange = sync;
    sync();
    const parL = el("label", "chk");
    const parC = el("input");
    parC.type = "checkbox";
    parC.checked = x ? !!x.particular : true;
    parL.append(parC, document.createTextNode(" 🔒 Particular (o vendedor vê só “ocupado”)"));
    p.append(parL);
    const diaBox = el("p", "notes");
    diaBox.hidden = true;
    p.append(diaBox);
    data.addEventListener("change", () => {
      const r = resumoDia(data.value, x && x.id);
      diaBox.textContent = r.length ? "Nesse dia já tem:\n" + r.join("\n") : "Dia livre ✅";
      diaBox.hidden = !data.value;
    });
    const obs = el("textarea");
    obs.rows = 2;
    obs.maxLength = 500;
    obs.placeholder = "opcional";
    obs.value = x ? x.obs || "" : "";
    p.append(field("Observação", obs));
    const err = el("p", "err");
    err.hidden = true;
    p.append(err);
    const a = botoes(close, x ? "Salvar" : "Marcar compromisso");
    if (x) {
      const del = el("button", "btn btn-danger", "Excluir");
      del.type = "button";
      a.prepend(del);
      del.onclick = async () => {
        if (!p._del) {
          p._del = true;
          del.textContent = "Toque de novo para excluir";
          return;
        }
        try {
          const b = FS.writeBatch(db);
          b.delete(FS.doc(db, "ensaios", x.id));
          if (x.particular) b.delete(FS.doc(db, "privado", x.id));
          await b.commit();
          U.toast("Compromisso excluído");
          close();
        } catch (e) {
          C.handleErr(e);
        }
      };
    }
    p.append(a);
    p.addEventListener("submit", async ev => {
      ev.preventDefault();
      const i = min(h1.value),
        f = min(h2.value);
      if (!intC.checked && (i == null || f == null || f <= i)) {
        err.textContent = "O horário de fim precisa ser depois do início.";
        err.hidden = false;
        return;
      }
      // Particular: o assunto vai para a coleção "privado", que só os donos leem (o vendedor vê só "ocupado")
      const part = parC.checked,
        assunto = { titulo: tit.value.trim(), obs: obs.value.trim() };
      const body = Object.assign(
        {
          kind: "pessoal",
          deQuem: quem.value,
          data: data.value,
          diaInteiro: intC.checked,
          hora: intC.checked ? "" : h1.value,
          duracao: intC.checked ? 0 : f - i,
          particular: part,
          status: "confirmado",
          atualizadoEm: new Date().toISOString()
        },
        part ? { titulo: "", obs: "" } : assunto
      );
      try {
        const ref = x ? FS.doc(db, "ensaios", x.id) : FS.doc(colE);
        const b = FS.writeBatch(db);
        if (x) b.update(ref, body);
        else b.set(ref, Object.assign(body, { marcadoPor: C.me || "", marcadoEmail: C.email || "", criadoEm: new Date().toISOString() }));
        if (part) b.set(FS.doc(db, "privado", ref.id), Object.assign({ data: data.value }, assunto));
        else if (x && x.particular) b.delete(FS.doc(db, "privado", ref.id));
        await b.commit();
        const col = (estado().items || []).find(y => y.data === data.value);
        U.toast(
          intC.checked && col ? `Marcado. Atenção: nesse dia já tem ${nomeEvento(col.kind, col.instNome)}` : "Compromisso marcado ✅"
        );
        close();
      } catch (e) {
        C.handleErr(e);
      }
    });
    setTimeout(() => (x ? data : tit).focus(), 30);
  });
}
