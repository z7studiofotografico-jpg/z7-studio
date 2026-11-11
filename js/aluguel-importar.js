// Importar planilha do Aluguel de becas (independente do PR e da Formatura): um aluno por linha, da instituição e do
// ano escolhidos na tela. Colunas em qualquer ordem; o que faltar fica avisado ("Falta no cadastro").
import { el, field, sel, title } from "./ui.js";
import * as U from "./util.js";
import { abrirImportador, ultimasImportacoes } from "./importador.js";
import { BECAS, FAIXAS, CAPELOS, TAMANHOS } from "./becas-estoque.js";
import { lerPacote } from "./contrato-colegio-regras.js";

const achar = (lista, v) => {
  const k = U.chave(v);
  if (!k) return "";
  const x = lista.find(([id, nome]) => U.chave(nome) === k || U.chave(id) === k || U.chave(nome).startsWith(k));
  return x ? x[0] : "";
};
export const CAMPOS_ALUGUEL = [
  { k: "nome", nome: "Aluno", sinonimos: ["Nome", "Formando", "Nome do aluno"], obrigatorio: true },
  { k: "tel", nome: "WhatsApp", sinonimos: ["Telefone", "Celular", "Tel", "Telefone 1", "Celular 1"] },
  { k: "responsavel", nome: "Responsável", sinonimos: ["Reponsavel", "Mãe", "Pai"] },
  { k: "serie", nome: "Série", sinonimos: ["Turma", "Curso", "Ano escolar"] },
  { k: "tamanho", nome: "Tamanho", sinonimos: ["Tamanho da beca", "Beca"] },
  { k: "faixa", nome: "Faixa", sinonimos: ["Cor da faixa"] },
  { k: "capelo", nome: "Capelo", sinonimos: ["Cor do capelo"] },
  { k: "valor", nome: "Valor", sinonimos: ["Valor do aluguel", "Preço"] },
  { k: "pacote", nome: "Pacote", sinonimos: ["Itens", "Kit", "Produtos"] },
  { k: "unidade", nome: "Unidade", sinonimos: ["Unidade do colégio", "Filial"] },
  { k: "obs", nome: "Observação", sinonimos: ["Obs", "Observações"] }
];
// "P1" = P menos longa; "M" = M
export function lerTamanho(v) {
  const t = String(v || "")
    .toUpperCase()
    .replace(/\s/g, "");
  const m = t.match(/^(PPP|PP|P|M|G|GG|XG|XXG|EXG)(1)?$/);
  return m && TAMANHOS.some(([z]) => z === m[1]) ? { tamanho: m[1], menosLonga: !!m[2] } : { tamanho: "", menosLonga: false };
}
export function paraDocAluguel(o, ext) {
  const t = lerTamanho(o.tamanho);
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
    tel: U.digits(o.tel),
    responsavel: String(o.responsavel || "").trim(),
    becaTipo: "tradPreta",
    tamanho: t.tamanho,
    menosLonga: t.menosLonga,
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
    pacote: lerPacote(o.pacote),
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
      const hist = el("details", "notes");
      hist.append(el("summary", null, "Importações anteriores (desfazer)"));
      const hb = el("div");
      hist.append(hb);
      hist.addEventListener("toggle", () => hist.open && ultimasImportacoes(C, "aluguel", hb));
      box.append(r, hist);
      return () => {
        const i = insts.find(x => x.id === sInst.value);
        return {
          instId: i ? i.id : "",
          instNome: i ? i.nome : "",
          ano: ano.value,
          respEmail: (i && donos.get(`${i.id}|${Number(ano.value)}`)) || ""
        };
      };
    }
  });
}
export { BECAS };
