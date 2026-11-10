// Erros do app: separa "sem internet" de defeito de verdade e guarda os defeitos em "erros" (só admin lê),
// para chegarem até quem cuida do app em vez de virarem "verifique a internet".
import { el } from "./ui.js";

let ctx = null,
  enviados = 0;
const MAX_POR_SESSAO = 5;

export function ligarErros(c) {
  ctx = c;
  addEventListener("error", ev => {
    const e = ev.error || ev.message;
    if (ehVersaoMisturada(e)) return recarregarNovo();
    reportarErro("janela", e);
  });
  addEventListener("unhandledrejection", ev => {
    if (ehVersaoMisturada(ev.reason)) return recarregarNovo();
    if (!ehDeRede(ev.reason)) reportarErro("promessa", ev.reason);
  });
}

// Partes do app de versões diferentes (ex.: com sinal fraco, um arquivo veio da cópia guardada e outro, já
// atualizado, da internet): "does not provide an export named …". Não é defeito: basta abrir tudo de novo.
export function ehVersaoMisturada(e) {
  const t = String((e && e.message) || e || "");
  return /does not provide an export named|doesn't provide an export named|import not found|Importing binding name/i.test(t);
}
// Limite gratuito do banco (Firebase) do dia acabou: volta sozinho no dia seguinte
export function ehCota(e) {
  const t = String((e && (e.code || "")) || "") + " " + String((e && e.message) || e || "");
  return /resource-exhausted|quota exceeded/i.test(t);
}
// Apaga a cópia guardada do app e abre de novo, uma vez por sessão (se não resolver, o erro aparece normal)
export function recarregarNovo() {
  try {
    if (sessionStorage.getItem("z7recarregou")) return false;
    sessionStorage.setItem("z7recarregou", "1");
  } catch (_) {
    return false;
  }
  const abrir = () => location.reload();
  if (typeof caches !== "undefined")
    caches
      .keys()
      .then(ks => Promise.all(ks.filter(k => k === "z7-app").map(k => caches.delete(k))))
      .then(abrir, abrir);
  else abrir();
  return true;
}

// Falta de internet (ou o Firebase fora do ar) × defeito no app
export function ehDeRede(e) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const t = String((e && (e.code || e.name)) || "") + " " + String((e && e.message) || e || "");
  return /unavailable|network|Failed to fetch|Load failed|fetch dynamically imported module|Importing a module script failed|deadline-exceeded/i.test(
    t
  );
}

// Texto curto e sem dados pessoais (só a mensagem e as 4 primeiras linhas da pilha)
export function resumoErro(onde, e) {
  const msg = String((e && e.message) || e || "erro desconhecido").slice(0, 300);
  const pilha = String((e && e.stack) || "")
    .split("\n")
    .slice(0, 4)
    .join("\n")
    .slice(0, 800);
  return { onde: String(onde).slice(0, 60), msg, pilha };
}

export async function reportarErro(onde, e) {
  if (!ctx || !ctx.email || ehDeRede(e) || enviados >= MAX_POR_SESSAO) return;
  enviados++;
  try {
    const { FS, db } = ctx;
    await FS.addDoc(
      FS.collection(db, "erros"),
      Object.assign(resumoErro(onde, e), {
        email: ctx.email,
        tela: location.hash || "",
        app: navigator.userAgent.slice(0, 160),
        em: new Date().toISOString()
      })
    );
  } catch (_) {
    // guardar o erro é o melhor esforço: se falhar, não atrapalha quem está usando
  }
}

// Tela que não abriu: sem internet → pede para tentar de novo; defeito → mostra o erro e avisa que foi registrado
export function telaFalhou(view, onde, e) {
  console.warn(e);
  if (ehVersaoMisturada(e) && recarregarNovo()) {
    view.innerHTML = "";
    view.append(el("div", "empty", "Atualizando o app…"));
    return;
  }
  if (ehCota(e)) {
    view.innerHTML = "";
    const b = el("div", "empty");
    b.append(
      el("strong", null, "Limite do dia do banco de dados"),
      el(
        "span",
        null,
        "O app usou todo o limite gratuito de hoje do banco de dados (Firebase). Volta a funcionar sozinho de madrugada. Avise o Adriano."
      )
    );
    view.append(b);
    reportarErro(onde, e);
    return;
  }
  const rede = ehDeRede(e);
  if (!rede) reportarErro(onde, e);
  view.innerHTML = "";
  const box = el("div", "empty");
  box.append(
    el("strong", null, rede ? "Sem internet" : "Erro no app"),
    el(
      "span",
      null,
      rede
        ? "Não foi possível abrir. Verifique a internet e tente de novo."
        : `Isso não é a internet: é um erro no app, e ele já foi registrado para o Adriano ver. (${String((e && e.message) || e).slice(0, 120)})`
    )
  );
  view.append(box);
}
