// (24/11/2026) Botões "🖨️ Gerar contrato": abre o contrato pronto numa aba nova, com o botão de imprimir/salvar em PDF.
// Colégio: Aluguel de becas → alunos do colégio. Avulso: card do aluguel em Aluguéis avulsos.
import * as U from "./util.js";
import { BECAS, nomeFaixa, nomeCapelo } from "./becas-estoque.js";
import { nomeItem, idContrato } from "./contrato-colegio-regras.js";
import { htmlContratoAluguel } from "./contrato-aluguel-doc.js";
import { htmlContratoAvulso } from "./contrato-avulso-doc.js";

// a logo do papel timbrado (endereço completo: a aba nova não tem endereço próprio)
const LOGO = () => location.origin + "/icons/icon-512.png";
const nomeBeca = k => (BECAS.find(([b]) => b === k) || [k, k])[1];

// a aba abre no toque (senão o navegador bloqueia) e recebe o contrato quando os dados chegam
function abrirAba(gerar, C) {
  const w = window.open("", "_blank");
  if (!w) return U.toast("O navegador bloqueou a aba nova. Libere os pop-ups do app e tente de novo.");
  w.document.write("<p style='font:16px Arial;padding:20px'>Montando o contrato…</p>");
  Promise.resolve()
    .then(gerar)
    .then(html => {
      w.document.open();
      w.document.write(html);
      w.document.close();
    })
    .catch(e => {
      w.close();
      C.handleErr(e);
    });
}

export function contratoColegio(C, inst, ano, alunos) {
  abrirAba(async () => {
    const id = idContrato(inst.id, ano);
    const [ct, ins] = await Promise.all([
      C.FS.getDoc(C.FS.doc(C.db, "contratosColegio", id)),
      C.FS.getDoc(C.FS.doc(C.db, "instituicoes", inst.id))
    ]);
    let pags = [];
    try {
      pags = (await C.FS.getDocs(C.FS.collection(C.db, "contratosColegio", id, "pagamentos"))).docs.map(d => d.data());
    } catch (e) {
      pags = []; // a equipe pode não ver os pagamentos: o contrato sai sem as entradas
    }
    return htmlContratoAluguel({
      inst: Object.assign({}, inst, ins.exists() ? ins.data() : {}),
      contrato: ct.exists() ? ct.data() : {},
      alunos,
      pags,
      ano,
      hoje: U.todayStr(),
      logo: LOGO(),
      nomeBeca,
      nomeFaixa,
      nomeItem
    });
  }, C);
}

export const contratoAvulso = (C, x) =>
  abrirAba(() => htmlContratoAvulso({ x, logo: LOGO(), becas: BECAS, nomeFaixa, nomeCapelo, hoje: U.todayStr() }), C);

// os botões da faixa do colégio no Aluguel de becas (o contrato, a entrada e o contrato para imprimir)
export function botoesContratoColegio(C, inst0, doCol, abrirContratoCol, instId, ano) {
  const inst = Object.assign({ id: instId, nome: (doCol[0] || {}).instNome || "" }, inst0);
  return [
    U.mkBtn("📄 Contrato do colégio", "btn-primary btn-sm", () => abrirContratoCol(inst, doCol)),
    " ",
    U.mkBtn("💰 Lançar entrada / antecipação", "btn-sm btn-ok", () => abrirContratoCol(inst, doCol, { entrada: true })),
    " ",
    U.mkBtn("🖨️ Gerar contrato", "btn-sm", () => contratoColegio(C, inst, String(ano), doCol))
  ];
}
