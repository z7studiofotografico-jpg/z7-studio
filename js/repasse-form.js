// PR: dados do formando (completar ou corrigir) e "+ Aluno" (incluir à mão, sem planilha)
import { el, title } from "./ui.js";
import * as U from "./util.js";
import { norm, faltando, docId } from "./repasse-dados.js";
import { codigoBusca, comAno, avisoTel } from "./aluno-id.js";
import { procurarRepetido, pedirAluno, indexarFones, gerarCodigoPR } from "./pedidos.js";
import { C, FS, db, tab, seg, meta, ANO, segDe, save, tela } from "./repasse-estado.js";
import { sheet, field, actions } from "./repasse-janelas.js";
import { refreshStats, refreshLote } from "./repasse-lote.js";
// ID do aluno novo (26CEPNCP-01): ver gerarCodigoPR em pedidos.js
const gerarCodigo = d => gerarCodigoPR(C, d, Object.keys(meta.escolas || {}));

// Dados do formando; sem "it" = aluno novo incluído à mão (sem planilha)
export function openDados(it) {
  const novo = !it;
  it = it || { nome: "", escola: "", ano: seg === "lf" ? ANO() : ANO() - 1, contatos: [] };
  sheet(novo ? "Incluir aluno no PR" : "Dados do formando", (p, close) => {
    const mk = (v, ph) => {
      const i = el("input");
      i.value = v || "";
      i.placeholder = ph || "";
      i.maxLength = 120;
      return i;
    };
    const nome = mk(title(it.nome)),
      escola = mk(title(it.escola)),
      ano = mk(it.ano || "", "2025");
    ano.inputMode = "numeric";
    const r1 = el("div", "row2");
    r1.append(field("Colégio", escola), field("Ano", ano));
    // ID do aluno (separação das fotos): o app dá o próximo número do colégio; dá para trocar
    const codigo = mk(it.codigo || "", novo ? "automático (ex.: 26CEPNCP-07)" : "ex.: 26CEPNCP-07");
    codigo.maxLength = 30;
    codigo.autocapitalize = "characters";
    p.append(field("Nome do aluno", nome), r1, field("ID do aluno", codigo));
    // colégios que já existem no PR (para escrever igual)
    const dlE = el("datalist");
    dlE.id = "rEscolas" + Date.now();
    Object.keys(meta.escolas || {}).forEach(n => {
      const o = el("option");
      o.value = title(n);
      dlE.append(o);
    });
    escola.setAttribute("list", dlE.id);
    p.append(dlE);
    let curso = null,
      turma = null;
    if (novo) {
      nome.required = true;
      curso = mk("", "ex.: Ensino Médio");
      turma = mk("", "ex.: 3001");
      const r2 = el("div", "row2");
      r2.append(field("Curso / série", curso), field("Turma", turma));
      p.append(r2);
    }
    p.append(el("h3", null, "Contatos"));
    const linhas = [];
    const lista = el("div", "imp");
    p.append(lista);
    const addLinha = (c = { tipo: "Mãe", nome: "", tel: "" }) => {
      const tp = el("select");
      ["Mãe", "Pai", "Responsável", "Formando", "Telefone", "Outro"].forEach(x => {
        const o = el("option", null, x);
        o.value = x;
        tp.append(o);
      });
      tp.value = c.tipo || "Outro";
      const nm = mk(title(c.nome), "nome");
      const tl = mk(c.tel, "21 99999-9999");
      tl.inputMode = "tel";
      const row = el("div", "row3");
      row.append(field("Quem", tp), field("Nome", nm), field("WhatsApp", tl));
      lista.append(row);
      // telefone que com certeza está errado: avisa na hora (não impede salvar)
      const av = el("p", "wait");
      av.hidden = true;
      lista.append(av);
      const conferir = () => {
        const a = tl.value.replace(/\D/g, "").length >= 4 ? avisoTel(tl.value) : "";
        av.textContent = a ? "⚠️ Confira este número: " + a + ". Se o WhatsApp abrir dizendo que o número não existe, peça outro." : "";
        av.hidden = !a;
      };
      tl.addEventListener("input", conferir);
      conferir();
      linhas.push({ tp, nm, tl });
    };
    (it.contatos && it.contatos.length ? it.contatos : [novo ? { tipo: "Mãe" } : {}]).forEach(addLinha);
    const add = U.mkBtn("+ Adicionar contato", "", () => addLinha());
    p.append(add);
    // admin: escolhe quem cuida do contato (inclusive os antigos cujo responsável não está ligado a ninguém da Equipe)
    let respSel = null;
    if (!novo && C.isAdmin) {
      respSel = el("select");
      const pessoas = Object.entries(C.usuarios || {})
        .filter(([, u]) => u && u.nome && u.ativo !== false)
        .sort((a, b) => a[1].nome.localeCompare(b[1].nome, "pt-BR"));
      [["", "Ninguém (livre)"], ...pessoas.map(([em, u]) => [em, u.nome])].forEach(([v, t]) => {
        const o = el("option", null, t);
        o.value = v;
        respSel.append(o);
      });
      respSel.value = it.respEmail || "";
      p.append(field("Responsável", respSel));
      if (it.resp && !it.respEmail)
        p.append(
          el("p", "wait", `⚠️ Responsável antigo: “${title(it.resp)}”, sem cadastro na Equipe. Escolha acima quem cuida deste contato.`)
        );
    }
    // quem é da equipe trabalha o que cadastrou: o aluno entra direto na carteira de quem incluiu
    if (novo && !C.isAdmin)
      p.append(
        el(
          "p",
          "hint",
          "O aluno entra na sua lista (Para hoje). Se ele já estiver no PR, o Adriano ou a Luciana decidem se passa para você."
        )
      );
    const erro = el("p", "err");
    erro.hidden = true;
    p.append(erro);
    p.append(actions(close, "Salvar"));
    // aluno novo: entra na fila (ou já separado para quem incluiu), como se tivesse vindo da planilha
    async function criar(d, falta) {
      if (!d.nome) {
        erro.textContent = "Coloque o nome do aluno.";
        erro.hidden = false;
        return;
      }
      // colégio que já existe no PR escrito de outro jeito (maiúsculas, acento): usa o nome que já está lá
      const jaExiste = Object.keys(meta.escolas || {}).find(n => norm(n) === norm(d.escola));
      if (jaExiste) d.escola = jaExiste;
      const agora = new Date().toISOString(),
        hoje = U.todayStr(),
        daEquipe = !C.isAdmin,
        meu = daEquipe && !falta.length;
      const docNovo = Object.assign(d, {
        curso: curso ? curso.value.trim() : "",
        turma: turma ? turma.value.trim() : "",
        dataEnsaio: "",
        endereco: {},
        obs: "",
        etapa: falta.length ? "INCOMPLETO" : meu ? "SEPARADO" : "NA FILA",
        followup: meu ? hoje : null,
        tentativas: 0,
        tentInteresse: 0,
        resp: daEquipe ? C.me || "" : "",
        respEmail: daEquipe ? C.email || "" : "",
        ...(meu ? { separadoEm: hoje, separadoSeg: d.ano >= ANO() ? "lf" : "rep" } : {}),
        manual: true,
        incluidoPor: C.email || "",
        importadoEm: agora,
        atualizadoEm: agora
      });
      // aluno que já está no PR: não grava por cima. A equipe manda um pedido para o admin decidir.
      const repetido = async r => {
        if (C.isAdmin) {
          const troca = (r.comparacao || {}).trocouColegio
            ? ` Atenção: parece que trocou de colégio (${title(r.escola)} → ${title(docNovo.escola)}).`
            : "";
          erro.textContent = `${title(r.nome)} já está no PR (${title(r.escola)}${r.ano ? ", " + r.ano : ""}). Procure pela busca.${troca}`;
          erro.hidden = false;
          return;
        }
        if (r.respEmail && r.respEmail === C.email) {
          erro.textContent = `${title(r.nome)} já está na sua lista. Procure pela busca.`;
          erro.hidden = false;
          return;
        }
        const aviso = await pedirAluno(C, r, docNovo);
        close();
        U.toast(aviso);
      };
      try {
        const achado = await procurarRepetido(C, docNovo);
        if (achado) return await repetido(achado);
        if (!docNovo.codigo) docNovo.codigo = await gerarCodigo(docNovo).catch(e => (console.warn("[Z7] ID do aluno", e), ""));
        docNovo.codigoBusca = docNovo.codigo ? codigoBusca(docNovo.codigo) : "";
        // cria só se ainda não existe (transação): nunca sobrescreve um aluno que já está no PR
        const ref = FS.doc(db, "repasse", docId(docNovo, Date.now()));
        const existente = await FS.runTransaction(db, async tx => {
          const s0 = await tx.get(ref);
          if (s0.exists()) return Object.assign({ id: ref.id }, s0.data());
          tx.set(ref, docNovo);
          indexarFones(FS, db, tx, ref.id, docNovo); // telefones no índice: acha a família depois, em outro ano ou colégio
          return null;
        });
        if (existente) return await repetido(existente);
        close();
        U.toast(
          (docNovo.codigo ? "ID " + docNovo.codigo + " · " : "") +
            (falta.length
              ? "Incluído. Ainda falta: " + falta.join(", ") + (C.isAdmin ? " (aba Incompletos)" : " (aba Meus incompletos)")
              : meu
                ? "Incluído e separado para você ✅"
                : "Incluído na fila ✅")
        );
        refreshStats();
        refreshLote();
        tela.openTab(meu ? "hoje" : falta.length ? "incompletos" : tab);
      } catch (e) {
        C.handleErr(e);
      }
    }
    p.addEventListener("submit", ev => {
      ev.preventDefault();
      const cs = [];
      const vistos = new Set();
      linhas.forEach(({ tp, nm, tl }) => {
        const d = tl.value.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
        if (d.length >= 10 && d.length <= 11 && !vistos.has(d)) {
          vistos.add(d);
          cs.push({ tipo: tp.value, nome: nm.value.trim(), tel: d });
        }
      });
      const patch = {
        nome: nome.value.trim(),
        nomeBusca: norm(nome.value),
        escola: escola.value.trim(),
        ano: Number(ano.value) || null,
        contatos: cs,
        telefones: cs.map(c => c.tel)
      };
      // ID digitado sem o ano ganha o ano do aluno (CEPNCP-7 → 26CEPNCP-07)
      if (respSel && respSel.value !== (it.respEmail || "")) {
        const u = (C.usuarios || {})[respSel.value];
        Object.assign(patch, { respEmail: respSel.value, resp: u ? u.nome : "" });
      }
      const cod = codigo.value.trim() ? comAno(codigo.value.trim().toUpperCase(), Number(ano.value) || ANO()) : "";
      if (novo || cod !== (it.codigo || "")) Object.assign(patch, { codigo: cod, codigoBusca: cod ? codigoBusca(cod) : "" });
      const falta = faltando(patch);
      if (novo) {
        // falta algo (ex.: nome da mãe)? avisa antes; tocando de novo, salva assim mesmo (vai para Incompletos)
        if (falta.length && !p._mesmoAssim) {
          p._mesmoAssim = true;
          erro.textContent = `Falta: ${falta.join(", ")}. Complete, ou toque em Salvar de novo para incluir assim mesmo (fica em Incompletos até completar).`;
          erro.hidden = false;
          return;
        }
        return criar(patch, falta);
      }
      if (it.etapa === "INCOMPLETO" || it.etapa === "NA FILA") {
        // aluno de alguém da equipe: completo, volta para a lista dessa pessoa; sem dono, vai para a fila
        const dono = it.etapa === "INCOMPLETO" && it.respEmail;
        patch.etapa = falta.length ? "INCOMPLETO" : dono ? "SEPARADO" : "NA FILA";
        if (!falta.length && dono)
          Object.assign(patch, { followup: U.todayStr(), separadoEm: it.separadoEm || U.todayStr(), separadoSeg: segDe(it) });
      }
      close();
      // telefone novo entra no índice (para achar a família depois); se falhar, não atrapalha o salvar
      const novosTels = patch.telefones.filter(t => !(it.telefones || []).includes(t));
      if (novosTels.length) {
        const b = FS.writeBatch(db);
        indexarFones(FS, db, b, it.id, Object.assign({}, it, patch, { telefones: novosTels, contatos: [] }));
        b.commit().catch(e => console.warn("[Z7] índice de telefones", e));
      }
      save(
        it,
        patch,
        falta.length
          ? "Salvo. Ainda falta: " + falta.join(", ")
          : it.etapa === "INCOMPLETO"
            ? "Completo! Entrou na fila ✅"
            : "Dados salvos"
      );
    });
  });
}
