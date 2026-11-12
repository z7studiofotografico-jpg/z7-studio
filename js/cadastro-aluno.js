// Cadastrar aluno (11/11/2026): uma tela só para incluir aluno no Aluguel de becas, no PR/Paspatur e na Formatura.
// 1. Colégio (só os cadastrados em Instituições: sem colégio, o resto fica travado) · ano · série
// 2. Quem é: o número do ID (26CENBJ- + o número do aluno na escola, obrigatório) · nome · WhatsApp · responsável
// 3. O que contratou: becas (beca, tamanho, faixa, capelo, valor), PR (Kit Quadro ou Kit Paspatur), Formatura
// O mesmo aluno (mesmo ID) em vários módulos é um aluno só: o app procura antes de gravar e avisa.
import { el, title, field, inp, inpReais, sel, sheet } from "./ui.js";
import * as U from "./util.js";
import { lerReais } from "./regras.js";
import { codigoBusca } from "./aluno-id.js";
import { BECAS, TAMANHOS, FAIXAS, CAPELOS, COM_MENOS_LONGA } from "./becas-estoque.js";
import { prefixoId, idDoAluno, faltaParaSalvar, conferirRepetido, NOMES_MODULO, moduloPR, siglaDoColegio } from "./cadastro-regras.js";

const ANO = () => new Date().getFullYear();
// quais módulos a pessoa pode cadastrar
export function modulosDe(C) {
  const out = [];
  if (C.isAdmin || C.pode("becas")) out.push("becas");
  if (C.isAdmin || C.pode("rep") || C.pode("lf")) out.push("pr");
  if (C.isAdmin || C.pode("formaturas") || C.pode("colegios")) out.push("formatura");
  return out;
}
export const podeCadastrar = C => modulosDe(C).length > 0;

async function colegios(C) {
  const { FS, db } = C;
  const limpa = l =>
    l.filter(i => !i.arquivado && !(i.excluido && i.excluido.em)).sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));
  // admin: lê tudo e já atualiza a lista de nomes que a equipe usa
  if (C.isAdmin) {
    const s = await FS.getDocs(FS.query(FS.collection(db, "instituicoes"), FS.limit(2000)));
    const l = limpa(s.docs.map(d => Object.assign({ id: d.id }, d.data())));
    gravarListaColegios(C, l).catch(e => console.warn("[Z7] lista de colégios", e));
    return l;
  }
  // quem cuida de colégios (e quem está com a "Ajuda no cadastro" ligada): os colégios da carteira, ou todos
  if (C.pode("colegios") || C.pode("formaturas") || C.ajudaCadastro)
    try {
      const q = C.ajudaCadastro
        ? FS.query(FS.collection(db, "instituicoes"), FS.limit(2000))
        : FS.query(FS.collection(db, "instituicoes"), FS.where("respEmail", "in", ["", C.email]), FS.limit(2000));
      const l = limpa((await FS.getDocs(q)).docs.map(d => Object.assign({ id: d.id }, d.data())));
      if (l.length) return l;
    } catch (e) {
      console.warn("[Z7] colégios", e);
    }
  // becas, PR e Repasse: a lista só com os nomes (config/colegios, que o admin atualiza), sem contatos nem valores
  const c = await FS.getDoc(FS.doc(db, "config", "colegios"));
  return limpa((c.exists() && c.data().lista) || []);
}
// a lista de nomes dos colégios (id, nome, sigla, tipo): só grava se mudou
export async function gravarListaColegios(C, l) {
  if (!C.isAdmin || C.verComo) return;
  const lista = l
    .filter(i => !i.arquivado && !(i.excluido && i.excluido.em))
    .map(i => ({ id: i.id, nome: i.nome || "", sigla: i.sigla || "", tipo: i.tipo || "" }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const ref = C.FS.doc(C.db, "config", "colegios");
  const s = await C.FS.getDoc(ref);
  if (s.exists() && JSON.stringify(s.data().lista || []) === JSON.stringify(lista)) return;
  await C.FS.setDoc(ref, { lista, em: new Date().toISOString() });
}

// procura o aluno nos módulos que a pessoa enxerga: mesmo ID ou mesmo nome no ano
async function procurar(C, f) {
  const { FS, db } = C;
  const achados = [];
  const cb = f.codigo ? codigoBusca(f.codigo) : "";
  const nome = U.chave(f.nome || "");
  const ano = Number(f.ano);
  const carteira = C.isAdmin ? [] : [FS.where("respEmail", "in", ["", C.email])];
  const ler = async (colecao, modulo, filtros) => {
    try {
      const s = await FS.getDocs(FS.query(FS.collection(db, colecao), ...filtros, FS.limit(10)));
      s.docs.forEach(d => {
        const x = d.data();
        if (achados.some(a => a.colecao === colecao && a.id === d.id)) return;
        achados.push({
          colecao,
          modulo: typeof modulo === "function" ? modulo(x) : modulo,
          id: d.id,
          nome: x.nome || "",
          codigo: x.codigo || "",
          escola: x.instNome || x.escola || "",
          ano: x.ano,
          tel: x.tel || (x.telefones || [])[0] || "",
          responsavel: x.responsavel || ((x.contatos || []).find(c => c.tipo !== "Formando") || {}).nome || ""
        });
      });
    } catch (e) {
      // sem permissão para essa lista: segue com as outras
    }
  };
  const mods = modulosDe(C);
  const por = campo => (campo === "codigo" ? cb && [FS.where("codigoBusca", "==", cb)] : nome && [FS.where("nomeBusca", "==", nome)]);
  for (const campo of ["codigo", "nome"]) {
    const f0 = por(campo);
    if (!f0) continue;
    if (mods.includes("becas")) await ler("alugueis", "becas", [...f0, ...carteira]);
    if (mods.includes("pr")) await ler("repasse", moduloPR, [...f0, FS.where("ano", "==", ano)]);
    if (mods.includes("formatura")) await ler("formaturaAlunos", "formatura", [...f0, FS.where("ano", "==", ano)]);
  }
  return achados;
}

export function abrirCadastroAluno(C, o = {}) {
  const mods = modulosDe(C);
  if (!mods.length) return U.toast("Você não tem acesso para cadastrar alunos.");
  sheet("➕ Cadastrar aluno", async (p, close) => {
    const carregando = el("p", "hint", "Carregando os colégios…");
    p.append(carregando);
    let insts = [];
    try {
      insts = await colegios(C);
    } catch (e) {
      carregando.className = "wait";
      carregando.textContent = "Não consegui carregar os colégios. Confira a internet e tente de novo.";
      return;
    }
    carregando.remove();
    const st = { achados: [], repetido: null, ultimo: o.ultimo || null };
    // ---------- 1. Colégio ----------
    const sCol = sel(
      insts.map(i => [i.id, title(i.nome)]),
      o.instId || "",
      "Escolha o colégio"
    );
    sCol.setAttribute("aria-label", "Colégio");
    const ano = inp(String(o.ano || ANO()), "2026", 4);
    ano.inputMode = "numeric";
    const serie = inp(o.serie || "", "3º ano A", 40);
    const r1 = el("div", "row3");
    r1.append(field("Colégio", sCol), field("Ano", ano), field("Série / turma", serie));
    const trava = el("p", "wait");
    const novoCol = U.mkBtn("🏫 O colégio não está na lista: cadastrar em Instituições", "btn-sm", () => {
      close();
      C.ir("#instituicoes");
      U.toast("Cadastre o colégio e depois volte em ➕ Cadastrar aluno.");
    });
    const s1 = el("section", "cad-parte");
    s1.append(el("h3", null, "1. Colégio"), r1, trava, novoCol);
    // ---------- 2. Quem é ----------
    const pref = el("b", "cad-pref", "");
    const num = inp(o.numero || "", "02", 4);
    num.inputMode = "numeric";
    num.setAttribute("aria-label", "Número do ID do aluno");
    const idBox = el("div", "cad-id");
    idBox.append(pref, num);
    const nome = inp("", "Aghata Souza", 120);
    nome.setAttribute("aria-label", "Nome do aluno");
    const tel = inp("", "(21) 99999-0000", 20);
    tel.inputMode = "tel";
    const avTel = el("p", "wait");
    avTel.hidden = true;
    tel.addEventListener("input", async () => {
      const { avisoTel } = await import("./aluno-id.js");
      const t = avisoTel(tel.value);
      avTel.textContent = t ? "⚠️ " + t : "";
      avTel.hidden = !t;
    });
    const resp = inp("", "Maria Souza", 80);
    const tipoResp = sel(["Mãe", "Pai", "Responsável", "Formando"], "Mãe");
    const r2 = el("div", "row2");
    r2.append(field("Número do ID (obrigatório)", idBox), field("Nome do aluno", nome));
    const r3 = el("div", "row3");
    r3.append(field("WhatsApp", tel), field("Responsável (se for menor)", resp), field("É o(a)", tipoResp));
    const aviso = el("div", "cad-aviso");
    const s2 = el("section", "cad-parte");
    s2.append(el("h3", null, "2. Quem é"), r2, r3, avTel, aviso);
    // ---------- 3. O que contratou ----------
    const s3 = el("section", "cad-parte");
    s3.append(el("h3", null, "3. O que contratou"));
    const marca = {};
    const caixa = (k, txt) => {
      const l = el("label", "chk");
      const c = el("input");
      c.type = "checkbox";
      c.value = k;
      c.checked = o.modulo === k || (o.modulo === "paspatur" && k === "pr");
      l.append(c, document.createTextNode(" " + txt));
      marca[k] = c;
      return l;
    };
    const linhaMods = el("div", "quick");
    if (mods.includes("becas")) linhaMods.append(caixa("becas", "👘 Aluguel de becas"));
    if (mods.includes("pr")) linhaMods.append(caixa("pr", "🖼️ PR (kit de fotos)"));
    if (mods.includes("formatura")) linhaMods.append(caixa("formatura", "🎓 Formatura (fotos digitais)"));
    s3.append(linhaMods);
    // becas
    const bTipo = sel(BECAS, "tradPreta", "Escolha a beca"),
      bTam = sel(TAMANHOS, "", "Tamanho"),
      bFaixa = sel(FAIXAS, "", "Sem faixa"),
      bCap = sel(CAPELOS, "", "Sem capelo"),
      bValor = inpReais("");
    const bMenos = el("input");
    bMenos.type = "checkbox";
    const lMenos = el("label", "chk");
    lMenos.append(bMenos, document.createTextNode(" Menos longa (P1, M1…)"));
    const dBecas = el("div", "cad-mod");
    const rb1 = el("div", "row3"),
      rb2 = el("div", "row3");
    rb1.append(field("Beca", bTipo), field("Tamanho", bTam), lMenos);
    rb2.append(field("Faixa", bFaixa), field("Capelo", bCap), field("Valor do aluguel", bValor));
    dBecas.append(el("b", null, "👘 Aluguel de becas"), rb1, rb2);
    // PR
    const prKit = sel(
      [
        ["pr", "Kit Quadro (quadro 30x40 + 2 porta-retratos)"],
        ["paspatur", "Kit Paspatur (livro A4)"]
      ],
      o.modulo === "paspatur" ? "paspatur" : "pr"
    );
    const dPR = el("div", "cad-mod");
    dPR.append(el("b", null, "🖼️ PR"), field("Kit", prKit));
    const dForm = el("div", "cad-mod");
    dForm.append(el("b", null, "🎓 Formatura"), el("p", "hint", "Entra na lista da Formatura do ano (Linha de Frente ou Repasse)."));
    s3.append(dBecas, dPR, dForm);
    const erro = el("p", "err");
    erro.hidden = true;
    const acts = el("div", "panel-actions");
    const bSalvar = U.mkBtn("Salvar", "", () => salvar(false));
    const bOutro = U.mkBtn("Salvar e cadastrar outro", "btn-primary", () => salvar(true));
    acts.append(U.mkBtn("Cancelar", "", close), el("span", "flex1"), bSalvar, bOutro);
    p.append(s1, s2, s3, erro, acts);

    const inst = () => insts.find(i => i.id === sCol.value) || null;
    const ficha = () => ({
      inst: inst(),
      ano: Number(ano.value) || 0,
      codigo: idDoAluno(ano.value, inst(), num.value),
      nome: nome.value.trim(),
      modulos: Object.keys(marca).filter(k => marca[k].checked),
      becaTipo: bTipo.value
    });
    // trava: sem colégio, o resto fica desligado
    const pintar = () => {
      const i = inst();
      pref.textContent = i ? prefixoId(ano.value, i) : "??-";
      trava.hidden = !!i;
      trava.textContent = insts.length
        ? "🔒 Escolha o colégio para continuar. O resto da ficha fica travado até lá."
        : "🔒 Nenhum colégio cadastrado para você. Cadastre o colégio em Instituições primeiro.";
      novoCol.hidden = !!i;
      [s2, s3].forEach(s => {
        s.classList.toggle("cad-travado", !i);
        s.querySelectorAll("input, select").forEach(x => (x.disabled = !i));
      });
      dBecas.hidden = !(marca.becas && marca.becas.checked);
      dPR.hidden = !(marca.pr && marca.pr.checked);
      dForm.hidden = !(marca.formatura && marca.formatura.checked);
      lMenos.hidden = !COM_MENOS_LONGA.includes(bTipo.value);
    };
    // procura o aluno (ID e nome) com uma pausa, para não buscar a cada letra
    let espera = null;
    const conferir = () => {
      clearTimeout(espera);
      espera = setTimeout(async () => {
        const f = ficha();
        if (!f.inst || (!f.codigo && f.nome.length < 5)) {
          st.achados = [];
          st.repetido = null;
          return mostrarAviso(f);
        }
        st.achados = await procurar(C, f);
        st.repetido = conferirRepetido(f, st.achados);
        mostrarAviso(f);
      }, 500);
    };
    function mostrarAviso(f) {
      aviso.innerHTML = "";
      Object.values(marca).forEach(c => {
        c.disabled = !inst();
        c.parentNode.title = "";
      });
      const r = st.repetido;
      if (!r) return;
      if (r.idDeOutro) {
        aviso.append(
          el(
            "p",
            "err",
            `O ID ${f.codigo} já é de ${title(r.idDeOutro.nome)} (${NOMES_MODULO[r.idDeOutro.modulo]}). Confira o número do aluno na escola.`
          )
        );
        return;
      }
      if (r.mesmoAluno.length) {
        const a = r.mesmoAluno[0];
        const onde = [...new Set(r.mesmoAluno.map(x => NOMES_MODULO[x.modulo]))].join(", ");
        const b = el("div", "notice");
        b.append(el("span", null, `Já existe ${f.codigo} · ${title(a.nome)} · ${title(a.escola)} ${a.ano || ""} (no ${onde}). `));
        b.append(
          U.mkBtn("Usar este aluno", "btn-sm btn-primary", () => {
            nome.value = title(a.nome);
            if (!tel.value && a.tel) tel.value = String(a.tel).replace(/^55/, "");
            if (!resp.value && a.responsavel) resp.value = title(a.responsavel);
            U.toast("Dados puxados. Marque o que mais ele contratou.");
          })
        );
        aviso.append(b);
        // o que ele já tem fica marcado e travado (não cria de novo)
        r.mesmoAluno.forEach(x => {
          const k = x.modulo === "paspatur" ? "pr" : x.modulo;
          if (marca[k]) {
            marca[k].checked = false;
            marca[k].disabled = true;
            marca[k].parentNode.title = "Já está no " + NOMES_MODULO[x.modulo];
          }
        });
        pintar();
        return;
      }
      if (r.parecidos.length) {
        const a = r.parecidos[0];
        aviso.append(
          el(
            "p",
            "wait",
            `⚠️ Parecido: ${title(a.nome)}${a.codigo ? " (ID " + a.codigo + ")" : ""} · ${title(a.escola)} · no ${NOMES_MODULO[a.modulo]}. Se for o mesmo aluno, use o mesmo número do ID.`
          )
        );
      }
    }
    [sCol, ano].forEach(x => x.addEventListener("change", () => (pintar(), conferir())));
    [num, nome].forEach(x => x.addEventListener("input", conferir));
    Object.values(marca).forEach(c => c.addEventListener("change", pintar));
    bTipo.addEventListener("change", pintar);
    pintar();
    if (inst()) conferir();
    setTimeout(() => (inst() ? num : sCol).focus(), 30);

    async function salvar(outro) {
      erro.hidden = true;
      const f = ficha();
      const falta = faltaParaSalvar(f);
      if (falta.length) return mostrarErro("Falta: " + falta.join(", ") + ".");
      // confere de novo agora (alguém pode ter cadastrado enquanto isso)
      st.achados = await procurar(C, f);
      st.repetido = conferirRepetido(f, st.achados);
      mostrarAviso(f);
      if (st.repetido.idDeOutro) return mostrarErro("Esse número de ID já é de outro aluno. Confira o número.");
      const ja = new Set(st.repetido.mesmoAluno.map(x => (x.modulo === "paspatur" ? "pr" : x.modulo)));
      const fazer = f.modulos.filter(k => !ja.has(k));
      if (!fazer.length) return mostrarErro("Esse aluno já está em tudo o que foi marcado.");
      bSalvar.disabled = bOutro.disabled = true;
      const d = {
        inst: f.inst,
        ano: f.ano,
        serie: serie.value.trim(),
        codigo: f.codigo,
        nome: f.nome,
        tel: U.digits(tel.value).replace(/^55(?=\d{10,11}$)/, ""),
        resp: resp.value.trim(),
        tipoResp: tipoResp.value
      };
      const feitos = [];
      try {
        if (fazer.includes("becas"))
          feitos.push(
            await criarAluguel(C, d, {
              becaTipo: bTipo.value,
              tamanho: bTam.value,
              menosLonga: COM_MENOS_LONGA.includes(bTipo.value) && bMenos.checked,
              faixa: bFaixa.value,
              capelo: bCap.value,
              valor: lerReais(bValor.value)
            })
          );
        if (fazer.includes("pr")) feitos.push(await criarPR(C, "repasse", d, prKit.value));
        if (fazer.includes("formatura")) feitos.push(await criarPR(C, "formaturaAlunos", d, ""));
        await guardarNumero(C, f.ano, f.inst, f.codigo);
      } catch (e) {
        bSalvar.disabled = bOutro.disabled = false;
        if (e && e.aviso) return mostrarErro((feitos.length ? "Gravado em: " + feitos.join(", ") + ". " : "") + e.message);
        if (feitos.length) U.toast("Gravado em: " + feitos.join(", ") + ". O resto deu erro.");
        return C.handleErr(e);
      }
      // aluno de outra carteira no PR: foi um pedido para o admin (o aviso vem do pedido)
      const pedido = feitos.find(x => String(x).startsWith("pedido: "));
      if (pedido) {
        close();
        return U.toast(pedido.slice(8));
      }
      U.toast(`✅ ${f.codigo} · ${title(f.nome)}: ${feitos.join(", ")}`);
      close();
      if (outro)
        abrirCadastroAluno(C, {
          instId: f.inst.id,
          ano: f.ano,
          serie: serie.value.trim(),
          modulo: f.modulos.length === 1 ? (f.modulos[0] === "pr" ? prKit.value : f.modulos[0]) : o.modulo,
          numero: String((parseInt(num.value, 10) || 0) + 1).padStart(2, "0")
        });
    }
    function mostrarErro(t) {
      erro.textContent = t;
      erro.hidden = false;
    }
  });
}

// ---------- gravação em cada módulo ----------
// Aluguel de becas: o aluno fica com quem fechou o contrato do colégio (o admin acerta os donos uma vez por dia)
async function criarAluguel(C, d, b) {
  const { FS, db } = C;
  const { donoDoAluguel, espelhar } = await import("./becas-uso.js");
  let dono = await donoDoAluguel(C, d.inst.id, d.ano);
  if (!C.isAdmin && dono && dono !== C.email) dono = ""; // quem ajuda no cadastro grava sem dono (o admin acerta)
  const agora = new Date().toISOString();
  const doc = {
    instId: d.inst.id,
    instNome: d.inst.nome || "",
    ano: d.ano,
    serie: d.serie,
    nome: d.nome,
    nomeBusca: U.chave(d.nome),
    codigo: d.codigo,
    codigoBusca: codigoBusca(d.codigo),
    tel: d.tel,
    responsavel: d.resp,
    becaTipo: b.becaTipo,
    tamanho: b.tamanho,
    menosLonga: !!b.menosLonga,
    faixa: b.faixa,
    capelo: b.capelo,
    retirada: "",
    devolucao: "",
    obs: "",
    pacote: [],
    valor: Number(b.valor) || 0,
    contratoZerado: false,
    status: "Cadastrado",
    produtos: [],
    historico: [],
    criadoEm: agora,
    atualizadoEm: agora,
    criadoPor: C.me || "",
    criadoPorEmail: C.email || "",
    respEmail: dono || ""
  };
  const ref = await FS.addDoc(FS.collection(db, "alugueis"), doc);
  espelhar(C, "aluno", ref.id, doc);
  return NOMES_MODULO.becas;
}
// PR/Paspatur ("repasse") e Formatura ("formaturaAlunos"): o mesmo formato do "+ Aluno" antigo
async function criarPR(C, colecao, d, kit) {
  const { FS, db } = C;
  const { docId } = await import("./repasse-dados.js");
  const { indexarFones } = await import("./pedidos.js");
  const agora = new Date().toISOString(),
    hoje = U.todayStr(),
    ano = d.ano,
    atual = ano >= ANO();
  const contatos = d.tel ? [{ tipo: d.resp ? d.tipoResp : "Formando", nome: d.resp || d.nome, tel: d.tel }] : [];
  const falta = !contatos.length ? ["telefone"] : [];
  const daEquipe = !C.isAdmin,
    meu = daEquipe && !falta.length;
  const doc = {
    nome: d.nome,
    nomeBusca: U.chave(d.nome),
    escola: d.inst.nome || "",
    instId: d.inst.id,
    ano,
    codigo: d.codigo,
    codigoBusca: codigoBusca(d.codigo),
    curso: "",
    turma: d.serie,
    responsavel: d.resp,
    contatos,
    telefones: contatos.map(c => c.tel),
    dataEnsaio: "",
    endereco: {},
    obs: "",
    etapa: falta.length ? "INCOMPLETO" : meu ? "SEPARADO" : "NA FILA",
    followup: meu ? hoje : null,
    tentativas: 0,
    tentInteresse: 0,
    resp: daEquipe ? C.me || "" : "",
    respEmail: daEquipe ? C.email || "" : "",
    ...(meu ? { separadoEm: hoje, separadoSeg: atual ? "lf" : "rep" } : {}),
    ...(colecao === "formaturaAlunos" ? { seg: atual ? "lf" : "rep" } : {}),
    ...(kit === "paspatur" ? { vendaComo: "paspatur" } : {}),
    manual: true,
    incluidoPor: C.email || "",
    importadoEm: agora,
    atualizadoEm: agora
  };
  // aluno que já está no PR (pelo telefone ou pelo nome): não grava por cima. Se está com outra pessoa,
  // vai um pedido para o admin decidir (como no "+ Aluno" antigo)
  const repetido = async r => {
    if (C.isAdmin)
      throw Object.assign(
        new Error(`${title(r.nome)} já está no PR (${title(r.escola)}${r.ano ? ", " + r.ano : ""}). Procure pela busca.`),
        {
          aviso: true
        }
      );
    if (r.respEmail && r.respEmail === C.email)
      throw Object.assign(new Error(`${title(r.nome)} já está na sua lista. Procure pela busca.`), { aviso: true });
    const { pedirAluno } = await import("./pedidos.js");
    return "pedido: " + (await pedirAluno(C, r, doc));
  };
  if (colecao === "repasse") {
    const { procurarRepetido } = await import("./pedidos.js");
    const achado = await procurarRepetido(C, doc);
    if (achado) return await repetido(achado);
  }
  const ref = FS.doc(db, colecao, docId(doc, Date.now()));
  const existente = await FS.runTransaction(db, async tx => {
    const s = await tx.get(ref);
    if (s.exists()) return Object.assign({ id: ref.id }, s.data());
    tx.set(ref, doc);
    if (colecao === "repasse") indexarFones(FS, db, tx, ref.id, doc);
    return null;
  });
  if (existente) {
    if (colecao === "repasse") return await repetido(existente);
    throw Object.assign(new Error(`${title(d.nome)} já está na Formatura.`), { aviso: true });
  }
  return colecao === "repasse" ? NOMES_MODULO[kit === "paspatur" ? "paspatur" : "pr"] : NOMES_MODULO.formatura;
}
// o número digitado conta para a numeração automática do colégio (ids/26CENBJ), para nunca repetir
async function guardarNumero(C, ano, inst, codigo) {
  const n = parseInt(String(codigo).split("-").pop(), 10);
  const sigla = siglaDoColegio(inst);
  if (!n || !sigla) return;
  const { FS, db } = C;
  const ref = FS.doc(db, "ids", String(ano).slice(-2) + sigla);
  try {
    await FS.runTransaction(db, async tx => {
      const s = await tx.get(ref);
      const u = s.exists() ? Number(s.data().ultimo) || 0 : 0;
      if (n > u) tx.set(ref, { ultimo: n });
    });
  } catch (e) {
    console.warn("[Z7] numeração do colégio", e);
  }
}

// ⬇️ Baixar planilha (backup no Drive): a lista que está na tela, com todos os campos
export const CAMPOS_ALUGUEL = [
  ["codigo", "ID"],
  ["nome", "Aluno"],
  ["instNome", "Colégio"],
  ["ano", "Ano"],
  ["serie", "Série"],
  ["tel", "WhatsApp"],
  ["responsavel", "Responsável"],
  ["becaTipo", "Beca"],
  ["tamanho", "Tamanho"],
  ["faixa", "Faixa"],
  ["capelo", "Capelo"],
  ["valor", "Valor"],
  ["status", "Situação"],
  ["retirada", "Retirada"],
  ["devolucao", "Devolução"],
  ["obs", "Observação"]
];
export const CAMPOS_PR = [
  ["codigo", "ID"],
  ["nome", "Aluno"],
  ["escola", "Colégio"],
  ["ano", "Ano"],
  ["turma", "Turma"],
  ["contatos", "Contatos"],
  ["vendaComo", "Kit"],
  ["etapa", "Etapa"],
  ["resp", "Responsável na equipe"],
  ["valor", "Valor"],
  ["formaPag", "Forma de pagamento"],
  ["pagoEm", "Pago em"],
  ["obs", "Observação"]
];
export async function baixarPlanilha(nome, lista, campos) {
  const { carregarLib } = await import("./ui.js");
  const { linhasPlanilha } = await import("./cadastro-regras.js");
  const X = await carregarLib("xlsx");
  const ws = X.utils.aoa_to_sheet(linhasPlanilha(lista, campos));
  const wb = X.utils.book_new();
  X.utils.book_append_sheet(wb, ws, "Alunos");
  X.writeFile(wb, `${nome}-${U.todayStr()}.xlsx`);
}
