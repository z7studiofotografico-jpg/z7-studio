// PR: janelinhas do contato: registrar a venda, entrega (endereço e data) e notas
import { el, title, sheet as abrirSheet, field, botoes } from "./ui.js";
import * as U from "./util.js";
import { C, segDe, assumir, save, precos } from "./repasse-estado.js";
import { lerCep, mostrarCep, buscarCep, faltaEndereco } from "./cep.js";

// Janela do PR: a do app, já com o cursor no primeiro campo
export function sheet(titleTxt, build) {
  const close = abrirSheet(titleTxt, build);
  const f = [...document.querySelectorAll(".sheet")].pop()?.querySelector("input,textarea,select");
  if (f) setTimeout(() => f.focus(), 30);
  return close;
}
export { field };
export const actions = (close, okTxt) => botoes(close, okTxt);

export function openPago(it) {
  sheet("Registrar venda", (p, close) => {
    p.append(el("p", "hint", title(it.nome) + " · " + title(it.escola)));
    // Valor sai da tabela de preços (Ajustes); "outro valor" fica marcado para conferência
    const P = precos(it),
      lf = segDe(it) === "lf";
    const tabela = (
      lf
        ? [
            ["Pix", P.lfPix],
            ["Cartão", P.lfCartao]
          ]
        : [
            ["Pix", P.kitPromo || P.kitPreco],
            ["Cartão", P.kitCartao],
            ["Última oferta", P.kitFinal],
            ["Preço cheio", P.kitPreco]
          ]
    )
      .filter(([, x]) => Number(x))
      .map(([t, x]) => [String(x), `${U.money(x)} · ${t}`]);
    const vs = el("select");
    [...tabela, ["outro", "Outro valor…"]].forEach(([val, t]) => {
      const o = el("option", null, t);
      o.value = val;
      vs.append(o);
    });
    const sugerido = String(
      it.valor || (lf ? P.lfPix || P.kitPreco : (it.tentInteresse >= 2 && P.kitFinal) || P.kitPromo || P.kitPreco) || ""
    );
    vs.value = tabela.some(([x]) => x === sugerido) ? sugerido : tabela[0] ? tabela[0][0] : "outro";
    const v = el("input");
    v.inputMode = "decimal";
    v.placeholder = "R$";
    v.hidden = vs.value !== "outro";
    vs.onchange = () => {
      v.hidden = vs.value !== "outro";
      if (!v.hidden) v.focus();
    };
    const fp = el("select");
    ["Pix", "Cartão", "Link", "Recorrente", "Dinheiro", "Boleto", "Outro"].forEach(x => {
      const o = el("option", null, x);
      o.value = x;
      fp.append(o);
    });
    const vbox = el("div");
    vbox.append(vs, v);
    const r = el("div", "row2");
    r.append(field("Valor", vbox), field("Pagamento", fp));
    p.append(r);
    const comp = el("input");
    comp.maxLength = 120;
    comp.placeholder = "ex.: Pix de Maria às 14h, ou nº do comprovante";
    p.append(field("Comprovante", comp));
    if (!C.isAdmin)
      p.append(
        el("p", "hint", "A venda entra como “a conferir”. A comissão conta depois que o Adriano ou a Luciana conferem o comprovante.")
      );
    p.append(entregaCampos(p, it, { venda: true }));
    p.append(actions(close, "Salvar venda"));
    p.addEventListener("submit", ev => {
      ev.preventDefault();
      // endereço completo é obrigatório em toda venda (mesmo retirada: fica no cadastro para entrega e correio)
      if (!p._enderecoOk()) return;
      const valor = vs.value === "outro" ? U.num(v.value) : Number(vs.value);
      if (!valor) {
        v.hidden = false;
        v.focus();
        return;
      }
      close();
      save(
        it,
        Object.assign(
          {
            etapa: "PAGO",
            valor,
            formaPag: fp.value,
            comprovante: comp.value.trim(),
            valorForaTabela: vs.value === "outro",
            conferido: !!C.isAdmin,
            ...(C.isAdmin ? { conferidoPor: C.email || "", conferidoEm: U.todayStr() } : {}),
            pagoEm: U.todayStr(),
            followup: null,
            atendendo: null,
            ...(it.resp || it.respEmail ? {} : assumir(it))
          },
          p._entrega()
        ),
        C.isAdmin ? "Venda registrada 🎉" : "Venda registrada 🎉 · aguardando conferência",
        { semConfirmar: true }
      );
    });
  });
}
export function openEntrega(it) {
  sheet("Entrega", (p, close) => {
    p.append(el("p", "hint", title(it.nome)));
    p.append(entregaCampos(p, it), actions(close, "Salvar"));
    p.addEventListener("submit", ev => {
      ev.preventDefault();
      if (!p._enderecoOk()) return;
      close();
      save(it, p._entrega(), "Entrega atualizada");
    });
  });
}
// Campos de entrega: tipo, data agendada e endereço (vem da planilha, mas precisa ser confirmado com o cliente).
// Na venda (venda: true) o endereço completo é obrigatório sempre; depois, só quando é entrega em casa.
// O CEP preenche rua, bairro e cidade.
function entregaCampos(p, it, { venda = false } = {}) {
  const box = el("div", "imp");
  const en = el("select");
  ["A combinar com o cliente", "Entrega em casa", "Retirada no estúdio (agendada)"].forEach(x => {
    const o = el("option", null, x);
    o.value = x;
    en.append(o);
  });
  if (it.entregaTipo)
    en.value = it.entregaTipo.startsWith("Retirada")
      ? "Retirada no estúdio (agendada)"
      : it.entregaTipo.startsWith("A combinar")
        ? "A combinar com o cliente"
        : "Entrega em casa";
  const dt = el("input");
  dt.type = "date";
  dt.value = it.entregaData || "";
  const r1 = el("div", "row2");
  r1.append(field("Entrega", en), field("Data combinada (se já tiver)", dt));
  box.append(r1);
  const a = it.endereco || {};
  const mk = (val, ph) => {
    const i = el("input");
    i.value = val || "";
    i.placeholder = ph || "";
    i.maxLength = 120;
    return i;
  };
  const cep = mk(mostrarCep(a.cep), "00000-000");
  cep.inputMode = "numeric";
  cep.maxLength = 9;
  cep.autocomplete = "postal-code";
  const cepInfo = el("small", "hint", "");
  const rua = mk(title(a.rua)),
    num = mk(a.numero, "nº ou S/N"),
    comp = mk(title(a.complemento)),
    bai = mk(title(a.bairro)),
    cid = mk(title(a.cidade)),
    ref = mk(a.referencia, "ponto de referência");
  const end = el("div", "imp");
  const fCep = field("CEP", cep);
  fCep.append(cepInfo);
  const r1b = el("div", "row2");
  r1b.append(fCep, el("span"));
  let ultimoCep = lerCep(a.cep);
  cep.addEventListener("input", async () => {
    const d = lerCep(cep.value);
    if (!d || d === ultimoCep) return;
    ultimoCep = d;
    cepInfo.textContent = "Buscando o CEP…";
    try {
      const r = await buscarCep(d);
      if (lerCep(cep.value) !== d) return; // digitou outro enquanto buscava
      if (!r) {
        cepInfo.textContent = "⚠️ CEP não encontrado. Confira o número ou preencha à mão.";
        return;
      }
      cep.value = mostrarCep(d);
      if (r.rua) rua.value = title(r.rua);
      if (r.bairro) bai.value = title(r.bairro);
      if (r.cidade) cid.value = title(r.cidade) + (r.uf && r.uf !== "RJ" ? " - " + r.uf : "");
      cepInfo.textContent = "✓ Rua, bairro e cidade preenchidos. Confira e coloque o número.";
      num.focus();
    } catch (e) {
      cepInfo.textContent = "Não consegui buscar o CEP agora (internet). Preencha à mão.";
    }
  });
  const aviso = el("p", "wait", "");
  aviso.hidden = true;
  const r2 = el("div", "row2");
  r2.append(field("Rua", rua), field("Número", num));
  const r3 = el("div", "row2");
  r3.append(field("Complemento", comp), field("Bairro", bai));
  const r4 = el("div", "row2");
  r4.append(field("Cidade", cid), field("Referência", ref));
  const conf = el("label", "chk");
  const cc = el("input");
  cc.type = "checkbox";
  cc.checked = !!it.enderecoConfirmado;
  conf.append(cc, document.createTextNode(" Endereço confirmado com o cliente"));
  end.append(
    el(
      "p",
      "hint",
      (venda ? "Endereço completo é obrigatório em toda venda. " : "") +
        "O endereço da planilha pode estar desatualizado. Confirme com o cliente antes de sair para entregar."
    ),
    r1b,
    r2,
    r3,
    r4,
    conf,
    aviso
  );
  box.append(end);
  const sync = () => {
    end.hidden = !venda && en.value !== "Entrega em casa";
  };
  en.onchange = sync;
  sync();
  const endereco = () => ({
    cep: lerCep(cep.value),
    rua: rua.value.trim(),
    numero: num.value.trim(),
    bairro: bai.value.trim(),
    cidade: cid.value.trim()
  });
  // falta algo obrigatório: avisa, marca o primeiro campo e não salva
  p._enderecoOk = () => {
    if (end.hidden) return true;
    const falta = faltaEndereco(endereco());
    aviso.hidden = !falta.length;
    if (!falta.length) return true;
    aviso.textContent = "Falta preencher: " + falta.join(", ") + ".";
    ({ CEP: cep, Rua: rua, Número: num, Bairro: bai, Cidade: cid })[falta[0]].focus();
    return false;
  };
  p._entrega = () => {
    const casa = venda || en.value === "Entrega em casa";
    const o = { entregaTipo: en.value, entregaData: dt.value || "" };
    if (casa) {
      o.endereco = {
        cep: lerCep(cep.value),
        rua: rua.value.trim(),
        numero: num.value.trim(),
        complemento: comp.value.trim(),
        bairro: bai.value.trim(),
        cidade: cid.value.trim(),
        referencia: ref.value.trim()
      };
      o.enderecoConfirmado = cc.checked;
    }
    return o;
  };
  return box;
}

export function openNotas(it) {
  sheet("Notas", (p, close) => {
    p.append(el("p", "hint", title(it.nome)));
    const t = el("textarea");
    t.rows = 4;
    t.maxLength = 1500;
    t.value = it.notas || "";
    const tel = el("input");
    tel.inputMode = "tel";
    tel.placeholder = "21 99999-9999";
    p.append(field("Anotações", t), field("Adicionar outro WhatsApp (opcional)", tel), actions(close, "Salvar"));
    p.addEventListener("submit", ev => {
      ev.preventDefault();
      close();
      const patch = { notas: t.value.trim() };
      const d = tel.value.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
      if (d.length >= 10) {
        patch.contatos = [...(it.contatos || []), { tipo: "Outro", nome: "", tel: d }];
        patch.telefones = [...new Set([...(it.telefones || []), d])];
      }
      save(it, patch, "Notas salvas");
    });
  });
}
