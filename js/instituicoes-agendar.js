// Agendamento → "+ Agendar colégio": escolhe o colégio e abre o formulário da data (dia de fotos ou formatura).
import { el, title, field, inp, sel, sheet, botoes as actions, parseTel } from "./ui.js";
import { openEvento } from "./eventos.js";
import * as U from "./util.js";
import { TIPOS, CARTOES, CARGOS, norm } from "./instituicoes-dados.js";
import { C, FS, col, tipo, iniciar } from "./instituicoes-estado.js";
// Agenda → "+ Agendar colégio": escolhe o colégio e o tipo (dia de fotos do PR ou formatura)
// e abre o mesmo formulário do cartão da instituição (com aprovação da Luciana).
// dia (opcional, AAAA-MM-DD): veio do dia tocado na agenda e já entra preenchido na data
export async function agendarColegio(ctx, dia) {
  if (!C) iniciar(ctx);
  let lista = [];
  try {
    lista = (await FS.getDocs(C.carteira("instituicoes", FS.limit(3000)))).docs
      .map(d => Object.assign({ id: d.id }, d.data()))
      .sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));
  } catch (e) {
    C.handleErr(e);
    return;
  }
  sheet("Agendar colégio", (p, close) => {
    p.append(
      el(
        "p",
        "hint",
        (dia ? `Dia ${U.fmtDate(dia)}/${dia.slice(0, 4)}. ` : "") +
          "Para o dia de fotos no colégio (medir beca e fazer o ensaio do PR), a formatura, o Paspatur ou o aluguel de becas no colégio. A data fica segurada até a Luciana aprovar."
      )
    );
    const tipoEv = sel(
      [
        ["fotos", "📸 Dia de fotos no colégio (PR)"],
        ["formatura", "🎓 Formatura"],
        ["paspatur", "🎞️ Paspatur (fotos no colégio)"],
        ["becas", "👘 Aluguel de becas (medir / entregar no colégio)"]
      ],
      "fotos"
    );
    // primeiro: particular, público ou faculdade/curso; a lista de colégios mostra só os desse grupo
    let grupo = "";
    const doGrupo = () => (grupo ? lista.filter(i => CARTOES[grupo].tipos.includes(i.tipo)) : []);
    const nome = inp("", "escolha acima: particular ou público");
    nome.required = true;
    nome.disabled = true;
    const dl = el("datalist");
    dl.id = "agInst" + Date.now();
    nome.setAttribute("list", dl.id);
    const err = el("p", "err");
    err.hidden = true;
    const grupos = el("div", "chips");
    grupos.setAttribute("role", "radiogroup");
    grupos.setAttribute("aria-label", "Particular ou público");
    const escolherGrupo = k => {
      grupo = k;
      grupos.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.k === k)));
      dl.innerHTML = "";
      doGrupo().forEach(i => {
        const o = el("option");
        o.value = title(i.nome);
        o.label = i.etapa || "";
        dl.append(o);
      });
      nome.disabled = false;
      nome.placeholder = `comece a digitar (${doGrupo().length} ${k === "superior" ? "cadastrados" : "colégios"})`;
      tipoN.value = CARTOES[k].tipos[0];
      err.hidden = true;
      nome.focus();
    };
    [
      ["particular", "🏫 Particular"],
      ["publico", "🏛️ Público"],
      ["superior", "🎓 Faculdade / curso"]
    ].forEach(([k, t]) => {
      const b = el("button", "chip", t);
      b.type = "button";
      b.dataset.k = k;
      b.setAttribute("aria-pressed", "false");
      b.onclick = () => escolherGrupo(k);
      grupos.append(b);
    });
    p.append(field("O que vai marcar", tipoEv), field("Particular ou público?", grupos), field("Colégio", nome), dl);
    // Colégio novo: cadastra aqui mesmo, sem sair da agenda
    const novoBox = el("div", "imp");
    novoBox.hidden = true;
    const tipoN = sel(
      Object.entries(TIPOS).map(([k, t]) => [k, t.nome]),
      tipo || "particular"
    );
    const bairro = inp("", "bairro"),
      cidade = inp("", "cidade");
    const contato = inp("", "nome do diretor ou responsável"),
      cargoC = sel(CARGOS, "Direção"),
      telC = inp("", "WhatsApp", 20),
      emailC = inp("", "e-mail", 120);
    telC.inputMode = "tel";
    emailC.type = "email";
    const media = inp("", "ex.: 120", 6);
    media.inputMode = "numeric";
    const r1 = el("div", "row2");
    r1.append(field("Bairro", bairro), field("Cidade", cidade));
    const r2 = el("div", "row2");
    r2.append(field("Responsável", contato), field("Cargo", cargoC));
    const r3 = el("div", "row2");
    r3.append(field("WhatsApp do responsável", telC), field("E-mail do responsável", emailC));
    novoBox.append(
      el("p", "hint", "Colégio novo: tipo e média de alunos são obrigatórios. O responsável recebe a confirmação no WhatsApp e no e-mail."),
      field("Tipo", tipoN),
      field("Média de alunos", media),
      r1,
      r2,
      r3
    );
    const btNovo = el("button", "btn btn-sm", "+ Cadastrar colégio novo");
    btNovo.type = "button";
    btNovo.onclick = () => {
      novoBox.hidden = !novoBox.hidden;
      btNovo.textContent = novoBox.hidden ? "+ Cadastrar colégio novo" : "Escolher da lista";
      err.hidden = true;
    };
    const acha = (de = doGrupo()) => {
      const alvo = norm(nome.value);
      if (!alvo) return null;
      const exato = de.find(i => norm(i.nome) === alvo);
      if (exato) return exato;
      const parc = de.filter(i => norm(i.nome).includes(alvo));
      return parc.length === 1 ? parc[0] : null;
    };
    // ao digitar um nome que não existe, já oferece o cadastro
    nome.addEventListener("change", () => {
      if (nome.value.trim() && !acha() && !acha(lista) && novoBox.hidden) btNovo.onclick();
    });
    p.append(btNovo, novoBox, err);
    p.append(actions(close, "Continuar"));
    p.addEventListener("submit", async ev => {
      ev.preventDefault();
      err.hidden = true;
      if (!grupo) {
        err.textContent = "Escolha primeiro se o colégio é particular ou público.";
        err.hidden = false;
        return;
      }
      let it = novoBox.hidden ? acha() : null;
      // escreveu um colégio do outro grupo: avisa onde ele está cadastrado
      const outro = !it && novoBox.hidden ? acha(lista) : null;
      if (outro) {
        err.textContent = `${title(outro.nome)} está cadastrado como ${(TIPOS[outro.tipo] || {}).nome || "outro tipo"}. Toque nesse grupo acima.`;
        err.hidden = false;
        return;
      }
      if (!it && novoBox.hidden) {
        err.textContent = "Não achei esse colégio. Escolha um nome da lista ou toque em “+ Cadastrar colégio novo”.";
        err.hidden = false;
        return;
      }
      if (!it) {
        const nm = nome.value.trim();
        if (!nm) {
          err.textContent = "Escreva o nome do colégio.";
          err.hidden = false;
          nome.focus();
          return;
        }
        const nMed = Number(String(media.value).replace(/\D/g, "")) || 0;
        if (!nMed) {
          err.textContent = "Coloque a média de alunos.";
          err.hidden = false;
          media.focus();
          return;
        }
        const repetido = lista.find(i => norm(i.nome) === norm(nm));
        if (repetido) {
          it = repetido;
        } else {
          const tel = parseTel(telC.value);
          const novo = {
            nome: nm,
            nomeBusca: norm(nm),
            tipo: tipoN.value,
            endereco: { rua: "", numero: "", bairro: bairro.value.trim(), cidade: cidade.value.trim() },
            contatos:
              contato.value.trim() || tel || emailC.value.trim()
                ? [
                    {
                      nome: contato.value.trim(),
                      cargo: cargoC.value,
                      tel: tel || telC.value.trim(),
                      email: emailC.value.trim().toLowerCase()
                    }
                  ]
                : [],
            segmentos: {},
            mediaAlunos: nMed,
            alunosEstimado: true,
            etapa: "A VISITAR",
            followup: null,
            visitas: [],
            tentativas: 0,
            resp: C.me || "",
            respEmail: C.email || "",
            criadoEm: new Date().toISOString(),
            atualizadoEm: new Date().toISOString(),
            origem: "agenda"
          };
          try {
            const ref = await FS.addDoc(col, novo);
            it = Object.assign({ id: ref.id }, novo);
            U.toast("Colégio cadastrado");
          } catch (e) {
            C.handleErr(e);
            return;
          }
        }
      }
      close();
      openEvento(it, tipoEv.value, dia);
    });
    setTimeout(() => grupos.querySelector("button").focus(), 30);
  });
}
