// "Pediu contato depois": o motivo (ex.: não consegue pagar agora, recebe dia 10) e a data em que a pessoa
// pediu para voltar a falar. Fica no aluno (PR) ou no formando (Formaturas):
//   retorno = { data, motivo, por, porEmail, em }        → o pedido atual (a data em que a equipe volta a falar)
//   motivos = [{ em, por, texto, data }]                  → todo o histórico (nunca apaga)
// Na data, o contato aparece para a equipe com o motivo, para ninguém conversar sem saber o que aconteceu.
import { el, field, sheet, botoes } from "./ui.js";
import * as U from "./util.js";

const dataBR = d => (d ? `${U.fmtDate(d)}/${d.slice(0, 4)}` : "");
// já passou da data (ou é hoje): é para retornar
export const retornarHoje = it => !!(it && it.retorno && it.retorno.data && it.retorno.data <= U.todayStr());

// As linhas do cartão: o retorno pedido e o histórico de motivos
export function linhasRetorno(it) {
  const out = [];
  if (it.naoContatar) out.push(el("p", "wait", "🚫 Não entrar em contato" + (it.naoContatarMotivo ? ": " + it.naoContatarMotivo : "")));
  const r = it.retorno;
  if (r && r.data) {
    const hoje = retornarHoje(it);
    out.push(
      el(
        "p",
        hoje ? "wait" : "notes",
        `${hoje ? (r.data < U.todayStr() ? "⏰ Retornar (pedido para " + dataBR(r.data) + ")" : "⏰ Retornar hoje") : "🔁 Retornar em " + dataBR(r.data)}${r.motivo ? ": " + r.motivo : ""}` +
          (r.por ? ` (pediu a ${U.first(r.por)} em ${dataBR(String(r.em || "").slice(0, 10))})` : "")
      )
    );
  }
  const ms = (it.motivos || []).filter(m => m && m.texto);
  if (ms.length > 1 || (ms.length === 1 && !(r && r.motivo === ms[0].texto))) {
    const d = el("details", "notes");
    d.append(el("summary", null, `Histórico de motivos (${ms.length})`));
    ms.slice()
      .reverse()
      .forEach(m =>
        d.append(
          el(
            "div",
            null,
            `${dataBR(String(m.em || "").slice(0, 10))}${m.por ? " · " + U.first(m.por) : ""}: ${m.texto}${m.data ? " → retornar " + dataBR(m.data) : ""}`
          )
        )
      );
    out.push(d);
  }
  return out;
}

// Janela "Pediu contato depois". salvar(patch) grava no documento (o PR acrescenta o próximo contato)
export function abrirRetorno(C, it, salvar) {
  sheet("📅 Pediu contato depois", (p, close) => {
    p.append(
      el(
        "p",
        "hint",
        "Anote o motivo e o dia em que a pessoa pediu para voltar a falar. Nesse dia o contato volta para a lista, com o motivo, para quem for conversar."
      )
    );
    const motivo = el("textarea");
    motivo.rows = 3;
    motivo.maxLength = 500;
    motivo.required = true;
    motivo.placeholder = "ex.: não consegue pagar agora, recebe dia 10; pediu para chamar depois das provas";
    const data = el("input");
    data.type = "date";
    data.required = true;
    data.min = U.todayStr();
    data.value = (it.retorno && it.retorno.data > U.todayStr() && it.retorno.data) || U.addDays(7);
    p.append(field("Motivo", motivo), field("Voltar a falar em", data));
    const atalhos = el("div", "quick");
    [
      ["Amanhã", 1],
      ["1 semana", 7],
      ["15 dias", 15],
      ["1 mês", 30]
    ].forEach(([t, n]) => atalhos.append(U.mkBtn(t, "btn-sm", () => (data.value = U.addDays(n)))));
    p.append(atalhos, botoes(close, "Salvar"));
    let salvando = false; // toque duplo no Salvar não grava o motivo duas vezes
    p.addEventListener("submit", async ev => {
      ev.preventDefault();
      const texto = motivo.value.trim();
      if (!texto || !data.value || salvando) return;
      salvando = true;
      const agora = new Date().toISOString();
      const ret = { data: data.value, motivo: texto, por: C.me || "", porEmail: C.email || "", em: agora };
      const patch = {
        retorno: ret,
        motivos: [...(it.motivos || []), { em: agora, por: C.me || "", texto, data: data.value }]
      };
      try {
        await salvar(patch);
        Object.assign(it, patch);
        close();
      } catch (e) {
        salvando = false;
        C.handleErr(e);
      }
    });
    setTimeout(() => motivo.focus(), 30);
  });
}
