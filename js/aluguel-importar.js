// Importar planilha do Aluguel de becas (independente do PR e da Formatura): um aluno por linha, da instituição e do
// ano escolhidos na tela. Colunas em qualquer ordem; o que faltar fica avisado ("Falta no cadastro").
import { el, field, sel, title } from "./ui.js";
import * as U from "./util.js";
import { abrirImportador, ultimasImportacoes } from "./importador.js";
import { BECAS, FAIXAS, CAPELOS, TAMANHOS } from "./becas-estoque.js";
import { lerPacote, ITENS_PACOTE, idContrato } from "./contrato-colegio-regras.js";
import { idDoAluno } from "./cadastro-regras.js";
import { lerCodigo, codigoBusca } from "./aluno-id.js";

const achar = (lista, v) => {
  const k = U.chave(v);
  if (!k) return "";
  const x = lista.find(([id, nome]) => U.chave(nome) === k || U.chave(id) === k || U.chave(nome).startsWith(k));
  return x ? x[0] : "";
};
export const CAMPOS_ALUGUEL = [
  { k: "codigo", nome: "ID", sinonimos: ["Nº", "Número", "Numero", "Nº do aluno", "Número do aluno"] },
  { k: "nome", nome: "Aluno", sinonimos: ["Nome", "Formando", "Nome do aluno"], obrigatorio: true },
  { k: "tel", nome: "WhatsApp", sinonimos: ["Telefone", "Celular", "Tel", "Telefone 1", "Celular 1"] },
  { k: "responsavel", nome: "Responsável", sinonimos: ["Reponsavel", "Mãe", "Pai"] },
  { k: "serie", nome: "Série", sinonimos: ["Turma", "Curso", "Ano escolar"] },
  { k: "tamanho", nome: "Tamanho", sinonimos: ["Tamanho da beca", "Beca"] },
  { k: "faixa", nome: "Faixa", sinonimos: ["Cor da faixa"] },
  { k: "capelo", nome: "Capelo", sinonimos: ["Cor do capelo"] },
  { k: "valor", nome: "Valor", sinonimos: ["Valor do aluguel", "Preço"] },
  { k: "pacote", nome: "Pacote", sinonimos: ["Itens", "Kit", "Produtos"] },
  // planilha com uma coluna por item (1 = o aluno tem): Aluguel (a beca), Paspatur, Canudo, Certificado
  { k: "itBeca", nome: "Aluguel (item)", sinonimos: ["Aluguel", "Aluguel da beca"] },
  { k: "itPaspatur", nome: "Paspatur (item)", sinonimos: ["Paspatur"] },
  { k: "itCanudo", nome: "Canudo (item)", sinonimos: ["Canudo"] },
  { k: "itCertificado", nome: "Certificado (item)", sinonimos: ["Certificado"] },
  { k: "unidade", nome: "Unidade", sinonimos: ["Unidade do colégio", "Filial"] },
  { k: "obs", nome: "Observação", sinonimos: ["Obs", "Observações"] }
];
// "P1" = P menos longa (só existe na adulto); "P ADULTO" / "INFANTIL M" dizem qual beca; "M" = M
export function lerTamanho(v) {
  const bruto = U.chave(v).toUpperCase();
  const idade = /ADULT/.test(bruto) ? "adulto" : /INFANT|INF\b/.test(bruto) ? "infantil" : "";
  const t = bruto.replace(/ADULTO?|INFANTIL|INF\b/g, "").replace(/[\s.-]/g, "");
  const m = t.match(/^(PPP|PP|P|M|G|GG|XG|XXG|EXG)(1)?$/);
  if (!m || !TAMANHOS.some(([z]) => z === m[1])) return { tamanho: "", menosLonga: false, idade };
  return { tamanho: m[1], menosLonga: !!m[2], idade: m[2] ? "adulto" : idade };
}
// ID da planilha: o número do aluno (1, 02) vira 26SIGLA-01; um ID completo (26LSN-01) fica como está
export function idDaPlanilha(v, ano, inst) {
  const t = String(v == null ? "" : v).trim();
  if (!t) return "";
  if (lerCodigo(t)) return t.toUpperCase().replace(/\s+/g, "");
  return /^\d{1,4}$/.test(t) ? idDoAluno(ano, inst, t) : "";
}
// itens marcados nas colunas de item (qualquer coisa que não seja vazio, "-" ou "0")
export function itensMarcados(o) {
  const tem = v =>
    !["", "-", "0", "nao", "não", "n"].includes(
      String(v == null ? "" : v)
        .trim()
        .toLowerCase()
    );
  return [
    ["itBeca", "beca"],
    ["itPaspatur", "paspatur"],
    ["itCanudo", "canudo"],
    ["itCertificado", "certificado"]
  ]
    .filter(([k]) => tem(o[k]))
    .map(([, i]) => i);
}
// valor do aluno pelos preços do colégio digitados na importação (soma dos itens do kit dele)
export function valorPeloKit(itens, precos) {
  return (itens || []).reduce((t, k) => t + (Number((precos || {})[k]) || 0), 0);
}
export function paraDocAluguel(o, ext) {
  const d = docAluguel(o, ext);
  // sem coluna de valor e com os preços do colégio na tela: o valor é a soma do kit
  if (!String(o.valor || "").trim() && ext.precos && Object.values(ext.precos).some(v => v > 0)) {
    d.valor = valorPeloKit(d.pacote, ext.precos);
    d.contratoZerado = !d.valor;
  }
  return d;
}
function docAluguel(o, ext) {
  const t = lerTamanho(o.tamanho);
  const codigo = idDaPlanilha(o.codigo, ext.ano, ext.inst);
  const falta = [];
  if (!ext.instId) falta.push("instituição (escolha acima)");
  if (String(o.tamanho || "").trim() && !t.tamanho) falta.push(`tamanho “${o.tamanho}” não reconhecido`);
  if (String(o.pacote || "").trim() && !lerPacote(o.pacote).length) falta.push(`pacote “${o.pacote}” não reconhecido`);
  return {
    __falta: falta,
    instId: ext.instId || "",
    instNome: ext.instNome || "",
    respEmail: ext.respEmail || "", // quem fechou o contrato do colégio (cada um vê os seus)
    ano: Number(ext.ano) || new Date().getFullYear(),
    serie: String(o.serie || "").trim(),
    nome: String(o.nome || "").trim(),
    nomeBusca: U.chave(o.nome),
    codigo,
    codigoBusca: codigo ? codigoBusca(codigo) : "",
    tel: U.digits(o.tel),
    responsavel: String(o.responsavel || "").trim(),
    // infantil ou adulto: o que a célula disser; se não disser, o que foi escolhido na tela da importação
    becaTipo: (t.idade || ext.idade || "adulto") === "infantil" ? "infPreta" : "tradPreta",
    tamanho: t.tamanho,
    menosLonga: t.menosLonga && (t.idade || ext.idade || "adulto") !== "infantil",
    faixa: achar(FAIXAS, o.faixa),
    capelo: achar(CAPELOS, o.capelo ? "Capelo " + o.capelo : ""),
    valor: Math.max(
      0,
      Number(
        String(o.valor || "0")
          .replace(/[^\d,.-]/g, "")
          .replace(/\.(?=\d{3})/g, "")
          .replace(",", ".")
      ) || 0
    ),
    contratoZerado: !Number(String(o.valor || "0").replace(/\D/g, "")),
    obs: String(o.obs || "").trim(),
    // célula vazia = pacote padrão do contrato do colégio
    pacote: lerPacote(o.pacote).length ? lerPacote(o.pacote) : lerPacote(itensMarcados(o)),
    unidade: String(o.unidade || "").trim(),
    status: "Cadastrado",
    produtos: [],
    historico: [],
    criadoEm: new Date().toISOString()
  };
}
export async function importarAlugueis(C, insts) {
  if (!C.isAdmin) return U.toast("Só o administrador importa planilha.");
  const existentes = new Set();
  try {
    (await C.FS.getDocs(C.FS.query(C.FS.collection(C.db, "alugueis"), C.FS.limit(5000)))).forEach(d => {
      const x = d.data();
      existentes.add(`${x.instId}|${x.ano}|${U.chave(x.nome)}`);
    });
  } catch (_) {}
  // dono de cada colégio/ano = quem fechou o contrato
  const donos = new Map();
  try {
    (await C.FS.getDocs(C.FS.query(C.FS.collection(C.db, "contratosColegio"), C.FS.limit(2000)))).forEach(d => {
      const c = d.data();
      donos.set(`${c.instId}|${Number(c.ano)}`, String(c.respEmail || "").toLowerCase());
    });
  } catch (_) {}
  abrirImportador(C, {
    modulo: "aluguel",
    titulo: "Importar planilha · Aluguel de becas",
    col: "alugueis",
    campos: CAMPOS_ALUGUEL,
    existentes,
    chave: d => `${d.instId}|${d.ano}|${U.chave(d.nome)}`,
    paraDoc: paraDocAluguel,
    depois: ext => guardarPrecos(C, ext),
    camposExtras: box => {
      const sInst = sel(
        insts.map(i => [i.id, title(i.nome)]),
        "",
        "escolha a instituição"
      );
      const ano = el("input");
      ano.inputMode = "numeric";
      ano.value = String(new Date().getFullYear());
      const r = el("div", "row2");
      r.append(field("Instituição", sInst), field("Ano", ano));
      // tamanho sem "adulto" ou "infantil" na célula fica com esta beca
      const sIdade = sel(
        [
          ["adulto", "Adulto (tradicional preta)"],
          ["infantil", "Infantil (preta)"]
        ],
        "adulto"
      );
      r.append(field("Beca de quem não tem escrito na planilha", sIdade));
      // preços deste colégio (cada trabalho tem os seus): vão para o Contrato do colégio e dão o valor de cada aluno
      const prBox = el("div", "row2");
      const prIn = ITENS_PACOTE.map(([k, n]) => {
        const i = el("input");
        i.inputMode = "decimal";
        i.placeholder = "0,00";
        prBox.append(field("Preço " + n, i));
        return [k, i];
      });
      const lerValor = v =>
        Number(
          String(v || "")
            .replace(/\./g, "")
            .replace(",", ".")
        ) || 0;
      const carregarPrecos = async () => {
        const i = insts.find(x => x.id === sInst.value);
        if (!i || !ano.value) return;
        try {
          const s = await C.FS.getDoc(C.FS.doc(C.db, "contratosColegio", `${i.id}_${Number(ano.value)}`));
          const pr = (s.exists() && s.data().precos) || {};
          prIn.forEach(([k, inp]) => (inp.value = Number(pr[k]) ? String(pr[k]).replace(".", ",") : ""));
        } catch (_) {}
      };
      sInst.addEventListener("change", carregarPrecos);
      ano.addEventListener("change", carregarPrecos);
      const prTit = el("p", "hint", "Preços deste colégio (o valor de cada aluno é a soma do kit dele; o pai pode comprar um item só):");
      const hist = el("details", "notes");
      hist.append(el("summary", null, "Importações anteriores (desfazer)"));
      const hb = el("div");
      hist.append(hb);
      hist.addEventListener("toggle", () => hist.open && ultimasImportacoes(C, "aluguel", hb));
      box.append(r, prTit, prBox, hist);
      return () => {
        const i = insts.find(x => x.id === sInst.value);
        return {
          instId: i ? i.id : "",
          instNome: i ? i.nome : "",
          inst: i || null,
          idade: sIdade.value,
          precos: Object.fromEntries(prIn.map(([k, inp]) => [k, lerValor(inp.value)])),
          ano: ano.value,
          respEmail: (i && donos.get(`${i.id}|${Number(ano.value)}`)) || ""
        };
      };
    }
  });
}
export { BECAS };

// os preços digitados na importação vão para o Contrato do colégio (cria o contrato se ainda não existe)
async function guardarPrecos(C, ext) {
  if (!ext.instId || !ext.precos || !Object.values(ext.precos).some(v => v > 0)) return;
  const { FS, db } = C;
  const ref = FS.doc(db, "contratosColegio", idContrato(ext.instId, Number(ext.ano)));
  const agora = new Date().toISOString();
  const reg = o => ({ o, em: agora, por: C.me || C.email || "" });
  const s = await FS.getDoc(ref);
  if (s.exists()) {
    const x = s.data();
    if (JSON.stringify(x.precos || {}) === JSON.stringify(ext.precos)) return;
    await FS.updateDoc(ref, {
      precos: ext.precos,
      atualizadoEm: agora,
      historico: [...(x.historico || []), reg("preços dos itens na importação da planilha")].slice(-40)
    });
    return;
  }
  const inst = ext.inst || {};
  await FS.setDoc(ref, {
    instId: ext.instId,
    instNome: ext.instNome || "",
    ano: Number(ext.ano),
    unidade: "",
    respEmail: ext.respEmail || inst.respEmail || "",
    respNome: inst.resp || "",
    quemPaga: "alunos",
    recebePadrao: "estudio",
    valor: 0,
    precos: ext.precos,
    parcelas: 1,
    contato: { nome: "", cargo: "", tel: "" },
    entrega: { data: "", com: "" },
    pacotePadrao: [],
    obs: "",
    criadoEm: agora,
    atualizadoEm: agora,
    criadoPor: C.me || "",
    historico: [reg("criou o contrato na importação da planilha")]
  });
}
