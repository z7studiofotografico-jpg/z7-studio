// Cópia de segurança (só admin): baixa TODOS os dados do app num arquivo .json, no computador de quem clicou.
// Não sobe para nenhum lugar (o repositório do app é público, então a cópia não pode ficar no GitHub).
// Guarde o arquivo num lugar seguro: ele tem nomes e telefones de alunos (muitos menores de idade).
export const COLECOES = [
  "agenda",
  "becas",
  "config",
  "emails",
  "ensaios",
  "erros",
  "fones",
  "formandos",
  "ids",
  "instituicoes",
  "leads",
  "numeros",
  "pedidos",
  "privado",
  "repasse",
  "resumos",
  "usuarios",
  // módulos novos (Etapas 3 a 6)
  "alugueis",
  "estoque",
  "movEstoque",
  "produtos",
  "exclusoes",
  "edicoes",
  "importacoes",
  "contratos",
  "respostas",
  "paspatur",
  "formaturaAlunos",
  // (19/11/2026) coleções que faltavam na cópia ("tokens" fica de fora de propósito: são os avisos dos aparelhos)
  "atividades",
  "becasUso",
  "contratosColegio",
  "fichas",
  "fichasPedidos",
  "previasSite",
  "historico",
  "pastasFotos",
  // (28/11/2026) as medidas que o cliente manda pela página medidas.html
  "medidasBeca"
];
// subcoleções: os pagamentos de cada contrato do colégio (Aluguel de becas) ficam dentro do contrato
export const SUBCOLECOES = { contratosColegio: ["pagamentos"] };
// C = contexto do app (FS, db); aoAndar(texto) mostra o andamento
export async function baixarCopia(C, aoAndar = () => {}) {
  const { FS, db } = C;
  const dados = { criadoEm: new Date().toISOString(), por: C.email || "", colecoes: {} };
  let total = 0;
  for (const nome of COLECOES) {
    aoAndar(`Lendo ${nome}…`);
    try {
      const s = await FS.getDocs(FS.collection(db, nome));
      dados.colecoes[nome] = Object.fromEntries(s.docs.map(d => [d.id, d.data()]));
      total += s.size;
      for (const sub of SUBCOLECOES[nome] || []) {
        const chave = `${nome}/*/${sub}`;
        dados.colecoes[chave] = {};
        for (const d of s.docs) {
          const ss = await FS.getDocs(FS.collection(db, nome, d.id, sub));
          ss.docs.forEach(x => (dados.colecoes[chave][`${d.id}/${x.id}`] = x.data()));
          total += ss.size;
        }
      }
    } catch (e) {
      dados.colecoes[nome] = { __erro: String((e && e.code) || e) };
    }
  }
  const blob = new Blob([JSON.stringify(dados)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `z7-copia-de-seguranca-${dados.criadoEm.slice(0, 16).replace(/[:T]/g, "-")}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  aoAndar(`Cópia baixada: ${total} registros (${Math.round(blob.size / 1024)} KB). Guarde o arquivo num lugar seguro.`);
  return { total, bytes: blob.size };
}
