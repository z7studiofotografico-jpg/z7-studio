// 🤖 Cadastro automático do Aluguel de becas (13/11/2026): as fotos das fichas vão direto (uma foto por aluno),
// o Claude lê e, na conferência, entram também os dados do cartão do aluguel: beca (infantil ou adulto), tamanho,
// faixa, capelo e o kit (Beca, Paspatur, Canudo, Certificado). O valor sai dos preços do Contrato do colégio.
import { el, title, sheet, field, sel } from "./ui.js";
import * as U from "./util.js";
import { fotoDaFicha, chaveGrupo, chaveGrupoCol, contatosDaFicha, acharExistente, soNumero, menorLivre } from "./fichas.js";
import { lerCodigo, fmtCodigo, codigoBusca } from "./aluno-id.js";
import { TAMANHOS, FAIXAS, CAPELOS } from "./becas-estoque.js";
import { ITENS_PACOTE } from "./contrato-colegio-regras.js";

const idFichaAluguel = (escola, ano, nome) => (chaveGrupo(escola, ano) + "_" + U.chave(nome).replace(/[^A-Z0-9]+/g, "-")).slice(0, 140);

// 1) enviar as fotos das fichas: escolhe o colégio e o ano, e as fotos (uma ficha por aluno)
export function enviarFichasAluguel(C, depois) {
  sheet("📤 Fichas do Aluguel de becas", async (p, close) => {
    p.append(el("p", "hint", "Escolha o colégio e as fotos das fichas (uma foto por aluno). Depois toque em Pedir a leitura."));
    const insts = [];
    try {
      (await C.FS.getDocs(C.FS.collection(C.db, "instituicoes"))).forEach(d => insts.push({ id: d.id, ...d.data() }));
    } catch (e) {
      return C.handleErr(e);
    }
    insts.sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));
    const sInst = sel(
      insts.map(i => [i.id, title(i.nome)]),
      "",
      "escolha o colégio"
    );
    const ano = el("input");
    ano.inputMode = "numeric";
    ano.value = String(new Date().getFullYear());
    const arq = el("input");
    arq.type = "file";
    arq.accept = "image/*";
    arq.multiple = true;
    const r = el("div", "row2");
    r.append(field("Colégio", sInst), field("Ano", ano));
    const msg = el("p", "hint");
    const ok = U.mkBtn("Guardar as fichas", "btn-primary", async () => {
      const inst = insts.find(i => i.id === sInst.value);
      if (!inst) return U.toast("Escolha o colégio.");
      if (!arq.files.length) return U.toast("Escolha as fotos das fichas.");
      ok.disabled = true;
      let n = 0;
      for (const file of arq.files) {
        msg.textContent = `Guardando ${++n} de ${arq.files.length}…`;
        try {
          const foto = await fotoDaFicha(file);
          const pasta = file.name.replace(/\.[^.]+$/, "");
          await C.FS.setDoc(C.FS.doc(C.db, "fichas", idFichaAluguel(inst.nome, ano.value, pasta)), {
            escola: inst.nome,
            instId: inst.id,
            ano: Number(ano.value) || null,
            colNome: "alugueis",
            pasta,
            arquivo: file.name,
            img: foto.img,
            semPapel: !foto.achou,
            status: "nova",
            criadoEm: new Date().toISOString(),
            por: C.me || ""
          });
        } catch (e) {
          console.warn("[Z7] ficha do aluguel", e);
        }
      }
      U.toast(`✅ ${n} fichas guardadas. Agora toque em Pedir a leitura.`);
      close();
      if (depois) depois();
    });
    p.append(r, field("Fotos das fichas", arq), msg);
    const a = el("div", "actions");
    a.append(ok, U.mkBtn("Cancelar", "", close));
    p.append(a);
  });
}

// alunos do aluguel daquele colégio e ano (para juntar com quem já está no app)
export async function existentesAluguel(C, g) {
  const s = await C.FS.getDocs(
    C.FS.query(C.FS.collection(C.db, "alugueis"), C.FS.where("instId", "==", g.instId), C.FS.where("ano", "==", Number(g.ano)))
  );
  return s.docs.map(d => ({ id: d.id, ...d.data() }));
}
export async function contratoAluguel(C, g) {
  try {
    const s = await C.FS.getDoc(C.FS.doc(C.db, "contratosColegio", `${g.instId}_${Number(g.ano)}`));
    return s.exists() ? s.data() : null;
  } catch (_) {
    return null;
  }
}

// 2) os campos do cartão do aluguel, na conferência (vêm do aluno que já está no app, quando junta)
export function camposAluguel(ja, contrato) {
  const box = el("div", "ficha-campos");
  const idade = sel(
    [
      ["infPreta", "Infantil"],
      ["tradPreta", "Adulto"]
    ],
    (ja && ja.becaTipo) || "infPreta"
  );
  const tam = sel(TAMANHOS, (ja && ja.tamanho) || "", "tamanho");
  const faixa = sel(FAIXAS, (ja && ja.faixa) || "", "sem faixa");
  const capelo = sel(CAPELOS, (ja && ja.capelo) || "", "sem capelo");
  [
    ["Beca", idade, 2],
    ["Tamanho", tam, 1],
    ["Faixa", faixa, 2],
    ["Capelo", capelo, 1]
  ].forEach(([r, i, l]) => {
    const f = field(r, i);
    f.classList.add("fc-" + l);
    box.append(f);
  });
  const pr = (contrato && contrato.precos) || {};
  const kit = el("div", "chips fc-6");
  const cx = ITENS_PACOTE.map(([k, n]) => {
    const l = el("label", "chk");
    const c = el("input");
    c.type = "checkbox";
    c.checked = ((ja && ja.pacote) || []).includes(k);
    l.append(c, document.createTextNode(` ${n}${Number(pr[k]) ? " · " + U.money(pr[k]) : ""}`));
    kit.append(l);
    return [k, c];
  });
  const fk = el("div", "field fc-6");
  fk.append(el("label", null, "Kit (o que o aluno levou)"), kit);
  box.append(fk);
  return {
    box,
    ler: () => ({
      becaTipo: idade.value,
      tamanho: tam.value,
      faixa: faixa.value,
      capelo: capelo.value,
      pacote: cx.filter(([, c]) => c.checked).map(([k]) => k)
    })
  };
}

// 3) grava no Aluguel de becas: junta com o aluno que já existe (pelo nome ou pelo número) ou cria um novo
export async function confirmarAluguel(C, { f, lido, extra, existentes, usados, sigla, contrato }) {
  const { FS, db } = C;
  if (!lido.nome) throw Object.assign(new Error("Falta o nome do aluno."), { aviso: true });
  const achado = acharExistente(existentes, f, lido);
  const nFicha = soNumero(lido.numero);
  const n = achado && lerCodigo(achado.codigo || "") ? lerCodigo(achado.codigo).n : nFicha || menorLivre(usados);
  usados.add(n);
  const codigo = (achado && achado.codigo) || fmtCodigo(Number(f.ano), sigla, n);
  const contatos = contatosDaFicha(lido);
  const mae = contatos.find(c => c.tipo === "Mãe") || contatos.find(c => c.tipo !== "Formando") || null;
  const aluno = contatos.find(c => c.tipo === "Formando");
  const pr = (contrato && contrato.precos) || {};
  const valor = extra.pacote.reduce((t, k) => t + (Number(pr[k]) || 0), 0);
  const agora = new Date().toISOString();
  const endereco = {
    rua: lido.rua,
    numero: lido.numeroCasa,
    bairro: lido.bairro,
    cidade: lido.cidade,
    cep: String(lido.cep || "").replace(/\D/g, "")
  };
  const base = {
    codigo,
    codigoBusca: codigoBusca(codigo),
    contatos,
    tel: (aluno || mae || {}).tel || "",
    responsavel: mae ? mae.nome || "" : "",
    nascimento: lido.nasc || "",
    email: (lido.email || "").toLowerCase(),
    endereco,
    becaTipo: extra.becaTipo,
    tamanho: extra.tamanho,
    menosLonga: false,
    faixa: extra.faixa,
    capelo: extra.capelo,
    pacote: extra.pacote,
    valor,
    contratoZerado: !valor,
    atualizadoEm: agora,
    fichaLidaEm: agora
  };
  if (lido.turma) base.serie = lido.turma;
  let novo = false;
  if (achado) {
    const patch = Object.assign({}, base);
    // o nome completo da ficha no lugar do curto
    if (String(lido.nome).length > String(achado.nome || "").length) {
      patch.nome = lido.nome.toUpperCase();
      patch.nomeBusca = U.chave(lido.nome);
    }
    await FS.updateDoc(FS.doc(db, "alugueis", achado.id), patch);
    Object.assign(achado, patch);
  } else {
    novo = true;
    const doc = Object.assign(
      {
        nome: lido.nome.toUpperCase(),
        nomeBusca: U.chave(lido.nome),
        instId: f.instId,
        instNome: f.escola,
        ano: Number(f.ano),
        serie: lido.turma || "",
        respEmail: (contrato && contrato.respEmail) || "",
        status: "Cadastrado",
        produtos: [],
        historico: [],
        obs: "",
        daFicha: true,
        criadoEm: agora,
        criadoPor: C.me || "",
        criadoPorEmail: C.email || ""
      },
      base
    );
    const ref = FS.doc(FS.collection(db, "alugueis"));
    await FS.setDoc(ref, doc);
    existentes.push({ id: ref.id, ...doc });
  }
  await FS.deleteDoc(FS.doc(db, "fichas", f.id)); // a foto da ficha não é mais usada
  f.status = "confirmada";
  const resta = await FS.getDocs(
    FS.query(
      FS.collection(db, "fichas"),
      FS.where("escola", "==", f.escola),
      FS.where("ano", "==", f.ano),
      FS.where("colNome", "==", "alugueis"),
      FS.limit(1)
    )
  );
  if (resta.empty) await FS.deleteDoc(FS.doc(db, "fichasPedidos", chaveGrupoCol(f.escola, f.ano, "alugueis"))).catch(() => {});
  return { codigo, novo };
}
