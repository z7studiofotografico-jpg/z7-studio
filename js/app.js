// App Z7 Studio: login, perfil (quem é e o que pode ver), rotas entre as telas e o botão voltar.
// Partes: inicio.js (números dos cartões), ajustes.js, notificacoes.js, vercomo.js.
// (Saiu de dentro do index.html para ter lint e ficar fácil de achar.)
import "./endereco.js"; // endereço antigo (github.io) → app.z7studio.com.br
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  initializeAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  verifyPasswordResetCode,
  confirmPasswordReset,
  signOut,
  setPersistence,
  indexedDBLocalPersistence,
  inMemoryPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  addDoc,
  collection,
  doc,
  onSnapshot,
  updateDoc,
  setDoc,
  where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import * as FS from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getMessaging, onMessage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js";
import { avisoErro, ligarCamposReais } from "./ui.js";
import { first, toast, showNotice, mkBtn } from "./util.js";
ligarCamposReais();
import * as Funil from "./funil.js";
import { ligarErros, telaFalhou } from "./erros.js";
import { fecharRelatorio } from "./relatorio.js";
import { lerVerComo, faixaVerComo, escolherVerComo } from "./vercomo.js";
import { criarNotificacoes } from "./notificacoes.js";
import { ligarAjustes } from "./ajustes.js";
import { criarInicio } from "./inicio.js";
import { telaCriarSenha } from "./criar-senha.js";
import { painelNumeros } from "./numeros-tela.js";
import { ligarWhatsCerto } from "./numeros-celular.js";
import * as Equipe from "./equipe.js";
import { definirExtras as feriadosExtras } from "./feriados.js";

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
let verComo = lerVerComo();
const emailReal = () => ((user && user.email) || "").toLowerCase();
function pode(m) {
  if (isAdmin) return true;
  const p = verComo || USERS[emailReal()];
  if (!p || p.ativo === false || !Array.isArray(p.modulos)) return false;
  // Dashboard: quem é da equipe (com algum módulo) vê o próprio desempenho
  if (m === "vendas") return p.modulos.length > 0;
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
  // "Ver como a equipe" só vale para administrador; para os outros é ignorado
  if (verComo && !isAdmin) verComo = null;
  if (verComo) {
    isAdmin = false;
    me = verComo.nome;
    faixaVerComo(verComo);
  }
  renderMe();
  if (me !== prev && !verComo) refreshPushToken();
}

function handleErr(e) {
  console.warn("[Z7]", e);
  if (e && e.code === "ver-como") return; // o aviso já apareceu
  if (!navigator.onLine || (e && (e.code === "unavailable" || (e.code === "failed-precondition" && /offline/i.test(e.message || "")))))
    toast("Sem internet agora. Isso precisa de conexão: tente de novo quando voltar o sinal.");
  else if (e && e.code === "permission-denied") toast("Você não tem permissão para fazer isso. Fale com o Adriano.");
  else toast("Não salvou. Verifique a internet e tente de novo.");
}

// ---------- desenho da tela ----------

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
  "inst-superior": "viewInstTipo",
  // endereços antigos (faculdade e profissionalizante viraram um cartão só)
  "inst-profissionalizante": "viewInstTipo",
  "inst-faculdade": "viewInstTipo"
};
const INST_NOMES = {
  "inst-particular": "Colégio particular",
  "inst-publico": "Colégio público",
  "inst-superior": "Faculdade e curso profissionalizante",
  "inst-profissionalizante": "Faculdade e curso profissionalizante",
  "inst-faculdade": "Faculdade e curso profissionalizante"
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
  },
  // "Ver como a equipe": nenhuma gravação sai do app
  setDoc: soLeitura("setDoc"),
  updateDoc: soLeitura("updateDoc"),
  addDoc: soLeitura("addDoc"),
  deleteDoc: soLeitura("deleteDoc"),
  runTransaction: soLeitura("runTransaction"),
  writeBatch(...a) {
    const b = FS.writeBatch(...a);
    if (!verComo) return b;
    const nada = {
      set: () => nada,
      update: () => nada,
      delete: () => nada,
      commit: soLeitura("commit")
    };
    return nada;
  }
});
function soLeitura(nome) {
  return (...a) => {
    if (verComo) {
      toast("👁 Só visualização: nada foi gravado.");
      return Promise.reject(Object.assign(new Error("Modo visualização"), { code: "ver-como" }));
    }
    return FS[nome](...a);
  };
}
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
    return !verComo && APROVADORES.includes(emailReal());
  },
  get verComo() {
    return verComo;
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
    return verComo ? verComo.email : emailReal();
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
// "Abrir no WhatsApp": abre no app (WhatsApp ou Business) do número em uso nesta tela
ligarWhatsCerto(ctx);
Funil.init(ctx);
const { renderPushState, renderPushBanner, refreshPushToken } = criarNotificacoes({
  app,
  db,
  CFG,
  swReg: () => swReg,
  me: () => me,
  user: () => user
});
ligarAjustes(ctx, { sair: () => signOut(auth), renderPushState, verComo: () => escolherVerComo(USERS, isDono, MODULOS) });
const { renderHome, contarInst } = criarInicio(ctx, Funil);
let usersLoaded = false,
  painelNum = null;
async function route() {
  if (!user || !usersLoaded) return;
  fecharRelatorio(); // trocou de tela: o relatório da tela anterior sai
  // endereços antigos: faculdade e profissionalizante agora são um cartão só
  if (/^#inst-(faculdade|profissionalizante)$/.test(location.hash)) history.replaceState(history.state, "", "#inst-superior");
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
    "inst-superior": "colegios",
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
  // relatório aberto: o voltar fecha o relatório e fica na mesma tela
  if (document.getElementById("relatorio")) {
    fecharRelatorio();
    guarda();
    return;
  }
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
// E-mail para criar ou trocar a senha: depois de salvar a senha, o botão "Continuar" do Firebase volta para o app.
// (se o endereço do app não estiver na lista de domínios autorizados do Firebase, manda sem o botão)
async function enviarSenha(a, em) {
  try {
    await sendPasswordResetEmail(a, em, { url: "https://app.z7studio.com.br/" });
  } catch (e) {
    if (!/continue-uri|unauthorized-domain/.test((e && e.code) || "")) throw e;
    await sendPasswordResetEmail(a, em);
  }
}
// Convite da equipe: o Firebase não deixa trocar o modelo do e-mail neste projeto, então o convite entra na
// fila "emails" e o GitHub (scripts/emails.mjs) manda pelo Gmail do estúdio, em português, com o link direto
// para criar a senha no app (app.z7studio.com.br). Chega em até 15 minutos.
async function convidar(em) {
  await addDoc(collection(db, "emails"), {
    tipo: "convite",
    para: [em],
    status: "pendente",
    criadoEm: new Date().toISOString(),
    por: (auth.currentUser && auth.currentUser.email) || ""
  });
}
$("lReset").onclick = async () => {
  const em = $("lEmail").value.trim();
  if (!em) {
    $("lErr").textContent = "Digite o seu e-mail acima e toque de novo.";
    $("lErr").hidden = false;
    return;
  }
  try {
    await enviarSenha(auth, em);
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
  convidar,
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
  isAdmin: () => isAdmin,
  ctx
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
        // WhatsApp de trabalho: pedidos de troca (admin) e a resposta para quem pediu (equipe)
        if (!painelNum) {
          painelNum = painelNumeros(ctx, $("hNumeros"));
          unsub.push(() => {
            painelNum();
            painelNum = null;
          });
        }
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

// convite / "esqueci a senha": criar a senha aqui mesmo, no app
telaCriarSenha({ auth, verifyPasswordResetCode, confirmPasswordReset, signInWithEmailAndPassword, signOut }).catch(e =>
  console.warn("[Z7] criar senha", e)
);
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
