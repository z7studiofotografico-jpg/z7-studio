// "🖼️ Fotos do aluno" (cartão do PR): busca no Google Drive a folha numerada e as fotos separadas do aluno,
// para mandar a folha pelo WhatsApp e, com as fotos que a família escolher, montar o quadro e os porta-retratos.
import { el, sheet, title, field } from "./ui.js";
import * as U from "./util.js";
import { criarDrive, idDaPasta, pastaDoColegio } from "./drive-fotos.js";
import { openMockup } from "./mockup.js";
import { contatoAtual } from "./repasse-estado.js";

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
// Leitura: com a chave (pasta aberta com link; a equipe vê sem entrar no Google), a não ser que em Ajustes esteja
// "cada pessoa entra com a conta Google" (driveLeitura = "conta"). O ID do cliente Google serve para o admin gravar.
const leComConta = C => !!C.P.driveCliente && C.P.driveLeitura === "conta";
export function abrirDrive(C) {
  const cliente = leComConta(C) ? C.P.driveCliente : "";
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
const NOMES_PAS = ["Direita", "Esquerda", "Pequenas", "Tirinha", "Calendário"];
// admin: aluno sem foto no Drive ganha o botão de enviar (gera a prévia e grava na pasta do colégio)
function botaoEnviar(C, it, p, close, precoTxt, cartaoTxt) {
  if (!C.isAdmin) return;
  p.append(
    U.mkBtn("📤 Enviar foto", "btn-primary", () => {
      close();
      import("./enviar-foto.js")
        .then(m => m.enviarFotoAluno(C, it, { verFotos: () => abrirFotosDoAluno(C, it, precoTxt, cartaoTxt) }))
        .catch(e => C.handleErr(e));
    })
  );
}

// precoTxt: o texto do preço do kit (o mesmo da prévia)
export function abrirFotosDoAluno(C, it, precoTxt, cartaoTxt = "") {
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
      botaoEnviar(C, it, p, close, precoTxt, cartaoTxt);
      p.append(U.mkBtn("Fechar", "", close));
      return;
    }
    info.textContent = `${r.fotos.length} foto${r.fotos.length === 1 ? "" : "s"} · ${r.colegio.replace(/^Pr[ée]vias\s*-\s*/i, "")}`;
    // Kit Paspatur (aluno vendido como Paspatur): 4 lugares em vez de quadro e 2 porta-retratos
    const pas = it.vendaComo === "paspatur";
    const nomes = pas ? NOMES_PAS : NOMES,
      maxEsc = nomes.length;
    // 1) a folha numerada: para a família escolher
    const folhas = [];
    if (r.folhas.length) {
      const bFolha = U.mkBtn("📤 Enviar a folha numerada", "btn-primary", async () => {
        try {
          bFolha.disabled = true;
          if (!folhas.length) for (const f of r.folhas) folhas.push(new File([await D.baixar(f.id)], f.name, { type: "image/jpeg" }));
          const texto = pas
            ? `Olá! Aqui estão as fotos de ${U.first(title(it.nome))} 📸 Escolha as fotos do Kit Paspatur (a grande da direita, a grande da esquerda, as 3 pequenas, a tirinha e a do calendário) e me responda com os números 😊`
            : `Olá! Aqui estão as fotos de ${U.first(title(it.nome))} 📸 Escolha 1 foto para o quadro e 2 para os porta-retratos e me responda com os números 😊`;
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
    p.append(
      el(
        "p",
        "hint",
        pas
          ? "Toque nas fotos que a família escolheu, na ordem: página da direita, foto grande da esquerda, as 3 pequenas, a tirinha e a do calendário (no particular, a foto da turma)."
          : "Toque nas fotos que a família escolheu, na ordem: primeiro a do quadro, depois as 2 dos porta-retratos."
      )
    );
    const grade = el("div", "fotos-grade");
    p.append(grade);
    const escolha = []; // índices
    const blobs = [];
    const montar = U.mkBtn(
      pas ? "🖼️ Montar o Kit Paspatur com estas fotos" : "🖼️ Montar o quadro com estas fotos",
      "btn-primary",
      async () => {
        close();
        openMockup({
          tel: (contatoAtual(it) || {}).tel, // o WhatsApp Web abre na conversa de quem foi escolhido
          nome: title(it.nome || ""),
          escola: title(it.escola || ""),
          preco: precoTxt,
          cartao: cartaoTxt,
          toast: U.toast,
          fotos: escolha.map(i => blobs[i]),
          kit: pas ? "paspatur" : "pr",
          encarte: pas ? await (await import("./encarte.js")).encarteDoColegio(it.escola) : undefined
        });
      }
    );
    montar.disabled = true;
    const pintar = () => {
      [...grade.children].forEach((b, i) => {
        const k = escolha.indexOf(i);
        b.classList.toggle("on", k >= 0);
        b.querySelector(".tag").textContent = k >= 0 ? nomes[k] : "";
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
        else if (escolha.length < maxEsc) escolha.push(i);
        else
          U.toast(
            pas
              ? "Já escolheu as 5 do Kit Paspatur. Toque numa para tirar."
              : "Já escolheu as 3 (quadro e 2 porta-retratos). Toque numa para tirar."
          );
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
  if (!leComConta(C)) return true;
  const t = tokens[LEITURA];
  return !!(t && t.ate > Date.now() + 60000);
}
// foto grande, por cima da janela; excluir (opcional): o botão "🗑️ Excluir esta foto"
function verGrande(url, nome, excluir) {
  sheet(
    null,
    (p, close) => {
      p.classList.add("foto-grande");
      const img = el("img");
      img.src = url;
      img.alt = nome || "Foto";
      const acoes = el("div", "actions");
      acoes.append(U.mkBtn("Fechar", "", close));
      if (excluir) acoes.append(U.mkBtn("🗑️ Excluir esta foto", "btn-danger", () => excluir(close)));
      p.append(img, acoes);
    },
    { div: true, wide: true }
  );
}
// Excluir uma foto do aluno (ex.: a foto da ficha): vai para a lixeira do Drive (dá para recuperar por 30 dias) e
// some da lista do aluno. Admin e equipe podem; a conta Google da pessoa precisa ser Editor da pasta das prévias.
// Fica anotado no aluno quem excluiu e quando (fotosExcluidas).
export async function excluirFoto(C, it, f, rot, o = {}) {
  const { confirmar } = await import("./confirmar.js");
  const sim = await confirmar(
    `Excluir ${/^\d+$/.test(rot) ? "a foto " + rot : "a " + rot.toLowerCase()} de ${U.first(title(it.nome || ""))}?`,
    "A foto vai para a lixeira do Google Drive (dá para recuperar por 30 dias) e não aparece mais para o aluno.",
    { sim: "Sim, excluir", nao: "Cancelar", perigo: true }
  );
  if (!sim) return false;
  const D = abrirDriveEscrita(C);
  if (!D) {
    U.toast("Para excluir fotos, o administrador liga a conta Google em ⚙️ Ajustes (ID do cliente Google).");
    return false;
  }
  try {
    await D.lixeira(f.id);
  } catch (e) {
    U.toast(
      /gravar|Editor|permissão/i.test(e.message || "")
        ? "Sua conta Google não pode excluir fotos na pasta das prévias. Peça ao Adriano para deixar o seu e-mail como Editor da pasta no Drive."
        : e.message || "Não consegui excluir a foto agora."
    );
    return false;
  }
  // a próxima leitura procura de novo no Drive
  abrirDrive(C).esquecer();
  D.esquecer();
  jaBaixadas.delete(f.id);
  if (o.salvar)
    await o.salvar(
      {
        fotosExcluidas: (it.fotosExcluidas || [])
          .concat([{ nome: f.name || rot, por: C.me || "", porEmail: C.email || "", em: new Date().toISOString() }])
          .slice(-50)
      },
      "Foto excluída (está na lixeira do Drive por 30 dias) ✅"
    );
  else U.toast("Foto excluída (está na lixeira do Drive por 30 dias) ✅");
  return true;
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
  // trocar e enviar fotos: só o administrador
  const trocar = C.isAdmin ? U.mkBtn("🔄 Trocar as fotos", "", () => trocarFotos(C, it, o.salvar)) : null;
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
    info.textContent = r.erro + (C.isAdmin ? " Se as fotos estão com outro nome, toque em “🔄 Trocar as fotos” e escolha." : "");
    if (C.isAdmin) acoes.append(trocar, botaoEnviarNovas(C, it, o));
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
    U.mkBtn("🖼️ Enviar a folha / montar o quadro", "btn-primary", () => abrirFotosDoAluno(C, it, o.precoTxt || "", o.cartaoTxt || ""))
  );
  // link da prévia no site (z7studio.com.br/previa/?c=…): a família vê as fotos, o kit, o preço e chama no WhatsApp
  const bLink = U.mkBtn(it.linkPrevia ? "🔗 Mandar o link da prévia de novo" : "🔗 Mandar o link da prévia", "", async () => {
    bLink.disabled = true;
    try {
      await (await import("./link-previa.js")).mandarLinkPrevia(C, it, r, Object.assign({}, o, { tel: (contatoAtual(it) || {}).tel }));
    } catch (e) {
      C.handleErr(e);
    } finally {
      bLink.disabled = false;
    }
  });
  acoes.append(bLink);
  if (C.isAdmin) acoes.append(trocar, botaoEnviarNovas(C, it, o));
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
      b.onclick = () =>
        verGrande(url, rot, async fechar => {
          if (await excluirFoto(C, it, f, rot, o)) {
            fechar();
            miniaturasDoAluno(C, it, box, o);
          }
        });
    } catch (_) {
      b.append(el("small", "wait", "não abriu"));
    }
  }
}
function botaoEnviarNovas(C, it, o) {
  return U.mkBtn("📤 Enviar fotos novas", "", () =>
    import("./enviar-foto.js")
      .then(m => m.enviarFotoAluno(C, it, { verFotos: () => abrirFotosDoAluno(C, it, o.precoTxt || "", o.cartaoTxt || "") }))
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
