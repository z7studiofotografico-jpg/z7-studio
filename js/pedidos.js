// Aluno repetido no PR: quem é da equipe só trabalha o que cadastrou. Se tentar incluir um aluno que já existe,
// o app não grava por cima: avisa a pessoa e manda um pedido para o Adriano ou a Luciana decidirem
// se o aluno passa para ela ou fica onde está (no repasse ou com quem já estava).
// Coleção "pedidos": { tipo: "pr-repetido", alvoId, aluno, escola, ano, etapaAtual, respAtual,
//   porEmail, porNome, dados: { contatos, curso, turma }, status: "pendente" | "aprovado" | "negado",
//   criadoEm, decididoEm, decididoPor, visto }
import { el, title } from "./ui.js";
import { faltando } from "./repasse-dados.js";
import * as U from "./util.js";

const ANO = () => new Date().getFullYear();
const VENDIDO = ["PAGO", "ENTREGUE"];

// ---------- regras puras (testadas em tests/pedidos.test.mjs) ----------
const tels = d => new Set([...(d.telefones || []), ...(d.contatos || []).map(c => c.tel)].filter(Boolean));
// Mesmo aluno: mesmo ano e mesmo nome no mesmo colégio (ou com um telefone em comum);
// ou mesmo primeiro nome com telefone e colégio iguais
export function mesmoAluno(a, d) {
  const na = U.chave(a.nome),
    nd = U.chave(d.nome);
  if (!na || !nd) return false;
  const ea = U.slug(a.escola),
    ed = U.slug(d.escola),
    escola = !ea || !ed || ea === ed;
  const ta = tels(a),
    tel = [...tels(d)].some(t => ta.has(t));
  // cada ano é um ensaio (e uma venda) diferente: o mesmo nome em outro ano não é repetido
  if (a.ano && d.ano && Number(a.ano) !== Number(d.ano)) return false;
  if (na === nd) return escola || tel;
  return na.split(" ")[0] === nd.split(" ")[0] && tel && escola;
}
// Junta os contatos novos aos que já existem (sem repetir telefone)
export function mesclarContatos(atuais, novos) {
  const out = (atuais || []).slice(),
    vistos = new Set(out.map(c => c.tel));
  (novos || []).forEach(c => {
    if (c.tel && !vistos.has(c.tel)) {
      vistos.add(c.tel);
      out.push(c);
    }
  });
  return out;
}
// O que muda no aluno quando o pedido é aprovado (null = não pode passar: já foi vendido)
export function passarPara(r, p, hoje) {
  if (VENDIDO.includes(r.etapa)) return null;
  const contatos = mesclarContatos(r.contatos, (p.dados || {}).contatos);
  const patch = {
    resp: p.porNome || "",
    respEmail: p.porEmail,
    contatos,
    telefones: contatos.map(c => c.tel),
    atualizadoEm: new Date().toISOString()
  };
  if (r.etapa === "NA FILA" || r.etapa === "INCOMPLETO" || !r.etapa) {
    const falta = faltando(Object.assign({}, r, { contatos }));
    patch.etapa = falta.length ? "INCOMPLETO" : "SEPARADO";
    if (!falta.length) Object.assign(patch, { followup: hoje, separadoEm: hoje, separadoSeg: (r.ano || 0) >= ANO() ? "lf" : "rep" });
  }
  return patch;
}
const ondeEsta = r =>
  VENDIDO.includes(r.etapa)
    ? "já foi vendido"
    : r.respEmail
      ? `está com ${title(r.resp || r.respEmail)}`
      : r.etapa === "INCOMPLETO"
        ? "está nos incompletos"
        : "está na fila do repasse";

// ---------- procurar e pedir ----------
// Procura o aluno no PR, no mesmo ano (pelo nome; quem tem o Repasse procura também pelo telefone).
// Quem só tem a Linha de Frente procura no ano atual, que é o único em que ela pode incluir.
export async function procurarRepetido(C, d) {
  const { FS, db } = C,
    col = FS.collection(db, "repasse");
  const soLF = !C.isAdmin && !C.pode("rep");
  const consultas = [
    FS.query(col, FS.where("nomeBusca", "==", U.chave(d.nome)), ...(soLF ? [FS.where("ano", "==", ANO())] : []), FS.limit(20))
  ];
  const ts = [...tels(d)].slice(0, 10);
  if (!soLF && ts.length) consultas.push(FS.query(col, FS.where("telefones", "array-contains-any", ts), FS.limit(20)));
  for (const q of consultas) {
    const s = await FS.getDocs(q);
    const achou = s.docs.map(x => Object.assign({ id: x.id }, x.data())).find(r => mesmoAluno(r, d));
    if (achou) return achou;
  }
  return null;
}
// Identificador do pedido: um por aluno e por pessoa (as regras conferem que termina com o e-mail de quem pede)
export const idPedido = (tipo, alvoId, email) => `${tipo}_${String(alvoId).slice(0, 200)}_${U.slug(email)}`;
// Manda o pedido e devolve o texto do aviso para quem tentou incluir.
// Já decidido antes (aprovado ou negado)? Pode pedir de novo: a situação pode ter mudado.
export async function pedirAluno(C, r, d) {
  const { FS, db } = C,
    ref = FS.doc(db, "pedidos", idPedido("pr", r.id, C.email));
  const novo = await FS.runTransaction(db, async tx => {
    const atual = await tx.get(ref);
    if (atual.exists() && atual.data().status === "pendente") return false;
    tx.set(ref, {
      tipo: "pr-repetido",
      alvoId: r.id,
      aluno: r.nome || d.nome,
      escola: r.escola || d.escola || "",
      ano: r.ano || d.ano || null,
      etapaAtual: r.etapa || "",
      respAtual: r.resp || "",
      porEmail: C.email,
      porNome: C.me || "",
      dados: { contatos: d.contatos || [], curso: d.curso || "", turma: d.turma || "" },
      status: "pendente",
      criadoEm: new Date().toISOString()
    });
    return true;
  });
  const quem = `${title(r.nome)} já está cadastrado no PR (${ondeEsta(r)}).`;
  return novo
    ? `${quem} Pedimos ao Adriano ou à Luciana para decidirem se ele passa para você.`
    : `${quem} Você já pediu: aguarde o Adriano ou a Luciana.`;
}

// ---------- decidir (só admin) ----------
export async function decidir(C, p, aprovar) {
  const { FS, db } = C,
    pRef = FS.doc(db, "pedidos", p.id),
    rRef = FS.doc(db, "repasse", p.alvoId),
    agora = new Date().toISOString();
  const res = await FS.runTransaction(db, async tx => {
    const ps = await tx.get(pRef);
    if (!ps.exists() || ps.data().status !== "pendente") return "ja";
    const decisao = { decididoEm: agora, decididoPor: C.me || C.email || "", visto: false };
    if (!aprovar) {
      tx.update(pRef, Object.assign({ status: "negado" }, decisao));
      return "negado";
    }
    const rs = await tx.get(rRef);
    if (!rs.exists()) {
      tx.update(pRef, Object.assign({ status: "negado", motivo: "o aluno não existe mais" }, decisao));
      return "sumiu";
    }
    const patch = passarPara(rs.data(), ps.data(), U.todayStr());
    if (!patch) {
      tx.update(pRef, Object.assign({ status: "negado", motivo: "o aluno já foi vendido" }, decisao));
      return "vendido";
    }
    tx.update(rRef, patch);
    tx.update(pRef, Object.assign({ status: "aprovado" }, decisao));
    // quem estava com o aluno fica sabendo (para não mandarem mensagem os dois para a mesma família)
    const antes = rs.data();
    if (antes.respEmail && antes.respEmail !== ps.data().porEmail)
      tx.set(FS.doc(db, "pedidos", idPedido("aviso", p.alvoId, antes.respEmail)), {
        tipo: "pr-transferido",
        alvoId: p.alvoId,
        aluno: antes.nome || p.aluno,
        escola: antes.escola || "",
        porEmail: antes.respEmail,
        porNome: antes.resp || "",
        para: ps.data().porNome || ps.data().porEmail,
        status: "aviso",
        visto: false,
        criadoEm: agora,
        decididoPor: decisao.decididoPor
      });
    return "aprovado";
  });
  const nome = title(p.porNome || p.porEmail);
  U.toast(
    {
      aprovado: `${title(p.aluno)} passou para ${nome} ✅`,
      negado: `${title(p.aluno)} ficou onde estava; ${nome} vai ver o aviso`,
      vendido: "Esse aluno já foi vendido: ficou onde estava",
      sumiu: "Esse aluno não está mais no PR",
      ja: "Esse pedido já foi decidido"
    }[res]
  );
}

// ---------- telas ----------
// Admin: pedidos pendentes no topo do PR. Equipe: os próprios pedidos (aguardando e decididos ainda não vistos).
// Devolve a função que para de ouvir.
export function painelPedidos(C, box) {
  const { FS, db } = C,
    col = FS.collection(db, "pedidos");
  const q = C.isAdmin
    ? FS.query(col, FS.where("status", "==", "pendente"), FS.limit(50))
    : FS.query(col, FS.where("porEmail", "==", C.email), FS.limit(30));
  return FS.onSnapshot(
    q,
    snap => {
      const lst = snap.docs
        .map(d => Object.assign({ id: d.id }, d.data()))
        .filter(p => C.isAdmin || p.status === "pendente" || !p.visto)
        .sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm)));
      box.innerHTML = "";
      box.hidden = !lst.length;
      if (!lst.length) return;
      box.append(
        el("h3", null, C.isAdmin ? `📩 ${lst.length} pedido${lst.length > 1 ? "s" : ""} de aluno repetido` : "📩 Seus pedidos de aluno")
      );
      lst.forEach(p => box.append(C.isAdmin ? cartaoAdmin(C, p) : cartaoEquipe(C, p)));
    },
    e => console.warn("pedidos", e)
  );
}
function cartaoAdmin(C, p) {
  const c = el("div", "notes");
  const onde = VENDIDO.includes(p.etapaAtual)
    ? "já foi vendido"
    : p.respAtual
      ? `está com ${title(p.respAtual)}`
      : p.etapaAtual === "INCOMPLETO"
        ? "está nos incompletos"
        : "está na fila do repasse";
  c.append(
    el(
      "p",
      null,
      `${title(p.porNome || p.porEmail)} tentou incluir ${title(p.aluno)} (${title(p.escola)}${p.ano ? ", " + p.ano : ""}), que já ${onde}.`
    )
  );
  const novos = ((p.dados || {}).contatos || []).map(x => `${x.tipo}${x.nome ? " " + title(x.nome) : ""}: ${x.tel}`);
  if (novos.length) c.append(el("p", "hint", "Contatos que a pessoa trouxe: " + novos.join(" · ")));
  const act = el("div", "actions");
  act.append(
    U.mkBtn(`Passar para ${U.first(title(p.porNome || p.porEmail))}`, "btn-ok btn-sm", () => decidir(C, p, true).catch(C.handleErr)),
    U.mkBtn("Manter onde está", "btn-sm", () => decidir(C, p, false).catch(C.handleErr))
  );
  c.append(act);
  return c;
}
function cartaoEquipe(C, p) {
  const c = el("div", "notes");
  const aluno = title(p.aluno);
  c.append(
    el(
      "p",
      p.status === "pendente" ? "wait" : null,
      p.status === "pendente"
        ? `⏳ ${aluno} já estava cadastrado. Aguardando o Adriano ou a Luciana decidirem.`
        : p.status === "aviso"
          ? `↪️ ${aluno} passou para ${title(p.para)} (decisão ${p.decididoPor ? "de " + title(p.decididoPor) : "do admin"}). Não mande mais mensagem para essa família.`
          : p.status === "aprovado"
            ? `✅ ${aluno} passou para você: já está na sua lista.`
            : `${aluno} ficou onde estava${p.motivo ? " (" + p.motivo + ")" : ""}. Não precisa trabalhar esse contato.`
    )
  );
  if (p.status !== "pendente")
    c.append(
      U.mkBtn("Ok, entendi", "btn-sm", async () => {
        try {
          await C.FS.updateDoc(C.FS.doc(C.db, "pedidos", p.id), { visto: true });
        } catch (e) {
          C.handleErr(e);
        }
      })
    );
  return c;
}
