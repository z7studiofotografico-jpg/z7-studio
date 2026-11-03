// Instituição que "Não fechou" (item 2.2): motivo (lista + texto livre), concorrente e data de retorno no ano
// seguinte (o Adriano é avisado antes dessa data). E a lista de todas as que não fecharam, com os motivos.
import { el, field, sel, sheet, botoes, title } from "./ui.js";
import * as U from "./util.js";

export const MOTIVOS_NAO_FECHOU = [
  "Já fechou com outra empresa",
  "Preço / sem verba",
  "Direção não autorizou",
  "Sem interesse este ano",
  "Poucos alunos",
  "Não consegui falar com quem decide",
  "Outro"
];
// 1º de fevereiro do ano seguinte (começo do ano letivo)
export const retornoPadrao = (hoje = U.todayStr()) => `${Number(hoje.slice(0, 4)) + 1}-02-01`;

export function abrirNaoFechou(C, it, salvar) {
  sheet("❌ Não fechou: " + title(it.nome || ""), (p, close) => {
    const nf = it.naoFechou || {};
    const mot = sel(MOTIVOS_NAO_FECHOU, nf.motivo || "", "escolha o motivo");
    mot.required = true;
    const txt = el("textarea");
    txt.rows = 2;
    txt.maxLength = 500;
    txt.placeholder = "Detalhe (opcional): o que disseram, quanto queriam pagar…";
    txt.value = nf.detalhe || "";
    const conc = el("input");
    conc.maxLength = 80;
    conc.placeholder = "ex.: Foto Tal (se fecharam com outra empresa)";
    conc.value = nf.concorrente || "";
    const ret = el("input");
    ret.type = "date";
    ret.required = true;
    ret.value = nf.retorno || retornoPadrao();
    p.append(
      field("Motivo", mot),
      field("Detalhe do motivo", txt),
      field("Concorrente (se houver)", conc),
      field("Voltar a procurar em", ret),
      el("p", "hint", "O Adriano recebe o aviso uma semana antes dessa data, e o colégio volta para “Para hoje” no dia."),
      botoes(close, "Salvar")
    );
    p.addEventListener("submit", ev => {
      ev.preventDefault();
      if (!mot.value || !ret.value) return;
      const naoFechou = {
        motivo: mot.value,
        detalhe: txt.value.trim(),
        concorrente: conc.value.trim(),
        retorno: ret.value,
        em: new Date().toISOString(),
        por: C.me || ""
      };
      salvar(
        {
          etapa: "NÃO FECHOU",
          naoFechou,
          motivo: [mot.value, txt.value.trim()].filter(Boolean).join(": "),
          followup: ret.value,
          followupHora: "",
          proximoPasso: "Retorno (não fechou)",
          atendendo: null
        },
        "Anotado: voltar em " + U.fmtDate(ret.value) + "/" + ret.value.slice(0, 4)
      );
      close();
    });
  });
}

// Todas as que não fecharam, agrupadas pelo motivo
export function listaNaoFecharam(itens) {
  sheet(
    "❌ Instituições que não fecharam",
    (p, close) => {
      const nf = itens.filter(i => i.etapa === "NÃO FECHOU");
      if (!nf.length) p.append(el("p", "hint", "Nenhuma por enquanto."));
      const grupos = {};
      nf.forEach(i => {
        const m = (i.naoFechou && i.naoFechou.motivo) || i.motivo || "Sem motivo anotado";
        (grupos[m] = grupos[m] || []).push(i);
      });
      Object.entries(grupos)
        .sort((a, b) => b[1].length - a[1].length)
        .forEach(([m, lst]) => {
          p.append(el("h3", "grp", `${m} (${lst.length})`));
          lst.forEach(i => {
            const x = i.naoFechou || {};
            p.append(
              el(
                "p",
                "notes",
                [
                  title(i.nome),
                  x.concorrente && "concorrente: " + x.concorrente,
                  x.detalhe,
                  x.retorno && "retorno: " + U.fmtDate(x.retorno) + "/" + x.retorno.slice(0, 4)
                ]
                  .filter(Boolean)
                  .join(" · ")
              )
            );
          });
        });
      p.append(U.mkBtn("Fechar", "", close));
    },
    { div: true }
  );
}
