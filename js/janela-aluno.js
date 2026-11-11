// Janela do aluno (PR, Paspatur e Formatura): tocar no aluno da lista compacta abre esta janela, com abas
// Resumo (o cartão completo, com todos os botões) · Prévia e fotos · Conversa · Venda e entrega · Histórico.
// A janela ouve o próprio aluno no banco: o que mudar (aqui ou em outro aparelho) aparece na hora.
// Conversa: a mensagem pronta do próximo passo, a resposta do cliente colada aqui (fica guardada no aluno, em
// "conversa") e "Pedir ao Claude", que copia o texto pronto (sem telefone) e abre o Claude para sugerir a resposta.
import { el, title, sheet } from "./ui.js";
import * as U from "./util.js";
import { openMockup } from "./mockup.js";
import { miniaturasDoAluno, driveLiberado } from "./fotos-aluno.js";
import { linhaVisitas } from "./link-previa.js";
import { linhasRetorno } from "./retorno.js";
import { situacaoTxt, enderecoTxt, historicoPlanilha, prazoEntrega } from "./repasse-dados.js";
import {
  C,
  ABERTAS,
  status,
  contatoAtual,
  escolherContato,
  vendaDe,
  precoTxt,
  ehFormatura,
  colNome,
  save,
  segDe,
  segNome,
  precos
} from "./repasse-estado.js";
import { chaveVenda } from "./venda-como.js";
import { card, desenharProximo } from "./repasse-cartao.js";
import { openPago, openEntrega } from "./repasse-janelas.js";

const ABAS = [
  ["resumo", "Resumo"],
  ["previa", "Prévia e fotos"],
  ["conversa", "Conversa"],
  ["venda", "Venda e entrega"],
  ["historico", "Histórico"]
];
let abaAtual = "resumo";
const dataBR = d => (d ? String(d).slice(0, 10).split("-").reverse().join("/") : "");
const cardAjuda = it => (ehFormatura() ? "formatura" : vendaDe(it));
const tipoTxt = t => (t === "Formando" ? "Aluno" : t || "");

export function abrirJanela(it0) {
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
        // topo: nome, ID, situação, colégio · turma · ano
        topo.innerHTML = "";
        const volta = U.mkBtn("‹ Voltar para a lista", "btn-sm", close);
        const nome = el("div", "ja-nome");
        nome.append(
          el("h2", null, title(it.nome) || "Sem nome"),
          el(
            "small",
            null,
            [it.codigo, title(it.escola), [it.curso, it.turma].filter(Boolean).join(" "), it.ano, segDe(it) ? segNome(segDe(it)) : ""]
              .filter(Boolean)
              .join(" · ")
          )
        );
        topo.append(volta, nome, el("span", "lc-selo ja-selo", it.etapa || ""));
        // PR e Paspatur na mesma lista: a chave diz como o aluno está sendo vendido
        if (!ehFormatura()) topo.append(chaveVenda(it));
        // abas
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
        ({ resumo, previa, conversa, venda, historico })[abaAtual](corpo, it);
      };
      desenhar();
      // o aluno no banco: atualiza a janela quando muda
      try {
        unsub = C.FS.onSnapshot(
          C.FS.doc(C.db, colNome(), it.id),
          s => {
            if (!s.exists()) return close();
            it = Object.assign({ id: s.id }, s.data());
            // não redesenha enquanto a pessoa escreve a resposta do cliente
            const ativo = document.activeElement;
            if (ativo && corpo.contains(ativo) && ativo.tagName === "TEXTAREA" && ativo.value) return;
            desenhar();
          },
          () => {}
        );
      } catch (_) {}
    },
    { div: true, wide: true, onClose: () => unsub && unsub() }
  );
}

// Resumo: o cartão completo de hoje (contatos, próximo passo, todos os botões)
function resumo(box, it) {
  box.append(card(it));
}

// Prévia e fotos
function previa(box, it) {
  const g = el("div", "ja-grade");
  const bloco = (icone, tit, txt, fn) => {
    const b = el("button", "ja-bloco");
    b.type = "button";
    b.append(el("span", "ja-ico", icone), el("b", null, tit), el("small", null, txt));
    b.onclick = fn;
    g.append(b);
  };
  const max = ehFormatura() ? 70 : 15;
  const kit = vendaDe(it) === "paspatur" ? "paspatur" : "pr";
  bloco(
    "🖼️",
    "Prévia do kit",
    kit === "paspatur" ? "o livro do Kit Paspatur aberto, com a marca d'água" : "quadro na parede e porta-retratos, com a marca d'água",
    async () =>
      openMockup({
        tel: (contatoAtual(it) || {}).tel,
        nome: title(it.nome),
        escola: title(it.escola),
        preco: precoTxt(it),
        toast: U.toast,
        maxFotos: max,
        kit,
        encarte: kit === "paspatur" ? await (await import("./encarte.js")).encarteDoColegio(it.escola) : undefined
      })
  );
  bloco("📷", "Fotos para escolher", "folha com as fotos numeradas para a família escolher", () =>
    openMockup({
      tel: (contatoAtual(it) || {}).tel,
      nome: title(it.nome),
      escola: title(it.escola),
      preco: precoTxt(it),
      modo: "escolha",
      maxFotos: max,
      kit
    })
  );
  box.append(g);
  // as fotos do aluno no Drive, em miniatura (tocar amplia), com "🔄 Trocar as fotos"
  const fotos = el("div", "ja-fotos");
  box.append(el("h3", null, "Fotos do aluno no Drive"));
  if (it.linkPrevia) box.append(linhaVisitas(C, it)); // quantas vezes a família abriu o link da prévia
  box.append(fotos);
  const o = { precoTxt: precoTxt(it), tel: (contatoAtual(it) || {}).tel, salvar: (patch, msg) => save(it, patch, msg) };
  if (!precos(it).drivePrevias || driveLiberado(C)) miniaturasDoAluno(C, it, fotos, o);
  else
    fotos.append(
      el("p", "hint", "Entre com a sua conta Google para ver as fotos aqui (vale por 1 hora)."),
      U.mkBtn("📁 Mostrar as fotos", "btn-primary", () => miniaturasDoAluno(C, it, fotos, o))
    );
}

// Conversa: mensagem pronta, resposta do cliente e ajuda do Claude
function conversa(box, it) {
  const cs = it.contatos || [];
  let escolhido = contatoAtual(it);
  const quem = el("div", "quem");
  const prox = el("div", "next");
  const pinta = () => desenharProximo(prox, it, escolhido, false, null);
  if (cs.length > 1) {
    quem.append(el("small", null, "Mandar para:"));
    cs.forEach(c => {
      const b = el("button", "chip chip-sm", `${tipoTxt(c.tipo)}${c.nome ? " (" + U.first(title(c.nome)) + ")" : ""}`);
      b.type = "button";
      b.setAttribute("aria-pressed", String(c === escolhido));
      b.onclick = () => {
        escolhido = c;
        escolherContato(it, c);
        quem.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
        pinta();
      };
      quem.append(b);
    });
    box.append(quem);
  }
  box.append(prox);
  pinta();
  if (prox.hidden) box.append(el("p", "hint", "Sem mensagem pronta nesta situação. Use a resposta do cliente e o Claude abaixo."));
  // o que o cliente respondeu
  const resp = el("textarea");
  resp.rows = 3;
  resp.maxLength = 1500;
  resp.placeholder = "Cole aqui o que o cliente respondeu no WhatsApp";
  resp.setAttribute("aria-label", "Resposta do cliente");
  const linha = el("div", "row");
  const guardar = async () => {
    const t = resp.value.trim();
    if (!t) return U.toast("Cole a resposta do cliente primeiro.");
    const conv = [...(it.conversa || []), { de: "cliente", txt: t, em: new Date().toISOString(), por: C.me || "" }].slice(-60);
    await save(it, { conversa: conv }, "Guardado na conversa");
    resp.value = "";
  };
  linha.append(
    U.mkBtn("Guardar na conversa", "", guardar),
    U.mkBtn("✨ Pedir ao Claude", "btn-primary", async () => {
      const m = await import("./ajuda-vendas.js");
      let cat = [];
      try {
        cat = await (await import("./estoque.js")).carregarCatalogo(C);
      } catch (_) {}
      const ult = (it.conversa || [])
        .slice(-6)
        .map(x => `${x.de === "cliente" ? "Cliente" : "Estúdio"}: ${x.txt}`)
        .join("\n");
      const duvida = [ult, resp.value.trim() ? "Cliente: " + resp.value.trim() : ""].filter(Boolean).join("\n");
      const t = m.textoParaClaude({
        card: cardAjuda(it),
        aluno: it.nome,
        colegio: it.escola,
        cat,
        precoModulo: precoTxt(it),
        guardado: (C.P && C.P.ajudaCards) || {},
        duvida: duvida ? "Conversa até agora:\n" + duvida : ""
      });
      if (resp.value.trim()) await guardar();
      await m.copiar(t);
      U.toast("Texto copiado (sem telefone). Confira no Claude e envie.");
      window.open(m.urlClaude(t), "_blank", "noopener");
    })
  );
  box.append(el("h3", null, "O cliente respondeu?"), resp, linha);
  // a conversa guardada
  const conv = it.conversa || [];
  if (conv.length) {
    const h = el("div", "ja-conversa");
    conv.forEach(x => {
      const b = el("div", "ja-msg " + (x.de === "cliente" ? "cli" : "nos"));
      b.append(
        el("p", null, x.txt),
        el("small", null, `${x.de === "cliente" ? "Cliente" : U.first(x.por) || "Estúdio"} · ${dataBR(x.em)} ${U.hhmm(x.em)}`)
      );
      h.append(b);
    });
    box.append(el("h3", null, "Conversa guardada"), h);
  }
}

// Venda e entrega
function venda(box, it) {
  const s = status(it);
  const lista = el("div", "ja-dados");
  const linha = (rot, val) => {
    if (!val) return;
    const d = el("div");
    d.append(el("small", null, rot), el("span", null, val));
    lista.append(d);
  };
  linha("Situação", situacaoTxt(it, s));
  linha("Preço", precoTxt(it));
  linha("Valor pago", it.valor && ["PAGO", "ENTREGUE"].includes(it.etapa) ? U.money(it.valor) : "");
  linha("Forma de pagamento", it.formaPag || "");
  linha("Pago em", dataBR(it.pagoEm));
  linha("Comprovante", it.comprovante || "");
  linha("Conferida", it.conferido === false ? "falta conferir" : ["PAGO", "ENTREGUE"].includes(it.etapa) ? "sim" : "");
  linha("Entrega", [it.entregaTipo, dataBR(it.entregaData)].filter(Boolean).join(" · "));
  linha("Endereço", enderecoTxt(it));
  linha("Entregue em", dataBR(it.entregueEm));
  box.append(lista);
  const pz = prazoEntrega(it, U.todayStr());
  if (pz) box.append(el("p", "prazo " + pz.cor, pz.texto));
  const ac = el("div", "actions");
  if (ABERTAS.includes(it.etapa)) ac.append(U.mkBtn("Pagou 💰", "btn-ok", () => openPago(it)));
  if (it.etapa === "PAGO") ac.append(U.mkBtn("📍 Endereço e data", "", () => openEntrega(it)));
  if (ac.childNodes.length) box.append(ac);
  if (!lista.childNodes.length) box.append(el("p", "hint", "Ainda sem venda."));
}

// Histórico: o que aconteceu com o aluno, do mais novo para o mais antigo
function historico(box, it) {
  const ev = [];
  const add = (d, t) => d && ev.push([String(d), t]);
  add(it.criadoEm, "Entrou na lista");
  add(it.separadoEm, "Separado" + (it.resp ? " por " + U.first(it.resp) : ""));
  if (it.ultimo && it.ultimo.em)
    add(it.ultimo.em, `Último contato: ${U.first(it.ultimo.por) || "—"}${it.ultimo.para ? " para " + tipoTxt(it.ultimo.para) : ""}`);
  add(it.pagoEm, `Pago${it.valor ? " · " + U.money(it.valor) : ""}${it.formaPag ? " · " + it.formaPag : ""}`);
  add(it.conferidoEm, "Venda conferida");
  add(it.entregueEm, "Entregue");
  add(it.caidoEm, "Caído: " + (it.caidoMotivo || ""));
  add(it.resgatadoEm, "Resgatado" + (it.resgateObs ? ": " + it.resgateObs : ""));
  (it.conversa || []).forEach(x =>
    add(x.em, `${x.de === "cliente" ? "Cliente respondeu" : "Mensagem enviada"}: ${String(x.txt).slice(0, 80)}`)
  );
  ev.sort((a, b) => b[0].localeCompare(a[0]));
  const l = el("div", "ja-linha-tempo");
  ev.forEach(([d, t]) => {
    const x = el("div");
    x.append(el("small", null, dataBR(d)), el("span", null, t));
    l.append(x);
  });
  if (!ev.length) l.append(el("p", "hint", "Nada registrado ainda."));
  box.append(l);
  linhasRetorno(it).forEach(x => box.append(x));
  const hp = historicoPlanilha(it);
  if (hp) box.append(el("p", "notes", "📋 Histórico da planilha: " + hp));
  if (it.notas) box.append(el("p", "notes", "📝 " + it.notas));
  if (C.isAdmin && (it.alteracoes || []).length)
    import("./alteracoes.js").then(m => {
      const d = el("details", "notes");
      d.append(el("summary", null, "Quem mudou os dados"));
      m.linhasAlteracoes(it).forEach(t => d.append(el("div", null, t)));
      box.append(d);
    });
}
