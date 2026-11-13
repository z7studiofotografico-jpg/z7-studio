// PR: o cartão de cada contato (para quem mandar, a mensagem pronta, os botões de cada etapa)
import { excluir, faixaExclusao, pedirTexto, escolher } from "./confirmar.js";
import { openMockup, textoEscolha } from "./mockup.js";
import { el, title, sheet as sheetUi } from "./ui.js";
import * as U from "./util.js";
import { faltando, situacaoTxt, enderecoTxt, historicoPlanilha, prazoEntrega, MOTIVOS_CAIDO, motivoPreco } from "./repasse-dados.js";
import { avisoTel } from "./aluno-id.js";
import { fmtTel } from "./numeros.js";
import { whatsAtivo } from "./numeros-tela.js";
import { linhasRetorno, abrirRetorno } from "./retorno.js";
import {
  colNome,
  ehFormatura,
  C,
  tab,
  seg,
  ABERTAS,
  segDe,
  segNome,
  status,
  lockInfo,
  contatoPadrao,
  contatoAtual,
  escolherContato,
  vendaDe,
  precos,
  precoTxt,
  cartaoTxt,
  parcDe,
  assumir,
  save,
  claim,
  semPreco,
  NOME_VENDA,
  parcTxt
} from "./repasse-estado.js";
import { avisoSemPreco, travarMensagensSemValor } from "./precos-colegio.js";
import { passo } from "./repasse-mensagens.js";
import { openPago, openEntrega, openNotas } from "./repasse-janelas.js";
import { openDados } from "./repasse-form.js";
import { passarAluno } from "./passar-pr.js";
import { abrirFotosDoAluno } from "./fotos-aluno.js";

// aviso dos telefones que com certeza estão errados (DDD que não existe, celular sem o 9...)
function telAvisos(it) {
  const ruins = (it.contatos || []).map(c => [c, avisoTel(c.tel)]).filter(([, a]) => a && !/fixo/.test(a));
  if (!ruins.length) return "";
  return "⚠️ Telefone a conferir: " + ruins.map(([c, a]) => `${tipoTxt(c.tipo) || "contato"} (${a})`).join(", ");
}

// o contato do próprio aluno fica gravado como "Formando" (planilhas antigas); na tela aparece "Aluno"
const tipoTxt = t => (t === "Formando" ? "Aluno" : t || "");
export function card(it) {
  const s = status(it);
  const e = el("article", "card " + (["late", "today", "won"].includes(s) ? s : ""));
  const fx = faixaExclusao(C, colNome(), it, () => import("./juntar-colegio.js").then(m => m.apagarAluno(C, colNome(), it)));
  if (fx) e.append(fx);
  const top = el("div", "card-top");
  // botão vermelho de excluir (Regra 6): o admin exclui; a equipe pede ao Adriano
  const bx = el("button", "btn-excluir", "🗑️");
  bx.type = "button";
  bx.title = "Excluir aluno";
  bx.setAttribute("aria-label", "Excluir aluno");
  bx.onclick = () =>
    excluir(C, {
      col: colNome(),
      id: it.id,
      rotulo: `${title(it.nome) || "Aluno"} (${title(it.escola || "")} ${it.ano || ""})`,
      // apaga e já tira o aluno da lista de colégios (e do índice de telefones)
      apagar: () => import("./juntar-colegio.js").then(m => m.apagarAluno(C, colNome(), it))
    });
  top.append(el("h3", "name", title(it.nome) || "Sem nome"), el("span", "stage", it.etapa), bx);
  e.append(top);

  const meta = el("div", "meta");
  [
    [it.codigo ? "🆔 " + it.codigo : "", "id"],
    [tab === "buscar" && segDe(it) ? segNome(segDe(it)) : "", "svc"],
    [C.nomeDe(it) ? "👤 " + U.first(C.nomeDe(it)) : "", ""],
    [title(it.escola), "svc"],
    [[it.curso, it.turma].filter(Boolean).join(" · "), ""],
    [it.ano ? String(it.ano) : "", ""],
    [it.valor ? U.money(it.valor) : "", ""],
    [telAvisos(it), "warn"],
    // admin: contato antigo cujo responsável não está ligado a ninguém da Equipe (a equipe não vê)
    [C.isAdmin && it.resp && !it.respEmail ? `⚠️ “${title(it.resp)}” sem cadastro: ninguém da equipe vê` : "", "warn"]
  ].forEach(([v, c]) => {
    if (v) meta.append(el("span", "tag " + c, v));
  });
  e.append(meta);

  // Para quem mandar
  const cs = it.contatos || [];
  let escolhido = contatoAtual(it);
  const quem = el("div", "quem");
  const ns0 = passo(it, escolhido);
  if (cs.length > 1 && ns0) {
    quem.append(el("small", null, "Mandar para:"));
    cs.forEach(c => {
      const b = el("button", "chip chip-sm", `${tipoTxt(c.tipo)}${c.nome ? " (" + U.first(title(c.nome)) + ")" : ""}`);
      b.type = "button";
      b.setAttribute("aria-pressed", String(c === escolhido));
      b.onclick = () => {
        escolhido = c;
        escolherContato(it, c);
        quem.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
        paintNext();
      };
      quem.append(b);
    });
    e.append(quem);
  }
  const tels = el("div", "phone");
  tels.textContent = cs.map(c => `${tipoTxt(c.tipo)}: ${c.tel}`).join(" · ") || "Sem telefone";
  e.append(tels);

  if (it.etapa === "INCOMPLETO") e.append(el("p", "wait", "Falta: " + (faltando(it).join(", ") || "conferir dados")));
  const fu = el("div", "fu " + (s === "late" ? "late" : s === "today" ? "today" : it.followup ? "" : "none"));
  fu.textContent = situacaoTxt(it, s);
  e.append(fu);
  const pz = prazoEntrega(it, U.todayStr());
  if (pz) e.append(el("p", "prazo " + pz.cor, pz.texto));
  // pediu contato depois (motivo e data) e o histórico de motivos
  linhasRetorno(it).forEach(x => e.append(x));
  const end = enderecoTxt(it);
  if (end) e.append(el("p", "notes", "📍 " + end));
  if (it.notas) e.append(el("p", "notes", it.notas));
  // o que veio da planilha (status, motivo/observação, vendedor, pagamento…): para saber o que aconteceu antes de conversar
  const hp = historicoPlanilha(it);
  if (hp) e.append(el("p", "notes", "📋 Histórico da planilha: " + hp));
  if (it.ultimo && it.ultimo.em)
    e.append(
      el(
        "div",
        "last",
        "Último contato: " +
          (U.first(it.ultimo.por) || "—") +
          " · " +
          U.fmtDate(U.ds(new Date(it.ultimo.em))) +
          " às " +
          U.hhmm(it.ultimo.em) +
          (it.ultimo.whats ? " · 📱 " + it.ultimo.whats.split(" / ").map(fmtTel).join(" / ") : "")
      )
    );

  const li = lockInfo(it);
  if (li) e.append(travaDoCartao(it, li));
  const blocked = li && !li.mine;

  const box = el("div", "next");
  e.append(box);
  const paintNext = () => desenharProximo(box, it, escolhido, blocked, li);
  paintNext();

  e.append(acoesDoCartao(it, li, e));
  // colégio sem preço: aviso vermelho no alto e as mensagens com valor travadas
  if (semPreco(it)) {
    e.insertBefore(avisoSemPreco(C, it, vendaDe(it), NOME_VENDA[vendaDe(it)], segDe(it)), e.firstChild);
    travarMensagensSemValor(e);
  }
  return e;
}

// Próximo passo do contato: a mensagem pronta para quem foi escolhido e os botões de enviar
export function desenharProximo(box, it, escolhido, blocked, li) {
  const F0 = U.first(title(it.nome));
  box.innerHTML = "";
  const ns = passo(it, escolhido);
  if (!ns) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  const msg = el("p", null, ns.msg);
  box.append(el("small", null, "Próximo passo: " + ns.title), msg);
  if (blocked) {
    box.append(el("p", "wait", "Espere " + U.first(li.por) + " terminar, ou toque em “Assumir mesmo assim”."));
    return;
  }
  const row = el("div", "row");
  const d = escolhido ? U.digits(escolhido.tel) : "";
  if (d) {
    const a = el("a", "btn btn-sm btn-primary", "Abrir no WhatsApp");
    a.href = "https://wa.me/" + d + "?text=" + encodeURIComponent(ns.msg);
    a.target = "_blank";
    a.rel = "noopener";
    a.addEventListener("click", () => claim(it));
    row.append(a);
  }
  row.append(
    U.mkBtn("Copiar texto", "", async () => {
      claim(it);
      try {
        await navigator.clipboard.writeText(ns.msg);
        U.toast("Texto copiado");
      } catch (_) {
        const r = document.createRange();
        r.selectNodeContents(msg);
        const sel = getSelection();
        sel.removeAllRanges();
        sel.addRange(r);
        U.toast("Texto selecionado, copie com o dedo");
      }
    })
  );
  // fotos do aluno direto do Google Drive (quando a pasta das prévias está ligada em Ajustes)
  if (C.P.drivePrevias) row.append(U.mkBtn("🖼️ Fotos do aluno", "", () => abrirFotosDoAluno(C, it, precoTxt(it), cartaoTxt(it))));
  // a prévia fica sempre à mão (desde o 1º contato), não só depois do "Quer ver a prévia"
  row.append(
    U.mkBtn("🖼️ Prévia", "", async () =>
      openMockup({
        tel: (contatoAtual(it) || {}).tel,
        encarte: vendaDe(it) === "paspatur" ? await (await import("./encarte.js")).encarteDoColegio(it.escola) : undefined,
        nome: title(it.nome),
        escola: title(it.escola),
        preco: precoTxt(it),
        cartao: cartaoTxt(it),
        toast: U.toast,
        maxFotos: ehFormatura() ? 70 : 15,
        kit: vendaDe(it) === "paspatur" ? "paspatur" : "pr"
      })
    )
  );
  if (it.etapa === "INTERESSADO")
    row.append(
      U.mkBtn("📷 Fotos para escolher", "", () =>
        openMockup({
          tel: (contatoAtual(it) || {}).tel,
          nome: title(it.nome),
          escola: title(it.escola),
          preco: precoTxt(it),
          cartao: cartaoTxt(it),
          modo: "escolha",
          maxFotos: ehFormatura() ? 70 : 15,
          kit: vendaDe(it) === "paspatur" ? "paspatur" : "pr"
        })
      )
    );
  if (it.etapa === "INTERESSADO" && d) {
    const a3 = el("a", "btn btn-sm", "✍️ Pedir a escolha");
    a3.href = "https://wa.me/" + d + "?text=" + encodeURIComponent(textoEscolha(F0, vendaDe(it)));
    a3.target = "_blank";
    a3.rel = "noopener";
    row.append(a3);
  }
  // Depois que a última oferta foi enviada (Repasse), o link do cartão passa a ser o da última oferta.
  const P = precos(it);
  const ultimaOferta = segDe(it) === "rep" && P.kitFinal && (it.tentInteresse || 0) >= 2;
  const ultima = ultimaOferta && P.linkCartaoFinal;
  // Pix Copia e Cola com o valor certo para o momento da conversa
  const pixCod = segDe(it) === "lf" ? P.pixLF : ultimaOferta ? P.pixFinal : P.pixRep;
  const pixVal = segDe(it) === "lf" ? P.lfPix || P.kitPreco : ultimaOferta ? P.kitFinal : P.kitPromo || P.kitPreco;
  const link = ultima ? P.linkCartaoFinal : segDe(it) === "lf" ? P.linkCartaoLF || P.linkCartao : P.linkCartao;
  const valCartao = ultima ? P.kitFinal : segDe(it) === "lf" ? P.lfCartao : P.kitCartao;
  if (it.etapa === "INTERESSADO" && link && d) {
    const pc = parcDe(it);
    const lm = `Para pagar no cartão${valCartao ? ` (${U.money(valCartao)}, ${parcTxt(pc)})` : ` (${parcTxt(pc)})`}, é só usar este link seguro da InfinitePay:\n${link}\nDepois me manda o comprovante por aqui 😊${pixCod ? " Se preferir Pix, é só me avisar que te mando o código." : C.P.pix ? ` No Pix${pixVal ? ` (${U.money(pixVal)})` : ""}, a chave é ${C.P.pix}.` : ""}`;
    const a2 = el("a", "btn btn-sm", ultima ? "💳 Link da última oferta" : "💳 Mandar link de pagamento");
    a2.href = "https://wa.me/" + d + "?text=" + encodeURIComponent(lm);
    a2.target = "_blank";
    a2.rel = "noopener";
    row.append(a2);
  }
  if (it.etapa === "INTERESSADO" && pixCod && d) {
    const pm = `Para pagar no Pix${pixVal ? ` (${U.money(pixVal)})` : ""}: abra o app do seu banco, escolha *Pix Copia e Cola* e cole o código que vou mandar na próxima mensagem 👇 Depois me manda o comprovante por aqui 😊`;
    const a4 = el("a", "btn btn-sm", `💠 Pix ${pixVal ? U.money(pixVal) : ""}`.trim());
    a4.href = "https://wa.me/" + d + "?text=" + encodeURIComponent(pm);
    a4.target = "_blank";
    a4.rel = "noopener";
    row.append(a4);
    const a5 = el("a", "btn btn-sm", "📋 Código Pix");
    a5.title = "Manda só o código, para o cliente copiar fácil";
    a5.href = "https://wa.me/" + d + "?text=" + encodeURIComponent(pixCod);
    a5.target = "_blank";
    a5.rel = "noopener";
    row.append(a5);
  }
  if (ns.then)
    row.append(
      U.mkBtn("Enviei ✓", "btn-ok", () => {
        const p = {
          etapa: ns.then.etapa,
          followup: ns.then.days < 0 ? null : U.addDays(ns.then.days),
          atendendo: null,
          ultimo: {
            por: C.me || "—",
            porEmail: C.email || "",
            whats: whatsAtivo(C, segDe(it) || seg),
            em: new Date().toISOString(),
            para: escolhido ? escolhido.tipo : ""
          }
        };
        if (ns.then.count) p.tentativas = (it.tentativas || 0) + 1;
        // a mensagem enviada fica na conversa do aluno (janela do aluno → Conversa)
        p.conversa = [...(it.conversa || []), { de: "estudio", txt: ns.msg, em: p.ultimo.em, por: C.me || "" }].slice(-60);
        if (ns.then.countI) p.tentInteresse = (it.tentInteresse || 0) + 1;
        if (!it.resp && !it.respEmail && C.me) Object.assign(p, assumir(it));
        save(it, p, p.etapa === "NÃO QUER" ? "Contato encerrado" : "Próximo contato em " + U.fmtDate(p.followup));
      })
    );
  box.append(row);
}
// Quem está respondendo este contato agora (evita duas pessoas mandando mensagem para a mesma família)
function travaDoCartao(it, li) {
  const lk = el("div", "lock " + (li.mine ? "mine" : "other"));
  lk.append(
    el(
      "span",
      null,
      li.mine
        ? "✋ Você está respondendo (desde " + U.hhmm(li.desde) + ")"
        : "⚠️ " + U.first(li.por) + " está respondendo desde " + U.hhmm(li.desde)
    )
  );
  lk.append(
    li.mine
      ? U.mkBtn("Liberar", "", () => save(it, { atendendo: null }, "Cartão liberado"))
      : U.mkBtn("Assumir mesmo assim", "", () =>
          save(it, { atendendo: { por: C.me, desde: new Date().toISOString() } }, "Agora você está respondendo")
        )
  );
  return lk;
}
// Botões do cartão conforme a etapa (e: o cartão, para o aviso de venda a conferir)
function acoesDoCartao(it, li, e) {
  const act = el("div", "actions");
  // a equipe também corrige os dados e os contatos; o Adriano é avisado de quem editou qual aluno
  act.append(
    U.mkBtn(it.etapa === "INCOMPLETO" ? "Completar dados" : "Editar dados", it.etapa === "INCOMPLETO" ? "btn-primary" : "", () =>
      openDados(it)
    )
  );
  // admin: passar este aluno para alguém da equipe
  if (C.isAdmin && !["PAGO", "ENTREGUE", "SEM TELEFONE"].includes(it.etapa))
    act.append(
      U.mkBtn("📤 Passar para a equipe", "", () => passarAluno(C, it, (patch, msg) => save(it, patch, msg, { semConfirmar: true })))
    );
  if (it.etapa === "NA FILA")
    act.append(
      U.mkBtn("Separar para mim", "btn-primary", () =>
        save(
          it,
          { etapa: "SEPARADO", ...assumir(it), separadoEm: U.todayStr(), separadoSeg: segDe(it) || seg, followup: U.todayStr() },
          "Separado para hoje"
        )
      )
    );
  if (ABERTAS.includes(it.etapa) && !li) act.append(U.mkBtn("✋ Estou respondendo", "", () => claim(it)));
  if (it.etapa === "SEPARADO" || it.etapa === "CONTATADO")
    act.append(
      U.mkBtn("Quer ver a prévia ✓", "btn-ok", () =>
        save(it, { etapa: "INTERESSADO", followup: U.todayStr(), tentInteresse: 0 }, "Ótimo! Agora mande a prévia")
      )
    );
  if (ABERTAS.includes(it.etapa)) {
    act.append(U.mkBtn("Pagou 💰", "btn-ok", () => openPago(it)));
    act.append(
      U.mkBtn("🆘 Ajuda de vendas", "", () =>
        import("./ajuda-vendas.js")
          .then(m =>
            m.abrirAjuda(C, {
              aluno: it.nome,
              colegio: it.escola,
              precoModulo: precoTxt(it),
              card: ehFormatura() ? "formatura" : vendaDe(it),
              contato: (contatoPadrao(it) || {}).nome
            })
          )
          .catch(e2 => C.handleErr(e2))
      )
    );
    act.append(U.mkBtn("Remarcar +1d", "", () => save(it, { followup: U.addDays(1) }, "Remarcado para " + U.fmtDate(U.addDays(1)))));
    act.append(U.mkBtn("Não quer", "", () => save(it, { etapa: "NÃO QUER", followup: null, atendendo: null }, "Contato encerrado")));
    act.append(
      U.mkBtn("Número errado", "", () => save(it, { etapa: "SEM CONTATO", followup: null, atendendo: null }, "Marcado como sem contato"))
    );
  }
  if ((it.etapa === "PAGO" || it.etapa === "ENTREGUE") && it.conferido === false) {
    e.append(
      el(
        "p",
        "wait",
        `⏳ Venda a conferir: ${U.money(it.valor)} · ${it.formaPag || ""}${it.valorForaTabela ? " · valor fora da tabela" : ""}${it.comprovante ? " · " + it.comprovante : ""}`
      )
    );
    if (C.isAdmin)
      act.append(
        U.mkBtn("✔ Conferir venda", "btn-verde", () =>
          save(it, { conferido: true, conferidoPor: C.email || "", conferidoEm: U.todayStr() }, "Venda conferida ✔")
        )
      );
  }
  if (it.etapa === "PAGO") act.append(U.mkBtn("📍 Endereço e data", "", () => openEntrega(it)));
  if (it.etapa === "PAGO")
    act.append(
      U.mkBtn("Entregue ✓", "btn-ok", () =>
        save(it, { etapa: "ENTREGUE", entregueEm: U.todayStr(), followup: U.addDays(2) }, "Entrega registrada 🎉")
      )
    );
  // pediu para falar outro dia (ex.: não consegue pagar agora): motivo + data; nesse dia volta para a lista
  if ((ABERTAS.includes(it.etapa) || ["NÃO QUER", "SEM CONTATO"].includes(it.etapa)) && !it.naoContatar)
    act.append(
      U.mkBtn("📅 Pediu contato depois", "", () =>
        abrirRetorno(C, it, patch =>
          save(
            it,
            Object.assign(
              patch,
              {
                followup: patch.retorno.data,
                atendendo: null,
                etapa: ABERTAS.includes(it.etapa) ? it.etapa : "CONTATADO"
              },
              !it.resp && !it.respEmail && C.me ? assumir(it) : {}
            ),
            "Anotado: volta para a lista em " + U.fmtDate(patch.retorno.data)
          )
        )
      )
    );
  if (["NÃO QUER", "SEM CONTATO"].includes(it.etapa) && !it.naoContatar)
    act.append(
      U.mkBtn("Reabrir", "", () =>
        save(it, { etapa: "SEPARADO", followup: U.todayStr(), tentativas: 0, tentInteresse: 0, ...assumir(it) }, "Contato reaberto")
      )
    );
  if (it.etapa === "ENTREGUE" && it.followup) act.append(U.mkBtn("Concluir", "", () => save(it, { followup: null }, "Concluído")));
  act.append(U.mkBtn("Notas", "", () => openNotas(it)));
  if (C.isAdmin && (it.alteracoes || []).length)
    act.append(
      U.mkBtn("🕘 Histórico", "", () =>
        import("./alteracoes.js").then(m => sheetHist("Histórico · " + U.first(title(it.nome)), m.linhasAlteracoes(it)))
      )
    );
  // PR, Paspatur e Formatura: "Caído" (não vai querer) com o motivo obrigatório; só o Adriano resgata
  {
    if (it.etapa === "CAÍDO") {
      act.append(el("p", "wait", "⬇️ Caído: " + (it.caidoMotivo || "sem motivo") + (it.caidoPor ? ` (${U.first(it.caidoPor)})` : "")));
      if (C.isAdmin)
        act.append(
          U.mkBtn("↩️ Resgatar aluno para nova negociação", "btn-primary", async () => {
            // a observação do resgate é obrigatória (fica no aluno, junto com quem resgatou e quando)
            const obs = await pedirTexto("Resgatar o aluno?", `${title(it.nome)} volta para a fila. Observação (obrigatória):`, {
              placeholder: "ex.: a mãe pediu para falar de novo em março",
              ok: "Resgatar"
            });
            if (!obs) return;
            save(
              it,
              {
                etapa: "NA FILA",
                resp: "",
                respEmail: "",
                followup: null,
                resgatadoEm: U.todayStr(),
                resgatadoPor: C.me || "",
                resgateObs: obs
              },
              "Aluno de volta na fila",
              { semConfirmar: true }
            );
          })
        );
    } else if (!["PAGO", "ENTREGUE"].includes(it.etapa))
      act.append(
        U.mkBtn("⬇️ Caído", "", async () => {
          let motivo = await pedirTexto("Marcar como Caído", `Por que ${U.first(title(it.nome))} não vai querer? (obrigatório)`, {
            placeholder: "ex.: já comprou com outra empresa; sem condições agora",
            atalhos: MOTIVOS_CAIDO
          });
          if (!motivo) return;
          // achou caro: antes de deixar cair, oferecer a opção mais em conta
          // (PR → Paspatur; Formatura → PR ou as fotos digitais)
          const ofertas = ehFormatura() ? ["o PR", "as fotos digitais"] : vendaDe(it) === "pr" ? ["o Paspatur"] : [];
          if (ofertas.length && motivoPreco(motivo)) {
            const txt = ofertas.join(" ou ");
            const r = await escolher(
              `Já ofereceu ${txt}?`,
              `Antes de marcar ${U.first(title(it.nome))} como caído por preço, ofereça ${txt}: é a opção mais em conta e muita família que acha caro aceita.`,
              [
                ...ofertas.map(o => ({ v: o, txt: ofertas.length > 1 ? "Vou oferecer " + o : "Vou oferecer agora", cls: "btn-primary" })),
                { v: "nao", txt: "Já ofereci, não quis" }
              ]
            );
            if (!r) return;
            // PR: "Vou oferecer agora" já passa o aluno para Paspatur (as mensagens saem com o valor do Paspatur)
            if (r === "o Paspatur") {
              const { trocarVenda } = await import("./venda-como.js");
              if (await trocarVenda(it, "paspatur")) return;
              return U.toast("Ofereça o Paspatur e volte aqui se não quiser");
            }
            if (r !== "nao") return U.toast(`Ofereça ${r} e volte aqui se não quiser`);
            motivo += ` (ofereceu ${txt} e não quis)`;
          }
          save(
            it,
            { etapa: "CAÍDO", caidoMotivo: motivo, caidoEm: U.todayStr(), caidoPor: C.me || "", followup: null, atendendo: null },
            "Marcado como Caído",
            { semConfirmar: true }
          );
        })
      );
  }
  return act;
}

// quem mudou o quê e quando (só o Adriano vê)
function sheetHist(t, linhas) {
  sheetUi(t, (p, close) => {
    linhas.forEach(l => p.append(el("div", "virada-linha", l)));
    p.append(U.mkBtn("Fechar", "", close));
  });
}
