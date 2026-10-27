// "Ver o app como a equipe" (só admin): mostra o app como uma pessoa da equipe vê, sem gravar nada.
// A escolha fica só nesta aba (sessionStorage); "Sair" volta ao normal. O app.js aplica (perfil e bloqueio de gravação).
import { mkBtn, toast } from "./util.js";
export function lerVerComo() {
  try {
    return JSON.parse(sessionStorage.getItem("z7verComo") || "null");
  } catch (_) {
    return null;
  }
}
// ---------- Ver como a equipe (só admin) ----------
// Mostra o app como uma pessoa da equipe vê (os mesmos cards, filtros e telas), sem gravar nada.
// Fica guardado só nesta aba (sessionStorage); "Sair" volta ao normal.
const PESSOA_TESTE = { email: "teste-de-app@z7.local", nome: "Teste de App", ativo: true, papel: "equipe" };
export function entrarVerComo(pessoa) {
  try {
    sessionStorage.setItem("z7verComo", JSON.stringify(pessoa));
  } catch (_) {
    return toast("Este navegador não deixou guardar a visualização.");
  }
  history.replaceState(null, "", "#home"); // sem criar entrada nova no histórico (o voltar continua certo)
  location.reload();
}
export function sairVerComo() {
  try {
    sessionStorage.removeItem("z7verComo");
  } catch (_) {}
  history.replaceState(null, "", "#home");
  location.reload();
}
export function faixaVerComo(verComo) {
  if (!verComo || document.getElementById("faixaVerComo")) return;
  const f = document.createElement("div");
  f.id = "faixaVerComo";
  f.className = "notice";
  f.setAttribute("role", "status");
  const t = document.createElement("span");
  t.textContent = `👁 Vendo o app como ${verComo.nome} (equipe). Só visualização: nada é gravado.`;
  f.append(t, mkBtn("Sair", "btn-sm", sairVerComo));
  document.body.prepend(f);
}
// usuarios = cadastros (e-mail → dados); isDono(e-mail); MODULOS = [[chave, nome]]
export function escolherVerComo(usuarios, isDono, MODULOS) {
  const lista = Object.entries(usuarios)
    .filter(([em, u]) => u.ativo !== false && u.papel !== "admin" && !isDono(em) && Array.isArray(u.modulos) && u.modulos.length)
    .map(([em, u]) => Object.assign({ email: em }, u));
  const todos = Object.assign({}, PESSOA_TESTE, { modulos: MODULOS.map(m => m[0]) });
  const sh = document.createElement("div"),
    p = document.createElement("div");
  sh.className = "sheet";
  p.className = "panel";
  sh.append(p);
  const h = document.createElement("h2");
  h.textContent = "Ver o app como a equipe";
  const dica = document.createElement("p");
  dica.className = "hint";
  dica.textContent = "Escolha quem. O app abre como essa pessoa vê (só visualização, nada é gravado).";
  p.append(h, dica);
  [todos, ...lista].forEach(u => {
    const b = mkBtn(
      `${u.nome}${u === todos ? " (todos os módulos da equipe)" : ""} · ${(u.modulos || []).map(k => (MODULOS.find(m => m[0] === k) || [k, k])[1]).join(", ")}`,
      "btn",
      () => entrarVerComo({ email: u.email, nome: u.nome, ativo: true, papel: "equipe", modulos: u.modulos })
    );
    b.style.display = "block";
    b.style.margin = "6px 0";
    b.style.textAlign = "left";
    p.append(b);
  });
  p.append(mkBtn("Cancelar", "btn", () => sh.remove()));
  sh.addEventListener("click", e => {
    if (e.target === sh) sh.remove();
  });
  document.body.append(sh);
}
