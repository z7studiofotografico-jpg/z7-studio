// (24/11/2026) Alunos que entraram pelo Cadastro automático do PR (as fichas lidas vão para o PR) e que também
// estão no contrato do colégio (ex.: E.M. Manoel Gomes: compraram só certificado + canudo). No Aluguel de becas,
// com o colégio escolhido, aparece "📥 Trazer N alunos do cadastro automático": eles entram no contrato com o kit
// padrão e o valor do kit, sem apagar nada do PR (lá continuam para vender as fotos).
import * as U from "./util.js";

// quem tem o kit sem beca nem pelerine (ex.: certificado + canudo) não aluga beca
export const kitSemBeca = itens => (itens || []).length > 0 && !(itens || []).some(k => k === "beca" || k === "pelerine");
const SERIE = t => {
  const s = String(t || "").trim();
  const m = s.match(/^(\d)\d{2}$/);
  if (m) return m[1] + "º ano";
  if (/^eja/i.test(s)) return "EJA";
  return "";
};
// o aluguel montado a partir do aluno do PR
export function aluguelDoPR(x, inst, ano, contrato, R) {
  const pacote = (contrato && contrato.pacotePadrao) || [];
  const qtd = (contrato && contrato.pacotePadraoQtd) || {};
  const serie = x.serie || SERIE(x.turma);
  const valor = R ? R.valorDoPacote(pacote, serie, contrato, qtd) : 0;
  const tels = (x.telefones || []).map(t => U.digits(t)).filter(Boolean);
  const agora = new Date().toISOString();
  const semBeca = kitSemBeca(pacote);
  return {
    instId: inst.id,
    instNome: inst.nome || "",
    ano: Number(ano),
    serie,
    turma: String(x.turma || ""),
    nome: x.nome || "",
    nomeBusca: U.chave(x.nome || ""),
    codigo: x.codigo || "",
    codigoBusca:
      x.codigoBusca ||
      String(x.codigo || "")
        .replace(/\W/g, "")
        .toUpperCase(),
    tel: tels[0] || "",
    contatos: x.contatos || [],
    responsavel: ((x.contatos || []).find(c => c && c.tipo && c.tipo !== "Formando" && c.nome) || {}).nome || "",
    endereco: x.endereco || {},
    becaTipo: semBeca ? "" : "tradPreta",
    tamanho: "",
    menosLonga: false,
    faixa: "",
    capelo: "",
    semBeca,
    retirada: "",
    devolucao: "",
    obs: "",
    pacote,
    pacoteQtd: qtd,
    valor,
    contratoZerado: !valor,
    status: "Cadastrado",
    produtos: [],
    historico: [],
    criadoEm: agora,
    atualizadoEm: agora,
    respEmail: String((contrato && contrato.respEmail) || "").toLowerCase(),
    origem: "cadastro automático (PR)",
    prId: x.id
  };
}

// os alunos do PR daquele colégio e ano que ainda não estão no aluguel
export async function alunosDoPR(C, inst, ano, jaNoAluguel) {
  const { FS, db } = C;
  const nomes = [...new Set([inst.nome, String(inst.nome || "").toUpperCase()].filter(Boolean))];
  const achados = new Map();
  for (const n of nomes) {
    try {
      const s = await FS.getDocs(FS.query(FS.collection(db, "repasse"), FS.where("escola", "==", n), FS.limit(1500)));
      s.docs.forEach(d => achados.set(d.id, Object.assign({ id: d.id }, d.data())));
    } catch (e) {
      console.warn("[Z7] alunos do PR", e);
    }
  }
  const ja = new Set((jaNoAluguel || []).map(a => String(a.codigo || "").toUpperCase()).filter(Boolean));
  const jaNome = new Set((jaNoAluguel || []).map(a => U.chave(a.nome || "")));
  return [...achados.values()].filter(
    x => Number(x.ano) === Number(ano) && !x.excluido && !ja.has(String(x.codigo || "").toUpperCase()) && !jaNome.has(U.chave(x.nome || ""))
  );
}

// o botão no resumo do colégio (só aparece quando tem aluno para trazer e o colégio tem contrato)
// a tela redesenha muito: a procura fica guardada por colégio, ano e quantos alunos já tem no aluguel
const cache = new Map();
export async function botaoTrazerDoPR(C, inst, ano, jaNoAluguel, box) {
  const { FS, db } = C;
  const R = await import("./contrato-colegio-regras.js");
  const k = `${inst.id}|${ano}|${(jaNoAluguel || []).length}`;
  if (!cache.has(k))
    cache.set(
      k,
      (async () => {
        const c = await FS.getDoc(FS.doc(db, "contratosColegio", R.idContrato(inst.id, ano))).catch(() => null);
        const contrato = c && c.exists() ? c.data() : null;
        if (!contrato || !(C.isAdmin || String(contrato.respEmail || "").toLowerCase() === C.email)) return { lst: [] };
        return { contrato, lst: await alunosDoPR(C, inst, ano, jaNoAluguel) };
      })()
    );
  const { contrato, lst } = await cache.get(k);
  if (!lst.length || !box.isConnected || box.querySelector(".trazer-pr")) return;
  const kit = R.textoPacote(contrato.pacotePadrao, contrato.pacotePadraoQtd) || "kit padrão";
  const b = U.mkBtn(`📥 Trazer ${lst.length} aluno${lst.length > 1 ? "s" : ""} do cadastro automático`, "btn-primary btn-sm", async () => {
    const { confirmar } = await import("./confirmar.js");
    const ok = await confirmar(
      "Trazer os alunos para o contrato?",
      `${lst.length} aluno${lst.length > 1 ? "s" : ""} de ${inst.nome} (${ano}) cadastrados pelas fichas entram aqui com o kit do contrato: ${kit}. No PR eles continuam (para vender as fotos).`,
      { sim: "Sim, trazer" }
    );
    if (!ok) return;
    b.disabled = true;
    try {
      const { USO, idUso, usoDeAluno } = await import("./becas-uso.js");
      for (let i = 0; i < lst.length; i += 200) {
        const bt = FS.writeBatch(db);
        lst.slice(i, i + 200).forEach(x => {
          const d = Object.assign(aluguelDoPR(x, inst, ano, contrato, R), { criadoPor: C.me || "", criadoPorEmail: C.email || "" });
          const ref = FS.doc(FS.collection(db, "alugueis"));
          bt.set(ref, d);
          const u = usoDeAluno(d);
          if (u) bt.set(FS.doc(db, USO, idUso("aluno", ref.id)), u);
        });
        await bt.commit();
      }
      U.toast(`✅ ${lst.length} alunos no contrato`);
      cache.clear();
      b.remove();
    } catch (e) {
      b.disabled = false;
      C.handleErr(e);
    }
  });
  b.classList.add("trazer-pr");
  box.append(" ", b);
}

// (24/11/2026) Depois da formatura: os alunos do contrato vão para o PR ou para o Paspatur (vender as fotos).
// Quem já está no PR (mesmo ID ou nome) fica como está. Nada sai do contrato.
const formaturaPassou = (inst, hoje = U.todayStr()) => {
  const ds = Object.keys(inst || {})
    .filter(k => /^formatura\d*$/.test(k) && inst[k] && inst[k].data && inst[k].status !== "recusado")
    .map(k => inst[k].data);
  return { tem: ds.length > 0, passou: ds.some(d => d <= hoje), dia: ds.sort()[0] || "" };
};
export function prDoAluguel(a, inst, vendaComo) {
  const agora = new Date().toISOString();
  const contatos = (a.contatos || []).length ? a.contatos : a.tel ? [{ tipo: "Formando", nome: a.nome || "", tel: a.tel }] : [];
  return {
    nome: String(a.nome || "").toUpperCase(),
    nomeBusca: U.chave(a.nome || ""),
    escola: inst.nome || a.instNome || "",
    ano: Number(a.ano),
    codigo: a.codigo || "",
    codigoBusca:
      a.codigoBusca ||
      String(a.codigo || "")
        .replace(/\W/g, "")
        .toUpperCase(),
    turma: a.turma || a.serie || "",
    nascimento: a.nascimento || "",
    email: a.email || "",
    contatos,
    telefones: [...new Set(contatos.map(c => U.digits(c.tel)).filter(Boolean))],
    endereco: a.endereco || {},
    obs: "",
    etapa: contatos.length ? "NA FILA" : "INCOMPLETO",
    followup: null,
    tentativas: 0,
    tentInteresse: 0,
    resp: "",
    respEmail: "",
    ...(vendaComo === "paspatur" ? { vendaComo: "paspatur" } : {}),
    manual: true,
    doContrato: true,
    importadoEm: agora,
    atualizadoEm: agora
  };
}
export async function botaoEnviarParaPR(C, inst, ano, alunos, box) {
  if (!C.isAdmin || !(alunos || []).length) return;
  const f = formaturaPassou(inst);
  if (f.tem && !f.passou) {
    box.append(
      " ",
      Object.assign(document.createElement("small"), {
        className: "hint",
        textContent: `Depois da formatura (${f.dia.slice(8, 10)}/${f.dia.slice(5, 7)}), aparece o botão de mandar os alunos para o PR ou o Paspatur.`
      })
    );
    return;
  }
  const b = U.mkBtn("📤 Mandar para o PR ou Paspatur", "btn-sm", async () => {
    const { sheet, el } = await import("./ui.js");
    const { FS, db } = C;
    const ja = await alunosDoPR(C, inst, ano, []); // os que já estão no PR
    const codJa = new Set(ja.map(x => String(x.codigo || "").toUpperCase()).filter(Boolean));
    const nomeJa = new Set(ja.map(x => U.chave(x.nome || "")));
    const vai = alunos.filter(a => !codJa.has(String(a.codigo || "").toUpperCase()) && !nomeJa.has(U.chave(a.nome || "")));
    sheet("📤 Depois da formatura", (p, close) => {
      p.append(
        el(
          "p",
          "hint",
          vai.length
            ? `${vai.length} aluno${vai.length > 1 ? "s" : ""} de ${inst.nome} (${ano}) vão para a venda das fotos. ${alunos.length - vai.length ? alunos.length - vai.length + " já estão no PR e ficam como estão." : ""} No contrato nada muda.`
            : "Todos os alunos deste colégio já estão no PR."
        )
      );
      const msg = el("p", "hint");
      const enviar = vendaComo => async () => {
        p.querySelectorAll("button").forEach(x => (x.disabled = true));
        try {
          const { docId } = await import("./repasse-dados.js");
          const { indexarFones } = await import("./pedidos.js");
          for (let i = 0; i < vai.length; i += 100) {
            const bt = FS.writeBatch(db);
            vai.slice(i, i + 100).forEach((a, j) => {
              const d = prDoAluguel(a, inst, vendaComo);
              const id = docId(d, Date.now() + i + j);
              bt.set(FS.doc(db, "repasse", id), d);
              indexarFones(FS, db, bt, id, d);
            });
            msg.textContent = `Mandando ${Math.min(i + 100, vai.length)} de ${vai.length}…`;
            await bt.commit();
          }
          U.toast(`✅ ${vai.length} alunos no ${vendaComo === "paspatur" ? "Paspatur" : "PR"}`);
          close();
        } catch (e) {
          p.querySelectorAll("button").forEach(x => (x.disabled = false));
          C.handleErr(e);
        }
      };
      const acoes = el("div", "panel-actions");
      if (vai.length)
        acoes.append(
          U.mkBtn("🖼️ Mandar para o PR", "btn-primary", enviar("pr")),
          U.mkBtn("📒 Mandar para o Paspatur", "btn-primary", enviar("paspatur"))
        );
      acoes.append(U.mkBtn("Fechar", "", close));
      p.append(msg, acoes);
    });
  });
  box.append(" ", b);
}
