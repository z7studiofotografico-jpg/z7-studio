// Equipe: cadastro das pessoas, papel e módulos de cada uma (só administradores).
// Antes ficava dentro do index.html.
let D;
const $ = id => document.getElementById(id);
// D = { db, auth, updateDoc, doc, setDoc, sendPasswordResetEmail, createUserWithEmailAndPassword, signOut, cadastroAuth,
//       mkBtn, toast, handleErr, first, isDono, MODULOS, usuarios(), user(), isAdmin() }
export function init(deps){
  D = deps; ligar();
}
export function aberta(){ return !$("sheetTeam").hidden; }
export function fechar(){ $("sheetTeam").hidden = true; }
export function render(){
  const box = $("uList"); box.innerHTML = "";
  const rows = Object.entries(D.usuarios()).sort((a, b) => (a[1].nome || "").localeCompare(b[1].nome || "", "pt-BR"));
  if (!rows.length) { const p = document.createElement("p"); p.className = "hint"; p.textContent = "Ninguém cadastrado ainda."; box.appendChild(p); }
  rows.forEach(([em, u]) => {
    const r = document.createElement("div"); r.className = "urow" + (u.ativo === false ? " off" : "");
    const info = document.createElement("div"); info.className = "u";
    const b = document.createElement("b"); b.textContent = u.nome || em;
    const s = document.createElement("small"); s.textContent = em;
    info.append(b, s);
    const pill = document.createElement("span"); pill.className = "pill" + (u.papel === "admin" ? " admin" : ""); pill.textContent = u.ativo === false ? "Desativado" : u.papel === "admin" ? "Administrador" : "Equipe";
    const acts = document.createElement("div"); acts.className = "quick";
    if (D.isDono(em)) pill.textContent = "Dono";
    if (!D.isDono(em) && em !== (D.user().email || "").toLowerCase()) {
      acts.appendChild(D.mkBtn(u.papel === "admin" ? "Tornar equipe" : "Tornar admin", "", () => updUser(em, { papel: u.papel === "admin" ? "equipe" : "admin" })));
      acts.appendChild(D.mkBtn(u.ativo === false ? "Reativar" : "Desativar", u.ativo === false ? "btn-ok" : "btn-danger", () => updUser(em, { ativo: u.ativo === false })));
    }
    if (u.ativo !== false) acts.appendChild(D.mkBtn("Reenviar convite", "", async () => { try { await D.sendPasswordResetEmail(D.auth, em); D.toast("Convite enviado para " + em); } catch (_) { D.toast("Não foi possível enviar o e-mail."); } }));
    const head = document.createElement("div"); head.style.cssText = "display:flex;gap:8px;align-items:center;min-width:0"; head.append(info, pill);
    r.append(head);
    if (!D.isDono(em) && u.papel !== "admin" && u.ativo !== false) {
      const mods = document.createElement("div"); mods.className = "quick";
      const atuais = Array.isArray(u.modulos) ? u.modulos : []; // sem módulos marcados = sem acesso
      D.MODULOS.forEach(([k, lbl]) => {
        const l = document.createElement("label"); l.className = "chk"; const c = document.createElement("input"); c.type = "checkbox"; c.checked = atuais.includes(k);
        c.onchange = () => { const novo = D.MODULOS.map(m => m[0]).filter(x => x === k ? c.checked : atuais.includes(x)); updUser(em, { modulos: novo }); };
        l.append(c, document.createTextNode(" " + lbl)); mods.append(l);
      });
      r.append(mods);
    }
    r.append(acts); box.appendChild(r);
  });
}
async function updUser(em, patch){ try { await D.updateDoc(D.doc(D.db, "usuarios", em), patch); D.toast("Equipe atualizada"); } catch (e) { D.handleErr(e); } }
function paintModsForm(){
  const box = $("uMods"); if (!box.childElementCount) D.MODULOS.forEach(([k, lbl]) => {
    const l = document.createElement("label"); l.className = "chk"; const c = document.createElement("input"); c.type = "checkbox"; c.value = k; c.checked = k !== "rep" && k !== "funil";
    l.append(c, document.createTextNode(" " + lbl)); box.append(l);
  });
  $("uModsBox").hidden = $("uPapel").value !== "equipe";
}
function ligar(){
$("uPapel").addEventListener("change", paintModsForm);
$("btnTeam").onclick = () => { render(); paintModsForm(); $("uErr").hidden = true; $("sheetTeam").hidden = false; };
$("uClose").onclick = () => { $("sheetTeam").hidden = true; };
$("sheetTeam").addEventListener("click", e => { if (e.target === $("sheetTeam")) $("sheetTeam").hidden = true; });
$("formUser").addEventListener("submit", async e => {
  e.preventDefault(); if (!D.isAdmin()) return;
  const nome = $("uNome").value.trim(), em = $("uEmail").value.trim().toLowerCase(), papel = $("uPapel").value;
  const err = $("uErr"); err.hidden = true;
  if (!nome || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { err.textContent = "Preencha o nome e um e-mail válido."; err.hidden = false; return; }
  $("uSave").disabled = true;
  try {
    // 1) cria o login (com uma senha aleatória que ninguém conhece)
    try {
      const rnd = crypto.getRandomValues(new Uint32Array(4)).join("-") + "Aa!";
      const a = D.cadastroAuth(); await D.createUserWithEmailAndPassword(a, em, rnd); await D.signOut(a);
    } catch (ce) { if (ce.code !== "auth/email-already-in-use") throw ce; }
    // 2) dá acesso ao app
    const dados = { nome, papel, ativo: true, criadoEm: new Date().toISOString(), criadoPor: D.user().email || "" };
    if (papel === "equipe") dados.modulos = [...$("uMods").querySelectorAll("input:checked")].map(c => c.value);
    await D.setDoc(D.doc(D.db, "usuarios", em), dados);
    // 3) manda o e-mail para a pessoa criar a própria senha
    await D.sendPasswordResetEmail(D.auth, em);
    $("uNome").value = ""; $("uEmail").value = ""; $("uPapel").value = "equipe";
    D.toast("Pronto! " + D.first(nome) + " vai receber um e-mail para criar a senha.");
  } catch (ex) {
    err.textContent = ex.code === "permission-denied" ? "Só administradores cadastram pessoas." : ex.code === "auth/invalid-email" ? "E-mail inválido." : "Não foi possível cadastrar. Tente de novo.";
    err.hidden = false; console.warn(ex);
  } finally { $("uSave").disabled = false; }
});
}
