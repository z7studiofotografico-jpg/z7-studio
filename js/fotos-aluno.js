// "🖼️ Fotos do aluno" (cartão do PR): busca no Google Drive a folha numerada e as fotos separadas do aluno,
// para mandar a folha pelo WhatsApp e, com as fotos que a família escolher, montar o quadro e os porta-retratos.
import { el, sheet, title, field } from "./ui.js";
import * as U from "./util.js";
import { criarDrive, idDaPasta, pastaDoColegio } from "./drive-fotos.js";
import { openMockup } from "./mockup.js";

let drive = null,
  chaveUsada = "";
// Pasta fechada: cada pessoa entra com a conta Google dela (Google Identity Services); o token vale ~1 hora.
// Ler: só leitura. Gravar (admin, "📤 Enviar foto"): pede a permissão do Drive inteiro na hora de enviar.
export const LEITURA = "https://www.googleapis.com/auth/drive.readonly",
  ESCRITA = "https://www.googleapis.com/auth/drive";
const tokens = {};
function carregarGsi() {
  if (window.google && window.google.accounts && window.google.accounts.oauth2) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.onload = res;
    s.onerror = () => rej(new Error("Não consegui abrir o login do Google. Verifique a internet."));
    document.head.append(s);
  });
}
export function tokenGoogle(cliente, email, escopo = LEITURA) {
  const token = tokens[escopo];
  if (token && token.ate > Date.now() + 60000) return Promise.resolve(token.v);
  return carregarGsi().then(
    () =>
      new Promise((res, rej) => {
        const tc = window.google.accounts.oauth2.initTokenClient({
          client_id: cliente,
          scope: escopo,
          hint: email || "",
          callback: r => {
            if (r.error || !r.access_token) return rej(new Error("Entrada no Google cancelada ou recusada."));
            if (
              escopo === ESCRITA &&
              window.google.accounts.oauth2.hasGrantedAllScopes &&
              !window.google.accounts.oauth2.hasGrantedAllScopes(r, ESCRITA)
            )
              return rej(new Error("Para enviar fotos, marque a opção do Google Drive na tela do Google (ver, editar e criar arquivos)."));
            tokens[escopo] = { v: r.access_token, ate: Date.now() + (Number(r.expires_in) || 3600) * 1000 };
            res(tokens[escopo].v);
          },
          error_callback: () => rej(new Error("Entrada no Google cancelada."))
        });
        tc.requestAccessToken({ prompt: "" });
      })
  );
}
export function abrirDrive(C) {
  const cliente = C.P.driveCliente || "";
  const k = cliente ? "oauth:" + cliente : C.P.driveChave || ((self.Z7_CONFIG || {}).firebase || {}).apiKey || "";
  if (!drive || chaveUsada !== k) {
    drive = criarDrive(cliente ? () => tokenGoogle(cliente, C.email) : k, (u, o) => fetch(u, o));
    chaveUsada = k;
  }
  return drive;
}
// Drive com permissão de gravar (admin): sempre com a conta Google da pessoa
let driveEscrita = null,
  chaveEscrita = "";
export function abrirDriveEscrita(C) {
  const cliente = C.P.driveCliente || "";
  if (!cliente) return null;
  if (!driveEscrita || chaveEscrita !== cliente) {
    driveEscrita = criarDrive(
      () => tokenGoogle(cliente, C.email, ESCRITA),
      (u, o) => fetch(u, o)
    );
    chaveEscrita = cliente;
  }
  return driveEscrita;
}
// depois de enviar foto: a leitura procura de novo no Drive (sem a lista guardada)
export function esquecerListas() {
  if (drive) drive.esquecer();
  if (driveEscrita) driveEscrita.esquecer();
}
const NOMES = ["Quadro", "Porta-retratos 1", "Porta-retratos 2"];
// admin: aluno sem foto no Drive ganha o botão de enviar (gera a prévia e grava na pasta do colégio)
function botaoEnviar(C, it, p, close, precoTxt) {
  if (!C.isAdmin) return;
  p.append(
    U.mkBtn("📤 Enviar foto", "btn-primary", () => {
      close();
      import("./enviar-foto.js")
        .then(m => m.enviarFotoAluno(C, it, { verFotos: () => abrirFotosDoAluno(C, it, precoTxt) }))
        .catch(e => C.handleErr(e));
    })
  );
}

// precoTxt: o texto do preço do kit (o mesmo da prévia)
export function abrirFotosDoAluno(C, it, precoTxt) {
  sheet("🖼️ Fotos de " + U.first(title(it.nome || "")), async (p, close) => {
    const raiz = idDaPasta(C.P.drivePrevias);
    if (!raiz) {
      p.append(
        el("p", "wait", "A pasta das prévias no Google Drive ainda não foi ligada ao app (o administrador cola o link em Ajustes)."),
        U.mkBtn("Fechar", "", close)
      );
      return;
    }
    const info = el("p", "hint", "Procurando as fotos no Google Drive…");
    p.append(info);
    const D = abrirDrive(C);
    let r;
    try {
      r = await D.fotosDoAluno(raiz, it);
    } catch (e) {
      info.className = "wait";
      info.textContent = e.message || "Não consegui ler o Google Drive agora.";
      p.append(U.mkBtn("Fechar", "", close));
      return;
    }
    if (r.erro) {
      info.className = "wait";
      info.textContent = r.erro;
      botaoEnviar(C, it, p, close, precoTxt);
      p.append(U.mkBtn("Fechar", "", close));
      return;
    }
    info.textContent = `${r.fotos.length} foto${r.fotos.length === 1 ? "" : "s"} · ${r.colegio.replace(/^Pr[ée]vias\s*-\s*/i, "")}`;
    // 1) a folha numerada: para a família escolher
    const folhas = [];
    if (r.folhas.length) {
      const bFolha = U.mkBtn("📤 Enviar a folha numerada", "btn-primary", async () => {
        try {
          bFolha.disabled = true;
          if (!folhas.length) for (const f of r.folhas) folhas.push(new File([await D.baixar(f.id)], f.name, { type: "image/jpeg" }));
          const texto = `Olá! Aqui estão as fotos de ${U.first(title(it.nome))} 📸 Escolha 1 foto para o quadro e 2 para os porta-retratos e me responda com os números 😊`;
          if (navigator.canShare && navigator.canShare({ files: folhas })) await navigator.share({ files: folhas, text: texto });
          else
            folhas.forEach(f => {
              const a = el("a");
              a.href = URL.createObjectURL(f);
              a.download = f.name;
              a.click();
              setTimeout(() => URL.revokeObjectURL(a.href), 5000);
            });
        } catch (e) {
          if (!(e && e.name === "AbortError")) C.handleErr(e);
        } finally {
          bFolha.disabled = false;
        }
      });
      p.append(bFolha);
    }
    // 2) as fotos separadas: toque na ordem quadro → porta-retratos
    if (!r.fotos.length) return p.append(U.mkBtn("Fechar", "", close));
    p.append(el("p", "hint", "Toque nas fotos que a família escolheu, na ordem: primeiro a do quadro, depois as 2 dos porta-retratos."));
    const grade = el("div", "fotos-grade");
    p.append(grade);
    const escolha = []; // índices
    const blobs = [];
    const montar = U.mkBtn("🖼️ Montar o quadro com estas fotos", "btn-primary", () => {
      close();
      openMockup({
        nome: title(it.nome || ""),
        escola: title(it.escola || ""),
        preco: precoTxt,
        toast: U.toast,
        fotos: escolha.map(i => blobs[i])
      });
    });
    montar.disabled = true;
    const pintar = () => {
      [...grade.children].forEach((b, i) => {
        const k = escolha.indexOf(i);
        b.classList.toggle("on", k >= 0);
        b.querySelector(".tag").textContent = k >= 0 ? NOMES[k] : "";
      });
      montar.disabled = !escolha.length;
    };
    r.fotos.forEach((f, i) => {
      const b = el("button", "foto-item");
      b.type = "button";
      b.append(el("span", "num", String(i + 1)), el("span", "tag", ""));
      b.disabled = true;
      b.onclick = () => {
        const k = escolha.indexOf(i);
        if (k >= 0) escolha.splice(k, 1);
        else if (escolha.length < 3) escolha.push(i);
        else U.toast("Já escolheu as 3 (quadro e 2 porta-retratos). Toque numa para tirar.");
        pintar();
      };
      grade.append(b);
    });
    p.append(montar, U.mkBtn("Fechar", "", close));
    // baixa as fotos uma a uma (pequenas: ~60 KB cada)
    for (const [i, f] of r.fotos.entries()) {
      if (!p.isConnected) return;
      try {
        blobs[i] = await D.baixar(f.id);
        const img = el("img");
        img.alt = "Foto " + (i + 1);
        img.src = URL.createObjectURL(blobs[i]);
        grade.children[i].prepend(img);
        grade.children[i].disabled = false;
      } catch (e) {
        grade.children[i].append(el("small", "wait", "não abriu"));
      }
    }
  });
}

// ---------- Janela do aluno → Prévia e fotos ----------
const jaBaixadas = new Map();
// Já dá para ler o Drive sem abrir a tela do Google? (chave do Google, ou entrada feita há menos de 1 hora)
export function driveLiberado(C) {
  if (!C.P.driveCliente) return true;
  const t = tokens[LEITURA];
  return !!(t && t.ate > Date.now() + 60000);
}
// foto grande, por cima da janela
function verGrande(url, nome) {
  sheet(
    null,
    (p, close) => {
      p.classList.add("foto-grande");
      const img = el("img");
      img.src = url;
      img.alt = nome || "Foto";
      p.append(img, U.mkBtn("Fechar", "", close));
    },
    { div: true, wide: true }
  );
}
// Miniaturas da folha e das fotos do aluno direto na aba; tocar amplia.
// o = { precoTxt, salvar(patch, msg) } (salvar grava no aluno: usado pelo "🔄 Trocar as fotos")
export async function miniaturasDoAluno(C, it, box, o = {}) {
  box.innerHTML = "";
  const raiz = idDaPasta(C.P.drivePrevias);
  if (!raiz) {
    box.append(el("p", "hint", "Para ver as fotos do Drive aqui, o administrador liga a pasta das prévias em ⚙️ Ajustes."));
    return;
  }
  const info = el("p", "hint", "Procurando as fotos no Google Drive…");
  box.append(info);
  const acoes = el("div", "actions");
  const trocar = U.mkBtn("🔄 Trocar as fotos", "", () => trocarFotos(C, it, o.salvar));
  let r;
  try {
    r = await abrirDrive(C).fotosDoAluno(raiz, it);
  } catch (e) {
    info.className = "wait";
    info.textContent = e.message || "Não consegui ler o Google Drive agora.";
    return;
  }
  if (r.erro) {
    info.className = "wait";
    info.textContent = r.erro + " Se as fotos estão com outro nome, toque em “🔄 Trocar as fotos” e escolha.";
    acoes.append(trocar);
    if (C.isAdmin) acoes.append(botaoEnviarNovas(C, it, o));
    box.append(acoes);
    return;
  }
  info.textContent =
    `${r.folhas.length ? r.folhas.length + " folha" + (r.folhas.length > 1 ? "s" : "") + " · " : ""}${r.fotos.length} foto${r.fotos.length === 1 ? "" : "s"} · ` +
    r.colegio.replace(/^Pr[ée]vias\s*-\s*/i, "") +
    (r.escolhida ? " · escolhidas à mão" : "");
  const grade = el("div", "fotos-grade");
  box.append(grade);
  const itens = [
    ...r.folhas.map((f, i) => [f, r.folhas.length > 1 ? "Folha " + (i + 1) : "Folha"]),
    ...r.fotos.map((f, i) => [f, String(i + 1)])
  ];
  itens.forEach(([f, rot]) => {
    const b = el("button", "foto-item");
    b.type = "button";
    b.disabled = true;
    b.append(el("span", "num", rot));
    b.setAttribute("aria-label", rot === String(Number(rot)) ? "Foto " + rot : rot);
    grade.append(b);
  });
  acoes.append(
    U.mkBtn("🖼️ Enviar a folha / montar o quadro", "btn-primary", () => abrirFotosDoAluno(C, it, o.precoTxt || "")),
    trocar
  );
  if (C.isAdmin) acoes.append(botaoEnviarNovas(C, it, o));
  box.append(acoes);
  // baixa uma a uma (prévias pequenas, com marca d'água); a janela redesenha quando o aluno muda: guarda o que já baixou
  const D = abrirDrive(C);
  for (const [i, [f, rot]] of itens.entries()) {
    if (!box.isConnected) return;
    const b = grade.children[i];
    try {
      const url = jaBaixadas.get(f.id) || URL.createObjectURL(await D.baixar(f.id));
      jaBaixadas.set(f.id, url);
      const img = el("img");
      img.alt = rot;
      img.src = url;
      b.prepend(img);
      b.disabled = false;
      b.onclick = () => verGrande(url, rot);
    } catch (_) {
      b.append(el("small", "wait", "não abriu"));
    }
  }
}
function botaoEnviarNovas(C, it, o) {
  return U.mkBtn("📤 Enviar fotos novas", "", () =>
    import("./enviar-foto.js")
      .then(m => m.enviarFotoAluno(C, it, { verFotos: () => abrirFotosDoAluno(C, it, o.precoTxt || "") }))
      .catch(e => C.handleErr(e))
  );
}
// "🔄 Trocar as fotos": importação errada ou nome diferente no Drive. Escolhe o colégio e o aluno certo na pasta
// das prévias; a escolha fica gravada no aluno (fotosDrive) e vale antes da busca automática. Nada muda no Drive.
export function trocarFotos(C, it, salvar) {
  sheet("🔄 Trocar as fotos de " + U.first(title(it.nome || "")), async (p, close) => {
    const raiz = idDaPasta(C.P.drivePrevias);
    const D = abrirDrive(C);
    p.append(
      el(
        "p",
        "hint",
        "Escolha de quem são as fotos certas na pasta das prévias. A troca fica guardada só neste aluno; as pastas do Drive não mudam."
      )
    );
    const info = el("p", "hint", "Lendo as pastas do Drive…");
    p.append(info);
    let colegios = [];
    try {
      colegios = await D.pastasColegios(raiz);
      if (!colegios.length) colegios = [{ id: raiz, name: await D.nomeDe(raiz) }];
    } catch (e) {
      info.className = "wait";
      info.textContent = e.message || "Não consegui ler o Google Drive agora.";
      p.append(U.mkBtn("Fechar", "", close));
      return;
    }
    info.remove();
    const atual = it.fotosDrive || {};
    const achado = atual.colegioId ? colegios.find(c => c.id === atual.colegioId) : pastaDoColegio(colegios, it);
    const sCol = el("select");
    colegios
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
      .forEach(c => {
        const op = el("option", null, c.name.replace(/^Pr[ée]vias\s*-\s*/i, ""));
        op.value = c.id;
        sCol.append(op);
      });
    if (achado) sCol.value = achado.id;
    const busca = el("input", "search");
    busca.type = "search";
    busca.placeholder = "Procurar pelo nome ou número";
    busca.setAttribute("aria-label", "Procurar aluno nas prévias");
    const lista = el("div", "troca-lista");
    const err = el("p", "err");
    err.hidden = true;
    let alunos = [],
      escolhido = null;
    const pintar = () => {
      lista.innerHTML = "";
      const q = U.chave(busca.value);
      const vis = alunos.filter(a => !q || U.chave(a.cod + " " + a.nome).includes(q));
      if (!vis.length) lista.append(el("p", "hint", "Nenhum aluno com prévia aqui."));
      vis.slice(0, 300).forEach(a => {
        const l = el("label", "chk troca-item");
        const rb = el("input");
        rb.type = "radio";
        rb.name = "trocaAluno";
        rb.checked =
          escolhido === a || (!escolhido && (a.folhaId === atual.folhaId || a.pastaId === atual.pastaId) && !!(a.folhaId || a.pastaId));
        rb.onchange = () => (escolhido = a);
        l.append(rb, document.createTextNode(` ${a.cod ? a.cod + " - " : ""}${a.nome}${a.pastaId ? "" : " (só a folha)"}`));
        lista.append(l);
      });
    };
    const carregar = async () => {
      lista.innerHTML = "";
      lista.append(el("p", "hint", "Carregando…"));
      escolhido = null;
      try {
        alunos = await D.alunosDaPasta(sCol.value);
      } catch (e) {
        alunos = [];
      }
      pintar();
    };
    sCol.onchange = carregar;
    busca.oninput = pintar;
    p.append(field("Colégio no Drive", sCol), busca, lista, err);
    const acoes = el("div", "panel-actions");
    acoes.append(
      U.mkBtn("Cancelar", "", close),
      ...(atual.colegioId
        ? [
            U.mkBtn("Voltar para a busca automática", "", async () => {
              await salvar({ fotosDrive: null }, "As fotos voltam a ser achadas pelo nome");
              close();
            })
          ]
        : []),
      U.mkBtn("Usar estas fotos", "btn-primary", async () => {
        if (!escolhido) {
          err.textContent = "Escolha o aluno na lista.";
          err.hidden = false;
          return;
        }
        const col = colegios.find(c => c.id === sCol.value) || {};
        await salvar(
          {
            fotosDrive: {
              colegioId: col.id || "",
              colegio: col.name || "",
              folhaId: escolhido.folhaId || "",
              pastaId: escolhido.pastaId || "",
              nome: escolhido.nome,
              por: C.me || "",
              em: new Date().toISOString()
            }
          },
          "Fotos trocadas ✅"
        );
        close();
      })
    );
    p.append(acoes);
    carregar();
  });
}
