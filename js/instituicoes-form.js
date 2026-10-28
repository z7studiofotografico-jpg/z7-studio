// Instituições: cadastro (nova / editar) e registro de visita ou contato, com o próximo passo.
import { el, title, field, inp, sel, sheet, botoes as actions, parseTel } from "./ui.js";
import { reservarVarios, liberar, msgErroData, camposEvento, produtos, avisarColegioPorEmail } from "./eventos.js";
import * as U from "./util.js";
import { siglaDe } from "./aluno-id.js";
import { TIPOS, CARTOES, CARGOS, FOTOGRAFO, RESULTADOS, PASSOS, SEGMENTOS, semSeries, norm, anoQueVem } from "./instituicoes-dados.js";
import { C, FS, db, col, tipo, items } from "./instituicoes-estado.js";
import { cadastroFalta, cadastroPendente } from "./instituicao-cadastro.js";
// Atalhos de data do próximo passo
function quandoBtns(target) {
  const q = el("div", "quick");
  [
    ["Amanhã", 1],
    ["Semana que vem", 7],
    ["Mês que vem", 30],
    ["Início do ano que vem", "ano"],
    ["Sem data", -1]
  ].forEach(([t, n]) => {
    const b = el("button", "btn btn-sm", t);
    b.type = "button";
    b.onclick = () => {
      target.value = n === -1 ? "" : n === "ano" ? anoQueVem() : U.addDays(n);
    };
    q.append(b);
  });
  return q;
}
export function openForm(it) {
  const cartao = CARTOES[tipo] || CARTOES.particular;
  sheet(it ? "Editar instituição" : "Nova instituição · " + cartao.nome, (p, close) => {
    const nome = inp(it ? title(it.nome) : "", "Nome da instituição");
    nome.required = true;
    if (cadastroPendente(it))
      p.append(el("p", "wait", "📋 Complete o cadastro deste colégio. Falta: " + cadastroFalta(it).join(", ") + "."));
    p.append(field("Nome", nome));
    // O tipo vem do cartão que foi aberto; no cartão de faculdade e curso profissionalizante, escolhe qual dos dois
    const tipoSel =
      cartao.tipos.length > 1
        ? sel(
            cartao.tipos.map(k => [k, TIPOS[k].nome]),
            it ? it.tipo : cartao.tipos[0]
          )
        : null;
    if (tipoSel) p.append(field("É faculdade ou curso profissionalizante?", tipoSel));
    // Sigla do ID dos alunos (26CEPNCP-01...): o app usa as iniciais do nome; escolhe na mão só quando repete com outro colégio
    const sigla = inp(it ? it.sigla || "" : "", "", 16);
    sigla.autocapitalize = "characters";
    const avSigla = el("p", "hint");
    const sugere = () => {
      const auto = siglaDe(nome.value);
      const outro = items.find(x => (!it || x.id !== it.id) && (x.sigla || siglaDe(x.nome)) === auto);
      sigla.placeholder = auto ? "automática: " + auto : "iniciais do nome";
      avSigla.className = outro && !sigla.value.trim() ? "wait" : "hint";
      avSigla.textContent =
        outro && !sigla.value.trim()
          ? `⚠️ A sigla ${auto} já é do ${title(outro.nome)}. Escolha outra aqui (ex.: ${siglaDe(nome.value, [auto])}).`
          : "Só precisa preencher se a sigla repetir com outro colégio. O ID do aluno leva o ano na frente (ex.: 26" +
            (auto || "CEPNCP") +
            "-01).";
    };
    nome.addEventListener("input", sugere);
    sigla.addEventListener("input", sugere);
    sugere();
    p.append(field("Sigla do ID dos alunos", sigla), avSigla);
    const a = (it && it.endereco) || {};
    const rua = inp(title(a.rua)),
      num = inp(a.numero, "", 20),
      bai = inp(title(a.bairro)),
      cid = inp(title(a.cidade));
    const r1 = el("div", "row2");
    r1.append(field("Endereço", rua), field("Número", num));
    const r2 = el("div", "row2");
    r2.append(field("Bairro", bai), field("Cidade", cid));
    p.append(r1, r2);
    const fot = sel(FOTOGRAFO, it && it.fotografoHoje, "—");
    p.append(field("Fotógrafo hoje", fot));
    // Alunos por série (as séries que formam) e total
    const porSerie = (it && it.alunosPorSerie) || {};
    const segBox = el("div", "series");
    const totTxt = el("p", "hint");
    const segChk = SEGMENTOS.map(([k, t]) => {
      const r = el("div", "prow");
      const l = el("label", "chk");
      const c = el("input");
      c.type = "checkbox";
      c.checked = !!(it && it.segmentos && (it.segmentos[k] || (k === "pre" && it.segmentos.infantil)));
      l.append(c, document.createTextNode(" " + t));
      const q = inp(porSerie[k] || "", "alunos", 5);
      q.inputMode = "numeric";
      q.className = "preco";
      q.setAttribute("aria-label", "Alunos no " + t);
      q.addEventListener("input", () => {
        c.checked = !!Number(q.value);
        somar();
      });
      c.addEventListener("change", somar);
      r.append(l, q);
      segBox.append(r);
      return [k, c, q];
    });
    const extraQ = inp(it && it.alunosOutros ? it.alunosOutros : "", "outros", 6);
    extraQ.inputMode = "numeric";
    extraQ.className = "preco";
    const rx = el("div", "prow");
    rx.append(el("span", null, semSeries(tipo) ? "Alunos formando (total)" : "Outras séries / total sem série"), extraQ);
    segBox.append(rx);
    extraQ.addEventListener("input", somar);
    function somar() {
      const t = segChk.reduce((a, [, c, q]) => a + (c.checked ? Number(q.value) || 0 : 0), 0) + (Number(extraQ.value) || 0);
      totTxt.textContent = t ? `Total: ${t} alunos` : "Coloque quantos alunos tem em cada série.";
      return t;
    }
    somar();
    {
      const f = el("div", "field");
      f.append(el("label", null, semSeries(tipo) ? "Alunos" : "Séries e alunos"), segBox, totTxt);
      p.append(f);
    }
    if (semSeries(tipo))
      segChk.forEach(([, , q]) => {
        q.closest(".prow").hidden = true;
      });
    p.append(el("h3", null, "Contatos"));
    const lista = el("div", "imp");
    p.append(lista);
    const linhas = [];
    const addC = (c = {}) => {
      const nm = inp(title(c.nome), "nome"),
        cg = sel(CARGOS, c.cargo, "cargo"),
        tl = inp(c.tel, "21 99999-9999", 20),
        em = inp(c.email, "e-mail (recebe as datas)");
      tl.inputMode = "tel";
      em.type = "email";
      const r = el("div", "row3");
      r.append(field("Nome", nm), field("Cargo", cg), field("Telefone / WhatsApp", tl));
      const r2 = el("div", "row2");
      r2.append(field("E-mail", em));
      lista.append(r, r2);
      linhas.push({ nm, cg, tl, em });
    };
    (it && it.contatos && it.contatos.length ? it.contatos : [{}]).forEach(addC);
    const add = el("button", "btn btn-sm", "+ Adicionar contato");
    add.type = "button";
    add.onclick = () => addC();
    p.append(add);
    const email = inp(it && it.email, "e-mail da instituição (recebe as datas confirmadas)");
    p.append(field("E-mail da instituição", email));
    const hor = inp(it && it.horario, "ex.: só funciona à tarde");
    p.append(field("Melhor horário para contato", hor));
    const nota = el("textarea");
    nota.rows = 3;
    nota.maxLength = 2000;
    nota.value = (it && it.notas) || "";
    p.append(field("Anotações gerais", nota));
    // Apagar: o administrador apaga qualquer uma; o vendedor só a que está na conta dele
    if (it && (C.isAdmin || (it.respEmail && it.respEmail === C.email))) {
      const del = el("button", "btn btn-danger btn-sm", "Apagar instituição");
      del.type = "button";
      del.onclick = async () => {
        if (del.dataset.ok) {
          try {
            // apaga junto os formandos (e parcelas) da turma, para nada ficar solto no Dashboard
            const q = C.isAdmin
              ? FS.query(FS.collection(db, "formandos"), FS.where("instId", "==", it.id))
              : FS.query(FS.collection(db, "formandos"), FS.where("instId", "==", it.id), FS.where("respEmail", "==", C.email));
            const fs = (await FS.getDocs(q)).docs;
            if (!C.isAdmin) {
              // dinheiro recebido e data confirmada com o colégio não somem pela mão da equipe
              const pagos = fs.filter(d => {
                const f = d.data();
                return (f.pagas || 0) > 0 || (f.pagamentos || []).length;
              }).length;
              const confirmada = ["diaFotos", "formatura"].some(k => it[k] && it[k].status === "confirmado");
              if (pagos || confirmada) {
                U.toast(
                  pagos
                    ? `Tem ${pagos} formando${pagos > 1 ? "s" : ""} com parcela paga: só o administrador pode apagar`
                    : "Tem data confirmada com o colégio: só o administrador pode apagar"
                );
                return;
              }
            }
            await liberar(it, "formatura");
            await liberar(it, "fotos");
            for (let i = 0; i < fs.length; i += 400) {
              const b = FS.writeBatch(db);
              fs.slice(i, i + 400).forEach(d => b.delete(d.ref));
              if (i + 400 >= fs.length) b.delete(FS.doc(db, "instituicoes", it.id));
              await b.commit();
            }
            if (!fs.length) await FS.deleteDoc(FS.doc(db, "instituicoes", it.id));
            U.toast(fs.length ? `Apagada, com ${fs.length} formando${fs.length > 1 ? "s" : ""}` : "Apagada");
            close();
          } catch (e) {
            C.handleErr(e);
          }
        } else {
          del.dataset.ok = 1;
          del.textContent = "Toque de novo: apaga o colégio e os formandos dele";
        }
      };
      p.append(del);
    }
    p.append(actions(close, "Salvar"));
    p.addEventListener("submit", async ev => {
      ev.preventDefault();
      if (!nome.value.trim()) return;
      const tipoK = tipoSel ? tipoSel.value : it ? it.tipo : cartao.tipos[0];
      const contatos = linhas
        .map(({ nm, cg, tl, em }) => ({
          nome: nm.value.trim(),
          cargo: cg.value,
          tel: parseTel(tl.value) || tl.value.trim(),
          email: em.value.trim().toLowerCase()
        }))
        .filter(c => c.nome || c.tel || c.email);
      const body = {
        nome: nome.value.trim(),
        nomeBusca: norm(nome.value),
        sigla: sigla.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase(),
        tipo: tipoK,
        endereco: { rua: rua.value.trim(), numero: num.value.trim(), bairro: bai.value.trim(), cidade: cid.value.trim() },
        mediaAlunos: somar() || null,
        alunosPorSerie: Object.fromEntries(segChk.map(([k, c, q]) => [k, c.checked ? Number(q.value) || 0 : 0])),
        alunosOutros: Number(extraQ.value) || 0,
        fotografoHoje: fot.value,
        segmentos: Object.fromEntries(segChk.map(([k, c]) => [k, c.checked])),
        contatos,
        email: email.value.trim(),
        horario: hor.value.trim(),
        notas: nota.value.trim(),
        atualizadoEm: new Date().toISOString()
      };
      // colégio da planilha: completou contato, alunos e endereço → sai da lista de pendências (o Adriano vê às 19h)
      let completou = false;
      if (it && it.cadastroPendente && !cadastroFalta(Object.assign({}, it, body)).length) {
        Object.assign(body, { cadastroPendente: false, cadastroOkEm: new Date().toISOString(), cadastroOkPor: C.me || "" });
        completou = true;
      }
      try {
        if (it) await FS.updateDoc(FS.doc(db, "instituicoes", it.id), body);
        else
          await FS.addDoc(
            col,
            Object.assign(body, {
              etapa: "A VISITAR",
              followup: null,
              visitas: [],
              tentativas: 0,
              resp: C.me,
              respEmail: C.email || "",
              criadoEm: new Date().toISOString()
            })
          );
        U.toast(completou ? "Cadastro completo ✅ Obrigado!" : "Salvo");
        close();
      } catch (e) {
        C.handleErr(e);
      }
    });
  });
}

export function openVisita(it) {
  sheet("Registrar visita / contato", (p, close) => {
    p.append(el("p", "hint", title(it.nome)));
    const data = el("input");
    data.type = "date";
    data.value = U.todayStr();
    const como = sel(["Visita presencial", "Ligação", "WhatsApp", "E-mail"], "Visita presencial");
    const r0 = el("div", "row2");
    r0.append(field("Data", data), field("Como foi", como));
    p.append(r0);
    const cs = it.contatos || [];
    const falou = inp("", "nome de quem atendeu");
    const cargo = sel(CARGOS, "", "cargo");
    const tel = inp("", "WhatsApp (se tiver)", 20);
    tel.inputMode = "tel";
    if (cs[0]) {
      falou.value = title(cs[0].nome);
      cargo.value = cs[0].cargo || "";
    }
    const r1 = el("div", "row3");
    r1.append(field("Com quem falou", falou), field("Cargo", cargo), field("Telefone novo", tel));
    p.append(r1);
    const fot = sel(FOTOGRAFO, it.fotografoHoje, "—");
    p.append(field("Fotógrafo hoje", fot));
    // O que foi apresentado: toca no produto, o preço vem pronto e dá para mudar
    p.append(
      el("h3", null, "O que apresentou"),
      el("p", "hint", "O valor que aparece é o mínimo. Pode colocar mais alto; mais baixo, não.")
    );
    const prodBox = el("div", "imp");
    const prods = [];
    produtos(it.tipo || CARTOES[tipo].tipos[0]).forEach(pr => {
      const r = el("div", "prow");
      const l = el("label", "chk");
      const c = el("input");
      c.type = "checkbox";
      l.append(c, document.createTextNode(" " + pr.nome));
      const v = inp(pr.preco, pr.preco ? "mín. " + U.money(pr.preco) : "R$", 12);
      v.inputMode = "decimal";
      v.className = "preco";
      v.setAttribute("aria-label", "Preço de " + pr.nome);
      v.addEventListener("input", () => {
        if (v.value) c.checked = true;
      });
      r.append(l, v);
      prodBox.append(r);
      prods.push({ nome: pr.nome, c, v, formatura: pr.formatura, min: Number(pr.preco) || 0 });
    });
    const errProd = el("p", "err");
    errProd.hidden = true;
    p.append(prodBox, errProd);
    const fBox = camposEvento("formatura", it.formatura, it.nome);
    fBox.hidden = true;
    p.append(fBox);
    // Dia de fotos no colégio (medir beca + ensaio)
    const dfL = el("label", "chk");
    const dfC = el("input");
    dfC.type = "checkbox";
    dfL.append(dfC, document.createTextNode(" 📸 Já combinou o dia de fotos no colégio (medir beca + ensaio)"));
    const dBox = camposEvento("fotos", it.diaFotos, it.nome);
    dBox.hidden = true;
    dfC.onchange = () => {
      dBox.hidden = !dfC.checked;
    };
    p.append(dfL, dBox);
    const syncF = () => {
      const fx = prods.find(x => x.formatura && x.c.checked);
      fBox.hidden = !fx;
      if (fx) {
        fBox.onde.value = fx.formatura;
        dfC.checked = true;
        dBox.hidden = false;
      }
    };
    prods.forEach(x => x.c.addEventListener("change", syncF));
    const res = sel(
      RESULTADOS.map(r => r[0]),
      "",
      "escolha o resultado"
    );
    res.required = true;
    p.append(field("Resultado", res));
    const motivoBox = el("div");
    const motivo = inp("", "ex.: já gastaram com outros eventos este ano");
    motivoBox.append(field("Motivo de não fechar", motivo));
    motivoBox.hidden = true;
    p.append(motivoBox);
    res.onchange = () => {
      const et = (RESULTADOS.find(r => r[0] === res.value) || [])[1];
      motivoBox.hidden = et !== "NÃO FECHOU";
    };
    const passo = sel(PASSOS, "", "próximo passo");
    const quando = el("input");
    quando.type = "date";
    const qHora = el("input");
    qHora.type = "time";
    qHora.step = 900;
    const r2 = el("div", "row3");
    r2.append(field("Próximo passo", passo), field("Quando", quando), field("Horário (opcional)", qHora));
    p.append(r2, quandoBtns(quando));
    p.append(el("p", "hint", "Visita marcada (“Voltar para visita”) aparece no Agendamento, sem bloquear o dia."));
    const obs = el("textarea");
    obs.rows = 3;
    obs.maxLength = 2000;
    obs.placeholder = "Ex.: pediu retorno dia 16; tem interesse em aluguel de beca";
    p.append(field("Observação", obs));
    p.append(actions(close, "Salvar visita"));
    p.addEventListener("submit", async ev => {
      ev.preventDefault();
      if (!res.value) return;
      // Preço mínimo: o vendedor pode subir o valor, mas não baixar
      const abaixo = prods.filter(x => x.c.checked && x.min && U.num(x.v.value) < x.min);
      if (abaixo.length) {
        errProd.textContent = "Abaixo do valor mínimo: " + abaixo.map(x => `${x.nome} (mín. ${U.money(x.min)})`).join(", ");
        errProd.hidden = false;
        errProd.scrollIntoView({ block: "center" });
        return;
      }
      errProd.hidden = true;
      const etapa = (RESULTADOS.find(r => r[0] === res.value) || [])[1] || it.etapa;
      // Formatura com data: reserva o dia antes de salvar (bloqueia se já estiver ocupado)
      let formatura = null,
        diaFotos = null;
      const fv = !fBox.hidden ? fBox.valor() : null,
        dv = dfC.checked ? dBox.valor() : null;
      if (fv && fv.data && !(dv && dv.data) && !p._avisado) {
        p._avisado = true;
        dBox.hidden = false;
        dfC.checked = true;
        dBox.erro("Não esqueça do dia de medir beca e fazer o ensaio! Se ainda não combinou, toque em salvar de novo.");
        return;
      }
      if (fv && fv.data && dv && dv.data && dv.data >= fv.data) {
        dBox.erro(msgErroData({ code: "ordem" }));
        return;
      }
      const pares = [dv && dv.data ? ["fotos", dv] : null, fv && fv.data ? ["formatura", fv] : null].filter(Boolean);
      if (pares.length) {
        try {
          const r = await reservarVarios(it, pares);
          if (dv && dv.data) diaFotos = Object.assign(dv, { status: r.status, grupo: r.grupo, pedidoPor: C.me || "" });
          if (fv && fv.data) formatura = Object.assign(fv, { status: r.status, grupo: r.grupo, pedidoPor: C.me || "" });
          if (r.status === "confirmado") setTimeout(() => avisarColegioPorEmail(it.id), 800);
        } catch (e) {
          (e.code === "ocupado" && e.ocupado && dv && e.ocupado.data === dv.data ? dBox : fBox.hidden ? dBox : fBox).erro(msgErroData(e));
          return;
        }
      }
      const visita = {
        data: data.value,
        como: como.value,
        por: C.me || "",
        porEmail: C.email || "",
        falouCom: [falou.value.trim(), cargo.value].filter(Boolean).join(" · "),
        resultado: res.value,
        apresentou: prods.filter(x => x.c.checked).map(x => ({ nome: x.nome, preco: U.num(x.v.value) })),
        passo: passo.value,
        quando: quando.value,
        obs: obs.value.trim(),
        em: new Date().toISOString()
      };
      const patch = {
        etapa,
        fotografoHoje: fot.value || it.fotografoHoje || "",
        proximoPasso: passo.value,
        followup: etapa === "FECHADO" ? null : quando.value || null,
        followupHora: etapa === "FECHADO" || !quando.value ? "" : qHora.value,
        atendendo: null,
        ultimo: { por: C.me || "—", em: new Date().toISOString() }
      };
      if (etapa === "FECHADO") patch.fechadoEm = U.todayStr();
      if (formatura) patch.formatura = formatura;
      if (diaFotos) patch.diaFotos = diaFotos;
      if (etapa === "NÃO FECHOU") patch.motivo = motivo.value.trim() || res.value;
      const nomeF = falou.value.trim(),
        telF = parseTel(tel.value);
      close();
      // Transação: lê a versão atual (outra pessoa pode ter registrado uma visita agora) e junta
      try {
        const ref = FS.doc(db, "instituicoes", it.id);
        await FS.runTransaction(db, async tx => {
          const s0 = await tx.get(ref),
            atual = s0.exists() ? s0.data() : it;
          const p2 = Object.assign({}, patch, {
            visitas: [visita, ...(atual.visitas || [])].slice(0, 50),
            atualizadoEm: new Date().toISOString()
          });
          if (etapa === "AGENDAR VISITA") p2.tentativas = (atual.tentativas || 0) + 1;
          // sem responsável ainda: quem registrou a visita assume
          if (!atual.respEmail && !atual.resp) {
            p2.resp = C.me || "";
            p2.respEmail = C.email || "";
          }
          // guarda o contato novo, se veio
          if (nomeF || telF) {
            const lista = (atual.contatos || []).slice();
            const i0 = lista.findIndex(c => norm(c.nome) === norm(nomeF) && nomeF);
            if (i0 >= 0) {
              lista[i0] = Object.assign({}, lista[i0], { cargo: cargo.value || lista[i0].cargo, tel: telF || lista[i0].tel });
            } else lista.push({ nome: nomeF, cargo: cargo.value, tel: telF });
            p2.contatos = lista;
          }
          tx.update(ref, p2);
        });
        U.toast(etapa === "FECHADO" ? "Fechado! 🎉" : quando.value ? "Retorno em " + U.fmtDate(quando.value) : "Visita registrada");
      } catch (er) {
        C.handleErr(er);
      }
    });
  });
}
