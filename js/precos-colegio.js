// Preço de cada colégio (PR, Paspatur e Formatura): os valores mudam muito de um trabalho para outro, então o
// Adriano cadastra na hora do trabalho daquele colégio. Fica em config/precosColegio:
// { colegios: { "2026|CHAVE DO COLEGIO": { escola, ano, pr: {lfPix, ...}, paspatur: {...}, formatura: {...}, em, por } } }
// Colégio sem preço = bloqueio: a equipe não manda mensagem com valor nem registra venda até o preço ser cadastrado.
import { el, sheet, field, title } from "./ui.js";
import * as U from "./util.js";

// Linha de Frente e Repasse são precificados separados: o Repasse só depois da virada (o Adriano ajusta o preço lá).
// Parcelas: até 12x, só no cartão (Pix e dinheiro são à vista).
export const CAMPOS_SEG = {
  lf: [
    ["lfPix", "Pix (à vista)"],
    ["lfCartao", "Cartão"]
  ],
  rep: [
    ["kitPreco", "Preço cheio"],
    ["kitPromo", "Pix (à vista)"],
    ["kitCartao", "Cartão"],
    ["kitFinal", "Última oferta"]
  ]
};
export const PARCELAS_SEG = { lf: "lfParcelas", rep: "parcelas" };
export const CAMPOS_COLEGIO = [...CAMPOS_SEG.lf, ...CAMPOS_SEG.rep];
// código Pix e link de cartão dos Ajustes: só valem quando o valor do colégio é o mesmo dos Ajustes
const CODIGOS = [
  ["pixLF", "lfPix"],
  ["pixRep", "kitPromo"],
  ["pixFinal", "kitFinal"],
  ["linkCartaoLF", "lfCartao"],
  ["linkCartao", "kitCartao"],
  ["linkCartaoFinal", "kitFinal"]
];

let mapa = {};
let pronto = false;
let ouvindo = false;
const avisos = new Set();
export const aoMudarPrecos = f => avisos.add(f);
export function ouvirPrecosColegio(C) {
  if (ouvindo || !C || !C.FS) return;
  ouvindo = true;
  try {
    C.FS.onSnapshot(
      C.FS.doc(C.db, "config", "precosColegio"),
      s => {
        mapa = (s.exists() && s.data().colegios) || {};
        pronto = true;
        avisos.forEach(f => {
          try {
            f();
          } catch (_) {}
        });
      },
      () => (pronto = true)
    );
  } catch (_) {
    pronto = true;
  }
}
// para os testes
export function usarPrecos(m) {
  mapa = m || {};
  pronto = true;
}

// o nome inteiro do colégio, com a unidade (Legacy Nilópolis e Legacy Nova Iguaçu têm preços diferentes)
export const chavePreco = (escola, ano) =>
  `${Number(ano) || ""}|${U.chave(escola)
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()}`;
// tem preço da etapa (Linha de Frente ou Repasse)? sem etapa: qualquer valor
const temValor = (p, seg) => !!p && (CAMPOS_SEG[seg] || CAMPOS_COLEGIO).some(([k]) => Number(p[k]) > 0);
// preços do colégio para o tipo de venda e a etapa, ou null (sem preço)
export function precoDoColegio(escola, ano, tipo, seg) {
  const x = mapa[chavePreco(escola, ano)];
  const p = x && x[tipo];
  return temValor(p, seg) ? p : null;
}
// ainda carregando: não bloqueia (usa os Ajustes)
export const precosProntos = () => pronto;

// junta os Ajustes com o preço do colégio; sem preço do colégio, os valores ficam zerados e marca semPrecoColegio
export function comPrecoDoColegio(base, it, tipo, seg) {
  if (!it || !pronto) return base;
  const p = precoDoColegio(it.escola, it.ano, tipo, seg);
  const zerados = Object.fromEntries(CAMPOS_COLEGIO.map(([k]) => [k, 0]));
  if (!p) {
    const out = Object.assign({}, base, zerados, { semPrecoColegio: true });
    CODIGOS.forEach(([c]) => delete out[c]);
    return out;
  }
  const out = Object.assign({}, base, zerados);
  CAMPOS_COLEGIO.forEach(([k]) => Number(p[k]) > 0 && (out[k] = Number(p[k])));
  Object.values(PARCELAS_SEG).forEach(k => Number(p[k]) > 0 && (out[k] = Number(p[k])));
  CODIGOS.forEach(([c, v]) => Number(base[v]) !== Number(out[v]) && delete out[c]);
  return out;
}

// aviso vermelho com o botão de cadastrar (só o admin cadastra)
const NOME_SEG = { lf: "Linha de Frente", rep: "Repasse" };
export function avisoSemPreco(C, it, tipo, nomeTipo, seg) {
  const box = el("div", "sem-preco");
  box.append(
    el("b", null, `🚫 ${title(it.escola || "Colégio")} ${it.ano || ""} está sem preço (${nomeTipo}${seg ? " · " + NOME_SEG[seg] : ""})`),
    el(
      "small",
      null,
      C.isAdmin
        ? "Cadastre o preço deste colégio para liberar as mensagens com valor e o registro de venda."
        : "As mensagens com valor e o registro de venda ficam bloqueados até o Adriano cadastrar o preço deste colégio."
    )
  );
  if (C.isAdmin)
    box.append(
      U.mkBtn("💲 Cadastrar preço do colégio", "btn-sm btn-primary", () => abrirPrecoColegio(C, it.escola, it.ano, tipo, nomeTipo, seg))
    );
  return box;
}

// janela de preço do colégio (admin): os valores da etapa (Linha de Frente ou Repasse) e as parcelas no cartão
export function abrirPrecoColegio(C, escola, ano, tipo, nomeTipo, seg) {
  if (!C.isAdmin) return U.toast("Só o Adriano cadastra o preço do colégio.");
  const k = chavePreco(escola, ano);
  const atual = (mapa[k] && mapa[k][tipo]) || {};
  const sg = CAMPOS_SEG[seg] ? seg : "lf";
  sheet(`💲 Preço · ${nomeTipo} · ${NOME_SEG[sg]}`, (p, close) => {
    p.append(
      el(
        "p",
        "hint",
        `${title(escola)} · ${ano || ""}. Vale só para este colégio, este ano e ${sg === "lf" ? "a Linha de Frente (o Repasse você precifica de novo depois da virada)" : "o Repasse"}.`
      )
    );
    const grade = el("div", "row2");
    const ins = CAMPOS_SEG[sg].map(([c, rot]) => {
      const i = el("input");
      i.inputMode = "decimal";
      i.placeholder = "0,00";
      i.value = Number(atual[c]) ? String(atual[c]).replace(".", ",") : "";
      grade.append(field(rot + " (R$)", i));
      return [c, i];
    });
    // parcelas sem juros no cartão (com juros o link vai até 12x); Pix e dinheiro são à vista
    const kp = PARCELAS_SEG[sg];
    const parc = el("select");
    for (let n = 1; n <= 12; n++) {
      const o = el("option", null, n === 1 ? "Só com juros (até 12x)" : n === 12 ? "12x sem juros" : `${n}x sem juros (com juros até 12x)`);
      o.value = String(n);
      parc.append(o);
    }
    parc.value = String(Number(atual[kp]) || 1);
    grade.append(field("Parcelas sem juros no cartão", parc));
    const err = el("p", "err");
    err.hidden = true;
    const salvar = U.mkBtn("Salvar preço", "btn-primary", async () => {
      const vals = Object.fromEntries(ins.map(([c, i]) => [c, Number(String(i.value).replace(/\./g, "").replace(",", ".")) || 0]));
      if (!temValor(vals, sg)) {
        err.textContent = "Coloque pelo menos um valor.";
        err.hidden = false;
        return;
      }
      vals[kp] = Number(parc.value) || 1;
      try {
        await C.FS.setDoc(
          C.FS.doc(C.db, "config", "precosColegio"),
          {
            colegios: {
              [k]: { escola: String(escola || ""), ano: Number(ano) || null, [tipo]: vals, em: new Date().toISOString(), por: C.me || "" }
            }
          },
          { merge: true }
        );
        U.toast("Preço do colégio salvo ✅");
        close();
      } catch (e) {
        C.handleErr(e);
      }
    });
    const a = el("div", "actions");
    a.append(salvar, U.mkBtn("Cancelar", "", close));
    p.append(grade, err, a);
  });
}

// mensagem com "[valor do kit]" (colégio sem preço) não sai: o botão fica travado com o aviso
export function travarMensagensSemValor(root) {
  const travar = () =>
    root.querySelectorAll('a[href*="wa.me"]').forEach(a => {
      let t = "";
      try {
        t = decodeURIComponent(a.href);
      } catch (_) {
        t = a.href;
      }
      if (!/\[valor/i.test(t)) return;
      a.removeAttribute("href");
      a.classList.add("travado");
      a.title = "Colégio sem preço: o Adriano precisa cadastrar o preço deste colégio";
      a.onclick = ev => {
        ev.preventDefault();
        U.toast("🚫 Colégio sem preço: o Adriano precisa cadastrar o preço deste colégio.");
      };
    });
  travar();
  try {
    new MutationObserver(travar).observe(root, { childList: true, subtree: true });
  } catch (_) {}
}

// colégio sem preço (contrato sem valor nos itens): aviso vermelho no cartão do aluno
const precosLidos = new Map();
export async function avisoPrecoAluguel(C, a) {
  if (!a.instId || !a.ano || a.contratoZerado) return null;
  const id = `${a.instId}_${Number(a.ano)}`;
  if (!precosLidos.has(id))
    precosLidos.set(
      id,
      C.FS.getDoc(C.FS.doc(C.db, "contratosColegio", id))
        .then(s => (s.exists() ? s.data() : null))
        .catch(() => undefined)
    );
  const c = await precosLidos.get(id);
  if (c === undefined) return null;
  if (c && (c.quemPaga === "colegio" || Object.values(c.precos || {}).some(v => Number(v) > 0))) return null;
  const box = el("div", "sem-preco");
  box.append(
    el("b", null, `🚫 ${title(a.instNome || "Colégio")} ${a.ano} está sem preço`),
    el(
      "small",
      null,
      C.isAdmin ? "Coloque o preço de cada item no Contrato do colégio." : "Os pagamentos ficam bloqueados até o Adriano colocar o preço."
    )
  );
  if (C.isAdmin)
    box.append(
      U.mkBtn("📄 Abrir o contrato", "btn-sm btn-primary", () =>
        import("./contrato-colegio.js")
          .then(m => m.abrirContrato(C, { id: a.instId, nome: a.instNome }, Number(a.ano)))
          .then(() => precosLidos.delete(id))
          .catch(e => C.handleErr(e))
      )
    );
  return box;
}
