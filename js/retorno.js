// "Pediu contato depois": o motivo (ex.: não consegue pagar agora, recebe dia 10) e a data em que a pessoa
// pediu para voltar a falar. Fica no aluno (PR) ou no formando (Formaturas):
//   retorno = { data, motivo, por, porEmail, em }        → o pedido atual (a data em que a equipe volta a falar)
//   motivos = [{ em, por, texto, data }]                  → todo o histórico (nunca apaga)
// Na data, o contato aparece para a equipe com o motivo, para ninguém conversar sem saber o que aconteceu.
import { el, field, sheet, botoes } from "./ui.js";
import * as U from "./util.js";

const dataBR = d => (d ? `${U.fmtDate(d)}/${d.slice(0, 4)}` : "");
// (24/11/2026) 📅 Data de retorno da provável venda: dia, hora e com quem falar (o WhatsApp da conversa).
// retorno = { data, hora, com, tel, motivo, … } e retornoAvisar = "AAAA-MM-DDTHH:MM" (horário de Brasília): o robô
// (scripts/retornos.mjs, de 15 em 15 minutos) avisa o representante e o admin no celular e apaga o retornoAvisar
export const quemTxt = (it, c) => {
  const aluno = U.first(String((it && it.nome) || "").toLowerCase()).replace(/^\w/, x => x.toUpperCase()) || "o aluno";
  if (!c || c.tipo === "Formando") return aluno;
  const nome = c.nome ? " (" + U.first(String(c.nome).toLowerCase()).replace(/^\w/, x => x.toUpperCase()) + ")" : "";
  return `${String(c.tipo || "responsável").toLowerCase()} de ${aluno}${nome}`;
};
export const frasRetorno = r =>
  `📅 ${dataBR(r.data)} às ${r.hora} – entrar em contato com ${r.com || "o cliente"}${r.tel ? " · " + r.tel : ""} para confirmar a venda`;
const agoraBR = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date()).replace(" ", "T");
export const retornoVenceu = r => !!(r && r.data && r.hora && `${r.data}T${r.hora}` <= agoraBR());
// já passou da data (ou é hoje): é para retornar
export const retornarHoje = it => !!(it && it.retorno && it.retorno.data && it.retorno.data <= U.todayStr());

// As linhas do cartão: o retorno pedido e o histórico de motivos
export function linhasRetorno(it) {
  const out = [];
  if (it.naoContatar) out.push(el("p", "wait", "🚫 Não entrar em contato" + (it.naoContatarMotivo ? ": " + it.naoContatarMotivo : "")));
  const r = it.retorno;
  // a frase do retorno já vem na linha de cima (situação); aqui só o número do WhatsApp e a observação
  if (r && r.data && r.hora) out.push(el("p", "notes", [r.tel ? "📱 " + r.tel : "", r.motivo ? "📝 " + r.motivo : ""].filter(Boolean).join(" · ")));
  else if (r && r.data) {
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
// o = { venda: true, contatos, contato } → 📅 Data de retorno da provável venda (com hora e com quem falar)
export function abrirRetorno(C, it, salvar, o = {}) {
  sheet(o.venda ? "📅 Data de retorno (provável venda)" : "📅 Pediu contato depois", (p, close) => {
    p.append(
      el(
        "p",
        "hint",
        o.venda
          ? "Marque o dia e a hora para voltar a falar e fechar a venda. Na hora, você e o Adriano recebem um aviso no celular."
          : "Anote o motivo e o dia em que a pessoa pediu para voltar a falar. Nesse dia o contato volta para a lista, com o motivo, para quem for conversar."
      )
    );
    const motivo = el("textarea");
    motivo.rows = o.venda ? 2 : 3;
    motivo.maxLength = 500;
    motivo.required = !o.venda;
    motivo.placeholder = o.venda
      ? "ex.: a mãe recebe dia 25 e vai pagar no Pix"
      : "ex.: não consegue pagar agora, recebe dia 10; pediu para chamar depois das provas";
    const data = el("input");
    data.type = "date";
    data.required = true;
    data.min = U.todayStr();
    data.value = (it.retorno && it.retorno.data > U.todayStr() && it.retorno.data) || U.addDays(o.venda ? 1 : 7);
    const hora = el("input");
    hora.type = "time";
    hora.required = true;
    hora.value = (it.retorno && it.retorno.hora) || "10:00";
    const cs = (o.contatos || []).filter(c => c && c.tel);
    const quem = el("select");
    cs.forEach((c, i) => {
      const op = el("option", null, `${quemTxt(it, c)} · ${c.tel}`);
      op.value = String(i);
      if (c === o.contato) op.selected = true;
      quem.append(op);
    });
    if (o.venda) {
      if (cs.length) p.append(field("Entrar em contato com (o WhatsApp da conversa)", quem));
      const dh = el("div", "row2");
      dh.append(field("Dia do retorno", data), field("Hora", hora));
      p.append(dh, field("Observação (opcional)", motivo));
    } else p.append(field("Motivo", motivo), field("Voltar a falar em", data));
    const atalhos = el("div", "quick");
    [
      ["Amanhã", 1],
      ["1 semana", 7],
      ["15 dias", 15],
      ["1 mês", 30]
    ]
      .filter(([, n]) => !o.venda || n <= 7)
      .forEach(([t, n]) => atalhos.append(U.mkBtn(t, "btn-sm", () => (data.value = U.addDays(n)))));
    p.append(atalhos, botoes(close, "Salvar"));
    let salvando = false; // toque duplo no Salvar não grava o motivo duas vezes
    p.addEventListener("submit", async ev => {
      ev.preventDefault();
      const texto = motivo.value.trim();
      if ((!texto && !o.venda) || !data.value || (o.venda && !hora.value) || salvando) return;
      salvando = true;
      const agora = new Date().toISOString();
      const ret = { data: data.value, motivo: texto, por: C.me || "", porEmail: C.email || "", em: agora };
      const patch = { retorno: ret };
      if (o.venda) {
        const c = cs[Number(quem.value)] || cs[0];
        Object.assign(ret, { hora: hora.value, com: quemTxt(it, c), tel: (c && c.tel) || "" });
        patch.retornoAvisar = `${data.value}T${hora.value}`;
        const ant = it.retorno && it.retorno.hora ? ` (antes ${dataBR(it.retorno.data)} às ${it.retorno.hora})` : "";
        patch.motivos = [
          ...(it.motivos || []),
          { em: agora, por: C.me || "", texto: `Retorno marcado para ${dataBR(data.value)} às ${hora.value} com ${ret.com}${ant}${texto ? ": " + texto : ""}`, data: data.value }
        ];
      } else patch.motivos = [...(it.motivos || []), { em: agora, por: C.me || "", texto, data: data.value }];
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
