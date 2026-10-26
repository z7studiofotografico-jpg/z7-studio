// Turma de um colégio FECHADO: formandos, contrato (álbum de formatura ou colação de grau), parcelas e cobrança.
// Coleção "formandos": { instId, instNome, nome, tel, serie, contrato, kit, valor, parcelas, primeiroVenc, formaPag,
//   pagamentos: [{ data, valor, por }], pagas (= quantidade de pagamentos), proxVenc, status, resp, respEmail, vendidoEm }
// Regras de parcela e dinheiro: js/regras.js. Só o administrador registra pagamento e muda valores.
import {
  lerReais,
  brl,
  dividir,
  pagamentosDe,
  pagasDe,
  nParcelas,
  quitado,
  atrasado as atrasadoEm,
  vencDa,
  valorParcela,
  recebido,
  emAberto,
  somar,
  proxVenc,
  ehColacao,
  FORMAS
} from "./regras.js";
import { ESTUDIO } from "./mensagens.js";
import { el, title, norm, field, inp, inpReais, sel, sheet, botoes, wa, avisoErro, carregarLib, emPartes } from "./ui.js";
import * as U from "./util.js";
let C,
  FS,
  db,
  unsub = null;
const n0 = v => Number(v) || 0;
const hoje = () => U.todayStr();
export const atrasado = f => atrasadoEm(f, hoje());
export { quitado, ehColacao, vencDa };

// Kits do contrato (opcionais), com valor total e parcelas; vencimento todo dia 5
export const KITS_CONTRATO = [
  { nome: "Kit 01 · Beca + canudo", valor: 65, parcelas: 1 },
  { nome: "Kit 02 · Ensaio + fotos digitais + canudo", valor: 369, parcelas: 9 },
  { nome: "Kit 03 · Quadro 30x40 + 2 porta-retratos", valor: 533, parcelas: 10 },
  { nome: "Kit 04 · Álbum revista 21x30 (170g)", valor: 850, parcelas: 10 },
  { nome: "Kit 05 · Álbum Layflat 21x30 (500g)", valor: 1350, parcelas: 10 }
];
export function setCtx(ctx) {
  C = ctx;
  FS = ctx.FS;
  db = ctx.db;
}

// Registra a próxima parcela paga numa transação (duas pessoas ao mesmo tempo não se atropelam)
export async function registrarPagamento(f) {
  const ref = FS.doc(db, "formandos", f.id);
  const r = await FS.runTransaction(db, async tx => {
    const s = await tx.get(ref);
    if (!s.exists()) throw new Error("não encontrado");
    const atual = Object.assign({ id: f.id }, s.data());
    if (quitado(atual)) return { ja: true, n: pagasDe(atual) };
    const lst = pagamentosDe(atual).slice(),
      n = lst.length + 1;
    lst.push({ data: hoje(), valor: valorParcela(atual, n), por: C.email || "" });
    const novo = Object.assign({}, atual, { pagamentos: lst });
    tx.update(ref, {
      pagamentos: lst,
      pagas: lst.length,
      proxVenc: proxVenc(novo),
      ultimoPag: hoje(),
      atualizadoEm: new Date().toISOString()
    });
    return { n };
  });
  U.toast(r.ja ? "Esse formando já está quitado" : `Parcela ${r.n} de ${U.first(title(f.nome))} registrada`);
}
// Desfaz o último pagamento (lançado por engano)
async function desfazerPagamento(f) {
  const ref = FS.doc(db, "formandos", f.id);
  await FS.runTransaction(db, async tx => {
    const s = await tx.get(ref);
    const atual = Object.assign({ id: f.id }, s.data());
    const lst = pagamentosDe(atual).slice(0, -1),
      novo = Object.assign({}, atual, { pagamentos: lst });
    tx.update(ref, { pagamentos: lst, pagas: lst.length, proxVenc: proxVenc(novo), atualizadoEm: new Date().toISOString() });
  });
  U.toast("Último pagamento desfeito");
}

// Mensagem de cobrança no WhatsApp (usada aqui e no card Formaturas)
export function cobrarWa(f) {
  const prox = pagasDe(f) + 1,
    venc = vencDa(f, prox),
    col = ehColacao(f);
  const item = col ? "da colação de grau" : `do álbum de formatura (${f.kit || "kit"})`;
  const pagar = col ? "\nO pagamento é pelo boleto." : C.P.pix ? `\nChave Pix: ${C.P.pix}` : "";
  const valor = brl(valorParcela(f, prox)),
    nome = U.first(title(f.nome));
  const msg = atrasado(f)
    ? `Oi, ${nome}! Aqui é do ${ESTUDIO.nome} 📸 Passando para lembrar da parcela ${prox}/${nParcelas(f)} ${item}, de ${valor}, que venceu ${venc ? "dia " + U.fmtDate(venc) : "este mês"}.${pagar}\nPode me mandar o comprovante por aqui? Se já pagou, é só desconsiderar 😊`
    : `Oi, ${nome}! Aqui é do ${ESTUDIO.nome} 📸 Só lembrando que a parcela ${prox}/${nParcelas(f)} ${item}, de ${valor}, vence ${venc ? "dia " + U.fmtDate(venc) : "em breve"}.${pagar}\nQualquer dúvida, estou por aqui 😊`;
  wa(f.tel, msg, U.toast);
}
// Vencimento padrão do contrato: dia 5 (deste mês se ainda não passou, senão do próximo)
function dia5() {
  const t = new Date();
  const d = new Date(t.getFullYear(), t.getMonth() + (t.getDate() > 5 ? 1 : 0), 5);
  return `${d.getFullYear()}-${U.pad(d.getMonth() + 1)}-05`;
}

export function openTurma(ctx, inst, kits, aoFechar) {
  setCtx(ctx);
  const col = FS.collection(db, "formandos");
  let lista = [],
    filtro = "todos",
    busca = "";
  const close = sheet(
    null,
    (p, fechar) => {
      const head = el("div", "vhead");
      head.append(el("h2", null, "Formandos · " + title(inst.nome)), U.mkBtn("Fechar", "btn-sm", fechar));
      p.append(head);
      const resumo = el("div", "kpis");
      p.append(resumo);
      // Quantidade de alunos: começa pela média (combinada com o colégio); depois das fotos confirma a certa
      const qtdBox = el("div", "notes");
      p.append(qtdBox);
      const bar = el("div", "actions");
      bar.append(U.mkBtn("+ Formando", "btn-primary", () => form()));
      if (C.isAdmin) bar.append(U.mkBtn("Importar planilha", "", () => importar()));
      const colTxt = () =>
        inst.colacao && inst.colacao.valor
          ? `🎓 Colação: ${brl(inst.colacao.valor)} em ${inst.colacao.parcelas || 1}x`
          : "🎓 Valor da colação";
      if (C.isAdmin) {
        const bc = U.mkBtn(colTxt(), "", () => valorColacao(bc, colTxt));
        bar.append(bc);
      }
      p.append(bar);
      if (!C.isAdmin)
        p.append(el("p", "hint", "Você cadastra os formandos. Pagamentos e valores são lançados pelo Adriano ou pela Luciana."));
      const chips = el("div", "chips");
      p.append(chips);
      const q = inp("", "Buscar nome ou telefone");
      q.type = "search";
      q.className = "search";
      q.oninput = () => {
        busca = norm(q.value);
        desenhar();
      };
      p.append(q);
      const lst = el("div", "grid");
      p.append(lst);
      unsub = FS.onSnapshot(
        C.isAdmin ? FS.query(col, FS.where("instId", "==", inst.id), FS.limit(2000)) : C.carteira("formandos"),
        snap => {
          lista = snap.docs
            .map(d => Object.assign({ id: d.id }, d.data()))
            .filter(f => f.instId === inst.id)
            .sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));
          desenhar();
        },
        e => {
          avisoErro(e, "carregar os formandos");
          lst.innerHTML = "";
          lst.append(
            el(
              "div",
              "empty",
              e.code === "permission-denied"
                ? "Cole as regras novas do Firebase para usar a lista de formandos."
                : "Não foi possível carregar."
            )
          );
        }
      );

      function desenhar() {
        const ativos = lista.filter(f => f.status !== "desistiu"),
          atr = ativos.filter(atrasado);
        const nomesUnicos = new Set(ativos.map(f => norm(f.nome))).size;
        qtdBox.innerHTML = "";
        qtdBox.append(
          document.createTextNode(
            inst.alunosConfirmados
              ? `Alunos confirmados: ${inst.alunosConfirmados} · cadastrados aqui: ${nomesUnicos}`
              : `Previsão (média): ${inst.mediaAlunos ? "~" + inst.mediaAlunos : "não informada"} alunos · cadastrados aqui: ${nomesUnicos}`
          )
        );
        if (nomesUnicos && nomesUnicos !== inst.alunosConfirmados) {
          const b = U.mkBtn(`✔ Confirmar quantidade certa: ${nomesUnicos} alunos`, "btn-verde", async () => {
            try {
              await FS.updateDoc(FS.doc(db, "instituicoes", inst.id), {
                alunosConfirmados: nomesUnicos,
                alunosEstimado: false,
                alunosConfirmadosEm: hoje(),
                atualizadoEm: new Date().toISOString()
              });
              inst.alunosConfirmados = nomesUnicos;
              U.toast("Quantidade de alunos confirmada");
              desenhar();
            } catch (e) {
              C.handleErr(e);
            }
          });
          b.style.marginLeft = "8px";
          qtdBox.append(b);
        }
        const vendido = somar(ativos.map(f => f.valor)),
          rec = somar(ativos.map(recebido));
        resumo.innerHTML = "";
        [
          ["Formandos", String(ativos.length)],
          ["Vendido", brl(vendido)],
          ["Recebido", brl(rec)],
          ["Em aberto", brl(somar(ativos.map(emAberto)))],
          ["Atrasados", String(atr.length)]
        ].forEach(([t, v], i) => {
          const c = el("div", "kpi" + (i === 4 && atr.length ? " late" : ""));
          c.append(el("small", null, t), el("b", null, v));
          resumo.append(c);
        });
        chips.innerHTML = "";
        [
          ["todos", "Todos", ativos.length],
          ["atrasados", "Atrasados", atr.length],
          ["aberto", "Em dia", ativos.filter(f => !quitado(f) && !atrasado(f)).length],
          ["quitados", "Quitados", ativos.filter(quitado).length],
          ["album", "📘 Álbum", ativos.filter(f => !ehColacao(f)).length],
          ["colacao", "🎓 Colação", ativos.filter(ehColacao).length],
          ["desistiu", "Desistiram", lista.length - ativos.length]
        ].forEach(([k, t, n]) => {
          const b = el("button", "chip", t);
          b.type = "button";
          b.setAttribute("aria-pressed", String(filtro === k));
          b.append(el("span", "n", String(n)));
          b.onclick = () => {
            filtro = k;
            desenhar();
          };
          chips.append(b);
        });
        const passa = f =>
          filtro === "desistiu"
            ? f.status === "desistiu"
            : f.status !== "desistiu" &&
              {
                todos: true,
                atrasados: atrasado(f),
                quitados: quitado(f),
                aberto: !quitado(f) && !atrasado(f),
                album: !ehColacao(f),
                colacao: ehColacao(f)
              }[filtro];
        let arr = lista.filter(passa);
        if (busca)
          arr = arr.filter(
            f =>
              norm(f.nome + " " + f.tel + " " + f.serie).includes(busca) ||
              (busca.replace(/\D/g, "") &&
                String(f.tel || "")
                  .replace(/\D/g, "")
                  .includes(busca.replace(/\D/g, "")))
          );
        lst.innerHTML = "";
        if (!lista.length) {
          const e = el("div", "empty");
          e.append(
            el("strong", null, "Nenhum formando ainda"),
            el("span", null, "Toque em “+ Formando”" + (C.isAdmin ? " ou importe a planilha da turma." : "."))
          );
          lst.append(e);
          return;
        }
        if (!arr.length) {
          lst.append(el("div", "empty", "Ninguém nesse filtro."));
          return;
        }
        emPartes(lst, arr, card);
      }
      function card(f) {
        const at = atrasado(f),
          q0 = quitado(f),
          pg = pagasDe(f),
          np = nParcelas(f);
        const e = el("article", "card " + (f.status === "desistiu" ? "" : at ? "late" : q0 ? "won" : ""));
        const top = el("div", "card-top");
        top.append(
          el("h3", "name", title(f.nome)),
          el("span", "stage", f.status === "desistiu" ? "DESISTIU" : q0 ? "QUITADO" : at ? "ATRASADO" : "EM DIA")
        );
        e.append(top);
        const meta = el("div", "meta");
        [
          f.serie,
          ehColacao(f) ? "🎓 Colação de grau" : "📘 " + (f.kit || "Álbum de formatura"),
          f.valor ? brl(f.valor) : "",
          ehColacao(f) ? "Boleto" : f.formaPag,
          f.tel
        ]
          .filter(Boolean)
          .forEach((t, i) => meta.append(el("span", "tag" + (i === 1 ? " svc" : ""), t)));
        e.append(meta);
        e.append(
          el(
            "div",
            "fu " + (at ? "late" : ""),
            q0
              ? `${np}/${np} parcelas pagas ✓`
              : `${pg}/${np} pagas · ${brl(valorParcela(f, pg + 1))} por parcela` +
                  (f.primeiroVenc ? ` · ${at ? "venceu" : "vence"} ${U.fmtDate(vencDa(f, pg + 1))}` : "")
          )
        );
        if (f.obs) e.append(el("p", "notes", f.obs));
        const act = el("div", "actions");
        if (C.isAdmin && f.status !== "desistiu" && !q0)
          act.append(U.mkBtn("✅ Parcela paga", "btn-ok", () => registrarPagamento(f).catch(er => C.handleErr(er))));
        if (f.status !== "desistiu" && !q0 && f.tel) act.append(U.mkBtn("💬 Cobrar", at ? "btn-primary" : "", () => cobrarWa(f)));
        act.append(U.mkBtn("Editar", "", () => form(f)));
        e.append(act);
        return e;
      }

      function form(f) {
        const adm = C.isAdmin;
        sheet(f ? "Editar formando" : "Novo formando", (fp, fechar) => {
          const nome = inp(f ? title(f.nome) : "", "nome do formando");
          nome.required = true;
          nome.disabled = !!f && !adm;
          const tel = inp(f ? f.tel : "", "WhatsApp do responsável", 30);
          tel.inputMode = "tel";
          const r1 = el("div", "row2");
          r1.append(field("Nome", nome), field("WhatsApp", tel));
          fp.append(r1);
          const contrato = sel(
            [
              ["album", "📘 Álbum de formatura (kit)"],
              ["colacao", "🎓 Colação de grau"]
            ],
            f && ehColacao(f) ? "colacao" : "album"
          );
          fp.append(field("Contrato", contrato));
          const serie = sel(["Pré", "5º ano", "9º ano", "Ensino médio", "Outra"], f ? f.serie : "", "série");
          const kit = inp(f ? f.kit : "", "ex.: Kit 04");
          const dl = el("datalist");
          dl.id = "tmKits" + Date.now();
          kit.setAttribute("list", dl.id);
          KITS_CONTRATO.forEach(k => {
            const o = el("option");
            o.value = k.nome;
            o.label = `${k.parcelas}x de ${brl(dividir(k.valor, k.parcelas)[0])} = ${brl(k.valor)}`;
            dl.append(o);
          });
          (kits || []).forEach(k => {
            const o = el("option");
            o.value = k.nome;
            dl.append(o);
          });
          const r2 = el("div", "row2");
          r2.append(field("Série", serie), field("Kit", kit));
          fp.append(r2, dl);
          const valor = inpReais(f ? f.valor : "");
          const parc = inp(f ? f.parcelas || "" : "1", "1", 3);
          parc.inputMode = "numeric";
          const jaPagas = inp("0", "0", 3);
          jaPagas.inputMode = "numeric";
          const r3 = el("div", f ? "row2" : "row3");
          r3.append(field("Valor total", valor), field("Parcelas", parc));
          if (!f && adm) r3.append(field("Parcelas já pagas", jaPagas));
          fp.append(r3);
          const venc = el("input");
          venc.type = "date";
          venc.value = f ? f.primeiroVenc || "" : dia5();
          const fpg = sel(FORMAS, f ? f.formaPag : "", "forma de pagamento");
          const st = sel(
            [
              ["ativo", "Comprou"],
              ["desistiu", "Desistiu"]
            ],
            f ? f.status || "ativo" : "ativo"
          );
          const r4 = el("div", "row3");
          r4.append(field("1º vencimento", venc), field("Pagamento", fpg), field("Situação", st));
          fp.append(r4);
          const parcInfo = el("p", "hint");
          fp.append(parcInfo);
          const atualizaInfo = () => {
            const v = lerReais(valor.value),
              n = Math.max(1, n0(parc.value));
            const ps = dividir(v, n);
            parcInfo.textContent = v
              ? `${n}x de ${brl(ps[ps.length - 1])}${ps[0] !== ps[ps.length - 1] ? ` (a 1ª de ${brl(ps[0])})` : ""}`
              : "";
          };
          valor.addEventListener("input", atualizaInfo);
          parc.addEventListener("input", atualizaInfo);
          kit.addEventListener("change", () => {
            const kc = KITS_CONTRATO.find(x => x.nome === kit.value);
            if (kc) {
              valor.value = String(kc.valor).replace(".", ",");
              parc.value = kc.parcelas;
              venc.value = dia5();
              atualizaInfo();
              return;
            }
            const k = (kits || []).find(x => x.nome === kit.value);
            if (k && k.preco && !valor.value) {
              valor.value = String(k.preco).replace(".", ",");
              atualizaInfo();
            }
          });
          const colHint = el("p", "hint");
          fp.append(colHint);
          const syncC = () => {
            const ehCol = contrato.value === "colacao";
            r2.querySelector(".field:last-child").hidden = ehCol;
            if (ehCol) fpg.value = "Boleto";
            const cfg = inst.colacao || {};
            colHint.hidden = !ehCol;
            colHint.textContent = cfg.valor
              ? `Colação de grau desta turma: ${brl(cfg.valor)} em ${cfg.parcelas || 1}x no boleto.`
              : "O valor da colação de grau desta turma ainda não foi definido (o Adriano define no botão “🎓 Valor da colação”).";
            if (ehCol && !f && cfg.valor) {
              valor.value = String(cfg.valor).replace(".", ",");
              parc.value = cfg.parcelas || 1;
              if (cfg.primeiroVenc) venc.value = cfg.primeiroVenc;
            }
            atualizaInfo();
          };
          contrato.onchange = syncC;
          syncC();
          // Depois de cadastrado, só o admin muda dinheiro e contrato
          if (f && !adm)
            [contrato, serie, kit, valor, parc, venc, fpg, st].forEach(i => {
              i.disabled = true;
            });
          if (f && !adm) fp.append(el("p", "hint", "Valores, contrato e situação só o Adriano ou a Luciana mudam."));
          // Pagamentos já lançados (só admin desfaz)
          if (f && pagasDe(f)) {
            const box = el("div", "notes");
            box.textContent =
              "Pagamentos: " +
              pagamentosDe(f)
                .map((pg, i) => `${i + 1}ª ${brl(pg.valor)} em ${pg.data ? U.fmtDate(pg.data) : "—"}`)
                .join(" · ");
            fp.append(box);
            if (adm) {
              const b = el("button", "btn btn-sm", "Desfazer o último pagamento");
              b.type = "button";
              b.onclick = async () => {
                if (!fp._desf) {
                  fp._desf = true;
                  b.textContent = "Toque de novo para desfazer";
                  return;
                }
                try {
                  await desfazerPagamento(f);
                  fechar();
                } catch (er) {
                  C.handleErr(er);
                }
              };
              fp.append(b);
            }
          }
          const obs = el("textarea");
          obs.rows = 2;
          obs.maxLength = 500;
          obs.value = f ? f.obs || "" : "";
          fp.append(field("Observação", obs));
          const err = el("p", "err");
          err.hidden = true;
          fp.append(err);
          const a = botoes(fechar, "Salvar");
          if (f && adm) {
            const del = el("button", "btn btn-danger", "Excluir");
            del.type = "button";
            del.onclick = async () => {
              if (!fp._del) {
                fp._del = true;
                del.textContent = "Toque de novo";
                return;
              }
              try {
                await FS.deleteDoc(FS.doc(db, "formandos", f.id));
                fechar();
                U.toast("Excluído");
              } catch (er) {
                C.handleErr(er);
              }
            };
            a.prepend(del);
          }
          fp.append(a);
          setTimeout(() => (f ? tel : nome).focus(), 30);
          fp.addEventListener("submit", async ev => {
            ev.preventDefault();
            err.hidden = true;
            const agora = new Date().toISOString();
            try {
              if (f && !adm) {
                await FS.updateDoc(FS.doc(db, "formandos", f.id), { tel: tel.value.trim(), obs: obs.value.trim(), atualizadoEm: agora });
                fechar();
                U.toast("Salvo");
                return;
              }
              const P = Math.max(1, n0(parc.value)),
                ehCol = contrato.value === "colacao",
                v = lerReais(valor.value);
              if (P < pagasDe(f || {})) {
                err.textContent = `Já tem ${pagasDe(f)} parcelas pagas; o número de parcelas não pode ser menor.`;
                err.hidden = false;
                return;
              }
              const body = {
                contrato: ehCol ? "colacao" : "album",
                nome: nome.value.trim(),
                tel: tel.value.trim(),
                serie: serie.value,
                kit: ehCol ? "" : kit.value.trim(),
                valor: v,
                parcelas: P,
                primeiroVenc: venc.value,
                formaPag: ehCol ? "Boleto" : fpg.value,
                status: st.value,
                obs: obs.value.trim(),
                atualizadoEm: agora
              };
              if (f) {
                // os pagamentos não mudam aqui; recalcula só o próximo vencimento
                const pags = pagamentosDe(f);
                await FS.updateDoc(
                  FS.doc(db, "formandos", f.id),
                  Object.assign(body, {
                    pagamentos: pags,
                    pagas: pags.length,
                    proxVenc: proxVenc(Object.assign({}, f, body, { pagamentos: pags }))
                  })
                );
              } else {
                const n = adm ? Math.min(P, n0(jaPagas.value)) : 0,
                  vals = dividir(v, P);
                const pags = Array.from({ length: n }, (_, i) => ({ data: hoje(), valor: vals[i], por: C.email || "" }));
                const novo = Object.assign(body, {
                  pagamentos: pags,
                  pagas: n,
                  instId: inst.id,
                  instNome: inst.nome,
                  instTipo: inst.tipo || "",
                  ano: Number(hoje().slice(0, 4)),
                  resp: inst.resp || C.me || "",
                  respEmail: inst.respEmail || (adm ? "" : C.email || ""),
                  vendidoEm: hoje(),
                  criadoEm: agora,
                  por: C.me || ""
                });
                novo.proxVenc = proxVenc(novo);
                await FS.addDoc(col, novo);
              }
              fechar();
              U.toast(f ? "Salvo" : "Formando incluído");
            } catch (er) {
              C.handleErr(er);
            }
          });
        });
      }
      function valorColacao(btn, colTxt) {
        sheet("Colação de grau · " + title(inst.nome), (fp, fechar) => {
          const cfg = inst.colacao || {};
          fp.append(
            el(
              "p",
              "hint",
              "Contrato individual por aluno, pago no boleto. Quem fechou o colégio recebe a comissão sobre cada parcela paga."
            )
          );
          const v = inpReais(cfg.valor || "", "ex.: 400");
          const pc = inp(cfg.parcelas || "", "ex.: 10", 3);
          pc.inputMode = "numeric";
          const vc = el("input");
          vc.type = "date";
          vc.value = cfg.primeiroVenc || dia5();
          const r = el("div", "row3");
          r.append(field("Valor total por aluno", v), field("Parcelas", pc), field("1º vencimento", vc));
          fp.append(r);
          const info = el("p", "hint");
          const upd = () => {
            const t = lerReais(v.value),
              n = Math.max(1, n0(pc.value)),
              ps = dividir(t, n);
            info.textContent = t
              ? `${n}x de ${brl(ps[ps.length - 1])}${ps[0] !== ps[ps.length - 1] ? ` (a 1ª de ${brl(ps[0])})` : ""} no boleto`
              : "";
          };
          v.oninput = upd;
          pc.oninput = upd;
          upd();
          fp.append(info);
          fp.append(botoes(fechar, "Salvar"));
          fp.addEventListener("submit", async ev => {
            ev.preventDefault();
            const novo = { valor: lerReais(v.value), parcelas: Math.max(1, n0(pc.value)), primeiroVenc: vc.value };
            try {
              await FS.updateDoc(FS.doc(db, "instituicoes", inst.id), { colacao: novo, atualizadoEm: new Date().toISOString() });
              inst.colacao = novo;
              btn.textContent = colTxt();
              fechar();
              U.toast("Valor da colação salvo");
            } catch (e) {
              C.handleErr(e);
            }
          });
        });
      }
      function importar() {
        sheet("Importar formandos", (fp, fechar) => {
          fp.append(
            el(
              "p",
              "hint",
              "Planilha do Excel com as colunas (os nomes podem variar): NOME, TELEFONE, SÉRIE, KIT, VALOR, PARCELAS, PAGAS, VENCIMENTO, PAGAMENTO e CONTRATO (escreva COLAÇÃO para quem é da colação de grau). Só o nome é obrigatório."
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
              const XLSX = await loadXLSX();
              const wb = XLSX.read(await file.files[0].arrayBuffer(), { cellDates: true });
              const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
              const pega = (r, ...ks) => {
                const e = Object.entries(r).find(([k]) => ks.some(x => norm(k).includes(x)));
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
              const ja = new Set(lista.map(f => norm(f.nome) + "|" + (ehColacao(f) ? "colacao" : "album")));
              const cfg = inst.colacao || {};
              linhas = rows
                .map(r => {
                  const contrato = /cola/.test(norm(pega(r, "contrato", "colacao", "tipo"))) ? "colacao" : "album";
                  const x = {
                    contrato,
                    nome: String(pega(r, "nome", "formando", "aluno")).trim(),
                    tel: String(pega(r, "telefone", "celular", "whats", "tel")).trim(),
                    serie: String(pega(r, "serie", "turma", "ano")).trim(),
                    kit: contrato === "colacao" ? "" : String(pega(r, "kit", "produto", "pacote")).trim(),
                    valor: lerReais(pega(r, "valor", "preco", "total")) || (contrato === "colacao" ? n0(cfg.valor) : 0),
                    parcelas: Math.max(1, n0(pega(r, "parcela")) || (contrato === "colacao" ? n0(cfg.parcelas) : 1)),
                    primeiroVenc: isoDe(pega(r, "venc")) || (contrato === "colacao" ? cfg.primeiroVenc || "" : ""),
                    formaPag: contrato === "colacao" ? "Boleto" : String(pega(r, "pagamento", "forma")).trim(),
                    pagasPlan: n0(pega(r, "paga"))
                  };
                  return x;
                })
                .filter(x => x.nome && !ja.has(norm(x.nome) + "|" + x.contrato));
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
                    status: "ativo",
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
    },
    {
      div: true,
      wide: true,
      onClose: () => {
        if (unsub) {
          unsub();
          unsub = null;
        }
        if (aoFechar) aoFechar();
      }
    }
  );
  return close;
}
function loadXLSX() {
  return carregarLib("xlsx");
}
