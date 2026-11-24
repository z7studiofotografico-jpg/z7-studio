// Contrato do colégio: o formulário (criar/editar) e lançar a entrada de todos (23/11/2026: separado de
// contrato-colegio.js, que passou do tamanho). O valor combinado é o do kit inteiro por aluno; os itens são só para constar.
import { el, title, field, inp, inpReais, sel, sheet, botoes, bloco } from "./ui.js";
import * as U from "./util.js";
import { lerReais, brl } from "./regras.js";
import { confirmar } from "./confirmar.js";
import * as R from "./contrato-colegio-regras.js";
import { chipItem, lerQtd } from "./itens-qtd.js";

let C, FS, db;
export const usar = ctx => ((C = ctx), (FS = ctx.FS), (db = ctx.db));
const agora = () => new Date().toISOString();
const reg = o => ({ o, em: agora(), por: C.me || C.email || "" });
const histMais = (h, o) => [...(h || []), reg(o)].slice(-40);
const dataBR = d => (d ? d.split("-").reverse().join("/") : "");

// (23/11/2026) Lança a entrada (ex.: R$ 45 pagos ao coordenador) de cada aluno que ainda não tem pagamento
export async function lancarEntradas(alunos, c) {
  const e = c.entrada || {};
  const quem = (R.RECEBE.find(([k]) => k === e.recebe) || [, "?"])[1].toLowerCase();
  if (
    !(await confirmar(
      "Lançar a entrada?",
      `${alunos.length} aluno${alunos.length > 1 ? "s" : ""} com entrada de ${brl(e.valor)} paga a ${quem} (hoje). O resto fica faltando em cada um.`,
      { sim: "Sim, lançar" }
    ))
  )
    return;
  try {
    const col = FS.collection(db, "contratosColegio", c.id, "pagamentos");
    for (let i = 0; i < alunos.length; i += 400) {
      const b = FS.writeBatch(db);
      alunos.slice(i, i + 400).forEach(a =>
        b.set(FS.doc(col), {
          alunoId: a.id,
          alunoNome: a.nome || "",
          valor: Number(e.valor) || 0,
          data: U.todayStr(),
          forma: "Dinheiro",
          recebidoPor: e.recebe || "colegio",
          comprovante: "Entrada",
          comprovanteOk: false,
          itens: R.itensDoPagamento(a, c, []),
          entrada: true,
          atualizadoEm: agora(),
          conferido: false,
          repassadoEm: "",
          repasseAvisadoEm: "",
          repassadoPor: "",
          por: C.me || "",
          porEmail: C.email || "",
          criadoEm: agora(),
          historico: [reg(`lançou a entrada ${brl(e.valor)}`)]
        })
      );
      await b.commit();
    }
    U.toast("Entrada lançada ✅");
  } catch (err) {
    C.handleErr(err);
  }
}

// Cadastro / edição do contrato
export function formContrato(c, inst, ano, ref) {
  const x = c || {};
  const admin = C.isAdmin;
  sheet(c ? "Editar contrato" : "Novo contrato do colégio", async (p, close) => {
    p.append(el("p", "hint", `${title(inst.nome || "")} · ${ano}`));
    // quem fechou: o admin escolhe; quem é da equipe fecha em nome próprio
    const pessoas = Object.entries(C.usuarios || {})
      .filter(([, u]) => u && u.ativo !== false && u.nome)
      .map(([em, u]) => [em, u.nome])
      .sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
    if (C.email && !pessoas.some(([em]) => em === C.email)) pessoas.unshift([C.email, C.me || C.email]);
    const sResp = sel(pessoas, x.respEmail || C.email || "", "quem fechou");
    sResp.required = true;
    sResp.disabled = !admin;
    const quem = sel(R.QUEM_PAGA, x.quemPaga || "alunos");
    const recebe = sel(R.RECEBE, x.recebePadrao || "estudio");
    const valor = inpReais(x.valor != null ? x.valor : "", "0,00");
    const parc = inp(String(x.parcelas || 1), "1", 2);
    parc.inputMode = "numeric";
    // preço de cada item: o valor do aluno é a soma dos itens do pacote dele (e a comissão sai item por item)
    const precos = el("div", "row2");
    const precoCx = R.ITENS_PACOTE.map(([k, n]) => {
      const i = inpReais((x.precos || {})[k] != null ? x.precos[k] : "", "0,00");
      precos.append(field(n + " (R$)", i));
      return [k, i];
    });
    // (23/11/2026) o valor combinado é o do KIT INTEIRO por aluno; os itens ficam só para constar
    const vKit = inpReais(x.valorKit != null && x.valorKit !== 0 ? x.valorKit : "", "0,00");
    // entrada: ex.: cada aluno pagou R$ 45 ao coordenador (20% do kit) e o resto fica para depois
    const ent0 = x.entrada || {};
    const eVal = inpReais(ent0.valor ? ent0.valor : "", "0,00");
    const eRec = sel(R.RECEBE, ent0.recebe || "colegio");
    const ePct = el("small", "hint");
    const contaPct = () => {
      const k = lerReais(vKit.value),
        e = lerReais(eVal.value);
      ePct.textContent = k && e ? `= ${Math.round((e / k) * 100)}% do kit · falta ${brl(Math.max(0, k - e))} por aluno` : "";
    };
    [vKit, eVal].forEach(i => i.addEventListener("input", contaPct));
    contaPct();
    if (c && !admin) {
      quem.disabled = true;
      valor.disabled = true;
      parc.disabled = true;
      vKit.disabled = true;
      precoCx.forEach(([, i]) => (i.disabled = true));
    }
    const fValor = field("Valor total (o colégio paga)", valor);
    const fRecebe = field("Quem costuma receber", recebe);
    const sync = () => {
      fValor.hidden = quem.value !== "colegio";
      fRecebe.hidden = quem.value === "colegio";
    };
    quem.onchange = sync;
    sync();
    const r1 = el("div", "row2");
    r1.append(field("Quem fechou", sResp), field("Quem paga", quem));
    const r2 = el("div", "row2");
    r2.append(fRecebe, fValor);
    // (23/11/2026) contrato novo: o contato vem do cadastro do colégio (quem a pessoa já colocou no agendamento)
    const cInst = (inst.contatos || []).find(k => k && k.tel) || (inst.contatos || [])[0] || {};
    const cargoDe = t => R.CARGOS.find(g => String(t || "").slice(0, 5).toLowerCase() === g.slice(0, 5).toLowerCase()) || "";
    const ct = x.contato || (c ? {} : { nome: cInst.nome || "", cargo: cargoDe(cInst.cargo) || "Diretor(a)", tel: cInst.tel || "" });
    const cNome = inp(ct.nome || "", "nome");
    const cCargo = sel(R.CARGOS, ct.cargo || "Diretor(a)");
    const cTel = inp(ct.tel || "", "(21) 9…", 30);
    cTel.inputMode = "tel";
    const r3 = el("div", "row3");
    r3.append(field("Contato do colégio", cNome), field("Cargo", cCargo), field("WhatsApp", cTel));
    const en = x.entrega || {};
    const eData = el("input");
    eData.type = "date";
    eData.value = en.data || "";
    const eCom = inp(en.com || "", "ex.: Márcia (coordenadora)");
    const r4 = el("div", "row2");
    r4.append(field("Entrega combinada (dia/mês/ano)", eData), field("Combinada com", eCom));
    const unidade = inp(x.unidade || "", "se o colégio tiver mais de uma");
    const obs = el("textarea");
    obs.rows = 2;
    obs.maxLength = 600;
    obs.value = x.obs || "";
    const pacote = el("div", "chips cad-itens");
    // cada item com a quantidade (ex.: 2 PR 15x10) (17/11/2026)
    const caixas = R.ITENS_PACOTE.map(([k, nome]) => {
      const it = chipItem(k, nome, (x.pacotePadrao || ["paspatur", "certificado", "canudo"]).includes(k), (x.pacotePadraoQtd || {})[k]);
      pacote.append(it.l);
      return [k, it.cb];
    });
    const err = el("p", "err");
    err.hidden = true;
    // blocos numerados, no padrão do ➕ Cadastrar aluno
    p.classList.add("cad");
    const b1 = bloco(1, "Quem fechou e quem paga");
    b1.append(r1, r2);
    const b2 = bloco(2, "O kit e o valor", "o combinado é o valor do kit inteiro, por aluno");
    const kitsMod = await import("./contrato-kits.js");
    const kitsEd = kitsMod.editorKits(x, admin);
    const rK = el("div", "row2");
    rK.append(field("Valor do kit por aluno (o combinado)", vKit), field("Parcelas", parc));
    const rE = el("div", "row2");
    rE.append(field("Entrada por aluno (se teve)", eVal), field("A entrada foi paga a", eRec));
    // o preço de cada item fica guardado (para vender um item separado depois: paspatur, PR, quadro…)
    const det = el("details", "cad-mais");
    det.append(el("summary", null, "Preço de cada item e outros kits (opcional: para vender item separado depois)"), precos, kitsEd.box);
    if (Object.values(x.precos || {}).some(v => Number(v) > 0) || (x.kits || []).length) det.open = true;
    b2.append(rK, field("O que vem no kit (só para constar)", pacote), rE, ePct, det);
    const b3 = bloco(3, "Contato do colégio");
    b3.append(r3, field("Unidade", unidade));
    const b4 = bloco(4, "Entrega e observações");
    b4.append(r4, field("Observação", obs));
    p.append(b1, b2, b3, b4, err, botoes(close, c ? "Salvar" : "Criar contrato"));
    p.addEventListener("submit", async ev => {
      ev.preventDefault();
      const nomeResp = (pessoas.find(([em]) => em === sResp.value) || [, ""])[1];
      if (!sResp.value) {
        err.textContent = "Escolha quem fechou.";
        err.hidden = false;
        return;
      }
      if (cTel.value && U.digits(cTel.value).length < 10) {
        err.textContent = "WhatsApp do contato incompleto (DDD + número).";
        err.hidden = false;
        return;
      }
      const body = {
        recebePadrao: quem.value === "colegio" ? "colegio" : recebe.value,
        contato: { nome: cNome.value.trim(), cargo: cCargo.value, tel: U.digits(cTel.value) },
        entrega: { data: eData.value, com: eCom.value.trim() },
        pacotePadrao: caixas.filter(([, cb]) => cb.checked).map(([k]) => k),
        pacotePadraoQtd: lerQtd(caixas),
        entrada: { valor: lerReais(eVal.value) || 0, recebe: eRec.value },
        unidade: unidade.value.trim(),
        obs: obs.value.trim(),
        atualizadoEm: agora()
      };
      if (!c || admin)
        Object.assign(body, {
          respEmail: sResp.value,
          respNome: nomeResp,
          quemPaga: quem.value,
          valor: quem.value === "colegio" ? lerReais(valor.value) || 0 : 0,
          precos: Object.fromEntries(precoCx.map(([k, i]) => [k, lerReais(i.value) || 0])),
          valorKit: lerReais(vKit.value) || 0,
          ...kitsEd.ler(),
          parcelas: Math.max(1, parseInt(parc.value, 10) || 1)
        });
      try {
        if (c) {
          const mud = [];
          if (body.entrega.data !== (en.data || "") || body.entrega.com !== (en.com || ""))
            mud.push("entrega " + dataBR(body.entrega.data));
          if (body.valor != null && Number(body.valor) !== Number(x.valor || 0)) mud.push("valor " + brl(body.valor));
          if (body.precos && JSON.stringify(body.precos) !== JSON.stringify(x.precos || {})) mud.push("preços dos itens");
          if (body.valorKit != null && Number(body.valorKit) !== Number(x.valorKit || 0)) mud.push("valor do kit " + brl(body.valorKit));
          if (Number(body.entrada.valor) !== Number((x.entrada || {}).valor || 0)) mud.push("entrada " + brl(body.entrada.valor));
          if (body.quemPaga && body.quemPaga !== x.quemPaga) mud.push("quem paga");
          if (body.respEmail && body.respEmail !== x.respEmail) mud.push("quem fechou: " + nomeResp);
          if (body.contato.nome !== (ct.nome || "") || body.contato.tel !== (ct.tel || "")) mud.push("contato");
          if (R.textoPacote(body.pacotePadrao, body.pacotePadraoQtd) !== R.textoPacote(x.pacotePadrao, x.pacotePadraoQtd))
            mud.push("pacote padrão");
          body.historico = histMais(x.historico, "editou o contrato" + (mud.length ? " (" + mud.join(", ") + ")" : ""));
          await FS.updateDoc(ref, body);
        } else
          await FS.setDoc(
            ref,
            Object.assign(body, {
              instId: inst.id,
              instNome: inst.nome || "",
              ano: Number(ano),
              criadoEm: agora(),
              criadoPor: C.me || "",
              historico: [reg("criou o contrato")]
            })
          );
        // os alunos de aluguel do colégio/ano ficam com quem fechou o contrato
        if (body.respEmail && (!c || body.respEmail !== x.respEmail))
          await (await import("./becas-uso.js")).passarAlugueis(C, inst.id, ano, body.respEmail).catch(e => console.warn("[Z7] donos", e));
        // alunos que ficaram sem valor (colégio ainda sem preço) ganham o valor do kit ou dos itens
        if (C.isAdmin) await kitsMod.valorDosZerados(C, inst.id, ano, Object.assign({}, x, body)).catch(e => console.warn(e));
        U.toast(c ? "Contrato salvo" : "Contrato criado ✅");
        close();
      } catch (e) {
        C.handleErr(e);
      }
    });
  });
}

