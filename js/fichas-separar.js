// 📂 Fotos numa pasta só (20/11/2026): no ensaio do colégio, cada aluno começa segurando a ficha. O app lê a pasta com
// todas as fotos (_MG_0910, _MG_0911…), acha as fotos da ficha (o papel branco) e separa os alunos: cada ficha
// começa um aluno novo, e as fotos seguintes são dele. As fichas vão para o 🤖 Cadastro automático (o Claude lê,
// vocês conferem). Depois da conferência, "📁 Criar as pastas dos alunos" faz, na própria pasta do colégio, uma pasta
// por aluno com o ID e o nome ("26 -CIEP336- 01 - DAVI SIQUEIRA SOARES"), move as fotos para dentro, renomeia
// ("26 -CIEP336- 01 - DAVI SIQUEIRA SOARES (1).JPG", (2)…; a (1) é a ficha) e grava no aluno quais são as fotos dele.
// Precisa do Chrome ou do Edge no computador (acesso às pastas). As fotos não são alteradas: só mudam de lugar e de nome.
import { el, title, sheet, field, sel } from "./ui.js";
import * as U from "./util.js";
import { acharPapel, fotoDaFicha, idFicha } from "./fichas.js";
import { lerCodigo } from "./aluno-id.js";

export const COLECAO = "pastasFotos"; // as pastas a criar (uma por aluno confirmado), só o admin
const FOTO = /\.(jpe?g|png|webp|heic|cr2|cr3|nef|arw)$/i;
const IMG = /\.(jpe?g|png|webp)$/i; // as que o navegador abre (para achar a ficha)
const p2 = n => String(n).padStart(2, "0");
const natural = (a, b) => String(a).localeCompare(String(b), "pt-BR", { numeric: true, sensitivity: "base" });

// itens = [{ name, papel }] na ordem das fotos → { grupos: [{ fichas, fotos }], antes: [fotos antes da 1ª ficha] }
// Cada foto com a ficha começa um aluno; fotos de ficha seguidas (o aluno segurou a ficha duas vezes) ficam juntas.
export function separarPorFicha(itens) {
  const grupos = [],
    antes = [];
  let g = null;
  for (const it of itens) {
    if (it.papel) {
      // (papel === 2: marcada à mão em "✂️ Separar": sempre começa outro aluno)
      const soFicha = g && g.fotos.length === g.fichas.length && it.papel !== 2;
      if (!soFicha) {
        g = { fichas: [], fotos: [] };
        grupos.push(g);
      }
      g.fichas.push(it.name);
      g.fotos.push(it.name);
    } else if (g) g.fotos.push(it.name);
    else antes.push(it.name);
  }
  return { grupos, antes };
}
// O Windows não aceita caminho muito comprido (pasta do colégio + pasta do aluno + nome da foto, até 260 letras):
// o nome do aluno na pasta fica com até 30 letras. Os nomes do meio viram a inicial, de trás para a frente
// ("MARIA EDUARDA FERREIRA DOS SANTOS SILVA" → "MARIA EDUARDA F. S. SILVA"); o 1º e o último nome ficam inteiros.
export const MAX_NOME = 30;
const LIGA = new Set(["DE", "DA", "DO", "DAS", "DOS", "E", "D"]);
export function abreviarNome(nome, max = MAX_NOME) {
  let w = String(nome || "")
    .toUpperCase()
    .replace(/[\\/:*?"<>|.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  const junto = () => w.join(" ");
  if (junto().length <= max) return junto();
  // abrevia os do meio (do penúltimo para o 2º) e tira as ligações ("DA", "DOS") que ficarem entre iniciais
  for (let i = w.length - 2; i >= 1 && junto().length > max; i--) {
    if (LIGA.has(w[i])) w.splice(i, 1);
    else if (!w[i].endsWith(".")) w[i] = w[i][0] + ".";
  }
  w = w.filter((x, i) => !(LIGA.has(x) && i > 0 && i < w.length - 1));
  if (junto().length <= max) return junto();
  // ainda grande: o 2º nome também vira inicial e, no fim, corta
  return junto().slice(0, max).trim();
}
// "26CIEP336-01" + "Davi Siqueira Soares" → "26 -CIEP336- 01 - DAVI SIQUEIRA SOARES" (sem caracteres que o Windows recusa)
export function nomePasta(codigo, nome) {
  const c = lerCodigo(codigo || "");
  const curto = abreviarNome(nome).replace(/[. ]+$/, "");
  if (!c) return curto;
  return `${c.aa != null ? p2(c.aa) + " " : ""}-${c.sigla}- ${p2(c.n)} - ${curto}`;
}
// os novos nomes das fotos (na ordem das fotos; a 1ª é a ficha): "<pasta> (1).JPG", "<pasta> (2).JPG"…
export function nomesDasFotos(pasta, fotos) {
  return [...fotos].sort(natural).map((n, i) => {
    const ext = (String(n).match(/\.[^.]+$/) || [".JPG"])[0];
    return [n, `${pasta} (${i + 1})${ext}`];
  });
}

// ---------- guardar a pasta escolhida neste computador (para não precisar escolher de novo) ----------
const BANCO = "z7-pastas";
function banco() {
  return new Promise((ok, erro) => {
    const r = indexedDB.open(BANCO, 1);
    r.onupgradeneeded = () => r.result.createObjectStore("h");
    r.onsuccess = () => ok(r.result);
    r.onerror = () => erro(r.error);
  });
}
async function guardarPasta(chave, h) {
  try {
    const db = await banco();
    db.transaction("h", "readwrite").objectStore("h").put(h, chave);
  } catch (_) {}
}
async function lerPasta(chave) {
  try {
    const db = await banco();
    return await new Promise(ok => {
      const r = db.transaction("h").objectStore("h").get(chave);
      r.onsuccess = () => ok(r.result || null);
      r.onerror = () => ok(null);
    });
  } catch (_) {
    return null;
  }
}
const chavePasta = (escola, ano, origem) => `${U.chave(escola)}|${ano}|${origem}`;
async function liberar(h) {
  const o = { mode: "readwrite" };
  if (h.queryPermission && (await h.queryPermission(o)) === "granted") return true;
  return !h.requestPermission || (await h.requestPermission(o)) === "granted";
}
// tem o papel da ficha? (miniatura de 200 px, a mesma conta do Cadastro automático)
async function temPapel(file) {
  if (!IMG.test(file.name)) return false;
  let bmp;
  try {
    bmp = await createImageBitmap(file);
  } catch (_) {
    return false;
  }
  const W = 200,
    H = Math.max(1, Math.round((bmp.height * W) / bmp.width));
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const x = c.getContext("2d", { willReadFrequently: true });
  x.drawImage(bmp, 0, 0, W, H);
  bmp.close && bmp.close();
  return !!acharPapel(x.getImageData(0, 0, W, H).data, W, H);
}
async function miniatura(file) {
  try {
    const bmp = await createImageBitmap(file);
    const W = 90,
      H = Math.round((bmp.height * W) / bmp.width);
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    c.getContext("2d").drawImage(bmp, 0, 0, W, H);
    return c.toDataURL("image/jpeg", 0.7);
  } catch (_) {
    return "";
  }
}

// ---------- 1) separar: escolhe o colégio e a pasta com todas as fotos ----------
export function abrirSepararPelaFicha(C, depois) {
  sheet(
    "📂 Separar as fotos pela ficha",
    async (p, close) => {
      p.append(
        el(
          "p",
          "hint",
          "Escolha o colégio e a pasta com todas as fotos do ensaio (uma pasta só). O app acha as fotos da ficha e separa os alunos. " +
            "Depois da conferência no Cadastro automático, o botão “📁 Criar as pastas dos alunos” faz a pasta de cada um, com as fotos dentro e renomeadas."
        )
      );
      if (!window.showDirectoryPicker) {
        p.append(el("p", "err", "Use o Chrome ou o Edge no computador (este navegador não abre pastas)."), U.mkBtn("Fechar", "", close));
        return;
      }
      const insts = [];
      try {
        (await C.FS.getDocs(C.FS.collection(C.db, "instituicoes"))).forEach(d => insts.push({ id: d.id, ...d.data() }));
      } catch (e) {
        return C.handleErr(e);
      }
      insts.sort((a, b) => natural(a.nome, b.nome));
      const sInst = sel(
        insts.map(i => [i.id, title(i.nome)]),
        "",
        "escolha o colégio"
      );
      const ano = el("input");
      ano.inputMode = "numeric";
      ano.value = String(new Date().getFullYear());
      // (24/11/2026) antes de guardar, a pergunta: para onde vão esses alunos? (sem escolha pronta: o padrão "PR"
      // mandou o E.M. Manoel Gomes, que era contrato de certificado + canudo, para o PR)
      const DESTINOS = [
        ["alugueis", "📄 Contrato do colégio", "aluguel de becas, certificado, canudo, kits"],
        ["formaturaAlunos", "🎓 Formatura", "venda antecipada (boleto)"],
        ["repasse", "🖼️ PR", "kit quadro + porta-retratos"],
        ["repasse:paspatur", "📒 Paspatur", "kit Paspatur (livro A4)"]
      ];
      const sCol = { value: "" };
      const dest = el("div", "cad-ops");
      const bts = DESTINOS.map(([k, t, sub]) => {
        const b = el("button", "cad-op");
        b.type = "button";
        b.setAttribute("aria-pressed", "false");
        const [ico, ...nm] = t.split(" ");
        b.append(el("span", "cad-op-ico", ico), el("b", null, nm.join(" ")), el("small", null, sub));
        b.onclick = () => {
          sCol.value = k;
          bts.forEach(x => x.setAttribute("aria-pressed", String(x === b)));
        };
        dest.append(b);
        return b;
      });
      const dica = el("p", "notice");
      dica.hidden = true;
      // colégio com contrato no ano: sugere o Contrato do colégio
      const sugerir = async () => {
        dica.hidden = true;
        if (!sInst.value) return;
        const c = await C.FS.getDoc(C.FS.doc(C.db, "contratosColegio", `${sInst.value}_${Number(ano.value) || ""}`)).catch(() => null);
        if (c && c.exists()) {
          const R = await import("./contrato-colegio-regras.js");
          dica.textContent = `📄 Este colégio tem contrato em ${ano.value} (${R.textoPacote(c.data().pacotePadrao) || "kit"}). Os alunos vão para o Contrato do colégio?`;
          dica.hidden = false;
        }
      };
      sInst.addEventListener("change", sugerir);
      ano.addEventListener("change", sugerir);
      const r = el("div", "row2");
      r.append(field("Colégio", sInst), field("Ano", ano));
      const fDest = el("div", "field");
      fDest.append(el("label", null, "Para onde vão esses alunos?"), dest, dica);
      p.append(r, fDest);
      const msg = el("p", "hint");
      const lista = el("div", "eb-datas");
      let dir = null,
        arquivos = new Map(),
        grupos = [],
        antes = [],
        papel = new Map();
      const refazer = () => {
        const nomes = [...arquivos.keys()].sort(natural);
        ({ grupos, antes } = separarPorFicha(nomes.map(name => ({ name, papel: papel.get(name) }))));
        desenhar();
      };
      const desenhar = () => {
        lista.innerHTML = "";
        msg.textContent = `${arquivos.size} fotos · ${grupos.length} aluno${grupos.length === 1 ? "" : "s"} (uma ficha por aluno)`;
        if (antes.length)
          lista.append(
            el("p", "wait", `⚠️ ${antes.length} foto(s) antes da 1ª ficha ficam na pasta, sem aluno: ${antes.slice(0, 4).join(", ")}…`)
          );
        grupos.forEach((g, i) => {
          const l = el("div", "eb-data");
          const im = el("img");
          im.alt = "Ficha";
          im.width = 45;
          miniatura(arquivos.get(g.fichas[0])).then(u => (im.src = u));
          const tx = el("div", "eb-txt");
          tx.append(
            el("span", null, `Aluno ${p2(i + 1)} · ${g.fotos.length} foto${g.fotos.length === 1 ? "" : "s"}`),
            el("small", null, `${g.fotos[0]} a ${g.fotos[g.fotos.length - 1]}`)
          );
          l.append(im, tx);
          // o app não viu uma ficha (dois alunos juntos): escolher a foto da ficha que começa o outro aluno
          if (g.fotos.length > g.fichas.length)
            l.append(
              U.mkBtn("✂️ Separar", "btn-sm", () =>
                sheet("✂️ Qual foto é a ficha do próximo aluno?", (q, fechar) => {
                  const grade = el("div", "eb-bts");
                  g.fotos
                    .filter(n => !g.fichas.includes(n))
                    .forEach(n => {
                      const b = el("button", "btn btn-sm");
                      b.type = "button";
                      const im2 = el("img");
                      im2.width = 70;
                      im2.alt = n;
                      miniatura(arquivos.get(n)).then(u => (im2.src = u));
                      b.append(im2, el("div", null, n));
                      b.onclick = () => {
                        papel.set(n, 2);
                        fechar();
                        refazer();
                      };
                      grade.append(b);
                    });
                  q.append(grade, U.mkBtn("Cancelar", "", fechar));
                })
              )
            );
          // a foto não é uma ficha (o app se enganou): junta com o aluno de antes
          if (i > 0)
            l.append(
              U.mkBtn("Não é ficha", "btn-sm", () => {
                g.fichas.forEach(n => papel.set(n, false));
                refazer();
              })
            );
          lista.append(l);
        });
      };
      const bPasta = U.mkBtn("📁 Escolher a pasta das fotos", "btn-primary", async () => {
        try {
          dir = await window.showDirectoryPicker({ id: "z7-ensaio", mode: "readwrite" });
        } catch (_) {
          return;
        }
        arquivos = new Map();
        papel = new Map();
        for await (const [nome, h] of dir.entries()) if (h.kind === "file" && FOTO.test(nome)) arquivos.set(nome, h);
        const nomes = [...arquivos.keys()].sort(natural);
        if (!nomes.length) return (msg.textContent = "Nenhuma foto nessa pasta.");
        let n = 0;
        for (const nome of nomes) {
          msg.textContent = `Procurando as fichas: ${++n} de ${nomes.length}…`;
          const f = await arquivos.get(nome).getFile();
          papel.set(nome, await temPapel(f));
          arquivos.set(nome, f);
        }
        refazer();
      });
      const ok = U.mkBtn("Guardar as fichas", "btn-primary", async () => {
        const inst = insts.find(i => i.id === sInst.value);
        if (!inst) return U.toast("Escolha o colégio.");
        if (!dir || !grupos.length) return U.toast("Escolha a pasta das fotos.");
        if (!sCol.value) return U.toast("Escolha para onde vão esses alunos (Contrato, Formatura, PR ou Paspatur).");
        const [colNome, vendaComo] = sCol.value.split(":");
        const a = Number(ano.value) || null;
        let n = 0;
        for (const [i, g] of grupos.entries()) {
          msg.textContent = `Guardando a ficha ${++n} de ${grupos.length}…`;
          const pasta = `Aluno ${p2(i + 1)} (${g.fichas[0].replace(/\.[^.]+$/, "")})`;
          try {
            const foto = await fotoDaFicha(arquivos.get(g.fichas[0]));
            await C.FS.setDoc(C.FS.doc(C.db, "fichas", idFicha(inst.nome, a, pasta + (colNome === "alugueis" ? " ALU" : ""))), {
              escola: inst.nome,
              instId: inst.id,
              ano: a,
              colNome,
              ...(vendaComo ? { vendaComo } : {}),
              pasta,
              arquivo: g.fichas[0],
              img: foto.img,
              semPapel: !foto.achou,
              status: "nova",
              fotos: g.fotos,
              origem: dir.name,
              criadoEm: new Date().toISOString(),
              por: C.me || ""
            });
          } catch (e) {
            console.warn("[Z7] ficha", e);
          }
        }
        await guardarPasta(chavePasta(inst.nome, a, dir.name), dir);
        U.toast(`✅ ${n} fichas guardadas. Agora toque em Pedir a leitura.`);
        close();
        if (depois) depois();
      });
      p.append(bPasta, msg, lista);
      const ac = el("div", "actions");
      ac.append(ok, U.mkBtn("Cancelar", "", close));
      p.append(ac);
    },
    { div: true, wide: true }
  );
}

// ---------- 2) na conferência: guarda a pasta a criar do aluno confirmado ----------
export async function guardarPastaPendente(C, f, aluno) {
  if (!f || !Array.isArray(f.fotos) || !f.fotos.length) return;
  await C.FS.setDoc(C.FS.doc(C.db, COLECAO, f.id), {
    escola: f.escola,
    ano: f.ano || null,
    colNome: f.colNome || "repasse",
    alunoId: aluno.id,
    codigo: aluno.codigo || "",
    nome: aluno.nome || "",
    fotos: f.fotos,
    origem: f.origem || "",
    status: "a criar",
    criadoEm: new Date().toISOString(),
    por: C.me || ""
  });
}
export async function pastasACriar(C) {
  const s = await C.FS.getDocs(C.FS.query(C.FS.collection(C.db, COLECAO), C.FS.where("status", "==", "a criar")));
  return s.docs.map(d => ({ id: d.id, ...d.data() }));
}

// move (ou copia e apaga) uma foto para a pasta do aluno, já com o nome novo
async function moverFoto(origem, destino, nome, novo) {
  const fh = await origem.getFileHandle(nome);
  if (typeof fh.move === "function")
    try {
      await fh.move(destino, novo);
      return;
    } catch (_) {
      /* sem "mover" neste navegador: copia e apaga */
    }
  const file = await fh.getFile();
  const nh = await destino.getFileHandle(novo, { create: true });
  const w = await nh.createWritable();
  await w.write(file);
  await w.close();
  await origem.removeEntry(nome);
}
const existe = async (d, nome) => {
  try {
    await d.getFileHandle(nome);
    return true;
  } catch (_) {
    return false;
  }
};

// ---------- 3) criar as pastas dos alunos (depois da conferência) ----------
export async function criarPastas(C, depois) {
  let itens;
  try {
    itens = await pastasACriar(C);
  } catch (e) {
    return C.handleErr(e);
  }
  if (!itens.length) return U.toast("Nenhuma pasta para criar.");
  if (!window.showDirectoryPicker) return U.toast("Use o Chrome ou o Edge no computador.");
  const porOrigem = new Map();
  itens.forEach(x => {
    const k = chavePasta(x.escola, x.ano, x.origem);
    (porOrigem.get(k) || porOrigem.set(k, []).get(k)).push(x);
  });
  let feitas = 0,
    fotos = 0;
  const erros = [];
  for (const [k, lista] of porOrigem) {
    const ex = lista[0];
    let dir = await lerPasta(k);
    if (!dir || typeof dir.getDirectoryHandle !== "function" || !(await liberar(dir).catch(() => false))) {
      U.toast(`Escolha a pasta “${ex.origem}” (${title(ex.escola)}).`);
      try {
        dir = await window.showDirectoryPicker({ id: "z7-ensaio", mode: "readwrite" });
      } catch (_) {
        continue;
      }
      if (dir.name !== ex.origem && !confirm(`A pasta escolhida é “${dir.name}”, e as fotos estavam em “${ex.origem}”. Usar assim mesmo?`))
        continue;
      await guardarPasta(k, dir);
    }
    for (const x of lista) {
      const pasta = nomePasta(x.codigo, x.nome);
      try {
        const destino = await dir.getDirectoryHandle(pasta, { create: true });
        const nomes = nomesDasFotos(pasta, x.fotos);
        for (const [antigo, novo] of nomes) {
          if (await existe(dir, antigo)) {
            await moverFoto(dir, destino, antigo, novo);
            fotos++;
          } else if (!(await existe(destino, novo))) erros.push(`${antigo} não está mais na pasta`);
        }
        await C.FS.updateDoc(C.FS.doc(C.db, x.colNome, x.alunoId), {
          fotosPasta: pasta,
          fotosArquivos: nomes.map(n => n[1]),
          atualizadoEm: new Date().toISOString()
        }).catch(e => erros.push(`${x.nome}: ${e.message || e}`));
        await C.FS.updateDoc(C.FS.doc(C.db, COLECAO, x.id), { status: "feita", pasta, feitaEm: new Date().toISOString() });
        feitas++;
      } catch (e) {
        erros.push(`${x.nome}: ${e.message || e}`);
      }
    }
  }
  U.toast(
    `✅ ${feitas} pasta${feitas === 1 ? "" : "s"} de aluno, ${fotos} fotos no lugar.` + (erros.length ? ` ${erros.length} aviso(s).` : "")
  );
  if (erros.length) console.warn("[Z7] criar pastas", erros);
  if (depois) depois();
}
