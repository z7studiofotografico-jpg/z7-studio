// Turma: o formulário do formando (novo, editar, venda depois das fotos) e o ID do aluno na turma.
// T = a turma aberta (inst, lista de formandos, opções), montada em turma.js.
import { lerReais, brl, dividir, pagamentosDe, pagasDe, recebido, proxVenc, ehKit01, ativo, FORMAS } from "./regras.js";
import { kitsDe, plano, ehAdesao, anoDaTurma, vendaSugerida, proximoVenc, devolucao, DEVOLVE_DESISTENCIA } from "./contrato.js";
import { el, title, field, inp, inpReais, sel, sheet, botoes } from "./ui.js";
import * as U from "./util.js";
import { siglaDe, siglaUsada, reservarCodigo, comAno, avisoTel } from "./aluno-id.js";
let C, FS, db;
const n0 = v => Number(v) || 0;
const hoje = () => U.todayStr();
function usar(ctx) {
  C = ctx;
  FS = ctx.FS;
  db = ctx.db;
}

// Sigla da turma: a que o colégio já usa, a do cadastro ou as iniciais do nome
export function siglaTurma(T) {
  return T.inst.sigla || siglaUsada(T.lista.map(x => x.codigo)) || (T.opcoes && T.opcoes.sigla) || siglaDe(T.inst.nome);
}
// ID de quem entra: o mesmo do aluno se ele já está na turma (outro kit), senão o próximo número
// ano da turma (o da formatura): vai na frente do ID
export const anoTurma = T => anoDaTurma(T.inst) || Number(hoje().slice(0, 4));
// número reservado no banco: dois cadastros ao mesmo tempo nunca pegam o mesmo ID
export async function codigoNovo(T, nm, base) {
  if (base && base.codigo) return base.codigo;
  const mesmo = T.lista.find(x => x.codigo && U.chave(x.nome) === U.chave(nm));
  if (mesmo) return mesmo.codigo;
  return reservarCodigo(
    FS,
    db,
    anoTurma(T),
    siglaTurma(T),
    T.lista.map(x => x.codigo)
  );
}

// Desfaz o último pagamento lançado (só admin)
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

export function formFormando(ctx, T, f, preset) {
  usar(ctx);
  const col = FS.collection(db, "formandos");
  const adm = C.isAdmin,
    base = preset && preset.base,
    kitsTodos = kitsDe(C.P, T.inst);
  preset = preset || {};
  // na venda depois das fotos (compra a mais de quem já tem o Kit 01) só aparecem os kits 02 a 05
  const kits = preset.venda ? kitsTodos.filter(k => !ehAdesao(k.id)) : kitsTodos;
  const tituloVenda = preset.venda === "rep" ? "Venda no repasse" : "Venda depois das fotos";
  sheet(preset.venda ? tituloVenda : f ? "Editar formando" : "Novo formando", (fp, fechar) => {
    const nome = inp(f ? title(f.nome) : base ? title(base.nome) : "", "nome do formando");
    nome.required = true;
    nome.disabled = !!f && !adm;
    const tel = inp(f ? f.tel : base ? base.tel : "", "WhatsApp do responsável", 30);
    tel.inputMode = "tel";
    const r1 = el("div", "row2");
    r1.append(field("Nome", nome), field("WhatsApp", tel));
    fp.append(r1);
    // telefone que com certeza está errado: avisa na hora (não impede salvar)
    const avTel = el("p", "wait");
    fp.append(avTel);
    const conferirTel = () => {
      const a = tel.value.replace(/\D/g, "").length >= 4 ? avisoTel(tel.value) : "";
      avTel.textContent = a ? "⚠️ Confira este número: " + a + ". Se o WhatsApp abrir dizendo que o número não existe, peça outro." : "";
      avTel.hidden = !a;
    };
    tel.addEventListener("input", conferirTel);
    conferirTel();
    // ID do aluno (separação das fotos): o app dá o próximo número da turma; o admin pode trocar
    const codigoIn = inp(f ? f.codigo || "" : base ? base.codigo || "" : "", f ? "ex.: 26CEPNCP-07" : "automático (ex.: 26CEPNCP-07)", 30);
    codigoIn.disabled = (!!f || !!base) && !adm;
    fp.append(field("ID do aluno", codigoIn));
    // Kit do contrato: todo formando entra pelo menos com o Kit 01 (adesão)
    const kitAtual = f && f.status !== "semkit" ? f.kitId || (ehKit01(f) ? "k01" : f.kit ? "outro" : "k01") : preset.venda ? "k04" : "k01";
    const kit = sel([...kits.map(k => [k.id, k.nome]), ["outro", "Outro kit (digitar)"]], preset.kitId || kitAtual);
    const venda = sel(
      [
        ["ant", "Antecipada (preço do contrato)"],
        ["pos", "Depois das fotos (preço maior)"],
        ["rep", "Repasse (turma de ano anterior)"]
      ],
      preset.venda || (f && f.venda) || vendaSugerida(T.inst, hoje())
    );
    const r0 = el("div", "row2");
    r0.append(field("Kit", kit), field("Venda", venda));
    fp.append(r0);
    const kitTxt = inp(f && kitAtual === "outro" ? f.kit : "", "nome do kit", 80);
    const fKitTxt = field("Qual kit", kitTxt);
    fp.append(fKitTxt);
    const serie = sel(["Pré", "5º ano", "9º ano", "Ensino médio", "Outra"], f ? f.serie : base ? base.serie : "", "série");
    // depois da formatura, o antecipado não vale mais
    const avisoVenda = el("p", "wait");
    fp.append(avisoVenda);
    const confereVenda = () => {
      const passou = vendaSugerida(T.inst, hoje()) === "pos";
      avisoVenda.hidden = !(passou && venda.value === "ant");
      avisoVenda.textContent = `A formatura foi em ${U.fmtDate(T.inst.formatura && T.inst.formatura.data)}: depois dela vale o preço depois das fotos (o antecipado era até o dia da formatura).`;
    };
    fp.append(field("Série", serie));
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
    venc.value = f ? f.primeiroVenc || "" : proximoVenc(hoje());
    const fpg = sel(FORMAS, f ? f.formaPag : "", "forma de pagamento");
    const st = sel(
      [
        ["ativo", "Comprou"],
        ["desistiu", "Desistiu"],
        ["reprovou", "Reprovou"]
      ],
      f && ["desistiu", "reprovou"].includes(f.status) ? f.status : "ativo"
    );
    const r4 = el("div", "row3");
    r4.append(field("1º vencimento", venc), field("Pagamento", fpg), field("Situação", st));
    fp.append(r4);
    const parcInfo = el("p", "hint");
    fp.append(parcInfo);
    // Devolução (contrato item 5.0): desistência devolve 70% do pago; reprovação, o pago menos os serviços já feitos
    const pago = f ? recebido(f) : 0;
    const serv = inpReais(f && f.devolucao ? f.devolucao.servicos : "");
    const fServ = field("Serviços já feitos (descontar)", serv);
    const devInfo = el("p", "wait");
    fp.append(fServ, devInfo);
    let avisoPlano = "";
    const atualizaInfo = () => {
      const v = lerReais(valor.value),
        n = Math.max(1, n0(parc.value));
      const ps = dividir(v, n);
      parcInfo.textContent = v
        ? `${n}x de ${brl(ps[ps.length - 1])}${ps[0] !== ps[ps.length - 1] ? ` (a 1ª de ${brl(ps[0])})` : ""} · vencimento todo dia ${venc.value.slice(8) || "05"}`
        : "";
      if (v && avisoPlano) parcInfo.textContent += " · ⚠️ " + avisoPlano;
      const sai = st.value === "desistiu" || st.value === "reprovou";
      fServ.hidden = st.value !== "reprovou";
      devInfo.hidden = !sai || !pago;
      if (sai && pago)
        devInfo.textContent =
          st.value === "desistiu"
            ? `Desistência: devolver ${DEVOLVE_DESISTENCIA}% do que pagou (${brl(pago)}) = ${brl(devolucao("desistiu", pago))}.`
            : `Reprovação: devolver o que pagou (${brl(pago)}) menos os serviços já feitos = ${brl(devolucao("reprovou", pago, lerReais(serv.value)))}. Precisa do documento da secretaria.`;
    };
    // Preenche valor, parcelas e 1º vencimento pela tabela do contrato (antecipado: termina junto com a turma)
    const aplicarPlano = () => {
      const outro = kit.value === "outro";
      confereVenda();
      fKitTxt.hidden = !outro;
      venda.disabled = !!f && !adm && !preset.venda;
      if (outro) return atualizaInfo();
      const k = kits.find(x => x.id === kit.value),
        pl = plano(k, venda.value, (T.inst.contratoTurma || {}).inicio, hoje());
      if (!pl) {
        parcInfo.textContent = "";
        valor.value = "";
        U.toast(venda.value === "pos" ? "Defina o preço depois das fotos deste kit em “📋 Kits e preços”" : "Kit sem preço na tabela");
        return;
      }
      valor.value = String(pl.valor).replace(".", ",");
      valor.dispatchEvent(new Event("focusout", { bubbles: true }));
      parc.value = pl.parcelas;
      venc.value = pl.primeiroVenc;
      avisoPlano = pl.aviso;
      if (pl.aviso) U.toast(pl.aviso);
      if (ehAdesao(k.id)) fpg.value = fpg.value || "Pix";
      atualizaInfo();
    };
    valor.addEventListener("input", atualizaInfo);
    parc.addEventListener("input", atualizaInfo);
    serv.addEventListener("input", atualizaInfo);
    st.addEventListener("change", atualizaInfo);
    kit.addEventListener("change", aplicarPlano);
    venda.addEventListener("change", aplicarPlano);
    if (!f || preset.venda) aplicarPlano();
    else {
      fKitTxt.hidden = kit.value !== "outro";
      confereVenda();
      atualizaInfo();
    }
    // Depois de cadastrado, só o admin muda dinheiro e contrato (na venda depois das fotos, a equipe escolhe o kit)
    if (f && !adm)
      (preset.venda ? [valor, parc, venc, st] : [kit, venda, serie, valor, parc, venc, fpg, st]).forEach(i => {
        i.disabled = true;
      });
    if (f && !adm && !preset.venda) fp.append(el("p", "hint", "Valores, kit e situação só o Adriano ou a Luciana mudam."));
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
    const a = botoes(fechar, preset.venda ? "Registrar venda" : "Salvar");
    if (preset.venda)
      fp.insertBefore(
        el(
          "p",
          "hint",
          `Compra a mais${preset.venda === "rep" ? " no repasse" : ", depois das fotos"}: o Kit 01 que o aluno já tem continua como está. O valor vem da tabela da turma e pode ser mudado se combinaram outro.`
        ),
        fp.firstChild.nextSibling
      );
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
        if (f && !adm && !preset.venda) {
          await FS.updateDoc(FS.doc(db, "formandos", f.id), { tel: tel.value.trim(), obs: obs.value.trim(), atualizadoEm: agora });
          fechar();
          U.toast("Salvo");
          return;
        }
        // formando repetido na turma: não cadastra de novo (para outro kit, use "🛒 Comprou kit" no cartão dele)
        if (!f && !preset.base) {
          const igual = T.lista.find(x => ativo(x) && U.chave(x.nome) === U.chave(nome.value));
          if (igual) {
            err.textContent = `${title(igual.nome)} já está cadastrado nesta turma. Para vender outro kit, use “🛒 Comprou kit” no cartão dele.`;
            err.hidden = false;
            return;
          }
        }
        const k = kits.find(x => x.id === kit.value);
        const P = Math.max(1, n0(parc.value)),
          v = lerReais(valor.value);
        if (!v) {
          err.textContent = "Coloque o valor do kit.";
          err.hidden = false;
          return;
        }
        if (P < pagasDe(f || {})) {
          err.textContent = `Já tem ${pagasDe(f)} parcelas pagas; o número de parcelas não pode ser menor.`;
          err.hidden = false;
          return;
        }
        const saiu = st.value === "desistiu" || st.value === "reprovou";
        // ID digitado sem o ano ganha o ano da turma (CEPNCP-7 → 26CEPNCP-07)
        const codigo = codigoIn.value.trim()
          ? comAno(codigoIn.value.trim().toUpperCase(), anoTurma(T))
          : f
            ? f.codigo || ""
            : await codigoNovo(T, nome.value, base);
        const body = {
          codigo,
          contrato: k && ehAdesao(k.id) ? "adesao" : "album",
          kitId: kit.value,
          kit: k ? k.nome : kitTxt.value.trim(),
          venda: venda.value,
          nome: nome.value.trim(),
          tel: tel.value.trim(),
          serie: serie.value,
          valor: v,
          parcelas: P,
          primeiroVenc: venc.value,
          formaPag: fpg.value,
          status: st.value,
          obs: obs.value.trim(),
          atualizadoEm: agora
        };
        if (saiu && pago) {
          const regra = st.value === "desistiu" ? `desistência: ${DEVOLVE_DESISTENCIA}% do pago` : "reprovação: pago menos serviços";
          body.devolucao = {
            valor: devolucao(st.value, pago, lerReais(serv.value)),
            servicos: lerReais(serv.value),
            regra,
            em: hoje()
          };
        }
        if (f && f.status === "semkit") body.vendidoEm = hoje();
        if (base) body.compraDe = base.id; // compra a mais de quem já tinha o Kit 01
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
          // ID trocado: os outros kits do mesmo aluno ficam com o mesmo ID
          if (adm && codigo !== (f.codigo || "")) {
            const outros = T.lista.filter(x => x.id !== f.id && U.chave(x.nome) === U.chave(f.nome) && (x.codigo || "") !== codigo);
            if (outros.length) {
              const b = FS.writeBatch(db);
              outros.forEach(x => b.update(FS.doc(db, "formandos", x.id), { codigo, atualizadoEm: agora }));
              await b.commit();
            }
          }
        } else {
          const n = adm ? Math.min(P, n0(jaPagas.value)) : 0,
            vals = dividir(v, P);
          const pags = Array.from({ length: n }, (_, i) => ({ data: hoje(), valor: vals[i], por: C.email || "" }));
          const novo = Object.assign(body, {
            pagamentos: pags,
            pagas: n,
            instId: T.inst.id,
            instNome: T.inst.nome,
            instTipo: T.inst.tipo || "",
            ano: Number(hoje().slice(0, 4)),
            resp: T.inst.resp || C.me || "",
            respEmail: T.inst.respEmail || (adm ? "" : C.email || ""),
            vendidoEm: hoje(),
            criadoEm: agora,
            por: C.me || ""
          });
          novo.proxVenc = proxVenc(novo);
          await FS.addDoc(col, novo);
        }
        fechar();
        U.toast(preset.venda ? "Venda registrada 🎉" : f ? "Salvo" : "Formando incluído");
      } catch (er) {
        C.handleErr(er);
      }
    });
  });
}
