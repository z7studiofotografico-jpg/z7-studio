// Ajustes de uma turma (só admin): contrato (1º vencimento e fotos prontas), tabela de kits da turma e importação.
// Separado de turma.js; a lista de formandos fica lá.
import { lerReais, dividir, proxVenc } from "./regras.js";
import { kitsDe, kitsPadrao, ehAdesao, proximoVenc } from "./contrato.js";
import { el, title, norm, field, sheet, botoes, avisoErro, carregarLib } from "./ui.js";
import { editorPrecos, soDiferencas } from "./precos.js";
import * as U from "./util.js";
let C, FS, db;
const n0 = v => Number(v) || 0;
const hoje = () => U.todayStr();
function setCtx(ctx) {
  C = ctx;
  FS = ctx.FS;
  db = ctx.db;
}

// Uma linha da planilha → formando (puro, testado em tests/turma-ajustes.test.mjs).
// Kit pelo número (01 a 05); sem kit = Kit 01 (adesão é obrigatória).
const pega = (r, ...ks) => {
  const e = Object.entries(r).find(([k]) => ks.some(x => norm(k).includes(norm(x))));
  return e ? e[1] : "";
};
const isoDe = v =>
  v instanceof Date
    ? `${v.getFullYear()}-${U.pad(v.getMonth() + 1)}-${U.pad(v.getDate())}`
    : /^(\d{2})\/(\d{2})\/(\d{4})$/.test(String(v).trim())
      ? String(v)
          .trim()
          .replace(/^(\d{2})\/(\d{2})\/(\d{4})$/, "$3-$2-$1")
      : "";
export function formandoDaLinha(r, kits, inst, hojeIso) {
  const kTxt = String(pega(r, "kit", "produto", "pacote")).trim(),
    num = (kTxt.match(/0?([1-5])\b/) || [])[1],
    k = num ? kits.find(x => x.id === "k0" + num) : null,
    cola = /COLA|ADESAO/.test(norm(pega(r, "contrato", "colacao", "tipo")));
  const kk = k || (cola ? kits.find(x => x.id === "k01") : null);
  const valor = lerReais(pega(r, "valor", "preco", "total")) || (kk ? Number(kk.ant.valor) || 0 : 0);
  const kk1 = kk || (!kTxt ? kits.find(x => x.id === "k01") : null);
  return {
    contrato: kk1 && ehAdesao(kk1.id) ? "adesao" : "album",
    kitId: kk1 ? kk1.id : "outro",
    kit: kk1 ? kk1.nome : kTxt,
    venda: "ant",
    status: "ativo",
    nome: String(pega(r, "nome", "formando", "aluno")).trim(),
    tel: String(pega(r, "telefone", "celular", "whats", "tel")).trim(),
    serie: String(pega(r, "serie", "turma", "ano")).trim(),
    valor: valor || (kk1 ? Number(kk1.ant.valor) || 0 : 0),
    parcelas: Math.max(1, n0(pega(r, "parcela")) || (kk1 ? Number(kk1.ant.parcelas) || 1 : 1)),
    primeiroVenc: isoDe(pega(r, "venc")) || (inst.contratoTurma || {}).inicio || proximoVenc(hojeIso),
    formaPag: String(pega(r, "pagamento", "forma")).trim(),
    pagasPlan: n0(pega(r, "paga"))
  };
}

export function contratoTurma(ctx, inst, desenhar) {
  setCtx(ctx);
  sheet("Contrato da turma · " + title(inst.nome), (fp, fechar) => {
    const ct = inst.contratoTurma || {};
    fp.append(
      el(
        "p",
        "hint",
        "As parcelas do contrato vencem todo dia 05. Quem compra antecipado depois do início paga em menos parcelas e termina junto com a turma."
      )
    );
    const ini = el("input");
    ini.type = "date";
    ini.value = ct.inicio || proximoVenc(hoje());
    const prontas = el("input");
    prontas.type = "date";
    prontas.value = ct.fotosProntasEm || "";
    const r = el("div", "row2");
    r.append(field("1º vencimento da turma", ini), field("📸 Fotos prontas em (libera a oferta)", prontas));
    const hoje0 = U.mkBtn("📸 As fotos ficaram prontas hoje", "btn-verde", () => {
      prontas.value = hoje();
    });
    fp.append(r, hoje0);
    fp.append(
      el(
        "p",
        "hint",
        "O antecipado vale até o dia da formatura. Quando as fotos ficarem prontas, o card Formaturas avisa para quem oferecer os kits."
      )
    );
    fp.append(botoes(fechar, "Salvar"));
    fp.addEventListener("submit", async ev => {
      ev.preventDefault();
      const novo = { inicio: ini.value, fotosProntasEm: prontas.value || "" };
      try {
        await FS.updateDoc(FS.doc(db, "instituicoes", inst.id), { contratoTurma: novo, atualizadoEm: new Date().toISOString() });
        inst.contratoTurma = novo;
        fechar();
        U.toast("Contrato da turma salvo");
        desenhar();
      } catch (e) {
        C.handleErr(e);
      }
    });
  });
}
// Tabela só desta turma (o Adriano ou a Luciana mudam valores e vezes); vazio = igual à tabela padrão
export function kitsTurma(ctx, inst, desenhar) {
  setCtx(ctx);
  const padrao = kitsPadrao(C.P),
    atual = kitsDe(C.P, inst);
  sheet("Kits desta turma · " + title(inst.nome), (fp, fechar) => {
    fp.append(el("p", "hint", "Valores e vezes só deste colégio. O que ficar igual à tabela padrão segue a tabela padrão."));
    const ed = editorPrecos(fp, atual, { padrao, sufixo: " (turma)", bloqueado: !C.isAdmin });
    const a = botoes(fechar, "Salvar tabela da turma");
    const volta = el("button", "btn", "Voltar à tabela padrão");
    volta.type = "button";
    volta.onclick = async () => {
      try {
        await FS.updateDoc(FS.doc(db, "instituicoes", inst.id), { kits: FS.deleteField(), atualizadoEm: new Date().toISOString() });
        delete inst.kits;
        fechar();
        U.toast("Turma voltou para a tabela padrão");
        desenhar();
      } catch (e) {
        C.handleErr(e);
      }
    };
    a.prepend(volta);
    fp.append(a);
    fp.addEventListener("submit", async ev => {
      ev.preventDefault();
      const kits = soDiferencas(ed.ler(), padrao);
      try {
        await FS.updateDoc(FS.doc(db, "instituicoes", inst.id), { kits, atualizadoEm: new Date().toISOString() });
        inst.kits = kits;
        fechar();
        U.toast(kits.length ? "Tabela da turma salva" : "Igual à tabela padrão");
        desenhar();
      } catch (e) {
        C.handleErr(e);
      }
    });
  });
}
// lista = formandos já cadastrados na turma (quem já está não entra de novo)
export function importarFormandos(ctx, inst, lista) {
  setCtx(ctx);
  const col = FS.collection(db, "formandos");
  sheet("Importar formandos", (fp, fechar) => {
    fp.append(
      el(
        "p",
        "hint",
        "Planilha do Excel com as colunas (os nomes podem variar): NOME, TELEFONE, SÉRIE, KIT (01 a 05), VALOR, PARCELAS, PAGAS, VENCIMENTO e PAGAMENTO. Só o nome é obrigatório; quem vier sem kit entra com o Kit 01 (adesão)."
      )
    );
    const file = el("input");
    file.type = "file";
    file.accept = ".xlsx,.xls,.csv";
    fp.append(file);
    const prev = el("div", "imp");
    fp.append(prev);
    const a = botoes(fechar, "Importar");
    a.ok.disabled = true;
    fp.append(a);
    let linhas = [];
    file.onchange = async () => {
      prev.textContent = "Lendo…";
      try {
        const XLSX = await carregarLib("xlsx");
        const wb = XLSX.read(await file.files[0].arrayBuffer(), { cellDates: true });
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
        const ja = new Set(lista.map(f => norm(f.nome)));
        const kits = kitsDe(C.P, inst);
        linhas = rows.map(r => formandoDaLinha(r, kits, inst, hoje())).filter(x => x.nome && !ja.has(norm(x.nome)));
        prev.textContent = linhas.length
          ? `${linhas.length} formando${linhas.length > 1 ? "s" : ""} novo${linhas.length > 1 ? "s" : ""}: ${linhas
              .slice(0, 5)
              .map(x => title(x.nome))
              .join(", ")}${linhas.length > 5 ? "…" : ""}`
          : "Nenhum formando novo na planilha.";
        a.ok.disabled = !linhas.length;
      } catch (e) {
        avisoErro(e, "ler a planilha");
        prev.textContent = "Não consegui ler a planilha.";
      }
    };
    fp.addEventListener("submit", async ev => {
      ev.preventDefault();
      a.ok.disabled = true;
      let n = 0;
      const agora = new Date().toISOString();
      try {
        // grava em lotes: cada lote entra inteiro ou não entra
        for (let i = 0; i < linhas.length; i += 400) {
          const b = FS.writeBatch(db);
          linhas.slice(i, i + 400).forEach(x => {
            const pg = Math.min(x.pagasPlan, x.parcelas),
              vals = dividir(x.valor, x.parcelas);
            delete x.pagasPlan;
            const d = Object.assign(x, {
              pagamentos: Array.from({ length: pg }, (_, k) => ({ data: hoje(), valor: vals[k], por: C.email || "" })),
              pagas: pg,
              instId: inst.id,
              instNome: inst.nome,
              instTipo: inst.tipo || "",
              ano: Number(hoje().slice(0, 4)),
              resp: inst.resp || "",
              respEmail: inst.respEmail || "",
              vendidoEm: hoje(),
              criadoEm: agora,
              por: C.me || ""
            });
            d.proxVenc = proxVenc(d);
            b.set(FS.doc(col), d);
          });
          await b.commit();
          n = Math.min(linhas.length, i + 400);
          prev.textContent = `Importando… ${n} de ${linhas.length}`;
        }
        fechar();
        U.toast(`${n} formando${n > 1 ? "s" : ""} importado${n > 1 ? "s" : ""}`);
      } catch (e) {
        C.handleErr(e);
        prev.textContent = `Importados ${n} de ${linhas.length}. Importe de novo: quem já entrou não é duplicado.`;
        a.ok.disabled = false;
      }
    });
  });
}
