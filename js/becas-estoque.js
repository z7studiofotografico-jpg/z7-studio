// Estoque do Aluguel de becas (Etapa 3): becas por tipo e tamanho (com a versão "menos longa" P1, M1, G1… da beca
// tradicional preta, que FAZ PARTE do total do tamanho), 14 faixas (cor + fina/grossa) e 2 capelos.
// Salvo em config/app → estoque = { becas, tamanhos, menosLonga, faixas, capelos }.
// O que está em uso NÃO é gravado como número: é contado dos aluguéis (avulsos e alunos), então nunca fica negativo
// nem "devolvido duas vezes".
import { el, sheet, botoes, gradeQtd } from "./ui.js";
import * as U from "./util.js";

export const TAMANHOS = ["PPP", "PP", "P", "M", "G", "GG", "XG", "XXG", "EXG"].map(t => [t, t]);
export const BECAS = [
  ["pelerineAzul", "Beca pelerine azul"],
  ["infAzul", "Beca infantil azul"],
  ["infPreta", "Beca infantil preta"],
  ["tradPreta", "Beca tradicional preta"],
  ["americana", "Beca americana"]
];
// só a beca tradicional preta tem a versão "menos longa" (não se aplica à infantil)
export const COM_MENOS_LONGA = ["tradPreta"];
export const FAIXAS = [
  ["azul_fina", "Azul fina"],
  ["azul_grossa", "Azul grossa"],
  ["amarela_grossa", "Amarela grossa"],
  ["grena_fina", "Grená fina"],
  ["rosa_fina", "Rosa fina"],
  ["verde_fina", "Verde fina"],
  ["verde_grossa", "Verde grossa"],
  ["branca_fina", "Branca fina"],
  ["branca_grossa", "Branca grossa"],
  ["lilas_fina", "Lilás fina"],
  ["lilas_grossa", "Lilás grossa"],
  ["vermelha_fina", "Vermelha fina"],
  ["vermelha_grossa", "Vermelha grossa"],
  ["laranja_grossa", "Laranja grossa"]
];
// faixas e capelo do jeito antigo (aluguéis já registrados continuam aparecendo certo)
export const FAIXAS_ANTIGAS = [
  ["azul", "Azul"],
  ["branca", "Branca"],
  ["amarela", "Amarela"],
  ["lilas", "Lilás"],
  ["verde", "Verde"],
  ["laranja", "Laranja"],
  ["rosa", "Rosa"],
  ["vermelha", "Vermelha"]
];
export const CAPELOS = [
  ["azulRoyal", "Capelo azul royal"],
  ["preto", "Capelo preto"]
];
export const CAPELOS_ANTIGOS = [["capelo", "Capelo"]];
export const nomeFaixa = k => ([...FAIXAS, ...FAIXAS_ANTIGAS].find(f => f[0] === k) || [k, k])[1];
export const nomeCapelo = k => ([...CAPELOS, ...CAPELOS_ANTIGOS].find(f => f[0] === k) || [k, k])[1];
export const nomeBeca = k => (BECAS.find(b => b[0] === k) || [k, k])[1];
// infantil ou adulto: os tamanhos são diferentes, então sempre aparece escrito
export const idadeBeca = k => (String(k || "").startsWith("inf") ? "infantil" : "adulto");
// "Infantil GG", "Adulto P1" (P1 = P menos longa); sem tamanho: "Adulto · sem tamanho"
export function tamanhoBeca(a) {
  const i = idadeBeca(a && a.becaTipo);
  const t = a && a.tamanho ? a.tamanho + (a.menosLonga ? "1" : "") : "";
  return (i === "infantil" ? "Infantil" : "Adulto") + (t ? " " + t : " · sem tamanho");
}
// o modelo sem repetir "beca" e "infantil": "preta", "tradicional preta", "pelerine azul"
export const modeloBeca = k =>
  nomeBeca(k)
    .replace(/^Beca\s+/i, "")
    .replace(/^infantil\s+/i, "");

const n0 = v => Number(v) || 0;
// Alunos de aluguel: em que estado está a beca, a faixa e o capelo
export const RESERVA = ["Beca medida", "Produtos em produção", "Pronto para retirada"];
export const FORA = ["Retirou a beca"];
// uso = { becas: {tipo: n}, tamanhos: {tipo: {tam: n}}, menosLonga: {tipo: {tam: n}}, faixas: {}, capelos: {} }
export function usoDosAlunos(alunos) {
  const u = { becas: {}, tamanhos: {}, menosLonga: {}, faixas: {}, capelos: {}, reservado: 0, fora: 0 };
  alunos
    .filter(a => !a.excluido && !a.naoParticipa && (RESERVA.includes(a.status) || FORA.includes(a.status)))
    .forEach(a => {
      if (FORA.includes(a.status)) u.fora++;
      else u.reservado++;
      if (a.becaTipo) {
        u.becas[a.becaTipo] = n0(u.becas[a.becaTipo]) + 1;
        if (a.tamanho) {
          const t = (u.tamanhos[a.becaTipo] = u.tamanhos[a.becaTipo] || {});
          t[a.tamanho] = n0(t[a.tamanho]) + 1;
          if (a.menosLonga) {
            const m = (u.menosLonga[a.becaTipo] = u.menosLonga[a.becaTipo] || {});
            m[a.tamanho] = n0(m[a.tamanho]) + 1;
          }
        }
      }
      if (a.faixa) u.faixas[a.faixa] = n0(u.faixas[a.faixa]) + 1;
      if (a.capelo) u.capelos[a.capelo] = n0(u.capelos[a.capelo]) + 1;
    });
  return u;
}
// soma dois usos (avulsos + alunos)
export function somarUso(a, b) {
  const out = JSON.parse(JSON.stringify(a || {}));
  ["becas", "faixas", "capelos"].forEach(k => {
    out[k] = out[k] || {};
    Object.entries((b || {})[k] || {}).forEach(([x, v]) => (out[k][x] = n0(out[k][x]) + n0(v)));
  });
  ["tamanhos", "menosLonga"].forEach(k => {
    out[k] = out[k] || {};
    Object.entries((b || {})[k] || {}).forEach(([tp, zs]) => {
      const o = (out[k][tp] = out[k][tp] || {});
      Object.entries(zs).forEach(([z, v]) => (o[z] = n0(o[z]) + n0(v)));
    });
  });
  return out;
}
// O que falta para o aluno (a) usar esta beca/faixa/capelo agora: lista de textos (vazia = tem)
export function faltaParaAluno(E, uso, a) {
  const out = [];
  const livre = (tem, usado) => n0(tem) - n0(usado);
  if (a.becaTipo) {
    if (n0((E.becas || {})[a.becaTipo]) && livre((E.becas || {})[a.becaTipo], (uso.becas || {})[a.becaTipo]) < 1)
      out.push(nomeBeca(a.becaTipo));
    const ET = (E.tamanhos || {})[a.becaTipo] || {};
    if (a.tamanho && n0(ET[a.tamanho])) {
      if (livre(ET[a.tamanho], ((uso.tamanhos || {})[a.becaTipo] || {})[a.tamanho]) < 1) out.push(`${nomeBeca(a.becaTipo)} ${a.tamanho}`);
      if (a.menosLonga) {
        const EM = ((E.menosLonga || {})[a.becaTipo] || {})[a.tamanho];
        if (n0(EM) && livre(EM, ((uso.menosLonga || {})[a.becaTipo] || {})[a.tamanho]) < 1) out.push(`${a.tamanho}1 (menos longa)`);
      }
    }
  }
  // 11/11/2026: só confere o que tem estoque cadastrado (faixa ou capelo sem número cadastrado não trava o aluno)
  if (a.faixa && n0((E.faixas || {})[a.faixa]) && livre((E.faixas || {})[a.faixa], (uso.faixas || {})[a.faixa]) < 1)
    out.push("Faixa " + nomeFaixa(a.faixa).toLowerCase());
  if (a.capelo && n0((E.capelos || {})[a.capelo]) && livre((E.capelos || {})[a.capelo], (uso.capelos || {})[a.capelo]) < 1)
    out.push(nomeCapelo(a.capelo));
  return out;
}

// Tela do estoque (só o admin muda). uso = o que está reservado/fora agora (avulsos + alunos)
export function abrirEstoqueBecas(C, uso, aoSalvar) {
  sheet("📦 Estoque de becas, faixas e capelos", (p, close) => {
    const E = C.P.estoque || {};
    p.append(
      el(
        "p",
        "hint",
        C.isAdmin
          ? "Quantas peças vocês têm de cada tipo. Ao lado de cada número aparece quanto está reservado ou fora agora."
          : "Só administradores mudam o estoque."
      )
    );
    const fora = (o, k) => (n0((o || {})[k]) ? ` · ${n0(o[k])} em uso` : "");
    const tab = (titulo, tipos, atual, emUso) => {
      const f = el("div", "field");
      f.append(el("label", null, titulo));
      const g = gradeQtd(tipos, atual, {
        max: 5,
        disabled: !C.isAdmin,
        rotulo: (k, t) => "Estoque " + t,
        texto: (k, t) => t + fora(emUso, k)
      });
      f.append(g.box);
      p.append(f);
      return g.ins;
    };
    const iB = tab("Becas (o jabor vai junto)", BECAS, E.becas, uso.becas);
    const iF = tab("Faixas (cor e espessura)", FAIXAS, E.faixas, uso.faixas);
    const iC = tab("Capelos", CAPELOS, E.capelos, uso.capelos);
    p.append(el("label", "field-tit", "Tamanhos de cada beca (PPP a EXG)"));
    const iT = BECAS.map(([tp, nm]) => {
      const d = el("details", "tamtipo"),
        sm = el("summary");
      d.append(sm);
      const ml = COM_MENOS_LONGA.includes(tp);
      const ins = TAMANHOS.map(([z]) => {
        const r = el("div", "prow");
        const q = el("input");
        q.inputMode = "numeric";
        q.className = "preco";
        q.maxLength = 4;
        q.value = n0(((E.tamanhos || {})[tp] || {})[z]) || "";
        q.disabled = !C.isAdmin;
        q.setAttribute("aria-label", `Estoque ${nm} ${z}`);
        const u = n0(((uso.tamanhos || {})[tp] || {})[z]);
        r.append(el("span", null, z + (u ? ` · ${u} em uso` : "")), q);
        let q1 = null;
        if (ml) {
          q1 = el("input");
          q1.inputMode = "numeric";
          q1.className = "preco";
          q1.maxLength = 4;
          q1.value = n0(((E.menosLonga || {})[tp] || {})[z]) || "";
          q1.disabled = !C.isAdmin;
          q1.placeholder = z + "1";
          q1.title = `Quantas ${z} são “menos longa” (${z}1): fazem parte do total de ${z}`;
          q1.setAttribute("aria-label", `${nm} ${z}1 menos longa`);
          r.append(el("small", "hint", `${z}1:`), q1);
        }
        d.append(r);
        return [z, q, q1];
      });
      const total = iB.find(([k]) => k === tp)[1];
      const resumo = () => {
        const t = ins.reduce((a, [, q]) => a + n0(q.value), 0),
          b = n0(total.value),
          m = ins.reduce((a, [, , q1]) => a + (q1 ? n0(q1.value) : 0), 0);
        const erroML = ins.some(([, q, q1]) => q1 && n0(q1.value) > n0(q.value));
        sm.textContent =
          `${nm}: ${t ? `${t} de ${b} com tamanho${t === b ? " ✅" : t > b ? " ⚠️ passou do total" : ""}` : "sem tamanhos"}` +
          (m ? ` · ${m} menos longa` : "") +
          (erroML ? " ⚠️ menos longa maior que o total do tamanho" : "");
      };
      [...ins.flatMap(([, q, q1]) => [q, q1]).filter(Boolean), total].forEach(q => q.addEventListener("input", resumo));
      resumo();
      p.append(d);
      return [tp, ins];
    });
    p.append(
      el(
        "p",
        "hint",
        "Menos longa (P1, M1, G1…): coloque ao lado de cada tamanho quantas daquele total são menos longas. Ex.: P = 47, sendo P1 = 7 (40 normais e 7 menos longas)."
      )
    );
    const err = el("p", "err");
    err.hidden = true;
    p.append(err, botoes(close, "Salvar estoque"));
    if (!C.isAdmin) p.querySelector("button[type=submit]").hidden = true;
    p.addEventListener("submit", async ev => {
      ev.preventDefault();
      if (!C.isAdmin) return;
      if (iT.some(([, ins]) => ins.some(([, q, q1]) => q1 && n0(q1.value) > n0(q.value)))) {
        err.textContent = "A quantidade “menos longa” não pode passar do total do tamanho.";
        err.hidden = false;
        return;
      }
      const obj = ins => Object.fromEntries(ins.map(([k, q]) => [k, n0(q.value)]));
      const novo = {
        becas: obj(iB),
        faixas: obj(iF),
        capelos: obj(iC),
        tamanhos: Object.fromEntries(
          iT
            .map(([tp, ins]) => [tp, Object.fromEntries(ins.map(([z, q]) => [z, n0(q.value)]).filter(([, v]) => v))])
            .filter(([, o]) => Object.keys(o).length)
        ),
        menosLonga: Object.fromEntries(
          iT
            .map(([tp, ins]) => [
              tp,
              Object.fromEntries(ins.filter(([, , q1]) => q1 && n0(q1.value)).map(([z, , q1]) => [z, n0(q1.value)]))
            ])
            .filter(([, o]) => Object.keys(o).length)
        )
      };
      try {
        await C.FS.setDoc(C.FS.doc(C.db, "config", "app"), { estoque: novo }, { merge: true });
        C.P.estoque = Object.assign({}, E, novo);
        close();
        U.toast("Estoque salvo");
        if (aoSalvar) aoSalvar();
      } catch (e) {
        C.handleErr(e);
      }
    });
  });
}
