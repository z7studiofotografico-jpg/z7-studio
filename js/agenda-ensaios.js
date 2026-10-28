// Agendamento: linhas de visitas do vendedor, ensaios no estúdio (analisar, remarcar, lembrar) e compromissos.
import { ENDERECO, ESTUDIO } from "./mensagens.js";
import { el, title, field, sheet, botoes, avisoErro } from "./ui.js";
import * as U from "./util.js";
import { openEnsaio, openComp } from "./agenda-form.js";
import { diaTxt, fimDe } from "./agenda-tempo.js";
import { C, FS, db, marco, quando, resumoDia } from "./agenda-estado.js";
// ---------- Visitas do vendedor (só informam) ----------
export function linhaVisita(x) {
  const r = el("div", "agrow");
  const t = el("div", "agtxt");
  t.append(
    el(
      "b",
      null,
      `🚗 ${x.proximoPasso === "Voltar para visita" || x.etapa === "AGENDAR VISITA" ? "Visita" : x.proximoPasso || "Retorno"}: ${title(x.nome)}`
    )
  );
  const det = [
    x.followupHora,
    C.nomeDe(x) && "👤 " + U.first(C.nomeDe(x)),
    x.proximoPasso && x.proximoPasso !== "Voltar para visita" ? x.proximoPasso : ""
  ]
    .filter(Boolean)
    .join(" · ");
  if (det) t.append(el("span", null, det));
  r.append(t, el("span", "tag", "Visita"));
  return r;
}

// ---------- Ensaios no estúdio ----------
export function linhaEnsaio(x) {
  const r = el("div", "agrow");
  const t = el("div", "agtxt");
  t.append(el("b", null, `📷 ${x.hora ? x.hora + "–" + fimDe(x) : "Sem horário"} · ${title(x.cliente)}`));
  t.append(
    el(
      "span",
      null,
      [x.codigo ? "🆔 " + x.codigo : "", x.tipo, marco() ? (x.sinalPago ? "💰 sinal pago" : "⚠️ sem sinal") : "", x.obs]
        .filter(Boolean)
        .join(" · ")
    )
  );
  if (x.status === "analisar")
    t.append(el("span", "wait", "⏳ A Luciana vai analisar: " + (x.conflito || "o dia já tem outro compromisso")));
  if (!marco()) {
    r.append(t, el("span", "tag", "Estúdio"));
    return r;
  }
  const act = el("div", "agact");
  const q = quando(x.data);
  if (x.tel && (q || !x.lembrado)) {
    const b = U.mkBtn(x.lembrado ? "✓ Lembrado" : "📲 Lembrar", x.lembrado ? "btn-sm" : q ? "btn-sm btn-ok" : "btn-sm", () => lembrar(x));
    b.title = "Abre o WhatsApp com a mensagem de lembrete pronta";
    act.append(b);
  }
  act.append(U.mkBtn("Editar", "btn-sm", () => openEnsaio(x)));
  r.append(t, act);
  return r;
}
export function cardAnalisar(x) {
  const e = el("article", "card today");
  const top = el("div", "card-top");
  top.append(el("h3", "name", `📷 ${title(x.cliente)}`), el("span", "stage", "ANALISAR"));
  e.append(top);
  e.append(
    el(
      "div",
      "fu today",
      `${diaTxt(x.data)}/${x.data.slice(0, 4)} · ${x.hora ? x.hora + "–" + fimDe(x) : "sem horário"} · ${x.tipo || "Ensaio"}`
    )
  );
  const dia = resumoDia(x.data, x.id);
  e.append(
    el(
      "p",
      "notes",
      (dia.length ? "Nesse dia também:\n" + dia.join("\n") : "") +
        (x.marcadoPor ? `\nMarcado por ${U.first(x.marcadoPor)}` : "") +
        (x.obs ? "\n" + x.obs : "")
    )
  );
  const act = el("div", "actions");
  act.append(
    U.mkBtn("✅ Pode marcar", "btn-ok", async () => {
      try {
        await FS.updateDoc(FS.doc(db, "ensaios", x.id), {
          status: "confirmado",
          analisadoPor: C.me || "",
          analisadoEm: new Date().toISOString()
        });
        U.toast("Ensaio confirmado ✅");
      } catch (er) {
        C.handleErr(er);
      }
    })
  );
  act.append(U.mkBtn("❌ Não dá", "btn-danger", () => naoDa(x)));
  e.append(act);
  return e;
}
export function naoDa(x) {
  sheet("Não dá nesse horário", (p, close) => {
    p.append(el("p", "hint", `${title(x.cliente)} · ${diaTxt(x.data)} ${x.hora || ""}. O Adriano vê o motivo e remarca com o cliente.`));
    const mot = el("input");
    mot.maxLength = 200;
    mot.placeholder = "ex.: tenho formatura à noite, melhor de manhã";
    p.append(field("Motivo / sugestão", mot), botoes(close, "Pedir para remarcar", "btn-danger"));
    setTimeout(() => mot.focus(), 30);
    p.addEventListener("submit", async ev => {
      ev.preventDefault();
      close();
      try {
        await FS.updateDoc(FS.doc(db, "ensaios", x.id), {
          status: "remarcar",
          motivo: mot.value.trim(),
          analisadoPor: C.me || "",
          analisadoEm: new Date().toISOString()
        });
        U.toast("Pedido de remarcar enviado");
      } catch (e) {
        C.handleErr(e);
      }
    });
  });
}
export function cardRemarcar(x) {
  const e = el("article", "card late");
  const top = el("div", "card-top");
  top.append(el("h3", "name", `📷 ${title(x.cliente)}`), el("span", "stage", "REMARCAR"));
  e.append(top);
  e.append(el("div", "fu late", `${diaTxt(x.data)} · ${x.hora || "sem horário"} · ${x.tipo || "Ensaio"}`));
  e.append(
    el("p", "notes", `${x.analisadoPor ? U.first(x.analisadoPor) : "A Luciana"} pediu para remarcar${x.motivo ? ": " + x.motivo : "."}`)
  );
  const act = el("div", "actions");
  act.append(U.mkBtn("Remarcar", "btn-primary", () => openEnsaio(x)));
  if (x.tel) act.append(U.mkBtn("💬 WhatsApp", "", () => window.open("https://wa.me/" + U.digits(x.tel), "_blank", "noopener")));
  e.append(act);
  return e;
}
export function msgLembrete(x) {
  const q = quando(x.data);
  const dia = q ? `${q} (${diaTxt(x.data)})` : diaTxt(x.data);
  return `Olá, ${U.first(title(x.cliente))}! Aqui é do ${ESTUDIO.nome} 📸\nPassando para lembrar do seu ensaio ${dia}${x.hora ? " às " + x.hora : ""}, aqui no estúdio: ${ENDERECO}.\nSe tiver algum imprevisto, é só me avisar por aqui. Até lá! 😊`;
}
export async function lembrar(x) {
  const tel = U.digits(x.tel);
  if (!tel) {
    U.toast("Esse ensaio está sem WhatsApp");
    return;
  }
  window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msgLembrete(x))}`, "_blank", "noopener");
  if (!x.lembrado) {
    try {
      await FS.updateDoc(FS.doc(db, "ensaios", x.id), { lembrado: true, lembradoEm: new Date().toISOString(), lembradoPor: C.me || "" });
    } catch (e) {
      avisoErro(e, "marcar como lembrado");
    }
  }
}

// ---------- Compromissos (consulta médica, outros afazeres) ----------
export function linhaComp(x) {
  const r = el("div", "agrow");
  const t = el("div", "agtxt");
  const oculto = x.particular && !marco();
  t.append(
    el(
      "b",
      null,
      oculto ? `🔒 ${x.deQuem || "Compromisso"}: ocupado` : `📌 ${x.titulo || "Compromisso"}${x.deQuem ? " · " + x.deQuem : ""}`
    )
  );
  t.append(
    el(
      "span",
      null,
      [
        x.diaInteiro ? "Dia inteiro" : x.hora ? x.hora + "–" + fimDe(x) : "",
        !oculto && x.obs,
        x.particular && marco() ? "🔒 particular" : ""
      ]
        .filter(Boolean)
        .join(" · ")
    )
  );
  if (!marco()) {
    r.append(t, el("span", "tag " + (x.diaInteiro ? "late" : ""), x.diaInteiro ? "Dia bloqueado" : "Ocupado"));
    return r;
  }
  const act = el("div", "agact");
  if (x.diaInteiro) act.append(el("span", "tag late", "Dia bloqueado"));
  act.append(U.mkBtn("Editar", "btn-sm", () => openComp(x)));
  r.append(t, act);
  return r;
}
