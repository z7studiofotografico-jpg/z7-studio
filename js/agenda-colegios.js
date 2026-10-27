// Agendamento: datas de colégio (formatura e dia de fotos): aprovar, recusar e avisar o colégio.
import { avisarColegioPorEmail, nomeEvento, painelAvisar } from "./eventos.js";
import { el, title, field, sheet, botoes, avisoErro } from "./ui.js";
import * as U from "./util.js";
import { diaTxt } from "./agenda-tempo.js";
import { C, FS, db, ensaios, comps, CAMPO, ICO } from "./agenda-estado.js";
export function linhaColegio(x) {
  const r = el("div", "agrow");
  const t = el("div", "agtxt");
  t.append(el("b", null, `${ICO[x.kind] || "📌"} ${nomeEvento(x.kind, x.instNome)}`));
  const det = [x.hora, x.onde && x.onde + (x.local ? " · " + x.local : "")].filter(Boolean).join(" · ");
  if (det) t.append(el("span", null, det));
  if (x.status === "pendente") t.append(el("span", "wait", "⏳ Aguardando a Luciana aprovar"));
  if (x.contato && (x.contato.nome || x.contato.tel))
    t.append(
      el(
        "span",
        null,
        `👤 ${[x.contato.nome && title(x.contato.nome), x.contato.cargo].filter(Boolean).join(" · ")}${x.alunos ? ` · ~${x.alunos} alunos` : ""}`
      )
    );
  const fim = el("div", "agact");
  fim.append(el("span", "tag " + (x.status === "confirmado" ? "ok" : "svc"), x.status === "confirmado" ? "Confirmado" : "Aguardando"));
  // A mensagem sai do WhatsApp de quem agendou: só essa pessoa tem o botão
  const meu = (x.pedidoEmail || "") === C.email;
  if (x.contato && x.contato.tel && meu)
    fim.append(
      U.mkBtn(
        x.status === "confirmado" && !x.avisadoWhats ? "📲 Avisar colégio" : "📲 Avisar",
        x.status === "confirmado" && !x.avisadoWhats ? "btn-verde btn-sm" : "btn-sm",
        () => avisar(x)
      )
    );
  else if (x.status === "confirmado" && x.contato && x.contato.tel && !x.avisadoWhats && x.pedidoPor)
    t.append(el("span", "wait", `📲 ${U.first(x.pedidoPor)} vai avisar o colégio`));
  r.append(t, fim);
  return r;
}
// Abre a mensagem pronta e, se a data já está confirmada, marca que o colégio foi avisado
export function avisar(arg, extra) {
  const lst = Array.isArray(arg) ? arg : [arg],
    x = lst[0];
  painelAvisar(C, x.instNome, lst, x.contato, x.alunos, extra, async () => {
    const conf = lst.filter(y => y.status === "confirmado");
    if (!conf.length) return;
    try {
      const b = FS.writeBatch(db);
      conf.forEach(y => b.update(FS.doc(db, "agenda", y.id), { avisadoWhats: true, avisadoEm: new Date().toISOString() }));
      await b.commit();
    } catch (e) {
      avisoErro(e, "marcar o colégio como avisado");
    }
  });
}
export function cardPedido(gr) {
  gr.sort((a, b) => a.data.localeCompare(b.data));
  const x0 = gr[0];
  const e = el("article", "card today");
  const top = el("div", "card-top");
  top.append(el("h3", "name", title(x0.instNome)), el("span", "stage", "APROVAR"));
  e.append(top);
  gr.forEach(x =>
    e.append(
      el(
        "div",
        "fu today",
        `${ICO[x.kind] || "📌"} ${nomeEvento(x.kind, x.instNome)}: ${diaTxt(x.data)}/${x.data.slice(0, 4)}${x.hora ? " às " + x.hora : ""}${x.onde ? " · " + x.onde : ""}${x.local ? " (" + x.local + ")" : ""}`
      )
    )
  );
  const outros = gr.map(x => ensaios.filter(y => y.data === x.data && y.status !== "remarcar")).flat();
  if (outros.length)
    e.append(
      el(
        "p",
        "wait",
        "⚠️ Nesse dia já tem ensaio no estúdio: " + outros.map(y => `${y.hora || "sem hora"} ${U.first(y.cliente)}`).join(", ")
      )
    );
  const cps = gr.map(x => comps.filter(y => y.data === x.data)).flat();
  if (cps.length)
    e.append(
      el(
        "p",
        "wait",
        "⚠️ Compromisso nesse dia: " +
          cps.map(y => `${y.titulo || "Compromisso"} (${y.deQuem || ""}) ${y.diaInteiro ? "dia inteiro" : y.hora}`).join(", ")
      )
    );
  const det = [gr.map(x => x.obs).filter(Boolean)[0], x0.pedidoPor && "Pedido por " + U.first(x0.pedidoPor)].filter(Boolean).join("\n");
  if (det) e.append(el("p", "notes", det));
  const act = el("div", "actions");
  act.append(U.mkBtn(gr.length > 1 ? "✅ Aprovar as " + gr.length + " datas" : "✅ Aprovar", "btn-ok", () => aprovarGrupo(gr)));
  act.append(U.mkBtn("❌ Recusar", "btn-danger", () => recusar(gr)));
  e.append(act);
  return e;
}
export async function aprovarGrupo(gr) {
  try {
    const agora = new Date().toISOString();
    // agenda e instituição mudam juntas (ou nenhuma muda)
    const b = FS.writeBatch(db);
    for (const x of gr) {
      b.update(FS.doc(db, "agenda", x.id), { status: "confirmado", aprovadoPor: C.me || "", aprovadoEm: agora });
      if (x.instId && CAMPO[x.kind])
        b.update(FS.doc(db, "instituicoes", x.instId), { [CAMPO[x.kind] + ".status"]: "confirmado", atualizadoEm: agora });
    }
    await b.commit();
    let n = 0;
    try {
      n = await avisarColegioPorEmail(gr[0].instId, C);
    } catch (e) {
      avisoErro(e, "preparar o e-mail para o colégio", U.toast);
    }
    const txt = `Aprovado ✅${n ? ` · e-mail com as datas vai para ${n} contato${n > 1 ? "s" : ""}` : " · o colégio não tem e-mail cadastrado"}`;
    // quem agendou recebe o aviso para mandar a confirmação do próprio WhatsApp
    const meus = gr.filter(x => (x.pedidoEmail || "") === C.email && x.contato && x.contato.tel);
    if (meus.length)
      avisar(
        meus.map(x => Object.assign({}, x, { status: "confirmado" })),
        txt
      );
    else U.toast(txt + (gr[0].pedidoPor ? ` · ${U.first(gr[0].pedidoPor)} avisa o colégio pelo WhatsApp` : ""));
  } catch (e) {
    C.handleErr(e);
  }
}

export function recusar(arg) {
  const gr = Array.isArray(arg) ? arg : [arg],
    x = gr[0];
  sheet(gr.length > 1 ? "Recusar as datas" : "Recusar data", (p, close) => {
    p.append(
      el(
        "p",
        "hint",
        `${title(x.instNome)} · ${gr.map(g => nomeEvento(g.kind, g.instNome) + " " + diaTxt(g.data)).join(" + ")}. ${gr.length > 1 ? "Os dias ficam" : "O dia fica"} livre${gr.length > 1 ? "s" : ""} de novo.`
      )
    );
    const mot = el("input");
    mot.maxLength = 200;
    mot.placeholder = "ex.: já tenho ensaio nesse dia";
    const sug = el("input");
    sug.type = "date";
    sug.min = U.todayStr();
    p.append(
      field("Motivo", mot),
      field(gr.length > 1 ? "Sugerir outro dia para a formatura (opcional)" : "Sugerir outro dia (opcional)", sug),
      botoes(close, "Recusar e liberar o dia", "btn-danger")
    );
    setTimeout(() => mot.focus(), 30);
    p.addEventListener("submit", async ev => {
      ev.preventDefault();
      close();
      try {
        const b = FS.writeBatch(db);
        for (const y of gr) {
          b.delete(FS.doc(db, "agenda", y.id));
          if (y.instId && CAMPO[y.kind]) {
            const k = CAMPO[y.kind];
            b.update(FS.doc(db, "instituicoes", y.instId), {
              [k + ".status"]: "recusado",
              [k + ".motivoRecusa"]: mot.value.trim(),
              [k + ".sugestao"]: y.kind === "formatura" || gr.length === 1 ? sug.value || "" : "",
              atualizadoEm: new Date().toISOString()
            });
          }
        }
        await b.commit();
        U.toast(gr.length > 1 ? "Datas recusadas. Os dias ficaram livres." : "Data recusada. O dia ficou livre.");
      } catch (e) {
        C.handleErr(e);
      }
    });
  });
}
