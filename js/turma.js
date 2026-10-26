// Turma de um colégio FECHADO: formandos, contrato (álbum de formatura ou colação de grau), parcelas e cobrança.
// Coleção "formandos": { instId, instNome, nome, tel, serie, contrato, kit, valor, parcelas, primeiroVenc, formaPag,
//   pagamentos: [{ data, valor, por }], pagas (= quantidade de pagamentos), proxVenc, status, resp, respEmail, vendidoEm }
// Regras de parcela e dinheiro: js/regras.js. Só o administrador registra pagamento e muda valores.
import {
  lerReais,
  brl,
  dividir,
  pagamentosDe,
  pagasDe,
  nParcelas,
  quitado,
  atrasado as atrasadoEm,
  vencDa,
  valorParcela,
  recebido,
  emAberto,
  somar,
  proxVenc,
  ehColacao,
  somaDias as somaDiasRegra,
  ativo,
  SITUACOES,
  FORMAS
} from "./regras.js";
import {
  kitsDe,
  plano,
  ehAdesao,
  previsaoEntrega,
  quitadoEm,
  devolucao,
  proximoVenc,
  MINIMO_FORMANDOS,
  DEVOLVE_DESISTENCIA
} from "./contrato.js";
import { ESTUDIO } from "./mensagens.js";
import { el, title, norm, field, inp, inpReais, sel, sheet, botoes, wa, avisoErro, carregarLib, emPartes } from "./ui.js";
import * as U from "./util.js";
let C,
  FS,
  db,
  unsub = null;
const n0 = v => Number(v) || 0;
const hoje = () => U.todayStr();
export const atrasado = f => atrasadoEm(f, hoje());
export { quitado, ehColacao, vencDa };

export function setCtx(ctx) {
  C = ctx;
  FS = ctx.FS;
  db = ctx.db;
}

// Registra a próxima parcela paga numa transação (duas pessoas ao mesmo tempo não se atropelam)
export async function registrarPagamento(f) {
  const ref = FS.doc(db, "formandos", f.id);
  const r = await FS.runTransaction(db, async tx => {
    const s = await tx.get(ref);
    if (!s.exists()) throw new Error("não encontrado");
    const atual = Object.assign({ id: f.id }, s.data());
    if (quitado(atual)) return { ja: true, n: pagasDe(atual) };
    const lst = pagamentosDe(atual).slice(),
      n = lst.length + 1;
    lst.push({ data: hoje(), valor: valorParcela(atual, n), por: C.email || "" });
    const novo = Object.assign({}, atual, { pagamentos: lst });
    tx.update(ref, {
      pagamentos: lst,
      pagas: lst.length,
      proxVenc: proxVenc(novo),
      ultimoPag: hoje(),
      atualizadoEm: new Date().toISOString()
    });
    return { n };
  });
  U.toast(r.ja ? "Esse formando já está quitado" : `Parcela ${r.n} de ${U.first(title(f.nome))} registrada`);
}
// Desfaz o último pagamento (lançado por engano)
async function desfazerPagamento(f) {
  const ref = FS.doc(db, "formandos", f.id);
  await FS.runTransaction(db, async tx => {
    const s = await tx.get(ref);
    const atual = Object.assign({ id: f.id }, s.data());
    const lst = pagamentosDe(atual).slice(0, -1),
      novo = Object.assign({}, atual, { pagamentos: lst });
    tx.update(ref, { pagamentos: lst, pagas: lst.length, proxVenc: proxVenc(novo), atualizadoEm: new Date().toISOString() });
  });
  U.toast("Último pagamento desfeito");
}

// Mensagem de cobrança no WhatsApp (usada aqui e no card Formaturas)
export function cobrarWa(f) {
  const prox = pagasDe(f) + 1,
    venc = vencDa(f, prox),
    col = ehColacao(f);
  const item = col ? "da adesão da formatura (Kit 01)" : `do ${f.kit || "kit da formatura"}`;
  const pagar = f.formaPag === "Boleto" ? "\nO pagamento é pelo boleto." : C.P.pix ? `\nChave Pix: ${C.P.pix}` : "";
  const valor = brl(valorParcela(f, prox)),
    nome = U.first(title(f.nome));
  const msg = atrasado(f)
    ? `Oi, ${nome}! Aqui é do ${ESTUDIO.nome} 📸 Passando para lembrar da parcela ${prox}/${nParcelas(f)} ${item}, de ${valor}, que venceu ${venc ? "dia " + U.fmtDate(venc) : "este mês"}.${pagar}\nPode me mandar o comprovante por aqui? Se já pagou, é só desconsiderar 😊`
    : `Oi, ${nome}! Aqui é do ${ESTUDIO.nome} 📸 Só lembrando que a parcela ${prox}/${nParcelas(f)} ${item}, de ${valor}, vence ${venc ? "dia " + U.fmtDate(venc) : "em breve"}.${pagar}\nQualquer dúvida, estou por aqui 😊`;
  wa(f.tel, msg, U.toast);
}
// Mensagem para quem ainda não comprou: preços depois das fotos e o prazo
export function oferecerKit(ctx, inst, f) {
  setCtx(ctx);
  const ks = kitsDe(C.P).filter(k => k.pos && Number(k.pos.valor));
  if (!ks.length) return U.toast("Defina os preços depois das fotos em “📋 Kits e preços” (card Formaturas)");
  const ct = inst.contratoTurma || {},
    fotos = inst.diaFotos && inst.diaFotos.data,
    ate = fotos ? somaDiasRegra(fotos > hoje() ? fotos : hoje(), Number(ct.posFotoDias) || 30) : "";
  const lin = ks.map(k => {
    const n = Math.max(1, Number(k.pos.parcelas) || 1);
    return `• ${k.nome}: ${n > 1 ? `${n}x de ${brl(dividir(k.pos.valor, n)[n - 1])} (${brl(k.pos.valor)})` : brl(k.pos.valor)}`;
  });
  const nome = U.first(title(f.nome));
  const msg = `Oi, ${nome}! Aqui é do ${ESTUDIO.nome} 📸 As fotos da formatura do ${title(inst.nome)} ficaram lindas! Quer garantir as suas?\n\n${lin.join("\n")}\n\n${ate ? `Condição válida até ${U.fmtDate(ate)}. ` : ""}Posso te mandar uma prévia? 😊`;
  wa(f.tel, msg, U.toast);
}
export function openTurma(ctx, inst, kits, aoFechar) {
  setCtx(ctx);
  const col = FS.collection(db, "formandos");
  let lista = [],
    filtro = "todos",
    busca = "";
  const close = sheet(
    null,
    (p, fechar) => {
      const head = el("div", "vhead");
      head.append(el("h2", null, "Formandos · " + title(inst.nome)), U.mkBtn("Fechar", "btn-sm", fechar));
      p.append(head);
      const resumo = el("div", "kpis");
      p.append(resumo);
      // Quantidade de alunos: começa pela média (combinada com o colégio); depois das fotos confirma a certa
      const qtdBox = el("div", "notes");
      p.append(qtdBox);
      const bar = el("div", "actions");
      bar.append(U.mkBtn("+ Formando", "btn-primary", () => form()));
      if (C.isAdmin) bar.append(U.mkBtn("Importar planilha", "", () => importar()));
      if (C.isAdmin) bar.append(U.mkBtn("📅 Contrato da turma", "", () => contratoTurma()));
      p.append(bar);
      if (!C.isAdmin)
        p.append(el("p", "hint", "Você cadastra os formandos. Pagamentos e valores são lançados pelo Adriano ou pela Luciana."));
      const chips = el("div", "chips");
      p.append(chips);
      const q = inp("", "Buscar nome ou telefone");
      q.type = "search";
      q.className = "search";
      q.oninput = () => {
        busca = norm(q.value);
        desenhar();
      };
      p.append(q);
      const lst = el("div", "grid");
      p.append(lst);
      unsub = FS.onSnapshot(
        C.isAdmin ? FS.query(col, FS.where("instId", "==", inst.id), FS.limit(2000)) : C.carteira("formandos"),
        snap => {
          lista = snap.docs
            .map(d => Object.assign({ id: d.id }, d.data()))
            .filter(f => f.instId === inst.id)
            .sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));
          desenhar();
        },
        e => {
          avisoErro(e, "carregar os formandos");
          lst.innerHTML = "";
          lst.append(
            el(
              "div",
              "empty",
              e.code === "permission-denied"
                ? "Cole as regras novas do Firebase para usar a lista de formandos."
                : "Não foi possível carregar."
            )
          );
        }
      );

      function desenhar() {
        const ativos = lista.filter(ativo),
          semKit = lista.filter(f => f.status === "semkit"),
          sairam = lista.filter(f => f.status === "desistiu" || f.status === "reprovou"),
          atr = ativos.filter(atrasado);
        const nomesUnicos = new Set(lista.filter(f => !sairam.includes(f)).map(f => norm(f.nome))).size;
        qtdBox.innerHTML = "";
        qtdBox.append(
          document.createTextNode(
            inst.alunosConfirmados
              ? `Alunos confirmados: ${inst.alunosConfirmados} · cadastrados aqui: ${nomesUnicos}`
              : `Previsão de alunos (média): ${inst.mediaAlunos ? "~" + inst.mediaAlunos : "não informada"} · cadastrados aqui: ${nomesUnicos}`
          )
        );
        if (nomesUnicos && nomesUnicos !== inst.alunosConfirmados) {
          const b = U.mkBtn(`✔ Confirmar quantidade certa: ${nomesUnicos} alunos`, "btn-verde", async () => {
            try {
              await FS.updateDoc(FS.doc(db, "instituicoes", inst.id), {
                alunosConfirmados: nomesUnicos,
                alunosEstimado: false,
                alunosConfirmadosEm: hoje(),
                atualizadoEm: new Date().toISOString()
              });
              inst.alunosConfirmados = nomesUnicos;
              U.toast("Quantidade de alunos confirmada");
              desenhar();
            } catch (e) {
              C.handleErr(e);
            }
          });
          b.style.marginLeft = "8px";
          qtdBox.append(b);
        }
        // contrato item 4.3: mínimo de 30 formandos na solenidade
        const total = inst.alunosConfirmados || nomesUnicos;
        if (total && total < MINIMO_FORMANDOS)
          qtdBox.append(
            el(
              "p",
              "wait",
              `⚠️ Turma com ${total} formandos: o contrato pede no mínimo ${MINIMO_FORMANDOS}. Renegociar com o colégio (item 4.3).`
            )
          );
        const ct = inst.contratoTurma || {};
        qtdBox.append(
          el(
            "p",
            "hint",
            ct.inicio
              ? `Contrato da turma: parcelas todo dia 05 a partir de ${U.fmtDate(ct.inicio)}/${ct.inicio.slice(0, 4)}. Quem entra depois paga em menos parcelas e termina junto.`
              : "Contrato da turma: 1º vencimento ainda não definido (o Adriano define em “📅 Contrato da turma”). Até lá, começa no próximo dia 05."
          )
        );
        const ant = ativos.filter(f => f.venda !== "pos").length,
          pos = ativos.filter(f => f.venda === "pos").length;
        const vendido = somar(ativos.map(f => f.valor)),
          rec = somar(ativos.map(recebido));
        resumo.innerHTML = "";
        [
          ["Compraram", `${ativos.length} de ${nomesUnicos}`],
          ["Antecipado · depois das fotos", `${ant} · ${pos}`],
          ["Ainda não compraram", String(semKit.length)],
          ["Vendido", brl(vendido)],
          ["Recebido", brl(rec)],
          ["Em aberto", brl(somar(ativos.map(emAberto)))],
          ["Atrasados", String(atr.length)]
        ].forEach(([t, v], i) => {
          const c = el("div", "kpi" + (i === 6 && atr.length ? " late" : ""));
          c.append(el("small", null, t), el("b", null, v));
          resumo.append(c);
        });
        chips.innerHTML = "";
        [
          ["todos", "Todos", lista.length - sairam.length],
          ["atrasados", "Atrasados", atr.length],
          ["aberto", "Em dia", ativos.filter(f => !quitado(f) && !atrasado(f)).length],
          ["quitados", "Quitados", ativos.filter(quitado).length],
          ["semkit", "📸 Ainda não compraram", semKit.length],
          ["adesao", "🎓 Adesão (Kit 01)", ativos.filter(ehColacao).length],
          ["kits", "📘 Kits 02 a 05", ativos.filter(f => !ehColacao(f)).length],
          ["sairam", "Desistiram / reprovaram", sairam.length]
        ].forEach(([k, t, n]) => {
          const b = el("button", "chip", t);
          b.type = "button";
          b.setAttribute("aria-pressed", String(filtro === k));
          b.append(el("span", "n", String(n)));
          b.onclick = () => {
            filtro = k;
            desenhar();
          };
          chips.append(b);
        });
        const passa = f =>
          ({
            todos: !sairam.includes(f),
            atrasados: ativo(f) && atrasado(f),
            quitados: ativo(f) && quitado(f),
            aberto: ativo(f) && !quitado(f) && !atrasado(f),
            semkit: f.status === "semkit",
            adesao: ativo(f) && ehColacao(f),
            kits: ativo(f) && !ehColacao(f),
            sairam: sairam.includes(f)
          })[filtro];
        let arr = lista.filter(passa);
        if (busca)
          arr = arr.filter(
            f =>
              norm(f.nome + " " + f.tel + " " + f.serie).includes(busca) ||
              (busca.replace(/\D/g, "") &&
                String(f.tel || "")
                  .replace(/\D/g, "")
                  .includes(busca.replace(/\D/g, "")))
          );
        lst.innerHTML = "";
        if (!lista.length) {
          const e = el("div", "empty");
          e.append(
            el("strong", null, "Nenhum formando ainda"),
            el("span", null, "Toque em “+ Formando”" + (C.isAdmin ? " ou importe a planilha da turma." : "."))
          );
          lst.append(e);
          return;
        }
        if (!arr.length) {
          lst.append(el("div", "empty", "Ninguém nesse filtro."));
          return;
        }
        emPartes(lst, arr, card);
      }
      function card(f) {
        const comprou = ativo(f),
          sem = f.status === "semkit",
          saiu = !comprou && !sem;
        const at = comprou && atrasado(f),
          q0 = comprou && quitado(f),
          pg = pagasDe(f),
          np = nParcelas(f);
        const e = el("article", "card " + (saiu ? "" : at ? "late" : q0 ? "won" : sem ? "today" : ""));
        const top = el("div", "card-top");
        top.append(
          el("h3", "name", title(f.nome)),
          el(
            "span",
            "stage",
            saiu
              ? SITUACOES[f.status].toUpperCase()
              : sem
                ? "AINDA NÃO COMPROU"
                : f.entregueEm
                  ? "ENTREGUE"
                  : q0
                    ? "QUITADO"
                    : at
                      ? "ATRASADO"
                      : "EM DIA"
          )
        );
        e.append(top);
        const meta = el("div", "meta");
        [
          f.serie,
          sem ? "" : f.kit || (ehColacao(f) ? "Kit 01 · Beca + canudo (adesão)" : "Kit"),
          comprou ? (f.venda === "pos" ? "Depois das fotos" : "Antecipado") : "",
          f.valor && !sem ? brl(f.valor) : "",
          comprou ? f.formaPag : "",
          f.tel
        ]
          .filter(Boolean)
          .forEach((t, i) => meta.append(el("span", "tag" + (i === 1 ? " svc" : ""), t)));
        e.append(meta);
        if (comprou)
          e.append(
            el(
              "div",
              "fu " + (at ? "late" : ""),
              q0
                ? `${np}/${np} parcelas pagas ✓`
                : `${pg}/${np} pagas · ${brl(valorParcela(f, pg + 1))} por parcela` +
                    (f.primeiroVenc ? ` · ${at ? "venceu" : "vence"} ${U.fmtDate(vencDa(f, pg + 1))}` : "")
            )
          );
        // entrega: só com o contrato quitado (item 4.4), em até 120 dias úteis (item 3.1)
        if (q0)
          e.append(
            el(
              "div",
              "fu ok",
              f.entregueEm
                ? `📦 Entregue em ${U.fmtDate(f.entregueEm)}/${f.entregueEm.slice(0, 4)}`
                : `📦 Quitado em ${U.fmtDate(quitadoEm(f))} · entrega até ${U.fmtDate(previsaoEntrega(f))}/${previsaoEntrega(f).slice(0, 4)}`
            )
          );
        if (saiu && f.devolucao) e.append(el("div", "fu", `↩️ Devolução: ${brl(f.devolucao.valor)} (${f.devolucao.regra})`));
        if (f.obs) e.append(el("p", "notes", f.obs));
        const act = el("div", "actions");
        if (C.isAdmin && comprou && !q0)
          act.append(U.mkBtn("✅ Parcela paga", "btn-ok", () => registrarPagamento(f).catch(er => C.handleErr(er))));
        if (comprou && !q0 && f.tel) act.append(U.mkBtn("💬 Cobrar", at ? "btn-primary" : "", () => cobrarWa(f)));
        if (C.isAdmin && q0 && !f.entregueEm)
          act.append(
            U.mkBtn("📦 Marcar entregue", "btn-verde", () =>
              FS.updateDoc(FS.doc(db, "formandos", f.id), { entregueEm: hoje(), atualizadoEm: new Date().toISOString() })
                .then(() => U.toast("Entrega registrada"))
                .catch(er => C.handleErr(er))
            )
          );
        if (sem && f.tel) act.append(U.mkBtn("💬 Oferecer kit", "btn-primary", () => oferecerKit(C, inst, f)));
        if (sem) act.append(U.mkBtn("🛒 Comprou", "btn-ok", () => form(f, { venda: "pos" })));
        act.append(U.mkBtn("Editar", "", () => form(f)));
        e.append(act);
        return e;
      }

      function form(f, preset) {
        const adm = C.isAdmin,
          kits = kitsDe(C.P);
        preset = preset || {};
        sheet(f ? (preset.venda ? "Venda depois das fotos" : "Editar formando") : "Novo formando", (fp, fechar) => {
          const nome = inp(f ? title(f.nome) : "", "nome do formando");
          nome.required = true;
          nome.disabled = !!f && !adm;
          const tel = inp(f ? f.tel : "", "WhatsApp do responsável", 30);
          tel.inputMode = "tel";
          const r1 = el("div", "row2");
          r1.append(field("Nome", nome), field("WhatsApp", tel));
          fp.append(r1);
          // Kit do contrato (ou "ainda não comprou": fica na lista para vender depois das fotos)
          const kitAtual = f ? f.kitId || (f.status === "semkit" ? "sem" : ehColacao(f) ? "k01" : f.kit ? "outro" : "sem") : "sem";
          const kit = sel(
            [["sem", "Ainda não comprou"], ...kits.map(k => [k.id, k.nome]), ["outro", "Outro kit (digitar)"]],
            preset.kitId || kitAtual
          );
          const venda = sel(
            [
              ["ant", "Antecipada (preço do contrato)"],
              ["pos", "Depois das fotos (preço maior)"]
            ],
            preset.venda || (f && f.venda) || "ant"
          );
          const r0 = el("div", "row2");
          r0.append(field("Kit", kit), field("Venda", venda));
          fp.append(r0);
          const kitTxt = inp(f && kitAtual === "outro" ? f.kit : "", "nome do kit", 80);
          const fKitTxt = field("Qual kit", kitTxt);
          fp.append(fKitTxt);
          const serie = sel(["Pré", "5º ano", "9º ano", "Ensino médio", "Outra"], f ? f.serie : "", "série");
          fp.append(field("Série", serie));
          const valor = inpReais(f ? f.valor : "");
          const parc = inp(f ? f.parcelas || "" : "1", "1", 3);
          parc.inputMode = "numeric";
          const jaPagas = inp("0", "0", 3);
          jaPagas.inputMode = "numeric";
          const r3 = el("div", f ? "row2" : "row3");
          r3.append(field("Valor total", valor), field("Parcelas", parc));
          if (!f && adm) r3.append(field("Parcelas já pagas", jaPagas));
          fp.append(r3);
          const venc = el("input");
          venc.type = "date";
          venc.value = f ? f.primeiroVenc || "" : proximoVenc(hoje());
          const fpg = sel(FORMAS, f ? f.formaPag : "", "forma de pagamento");
          const st = sel(
            [
              ["ativo", "Comprou"],
              ["desistiu", "Desistiu"],
              ["reprovou", "Reprovou"]
            ],
            f && ["desistiu", "reprovou"].includes(f.status) ? f.status : "ativo"
          );
          const r4 = el("div", "row3");
          r4.append(field("1º vencimento", venc), field("Pagamento", fpg), field("Situação", st));
          fp.append(r4);
          const parcInfo = el("p", "hint");
          fp.append(parcInfo);
          // Devolução (contrato item 5.0): desistência devolve 70% do pago; reprovação, o pago menos os serviços já feitos
          const pago = f ? recebido(f) : 0;
          const serv = inpReais(f && f.devolucao ? f.devolucao.servicos : "");
          const fServ = field("Serviços já feitos (descontar)", serv);
          const devInfo = el("p", "wait");
          fp.append(fServ, devInfo);
          const atualizaInfo = () => {
            const v = lerReais(valor.value),
              n = Math.max(1, n0(parc.value));
            const ps = dividir(v, n);
            parcInfo.textContent = v
              ? `${n}x de ${brl(ps[ps.length - 1])}${ps[0] !== ps[ps.length - 1] ? ` (a 1ª de ${brl(ps[0])})` : ""} · vencimento todo dia ${venc.value.slice(8) || "05"}`
              : "";
            const sai = st.value === "desistiu" || st.value === "reprovou";
            fServ.hidden = st.value !== "reprovou";
            devInfo.hidden = !sai || !pago;
            if (sai && pago)
              devInfo.textContent =
                st.value === "desistiu"
                  ? `Desistência: devolver ${DEVOLVE_DESISTENCIA}% do que pagou (${brl(pago)}) = ${brl(devolucao("desistiu", pago))}.`
                  : `Reprovação: devolver o que pagou (${brl(pago)}) menos os serviços já feitos = ${brl(devolucao("reprovou", pago, lerReais(serv.value)))}. Precisa do documento da secretaria.`;
          };
          // Preenche valor, parcelas e 1º vencimento pela tabela do contrato (antecipado: termina junto com a turma)
          const aplicarPlano = () => {
            const sem = kit.value === "sem",
              outro = kit.value === "outro";
            fKitTxt.hidden = !outro;
            [r3, r4].forEach(x => (x.hidden = sem));
            venda.disabled = sem || (!!f && !adm && !preset.venda);
            if (sem || outro) return atualizaInfo();
            const k = kits.find(x => x.id === kit.value),
              pl = plano(k, venda.value, (inst.contratoTurma || {}).inicio, hoje());
            if (!pl) {
              parcInfo.textContent = "";
              valor.value = "";
              U.toast(
                venda.value === "pos" ? "Defina o preço depois das fotos deste kit em “📋 Kits e preços”" : "Kit sem preço na tabela"
              );
              return;
            }
            valor.value = String(pl.valor).replace(".", ",");
            valor.dispatchEvent(new Event("focusout", { bubbles: true }));
            parc.value = pl.parcelas;
            venc.value = pl.primeiroVenc;
            if (ehAdesao(k.id)) fpg.value = fpg.value || "Pix";
            atualizaInfo();
          };
          valor.addEventListener("input", atualizaInfo);
          parc.addEventListener("input", atualizaInfo);
          serv.addEventListener("input", atualizaInfo);
          st.addEventListener("change", atualizaInfo);
          kit.addEventListener("change", aplicarPlano);
          venda.addEventListener("change", aplicarPlano);
          if (!f || preset.venda) aplicarPlano();
          else {
            fKitTxt.hidden = kit.value !== "outro";
            [r3, r4].forEach(x => (x.hidden = kit.value === "sem"));
            atualizaInfo();
          }
          // Depois de cadastrado, só o admin muda dinheiro e contrato (na venda depois das fotos, a equipe escolhe o kit)
          if (f && !adm)
            (preset.venda ? [valor, parc, venc, st] : [kit, venda, serie, valor, parc, venc, fpg, st]).forEach(i => {
              i.disabled = true;
            });
          if (f && !adm && !preset.venda) fp.append(el("p", "hint", "Valores, kit e situação só o Adriano ou a Luciana mudam."));
          // Pagamentos já lançados (só admin desfaz)
          if (f && pagasDe(f)) {
            const box = el("div", "notes");
            box.textContent =
              "Pagamentos: " +
              pagamentosDe(f)
                .map((pg, i) => `${i + 1}ª ${brl(pg.valor)} em ${pg.data ? U.fmtDate(pg.data) : "—"}`)
                .join(" · ");
            fp.append(box);
            if (adm) {
              const b = el("button", "btn btn-sm", "Desfazer o último pagamento");
              b.type = "button";
              b.onclick = async () => {
                if (!fp._desf) {
                  fp._desf = true;
                  b.textContent = "Toque de novo para desfazer";
                  return;
                }
                try {
                  await desfazerPagamento(f);
                  fechar();
                } catch (er) {
                  C.handleErr(er);
                }
              };
              fp.append(b);
            }
          }
          const obs = el("textarea");
          obs.rows = 2;
          obs.maxLength = 500;
          obs.value = f ? f.obs || "" : "";
          fp.append(field("Observação", obs));
          const err = el("p", "err");
          err.hidden = true;
          fp.append(err);
          const a = botoes(fechar, preset.venda ? "Registrar venda" : "Salvar");
          if (f && adm) {
            const del = el("button", "btn btn-danger", "Excluir");
            del.type = "button";
            del.onclick = async () => {
              if (!fp._del) {
                fp._del = true;
                del.textContent = "Toque de novo";
                return;
              }
              try {
                await FS.deleteDoc(FS.doc(db, "formandos", f.id));
                fechar();
                U.toast("Excluído");
              } catch (er) {
                C.handleErr(er);
              }
            };
            a.prepend(del);
          }
          fp.append(a);
          setTimeout(() => (f ? tel : nome).focus(), 30);
          fp.addEventListener("submit", async ev => {
            ev.preventDefault();
            err.hidden = true;
            const agora = new Date().toISOString();
            try {
              if (f && !adm && !preset.venda) {
                await FS.updateDoc(FS.doc(db, "formandos", f.id), { tel: tel.value.trim(), obs: obs.value.trim(), atualizadoEm: agora });
                fechar();
                U.toast("Salvo");
                return;
              }
              const sem = kit.value === "sem",
                k = kits.find(x => x.id === kit.value);
              const P = sem ? 1 : Math.max(1, n0(parc.value)),
                v = sem ? 0 : lerReais(valor.value);
              if (!sem && !v) {
                err.textContent = "Coloque o valor do kit.";
                err.hidden = false;
                return;
              }
              if (P < pagasDe(f || {})) {
                err.textContent = `Já tem ${pagasDe(f)} parcelas pagas; o número de parcelas não pode ser menor.`;
                err.hidden = false;
                return;
              }
              const saiu = st.value === "desistiu" || st.value === "reprovou";
              const body = {
                contrato: sem ? "" : k && ehAdesao(k.id) ? "colacao" : "album",
                kitId: kit.value,
                kit: sem ? "" : k ? k.nome : kitTxt.value.trim(),
                venda: sem ? "" : venda.value,
                nome: nome.value.trim(),
                tel: tel.value.trim(),
                serie: serie.value,
                valor: v,
                parcelas: P,
                primeiroVenc: sem ? "" : venc.value,
                formaPag: sem ? "" : fpg.value,
                status: sem && !saiu ? "semkit" : st.value,
                obs: obs.value.trim(),
                atualizadoEm: agora
              };
              if (saiu && pago) {
                const regra = st.value === "desistiu" ? `desistência: ${DEVOLVE_DESISTENCIA}% do pago` : "reprovação: pago menos serviços";
                body.devolucao = {
                  valor: devolucao(st.value, pago, lerReais(serv.value)),
                  servicos: lerReais(serv.value),
                  regra,
                  em: hoje()
                };
              }
              if (f && f.status === "semkit" && !sem) body.vendidoEm = hoje();
              if (f) {
                // os pagamentos não mudam aqui; recalcula só o próximo vencimento
                const pags = pagamentosDe(f);
                await FS.updateDoc(
                  FS.doc(db, "formandos", f.id),
                  Object.assign(body, {
                    pagamentos: pags,
                    pagas: pags.length,
                    proxVenc: proxVenc(Object.assign({}, f, body, { pagamentos: pags }))
                  })
                );
              } else {
                const n = adm && !sem ? Math.min(P, n0(jaPagas.value)) : 0,
                  vals = dividir(v, P);
                const pags = Array.from({ length: n }, (_, i) => ({ data: hoje(), valor: vals[i], por: C.email || "" }));
                const novo = Object.assign(body, {
                  pagamentos: pags,
                  pagas: n,
                  instId: inst.id,
                  instNome: inst.nome,
                  instTipo: inst.tipo || "",
                  ano: Number(hoje().slice(0, 4)),
                  resp: inst.resp || C.me || "",
                  respEmail: inst.respEmail || (adm ? "" : C.email || ""),
                  vendidoEm: sem ? "" : hoje(),
                  criadoEm: agora,
                  por: C.me || ""
                });
                novo.proxVenc = proxVenc(novo);
                await FS.addDoc(col, novo);
              }
              fechar();
              U.toast(preset.venda ? "Venda registrada 🎉" : f ? "Salvo" : "Formando incluído");
            } catch (er) {
              C.handleErr(er);
            }
          });
        });
      }
      // 1º vencimento da turma (as parcelas antecipadas de todos terminam no mesmo mês) e prazo da venda depois das fotos
      function contratoTurma() {
        sheet("Contrato da turma · " + title(inst.nome), (fp, fechar) => {
          const ct = inst.contratoTurma || {};
          fp.append(
            el(
              "p",
              "hint",
              "As parcelas do contrato vencem todo dia 05. Quem compra antecipado depois do início paga em menos parcelas e termina junto com a turma."
            )
          );
          const ini = el("input");
          ini.type = "date";
          ini.value = ct.inicio || proximoVenc(hoje());
          const dias = inp(ct.posFotoDias || 30, "30", 3);
          dias.inputMode = "numeric";
          const r = el("div", "row2");
          r.append(field("1º vencimento da turma", ini), field("Dias para comprar depois das fotos", dias));
          fp.append(r);
          fp.append(botoes(fechar, "Salvar"));
          fp.addEventListener("submit", async ev => {
            ev.preventDefault();
            const novo = { inicio: ini.value, posFotoDias: Math.max(1, n0(dias.value)) };
            try {
              await FS.updateDoc(FS.doc(db, "instituicoes", inst.id), { contratoTurma: novo, atualizadoEm: new Date().toISOString() });
              inst.contratoTurma = novo;
              fechar();
              U.toast("Contrato da turma salvo");
              desenhar();
            } catch (e) {
              C.handleErr(e);
            }
          });
        });
      }
      function importar() {
        sheet("Importar formandos", (fp, fechar) => {
          fp.append(
            el(
              "p",
              "hint",
              "Planilha do Excel com as colunas (os nomes podem variar): NOME, TELEFONE, SÉRIE, KIT (01 a 05), VALOR, PARCELAS, PAGAS, VENCIMENTO e PAGAMENTO. Só o nome é obrigatório; quem vier sem kit entra como “ainda não comprou” (venda depois das fotos)."
            )
          );
          const file = el("input");
          file.type = "file";
          file.accept = ".xlsx,.xls,.csv";
          fp.append(file);
          const prev = el("div", "imp");
          fp.append(prev);
          const a = botoes(fechar, "Importar");
          a.ok.disabled = true;
          fp.append(a);
          let linhas = [];
          file.onchange = async () => {
            prev.textContent = "Lendo…";
            try {
              const XLSX = await loadXLSX();
              const wb = XLSX.read(await file.files[0].arrayBuffer(), { cellDates: true });
              const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
              const pega = (r, ...ks) => {
                const e = Object.entries(r).find(([k]) => ks.some(x => norm(k).includes(x)));
                return e ? e[1] : "";
              };
              const isoDe = v =>
                v instanceof Date
                  ? `${v.getFullYear()}-${U.pad(v.getMonth() + 1)}-${U.pad(v.getDate())}`
                  : /^(\d{2})\/(\d{2})\/(\d{4})$/.test(String(v).trim())
                    ? String(v)
                        .trim()
                        .replace(/^(\d{2})\/(\d{2})\/(\d{4})$/, "$3-$2-$1")
                    : "";
              const ja = new Set(lista.map(f => norm(f.nome)));
              const kits = kitsDe(C.P);
              linhas = rows
                .map(r => {
                  // kit pelo número (01 a 05); sem kit = ainda não comprou (entra na venda depois das fotos)
                  const kTxt = String(pega(r, "kit", "produto", "pacote")).trim(),
                    num = (kTxt.match(/0?([1-5])\b/) || [])[1],
                    k = num ? kits.find(x => x.id === "k0" + num) : null,
                    cola = /cola|adesao/.test(norm(pega(r, "contrato", "colacao", "tipo")));
                  const kk = k || (cola ? kits.find(x => x.id === "k01") : null);
                  const valor = lerReais(pega(r, "valor", "preco", "total")) || (kk ? Number(kk.ant.valor) || 0 : 0);
                  const sem = !kk && !kTxt && !valor;
                  return {
                    contrato: sem ? "" : kk && kk.id === "k01" ? "colacao" : "album",
                    kitId: sem ? "sem" : kk ? kk.id : "outro",
                    kit: sem ? "" : kk ? kk.nome : kTxt,
                    venda: sem ? "" : "ant",
                    status: sem ? "semkit" : "ativo",
                    nome: String(pega(r, "nome", "formando", "aluno")).trim(),
                    tel: String(pega(r, "telefone", "celular", "whats", "tel")).trim(),
                    serie: String(pega(r, "serie", "turma", "ano")).trim(),
                    valor,
                    parcelas: sem ? 1 : Math.max(1, n0(pega(r, "parcela")) || (kk ? Number(kk.ant.parcelas) || 1 : 1)),
                    primeiroVenc: sem ? "" : isoDe(pega(r, "venc")) || (inst.contratoTurma || {}).inicio || proximoVenc(hoje()),
                    formaPag: sem ? "" : String(pega(r, "pagamento", "forma")).trim(),
                    pagasPlan: n0(pega(r, "paga"))
                  };
                })
                .filter(x => x.nome && !ja.has(norm(x.nome)));
              prev.textContent = linhas.length
                ? `${linhas.length} formando${linhas.length > 1 ? "s" : ""} novo${linhas.length > 1 ? "s" : ""}: ${linhas
                    .slice(0, 5)
                    .map(x => title(x.nome))
                    .join(", ")}${linhas.length > 5 ? "…" : ""}`
                : "Nenhum formando novo na planilha.";
              a.ok.disabled = !linhas.length;
            } catch (e) {
              avisoErro(e, "ler a planilha");
              prev.textContent = "Não consegui ler a planilha.";
            }
          };
          fp.addEventListener("submit", async ev => {
            ev.preventDefault();
            a.ok.disabled = true;
            let n = 0;
            const agora = new Date().toISOString();
            try {
              // grava em lotes: cada lote entra inteiro ou não entra
              for (let i = 0; i < linhas.length; i += 400) {
                const b = FS.writeBatch(db);
                linhas.slice(i, i + 400).forEach(x => {
                  const pg = Math.min(x.pagasPlan, x.parcelas),
                    vals = dividir(x.valor, x.parcelas);
                  delete x.pagasPlan;
                  const d = Object.assign(x, {
                    pagamentos: Array.from({ length: pg }, (_, k) => ({ data: hoje(), valor: vals[k], por: C.email || "" })),
                    pagas: pg,
                    instId: inst.id,
                    instNome: inst.nome,
                    instTipo: inst.tipo || "",
                    ano: Number(hoje().slice(0, 4)),
                    resp: inst.resp || "",
                    respEmail: inst.respEmail || "",
                    vendidoEm: hoje(),
                    criadoEm: agora,
                    por: C.me || ""
                  });
                  d.proxVenc = proxVenc(d);
                  b.set(FS.doc(col), d);
                });
                await b.commit();
                n = Math.min(linhas.length, i + 400);
                prev.textContent = `Importando… ${n} de ${linhas.length}`;
              }
              fechar();
              U.toast(`${n} formando${n > 1 ? "s" : ""} importado${n > 1 ? "s" : ""}`);
            } catch (e) {
              C.handleErr(e);
              prev.textContent = `Importados ${n} de ${linhas.length}. Importe de novo: quem já entrou não é duplicado.`;
              a.ok.disabled = false;
            }
          });
        });
      }
    },
    {
      div: true,
      wide: true,
      onClose: () => {
        if (unsub) {
          unsub();
          unsub = null;
        }
        if (aoFechar) aoFechar();
      }
    }
  );
  return close;
}
function loadXLSX() {
  return carregarLib("xlsx");
}
