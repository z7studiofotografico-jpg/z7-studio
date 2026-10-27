// Turma de um colégio FECHADO: formandos, kits (Kit 01 = adesão; Kits 02 a 05), parcelas e cobrança.
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
  ehKit01,
  ativo,
  SITUACOES,
  FORMAS
} from "./regras.js";
import {
  kitsDe,
  plano,
  ehAdesao,
  ehRepasse,
  anoDaTurma,
  previsaoEntrega,
  quitadoEm,
  devolucao,
  proximoVenc,
  vendaSugerida,
  diferencasDaTurma,
  candidatosPosFoto,
  MINIMO_FORMANDOS,
  DEVOLVE_DESISTENCIA
} from "./contrato.js";
import { msgCobranca, msgOfertaKit } from "./mensagens.js";
import { contratoTurma, kitsTurma, importarFormandos } from "./turma-ajustes.js";
import { el, title, norm, field, inp, inpReais, sel, sheet, botoes, wa, avisoErro, emPartes } from "./ui.js";
import * as U from "./util.js";
let C,
  FS,
  db,
  unsub = null;
const n0 = v => Number(v) || 0;
const hoje = () => U.todayStr();
export const atrasado = f => atrasadoEm(f, hoje());
export { quitado, ehKit01, vencDa };

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
    col = ehKit01(f);
  const item = col ? "da adesão da formatura (Kit 01)" : `do ${f.kit || "kit da formatura"}`;
  const pagar = f.formaPag === "Boleto" ? "\nO pagamento é pelo boleto." : C.P.pix ? `\nChave Pix: ${C.P.pix}` : "";
  const msg = msgCobranca({
    nome: title(f.nome),
    parcela: `${prox}/${nParcelas(f)}`,
    item,
    valor: brl(valorParcela(f, prox)),
    venc: venc ? U.fmtDate(venc) : "",
    atrasada: atrasado(f),
    pagar
  });
  wa(f.tel, msg, U.toast);
}
// Mensagem para quem tem só o Kit 01: as fotos ficaram prontas, kits no preço depois das fotos (tabela da turma)
// Kits no preço depois das fotos (tabela da turma), uma linha por kit
export function linhasKitsPos(P, inst) {
  // turma de ano anterior: preço de repasse
  const q = ehRepasse(inst, hoje()) ? "rep" : "pos";
  return kitsDe(P, inst)
    .filter(k => !ehAdesao(k.id) && k[q] && Number(k[q].valor))
    .map(k => {
      const n = Math.max(1, Number(k[q].parcelas) || 1);
      return `• ${k.nome}: ${n > 1 ? `${n}x de ${brl(dividir(k[q].valor, n)[n - 1])} (${brl(k[q].valor)})` : brl(k[q].valor)}`;
    });
}
// Prévia da formatura (todas as fotos do kit e prévia do álbum), com os kits na mensagem
export async function abrirPrevia(ctx, inst, f) {
  setCtx(ctx);
  try {
    const { openPrevia } = await import("./previa.js");
    openPrevia({
      nome: title(f.nome),
      escola: title(inst.nome || f.instNome || ""),
      kits: linhasKitsPos(C.P, inst).join("\n"),
      toast: U.toast
    });
  } catch (e) {
    avisoErro(e, "abrir a prévia", U.toast);
  }
}
export function oferecerKit(ctx, inst, f) {
  setCtx(ctx);
  const rep = ehRepasse(inst, hoje()),
    lin = linhasKitsPos(C.P, inst);
  if (!lin.length) return U.toast(`Defina os preços ${rep ? "de repasse" : "depois das fotos"} em “📋 Kits e preços” (card Formaturas)`);
  const msg = msgOfertaKit({ nome: title(f.nome), escola: title(inst.nome), linhas: lin, repasse: rep, ano: anoDaTurma(inst) });
  wa(f.tel, msg, U.toast);
}
// opcoes.novo = abre já com o formulário de formando novo (botão "+ Formando" do card Formaturas)
export function openTurma(ctx, inst, kits, aoFechar, opcoes) {
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
      if (C.isAdmin) bar.append(U.mkBtn("Importar planilha", "", () => importarFormandos(C, inst, lista)));
      if (C.isAdmin)
        bar.append(
          U.mkBtn("📅 Contrato da turma", "", () => contratoTurma(C, inst, desenhar)),
          U.mkBtn("📋 Kits desta turma", "", () => kitsTurma(C, inst, desenhar))
        );
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
      if (opcoes && opcoes.novo) setTimeout(() => form(), 0);
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
          semKit = candidatosPosFoto(lista),
          candSet = new Set(semKit), // calculado uma vez por desenho (antes era por cartão: travava turmas grandes)
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
        // valores e vezes desta turma (aviso), marcando o que é diferente da tabela padrão
        const dif = diferencasDaTurma(C.P, inst),
          kt = kitsDe(C.P, inst).filter(k => Number(k.ant.valor));
        const av = el("div", dif.length ? "wait" : "notes");
        av.append(
          el("b", null, dif.length ? "⚠️ Valores desta turma (diferentes da tabela padrão):" : "Valores desta turma (tabela padrão):")
        );
        kt.forEach(k => {
          const n = Math.max(1, Number(k.ant.parcelas) || 1),
            px = q => {
              const nn = Math.max(1, Number((k[q] || {}).parcelas) || 1);
              return Number((k[q] || {}).valor) ? `${nn}x de ${brl(dividir(k[q].valor, nn)[nn - 1])}` : "";
            };
          const txt =
            `${k.nome.split(" · ")[0]}: ${n}x de ${brl(dividir(k.ant.valor, n)[n - 1])} (${brl(k.ant.valor)})` +
            (px("pos") ? ` · depois das fotos ${px("pos")}` : "") +
            (px("rep") ? ` · repasse ${px("rep")}` : "");
          const mudou = dif.some(d => d.startsWith(k.id + "|"));
          av.append(el("div", null, (mudou ? "✏️ " : "• ") + txt));
        });
        qtdBox.append(av);
        if (ehRepasse(inst, hoje()))
          qtdBox.append(
            el(
              "p",
              "hint",
              `🔁 Turma de ${anoDaTurma(inst)} (Repasse): quem ficou só com o Kit 01 pode receber a oferta no preço de repasse (${semKit.length}).`
            )
          );
        else if (ct.fotosProntasEm)
          qtdBox.append(
            el(
              "p",
              "hint",
              `📸 Fotos prontas desde ${U.fmtDate(ct.fotosProntasEm)}: pode oferecer os kits para quem tem só o Kit 01 (${semKit.length}).`
            )
          );
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
          ["Formandos", String(nomesUnicos)],
          ["Antecipado · depois das fotos", `${ant} · ${pos}`],
          ["Só Kit 01 (oferecer depois)", String(semKit.length)],
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
          ["semkit", "📸 Só Kit 01", semKit.length],
          ["adesao", "🎓 Adesão (Kit 01)", ativos.filter(ehKit01).length],
          ["kits", "📘 Kits 02 a 05", ativos.filter(f => !ehKit01(f)).length],
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
            semkit: candSet.has(f),
            adesao: ativo(f) && ehKit01(f),
            kits: ativo(f) && !ehKit01(f),
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
        emPartes(lst, arr, f => card(f, candSet));
      }
      function card(f, candSet) {
        const cand = candSet.has(f),
          prontas = !!(inst.contratoTurma || {}).fotosProntasEm || ehRepasse(inst, hoje());
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
          sem ? "" : f.kit || (ehKit01(f) ? "Kit 01 · Beca + canudo (adesão)" : "Kit"),
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
        // venda depois das fotos: quem tem só o Kit 01, quando as fotos ficaram prontas
        if (cand && prontas && f.tel) act.append(U.mkBtn("💬 Oferecer kit", "btn-primary", () => oferecerKit(C, inst, f)));
        if (cand && prontas) act.append(U.mkBtn("🖼️ Prévia", "", () => abrirPrevia(C, inst, f)));
        const vendaOferta = ehRepasse(inst, hoje()) ? "rep" : "pos";
        if (cand && prontas)
          act.append(
            U.mkBtn("🛒 Comprou kit", "btn-ok", () => (sem ? form(f, { venda: vendaOferta }) : form(null, { venda: vendaOferta, base: f })))
          );
        act.append(U.mkBtn("Editar", "", () => form(f)));
        e.append(act);
        return e;
      }

      function form(f, preset) {
        const adm = C.isAdmin,
          base = preset && preset.base,
          kitsTodos = kitsDe(C.P, inst);
        preset = preset || {};
        // na venda depois das fotos (compra a mais de quem já tem o Kit 01) só aparecem os kits 02 a 05
        const kits = preset.venda ? kitsTodos.filter(k => !ehAdesao(k.id)) : kitsTodos;
        const tituloVenda = preset.venda === "rep" ? "Venda no repasse" : "Venda depois das fotos";
        sheet(preset.venda ? tituloVenda : f ? "Editar formando" : "Novo formando", (fp, fechar) => {
          const nome = inp(f ? title(f.nome) : base ? title(base.nome) : "", "nome do formando");
          nome.required = true;
          nome.disabled = !!f && !adm;
          const tel = inp(f ? f.tel : base ? base.tel : "", "WhatsApp do responsável", 30);
          tel.inputMode = "tel";
          const r1 = el("div", "row2");
          r1.append(field("Nome", nome), field("WhatsApp", tel));
          fp.append(r1);
          // Kit do contrato: todo formando entra pelo menos com o Kit 01 (adesão)
          const kitAtual =
            f && f.status !== "semkit" ? f.kitId || (ehKit01(f) ? "k01" : f.kit ? "outro" : "k01") : preset.venda ? "k04" : "k01";
          const kit = sel([...kits.map(k => [k.id, k.nome]), ["outro", "Outro kit (digitar)"]], preset.kitId || kitAtual);
          const venda = sel(
            [
              ["ant", "Antecipada (preço do contrato)"],
              ["pos", "Depois das fotos (preço maior)"],
              ["rep", "Repasse (turma de ano anterior)"]
            ],
            preset.venda || (f && f.venda) || vendaSugerida(inst, hoje())
          );
          const r0 = el("div", "row2");
          r0.append(field("Kit", kit), field("Venda", venda));
          fp.append(r0);
          const kitTxt = inp(f && kitAtual === "outro" ? f.kit : "", "nome do kit", 80);
          const fKitTxt = field("Qual kit", kitTxt);
          fp.append(fKitTxt);
          const serie = sel(["Pré", "5º ano", "9º ano", "Ensino médio", "Outra"], f ? f.serie : base ? base.serie : "", "série");
          // depois da formatura, o antecipado não vale mais
          const avisoVenda = el("p", "wait");
          fp.append(avisoVenda);
          const confereVenda = () => {
            const passou = vendaSugerida(inst, hoje()) === "pos";
            avisoVenda.hidden = !(passou && venda.value === "ant");
            avisoVenda.textContent = `A formatura foi em ${U.fmtDate(inst.formatura && inst.formatura.data)}: depois dela vale o preço depois das fotos (o antecipado era até o dia da formatura).`;
          };
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
          let avisoPlano = "";
          const atualizaInfo = () => {
            const v = lerReais(valor.value),
              n = Math.max(1, n0(parc.value));
            const ps = dividir(v, n);
            parcInfo.textContent = v
              ? `${n}x de ${brl(ps[ps.length - 1])}${ps[0] !== ps[ps.length - 1] ? ` (a 1ª de ${brl(ps[0])})` : ""} · vencimento todo dia ${venc.value.slice(8) || "05"}`
              : "";
            if (v && avisoPlano) parcInfo.textContent += " · ⚠️ " + avisoPlano;
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
            const outro = kit.value === "outro";
            confereVenda();
            fKitTxt.hidden = !outro;
            venda.disabled = !!f && !adm && !preset.venda;
            if (outro) return atualizaInfo();
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
            avisoPlano = pl.aviso;
            if (pl.aviso) U.toast(pl.aviso);
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
            confereVenda();
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
          if (preset.venda)
            fp.insertBefore(
              el(
                "p",
                "hint",
                `Compra a mais${preset.venda === "rep" ? " no repasse" : ", depois das fotos"}: o Kit 01 que o aluno já tem continua como está. O valor vem da tabela da turma e pode ser mudado se combinaram outro.`
              ),
              fp.firstChild.nextSibling
            );
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
              // formando repetido na turma: não cadastra de novo (para outro kit, use "🛒 Comprou kit" no cartão dele)
              if (!f && !preset.base) {
                const igual = lista.find(x => ativo(x) && U.chave(x.nome) === U.chave(nome.value));
                if (igual) {
                  err.textContent = `${title(igual.nome)} já está cadastrado nesta turma. Para vender outro kit, use “🛒 Comprou kit” no cartão dele.`;
                  err.hidden = false;
                  return;
                }
              }
              const k = kits.find(x => x.id === kit.value);
              const P = Math.max(1, n0(parc.value)),
                v = lerReais(valor.value);
              if (!v) {
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
                contrato: k && ehAdesao(k.id) ? "adesao" : "album",
                kitId: kit.value,
                kit: k ? k.nome : kitTxt.value.trim(),
                venda: venda.value,
                nome: nome.value.trim(),
                tel: tel.value.trim(),
                serie: serie.value,
                valor: v,
                parcelas: P,
                primeiroVenc: venc.value,
                formaPag: fpg.value,
                status: st.value,
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
              if (f && f.status === "semkit") body.vendidoEm = hoje();
              if (base) body.compraDe = base.id; // compra a mais de quem já tinha o Kit 01
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
                const n = adm ? Math.min(P, n0(jaPagas.value)) : 0,
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
                  vendidoEm: hoje(),
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
