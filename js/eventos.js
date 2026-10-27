// Formatura e dia de fotos dos colégios: reserva na agenda, aprovação, avisos (WhatsApp e e-mail) e preços mínimos.
// Antes ficava dentro de instituicoes.js; agora o card Formaturas é quem marca as datas e cuida dos preços,
// e o Agendamento usa as mesmas funções.
import { feriado } from "./feriados.js";
import { ASSINATURA_EMAIL, ESTUDIO, assuntoDatas } from "./mensagens.js";
import { el, title, field, inp, sel, sheet, botoes as actions, avisoErro, wa, parseTel } from "./ui.js";
import { TIPOS, CARGOS } from "./instituicoes-dados.js";
import * as U from "./util.js";
let C, FS, db;
export function init(ctx) {
  C = ctx;
  FS = ctx.FS;
  db = ctx.db;
}

// Kits e serviços oferecidos aos colégios (público e particular). Os preços ficam em "Preços dos kits".
const PRODUTOS_PADRAO = [
  { nome: "Canudo personalizado" },
  { nome: "Aluguel de beca completa" },
  { nome: "Kit Paspatur" },
  { nome: "Kit Quadro + PR" },
  { nome: "Álbum" },
  { nome: "Formatura no colégio", formatura: "Colégio" },
  { nome: "Formatura no salão", formatura: "Salão" }
];

export function precosDo(t) {
  const all = C.P.precosInst || {};
  const meu = all[t];
  return meu && typeof meu === "object" ? meu : {};
}
// Kits com o preço mínimo do tipo de instituição
export function produtos(t) {
  const pr = precosDo(t);
  return PRODUTOS_PADRAO.map(x => Object.assign({}, x, { preco: pr[x.nome] || "" }));
}

// ---------- compromissos na agenda (formatura e dia de fotos) ----------
// Cada dia só tem UM compromisso: o documento agenda/AAAA-MM-DD guarda quem ocupou o dia.
// O vendedor sugere a data (fica "pendente", o dia já fica segurado) e só a Luciana confirma.
export const KINDS = {
  formatura: { campo: "formatura", nome: "Formatura", ico: "🎓" },
  fotos: { campo: "diaFotos", nome: "Dia de fotos", ico: "📸" }
};
// Nome do compromisso com o nome da instituição: "Dia de fotos no Colégio Alfa", "Formatura do Colégio Alfa"
export function nomeEvento(kind, instNome) {
  const n = title(instNome || "");
  if (!n) return KINDS[kind] ? KINDS[kind].nome : "Compromisso";
  return kind === "fotos" ? `Dia de fotos no ${n}` : `Formatura do ${n}`;
}
const STATUS_TXT = { pendente: "⏳ aguardando a Luciana", confirmado: "✅ confirmado", recusado: "❌ recusado" };
// Reserva um ou mais dias de uma vez (ex.: dia de fotos + formatura). Tudo ou nada.
// Erro da agenda com código (a tela mostra a mensagem certa para cada um)
const erroAgenda = (code, extra) => Object.assign(new Error(code), { code }, extra);
export async function reservarVarios(it, pares) {
  for (const [kind, f] of pares) {
    const atual = it[KINDS[kind].campo];
    if (atual && atual.status === "confirmado" && !C.aprovador && atual.data !== f.data) throw erroAgenda("confirmado");
  }
  const datas = pares.map(([, f]) => f.data);
  if (new Set(datas).size !== datas.length) throw erroAgenda("mesmodia");
  // Feriado: o estúdio não trabalha
  for (const d of datas) if (feriado(d)) throw erroAgenda("feriado", { ocupado: { data: d }, nomeFeriado: feriado(d) });
  // Dia bloqueado por compromisso de dia inteiro (consulta médica, viagem…)
  // (se não der para conferir, o erro sobe e nada é reservado: a agenda nunca é liberada "no escuro")
  for (const d of datas) {
    const bl = (await FS.getDocs(FS.query(FS.collection(db, "ensaios"), FS.where("data", "==", d), FS.limit(50)))).docs
      .map(x => x.data())
      .filter(x => x.kind === "pessoal" && x.diaInteiro);
    if (bl.length) throw erroAgenda("bloqueado", { ocupado: { data: d }, bloqueio: bl[0] });
  }
  const status = C.aprovador ? "confirmado" : "pendente",
    grupo = it.id + "_" + Date.now(),
    agora = new Date().toISOString();
  // Vagas por dia = equipes (Ajustes). Cada vaga é um documento: AAAA-MM-DD, AAAA-MM-DD_2, AAAA-MM-DD_3.
  const vagas = Math.max(1, Math.min(3, Number(C.P.equipesDia) || 1));
  const idsDoDia = d => Array.from({ length: vagas }, (_, i) => (i ? `${d}_${i + 1}` : d));
  const ehMeu = (sx, kind) => sx.exists() && sx.data().instId === it.id && sx.data().kind === kind;
  const slots = {};
  await FS.runTransaction(db, async tx => {
    const leit = [];
    for (const [kind, f] of pares) {
      const atual = it[KINDS[kind].campo];
      const lidos = [];
      for (const id of idsDoDia(f.data)) lidos.push([id, await tx.get(FS.doc(db, "agenda", id))]);
      // a vaga que já é deste colégio, ou a primeira livre
      const vaga = lidos.find(([, sx]) => ehMeu(sx, kind)) || lidos.find(([, sx]) => !sx.exists());
      if (!vaga) throw erroAgenda("ocupado", { ocupado: lidos[0][1].data() });
      const antigoId = atual && atual.data && atual.status !== "recusado" ? atual.agendaId || atual.data : null;
      const antigo = antigoId && antigoId !== vaga[0] ? FS.doc(db, "agenda", antigoId) : null;
      leit.push({ kind, f, novo: FS.doc(db, "agenda", vaga[0]), id: vaga[0], antigo, s1: antigo ? await tx.get(antigo) : null });
    }
    for (const x of leit) {
      if (x.s1 && ehMeu(x.s1, x.kind)) tx.delete(x.antigo);
      slots[x.kind] = x.id;
      x.f.agendaId = x.id;
      tx.set(x.novo, {
        data: x.f.data,
        hora: x.f.hora || "",
        kind: x.kind,
        tipo: nomeEvento(x.kind, it.nome),
        local: x.f.local || "",
        onde: x.f.onde || "",
        obs: x.f.obs || "",
        status,
        grupo,
        contato: x.f.contato || null,
        alunos: x.f.alunos || null,
        instId: it.id,
        instNome: it.nome,
        instTipo: it.tipo,
        pedidoPor: C.me || "",
        pedidoEmail: C.email || "",
        em: agora,
        ...(status === "confirmado" ? { aprovadoPor: C.me || "", aprovadoEm: agora } : {})
      });
    }
  });
  return { status, grupo, slots };
}
export async function liberar(it, kind) {
  const ev = it[KINDS[kind].campo];
  if (!ev || !ev.data || ev.status === "recusado") return;
  const ref = FS.doc(db, "agenda", ev.agendaId || ev.data);
  await FS.runTransaction(db, async tx => {
    const s0 = await tx.get(ref);
    if (s0.exists() && s0.data().instId === it.id && s0.data().kind === kind) tx.delete(ref);
  });
}
export function msgErroData(e) {
  if (e.code === "ocupado") return msgOcupado(e);
  if (e.code === "feriado")
    return `O dia ${U.fmtDate(e.ocupado.data)} é feriado (${e.nomeFeriado}) e o estúdio não trabalha. Escolha outra data.`;
  if (e.code === "bloqueado") {
    const x = e.bloqueio || {};
    return `O dia ${U.fmtDate(e.ocupado.data)} está bloqueado: ${x.particular ? "compromisso particular" : x.titulo || "compromisso"}${x.deQuem ? " (" + x.deQuem + ")" : ""}. Escolha outra data.`;
  }
  if (e.code === "confirmado") return "Essa data já foi confirmada pela Luciana. Para mudar, fale com ela.";
  if (e.code === "mesmodia") return "O dia das fotos e o dia da formatura precisam ser dias diferentes.";
  if (e.code === "ordem") return "O dia de medir beca e fazer o ensaio precisa ser ANTES da formatura.";
  return "Não foi possível reservar o dia.";
}
function msgOcupado(e) {
  const o = e.ocupado || {};
  return `O dia ${U.fmtDate(o.data)}/${String(o.data || "").slice(0, 4)} já está ocupado: ${nomeEvento(o.kind, o.instNome)}${o.hora ? " às " + o.hora : ""} (${o.status === "confirmado" ? "confirmado" : "aguardando a Luciana"}). Escolha outra data.`;
}
export function camposEvento(kind, f, instNome) {
  const K = KINDS[kind],
    box = el("div", "imp");
  const data = el("input");
  data.type = "date";
  data.value = (f && f.status !== "recusado" && f.data) || "";
  data.min = U.todayStr();
  const hora = el("input");
  hora.type = "time";
  hora.value = (f && f.hora) || "";
  const r1 = el("div", "row2");
  r1.append(field(kind === "formatura" ? "Dia da formatura" : "Dia das fotos", data), field("Horário", hora));
  box.append(
    el("h3", null, K.ico + " " + (instNome ? nomeEvento(kind, instNome) : K.nome)),
    el(
      "p",
      "hint",
      (C.aprovador ? "Você confirma direto." : "A data fica segurada e vai para a Luciana aprovar.") +
        " Cada dia só pode ter um compromisso."
    ),
    r1
  );
  let onde = null,
    local = null,
    obs = null;
  if (kind === "formatura") {
    onde = sel(["Colégio", "Salão"], (f && f.onde) || "Colégio");
    local = inp(f && f.local, "nome do salão ou endereço");
    const r2 = el("div", "row2");
    r2.append(field("Onde", onde), field("Local", local));
    box.append(r2);
  } else {
    obs = inp((f && f.obs) || "Medir beca + ensaio de estúdio no colégio", "o que vai ser feito", 200);
    box.append(field("O que vai ser feito", obs));
  }
  if (f && f.status === "recusado")
    box.append(
      el(
        "p",
        "wait",
        `A Luciana recusou o dia ${U.fmtDate(f.data)}${f.motivoRecusa ? ": " + f.motivoRecusa : ""}${f.sugestao ? ` · sugeriu ${U.fmtDate(f.sugestao)}` : ""}`
      )
    );
  const err = el("p", "err");
  err.hidden = true;
  box.append(err);
  box.valor = () => ({
    data: data.value,
    hora: hora.value,
    onde: onde ? onde.value : "",
    local: local ? local.value.trim() : "",
    obs: obs ? obs.value.trim() : ""
  });
  box.erro = t => {
    err.textContent = t;
    err.hidden = !t;
    if (t) err.scrollIntoView({ block: "center" });
  };
  box.onde = onde;
  return box;
}
// Quando as datas são confirmadas, o colégio recebe um e-mail (instituição + responsáveis com e-mail).
// O app só coloca o e-mail na fila; quem envia é o GitHub, a cada 15 minutos, pelo Gmail do estúdio.
export async function avisarColegioPorEmail(instId, ctx) {
  const c = ctx || C;
  const F = c.FS;
  const s0 = await F.getDoc(F.doc(c.db, "instituicoes", instId));
  if (!s0.exists()) return 0;
  const it = s0.data();
  const para = [
    ...new Set(
      [it.email, ...(it.contatos || []).map(x => x.email)]
        .map(x =>
          String(x || "")
            .trim()
            .toLowerCase()
        )
        .filter(x => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x))
    )
  ];
  if (!para.length) return 0;
  const sem = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
  const dia = d => {
    const [y, m, dd] = d.split("-").map(Number);
    return `${sem[new Date(y, m - 1, dd).getDay()]}, ${String(dd).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
  };
  const lin = [];
  if (it.diaFotos && it.diaFotos.status === "confirmado")
    lin.push(
      `📸 Medição de beca e ensaio de estúdio no ${title(it.nome)}: ${dia(it.diaFotos.data)}${it.diaFotos.hora ? " às " + it.diaFotos.hora : ""}`
    );
  if (it.formatura && it.formatura.status === "confirmado")
    lin.push(
      `🎓 Formatura do ${title(it.nome)}: ${dia(it.formatura.data)}${it.formatura.hora ? " às " + it.formatura.hora : ""}${it.formatura.onde ? " · " + (it.formatura.onde === "Salão" ? "no salão" : "no colégio") : ""}${it.formatura.local ? " (" + it.formatura.local + ")" : ""}`
    );
  if (!lin.length) return 0;
  const nome = title(it.nome);
  await F.addDoc(F.collection(c.db, "emails"), {
    para,
    instId,
    instNome: it.nome,
    status: "pendente",
    criadoEm: new Date().toISOString(),
    por: c.me || "",
    datas: [
      it.diaFotos && it.diaFotos.status === "confirmado" ? it.diaFotos.data : "",
      it.formatura && it.formatura.status === "confirmado" ? it.formatura.data : ""
    ].filter(Boolean),
    assunto: assuntoDatas(nome),
    texto: `Olá!\n\nConfirmamos com o ${nome} as datas das fotos de formatura:\n\n${lin.join("\n")}${it.mediaAlunos ? `\n\nPrevisão de ${it.alunosConfirmados || it.mediaAlunos} alunos${it.alunosConfirmados ? "" : " (depois das fotos informamos a quantidade certa)"}.` : ""}\n\nQualquer dúvida, é só responder este e-mail.\n\n${ASSINATURA_EMAIL}`
  });
  await F.updateDoc(F.doc(c.db, "instituicoes", instId), { avisoEmail: { para, em: new Date().toISOString() } }).catch(e =>
    avisoErro(e, "anotar o aviso por e-mail")
  );
  return para.length;
}
// Mensagem de WhatsApp para o responsável do colégio (quem envia é sempre a pessoa, pelo próprio WhatsApp)
function diaLongo(d) {
  const sem = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
  const [y, m, dd] = d.split("-").map(Number);
  return `${sem[new Date(y, m - 1, dd).getDay()]}, ${String(dd).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}
export function msgWhatsColegio(instNome, eventos, contato, alunos, quem) {
  const nome = contato && contato.nome ? U.first(title(contato.nome)) : "";
  const conf = eventos.every(e => e.status === "confirmado");
  const lin = eventos.map(
    e =>
      `${KINDS[e.kind].ico} ${nomeEvento(e.kind, instNome)}: ${diaLongo(e.data)}${e.hora ? " às " + e.hora : ""}${e.kind === "formatura" && e.onde ? " · " + (e.onde === "Salão" ? "no salão" + (e.local ? " (" + e.local + ")" : "") : "no colégio") : ""}`
  );
  return (
    `Olá${nome ? ", " + nome : ""}! Aqui é ${quem ? quem + ", do" : "do"} ${ESTUDIO.nome} 📸\n` +
    (conf ? "Está confirmado:\n" : "Deixei pré-agendado (te confirmo em seguida):\n") +
    lin.join("\n") +
    (alunos ? `\nPrevisão de ${alunos} alunos (depois das fotos atualizamos a quantidade certa).` : "") +
    "\nQualquer mudança, é só me avisar por aqui. Obrigado! 😊"
  );
}
// Painel "avisar o colégio": botão do WhatsApp (precisa de um toque da pessoa) e aviso do e-mail
export function painelAvisar(ctx, instNome, eventos, contato, alunos, extra, aoEnviar) {
  if (!C) init(ctx);
  if (!contato || !(contato.tel || contato.email)) {
    if (extra) U.toast(extra);
    return;
  }
  sheet(
    "Avisar o colégio",
    (p, close) => {
      if (extra) p.append(el("p", "hint", extra));
      const msg = msgWhatsColegio(instNome, eventos, contato, alunos, U.first(C.me));
      p.append(el("p", "notes", msg));
      const a = el("div", "panel-actions");
      const sp = el("span");
      sp.style.flex = "1";
      const fechar = el("button", "btn", "Agora não");
      fechar.type = "button";
      fechar.onclick = close;
      a.append(sp, fechar);
      if (contato.tel) {
        const w = el("button", "btn btn-verde", "📲 Enviar no WhatsApp" + (contato.nome ? " de " + U.first(title(contato.nome)) : ""));
        w.type = "button";
        w.onclick = () => {
          wa(contato.tel, msg, U.toast);
          close();
          if (aoEnviar) aoEnviar();
        };
        a.append(w);
      }
      p.append(a);
      p.append(
        el(
          "p",
          "hint",
          eventos.every(e => e.status === "confirmado")
            ? (contato.email
                ? `O e-mail de confirmação vai para ${contato.email}.`
                : "Sem e-mail cadastrado: só o WhatsApp avisa o colégio.") +
                (contato.tel ? "" : " Sem WhatsApp cadastrado: o colégio é avisado só por e-mail.")
            : "Quando a Luciana aprovar, o colégio recebe o e-mail de confirmação" +
                (contato.email ? ` (${contato.email})` : " (cadastre o e-mail do responsável)") +
                "."
        )
      );
    },
    { div: true }
  );
}
export function linhaEvento(it, kind) {
  const ev = it[KINDS[kind].campo];
  if (!ev || !ev.data) return null;
  const K = KINDS[kind];
  const t =
    ev.status === "recusado"
      ? `${K.ico} ${nomeEvento(kind, it.nome)}: ${STATUS_TXT.recusado} o dia ${U.fmtDate(ev.data)}${ev.motivoRecusa ? " (" + ev.motivoRecusa + ")" : ""}${ev.sugestao ? " · sugeriu " + U.fmtDate(ev.sugestao) : ""}`
      : `${K.ico} ${nomeEvento(kind, it.nome)}: ${U.fmtDate(ev.data)}/${ev.data.slice(0, 4)}${ev.hora ? " às " + ev.hora : ""}${ev.onde ? " · " + ev.onde : ""}${ev.local ? " (" + ev.local + ")" : ""} · ${STATUS_TXT[ev.status] || STATUS_TXT.pendente}`;
  return el("div", "fu " + (ev.status === "confirmado" ? "ok" : ev.status === "recusado" ? "late" : "today"), t);
}

export function openEvento(it, kind) {
  const K = KINDS[kind],
    ev = it[K.campo],
    fot = it.diaFotos;
  const comFotos = kind === "formatura"; // formatura sempre leva junto o dia de medir beca + ensaio
  sheet(nomeEvento(kind, it.nome), (p, close) => {
    const travado = !C.aprovador && ev && ev.status === "confirmado" && (!comFotos || (fot && fot.status === "confirmado"));
    if (travado) {
      [
        ["fotos", fot],
        [kind, ev]
      ].forEach(([k, x]) => {
        if (x && x.data && (k === kind || comFotos))
          p.append(
            el(
              "p",
              null,
              `${KINDS[k].ico} ${nomeEvento(k, it.nome)}: ${U.fmtDate(x.data)}/${x.data.slice(0, 4)}${x.hora ? " às " + x.hora : ""} · ✅ confirmado`
            )
          );
      });
      p.append(el("p", "hint", "Confirmado pela Luciana. Para mudar ou desmarcar, fale com ela."));
      const a = el("div", "panel-actions");
      const ok = el("button", "btn btn-primary", "Fechar");
      ok.type = "button";
      ok.onclick = close;
      a.append(ok);
      p.append(a);
      return;
    }
    const dBox = comFotos ? camposEvento("fotos", fot, it.nome) : null;
    if (dBox) {
      p.append(
        el(
          "p",
          "hint",
          "Lembrete: a formatura costuma ter 2 dias. Primeiro medir beca e fazer o ensaio de estúdio no colégio, depois a formatura. Se ainda não combinou o dia das fotos, pode deixar em branco."
        )
      );
      p.append(dBox);
    }
    let avisado = false;
    const box = camposEvento(kind, ev, it.nome);
    p.append(box);
    // Com quem foi combinado (recebe o WhatsApp e o e-mail) e a média de alunos (obrigatória)
    const resp = el("div", "imp");
    resp.append(el("h3", null, "👤 Responsável do colégio e alunos"));
    const cs = (it.contatos || []).filter(c => c.tel || c.email);
    const escolha = sel(
      [
        ...cs.map((c, i) => [String(i), [title(c.nome) || c.cargo || "Contato", c.cargo, c.tel, c.email].filter(Boolean).join(" · ")]),
        ["novo", "+ Outro / novo contato"]
      ],
      cs.length ? "0" : "novo"
    );
    const nNome = inp("", "nome"),
      nCargo = sel(CARGOS, "Direção"),
      nTel = inp("", "WhatsApp", 20),
      nEmail = inp("", "e-mail", 120);
    nTel.inputMode = "tel";
    nEmail.type = "email";
    const novoC = el("div");
    const rr1 = el("div", "row2");
    rr1.append(field("Nome", nNome), field("Cargo", nCargo));
    const rr2 = el("div", "row2");
    rr2.append(field("WhatsApp", nTel), field("E-mail", nEmail));
    novoC.append(rr1, rr2);
    const sync = () => {
      novoC.hidden = escolha.value !== "novo";
    };
    escolha.onchange = sync;
    sync();
    const alunos = inp(it.alunosConfirmados || it.mediaAlunos || "", "ex.: 120", 6);
    alunos.inputMode = "numeric";
    resp.append(
      field("Combinado com", escolha),
      novoC,
      el("p", "hint", "Preencha o WhatsApp ou o e-mail (de preferência o WhatsApp). A mensagem sai do WhatsApp de quem agendou."),
      field(it.alunosConfirmados ? "Alunos (quantidade confirmada)" : "Média de alunos (obrigatório)", alunos),
      el("p", "hint", "Começamos com a média. Depois das fotos, a quantidade certa é confirmada na lista de formandos.")
    );
    const errR = el("p", "err");
    errR.hidden = true;
    resp.append(errR);
    p.append(resp);
    const contatoEscolhido = () =>
      escolha.value === "novo"
        ? {
            nome: nNome.value.trim(),
            cargo: nCargo.value,
            tel: parseTel(nTel.value) || nTel.value.trim(),
            email: nEmail.value.trim().toLowerCase(),
            novo: true
          }
        : Object.assign({}, cs[Number(escolha.value)]);
    if (ev && ev.data && ev.status !== "recusado") {
      const lib = el(
        "button",
        "btn btn-danger btn-sm",
        comFotos ? "Desmarcar formatura e dia de fotos (libera os dias)" : "Desmarcar (libera o dia)"
      );
      lib.type = "button";
      lib.onclick = async () => {
        try {
          await liberar(it, kind);
          if (comFotos) await liberar(it, "fotos");
          await FS.updateDoc(
            FS.doc(db, "instituicoes", it.id),
            Object.assign({ [K.campo]: null, atualizadoEm: new Date().toISOString() }, comFotos ? { diaFotos: null } : {})
          );
          U.toast("Desmarcado");
          close();
        } catch (e) {
          C.handleErr(e);
        }
      };
      p.append(lib);
    }
    p.append(actions(close, C.aprovador ? "Confirmar datas" : "Mandar para a Luciana aprovar"));
    p.addEventListener("submit", async evt => {
      evt.preventDefault();
      const f = box.valor(),
        fd = dBox ? dBox.valor() : null;
      if (!f.data) {
        box.erro("Escolha o dia.");
        return;
      }
      const ct = contatoEscolhido(),
        nAl = Number(String(alunos.value).replace(/\D/g, "")) || 0;
      errR.hidden = true;
      if (!nAl) {
        errR.textContent = "Coloque a média de alunos.";
        errR.hidden = false;
        alunos.focus();
        return;
      }
      // basta um dos dois: WhatsApp (preferido) ou e-mail
      const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ct.email || "");
      if (ct.email && !emailOk) {
        errR.textContent = "E-mail inválido.";
        errR.hidden = false;
        return;
      }
      if (!parseTel(ct.tel) && !emailOk) {
        errR.textContent = "Coloque o WhatsApp (de preferência) ou o e-mail de quem combinou a data.";
        errR.hidden = false;
        (escolha.value === "novo" ? nTel : escolha).focus();
        return;
      }
      const contato = { nome: ct.nome || "", cargo: ct.cargo || "", tel: parseTel(ct.tel), email: ct.email || "" };
      f.contato = contato;
      f.alunos = nAl;
      if (fd) {
        fd.contato = contato;
        fd.alunos = nAl;
      }
      // Sugestão (não obrigatório): lembra o vendedor do dia de medir beca + ensaio
      if (dBox && !fd.data && !avisado) {
        avisado = true;
        dBox.erro("Não esqueça do dia de medir beca e fazer o ensaio! Se ainda não combinou, toque de novo para salvar só a formatura.");
        p.querySelector("button[type=submit]").textContent = "Salvar só a formatura";
        return;
      }
      try {
        if (fd && fd.data && fd.data >= f.data) throw erroAgenda("ordem");
        const pares =
          fd && fd.data
            ? [
                ["fotos", fd],
                [kind, f]
              ]
            : [[kind, f]];
        const r = await reservarVarios(it, pares);
        const patch = {
          [K.campo]: Object.assign(f, { status: r.status, grupo: r.grupo, pedidoPor: C.me || "" }),
          atualizadoEm: new Date().toISOString()
        };
        if (fd && fd.data) patch.diaFotos = Object.assign(fd, { status: r.status, grupo: r.grupo, pedidoPor: C.me || "" });
        // alunos: guarda a média (a quantidade certa vem depois, pela lista de formandos)
        if (!it.alunosConfirmados) {
          patch.mediaAlunos = nAl;
          patch.alunosEstimado = true;
        }
        if (ct.novo) patch.contatos = [...(it.contatos || []), contato];
        await FS.updateDoc(FS.doc(db, "instituicoes", it.id), patch);
        if (r.status === "confirmado") await avisarColegioPorEmail(it.id);
        close();
        const evs = [fd && fd.data ? Object.assign({ kind: "fotos" }, fd) : null, Object.assign({ kind }, f)].filter(Boolean);
        painelAvisar(
          C,
          it.nome,
          evs,
          contato,
          nAl,
          r.status === "confirmado" ? "Datas confirmadas ✅" : "Dias segurados. Aguardando a Luciana aprovar."
        );
      } catch (e) {
        (e.code === "ocupado" && dBox && e.ocupado && fd && e.ocupado.data === fd.data ? dBox : box).erro(msgErroData(e));
        if (!e.code) console.warn(e);
      }
    });
  });
}

export function openPrecos(tipoIni) {
  let tipo = tipoIni || "particular",
    ins = [];
  sheet("Preços mínimos", (p, close) => {
    // um tipo de instituição por vez: troca no seletor e a tabela recarrega
    const tp = sel(
      Object.entries(TIPOS).map(([k, t]) => [k, t.nome]),
      tipo
    );
    p.append(field("Tipo de instituição", tp));
    const corpo = el("div");
    p.append(corpo);
    const montar = () => {
      corpo.textContent = "";
      corpo.append(
        el(
          "p",
          "hint",
          `Valor mínimo de cada kit para ${TIPOS[tipo].nome.toLowerCase()}. Na visita, o vendedor pode colocar um valor mais alto, mas não mais baixo.`
        )
      );
      const atual = precosDo(tipo);
      ins = PRODUTOS_PADRAO.map(x => {
        const i = inp(atual[x.nome] || "", "R$", 12);
        i.inputMode = "decimal";
        i.disabled = !C.isAdmin;
        corpo.append(field(x.nome, i));
        return [x.nome, i];
      });
    };
    tp.onchange = () => {
      tipo = tp.value;
      montar();
    };
    montar();
    const a = actions(close, "Salvar preços");
    if (!C.isAdmin) a.ok.hidden = true;
    p.append(a);
    p.addEventListener("submit", async ev => {
      ev.preventDefault();
      if (!C.isAdmin) return;
      try {
        const novos = Object.fromEntries(ins.map(([n, i]) => [n, U.num(i.value)]));
        await FS.setDoc(FS.doc(db, "config", "app"), { precosInst: { [tipo]: novos } }, { merge: true });
        C.P.precosInst = Object.assign({}, C.P.precosInst, { [tipo]: novos });
        U.toast("Preços mínimos salvos para " + TIPOS[tipo].nome.toLowerCase());
        close();
      } catch (e) {
        C.handleErr(e);
      }
    });
  });
}
