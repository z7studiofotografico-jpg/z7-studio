// Criar a senha pelo convite, dentro do próprio app (app.z7studio.com.br/?mode=resetPassword&oobCode=…).
// O e-mail do Firebase leva para cá quando o "URL de ação" do modelo de e-mail aponta para o app;
// assim a pessoa nunca vê o endereço técnico do Firebase (z7-funil-e-repasse.firebaseapp.com).
// A = { auth, verifyPasswordResetCode, confirmPasswordReset, signInWithEmailAndPassword, signOut }
const $ = id => document.getElementById(id);
const limparEndereco = () => history.replaceState(null, "", location.pathname + "#home");

export async function telaCriarSenha(A) {
  const q = new URLSearchParams(location.search);
  const codigo = q.get("oobCode");
  if (q.get("mode") !== "resetPassword" || !codigo) return false;
  // alguém já entrou neste aparelho: sai, para a pessoa do convite criar a senha dela
  try {
    await A.signOut(A.auth);
  } catch (_) {}
  const login = $("formLogin");
  login.hidden = true;
  const f = document.createElement("form");
  f.id = "formSenha";
  f.innerHTML = `<img src="icons/icon-192.png" alt="">
    <h1>Z7 Studio</h1>
    <p id="sTxt">Conferindo o convite…</p>
    <div class="field" hidden><label for="sSenha">Nova senha (mínimo 6 letras ou números)</label><input id="sSenha" type="password" autocomplete="new-password" minlength="6" required></div>
    <div class="field" hidden><label for="sSenha2">Repita a senha</label><input id="sSenha2" type="password" autocomplete="new-password" minlength="6" required></div>
    <p class="err" id="sErr" hidden></p>
    <button class="btn btn-primary" type="submit" id="sBtn" style="justify-content:center" hidden>Criar senha e entrar</button>`;
  login.after(f);
  const erro = t => {
    $("sErr").textContent = t;
    $("sErr").hidden = false;
  };
  const voltar = () => {
    f.remove();
    login.hidden = false;
    limparEndereco();
  };
  let email = "";
  try {
    email = await A.verifyPasswordResetCode(A.auth, codigo);
  } catch (_) {
    $("sTxt").textContent =
      "Este link já foi usado ou venceu (vale 1 hora). Peça um novo convite ao administrador, ou toque em “Esqueci a senha”.";
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn";
    b.textContent = "Voltar para o login";
    b.onclick = voltar;
    f.append(b);
    return true;
  }
  $("sTxt").textContent = `Olá! Crie a sua senha para entrar no app com ${email}.`;
  f.querySelectorAll(".field, #sBtn").forEach(x => (x.hidden = false));
  setTimeout(() => $("sSenha").focus(), 30);
  f.addEventListener("submit", async ev => {
    ev.preventDefault();
    const s = $("sSenha").value;
    if (s !== $("sSenha2").value) return erro("As duas senhas estão diferentes.");
    $("sBtn").disabled = true;
    try {
      await A.confirmPasswordReset(A.auth, codigo, s);
      limparEndereco();
      await A.signInWithEmailAndPassword(A.auth, email, s);
      f.remove();
      login.hidden = false;
    } catch (e) {
      $("sBtn").disabled = false;
      erro(
        /weak-password/.test((e && e.code) || "")
          ? "Senha fraca: use pelo menos 6 letras ou números."
          : "Não deu certo. O link pode ter vencido: peça um novo convite."
      );
    }
  });
  return true;
}
