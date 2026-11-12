// 🤖 Cadastro automático (12/11/2026): a foto da ficha (a 1ª de cada aluno na pasta do ensaio) fica numa área fechada
// (coleção "fichas", só o admin), o Claude lê a letra de mão, e a equipe confere aqui antes de virar cadastro.
// Status da ficha: "nova" (esperando leitura) → "lida" (esperando conferência) → confirmada (a ficha é apagada).
// Pedido por colégio ("fichasPedidos"): o colégio fica travado enquanto está "na fila" ou "conferir".
import { el, title, sheet } from "./ui.js";
import * as U from "./util.js";
import { lerCodigo, fmtCodigo } from "./aluno-id.js";
import { siglaDoColegio } from "./cadastro-regras.js";

export const CAMPOS = [
  ["numero", "Nº da ficha"],
  ["turma", "Turma"],
  ["nome", "Aluno"],
  ["nasc", "Nascimento"],
  ["celAluno", "Celular do aluno"],
  ["mae", "Mãe"],
  ["celMae", "Celular da mãe"],
  ["pai", "Pai"],
  ["celPai", "Celular do pai"],
  ["rua", "Rua"],
  ["numeroCasa", "Nº"],
  ["bairro", "Bairro"],
  ["cidade", "Cidade"],
  ["cep", "CEP"],
  ["email", "E-mail"]
];
const LADO = 1600; // tamanho em que a letra da ficha dá para ler (testado em 12/11/2026)

export const chaveGrupo = (escola, ano) => U.chave(escola).replace(/[^A-Z0-9]+/g, "-") + "_" + (ano || "");
const idFicha = (escola, ano, pasta) => (chaveGrupo(escola, ano) + "_" + U.chave(pasta).replace(/[^A-Z0-9]+/g, "-")).slice(0, 140);

// ---------- 1. Prévias de um colégio: guarda a foto da ficha ----------
// A ficha ocupa só um pedaço da foto (o aluno segura o papel na frente do corpo): o app acha o papel branco e guarda
// só ele, em alta resolução (12/11/2026: guardando a foto inteira em 1600 px, os telefones ficavam ilegíveis).
// data = pixels RGBA de uma miniatura w × h; devolve a caixa do papel (em pixels da miniatura) ou null
export function acharPapel(data, w, h) {
  const branco = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = data[i * 4],
      g = data[i * 4 + 1],
      b = data[i * 4 + 2];
    const mn = Math.min(r, g, b),
      mx = Math.max(r, g, b);
    branco[i] = mn > 150 && mx - mn < 45 ? 1 : 0;
  }
  const visto = new Uint8Array(w * h);
  let melhor = null;
  for (let s0 = 0; s0 < w * h; s0++) {
    if (!branco[s0] || visto[s0]) continue;
    let x0 = w,
      y0 = h,
      x1 = 0,
      y1 = 0,
      n = 0;
    const pilha = [s0];
    visto[s0] = 1;
    while (pilha.length) {
      const p = pilha.pop();
      n++;
      const x = p % w,
        y = (p / w) | 0;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w])
        if (q >= 0 && q < w * h && branco[q] && !visto[q]) {
          visto[q] = 1;
          pilha.push(q);
        }
    }
    const bw = x1 - x0 + 1,
      bh = y1 - y0 + 1,
      cheio = n / (bw * bh),
      prop = bh / bw;
    // papel: grande, quase todo branco (a renda da beca é branca mas vazada) e em pé
    if (n < w * h * 0.02 || cheio < 0.6 || prop < 0.9 || prop > 2.2) continue;
    if (!melhor || n * cheio > melhor.nota) melhor = { x0, y0, x1, y1, nota: n * cheio };
  }
  return melhor;
}
// ordem para procurar a ficha: o arquivo sem número, depois (1), (2)… ou _1, _2…
export function ordemFicha(nomes) {
  const num = n => {
    const m = String(n).match(/(?:\((\d+)\)|_(\d+))\s*\.[a-z]+$/i);
    return m ? Number(m[1] || m[2]) : 0;
  };
  return nomes
    .map((n, i) => [n, i])
    .sort((a, b) => num(a[0]) - num(b[0]) || a[1] - b[1])
    .map(x => x[1]);
}
async function abrirImagem(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
const paraTexto = c => {
  // o documento do Firebase cabe até 1 MB: baixa a qualidade se precisar
  for (const q of [0.85, 0.75, 0.6]) {
    const d = c.toDataURL("image/jpeg", q);
    if (d.length < 900000) return d;
  }
  return c.toDataURL("image/jpeg", 0.5);
};
// { img (dataURL), achou } da foto: só o papel (com margem), até 1800 px; sem papel, a foto inteira em 1600 px
export async function fotoDaFicha(file) {
  const img = await abrirImagem(file);
  const W = 200,
    H = Math.round((img.height * W) / img.width);
  const mini = document.createElement("canvas");
  mini.width = W;
  mini.height = H;
  const mx = mini.getContext("2d", { willReadFrequently: true });
  mx.drawImage(img, 0, 0, W, H);
  const p = acharPapel(mx.getImageData(0, 0, W, H).data, W, H);
  const k = img.width / W;
  const box = p
    ? (() => {
        const m = 0.04 * Math.max(p.x1 - p.x0, p.y1 - p.y0);
        const x0 = Math.max(0, (p.x0 - m) * k),
          y0 = Math.max(0, (p.y0 - m) * k);
        return [x0, y0, Math.min(img.width, (p.x1 + 1 + m) * k) - x0, Math.min(img.height, (p.y1 + 1 + m) * k) - y0];
      })()
    : [0, 0, img.width, img.height];
  const lado = p ? 1800 : LADO;
  const r = Math.min(1, lado / Math.max(box[2], box[3]));
  const c = document.createElement("canvas");
  c.width = Math.round(box[2] * r);
  c.height = Math.round(box[3] * r);
  c.getContext("2d").drawImage(img, box[0], box[1], box[2], box[3], 0, 0, c.width, c.height);
  return { img: paraTexto(c), achou: !!p };
}
// guarda a ficha do aluno: procura o papel nas 3 primeiras fotos (pela ordem dos nomes); devolve o arquivo usado
export async function guardarFicha(C, { escola, ano, colNome, pasta, arquivos }) {
  const { FS, db } = C;
  const ordem = ordemFicha(arquivos.map(h => h.name)).slice(0, 3);
  let escolhida = null,
    foto = null;
  for (const i of ordem) {
    const f = await fotoDaFicha(await arquivos[i].getFile());
    if (f.achou || !foto) {
      escolhida = arquivos[i];
      foto = f;
    }
    if (f.achou) break;
  }
  await FS.setDoc(FS.doc(db, "fichas", idFicha(escola, ano, pasta)), {
    escola,
    ano: Number(ano) || null,
    colNome,
    pasta,
    arquivo: escolhida.name,
    img: foto.img,
    semPapel: !foto.achou,
    status: "nova",
    criadoEm: new Date().toISOString(),
    por: C.me || ""
  });
  return escolhida;
}

// ---------- 2. Leitura (o Claude usa pelo navegador do computador) ----------
// pendentes: fichas dos colégios pedidos no botão, ainda sem leitura
export async function pendentes(C) {
  const { FS, db } = C;
  const ped = await FS.getDocs(FS.query(FS.collection(db, "fichasPedidos"), FS.where("status", "==", "na fila")));
  const out = [];
  for (const d of ped.docs) {
    const p = d.data();
    const s = await FS.getDocs(
      FS.query(
        FS.collection(db, "fichas"),
        FS.where("escola", "==", p.escola),
        FS.where("ano", "==", p.ano),
        FS.where("status", "==", "nova")
      )
    );
    s.forEach(f => out.push({ id: f.id, escola: p.escola, ano: p.ano, pasta: f.data().pasta }));
  }
  return out;
}
// mostra a ficha grande na tela (para ler); parte 0 = metade de cima, 1 = de baixo
export async function ver(C, id, parte = 1, zoom = 1) {
  const s = await C.FS.getDoc(C.FS.doc(C.db, "fichas", id));
  if (!s.exists()) return "não achei";
  document.getElementById("z7Ficha")?.remove();
  const box = el("div");
  box.id = "z7Ficha";
  box.style.cssText = "position:fixed;inset:0;z-index:99999;background:#000;overflow:hidden";
  const img = el("img");
  img.src = s.data().img;
  img.style.cssText = `position:absolute;left:50%;transform:translateX(-50%) scale(${zoom});transform-origin:top center;width:auto;height:${parte === 1 ? 200 : 100}vh;top:${parte === 1 ? -100 : 0}vh`;
  box.onclick = () => box.remove();
  box.append(img);
  document.body.append(box);
  return s.data().pasta;
}
export function fecharVer() {
  document.getElementById("z7Ficha")?.remove();
}
// grava o que foi lido; duvidas = campos com letra difícil
export async function gravarLeitura(C, id, lido, duvidas = []) {
  const limpo = {};
  CAMPOS.forEach(([k]) => (limpo[k] = String(lido[k] || "").trim()));
  await C.FS.updateDoc(C.FS.doc(C.db, "fichas", id), {
    lido: limpo,
    duvidas: duvidas.filter(k => CAMPOS.some(([c]) => c === k)),
    status: "lida",
    lidaEm: new Date().toISOString()
  });
}
// colégio todo lido: sai da fila e vai para a conferência
export async function terminarLeitura(C) {
  const { FS, db } = C;
  const ped = await FS.getDocs(FS.query(FS.collection(db, "fichasPedidos"), FS.where("status", "==", "na fila")));
  for (const d of ped.docs) await FS.updateDoc(d.ref, { status: "conferir", lidoEm: new Date().toISOString() });
  return ped.size;
}

// ---------- 3. Número do ID: o da ficha, ou o menor livre a partir do 1 ----------
export function menorLivre(usados) {
  let n = 1;
  while (usados.has(n)) n++;
  return n;
}
// só dígitos (o U.digits põe o 55 do WhatsApp na frente)
const so = t => String(t || "").replace(/\D/g, "");
// o número do aluno no quadro "Nº identificação"; se lá estiver o colégio ("CIEP 433"), não é o número do aluno
export const soNumero = t => {
  const x = String(t || "")
    .replace(/^\s*n[º°o.]?\s*/i, "")
    .trim();
  if (!/^\d{1,4}$/.test(x)) return null;
  const n = Number(x);
  return n > 0 ? n : null;
};
// telefone da ficha: só dígitos, DDD 21 quando vier sem
export function telDaFicha(t) {
  let d = so(t);
  if (d.length === 8 || d.length === 9) d = "21" + d;
  return d.length === 10 || d.length === 11 ? d : "";
}
export function contatosDaFicha(l) {
  return [
    ["Formando", l.nome, l.celAluno],
    ["Mãe", l.mae, l.celMae],
    ["Pai", l.pai, l.celPai]
  ]
    .map(([tipo, nome, tel]) => ({ tipo, nome: String(nome || "").trim(), tel: telDaFicha(tel) }))
    .filter(c => c.tel);
}

// ---------- 4. Janela: 🤖 Cadastro automático ----------
export function abrirCadastroAutomatico(C, colNome = "") {
  sheet(
    "🤖 Cadastro automático",
    async (p, close) => {
      p.classList.add("cad");
      p.append(
        el(
          "p",
          "hint",
          "1) Gere as prévias do colégio em “🗂️ Prévias de um colégio” (a 1ª foto de cada aluno é a ficha). 2) Toque em Pedir a leitura. 3) Escreva para o Claude: “lê as fichas”. 4) Confira aqui e confirme."
        )
      );
      const lista = el("div");
      p.append(lista, U.mkBtn("Fechar", "", close));
      const { FS, db } = C;
      async function montar() {
        lista.textContent = "Carregando…";
        let fichas, pedidos;
        try {
          const [a, b] = await Promise.all([
            FS.getDocs(colNome ? FS.query(FS.collection(db, "fichas"), FS.where("colNome", "==", colNome)) : FS.collection(db, "fichas")),
            FS.getDocs(FS.collection(db, "fichasPedidos"))
          ]);
          fichas = a.docs.map(d => ({ id: d.id, ...d.data() }));
          pedidos = new Map(b.docs.map(d => [d.id, d.data()]));
        } catch (e) {
          lista.textContent = "Não consegui abrir as fichas agora.";
          return C.handleErr(e);
        }
        lista.textContent = "";
        const grupos = new Map();
        fichas.forEach(f => {
          const k = chaveGrupo(f.escola, f.ano);
          if (!grupos.has(k))
            grupos.set(k, { escola: f.escola, ano: f.ano, colNome: f.colNome || colNome || "repasse", nova: 0, lida: 0, fichas: [] });
          const g = grupos.get(k);
          g[f.status] = (g[f.status] || 0) + 1;
          g.fichas.push(f);
        });
        if (!grupos.size)
          lista.append(
            el("p", "hint", "Nenhuma ficha guardada ainda. Gere as prévias de um colégio com “A 1ª foto de cada aluno é a ficha” marcado.")
          );
        grupos.forEach((g, k) => {
          const ped = pedidos.get(k);
          const b = el("div", "cad-parte");
          const st =
            ped && ped.status === "na fila"
              ? "🔒 Na fila de leitura: escreva “lê as fichas” para o Claude"
              : ped && ped.status === "conferir"
                ? "🔒 Lido: falta conferir"
                : "";
          b.append(
            el("b", null, (g.ano ? g.ano + " · " : "") + g.escola),
            el("p", "hint", `${g.nova || 0} para ler · ${g.lida || 0} para conferir${st ? " · " + st : ""}`)
          );
          const acoes = el("div", "quick");
          if (g.nova && !(ped && ped.status === "na fila"))
            acoes.append(
              U.mkBtn("🤖 Pedir a leitura", "btn-sm btn-primary", async () => {
                await FS.setDoc(FS.doc(db, "fichasPedidos", k), {
                  escola: g.escola,
                  ano: g.ano,
                  colNome: g.colNome,
                  status: "na fila",
                  pedidoEm: new Date().toISOString(),
                  por: C.me || ""
                });
                U.toast("Pedido feito. Agora escreva para o Claude: lê as fichas");
                montar();
              })
            );
          if (g.lida) {
            acoes.append(U.mkBtn(`📋 Conferir (${g.lida})`, "btn-sm", () => conferir(C, g, g.colNome, montar)));
            acoes.append(
              U.mkBtn("⬇️ Planilha", "btn-sm", () =>
                import("./cadastro-aluno.js").then(m =>
                  m.baixarPlanilha(
                    "fichas-" + U.chave(g.escola).slice(0, 20),
                    g.fichas
                      .filter(f => f.status === "lida")
                      .map(f => ({ pasta: f.pasta, ...f.lido, duvidas: (f.duvidas || []).join(", ") })),
                    [["pasta", "Pasta"], ...CAMPOS, ["duvidas", "⚠️ Conferir"]]
                  )
                )
              )
            );
          }
          b.append(acoes);
          lista.append(b);
        });
      }
      montar();
    },
    { div: true, wide: true }
  );
}

// ---------- 5. Conferência: a ficha de um lado, os campos do outro ----------
async function conferir(C, g, colNome, depois) {
  const { FS, db } = C;
  // alunos que já estão no app (mesmo colégio e ano): para juntar e para achar o número livre
  const s = await FS.getDocs(FS.query(FS.collection(db, colNome), FS.where("escola", "==", g.escola), FS.where("ano", "==", g.ano)));
  const existentes = s.docs.map(d => ({ id: d.id, ...d.data() }));
  const usados = new Set(existentes.map(x => (lerCodigo(x.codigo || "") || {}).n).filter(Boolean));
  const sigla = (existentes.map(x => lerCodigo(x.codigo || "")).find(x => x && x.sigla) || {}).sigla || siglaDoColegio({ nome: g.escola });
  sheet(
    "📋 Conferir fichas · " + g.escola,
    (p, close) => {
      p.classList.add("cad");
      const fichas = g.fichas.filter(f => f.status === "lida").sort((a, b) => a.pasta.localeCompare(b.pasta, "pt-BR", { numeric: true }));
      const info = el("p", "hint", `${fichas.length} fichas para conferir. Os campos com ⚠️ estavam difíceis de ler: confira com a foto.`);
      p.append(info);
      fichas.forEach(f => p.append(cartao(f)));
      p.append(U.mkBtn("Fechar", "", () => (close(), depois())));
      function cartao(f) {
        const b = el("div", "cad-parte ficha-conf");
        const foto = el("img", "ficha-foto");
        foto.src = f.img;
        foto.alt = "Ficha de " + f.pasta;
        foto.onclick = () => foto.classList.toggle("grande");
        const campos = el("div", "ficha-campos");
        const ins = {};
        CAMPOS.forEach(([k, rot]) => {
          const d = el("div", "field" + ((f.duvidas || []).includes(k) ? " duvida" : ""));
          const l = el("label", null, ((f.duvidas || []).includes(k) ? "⚠️ " : "") + rot);
          const i = el("input");
          i.value = (f.lido || {})[k] || "";
          i.id = "fc-" + f.id.slice(-20) + "-" + k;
          l.htmlFor = i.id;
          ins[k] = i;
          d.append(l, i);
          campos.append(d);
        });
        const aviso = el("p", "hint");
        const sem = !soNumero((f.lido || {}).numero);
        if (sem) aviso.textContent = "⚠️ Sem número na ficha: ao confirmar, recebe o menor número livre.";
        const ok = U.mkBtn("✔ Confirmar", "btn-primary btn-sm", async () => {
          ok.disabled = true;
          try {
            const lido = Object.fromEntries(Object.entries(ins).map(([k, i]) => [k, i.value.trim()]));
            const r = await confirmar(C, { f, lido, colNome, existentes, usados, sigla });
            b.replaceChildren(
              el(
                "p",
                null,
                `✅ ${title(lido.nome || f.pasta)} · ${r.codigo} · ${r.novo ? "cadastro novo" : "juntado com o cadastro que já existia"}`
              )
            );
          } catch (e) {
            ok.disabled = false;
            C.handleErr(e);
          }
        });
        const topo = el("div", "ficha-topo");
        topo.append(el("b", null, f.pasta), ok);
        b.append(topo, aviso, foto, campos);
        return b;
      }
    },
    { div: true, wide: true }
  );
}

// grava o aluno (junta com o que já existe pelo ID ou pelo nome) e apaga a foto da ficha
export async function confirmar(C, { f, lido, colNome, existentes, usados, sigla }) {
  const { FS, db } = C;
  if (!lido.nome) throw Object.assign(new Error("Falta o nome do aluno."), { aviso: true });
  const nFicha = soNumero(lido.numero);
  const porNome = existentes.find(x => x.nomeBusca === U.chave(lido.nome));
  const porNum = nFicha && existentes.find(x => (lerCodigo(x.codigo || "") || {}).n === nFicha);
  const achado = porNome || porNum;
  const n = achado && lerCodigo(achado.codigo || "") ? lerCodigo(achado.codigo).n : nFicha || menorLivre(usados);
  usados.add(n);
  const codigo = (achado && achado.codigo) || fmtCodigo(Number(f.ano), sigla, n);
  const contatos = contatosDaFicha(lido);
  const endereco = { rua: lido.rua, numero: lido.numeroCasa, bairro: lido.bairro, cidade: lido.cidade, cep: so(lido.cep) };
  const agora = new Date().toISOString();
  const { indexarFones } = await import("./pedidos.js");
  let novo = false;
  if (achado) {
    const tels = new Set((achado.contatos || []).map(c => so(c.tel)));
    const juntos = [...(achado.contatos || []), ...contatos.filter(c => !tels.has(c.tel))];
    const patch = {
      contatos: juntos,
      telefones: [...new Set(juntos.map(c => so(c.tel)).filter(Boolean))],
      codigo,
      atualizadoEm: agora,
      fichaLidaEm: agora
    };
    if (lido.turma) patch.turma = lido.turma;
    if (lido.nasc) patch.nascimento = lido.nasc;
    if (lido.email) patch.email = lido.email.toLowerCase();
    const temEnd = Object.values(endereco).some(Boolean);
    if (temEnd)
      patch.endereco = Object.assign({}, achado.endereco || {}, Object.fromEntries(Object.entries(endereco).filter(([, v]) => v)));
    if (achado.etapa === "INCOMPLETO" && juntos.length) patch.etapa = "NA FILA";
    const ref = FS.doc(db, colNome, achado.id);
    await FS.runTransaction(db, async tx => {
      tx.update(ref, patch);
      if (colNome === "repasse") indexarFones(FS, db, tx, achado.id, { ...achado, ...patch });
    });
    Object.assign(achado, patch);
  } else {
    novo = true;
    const { docId } = await import("./repasse-dados.js");
    const { codigoBusca } = await import("./aluno-id.js");
    const ano = Number(f.ano);
    const doc = {
      nome: lido.nome.toUpperCase(),
      nomeBusca: U.chave(lido.nome),
      escola: f.escola,
      ano,
      codigo,
      codigoBusca: codigoBusca(codigo),
      turma: lido.turma || "",
      nascimento: lido.nasc || "",
      email: (lido.email || "").toLowerCase(),
      contatos,
      telefones: contatos.map(c => c.tel),
      endereco,
      obs: "",
      etapa: contatos.length ? "NA FILA" : "INCOMPLETO",
      followup: null,
      tentativas: 0,
      tentInteresse: 0,
      resp: "",
      respEmail: "",
      ...(colNome === "formaturaAlunos" ? { seg: ano >= new Date().getFullYear() ? "lf" : "rep" } : {}),
      manual: true,
      daFicha: true,
      incluidoPor: C.email || "",
      importadoEm: agora,
      atualizadoEm: agora,
      fichaLidaEm: agora
    };
    const ref = FS.doc(db, colNome, docId(doc, Date.now()));
    await FS.runTransaction(db, async tx => {
      tx.set(ref, doc);
      if (colNome === "repasse") indexarFones(FS, db, tx, ref.id, doc);
    });
    existentes.push({ id: ref.id, ...doc });
  }
  await FS.deleteDoc(FS.doc(db, "fichas", f.id)); // a foto da ficha não é mais usada
  f.status = "confirmada";
  // colégio todo conferido: destrava
  const resta = await FS.getDocs(
    FS.query(FS.collection(db, "fichas"), FS.where("escola", "==", f.escola), FS.where("ano", "==", f.ano), FS.limit(1))
  );
  if (resta.empty) await FS.deleteDoc(FS.doc(db, "fichasPedidos", chaveGrupo(f.escola, f.ano))).catch(() => {});
  return { codigo, novo };
}
