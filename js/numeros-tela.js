// WhatsApp de trabalho na tela: campos de números, pedido de troca (equipe), autorização (admin) e avisos.
// As regras dos números (empresa, cada um com o seu) ficam em numeros.js.
import { el, field, sheet, botoes } from "./ui.js";
import * as U from "./util.js";
import { MAX_NUMEROS, fmtTel, normTel, numerosDe, conferirNumeros, numerosDosOutros } from "./numeros.js";
import { avisoTel } from "./aluno-id.js";

// Campos para digitar os números (começa com 2; "+ outro número" até o máximo). Devolve { box, ler() }.
export function campoNumeros(iniciais) {
  const box = el("div", "numeros");
  const lista = el("div");
  box.append(lista);
  const inputs = [];
  const add = v => {
    const i = el("input");
    i.inputMode = "tel";
    i.maxLength = 20;
    i.placeholder = "(21) 9xxxx-xxxx";
    i.value = v ? fmtTel(v) : "";
    i.setAttribute("aria-label", "WhatsApp de trabalho " + (inputs.length + 1));
    const av = el("small", "wait");
    av.hidden = true;
    i.addEventListener("input", () => {
      const a = i.value.replace(/\D/g, "").length >= 8 ? avisoTel(normTel(i.value)) : "";
      av.textContent = a ? "⚠️ " + a : "";
      av.hidden = !a;
    });
    const r = el("div", "field");
    r.append(i, av);
    lista.append(r);
    inputs.push(i);
    mais.hidden = inputs.length >= MAX_NUMEROS;
  };
  const mais = U.mkBtn("+ outro número", "btn-sm", () => add(""));
  box.append(mais);
  const ini = (iniciais || []).slice(0, MAX_NUMEROS);
  while (ini.length < 2) ini.push("");
  ini.forEach(add);
  return { box, ler: () => inputs.map(i => i.value) };
}

// Admin libera (ou recusa) o pedido de troca: os números passam a valer e a pessoa vê o aviso no app
export async function decidirNumeros(C, email, aprovar, numeros) {
  const { FS, db } = C;
  const agora = new Date().toISOString(),
    b = FS.writeBatch(db);
  if (aprovar) b.update(FS.doc(db, "usuarios", email), { numeros, numerosEm: agora });
  b.update(FS.doc(db, "numeros", email), {
    status: aprovar ? "aprovado" : "recusado",
    decididoEm: agora,
    decididoPor: C.me || C.email || "",
    visto: false
  });
  await b.commit();
}
// Cartão do pedido de troca (admin): números atuais → novos, com Autorizar / Recusar
export function cartaoPedidoNumeros(C, email, p) {
  const u = (C.usuarios || {})[email] || {};
  const c = el("div", "notes");
  c.append(
    el(
      "p",
      null,
      `📱 ${p.nome || u.nome || email} pediu para trocar o WhatsApp de trabalho: ` +
        `${numerosDe(u).map(fmtTel).join(", ") || "nenhum"} → ${(p.numeros || []).map(fmtTel).join(", ") || "nenhum"}`
    )
  );
  const conf = conferirNumeros(p.numeros || [], C.P, numerosDosOutros(C.usuarios, email));
  if (conf.erro) c.append(el("p", "wait", "⚠️ " + conf.erro));
  const act = el("div", "actions");
  const ok = U.mkBtn("✅ Autorizar", "btn-ok btn-sm", async () => {
    try {
      await decidirNumeros(C, email, true, conf.numeros);
      U.toast("Números liberados. " + U.first(p.nome || u.nome || "") + " vai ver o aviso no app.");
    } catch (e) {
      C.handleErr(e);
    }
  });
  ok.disabled = !!conf.erro;
  act.append(
    ok,
    U.mkBtn("Recusar", "btn-sm", async () => {
      try {
        await decidirNumeros(C, email, false);
        U.toast("Pedido recusado. A pessoa vai ver o aviso.");
      } catch (e) {
        C.handleErr(e);
      }
    })
  );
  c.append(act);
  return c;
}

// Avisos na tela inicial: admin vê os pedidos de troca; a pessoa da equipe vê a resposta (liberado ou não)
export function painelNumeros(C, box) {
  const { FS, db } = C;
  if (!box) return () => {};
  const vazio = () => {
    box.innerHTML = "";
    box.hidden = true;
  };
  if (C.isAdmin)
    return FS.onSnapshot(
      FS.query(FS.collection(db, "numeros"), FS.where("status", "==", "pendente"), FS.limit(50)),
      s => {
        vazio();
        if (!s.size) return;
        box.hidden = false;
        box.append(el("h3", null, `📱 ${s.size} pedido${s.size > 1 ? "s" : ""} de troca de WhatsApp de trabalho`));
        s.docs.forEach(d => box.append(cartaoPedidoNumeros(C, d.id, d.data())));
      },
      e => console.warn("[Z7] pedidos de números", e)
    );
  return FS.onSnapshot(
    FS.doc(db, "numeros", C.email),
    s => {
      vazio();
      const p = s.exists() ? s.data() : null;
      if (!p || p.status === "pendente" || p.visto !== false) return;
      box.hidden = false;
      const c = el("div", "notes");
      c.append(
        el(
          "p",
          null,
          p.status === "aprovado"
            ? `✅ Seus WhatsApp de trabalho foram liberados${p.decididoPor ? " por " + U.first(p.decididoPor) : ""}: ${(p.numeros || []).map(fmtTel).join(", ")}. Use só esses números para trabalhar.`
            : `❌ A troca do seu WhatsApp de trabalho não foi autorizada. Continue com os números de antes ou fale com o Adriano ou a Luciana.`
        ),
        U.mkBtn("Entendi", "btn-sm", () => FS.updateDoc(FS.doc(db, "numeros", C.email), { visto: true }).catch(C.handleErr))
      );
      box.append(c);
    },
    e => console.warn("[Z7] meus números", e)
  );
}

// Ajustes, para quem é da equipe: os números liberados e o pedido de troca
export function secaoMeusNumeros(C, box) {
  box.innerHTML = "";
  if (C.isAdmin) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  box.append(el("h3", null, "Meus WhatsApp de trabalho"));
  const atuais = numerosDe((C.usuarios || {})[C.email]);
  box.append(
    el(
      "p",
      "hint",
      atuais.length
        ? "Liberados: " +
            atuais.map(fmtTel).join(" · ") +
            ". Trabalhe só com esses números (o número da empresa é do Adriano e da Luciana)."
        : "Você ainda não tem número liberado. Peça abaixo: o Adriano ou a Luciana autorizam."
    )
  );
  const st = el("p", "wait");
  st.hidden = true;
  box.append(st);
  C.FS.getDoc(C.FS.doc(C.db, "numeros", C.email))
    .then(s => {
      if (s.exists() && s.data().status === "pendente") {
        st.textContent = "⏳ Pedido de troca aguardando autorização: " + (s.data().numeros || []).map(fmtTel).join(", ");
        st.hidden = false;
      }
    })
    .catch(() => {});
  box.append(U.mkBtn("📱 Pedir troca de número", "btn-sm", () => pedirTroca(C, atuais)));
}
function pedirTroca(C, atuais) {
  sheet("Trocar WhatsApp de trabalho", (p, close) => {
    p.append(
      el(
        "p",
        "hint",
        "Coloque os números que você vai usar para trabalhar (pode ser mais de um). O Adriano ou a Luciana autorizam e você recebe o aviso aqui no app."
      )
    );
    const cn = campoNumeros(atuais);
    p.append(field("Números", cn.box));
    const err = el("p", "err");
    err.hidden = true;
    p.append(err, botoes(close, "Pedir autorização"));
    p.addEventListener("submit", async ev => {
      ev.preventDefault();
      const conf = conferirNumeros(cn.ler(), C.P, numerosDosOutros(C.usuarios, C.email));
      if (conf.erro || !conf.numeros.length) {
        err.textContent = conf.erro || "Coloque pelo menos um número.";
        err.hidden = false;
        return;
      }
      try {
        await C.FS.setDoc(C.FS.doc(C.db, "numeros", C.email), {
          numeros: conf.numeros,
          status: "pendente",
          pedidoEm: new Date().toISOString(),
          nome: C.me || ""
        });
        close();
        U.toast("Pedido enviado. Você recebe o aviso aqui quando for autorizado.");
      } catch (e) {
        C.handleErr(e);
      }
    });
  });
}
