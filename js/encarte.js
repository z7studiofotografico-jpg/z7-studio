// Encarte do Kit Paspatur pelo colégio do aluno (08/11/2026): colégio público → calendário; particular (e
// faculdade, curso) → foto da turma. Olha o tipo no cadastro de Instituições; colégio que não está lá: adivinha pelo
// nome (C.E., CIEP, Municipal, Estadual… = público). Na prévia dá para trocar.
import { chaveColegio } from "./historico-dados.js";
import { C, FS } from "./repasse-estado.js";

let tipos = null; // chave do colégio → tipo no cadastro
async function tiposDoCadastro() {
  if (tipos) return tipos;
  tipos = {};
  try {
    if (C.pode("colegios") || C.isAdmin)
      (await FS.getDocs(C.carteira("instituicoes", FS.limit(1000)))).forEach(d => {
        const k = chaveColegio(d.data().nome || "");
        if (k && d.data().tipo) tipos[k] = d.data().tipo;
      });
  } catch (_) {}
  return tipos;
}
const PUBLICO = /\b(c\s*e|e\s*m|e\s*e|ciep|cieps|ce|em|ee|cm|estadual|municipal|federal|publica|publico|faetec|cefet)\b/;
export const parecePublico = nome =>
  PUBLICO.test(
    String(nome || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[.\-/]/g, " ")
  );
export function encartePorTipo(tipo, nome) {
  if (tipo) return tipo === "publico" ? "calendario" : "turma";
  return parecePublico(nome) ? "calendario" : "turma";
}
export async function encarteDoColegio(escola) {
  const t = (await tiposDoCadastro())[chaveColegio(escola || "")];
  return encartePorTipo(t, escola);
}
