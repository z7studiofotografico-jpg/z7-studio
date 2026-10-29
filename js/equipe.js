// Equipe: cadastro das pessoas, papel, módulos e WhatsApp de trabalho de cada uma (só administradores).
import { campoNumeros } from "./numeros-tela.js";
import { fmtTel, numerosDe, numerosEmpresa, conferirNumeros, numerosDosOutros } from "./numeros.js";
let D,
  numCampo = null;
const $ = id => document.getElementById(id);
// D = { db, auth, updateDoc, doc, setDoc, convidar, createUserWithEmailAndPassword, signOut, cadastroAuth,
//       mkBtn, toast, handleErr, first, isDono, MODULOS, usuarios(), user(), isAdmin(), ctx }
export function init(deps) {
  D = deps;
  ligar();
}
export function aberta() {
  return !$("sheetTeam").hidden;
}
export function fechar() {
  $("sheetTeam").hidden = true;
}
export function render() {
  const box = $("uList");
  box.innerHTML = "";
  const rows = Object.entries(D.usuarios()).sort((a, b) => (a[1].nome || "").localeCompare(b[1].nome || "", "pt-BR"));
  if (!rows.length) {
    const p = document.createElement("p");
    p.className = "hint";
    p.textContent = "Ninguém cadastrado ainda.";
    box.appendChild(p);
  }
  rows.forEach(([em, u]) => {
    const r = document.createElement("div");
    r.className = "urow" + (u.ativo === false ? " off" : "");
    const info = document.createElement("div");
    info.className = "u";
    const b = document.createElement("b");
    b.textContent = u.nome || em;
    const s = document.createElement("small");
    s.textContent = em;
    info.append(b, s);
    const pill = document.createElement("span");
    pill.className = "pill" + (u.papel === "admin" ? " admin" : "");
    pill.textContent = u.ativo === false ? "Desativado" : u.papel === "admin" ? "Administrador" : "Equipe";
    const acts = document.createElement("div");
    acts.className = "quick";
    if (D.isDono(em)) pill.textContent = "Dono";
    if (!D.isDono(em) && em !== (D.user().email || "").toLowerCase()) {
      acts.appendChild(
        D.mkBtn(u.papel === "admin" ? "Tornar equipe" : "Tornar admin", "", () =>
          updUser(
            em,
            u.papel === "admin"
              ? // quem vira equipe não fica com número da empresa (cada um trabalha com o próprio)
                { papel: "equipe", numeros: numerosDe(u).filter(n => !numerosEmpresa(D.ctx.P).includes(n)) }
              : { papel: "admin" }
          )
        )
      );
      acts.appendChild(
        D.mkBtn(u.ativo === false ? "Reativar" : "Desativar", u.ativo === false ? "btn-ok" : "btn-danger", () =>
          updUser(em, { ativo: u.ativo === false })
        )
      );
    }
    if (u.ativo !== false)
      acts.appendChild(
        D.mkBtn("Reenviar convite", "", async () => {
          try {
            await D.convidar(em);
            D.toast("Convite na fila: " + em + " recebe o e-mail em até 15 minutos.");
          } catch (_) {
            D.toast("Não foi possível enviar o e-mail.");
          }
        })
      );
    const head = document.createElement("div");
    head.style.cssText = "display:flex;gap:8px;align-items:center;min-width:0";
    head.append(info, pill);
    r.append(head);
    // WhatsApp de trabalho (equipe): cada pessoa com o próprio número
    if (u.ativo !== false) {
      const ns = document.createElement("small");
      const adm = u.papel === "admin" || D.isDono(em);
      ns.className = numerosDe(u).length || adm ? "hint" : "wait";
      ns.textContent = numerosDe(u).length
        ? "📱 " + numerosDe(u).map(fmtTel).join(" · ")
        : adm
          ? "📱 Usa os WhatsApp da empresa (pode cadastrar outros em 📱 Números)"
          : "⚠️ Sem WhatsApp de trabalho: toque em 📱 Números";
      r.append(ns);
      acts.appendChild(D.mkBtn("📱 Números", "", () => editarNumeros(em, u)));
    }
    if (!D.isDono(em) && u.papel !== "admin" && u.ativo !== false) {
      const mods = document.createElement("div");
      mods.className = "quick";
      const atuais = Array.isArray(u.modulos) ? u.modulos : []; // sem módulos marcados = sem acesso
      D.MODULOS.forEach(([k, lbl]) => {
        const l = document.createElement("label");
        l.className = "chk";
        const c = document.createElement("input");
        c.type = "checkbox";
        c.checked = atuais.includes(k);
        c.value = k;
        // lê as caixas marcadas agora (dois toques seguidos não desfazem um ao outro)
        c.onchange = () => updUser(em, { modulos: [...mods.querySelectorAll("input:checked")].map(x => x.value) });
        l.append(c, document.createTextNode(" " + lbl));
        mods.append(l);
      });
      r.append(mods);
    }
    r.append(acts);
    box.appendChild(r);
  });
}
// Admin muda os números de trabalho de alguém direto (já valem, sem pedido)
function editarNumeros(em, u) {
  const sh = document.createElement("div"),
    p = document.createElement("form");
  sh.className = "sheet";
  p.className = "panel";
  const h = document.createElement("h2");
  h.textContent = "WhatsApp de trabalho · " + (u.nome || em);
  const cn = campoNumeros(numerosDe(u));
  const err = document.createElement("p");
  err.className = "err";
  err.hidden = true;
  const a = document.createElement("div");
  a.className = "panel-actions";
  const ok = document.createElement("button");
  ok.type = "submit";
  ok.className = "btn btn-primary";
  ok.textContent = "Salvar";
  a.append(
    D.mkBtn("Cancelar", "", () => sh.remove()),
    ok
  );
  p.append(h, cn.box, err, a);
  sh.append(p);
  document.body.append(sh);
  p.addEventListener("submit", async e => {
    e.preventDefault();
    const adm = u.papel === "admin" || D.isDono(em);
    const conf = conferirNumeros(cn.ler(), D.ctx.P, numerosDosOutros(D.usuarios(), em, adm), adm);
    if (conf.erro || (!adm && !conf.numeros.length)) {
      err.textContent = conf.erro || "Coloque pelo menos um WhatsApp de trabalho da pessoa.";
      err.hidden = false;
      return;
    }
    ok.disabled = true;
    const agora = new Date().toISOString();
    if (await updUser(em, { numeros: conf.numeros, numerosEm: agora })) {
      sh.remove();
      // se a pessoa tinha pedido troca, o pedido fica resolvido e ela vê o aviso com os números que valem
      const ped = D.doc(D.db, "numeros", em);
      D.ctx.FS.getDoc(ped)
        .then(s => {
          if (s.exists() && s.data().status === "pendente")
            return D.updateDoc(ped, {
              status: "aprovado",
              numeros: conf.numeros,
              decididoEm: agora,
              decididoPor: D.ctx.me || "",
              visto: false
            });
        })
        .catch(e => console.warn("[Z7] pedido de números", e));
    } else ok.disabled = false;
  });
}
async function updUser(em, patch) {
  try {
    await D.updateDoc(D.doc(D.db, "usuarios", em), patch);
    D.toast("Equipe atualizada");
    return true;
  } catch (e) {
    D.handleErr(e);
    return false;
  }
}
function paintModsForm() {
  const box = $("uMods");
  if (!box.childElementCount)
    D.MODULOS.forEach(([k, lbl]) => {
      const l = document.createElement("label");
      l.className = "chk";
      const c = document.createElement("input");
      c.type = "checkbox";
      c.value = k;
      c.checked = k !== "rep" && k !== "funil";
      l.append(c, document.createTextNode(" " + lbl));
      box.append(l);
    });
  $("uModsBox").hidden = $("uPapel").value !== "equipe";
  $("uNumBox").hidden = $("uPapel").value !== "equipe";
  if (!numCampo) {
    numCampo = campoNumeros([]);
    $("uNums").append(numCampo.box);
  }
}
function ligar() {
  $("uPapel").addEventListener("change", paintModsForm);
  $("btnTeam").onclick = () => {
    render();
    paintModsForm();
    $("uErr").hidden = true;
    $("sheetTeam").hidden = false;
  };
  $("uClose").onclick = () => {
    $("sheetTeam").hidden = true;
  };
  $("sheetTeam").addEventListener("click", e => {
    if (e.target === $("sheetTeam")) $("sheetTeam").hidden = true;
  });
  $("formUser").addEventListener("submit", async e => {
    e.preventDefault();
    if (!D.isAdmin()) return;
    const nome = $("uNome").value.trim(),
      em = $("uEmail").value.trim().toLowerCase(),
      papel = $("uPapel").value;
    const err = $("uErr");
    err.hidden = true;
    if (!nome || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) {
      err.textContent = "Preencha o nome e um e-mail válido.";
      err.hidden = false;
      return;
    }
    // já cadastrado: gravar de novo apagaria os módulos e os números da pessoa
    if (D.usuarios()[em] || D.isDono(em)) {
      err.textContent = "Este e-mail já está na lista. Mude a pessoa pelos botões dela (Reativar, 📱 Números, módulos).";
      err.hidden = false;
      return;
    }
    // equipe: pelo menos um WhatsApp de trabalho da própria pessoa (nunca o da empresa nem o de outra pessoa)
    let numeros = [];
    if (papel === "equipe") {
      const conf = conferirNumeros(numCampo.ler(), D.ctx.P, numerosDosOutros(D.usuarios(), em));
      if (conf.erro || !conf.numeros.length) {
        err.textContent = conf.erro || "Coloque pelo menos um WhatsApp de trabalho da pessoa.";
        err.hidden = false;
        return;
      }
      numeros = conf.numeros;
    }
    $("uSave").disabled = true;
    try {
      // 1) cria o login (com uma senha aleatória que ninguém conhece)
      try {
        const rnd = crypto.getRandomValues(new Uint32Array(4)).join("-") + "Aa!";
        const a = D.cadastroAuth();
        await D.createUserWithEmailAndPassword(a, em, rnd);
        await D.signOut(a);
      } catch (ce) {
        if (ce.code !== "auth/email-already-in-use") throw ce;
      }
      // 2) dá acesso ao app
      const dados = { nome, papel, ativo: true, criadoEm: new Date().toISOString(), criadoPor: D.user().email || "" };
      if (papel === "equipe") {
        dados.modulos = [...$("uMods").querySelectorAll("input:checked")].map(c => c.value);
        dados.numeros = numeros;
        dados.numerosEm = dados.criadoEm;
      }
      await D.setDoc(D.doc(D.db, "usuarios", em), dados);
      // 3) manda o e-mail para a pessoa criar a própria senha
      await D.convidar(em);
      $("uNome").value = "";
      $("uEmail").value = "";
      $("uPapel").value = "equipe";
      numCampo.box.remove();
      numCampo = null;
      paintModsForm();
      D.toast("Pronto! " + D.first(nome) + " vai receber um e-mail para criar a senha (em até 15 minutos).");
    } catch (ex) {
      err.textContent =
        ex.code === "permission-denied"
          ? "Só administradores cadastram pessoas."
          : ex.code === "auth/invalid-email"
            ? "E-mail inválido."
            : "Não foi possível cadastrar. Tente de novo.";
      err.hidden = false;
      console.warn(ex);
    } finally {
      $("uSave").disabled = false;
    }
  });
}
