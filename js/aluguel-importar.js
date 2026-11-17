// Importar planilha do Aluguel de becas (independente do PR e da Formatura): um aluno por linha, da instituição e do
// ano escolhidos na tela. Colunas em qualquer ordem; o que faltar fica avisado ("Falta no cadastro").
import { el, field, sel, title } from "./ui.js";
import * as U from "./util.js";
import { abrirImportador, ultimasImportacoes } from "./importador.js";
import { BECAS, FAIXAS, CAPELOS, TAMANHOS } from "./becas-estoque.js";
import { lerPacote, ITENS_PACOTE, idContrato, kitDaPlanilha, valorDoPacote, serieDaTurma } from "./contrato-colegio-regras.js";
import { idDoAluno } from "./cadastro-regras.js";
import { cartaoDoTipo } from "./instituicoes-dados.js";
import { TIPOS_FILTRO } from "./aluguel-resumo.js";
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
  { k: "serie", nome: "Série", sinonimos: ["Curso", "Ano escolar"] },
  // (17/11/2026) a turma de verdade (901, 502…), obrigatória; sem série, a série sai dela (901 = 9º ano)
  { k: "turma", nome: "Turma", sinonimos: ["Sala", "Classe"] },
  { k: "tamanho", nome: "Tamanho", sinonimos: ["Tamanho da beca", "Beca"] },
  { k: "faixa", nome: "Faixa", sinonimos: ["Cor da faixa"] },
  { k: "capelo", nome: "Capelo", sinonimos: ["Cor do capelo"] },
  { k: "valor", nome: "Valor", sinonimos: ["Valor do aluguel", "Preço"] },
  // (17/11/2026) a coluna é o KIT do aluno ("Kit 1", "Kit 2"…, os kits desta tela); "Pacote" ainda vale
  { k: "situacao", nome: "Situação", sinonimos: ["Status"] },
  { k: "pacote", nome: "Kit", sinonimos: ["Pacote", "Itens", "Produtos"] },
  // planilha com uma coluna por item (1 = o aluno tem): Aluguel (a beca), Paspatur, Canudo, Certificado
  { k: "itBeca", nome: "Aluguel (item)", sinonimos: ["Aluguel", "Aluguel da beca"] },
  { k: "itPelerine", nome: "Pelerine (item)", sinonimos: ["Pelerine"] },
  { k: "itPaspatur", nome: "Paspatur (item)", sinonimos: ["Paspatur"] },
  { k: "itCanudo", nome: "Canudo (item)", sinonimos: ["Canudo"] },
  { k: "itCertificado", nome: "Certificado (item)", sinonimos: ["Certificado"] },
  { k: "itQuadro", nome: "Quadro 30x40 (item)", sinonimos: ["Quadro", "Quadro 30x40", "Quadro 30 x 40"] },
  { k: "itPR", nome: "PR 15x10 (item)", sinonimos: ["PR", "PR 15x10", "2 PR 10X15", "Porta-retrato", "Porta retrato"] },
  { k: "itFoto2115", nome: "Foto 21x15 (item)", sinonimos: ["Foto 21x15", "Foto 21 x 15"] },
  { k: "itFoto1510", nome: "Foto 15x10 (item)", sinonimos: ["Foto 15x10", "Foto 15 x 10"] },
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
    ["itPelerine", "pelerine"],
    ["itPaspatur", "paspatur"],
    ["itCanudo", "canudo"],
    ["itCertificado", "certificado"],
    ["itQuadro", "quadro3040"],
    ["itPR", "pr1510"],
    ["itFoto2115", "foto2115"],
    ["itFoto1510", "foto1510"]
  ]
    .filter(([k]) => tem(o[k]))
    .map(([, i]) => i);
}
// valor do aluno pelos preços do colégio digitados na importação (soma dos itens do kit dele)
export function valorPeloKit(itens, precos) {
  return (itens || []).reduce((t, k) => t + (Number((precos || {})[k]) || 0), 0);
}
// "Sem item", "Nenhum", "Não vai participar" no Kit: entra em 🚫 Não vai participar, sem kit e sem valor
// (também no Tamanho: "Sem medida", "Sem tamanho")
const SEM_ITEM = /^(sem\s*(item|itens|kit|pacote|medida|tamanho)|nenhum|nada|nao\s*(vai\s*)?particip\w*)$/;
const semItem = v =>
  SEM_ITEM.test(
    U.chave(v)
      .toLowerCase()
      .replace(/[^a-z ]/g, "")
      .trim()
  );
export function paraDocAluguel(o, ext) {
  const d = docAluguel(o, ext);
  // também: Status "Não vai" / "Desistiu", e a linha sem kit e com as colunas de item todas vazias
  const naoVai = /^(nao vai|desist|cancel)/.test(U.chave(o.situacao).toLowerCase());
  const colunasItem = Object.keys(o).some(k => /^it[A-Z]/.test(k));
  const nenhumItem = colunasItem && !String(o.pacote || "").trim() && !itensMarcados(o).length;
  if (semItem(o.pacote) || semItem(o.tamanho) || naoVai || nenhumItem) {
    d.__aviso = d.__aviso.filter(f => !/^(pacote|tamanho)/.test(f));
    const nada = { pacote: [], valor: 0, contratoZerado: true, tamanho: "", menosLonga: false };
    return Object.assign(d, { naoParticipa: true, soPaspatur: false }, nada);
  }
  // PACOTE "Kit 1" / "Kit 2": o kit do colégio para a turma do aluno (itens e preço fechado)
  // PACOTE vazio e o colégio tem kit para a turma: o Kit 1 da turma (o pacote de quem não escolheu outro)
  const vazio = !String(o.pacote || "").trim() && !itensMarcados(o).length;
  const kit = kitDaPlanilha(vazio ? "Kit 1" : o.pacote, d.serie, ext.contrato);
  if (kit) {
    d.pacote = kit.itens.slice();
    if (d.pacote.includes("pelerine")) Object.assign(d, { becaTipo: "pelerineAzul", tamanho: "", menosLonga: false });
    d.__aviso = d.__aviso.filter(f => !/^pacote/.test(f));
    if (!String(o.valor || "").trim()) {
      d.valor = Number(kit.valor) || 0;
      d.contratoZerado = !d.valor;
    }
    return d;
  }
  // sem coluna de valor e com os preços do colégio na tela: o valor é a soma do kit
  if (!String(o.valor || "").trim() && ext.precos && Object.values(ext.precos).some(v => v > 0)) {
    d.valor = ext.contrato
      ? valorDoPacote(d.pacote, d.serie, Object.assign({}, ext.contrato, { precos: ext.precos }))
      : valorPeloKit(d.pacote, ext.precos);
    d.contratoZerado = !d.valor;
  }
  return d;
}
function docAluguel(o, ext) {
  const t = lerTamanho(o.tamanho);
  const codigo = idDaPlanilha(o.codigo, ext.ano, ext.inst);
  const falta = [];
  // (17/11/2026) todo aluno da planilha entra (pode querer só o Paspatur ou só um kit): o que não bate vira
  // aviso ("Entram, mas confira") e se acerta depois no aluno; só a instituição impede de gravar
  const aviso = [];
  if (!ext.instId) falta.push("instituição (escolha acima)");
  if (!String(o.turma == null ? "" : o.turma).trim()) aviso.push("sem turma (ex.: 901)");
  // "Beca pelerine azul" (no Tamanho ou no Pacote): pelerine, tamanho único
  const peler = /peler/i.test(String(o.tamanho || "") + " " + String(o.pacote || ""));
  if (String(o.tamanho || "").trim() && !t.tamanho && !peler) aviso.push(`tamanho “${o.tamanho}” não reconhecido`);
  if (String(o.pacote || "").trim() && !lerPacote(o.pacote).length) aviso.push(`pacote: kit “${o.pacote}” não está nos kits deste colégio`);
  const d = {
    __falta: falta,
    __aviso: aviso,
    instId: ext.instId || "",
    instNome: ext.instNome || "",
    respEmail: ext.respEmail || "", // quem fechou o contrato do colégio (cada um vê os seus)
    ano: Number(ext.ano) || new Date().getFullYear(),
    serie:
      String(o.serie || "")
        .trim()
        .replace(/°/g, "º") || serieDaTurma(o.turma),
    turma: String(o.turma == null ? "" : o.turma).trim(),
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
  if (peler) Object.assign(d, { becaTipo: "pelerineAzul", tamanho: "", menosLonga: false });
  return d;
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
      // (17/11/2026) primeiro o tipo (particular, público, faculdade e curso), depois a instituição daquele tipo
      const sTipo = sel(TIPOS_FILTRO, "", "todas (particular, público…)");
      sTipo.setAttribute("aria-label", "Tipo de instituição");
      sTipo.addEventListener("change", () => {
        const v = sInst.value;
        const lista = insts.filter(i => !sTipo.value || cartaoDoTipo(i.tipo || "") === sTipo.value);
        const vazio = el("option", null, "escolha a instituição");
        vazio.value = "";
        sInst.replaceChildren(
          vazio,
          ...lista.map(i => {
            const o = el("option", null, title(i.nome));
            o.value = i.id;
            return o;
          })
        );
        sInst.value = lista.some(i => i.id === v) ? v : "";
        if (sInst.value !== v) sInst.dispatchEvent(new Event("change", { bubbles: true }));
      });
      const ano = el("input");
      ano.inputMode = "numeric";
      ano.value = String(new Date().getFullYear());
      const r = el("div", "row3");
      r.append(field("Tipo", sTipo), field("Instituição", sInst), field("Ano", ano));
      // tamanho sem "adulto" ou "infantil" na célula fica com esta beca
      const sIdade = sel(
        [
          ["adulto", "Adulto (tradicional preta)"],
          ["infantil", "Infantil (preta)"]
        ],
        "adulto"
      );
      r.append(field("Beca de quem não tem escrito na planilha", sIdade));
      // os KITS deste colégio (17/11/2026): cada kit com o que leva e o valor total (Kit 1 = beca, Kit 2 = beca +
      // certificado…); na planilha, a coluna Kit diz qual é o de cada aluno. Vão para o Contrato do colégio.
      // O preço por item ficou guardado em "Preço por item", para quem ainda vende avulso.
      let contrato = null,
        kitsEd = null;
      const kitsBox = el("div");
      const prBox = el("div", "row2");
      const prIn = ITENS_PACOTE.map(([k, n]) => {
        const i = el("input");
        i.inputMode = "decimal";
        i.placeholder = "0,00";
        prBox.append(field("Preço " + n, i));
        i.addEventListener("input", () => kitsEd && kitsEd.atualizarSomas());
        return [k, i];
      });
      const lerValor = v =>
        Number(
          String(v || "")
            .replace(/\./g, "")
            .replace(",", ".")
        ) || 0;
      const montarKits = async () => {
        const { editorKits } = await import("./contrato-kits.js");
        kitsEd = editorKits(contrato || {}, true, {
          semComissao: true,
          precos: () => Object.fromEntries(prIn.map(([k, inp]) => [k, lerValor(inp.value)]))
        });
        kitsBox.replaceChildren(kitsEd.box);
      };
      const carregarPrecos = async () => {
        contrato = null;
        const i = insts.find(x => x.id === sInst.value);
        if (i && ano.value) {
          try {
            const s = await C.FS.getDoc(C.FS.doc(C.db, "contratosColegio", `${i.id}_${Number(ano.value)}`));
            contrato = s.exists() ? s.data() : null;
          } catch (_) {}
        }
        const pr = (contrato && contrato.precos) || {};
        prIn.forEach(([k, inp]) => (inp.value = Number(pr[k]) ? String(pr[k]).replace(".", ",") : ""));
        await montarKits();
      };
      sInst.addEventListener("change", carregarPrecos);
      ano.addEventListener("change", carregarPrecos);
      montarKits();
      const prTit = el(
        "p",
        "hint",
        "Kits deste colégio: o que cada kit leva e o valor total. Na planilha, a coluna Kit diz o de cada aluno (vazia = o Kit 1 da turma)."
      );
      // as duas frentes: preço de cada item (para vender avulso e para somar e formar os kits) e os kits
      const avulso = el("div");
      avulso.append(
        el("b", null, "Preço de cada item (avulso)"),
        el("p", "hint", "Aluno com itens soltos paga a soma deles; aluno com os itens de um kit paga o preço do kit."),
        prBox
      );
      const hist = el("details", "notes");
      hist.append(el("summary", null, "Importações anteriores (desfazer)"));
      const hb = el("div");
      hist.append(hb);
      hist.addEventListener("toggle", () => hist.open && ultimasImportacoes(C, "aluguel", hb));
      box.append(r, avulso, prTit, kitsBox, hist);
      return () => {
        const i = insts.find(x => x.id === sInst.value);
        return {
          instId: i ? i.id : "",
          instNome: i ? i.nome : "",
          inst: i || null,
          idade: sIdade.value,
          precos: Object.fromEntries(prIn.map(([k, inp]) => [k, lerValor(inp.value)])),
          kits: kitsEd ? kitsEd.ler().kits : [],
          contrato: Object.assign({}, contrato || {}, {
            precos: Object.fromEntries(prIn.map(([k, inp]) => [k, lerValor(inp.value)])),
            kits: kitsEd ? kitsEd.ler().kits : (contrato && contrato.kits) || []
          }),
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
  const temKits = (ext.kits || []).length > 0;
  if (!ext.instId || ((!ext.precos || !Object.values(ext.precos).some(v => v > 0)) && !temKits)) return;
  const { FS, db } = C;
  const ref = FS.doc(db, "contratosColegio", idContrato(ext.instId, Number(ext.ano)));
  const agora = new Date().toISOString();
  const reg = o => ({ o, em: agora, por: C.me || C.email || "" });
  const s = await FS.getDoc(ref);
  if (s.exists()) {
    const x = s.data();
    const mudouPreco = JSON.stringify(x.precos || {}) !== JSON.stringify(ext.precos || {});
    const mudouKits = temKits && JSON.stringify(x.kits || []) !== JSON.stringify(ext.kits);
    if (!mudouPreco && !mudouKits) return;
    await FS.updateDoc(ref, {
      ...(mudouPreco ? { precos: ext.precos } : {}),
      ...(mudouKits ? { kits: ext.kits } : {}),
      atualizadoEm: agora,
      historico: [...(x.historico || []), reg((mudouKits ? "kits" : "preços dos itens") + " na importação da planilha")].slice(-40)
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
    precos: ext.precos || {},
    kits: ext.kits || [],
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
