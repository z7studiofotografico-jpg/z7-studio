// Aluno repetido no PR: quem é da equipe só trabalha o que cadastrou. Se tentar incluir um aluno que já existe,
// o app não grava por cima: avisa a pessoa e manda um pedido para o Adriano ou a Luciana decidirem:
// passar o aluno para ela, manter onde está, ou cadastrar como novo (outro ensaio, ex.: aluno transferido).
// Coleção "pedidos": { tipo: "pr-repetido", alvoId, aluno, escola, ano, porEmail, porNome,
//   dados: { nome, escola, ano, curso, turma, contatos }, status: "pendente" | "aprovado" | "negado" | "novo",
//   anteriores: [{ status, decididoEm }], criadoEm, decididoEm, decididoPor, visto }
// Coleção "fones" (índice): { alunos: { idDoAluno: { nome, ano } } } por telefone. Serve para achar a mesma
// família em outro ano ou outro colégio, inclusive para quem só tem a Linha de Frente (que não lê o Repasse).
import { el, title } from "./ui.js";
import { faltando, docId } from "./repasse-dados.js";
import * as U from "./util.js";
import { siglaDe, siglaUsada, reservarCodigo, codigoBusca } from "./aluno-id.js";

const ANO = () => new Date().getFullYear();
const VENDIDO = ["PAGO", "ENTREGUE"];
// ---------- regras puras (testadas em tests/pedidos.test.mjs) ----------
const tels = d => new Set([...(d.telefones || []), ...(d.contatos || []).map(c => c.tel)].filter(Boolean));
// nome da mãe e do pai (os dois; vazio se faltar algum)
const nomeDe = (d, tipo) => U.chave(((d.contatos || []).find(c => U.chave(c.tipo) === tipo && U.chave(c.nome)) || {}).nome);
const maeEPai = d => {
  const m = nomeDe(d, "MAE"),
    p = nomeDe(d, "PAI");
  return m && p ? m + "|" + p : "";
};
const algum = (A, B) => [...B].some(x => A.has(x));
// Compara o aluno que já existe (a) com o que estão incluindo (d), na ordem combinada com o estúdio:
// 1) o nome completo tem que ser igual (irmãos têm o mesmo telefone e os mesmos pais, mas outro nome);
// 2) o mesmo telefone; 3) a mesma mãe E o mesmo pai; 4) o mesmo colégio (no mesmo ano).
// Bateu pelo telefone ou pelos pais em outro colégio: é aluno que trocou de colégio (raro: avisa o admin).
// Devolve null (não é o mesmo) ou { motivo: "telefone" | "pais" | "colegio", trocouColegio }.
export function compararAluno(a, d) {
  const na = U.chave(a.nome);
  if (!na || na !== U.chave(d.nome)) return null;
  const ea = U.slug(a.escola),
    ed = U.slug(d.escola),
    trocouColegio = !!(ea && ed && ea !== ed);
  if (algum(tels(a), tels(d))) return { motivo: "telefone", trocouColegio };
  const pa = maeEPai(a);
  if (pa && pa === maeEPai(d)) return { motivo: "pais", trocouColegio };
  const ano = !a.ano || !d.ano || Number(a.ano) === Number(d.ano);
  if (ea && ea === ed && ano) return { motivo: "colegio", trocouColegio: false };
  return null;
}
export const mesmoAluno = (a, d) => !!compararAluno(a, d);
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
// Aluno novo (outro ensaio) para quem pediu, com os dados que a pessoa digitou
export function alunoNovo(p, hoje, agora) {
  const d = p.dados || {},
    falta = faltando(d);
  return {
    nome: d.nome || p.aluno || "",
    nomeBusca: U.chave(d.nome || p.aluno),
    escola: d.escola || "",
    ano: Number(d.ano) || ANO(),
    curso: d.curso || "",
    turma: d.turma || "",
    contatos: d.contatos || [],
    telefones: (d.contatos || []).map(c => c.tel),
    dataEnsaio: "",
    endereco: {},
    obs: "",
    etapa: falta.length ? "INCOMPLETO" : "SEPARADO",
    followup: falta.length ? null : hoje,
    tentativas: 0,
    tentInteresse: 0,
    resp: p.porNome || "",
    respEmail: p.porEmail,
    ...(falta.length ? {} : { separadoEm: hoje, separadoSeg: (Number(d.ano) || ANO()) >= ANO() ? "lf" : "rep" }),
    manual: true,
    incluidoPor: p.porEmail,
    importadoEm: agora,
    atualizadoEm: agora
  };
}
// Quem pediu consegue ver o aluno se ele passar para ela? (só a Linha de Frente não vê o Repasse de anos anteriores)
export function podeVer(usuario, ano) {
  if (!usuario || usuario.papel === "admin") return true;
  const m = usuario.modulos || [];
  return m.includes("rep") || (m.includes("lf") && Number(ano) >= ANO());
}
// Telefones do aluno no índice "fones" (para achar a mesma família depois)
export function entradasFones(id, d) {
  return [...tels(d)].map(t => [t, { alunos: { [id]: { nome: U.chave(d.nome), ano: Number(d.ano) || null, escola: U.chave(d.escola) } } }]);
}
export function indexarFones(FS, db, w, id, d) {
  entradasFones(id, d).forEach(([t, dados]) => w.set(FS.doc(db, "fones", t), dados, { merge: true }));
}
const ondeEsta = r =>
  r.parcial
    ? `está no Repasse${r.ano ? " de " + r.ano : ""}`
    : VENDIDO.includes(r.etapa)
      ? "já foi vendido"
      : r.respEmail
        ? `está com ${title(r.resp || r.respEmail)}`
        : r.etapa === "INCOMPLETO"
          ? "está nos incompletos"
          : "está na fila do repasse";
const dia = d => (d ? String(d).slice(8, 10) + "/" + String(d).slice(5, 7) : "");

// ---------- ID do aluno do PR (26CEPNCP-01) ----------
// A sigla: a que o colégio já usa nos alunos do ano; senão a do cadastro do colégio (Instituições);
// senão a de outro ano; senão as iniciais do nome (com o último nome inteiro se repetir com outro colégio).
// O número é reservado no banco (nunca repete). Também acerta o nome do colégio para o jeito que já está no PR.
export async function gerarCodigoPR(C, d, nomesEscolas) {
  if (!d.escola) return "";
  const { FS, db } = C,
    col = FS.collection(db, "repasse"),
    ano = Number(d.ano) || ANO();
  const jeitos = [...new Set([d.escola, d.escola.toUpperCase(), title(d.escola), U.chave(d.escola)])];
  const doAno = (await FS.getDocs(FS.query(col, FS.where("escola", "in", jeitos), FS.where("ano", "==", ano), FS.limit(3000)))).docs.map(
    x => x.data()
  );
  if (doAno.length && !doAno.some(x => x.escola === d.escola)) d.escola = doAno[0].escola;
  let sigla = siglaUsada(doAno.map(x => x.codigo));
  // (quem não é admin só lê os colégios livres e os seus: a consulta já vai com esse filtro)
  if (!sigla && (C.isAdmin || C.pode("colegios") || C.pode("formaturas")))
    try {
      const s = await FS.getDocs(
        FS.query(
          FS.collection(db, "instituicoes"),
          FS.where("nomeBusca", "==", U.chave(d.escola)),
          ...(C.isAdmin ? [] : [FS.where("respEmail", "in", ["", C.email])]),
          FS.limit(1)
        )
      );
      sigla = (s.docs[0] && s.docs[0].data().sigla) || "";
    } catch (e) {
      console.warn("[Z7] sigla do colégio", e);
    }
  if (!sigla && (C.isAdmin || C.pode("rep")))
    sigla = siglaUsada((await FS.getDocs(FS.query(col, FS.where("escola", "in", jeitos), FS.limit(200)))).docs.map(x => x.data().codigo));
  if (!sigla) {
    const outras = (nomesEscolas || []).filter(n => U.chave(n) !== U.chave(d.escola)).map(n => siglaDe(n));
    sigla = siglaDe(d.escola, outras);
  }
  return reservarCodigo(
    FS,
    db,
    ano,
    sigla,
    doAno.map(x => x.codigo)
  );
}

// ---------- procurar e pedir ----------
// Procura o aluno no PR: pelo telefone (índice, qualquer colégio e ano) e pelo nome completo.
// Devolve o aluno com "comparacao" ({ motivo, trocouColegio }) ou null.
// Quem só tem a Linha de Frente não lê o Repasse: nesse caso o índice diz que existe e em que ano.
export async function procurarRepetido(C, d) {
  const { FS, db } = C,
    col = FS.collection(db, "repasse");
  const soLF = !C.isAdmin && !C.pode("rep");
  const lerAluno = async (id, dica) => {
    try {
      const s = await FS.getDoc(FS.doc(db, "repasse", id));
      return s.exists() ? Object.assign({ id }, s.data()) : null;
    } catch (_) {
      // sem permissão (Repasse de outro ano para quem só tem a Linha de Frente): usa o que o índice sabe
      return Object.assign({ id, parcial: true }, dica);
    }
  };
  // 1) mesma família pelo telefone (qualquer ano e colégio)
  for (const t of [...tels(d)].slice(0, 10)) {
    const s = await FS.getDoc(FS.doc(db, "fones", t)).catch(() => null);
    const alunos = (s && s.exists() && s.data().alunos) || {};
    for (const [id, x] of Object.entries(alunos)) {
      if (U.chave(x.nome) !== U.chave(d.nome)) continue; // nome completo igual (irmão tem outro nome)
      const r = await lerAluno(id, { nome: x.nome, ano: x.ano, escola: x.escola || "", telefones: [t] });
      const cmp = r && compararAluno(r, d);
      if (cmp) return Object.assign(r, { comparacao: cmp });
    }
  }
  // 2) mesmo nome (quem só tem a Linha de Frente procura no ano atual)
  const s = await FS.getDocs(
    FS.query(col, FS.where("nomeBusca", "==", U.chave(d.nome)), ...(soLF ? [FS.where("ano", "==", ANO())] : []), FS.limit(20))
  );
  for (const x of s.docs) {
    const r = Object.assign({ id: x.id }, x.data()),
      cmp = compararAluno(r, d);
    if (cmp) return Object.assign(r, { comparacao: cmp });
  }
  return null;
}
// Identificador do pedido: um por aluno e por pessoa (as regras conferem que termina com o e-mail de quem pede)
export const idPedido = (tipo, alvoId, email) => `${tipo}_${String(alvoId).slice(0, 200)}_${U.slug(email)}`;
// Manda o pedido e devolve o texto do aviso para quem tentou incluir.
// Já pedido e decidido antes? Pode pedir de novo (a situação pode ter mudado), mas o aviso diz que já foi pedido.
export async function pedirAluno(C, r, d) {
  const { FS, db } = C,
    ref = FS.doc(db, "pedidos", idPedido("pr", r.id, C.email));
  const res = await FS.runTransaction(db, async tx => {
    const s0 = await tx.get(ref),
      atual = s0.exists() ? s0.data() : null;
    if (atual && atual.status === "pendente") return { ja: "pendente" };
    const anteriores = atual ? (atual.anteriores || []).concat({ status: atual.status, decididoEm: atual.decididoEm || "" }) : [];
    tx.set(ref, {
      tipo: "pr-repetido",
      alvoId: r.id,
      aluno: r.nome || d.nome,
      escola: r.escola || "",
      ano: r.ano || null,
      porEmail: C.email,
      porNome: C.me || "",
      dados: {
        nome: d.nome || "",
        escola: d.escola || "",
        ano: d.ano || null,
        curso: d.curso || "",
        turma: d.turma || "",
        contatos: d.contatos || []
      },
      anteriores,
      achadoPor: (r.comparacao || {}).motivo || "", // telefone | pais | colegio
      trocouColegio: !!(r.comparacao || {}).trocouColegio,
      status: "pendente",
      visto: false,
      criadoEm: new Date().toISOString()
    });
    return { anterior: atual };
  });
  const onde = [title(r.escola), r.ano].filter(Boolean).join(", ");
  const troca = (r.comparacao || {}).trocouColegio ? ` Parece que trocou de colégio (${title(r.escola)} → ${title(d.escola)}).` : "";
  const quem = `${title(r.nome)} já está cadastrado no PR${onde ? " (" + onde + ")" : ""}: ${ondeEsta(r)}.${troca}`;
  if (res.ja) return `⚠️ Esse aluno já foi pedido por você e está aguardando o Adriano ou a Luciana. ${quem}`;
  if (res.anterior) {
    const st = { aprovado: "passou para você", negado: "ficou onde estava", novo: "foi cadastrado como novo" }[res.anterior.status] || "";
    return `⚠️ Esse aluno já foi pedido antes${st ? ` (${st}${res.anterior.decididoEm ? " em " + dia(res.anterior.decididoEm) : ""})` : ""}. ${quem} O pedido foi enviado de novo para o Adriano ou a Luciana.`;
  }
  return `${quem} Pedimos ao Adriano ou à Luciana para decidirem.`;
}

// ---------- decidir (só admin) ----------
// acao: "passar" (o aluno passa para quem pediu) | "manter" (fica onde está) | "novo" (cadastra outro, para quem pediu)
export async function decidir(C, p, acao) {
  // aluno cadastrado como novo também ganha o ID (reservado antes, fora da transação)
  let codigo = "";
  if (acao === "novo") {
    const d = Object.assign({}, p.dados || {});
    codigo = await gerarCodigoPR(C, d).catch(e => (console.warn("[Z7] ID do aluno", e), ""));
    if (d.escola) p = Object.assign({}, p, { dados: Object.assign({}, p.dados, { escola: d.escola }) });
  }
  const { FS, db } = C,
    pRef = FS.doc(db, "pedidos", p.id),
    rRef = FS.doc(db, "repasse", p.alvoId),
    agora = new Date().toISOString(),
    hoje = U.todayStr();
  const res = await FS.runTransaction(db, async tx => {
    const ps = await tx.get(pRef);
    if (!ps.exists() || ps.data().status !== "pendente") return "ja";
    const ped = ps.data(),
      decisao = { decididoEm: agora, decididoPor: C.me || C.email || "", visto: false };
    if (acao === "manter") {
      tx.update(pRef, Object.assign({ status: "negado" }, decisao));
      return "negado";
    }
    if (acao === "novo") {
      const novo = Object.assign(alunoNovo(Object.assign({}, ped, { dados: p.dados || ped.dados }), hoje, agora), {
          codigo,
          codigoBusca: codigo ? codigoBusca(codigo) : ""
        }),
        nRef = FS.doc(db, "repasse", docId(novo, Date.now()) + "-" + Date.now().toString(36));
      tx.set(nRef, novo);
      indexarFones(FS, db, tx, nRef.id, novo);
      tx.update(pRef, Object.assign({ status: "novo", novoId: nRef.id }, decisao));
      return "novo";
    }
    const rs = await tx.get(rRef);
    if (!rs.exists()) {
      tx.update(pRef, Object.assign({ status: "negado", motivoDecisao: "o aluno não existe mais" }, decisao));
      return "sumiu";
    }
    const antes = rs.data(),
      patch = passarPara(antes, ped, hoje);
    if (!patch) {
      tx.update(pRef, Object.assign({ status: "negado", motivoDecisao: "o aluno já foi vendido" }, decisao));
      return "vendido";
    }
    tx.update(rRef, patch);
    indexarFones(FS, db, tx, p.alvoId, Object.assign({}, antes, patch));
    tx.update(pRef, Object.assign({ status: "aprovado" }, decisao));
    // quem estava com o aluno fica sabendo (para não mandarem mensagem os dois para a mesma família)
    if (antes.respEmail && antes.respEmail !== ped.porEmail)
      tx.set(FS.doc(db, "pedidos", idPedido("aviso", p.alvoId, antes.respEmail)), {
        tipo: "pr-transferido",
        alvoId: p.alvoId,
        aluno: antes.nome || p.aluno,
        escola: antes.escola || "",
        porEmail: antes.respEmail,
        porNome: antes.resp || "",
        para: ped.porNome || ped.porEmail,
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
      novo: `Cadastrado como novo para ${nome} ✅`,
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
        el(
          "h3",
          null,
          C.isAdmin
            ? `📩 ${lst.length} pedido${lst.length > 1 ? "s" : ""} de aluno repetido` +
                (lst.some(x => x.trocouColegio) ? ` · 🏫 ${lst.filter(x => x.trocouColegio).length} trocou de colégio` : "")
            : "📩 Seus pedidos de aluno"
        )
      );
      lst.forEach(p => box.append(C.isAdmin ? cartaoAdmin(C, p, lst) : cartaoEquipe(C, p)));
    },
    e => console.warn("pedidos", e)
  );
}
function cartaoAdmin(C, p, todos) {
  const c = el("div", "notes"),
    quem = title(p.porNome || p.porEmail),
    d = p.dados || {};
  const txt = el("p", null, `${quem} tentou incluir ${title(d.nome || p.aluno)} (${title(d.escola)}${d.ano ? ", " + d.ano : ""}).`);
  const onde = el("p", "hint", "Conferindo o cadastro que já existe…");
  c.append(txt, onde);
  const novos = (d.contatos || []).map(x => `${x.tipo}${x.nome ? " " + title(x.nome) : ""}: ${x.tel}`);
  if (novos.length) c.append(el("p", "hint", "Contatos que a pessoa trouxe: " + novos.join(" · ")));
  if (p.trocouColegio)
    c.append(
      el(
        "p",
        "wait",
        `🏫 Trocou de colégio: ${title(p.escola) || "colégio anterior"} → ${title(d.escola)} (achado pelo ${(p.achadoPor || p.motivo) === "pais" ? "nome da mãe e do pai" : "telefone"}). Confira e decida.`
      )
    );
  const ant = (p.anteriores || []).filter(a => a.status);
  if (ant.length)
    c.append(
      el(
        "p",
        "wait",
        `⚠️ Esse aluno já foi pedido antes por ${quem}: ` +
          ant
            .map(
              a =>
                ({ aprovado: "passou", negado: "ficou onde estava", novo: "cadastrado como novo" })[a.status] +
                (a.decididoEm ? " em " + dia(a.decididoEm) : "")
            )
            .join(", ")
      )
    );
  const outros = todos.filter(x => x.alvoId === p.alvoId && x.id !== p.id).map(x => title(x.porNome || x.porEmail));
  if (outros.length) c.append(el("p", "wait", `⚠️ Também pedido por: ${outros.join(", ")}`));
  const act = el("div", "actions");
  const nome1 = U.first(quem);
  const bPassar = U.mkBtn(`Passar para ${nome1}`, "btn-ok btn-sm", () => decidir(C, p, "passar").catch(C.handleErr));
  act.append(
    bPassar,
    U.mkBtn("Manter onde está", "btn-sm", () => decidir(C, p, "manter").catch(C.handleErr)),
    U.mkBtn(`Cadastrar como novo para ${nome1}`, "btn-sm", () => decidir(C, p, "novo").catch(C.handleErr))
  );
  c.append(act);
  // como está o cadastro que já existe (e se quem pediu conseguiria ver o aluno se ele passar)
  C.FS.getDoc(C.FS.doc(C.db, "repasse", p.alvoId))
    .then(s => {
      if (!s.exists()) {
        onde.textContent = "O cadastro antigo não existe mais.";
        bPassar.hidden = true;
        return;
      }
      const r = s.data();
      onde.textContent = `Já existe: ${title(r.nome)} (${title(r.escola)}${r.ano ? ", " + r.ano : ""}), que ${ondeEsta(r)}.`;
      const u = (C.usuarios || {})[p.porEmail];
      if (VENDIDO.includes(r.etapa)) bPassar.hidden = true;
      else if (!podeVer(u, r.ano)) {
        bPassar.hidden = true;
        onde.textContent += ` ${nome1} só tem a Linha de Frente e não veria esse aluno do Repasse: mantenha ou cadastre como novo (se for outro ensaio, ex.: transferido).`;
      }
    })
    .catch(() => {
      onde.textContent = "";
    });
  return c;
}
// motivo da decisão para a equipe (pedidos antigos guardavam em "motivo", junto com como o aluno foi achado)
const motivoDecisao = p => p.motivoDecisao || (["telefone", "pais", "colegio"].includes(p.motivo) ? "" : p.motivo || "");
function cartaoEquipe(C, p) {
  const c = el("div", "notes");
  const aluno = title((p.dados && p.dados.nome) || p.aluno);
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
            : p.status === "novo"
              ? `✅ ${aluno} foi cadastrado como novo para você: já está na sua lista.`
              : `${aluno} ficou onde estava${motivoDecisao(p) ? " (" + motivoDecisao(p) + ")" : ""}. Não precisa trabalhar esse contato.`
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
