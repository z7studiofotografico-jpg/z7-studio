// Catálogo único de produtos e insumos (Etapa 6), sem tela: usado pelo card "Produtos e estoque", pelo Aluguel,
// pelo PR e pela Formatura (e pelo site, no futuro). Cada produto fica em "produtos/<id>" no banco; o que não foi
// mudado vem deste padrão. Dinheiro em reais (2 casas), como no resto do app.
//   { id, nome, categoria: "venda" | "insumo", grupo, preco, precoMin, custo, produzidoPor: "estúdio" | "laboratório",
//     controla (true = tem estoque físico), unidade, ficha: [{ insumo, qtd }] (consumo por unidade vendida), minimo (avisar compra) }
const FOTOS = ["7x10", "10x15", "13x18", "15x20", "20x30", "21x29,7", "30x30", "30x40", "30x45", "50x70", "60x90", "60x120", "60x150"];
const GRANDE = t => ["50x70", "60x90", "60x120", "60x150"].includes(t);
// folha usada por foto (A4 serve até 21x29,7; maiores vão no A3 ou no laboratório)
const folhaDe = t => (GRANDE(t) ? null : ["30x30", "30x40", "30x45"].includes(t) ? "A3" : "A4");
const porFolha = { "7x10": 8, "10x15": 4, "13x18": 2, "15x20": 2, "20x30": 1, "21x29,7": 1, "30x30": 1, "30x40": 1, "30x45": 1 };
export const idFoto = t => "foto_" + t.replace(",", "_");

const PAPEIS = [
  ["glossy230", "Papel glossy brilhoso 230 g"],
  ["glossy160", "Papel glossy brilhoso 160 g"],
  ["glossyDupla220", "Papel glossy dupla face brilhoso 220 g"],
  ["fosco", "Papel fosco"],
  ["micro260semi", "Papel microporoso semi-brilhoso 260 g"],
  ["micro260", "Papel microporoso brilhoso 260 g"]
];
export const INSUMOS = [
  ...PAPEIS.flatMap(([k, n]) => ["A4", "A3"].map(f => ({ id: `papel_${k}_${f}`, nome: `${n} · ${f}`, grupo: "Papel", unidade: "folha" }))),
  { id: "plastificacao_303x426", nome: "Plastificação 125 mícrons · bolsa 303 x 426 mm (30x40)", grupo: "Plastificação", unidade: "bolsa" },
  { id: "tinta_corante", nome: "Tinta Epson corante", grupo: "Tinta", unidade: "ml" },
  { id: "tinta_pigmentada", nome: "Tinta Epson pigmentada", grupo: "Tinta", unidade: "ml" },
  { id: "tinta_sublimatica", nome: "Tinta Epson sublimática", grupo: "Tinta", unidade: "ml" }
].map(x => Object.assign({ categoria: "insumo", controla: true, custo: 0, minimo: 0 }, x));

// tinta estimada por foto (ml), por área: ajuste na ficha de cada produto
const tintaMl = t => {
  const [a, b] = t.replace(",", ".").split("x").map(Number);
  return Math.round(((a * b) / 600) * 0.6 * 100) / 100;
};
export const VENDA = [
  ...FOTOS.map(t => ({
    id: idFoto(t),
    nome: `Foto avulsa ${t} cm`,
    grupo: "Foto avulsa",
    tamanho: t,
    produzidoPor: GRANDE(t) ? "laboratório" : "estúdio",
    controla: false,
    ficha: folhaDe(t)
      ? [
          { insumo: `papel_glossy230_${folhaDe(t)}`, qtd: Math.round((1 / porFolha[t]) * 100) / 100 },
          { insumo: "tinta_corante", qtd: tintaMl(t) }
        ]
      : []
  })),
  {
    id: "diploma",
    nome: "Diploma ou certificado",
    grupo: "Diploma",
    produzidoPor: "estúdio",
    controla: false,
    ficha: [
      { insumo: "papel_micro260_A4", qtd: 1 },
      { insumo: "tinta_pigmentada", qtd: 1.5 }
    ]
  },
  {
    id: "kit_pr",
    nome: "Kit PR (quadro 30x40 com moldura preta, 2 porta-retratos e fotos digitais)",
    grupo: "Kit",
    produzidoPor: "estúdio",
    controla: false,
    ficha: [
      { insumo: "quadro_30x40", qtd: 1 },
      { insumo: "porta_retrato_10x15", qtd: 2 },
      { insumo: "papel_glossy230_A3", qtd: 1 },
      { insumo: "papel_glossy230_A4", qtd: 0.5 },
      { insumo: "plastificacao_303x426", qtd: 1 },
      { insumo: "tinta_corante", qtd: 4 }
    ]
  },
  {
    id: "paspatur",
    nome: "Paspatur",
    grupo: "Paspatur",
    produzidoPor: "estúdio",
    controla: true,
    ficha: [
      { insumo: "papel_glossy230_A4", qtd: 1 },
      { insumo: "tinta_corante", qtd: 1.5 }
    ]
  },
  { id: "canudo_personalizado", nome: "Canudo personalizado", grupo: "Canudo", produzidoPor: "estúdio", controla: true },
  { id: "canudo_camurca", nome: "Canudo camurça", grupo: "Canudo", produzidoPor: "estúdio", controla: true },
  { id: "quadro_30x40", nome: "Quadro 30x40 (moldura preta)", grupo: "Quadro", produzidoPor: "estúdio", controla: true },
  { id: "porta_retrato_10x15", nome: "Porta-retrato 10x15", grupo: "Porta-retrato", produzidoPor: "estúdio", controla: true },
  {
    id: "quadro_2pr",
    nome: "Quadro + 2 porta-retratos",
    grupo: "Kit",
    produzidoPor: "estúdio",
    controla: false,
    ficha: [
      { insumo: "quadro_30x40", qtd: 1 },
      { insumo: "porta_retrato_10x15", qtd: 2 },
      { insumo: "papel_glossy230_A3", qtd: 1 },
      { insumo: "papel_glossy230_A4", qtd: 0.5 },
      { insumo: "tinta_corante", qtd: 4 }
    ]
  }
].map(x => Object.assign({ categoria: "venda", preco: 0, precoMin: 0, custo: 0, minimo: 0, ficha: [] }, x));

export const PADRAO = [...VENDA, ...INSUMOS];
// Produtos do Aluguel de becas (item 3.4): o que aparece para incluir na venda
export const DO_ALUGUEL = [
  "paspatur",
  "foto_10x15",
  "foto_15x20",
  "foto_21x29_7",
  "foto_30x30",
  "foto_30x40",
  "diploma",
  "canudo_personalizado",
  "canudo_camurca",
  "quadro_2pr"
];

// junta o padrão com o que foi salvo no banco (o salvo vale); itens novos do banco também entram
export function montarCatalogo(salvos = {}) {
  const out = PADRAO.map(p => Object.assign({}, p, salvos[p.id] || {}, { id: p.id }));
  Object.entries(salvos).forEach(([id, x]) => {
    if (!out.some(p => p.id === id)) out.push(Object.assign({ categoria: "venda", ficha: [], controla: true }, x, { id }));
  });
  return out;
}
// estoque: disponível = físico − reservado (nunca negativo)
export const disponivel = p => Math.max(0, (Number(p.fisico) || 0) - (Number(p.reservado) || 0));
export const precisaComprar = p => p.controla && (Number(p.minimo) || 0) > 0 && disponivel(p) <= Number(p.minimo);
// custo real de uma unidade: custo do fornecedor + insumos da ficha
export function custoReal(p, cat) {
  const byId = Object.fromEntries(cat.map(x => [x.id, x]));
  const ins = (p.ficha || []).reduce((t, f) => t + (Number((byId[f.insumo] || {}).custo) || 0) * (Number(f.qtd) || 0), 0);
  return Math.round(((Number(p.custo) || 0) + ins) * 100) / 100;
}
export const margem = (p, cat) => {
  const c = custoReal(p, cat),
    v = Number(p.preco) || 0;
  return v ? Math.round(((v - c) / v) * 100) : null;
};
