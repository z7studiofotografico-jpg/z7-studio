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
import {
  COLUNAS_CONTATOS,
  prefixoId,
  idDoAluno,
  faltaParaSalvar,
  conferirRepetido,
  NOMES_MODULO,
  moduloPR,
  siglaDoColegio
} from "./cadastro-regras.js";

const ANO = () => new Date().getFullYear();
// quais módulos a pessoa pode cadastrar
export function modulosDe(C) {
  const out = [];
  if (C.isAdmin || C.pode("becas")) out.push("becas");
  if (C.isAdmin || C.pode("rep") || C.pode("lf")) out.push("pr", "paspatur");
  if (C.isAdmin || C.pode("formaturas") || C.pode("colegios")) out.push("formatura", "va");
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

export const TURMAS = ["Pré", "5º ano", "9º ano", "Ensino Médio", "Profissionalizante"];
const GRUPOS = [
  ["particular", "🏫 Particular"],
  ["publico", "🏛️ Público"],
  ["superior", "🎓 Faculdade / curso"]
];
const OPCOES = [
  ["becas", "👘", "Aluguel de becas", "beca, tamanho, faixa e capelo"],
  ["pr", "🖼️", "PR", "Kit Quadro: quadro 30x40 + 2 porta-retratos"],
  ["paspatur", "🎞️", "Paspatur", "Kit Paspatur: livro A4"],
  ["formatura", "🎓", "Formatura", "fotos digitais da formatura"],
  ["va", "📝", "Venda antecipada", "escolhe o kit e as parcelas logo depois, já preenchido"]
];

export function abrirCadastroAluno(C, o = {}) {
  const mods = modulosDe(C);
  if (!mods.length) return U.toast("Você não tem acesso para cadastrar alunos.");
  sheet(
    "➕ Cadastrar aluno",
    async (p, close) => {
      p.classList.add("cad");
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
      const { CARTOES, cartaoDoTipo } = await import("./instituicoes-dados.js");
      const st = { achados: [], repetido: null };
      const parte = (n, t, sub) => {
        const s = el("section", "cad-parte");
        const h = el("div", "cad-tit");
        h.append(el("span", "cad-n", String(n)), el("b", null, t));
        if (sub) h.append(el("small", null, sub));
        s.append(h);
        return s;
      };
      // ---------- 1. Colégio ----------
      const s1 = parte(1, "Colégio", "particular ou público, depois o colégio");
      let grupo = o.instId ? cartaoDoTipo((insts.find(i => i.id === o.instId) || {}).tipo) || "" : "";
      const chipsG = el("div", "chips cad-grupos");
      const sCol = el("select");
      sCol.setAttribute("aria-label", "Colégio");
      const encherCol = () => {
        sCol.innerHTML = "";
        const lst = grupo
          ? insts.filter(i => (CARTOES[grupo] || { tipos: [] }).tipos.includes(i.tipo) || (!i.tipo && grupo === "particular"))
          : [];
        const v = el("option", null, grupo ? `Escolha o colégio (${lst.length})` : "Escolha antes: particular ou público");
        v.value = "";
        sCol.append(v);
        lst.forEach(i => {
          const op = el("option", null, title(i.nome));
          op.value = i.id;
          sCol.append(op);
        });
        sCol.disabled = !grupo;
      };
      GRUPOS.forEach(([k, t]) => {
        const b = el("button", "chip", t);
        b.type = "button";
        b.dataset.k = k;
        b.setAttribute("aria-pressed", String(grupo === k));
        b.onclick = () => {
          grupo = k;
          chipsG.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
          encherCol();
          pintar();
          sCol.focus();
        };
        chipsG.append(b);
      });
      encherCol();
      if (o.instId) sCol.value = o.instId;
      const ano = inp(String(o.ano || ANO()), "2026", 4);
      ano.inputMode = "numeric";
      ano.setAttribute("aria-label", "Ano");
      const turma = sel(
        [...TURMAS.map(t => [t, t]), ["outra", "Outra…"]],
        TURMAS.includes(o.serie) ? o.serie : o.serie ? "outra" : "",
        "Escolha a turma"
      );
      turma.setAttribute("aria-label", "Turma");
      const turmaOutra = inp(TURMAS.includes(o.serie) ? "" : o.serie || "", "ex.: 3º ano A", 40);
      turmaOutra.setAttribute("aria-label", "Outra turma");
      const r1 = el("div", "cad-g3");
      r1.append(field("Colégio", sCol), field("Ano", ano), field("Turma", turma));
      const fOutra = field("Qual turma?", turmaOutra);
      const trava = el("p", "cad-trava");
      const novoCol = U.mkBtn("🏫 Não está na lista? Cadastrar o colégio", "btn-sm", () => {
        close();
        C.ir("#instituicoes");
        U.toast("Cadastre o colégio e depois volte em ➕ Cadastrar aluno.");
      });
      s1.append(chipsG, r1, fOutra, trava, novoCol);
      // ---------- 2. Quem é ----------
      const s2 = parte(2, "Aluno", "o número do ID é o do aluno na escola");
      const pref = el("b", "cad-pref", "");
      const num = inp(o.numero || "", "02", 4);
      num.inputMode = "numeric";
      num.setAttribute("aria-label", "Número do ID do aluno");
      const idBox = el("div", "cad-id");
      idBox.append(pref, num);
      const nome = inp("", "nome completo", 120);
      nome.setAttribute("aria-label", "Nome do aluno");
      const r2 = el("div", "cad-g2id");
      r2.append(field("ID (obrigatório)", idBox), field("Nome do aluno", nome));
      // telefones: quantos precisar (mãe, pai, aluno…)
      const tels = el("div", "cad-tels");
      const linhasTel = [];
      const avTel = el("p", "wait");
      avTel.hidden = true;
      const addTel = (tipo = "Mãe") => {
        const r = el("div", "cad-tel");
        const tp = sel(["Mãe", "Pai", "Responsável", "Formando", "Outro"], tipo);
        tp.setAttribute("aria-label", "Quem é");
        const nm = inp("", "nome", 80);
        nm.setAttribute("aria-label", linhasTel.length ? "Nome do contato " + (linhasTel.length + 1) : "Nome do responsável");
        const tl = inp("", "(21) 99999-0000", 20);
        tl.inputMode = "tel";
        tl.setAttribute("aria-label", linhasTel.length ? "WhatsApp " + (linhasTel.length + 1) : "WhatsApp");
        tl.addEventListener("input", async () => {
          const { avisoTel } = await import("./aluno-id.js");
          const t = linhasTel.map(x => avisoTel(x.tl.value)).find(Boolean);
          avTel.textContent = t ? "⚠️ " + t : "";
          avTel.hidden = !t;
        });
        r.append(tp, nm, tl);
        if (linhasTel.length) {
          const x = U.mkBtn("✕", "btn-sm", () => {
            r.remove();
            linhasTel.splice(linhasTel.indexOf(item), 1);
          });
          x.setAttribute("aria-label", "Tirar este telefone");
          r.append(x);
        }
        const item = { tp, nm, tl };
        linhasTel.push(item);
        tels.append(r);
        return item;
      };
      addTel("Mãe");
      const maisTel = U.mkBtn("+ Outro telefone", "btn-sm", () => addTel(linhasTel.length === 1 ? "Pai" : "Formando").tl.focus());
      // endereço (opcional): o CEP preenche rua, bairro e cidade
      const end = el("details", "cad-end");
      end.append(el("summary", null, "🏠 Endereço (opcional)"));
      const cep = inp("", "00000-000", 9);
      cep.inputMode = "numeric";
      const rua = inp("", "rua", 120),
        nro = inp("", "nº", 10),
        bai = inp("", "bairro", 60),
        cid = inp("", "cidade", 60),
        cepInfo = el("small", "hint", "");
      const re1 = el("div", "cad-g3"),
        re2 = el("div", "cad-g2");
      re1.append(field("CEP", cep), field("Rua", rua), field("Número", nro));
      re2.append(field("Bairro", bai), field("Cidade", cid));
      end.append(re1, cepInfo, re2);
      cep.addEventListener("input", async () => {
        const { lerCep, buscarCep } = await import("./cep.js");
        const d = lerCep(cep.value);
        if (!d) return;
        cepInfo.textContent = "Buscando o CEP…";
        try {
          const r = await buscarCep(d);
          if (!r) return (cepInfo.textContent = "CEP não encontrado. Preencha à mão.");
          rua.value = title(r.rua);
          bai.value = title(r.bairro);
          cid.value = title(r.cidade);
          cepInfo.textContent = "✓ Confira e coloque o número.";
          nro.focus();
        } catch (_) {
          cepInfo.textContent = "Não consegui buscar o CEP agora. Preencha à mão.";
        }
      });
      const aviso = el("div", "cad-aviso");
      s2.append(r2, el("label", "cad-rot", "Telefones (WhatsApp)"), tels, maisTel, avTel, end, aviso);
      // ---------- 3. O que contratou ----------
      const s3 = parte(3, "O que contratou", "pode marcar mais de um");
      const marca = {};
      const grade = el("div", "cad-ops");
      OPCOES.filter(([k]) => mods.includes(k)).forEach(([k, ico, t, sub]) => {
        const b = el("label", "cad-op");
        const c = el("input");
        c.type = "checkbox";
        c.value = k;
        c.checked = o.modulo === k;
        b.append(c, el("span", "cad-op-ico", ico), el("b", null, t), el("small", null, sub));
        marca[k] = c;
        grade.append(b);
      });
      // PR e Paspatur: um ou outro (o aluno troca depois, se precisar)
      [
        ["pr", "paspatur"],
        ["paspatur", "pr"]
      ].forEach(
        ([a1, b1]) => marca[a1] && marca[b1] && marca[a1].addEventListener("change", () => marca[a1].checked && (marca[b1].checked = false))
      );
      // Linha de Frente ou Repasse (PR, Paspatur e Formatura)
      const frente = sel(
        [
          ["lf", "Linha de Frente (ano atual)"],
          ["rep", "Repasse (anos anteriores)"]
        ],
        Number(o.ano || ANO()) < ANO() ? "rep" : "lf"
      );
      frente.setAttribute("aria-label", "Lista");
      const fFrente = field("Entra na lista", frente);
      frente.addEventListener("change", () => {
        if (frente.value === "rep" && Number(ano.value) >= ANO()) ano.value = String(ANO() - 1);
        if (frente.value === "lf") ano.value = String(ANO());
        pintar();
        conferir();
      });
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
      const rb1 = el("div", "cad-g3"),
        rb2 = el("div", "cad-g3");
      rb1.append(field("Beca", bTipo), field("Tamanho", bTam), field("Valor do aluguel", bValor));
      rb2.append(field("Faixa", bFaixa), field("Capelo", bCap), lMenos);
      dBecas.append(el("b", null, "👘 Aluguel de becas"), rb1, rb2);
      s3.append(grade, fFrente, dBecas);
      const erro = el("p", "err");
      erro.hidden = true;
      const acts = el("div", "panel-actions cad-acoes");
      const bSalvar = U.mkBtn("Salvar", "", () => salvar(false));
      const bOutro = U.mkBtn("Salvar e cadastrar outro", "btn-primary", () => salvar(true));
      acts.append(U.mkBtn("Cancelar", "", close), el("span", "flex1"), bSalvar, bOutro);
      p.append(s1, s2, s3, erro, acts);

      const inst = () => insts.find(i => i.id === sCol.value) || null;
      const serieTxt = () => (turma.value === "outra" ? turmaOutra.value.trim() : turma.value);
      const ficha = () => ({
        inst: inst(),
        ano: Number(ano.value) || 0,
        codigo: idDoAluno(ano.value, inst(), num.value),
        nome: nome.value.trim(),
        modulos: Object.keys(marca).filter(k => marca[k].checked),
        becaTipo: bTipo.value
      });
      // trava: sem colégio, o resto fica desligado
      function pintar() {
        const i = inst();
        pref.textContent = i ? prefixoId(ano.value, i) : "??-";
        trava.hidden = !!i;
        trava.textContent = !grupo
          ? "🔒 Toque em Particular, Público ou Faculdade / curso para ver os colégios."
          : "🔒 Escolha o colégio. O resto da ficha fica travado até lá.";
        novoCol.hidden = !!i;
        fOutra.hidden = turma.value !== "outra";
        [s2, s3].forEach(sec => {
          sec.classList.toggle("cad-travado", !i);
          sec.querySelectorAll("input, select, button").forEach(x => (x.disabled = !i || (x.type === "checkbox" && x.dataset.ja === "1")));
        });
        const m = k => marca[k] && marca[k].checked;
        dBecas.hidden = !m("becas");
        fFrente.hidden = !(m("pr") || m("paspatur") || m("formatura"));
        lMenos.hidden = !COM_MENOS_LONGA.includes(bTipo.value);
      }
      // procura o aluno (ID e nome) com uma pausa, para não buscar a cada letra
      let espera = null;
      function conferir() {
        clearTimeout(espera);
        espera = setTimeout(async () => {
          const f = ficha();
          if (!f.inst || (!f.codigo && f.nome.length < 5)) {
            st.repetido = null;
            return mostrarAviso(f);
          }
          st.achados = await procurar(C, f);
          st.repetido = conferirRepetido(f, st.achados);
          mostrarAviso(f);
        }, 500);
      }
      function mostrarAviso(f) {
        aviso.innerHTML = "";
        Object.values(marca).forEach(c => {
          delete c.dataset.ja;
          c.closest(".cad-op").classList.remove("cad-ja");
        });
        const r = st.repetido;
        if (r && r.idDeOutro)
          aviso.append(
            el(
              "p",
              "err",
              `O ID ${f.codigo} já é de ${title(r.idDeOutro.nome)} (${NOMES_MODULO[r.idDeOutro.modulo]}). Confira o número do aluno na escola.`
            )
          );
        else if (r && r.mesmoAluno.length) {
          const a0 = r.mesmoAluno[0];
          const onde = [...new Set(r.mesmoAluno.map(x => NOMES_MODULO[x.modulo]))].join(", ");
          const b = el("div", "notice");
          b.append(el("span", null, `Já existe ${f.codigo} · ${title(a0.nome)} · ${title(a0.escola)} ${a0.ano || ""} (no ${onde}). `));
          b.append(
            U.mkBtn("Usar este aluno", "btn-sm btn-primary", () => {
              nome.value = title(a0.nome);
              if (!linhasTel[0].tl.value && a0.tel) linhasTel[0].tl.value = String(a0.tel).replace(/^55/, "");
              if (!linhasTel[0].nm.value && a0.responsavel) linhasTel[0].nm.value = title(a0.responsavel);
              U.toast("Dados puxados. Marque o que mais ele contratou.");
            })
          );
          aviso.append(b);
          // o que ele já tem fica marcado como "já tem" (não cria de novo)
          r.mesmoAluno.forEach(x => {
            const c = marca[x.modulo];
            if (!c) return;
            c.checked = false;
            c.dataset.ja = "1";
            c.closest(".cad-op").classList.add("cad-ja");
          });
        } else if (r && r.parecidos.length) {
          const a0 = r.parecidos[0];
          aviso.append(
            el(
              "p",
              "wait",
              `⚠️ Parecido: ${title(a0.nome)}${a0.codigo ? " (ID " + a0.codigo + ")" : ""} · ${title(a0.escola)} · no ${NOMES_MODULO[a0.modulo]}. Se for o mesmo aluno, use o mesmo número do ID.`
            )
          );
        }
        pintar();
      }
      [sCol, ano, turma].forEach(x => x.addEventListener("change", () => (pintar(), conferir())));
      [num, nome].forEach(x => x.addEventListener("input", conferir));
      Object.values(marca).forEach(c => c.addEventListener("change", pintar));
      bTipo.addEventListener("change", pintar);
      pintar();
      if (inst()) conferir();
      setTimeout(() => (inst() ? num : grupo ? sCol : chipsG.querySelector("button")).focus(), 30);

      async function salvar(outro) {
        erro.hidden = true;
        const f = ficha();
        const falta = faltaParaSalvar(f);
        if (turma.value === "outra" && !turmaOutra.value.trim()) falta.push("a turma");
        if (falta.length) return mostrarErro("Falta: " + falta.join(", ") + ".");
        st.achados = await procurar(C, f);
        st.repetido = conferirRepetido(f, st.achados);
        mostrarAviso(f);
        if (st.repetido.idDeOutro) return mostrarErro("Esse número de ID já é de outro aluno. Confira o número.");
        const ja = new Set(st.repetido.mesmoAluno.map(x => x.modulo));
        // PR e Paspatur são a mesma lista: se já está em um, não entra no outro
        if (ja.has("pr") || ja.has("paspatur")) ["pr", "paspatur"].forEach(k => ja.add(k));
        const fazer = f.modulos.filter(k => !ja.has(k));
        if (!fazer.length) return mostrarErro("Esse aluno já está em tudo o que foi marcado.");
        bSalvar.disabled = bOutro.disabled = true;
        const contatos = linhasTel
          .map(x => ({ tipo: x.tp.value, nome: x.nm.value.trim(), tel: U.digits(x.tl.value).replace(/^55(?=\d{10,11}$)/, "") }))
          .filter(x => x.tel.length >= 10 && x.tel.length <= 11);
        const endereco = [cep, rua, nro, bai, cid].some(x => x.value.trim())
          ? {
              cep: cep.value.replace(/\D/g, ""),
              rua: rua.value.trim(),
              numero: nro.value.trim(),
              bairro: bai.value.trim(),
              cidade: cid.value.trim()
            }
          : {};
        const d = {
          inst: f.inst,
          ano: f.ano,
          serie: serieTxt(),
          codigo: f.codigo,
          nome: f.nome,
          contatos,
          tel: (contatos[0] || {}).tel || "",
          resp: ((contatos.find(c => c.tipo !== "Formando") || {}).nome || "").trim(),
          endereco,
          seg: frente.value
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
          if (fazer.includes("pr")) feitos.push(await criarPR(C, "repasse", d, "pr"));
          if (fazer.includes("paspatur")) feitos.push(await criarPR(C, "repasse", d, "paspatur"));
          if (fazer.includes("formatura")) feitos.push(await criarPR(C, "formaturaAlunos", d, ""));
          await guardarNumero(C, f.ano, f.inst, f.codigo);
        } catch (e) {
          bSalvar.disabled = bOutro.disabled = false;
          if (e && e.aviso) return mostrarErro((feitos.length ? "Gravado em: " + feitos.join(", ") + ". " : "") + e.message);
          if (feitos.length) U.toast("Gravado em: " + feitos.join(", ") + ". O resto deu erro.");
          return C.handleErr(e);
        }
        close();
        const pedido = feitos.find(x => String(x).startsWith("pedido: "));
        if (pedido) U.toast(pedido.slice(8));
        else if (feitos.length) U.toast(`✅ ${f.codigo} · ${title(f.nome)}: ${feitos.join(", ")}`);
        // venda antecipada: abre o kit e as parcelas já com nome, WhatsApp, ID e turma preenchidos
        if (fazer.includes("va")) {
          const m = await import("./formaturas.js");
          return m.abrirVendaAntecipada(C, f.inst, { nome: d.nome, tel: d.tel, codigo: d.codigo, serie: d.serie });
        }
        if (outro)
          abrirCadastroAluno(C, {
            instId: f.inst.id,
            ano: f.ano,
            serie: serieTxt(),
            modulo: f.modulos.length === 1 ? f.modulos[0] : o.modulo,
            numero: String((parseInt(num.value, 10) || 0) + 1).padStart(2, "0")
          });
      }
      function mostrarErro(t) {
        erro.textContent = t;
        erro.hidden = false;
      }
    },
    { div: true, wide: true }
  );
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
    contatos: d.contatos || [],
    responsavel: d.resp,
    endereco: d.endereco || {},
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
    atual = d.seg ? d.seg === "lf" : ano >= ANO();
  const contatos = (d.contatos || []).map(c => ({ tipo: c.tipo, nome: c.nome || (c.tipo === "Formando" ? d.nome : ""), tel: c.tel }));
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
    endereco: d.endereco || {},
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
  ...COLUNAS_CONTATOS,
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
  ...COLUNAS_CONTATOS,
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
