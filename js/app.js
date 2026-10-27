// App Z7 Studio: login, rotas entre as telas, cartões do Início, Ajustes e notificações.
// (Saiu de dentro do index.html para ter lint e ficar fácil de achar.)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  initializeAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  setPersistence,
  indexedDBLocalPersistence,
  inMemoryPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  doc,
  onSnapshot,
  updateDoc,
  setDoc,
  query,
  where,
  getCountFromServer
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import * as FS from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getMessaging, getToken, onMessage, isSupported } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js";
import { COMISSAO_PADRAO, FORMAS, taxa } from "./regras.js";
import { avisoErro, ligarCamposReais, formatarCampos } from "./ui.js";
import { todayStr, addDays, num, first, toast, showNotice, mkBtn } from "./util.js";
ligarCamposReais();
import * as Funil from "./funil.js";
import { ligarErros, telaFalhou } from "./erros.js";
import * as Equipe from "./equipe.js";
import { definirExtras as feriadosExtras, feriadosEntre } from "./feriados.js";

const $ = id => document.getElementById(id);
const CFG = self.Z7_CONFIG || {};
if (!CFG.firebase || !CFG.firebase.apiKey) {
  document.body.innerHTML =
    '<div class="login"><div class="empty"><strong>App ainda não configurado</strong><span>Falta preencher o arquivo config.js com os dados do Firebase.</span></div></div>';
  throw new Error("config.js vazio");
}

const app = initializeApp(CFG.firebase);
const auth = getAuth(app);
setPersistence(auth, indexedDBLocalPersistence).catch(e => console.warn("[Z7] login persistente", e));
const db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });

let user = null,
  unsub = [];
let P = { individual: 0, sinal: 0, g36: 0, g7: 0, fotos: 30, prazo: 15 };
let USERS = {}; // e-mail -> { nome, papel, ativo }
let me = "",
  isAdmin = false;
let swReg = null;
const DONOS = {};
(CFG.donos || []).forEach(d => {
  if (d && d.email) DONOS[d.email.toLowerCase()] = d.nome || "";
});
const isDono = em => Object.prototype.hasOwnProperty.call(DONOS, (em || "").toLowerCase());
// Segunda conexão, só para cadastrar pessoas sem deslogar quem está usando o app.
let secAuth = null;
function cadastroAuth() {
  if (!secAuth) secAuth = initializeAuth(initializeApp(CFG.firebase, "cadastro"), { persistence: inMemoryPersistence });
  return secAuth;
}

// ---------- utilidades ----------
const team = () =>
  Object.values(USERS)
    .filter(u => u.ativo !== false && u.nome)
    .map(u => u.nome)
    .sort((a, b) => a.localeCompare(b, "pt-BR"));

// ---------- quem está usando (vem do login) ----------
function renderMe() {
  $("btnMe").textContent = me ? "👤 " + first(me) : "";
  $("btnTeam").hidden = !isAdmin;
}
// Módulos do app. Administradores e donos veem tudo; a equipe vê só o que foi marcado no cadastro (sem módulos = sem acesso).
const MODULOS = [
  ["funil", "Funil de vendas"],
  ["lf", "PR · Linha de Frente"],
  ["rep", "PR · Repasse"],
  ["agenda", "Agendamento"],
  ["colegios", "Instituições"],
  ["formaturas", "Formaturas"],
  ["becas", "Aluguel de becas"]
];
function pode(m) {
  if (isAdmin) return true;
  if (m === "vendas") return false;
  const p = USERS[((user && user.email) || "").toLowerCase()];
  if (!p || p.ativo === false || !Array.isArray(p.modulos)) return false;
  if (m === "pr") return p.modulos.includes("lf") || p.modulos.includes("rep");
  // quem vende para colégios cuida das turmas e das datas deles no card Formaturas
  if (m === "formaturas") return p.modulos.includes("formaturas") || p.modulos.includes("colegios");
  return p.modulos.includes(m);
}
function applyProfile() {
  const em = ((user && user.email) || "").toLowerCase();
  const p = USERS[em];
  const prev = me;
  me = p && p.nome ? p.nome : isDono(em) ? DONOS[em] : "";
  isAdmin = isDono(em) || !!(p && p.papel === "admin" && p.ativo !== false);
  renderMe();
  if (me !== prev) refreshPushToken();
}

function handleErr(e) {
  console.warn("[Z7]", e);
  if (!navigator.onLine || (e && (e.code === "unavailable" || (e.code === "failed-precondition" && /offline/i.test(e.message || "")))))
    toast("Sem internet agora. Isso precisa de conexão: tente de novo quando voltar o sinal.");
  else if (e && e.code === "permission-denied") toast("Você não tem permissão para fazer isso. Fale com o Adriano.");
  else toast("Não salvou. Verifique a internet e tente de novo.");
}

// ---------- desenho da tela ----------

// ---------- ajustes ----------
// Campos de Ajustes: [id do campo, chave em config/app, tipo, padrão]. Um campo novo = uma linha aqui.
const AJUSTES = [
  ["pInd", "individual", "reais"],
  ["pSinal", "sinal", "reais"],
  ["pG36", "g36", "reais"],
  ["pG7", "g7", "reais"],
  ["pFotos", "fotos", "int", 30],
  ["pPrazo", "prazo", "int", 15],
  ["pLfLote", "lfAvisoDia", "int", 25],
  ["pLfParc", "lfParcelas", "int"],
  ["pLfPix", "lfPix", "reais"],
  ["pLfCartao", "lfCartao", "reais"],
  ["pKit", "kitPreco", "reais"],
  ["pKitPromo", "kitPromo", "reais"],
  ["pKitCartao", "kitCartao", "reais"],
  ["pKitFinal", "kitFinal", "reais"],
  ["pLote", "avisoDia", "int", 20],
  ["pParc", "parcelas", "int"],
  ["pLfNum", "lfNumero", "texto"],
  ["pRepNum", "repNumero", "texto"],
  ["pEntrega", "entrega", "texto"],
  ["pPix", "pix", "texto"],
  ["pPixLF", "pixLF", "texto"],
  ["pPixRep", "pixRep", "texto"],
  ["pPixFinal", "pixFinal", "texto"],
  ["pPixSinal", "pixSinal", "texto"],
  ["pLink", "linkCartao", "texto"],
  ["pLinkFinal", "linkCartaoFinal", "texto"],
  ["pLinkLF", "linkCartaoLF", "texto"],
  ["pAval", "linkAvaliacao", "texto"],
  ["pFeriados", "feriadosExtras", "texto"]
];
// Ajustes (só admin): os últimos erros do app registrados pelos aparelhos (defeitos, não falta de internet)
async function mostrarErros() {
  try {
    const s = await FS.getDocs(FS.query(collection(db, "erros"), FS.orderBy("em", "desc"), FS.limit(15)));
    $("pErros").hidden = !s.size;
    $("pErros").querySelector("summary").textContent = `⚠️ Erros do app (${s.size}${s.size === 15 ? "+" : ""})`;
    const box = $("pErrosLista");
    box.innerHTML = "";
    s.docs.forEach(d => {
      const x = d.data(),
        p = document.createElement("p");
      p.textContent = `${String(x.em || "")
        .slice(0, 16)
        .replace("T", " ")} · ${x.email} · ${x.tela || x.onde}: ${x.msg}`;
      box.append(p);
    });
  } catch (e) {
    console.warn("[Z7] erros", e);
  }
}
const lerAjuste = { reais: v => num(v), int: v => parseInt(String(v).replace(/\D/g, ""), 10) || 0, texto: v => String(v || "").trim() };
$("btnPrices").onclick = () => {
  AJUSTES.forEach(([id, k]) => {
    $(id).value = P[k] || "";
    $(id).disabled = !isAdmin;
  });
  $("pEquipes").value = String(P.equipesDia || 1);
  feriadosExtras(P.feriadosExtras);
  listarFeriados();
  montarComissao();
  formatarCampos($("sheetPrices"));
  $("pEquipes").disabled = !isAdmin;
  document.querySelectorAll("#comTab input").forEach(i => {
    i.disabled = !isAdmin;
  });
  $("pSave").hidden = !isAdmin;
  $("pricesHint").textContent = isAdmin
    ? "Os valores entram automaticamente nas mensagens prontas."
    : "Só administradores mudam os preços.";
  renderPushState();
  if (isAdmin) mostrarErros();
  $("sheetPrices").hidden = false;
};
// Tabela de comissão: PR e Formatura × forma de pagamento
const COM_FORMAS = FORMAS,
  COM_PADRAO = COMISSAO_PADRAO;
// Lista em Ajustes: todos os feriados deste ano e do próximo (nacionais, Carnaval, RJ, Nilópolis e os de "Outros feriados")
function listarFeriados() {
  const box = $("pFerDias");
  box.textContent = "";
  const y = new Date().getFullYear(),
    SEM = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
  [y, y + 1].forEach(ano => {
    const h = document.createElement("b");
    h.textContent = String(ano);
    h.style.display = "block";
    h.style.marginTop = "8px";
    box.append(h);
    feriadosEntre(`${ano}-01-01`, `${ano}-12-31`).forEach(f => {
      const [a, m, d] = f.data.split("-");
      const l = document.createElement("div");
      l.textContent = `${d}/${m} (${SEM[new Date(+a, m - 1, +d).getDay()]}) · ${f.nome}`;
      box.append(l);
    });
  });
}
$("pFeriados").addEventListener("input", () => {
  feriadosExtras($("pFeriados").value);
  listarFeriados();
});
function montarComissao() {
  const t = $("comTab");
  t.innerHTML = "";
  const cfg = P.comissao || {};
  ["", "PR", "Álbum de formatura"].forEach(h => {
    const s = document.createElement("span");
    s.className = "th";
    s.textContent = h;
    t.appendChild(s);
  });
  COM_FORMAS.forEach(f => {
    const s = document.createElement("span");
    s.textContent = f;
    t.appendChild(s);
    ["pr", "form"].forEach(l => {
      const i = document.createElement("input");
      i.inputMode = "decimal";
      i.dataset.pct = "1";
      i.dataset.l = l;
      i.dataset.f = f;
      i.setAttribute("aria-label", `Comissão ${l === "pr" ? "PR" : "Álbum de formatura"} no ${f}`);
      const v = cfg[l] && cfg[l][f];
      i.value = String(v != null && v !== "" ? v : COM_PADRAO[l][f]).replace(".", ",");
      t.appendChild(i);
    });
  });
  const s = document.createElement("span");
  s.textContent = "🎓 Adesão · Kit 01 (por parcela paga)";
  s.style.gridColumn = "1 / 3";
  t.appendChild(s);
  const ic = document.createElement("input");
  ic.inputMode = "decimal";
  ic.dataset.pct = "1";
  ic.id = "comAdesao";
  ic.setAttribute("aria-label", "Comissão da adesão (Kit 01)");
  ic.value = String(taxa({ comissao: cfg }, "adesao")).replace(".", ",");
  t.appendChild(ic);
}
function lerComissao() {
  const o = { pr: {}, form: {} };
  document.querySelectorAll("#comTab input[data-l]").forEach(i => {
    o[i.dataset.l][i.dataset.f] = num(i.value);
  });
  o.adesao = num($("comAdesao").value);
  return o;
}
$("pCancel").onclick = () => {
  $("sheetPrices").hidden = true;
};
$("pSair").onclick = async () => {
  $("sheetPrices").hidden = true;
  await signOut(auth);
};
$("pPush").onclick = () => enablePush(true);
$("formPrices").addEventListener("submit", async e => {
  e.preventDefault();
  if (!isAdmin) return;
  const body = Object.fromEntries(AJUSTES.map(([id, k, t, padrao]) => [k, lerAjuste[t]($(id).value) || padrao || lerAjuste[t]("")]));
  Object.assign(body, { equipesDia: Number($("pEquipes").value) || 1, comissao: lerComissao() });
  try {
    await setDoc(doc(db, "config", "app"), body, { merge: true });
    $("sheetPrices").hidden = true;
    toast("Preços salvos");
  } catch (err) {
    handleErr(err);
  }
});

// ---------- notificações ----------
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
function pushSupported() {
  return "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
}
function renderPushState() {
  const el = $("pushState");
  if (isIOS && !standalone) {
    el.textContent = "No iPhone, primeiro adicione o app à Tela de Início e abra por lá. Só assim as notificações funcionam.";
    $("pPush").hidden = true;
    return;
  }
  if (!pushSupported()) {
    el.textContent = "Este navegador não recebe notificações.";
    $("pPush").hidden = true;
    return;
  }
  const p = Notification.permission;
  el.textContent =
    p === "granted"
      ? "Notificações ativadas neste aparelho."
      : p === "denied"
        ? "As notificações foram bloqueadas. Libere nas configurações do navegador ou do celular."
        : "Notificações desativadas neste aparelho.";
  $("pPush").hidden = p === "granted" || p === "denied";
}
function renderPushBanner() {
  $("pushBanner").hidden = !(pushSupported() && Notification.permission === "default" && (!isIOS || standalone));
}
async function enablePush(fromClick) {
  if (!pushSupported() || !swReg) return;
  try {
    if (!(await isSupported())) {
      if (fromClick) toast("Este aparelho não recebe notificações.");
      return;
    }
    const perm = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
    renderPushBanner();
    renderPushState();
    if (perm !== "granted") {
      if (fromClick) toast("Notificações não autorizadas");
      return;
    }
    const token = await getToken(getMessaging(app), { vapidKey: CFG.vapidKey, serviceWorkerRegistration: swReg });
    if (!token) return;
    await setDoc(doc(db, "tokens", token), {
      nome: me || "",
      email: user?.email || "",
      aparelho: navigator.userAgent.slice(0, 160),
      atualizadoEm: new Date().toISOString()
    });
    try {
      localStorage.setItem("z7token", token);
    } catch (_) {}
    if (fromClick) toast("Notificações ativadas ✅");
  } catch (e) {
    if (fromClick) toast("Não foi possível ativar as notificações.");
    console.warn(e);
  }
}
function refreshPushToken() {
  if (pushSupported() && Notification.permission === "granted") enablePush(false);
}
$("btnPush").onclick = () => enablePush(true);

// ---------- navegação entre módulos ----------
const VIEWS = {
  home: "viewHome",
  funil: "viewFunil",
  pr: "viewRepasse",
  repasse: "viewRepasse",
  agenda: "viewAgenda",
  vendas: "viewVendas",
  formaturas: "viewFormaturas",
  becas: "viewBecas",
  instituicoes: "viewInst",
  colegios: "viewInst",
  "inst-particular": "viewInstTipo",
  "inst-publico": "viewInstTipo",
  "inst-profissionalizante": "viewInstTipo",
  "inst-faculdade": "viewInstTipo"
};
const INST_NOMES = {
  "inst-particular": "Colégio particular",
  "inst-publico": "Colégio público",
  "inst-profissionalizante": "Colégio profissionalizante",
  "inst-faculdade": "Faculdade"
};
let repasseMod = null,
  instMod = null,
  agendaMod = null,
  vendasMod = null,
  formMod = null,
  becasMod = null,
  curView = "home";
const APROVADORES = (CFG.aprovadores || []).map(e => String(e).toLowerCase());
// Firestore com aviso de limite: toda consulta com limit(n) que voltar cheia avisa que a lista pode estar incompleta
// (antes os dados eram cortados em silêncio)
const limites = new WeakMap();
const FSv = Object.assign({}, FS, {
  limit(n) {
    const c = FS.limit(n);
    limites.set(c, n);
    return c;
  },
  query(q, ...cs) {
    const r = FS.query(q, ...cs);
    const n = cs.map(c => limites.get(c)).find(Boolean) || limites.get(q);
    if (n) limites.set(r, n);
    return r;
  },
  onSnapshot(q, ...a) {
    const ok = a[0];
    if (typeof ok === "function")
      a[0] = s => {
        confereLimite(q, s);
        ok(s);
      };
    return FS.onSnapshot(q, ...a);
  },
  async getDocs(q) {
    const s = await FS.getDocs(q);
    confereLimite(q, s);
    return s;
  }
});
function confereLimite(q, s) {
  const n = limites.get(q);
  if (!n || !s || s.size < n) return;
  console.warn("[Z7] consulta chegou ao limite de " + n, q);
  showNotice(`Uma das listas chegou ao limite de ${n} itens e pode estar incompleta. Use a busca ou os filtros, e avise o Adriano.`);
}
const ctx = {
  db,
  FS: FSv,
  $,
  handleErr,
  get me() {
    return me;
  },
  get isAdmin() {
    return isAdmin;
  },
  get aprovador() {
    return APROVADORES.includes(((user && user.email) || "").toLowerCase());
  },
  get user() {
    return user;
  },
  get P() {
    return P;
  },
  team,
  pode,
  get vendedores() {
    return Object.entries(USERS)
      .filter(([em, u]) => u.nome && u.ativo !== false && u.papel !== "admin" && !isDono(em))
      .map(([, u]) => u.nome);
  },
  get vendedoresEmails() {
    return Object.entries(USERS)
      .filter(([em, u]) => u.ativo !== false && u.papel !== "admin" && !isDono(em))
      .map(([em]) => em);
  },
  get email() {
    return ((user && user.email) || "").toLowerCase();
  },
  get usuarios() {
    return USERS;
  },
  // Nome do responsável sai do e-mail (que não muda); o nome gravado só vale para registros antigos
  nomeDe(x) {
    const em = x && x.respEmail;
    return (em && ((USERS[em] && USERS[em].nome) || DONOS[em])) || (x && x.resp) || "";
  },
  ehMeu(x) {
    return !!x && (x.respEmail ? x.respEmail === ctx.email : !!me && x.resp === me);
  },
  // Funil → Agenda: abre o ensaio já preenchido
  async abrirEnsaio(pre) {
    if (!agendaMod) {
      agendaMod = await import("./agenda.js");
      agendaMod.init(ctx);
    }
    agendaMod.openEnsaio(null, pre);
  },
  aoMudarLeads() {
    if (curView === "home") renderHome();
  },
  // Carteira: o admin consulta com os filtros pedidos; quem não é admin só pode ler os colégios livres e os seus
  // (formandos: só os seus). Nesse caso a consulta vai só pela carteira e quem chama filtra o resto na tela.
  carteira(nomeCol, ...filtros) {
    const c = collection(db, nomeCol);
    if (isAdmin) return FSv.query(c, ...filtros);
    return nomeCol === "formandos"
      ? FSv.query(c, where("respEmail", "==", ctx.email), FSv.limit(3000))
      : FSv.query(c, where("respEmail", "in", ["", ctx.email]), FSv.limit(3000));
  },
  goHome() {
    ir("#home");
  },
  ir(h) {
    ir(h);
  }
};
ligarErros(ctx);
Funil.init(ctx);
let usersLoaded = false;
async function route() {
  if (!user || !usersLoaded) return;
  const r = (location.hash || "").slice(1);
  let key = VIEWS[r] ? r : "home";
  const modDe = {
    vendas: "vendas",
    formaturas: "formaturas",
    becas: "becas",
    funil: "funil",
    pr: "pr",
    repasse: "pr",
    agenda: "agenda",
    colegios: "colegios",
    instituicoes: "colegios",
    "inst-particular": "colegios",
    "inst-publico": "colegios",
    "inst-profissionalizante": "colegios",
    "inst-faculdade": "colegios"
  };
  if (modDe[key] && !pode(modDe[key])) {
    key = "home";
    if (r) history.replaceState(history.state, "", "#home");
  }
  curView = key;
  hashAtual = location.hash;
  new Set(Object.values(VIEWS)).forEach(id => {
    $(id).hidden = true;
  });
  $(VIEWS[key]).hidden = false;
  $("btnBack").hidden = key === "home";
  $("btnBack").textContent = INST_NOMES[key] ? "‹ Instituições" : "‹ Início";
  if (agendaMod && key !== "agenda") agendaMod.hide();
  if (vendasMod && key !== "vendas") vendasMod.hide();
  if (formMod && key !== "formaturas") formMod.hide();
  if (becasMod && key !== "becas") becasMod.hide();
  if (key === "formaturas") {
    try {
      if (!formMod) {
        formMod = await import("./formaturas.js");
        formMod.init(ctx);
      }
      formMod.show();
    } catch (e) {
      telaFalhou($("viewFormaturas"), "viewFormaturas", e);
    }
  }
  if (key === "becas") {
    try {
      if (!becasMod) {
        becasMod = await import("./becas.js");
        becasMod.init(ctx);
      }
      becasMod.show();
    } catch (e) {
      telaFalhou($("viewBecas"), "viewBecas", e);
    }
  }
  if (key === "vendas") {
    try {
      if (!vendasMod) {
        vendasMod = await import("./vendas.js");
        vendasMod.init(ctx);
      }
      vendasMod.show();
    } catch (e) {
      telaFalhou($("viewVendas"), "viewVendas", e);
    }
  }
  if (key === "agenda") {
    try {
      if (!agendaMod) {
        agendaMod = await import("./agenda.js");
        agendaMod.init(ctx);
      }
      agendaMod.show();
    } catch (e) {
      telaFalhou($("viewAgenda"), "viewAgenda", e);
    }
  }
  if (instMod && !INST_NOMES[key]) instMod.hide();
  if (key === "instituicoes" || key === "colegios") contarInst();
  if (INST_NOMES[key]) {
    try {
      if (!instMod) {
        instMod = await import("./instituicoes.js");
        instMod.init(ctx);
      }
      instMod.show(key.slice(5));
    } catch (e) {
      telaFalhou($("viewInstTipo"), "viewInstTipo", e);
    }
  }
  if (key === "home") renderHome();
  if (key === "pr" || key === "repasse") {
    try {
      if (!repasseMod) {
        repasseMod = await import("./repasse.js");
        repasseMod.init(ctx);
      }
      repasseMod.show();
    } catch (e) {
      telaFalhou($("viewRepasse"), "viewRepasse", e);
    }
  }
  window.scrollTo(0, 0);
  // tela aberta e desenhada (os testes esperam por isto em vez de um tempo fixo)
  document.body.dataset.tela = location.hash;
}
// só troca de tela se o endereço mudou de verdade (o "voltar" restaura o endereço e não deve redesenhar)
addEventListener("hashchange", () => {
  if (location.hash !== hashAtual) route();
});
$("btnBack").onclick = () => ir(telaDeCima());

// ---------- botão voltar do celular ----------
// As telas trocam o endereço no lugar (sem empilhar histórico). O "voltar" do celular:
// 1) fecha a janela aberta; 2) sobe uma tela (Instituições do tipo → Instituições → Início);
// 3) no Início, pede um segundo toque para sair do app.
let hashAtual = "";
function telaDeCima() {
  return INST_NOMES[curView] ? "#instituicoes" : "#home";
}
function ir(h) {
  const alvo = "#" + String(h || "home").replace(/^#/, "");
  if (location.hash !== alvo) history.replaceState(history.state, "", alvo);
  route();
}
// links internos (cards da tela inicial etc.) também trocam no lugar
document.addEventListener("click", e => {
  const a = e.target.closest && e.target.closest('a[href^="#"]');
  if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey) return;
  e.preventDefault();
  ir(a.getAttribute("href"));
});
function janelaAberta() {
  return [...document.querySelectorAll(".sheet")].filter(x => !x.hidden && getComputedStyle(x).display !== "none").pop();
}
function fecharJanela(j) {
  if (j.id === "sheet") Funil.fecharForm();
  else if (j.id)
    j.hidden = true; // janelas fixas (Ajustes, Equipe)
  else {
    j.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    if (j.isConnected) j.remove();
  } // janelas que o app cria
}
const guarda = () => history.pushState({ z7: 1 }, "", location.hash || "#home");
let tocouSair = 0;
addEventListener("popstate", e => {
  // trocar o endereço também dispara este evento, sem marca: aí é navegação normal (o hashchange cuida)
  if (!e.state || !(e.state.z7 || e.state.z7base)) return;
  history.replaceState(e.state, "", hashAtual || "#home"); // o navegador trocou o endereço; volta para o da tela atual
  const j = janelaAberta();
  if (j) {
    fecharJanela(j);
    guarda();
    return;
  }
  if (curView !== "home") {
    ir(telaDeCima());
    guarda();
    return;
  }
  if (Date.now() - tocouSair < 2500) {
    history.back();
    return;
  } // segundo toque: sai
  tocouSair = Date.now();
  toast("Toque em voltar de novo para sair do app");
  guarda();
});
// entrada de baixo marcada (é nela que o "voltar" cai) + uma entrada de guarda por cima
if (!history.state || !history.state.z7) {
  history.replaceState({ z7base: 1 }, "", location.href);
  guarda();
}

let repCount = { at: 0, n: null };
function renderHome() {
  const h = new Date().getHours();
  $("hello").textContent = (h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite") + (me ? ", " + first(me) : "") + "!";
  const { late, today } = Funil.contagem();
  document.querySelectorAll(".tile[data-mod]").forEach(t => {
    t.hidden = !pode(t.dataset.mod);
  });
  $("tFunil").textContent =
    late + today ? `${late + today} para hoje` + (late ? ` · ${late} atrasado${late > 1 ? "s" : ""}` : "") : "Nada pendente hoje ✓";
  if (Date.now() - repCount.at > 5 * 60000) {
    repCount.at = Date.now();
    if (pode("rep"))
      getCountFromServer(query(collection(db, "repasse"), where("followup", "<=", todayStr())))
        .then(c => {
          repCount.n = c.data().count;
          paintRep();
        })
        .catch(e => avisoErro(e, "contar o PR"));
    else if (pode("lf"))
      FS.getDocs(
        query(
          collection(db, "repasse"),
          where("ano", "==", new Date().getFullYear()),
          where("etapa", "in", ["SEPARADO", "CONTATADO", "INTERESSADO"]),
          FS.limit(300)
        )
      )
        .then(s => {
          repCount.n = s.docs.filter(
            d => (d.data().followup || "9") <= todayStr() && (!d.data().respEmail || d.data().respEmail === ctx.email)
          ).length;
          paintRep();
        })
        .catch(e => avisoErro(e, "contar o PR"));
  }
  // pedidos de aluno repetido no PR esperando a decisão do admin
  if (isAdmin && Date.now() - (repCount.pedAt || 0) > 60000) {
    repCount.pedAt = Date.now();
    getCountFromServer(query(collection(db, "pedidos"), where("status", "==", "pendente")))
      .then(c => {
        repCount.ped = c.data().count;
        paintRep();
      })
      .catch(() => {});
  }
  paintRep();
  contarInst();
  contarAgenda();
  contarFormBecas();
}
// Cartões Formaturas e Becas: parcelas atrasadas e devoluções atrasadas
let fbCount = { at: 0 };
function contarFormBecas() {
  if (Date.now() - fbCount.at < 60000) return;
  fbCount.at = Date.now();
  const hoje = todayStr();
  // Parcelas atrasadas = próximo vencimento em aberto (proxVenc) antes de hoje. O admin conta no servidor, sem baixar nada.
  const pinta = n => {
    $("tFormaturas").textContent = n ? `⚠️ ${n} parcela${n > 1 ? "s" : ""} atrasada${n > 1 ? "s" : ""}` : "Abrir";
  };
  if (pode("formaturas")) {
    if (isAdmin)
      getCountFromServer(query(collection(db, "formandos"), where("proxVenc", ">", ""), where("proxVenc", "<", hoje)))
        .then(c => pinta(c.data().count))
        .catch(e => avisoErro(e, "contar parcelas atrasadas"));
    else
      FS.getDocs(query(collection(db, "formandos"), where("respEmail", "==", ctx.email), FS.limit(2000)))
        .then(s => pinta(s.docs.map(d => d.data()).filter(f => f.proxVenc && f.proxVenc < hoje).length))
        .catch(e => avisoErro(e, "contar parcelas atrasadas"));
  }
  if (pode("becas"))
    FS.getDocs(query(collection(db, "becas"), where("status", "in", ["reservado", "retirado"]), FS.limit(500)))
      .then(s => {
        const l = s.docs.map(d => d.data()),
          at = l.filter(b => b.status === "retirado" && b.devolucao && b.devolucao < hoje).length,
          ret = l.filter(b => b.status === "reservado" && b.retirada && b.retirada <= addDays(1)).length;
        const p = [];
        if (at) p.push(`⚠️ ${at} devolução${at > 1 ? "ões" : ""} atrasada${at > 1 ? "s" : ""}`);
        if (ret) p.push(`${ret} retirada${ret > 1 ? "s" : ""} hoje/amanhã`);
        $("tBecas").textContent = p.join(" · ") || "Abrir";
      })
      .catch(e => avisoErro(e, "contar as becas"));
}
// Cartão do Agendamento: para a Luciana, quantas datas esperam aprovação
let agCount = { at: 0 };
function contarAgenda() {
  if (!pode("agenda") && !pode("colegios")) return;
  if (Date.now() - agCount.at < 60000) return;
  agCount.at = Date.now();
  const eu = ctx.aprovador;
  const falhou = (onde, v) => e => {
    avisoErro(e, onde);
    return v;
  };
  const ens = isAdmin
    ? FS.getDocs(query(collection(db, "ensaios"), where("data", "==", addDays(1)), FS.limit(100)))
        .then(s => s.docs.map(d => d.data()))
        .catch(falhou("ver os ensaios de amanhã", []))
    : Promise.resolve([]);
  const ana =
    isAdmin && eu
      ? getCountFromServer(query(collection(db, "ensaios"), where("status", "==", "analisar")))
          .then(c => c.data().count)
          .catch(falhou("contar ensaios para analisar", 0))
      : Promise.resolve(0);
  const prz = Number(P.prazo) || 15;
  const atr = isAdmin
    ? FS.getDocs(query(collection(db, "ensaios"), where("data", ">=", addDays(-90)), FS.limit(600)))
        .then(
          s =>
            s.docs
              .map(d => d.data())
              .filter(
                e =>
                  e.kind !== "pessoal" &&
                  e.status !== "faltou" &&
                  e.status !== "remarcar" &&
                  e.data <= addDays(-prz) &&
                  !(e.entrega && e.entrega.etapa === "Entregue")
              ).length
        )
        .catch(falhou("contar entregas", 0))
    : Promise.resolve(0);
  Promise.all([
    getCountFromServer(query(collection(db, "agenda"), where("status", "==", "pendente")))
      .then(c => c.data().count)
      .catch(falhou("contar datas pendentes", 0)),
    ana,
    ens,
    atr
  ]).then(([n, a, amanha, at]) => {
    const p = [];
    if (eu && n + a) p.push(`${n + a} para analisar`);
    else if (n) p.push(`${n} aguardando a Luciana`);
    const lem = amanha.filter(e => e.status !== "remarcar" && !e.lembrado && e.tel).length;
    if (lem) p.push(`${lem} lembrete${lem > 1 ? "s" : ""} para amanhã`);
    if (at) p.push(`⚠️ ${at} entrega${at > 1 ? "s" : ""} atrasada${at > 1 ? "s" : ""}`);
    $("tAgenda").textContent = p.join(" · ") || "Abrir";
  });
}
// Retornos de hoje por tipo de instituição (cartões da tela Instituições e da tela inicial)
let instCount = { at: 0, por: null };
function contarInst(force) {
  if (!pode("colegios")) return;
  if (!force && Date.now() - instCount.at < 120000 && instCount.por) return paintInst();
  instCount.at = Date.now();
  const hj = todayStr();
  (isAdmin
    ? Promise.all([
        FS.getDocs(query(collection(db, "instituicoes"), where("followup", "<=", hj), FS.limit(500))),
        FS.getDocs(query(collection(db, "instituicoes"), where("formatura.status", "in", ["pendente", "confirmado"]), FS.limit(500)))
      ])
    : FS.getDocs(ctx.carteira("instituicoes")).then(s => {
        const docs = s.docs;
        const f = fn => ({ docs: docs.filter(d => fn(d.data())) });
        return [f(x => x.followup && x.followup <= hj), f(x => x.formatura && ["pendente", "confirmado"].includes(x.formatura.status))];
      })
  )
    .then(([s1, s2]) => {
      const por = {},
        vistos = new Set();
      s1.docs.forEach(d => {
        const x = d.data();
        if (x.etapa !== "FECHADO") {
          por[x.tipo] = (por[x.tipo] || 0) + 1;
          vistos.add(d.id);
        }
      });
      // pendência: formatura sem o dia de medir beca + ensaio
      s2.docs.forEach(d => {
        const x = d.data();
        const df = x.diaFotos;
        if (!vistos.has(d.id) && !(df && df.data && df.status !== "recusado")) por[x.tipo] = (por[x.tipo] || 0) + 1;
      });
      instCount.por = por;
      paintInst();
    })
    .catch(e => avisoErro(e, "contar os retornos das instituições"));
}
function paintInst() {
  const por = instCount.por || {};
  document.querySelectorAll(".tile[data-inst]").forEach(t => {
    const n = por[t.dataset.inst] || 0;
    t.querySelector(".tile-n").textContent = n ? `${n} para hoje` : "Nada pendente hoje ✓";
  });
  const tot = Object.values(por).reduce((a, b) => a + b, 0),
    tile = document.querySelector('.tile[data-mod="colegios"] .tile-n');
  if (tile) tile.textContent = instCount.por ? (tot ? `${tot} para hoje` : "Nada pendente hoje ✓") : "Abrir";
}
function paintRep() {
  const base = repCount.n == null ? "" : repCount.n ? `${repCount.n} para hoje` : "Nada pendente hoje ✓";
  $("tRepasse").textContent = base + (repCount.ped ? ` · 📩 ${repCount.ped} pedido${repCount.ped > 1 ? "s" : ""} de aluno repetido` : "");
}

// ---------- login ----------
$("formLogin").addEventListener("submit", async e => {
  e.preventDefault();
  $("lErr").hidden = true;
  $("lBtn").disabled = true;
  try {
    await signInWithEmailAndPassword(auth, $("lEmail").value.trim(), $("lSenha").value);
  } catch (err) {
    $("lErr").textContent = "E-mail ou senha incorretos.";
    $("lErr").hidden = false;
  } finally {
    $("lBtn").disabled = false;
  }
});
$("lReset").onclick = async () => {
  const em = $("lEmail").value.trim();
  if (!em) {
    $("lErr").textContent = "Digite o seu e-mail acima e toque de novo.";
    $("lErr").hidden = false;
    return;
  }
  try {
    await sendPasswordResetEmail(auth, em);
    $("lErr").textContent = "Enviamos um link para criar uma nova senha no seu e-mail.";
    $("lErr").hidden = false;
  } catch (_) {
    $("lErr").textContent = "Não foi possível enviar. Confira o e-mail.";
    $("lErr").hidden = false;
  }
};

// ---------- equipe (js/equipe.js) ----------
Equipe.init({
  db,
  auth,
  updateDoc,
  doc,
  setDoc,
  sendPasswordResetEmail,
  createUserWithEmailAndPassword,
  signOut,
  cadastroAuth,
  mkBtn,
  toast,
  handleErr,
  first,
  isDono,
  MODULOS,
  usuarios: () => USERS,
  user: () => user,
  isAdmin: () => isAdmin
});

function startData() {
  unsub.forEach(f => f());
  unsub = [];
  const em = (user.email || "").toLowerCase();
  let bootstrapped = false;
  unsub.push(
    onSnapshot(
      collection(db, "usuarios"),
      snap => {
        USERS = {};
        snap.docs.forEach(d => (USERS[d.id] = d.data()));
        // Primeiro acesso de um dono: cria o cadastro dele automaticamente.
        if (isDono(em) && !USERS[em] && !bootstrapped) {
          bootstrapped = true;
          setDoc(doc(db, "usuarios", em), { nome: DONOS[em] || em, papel: "admin", ativo: true, criadoEm: new Date().toISOString() }).catch(
            e => avisoErro(e, "criar o seu cadastro")
          );
        }
        applyProfile();
        Funil.syncLeads();
        Funil.render();
        if (!usersLoaded) {
          usersLoaded = true;
          route();
        } else if (curView === "home") renderHome();
        else {
          const md =
            { funil: "funil", pr: "pr", repasse: "pr", agenda: "agenda", vendas: "vendas", formaturas: "formaturas", becas: "becas" }[
              curView
            ] || (curView === "instituicoes" || curView === "colegios" || INST_NOMES[curView] ? "colegios" : null);
          if (md && !pode(md)) route();
        }
        if (Equipe.aberta()) Equipe.render();
      },
      err => {
        if (err.code === "permission-denied") showNotice("Este e-mail não tem acesso ao app. Peça para um administrador cadastrar você.");
      }
    )
  );
  unsub.push(
    onSnapshot(
      doc(db, "config", "app"),
      s => {
        if (s.exists()) P = Object.assign({}, P, s.data());
        feriadosExtras(P.feriadosExtras);

        Funil.render();
      },
      e => avisoErro(e, "ler os ajustes")
    )
  );
}

// ---------- dados antigos ----------
// A atualização de dados antigos roda no GitHub (scripts/migrar.mjs), não no celular de quem abre o app.

onAuthStateChanged(auth, u => {
  user = u;
  $("viewLogin").hidden = !!u;
  $("viewApp").hidden = !u;
  if (u) {
    startData();
    renderPushBanner();
    refreshPushToken();
    route();
  } else {
    usersLoaded = false;
    unsub.forEach(f => f());
    unsub = [];
    Funil.parar();
    USERS = {};
  }
});

// ---------- service worker e atualizações ----------
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("./sw.js")
    .then(r => {
      swReg = r;
      if (user) refreshPushToken();
    })
    .catch(e => console.warn("[Z7] service worker", e));
}
try {
  onMessage(getMessaging(app), p => {
    const n = p.notification || {};
    toast((n.title || "") + (n.body ? " · " + n.body : ""));
  });
} catch (_) {}
try {
  if (!localStorage.getItem("z7guide")) $("guide").open = true;
  $("guide").addEventListener("toggle", () => {
    try {
      localStorage.setItem("z7guide", "1");
    } catch (_) {}
  });
} catch (_) {}
setInterval(() => {
  if ($("sheet").hidden && $("sheetPrices").hidden) Funil.render();
}, 60000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) Funil.render();
});
$("sheetPrices").addEventListener("click", e => {
  if (e.target === $("sheetPrices")) $("sheetPrices").hidden = true;
});
document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    Funil.fecharForm();
    $("sheetPrices").hidden = true;
    $("sheetTeam").hidden = true;
  }
});
