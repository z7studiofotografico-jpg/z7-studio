// (19/11/2026) Trava por inatividade no celular: o app é usado na rua, então depois de 5 minutos sem uso ele trava e
// pede a digital (ou o rosto, o que o celular tiver) ou a senha do app para voltar. Os dados ficam escondidos atrás
// da trava; o login continua o mesmo (não precisa entrar de novo do zero).
// A digital fica só neste aparelho: o celular confere e o app só recebe "confirmou" (nenhuma digital sai do aparelho).
// o = { email(), verificarSenha(senha) → Promise, sair() }
const LIMITE = 5 * 60 * 1000; // 5 minutos sem uso (19/11/2026: era 1 hora, depois 20 minutos)
const CHAVE_USO = "z7ultimoUso";
const chaveDigital = em => "z7digital_" + String(em || "").toLowerCase();

export const ehCelular = (nav = navigator) =>
  /Android|iPhone|iPad|iPod|Mobile/i.test(nav.userAgent || "") || (nav.maxTouchPoints > 1 && /Macintosh/.test(nav.userAgent || ""));
// passou do tempo? (ultimo = quando usou por último, em ms)
export const venceu = (ultimo, agora, limite = LIMITE) => !!ultimo && agora - ultimo >= limite;

const ler = k => {
  try {
    return localStorage.getItem(k);
  } catch (_) {
    return null;
  }
};
const gravar = (k, v) => {
  try {
    if (v == null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch (_) {}
};
const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const deB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const aleatorio = n => crypto.getRandomValues(new Uint8Array(n));
const temDigital = async () => {
  try {
    return !!(window.PublicKeyCredential && (await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()));
  } catch (_) {
    return false;
  }
};

let travado = false,
  ligado = false,
  O = null;
const limite = () => Number(window.__z7InatividadeMs) || LIMITE; // (os testes encurtam o tempo)
const marcarUso = () => {
  if (!travado) gravar(CHAVE_USO, String(Date.now()));
};
function conferir() {
  if (travado || !O || !O.email()) return;
  if (venceu(Number(ler(CHAVE_USO)) || 0, Date.now(), limite())) travar();
  else if (!ler(CHAVE_USO)) marcarUso();
}

export function ligarTrava(o) {
  O = o;
  if (ligado || !(window.__z7TravaSempre || ehCelular())) return;
  ligado = true;
  // só toque e teclado contam como uso (19/11/2026: a rolagem também contava, e as listas que se atualizam sozinhas
  // rolavam a tela e "usavam" o app sem ninguém mexer, então ele nunca travava)
  ["pointerdown", "keydown", "touchstart"].forEach(t =>
    addEventListener(t, ev => ev.isTrusted !== false && marcarUso(), { passive: true, capture: true })
  );
  // voltou para o app (estava em outra tela ou com a tela apagada): confere antes de mostrar
  document.addEventListener("visibilitychange", () => (document.hidden ? null : conferir()));
  addEventListener("pageshow", conferir);
  setInterval(conferir, 30000);
  conferir();
}
// ao entrar com a senha na tela de login, começa a contar de novo
export const entrou = () => gravar(CHAVE_USO, String(Date.now()));
// Ajustes → 🔒 Travar agora (emprestar o celular, ou testar a digital)
export const travaLigada = () => ligado;
export const travarAgora = () => !travado && O && O.email() && travar(true);

async function usarDigital(em) {
  const id = ler(chaveDigital(em));
  if (!id) return false;
  await navigator.credentials.get({
    publicKey: {
      challenge: aleatorio(32),
      allowCredentials: [{ type: "public-key", id: deB64(id) }],
      userVerification: "required",
      timeout: 60000
    }
  });
  return true;
}
async function cadastrarDigital(em) {
  const c = await navigator.credentials.create({
    publicKey: {
      challenge: aleatorio(32),
      rp: { name: "Z7 Studio" },
      user: { id: new TextEncoder().encode(em), name: em, displayName: em },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 }
      ],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" },
      timeout: 60000,
      attestation: "none"
    }
  });
  gravar(chaveDigital(em), b64(c.rawId));
}

function travar(agora = false) {
  travado = true;
  const em = O.email();
  const t = document.createElement("div");
  t.id = "trava";
  t.className = "trava";
  t.setAttribute("role", "dialog");
  t.setAttribute("aria-modal", "true");
  t.innerHTML = `<div class="trava-box">
    <div class="trava-ico">🔒</div>
    <h2>App travado</h2>
    <p class="hint" id="travaMotivo"></p>
    <button type="button" class="btn btn-primary" id="travaDigital" hidden>👆 Entrar com a digital</button>
    <form id="travaForm" autocomplete="on">
      <input type="email" name="username" autocomplete="username" hidden>
      <label class="field"><span>Senha do app</span><input type="password" id="travaSenha" autocomplete="current-password" required></label>
      <p class="err" id="travaErr" hidden></p>
      <button type="submit" class="btn btn-primary">Entrar com a senha</button>
    </form>
    <button type="button" class="btn btn-sm" id="travaSair">Sair de vez (vai pedir e-mail e senha)</button>
  </div>`;
  document.body.append(t);
  t.querySelector("input[name=username]").value = em;
  t.querySelector("#travaMotivo").textContent =
    (agora ? "Travado por você." : "Ficou mais de 5 minutos sem uso.") + " Para continuar, confirme que é você.";
  const err = t.querySelector("#travaErr");
  const erro = txt => {
    err.textContent = txt;
    err.hidden = false;
  };
  let podeDigital = false;
  temDigital().then(ok => (podeDigital = ok));
  const fechar = () => {
    travado = false;
    t.remove();
    entrou();
  };
  // destravou: na primeira vez com a senha, num celular com digital, oferece usar a digital nas próximas
  // (o cadastro da digital precisa sair de um toque no botão, senão o celular recusa)
  const destravar = async comSenha => {
    if (!comSenha || ler(chaveDigital(em)) || !(podeDigital || (await temDigital()))) return fechar();
    const box = t.querySelector(".trava-box");
    box.innerHTML = `<div class="trava-ico">👆</div><h2>Usar a digital?</h2>
      <p class="hint">Nas próximas vezes, destrave com a digital (ou o rosto), sem digitar a senha.</p>
      <button type="button" class="btn btn-primary" id="travaSim">👆 Usar a digital</button>
      <p class="err" id="travaErr2" hidden></p>
      <button type="button" class="btn btn-sm" id="travaNao">Agora não</button>`;
    box.querySelector("#travaNao").onclick = fechar;
    box.querySelector("#travaSim").onclick = () =>
      cadastrarDigital(em)
        .then(fechar)
        .catch(e => {
          console.warn("[Z7] digital", e);
          const e2 = box.querySelector("#travaErr2");
          e2.textContent =
            "O celular não liberou a digital agora. Pode seguir com a senha e tentar de novo depois (Ajustes → Travar agora).";
          e2.hidden = false;
        });
  };
  const bD = t.querySelector("#travaDigital");
  if (ler(chaveDigital(em)))
    temDigital().then(ok => {
      bD.hidden = !ok;
      if (ok) bD.focus();
    });
  bD.onclick = async () => {
    err.hidden = true;
    try {
      if (await usarDigital(em)) destravar(false);
    } catch (e) {
      erro("A digital não foi confirmada. Tente de novo ou use a senha.");
    }
  };
  t.querySelector("#travaForm").onsubmit = async ev => {
    ev.preventDefault();
    err.hidden = true;
    const s = t.querySelector("#travaSenha").value;
    if (!s) return;
    try {
      await O.verificarSenha(s);
      destravar(true);
    } catch (e) {
      erro(
        e && /network/i.test(e.code || "")
          ? "Sem internet para conferir a senha. Tente de novo ou use a digital."
          : "Senha errada. Tente de novo."
      );
    }
  };
  t.querySelector("#travaSair").onclick = () => {
    travado = false;
    gravar(CHAVE_USO, null);
    O.sair();
  };
}
