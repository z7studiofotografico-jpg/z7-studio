// Ajustes (⚙️): preços e textos das mensagens, comissões, feriados extras, notificações e, para o admin,
// os erros do app e o "Ver o app como a equipe". Só o administrador grava.
import * as FS from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { collection, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { COMISSAO_PADRAO, FORMAS, taxa } from "./regras.js";
import { formatarCampos } from "./ui.js";
import { num, toast } from "./util.js";
import { definirExtras as feriadosExtras, feriadosEntre } from "./feriados.js";
import { EMPRESA_PADRAO, FRENTES, fmtTel, conferirNumeros, numerosDosOutros } from "./numeros.js";
import { secaoMeusNumeros } from "./numeros-tela.js";
import { secaoNesteCelular } from "./numeros-celular.js";
const $ = id => document.getElementById(id);
// ctx = o mesmo do app (P, isAdmin, db, handleErr); o = { sair(), renderPushState(), verComo() }
export function ligarAjustes(ctx, o) {
  const db = ctx.db;
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
    ["pFunilNum", "funilNumero", "texto"],
    ["pCobNum", "cobrancaNumero", "texto"],
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
    ["pFeriados", "feriadosExtras", "texto"],
    ["pDrive", "drivePrevias", "texto"],
    ["pDriveChave", "driveChave", "texto"]
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
      $(id).value = ctx.P[k] || (EMPRESA_PADRAO[k] ? fmtTel(EMPRESA_PADRAO[k]) : "");
      $(id).disabled = !ctx.isAdmin;
    });
    $("pEquipes").value = String(ctx.P.equipesDia || 1);
    feriadosExtras(ctx.P.feriadosExtras);
    listarFeriados();
    montarComissao();
    formatarCampos($("sheetPrices"));
    $("pEquipes").disabled = !ctx.isAdmin;
    document.querySelectorAll("#comTab input").forEach(i => {
      i.disabled = !ctx.isAdmin;
    });
    $("pSave").hidden = !ctx.isAdmin;
    $("pricesHint").textContent = ctx.isAdmin
      ? "Os valores entram automaticamente nas mensagens prontas."
      : "Só administradores mudam os preços.";
    o.renderPushState();
    if (ctx.isAdmin) mostrarErros();
    $("pVerComo").hidden = !ctx.isAdmin;
    secaoMeusNumeros(ctx, $("pMeusNum"));
    secaoNesteCelular(ctx, $("pNesteCel"));
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
    const cfg = ctx.P.comissao || {};
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
    await o.sair();
  };
  $("formPrices").addEventListener("submit", async e => {
    e.preventDefault();
    if (!ctx.isAdmin) return;
    const body = Object.fromEntries(AJUSTES.map(([id, k, t, padrao]) => [k, lerAjuste[t]($(id).value) || padrao || lerAjuste[t]("")]));
    Object.assign(body, { equipesDia: Number($("pEquipes").value) || 1, comissao: lerComissao() });
    // WhatsApp da empresa: número válido e que não seja o de trabalho de alguém da equipe (cada um com o seu)
    const outros = numerosDosOutros(ctx.usuarios, ctx.email, true);
    for (const f of Object.values(FRENTES)) {
      if (!body[f.chave]) continue;
      const c = conferirNumeros([body[f.chave]], {}, outros, true);
      if (c.erro) return toast(`WhatsApp da empresa · ${f.nome}: ${c.erro}`);
    }
    try {
      await setDoc(doc(db, "config", "app"), body, { merge: true });
      $("sheetPrices").hidden = true;
      toast("Preços salvos");
    } catch (err) {
      ctx.handleErr(err);
    }
  });
  $("pVerComo").onclick = () => {
    $("sheetPrices").hidden = true;
    o.verComo();
  };
}
