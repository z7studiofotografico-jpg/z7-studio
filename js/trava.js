// (19/11/2026) Trava por inatividade no celular: o app é usado na rua, então depois de 1 hora sem uso ele trava e
// pede a digital (ou o rosto, o que o celular tiver) ou a senha do app para voltar. Os dados ficam escondidos atrás
// da trava; o login continua o mesmo (não precisa entrar de novo do zero).
// A digital fica só neste aparelho: o celular confere e o app só recebe "confirmou" (nenhuma digital sai do aparelho).
// o = { email(), verificarSenha(senha) → Promise, sair() }
const UMA_HORA = 60 * 60 * 1000;
const CHAVE_USO = "z7ultimoUso";
const chaveDigital = em => "z7digital_" + String(em || "").toLowerCase();

export const ehCelular = (nav = navigator) =>
  /Android|iPhone|iPad|iPod|Mobile/i.test(nav.userAgent || "") || (nav.maxTouchPoints > 1 && /Macintosh/.test(nav.userAgent || ""));
// passou do tempo? (ultimo = quando usou por último, em ms)
export const venceu = (ultimo, agora, limite = UMA_HORA) => !!ultimo && agora - ultimo >= limite;

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
const limite = () => Number(window.__z7InatividadeMs) || UMA_HORA; // (os testes encurtam o tempo)
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
  ["pointerdown", "keydown", "touchstart", "scroll"].forEach(t => addEventListener(t, marcarUso, { passive: true, capture: true }));
  // voltou para o app (estava em outra tela ou com a tela apagada): confere antes de mostrar
  document.addEventListener("visibilitychange", () => (document.hidden ? null : conferir()));
  addEventListener("pageshow", conferir);
  setInterval(conferir, 30000);
  conferir();
}
// ao entrar com a senha na tela de login, começa a contar de novo
export const entrou = () => gravar(CHAVE_USO, String(Date.now()));

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

function travar() {
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
    <p class="hint">Ficou mais de 1 hora sem uso. Para continuar, confirme que é você.</p>
    <button type="button" class="btn btn-primary" id="travaDigital" hidden>👆 Entrar com a digital</button>
    <form id="travaForm" autocomplete="on">
      <input type="email" name="username" autocomplete="username" hidden>
      <label class="field"><span>Senha do app</span><input type="password" id="travaSenha" autocomplete="current-password" required></label>
      <p class="err" id="travaErr" hidden></p>
      <button type="submit" class="btn btn-primary">Entrar com a senha</button>
    </form>
    <button type="button" class="btn btn-sm" id="travaSair">Sair do app</button>
  </div>`;
  document.body.append(t);
  t.querySelector("input[name=username]").value = em;
  const err = t.querySelector("#travaErr");
  const erro = txt => {
    err.textContent = txt;
    err.hidden = false;
  };
  const destravar = async () => {
    travado = false;
    t.remove();
    entrou();
    // primeira vez com a senha, num celular com digital: oferece usar a digital nas próximas
    if (!ler(chaveDigital(em)) && (await temDigital()) && confirm("Usar a digital (ou o rosto) para destravar nas próximas vezes?"))
      cadastrarDigital(em).catch(e => console.warn("[Z7] digital", e));
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
      if (await usarDigital(em)) destravar();
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
      destravar();
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
