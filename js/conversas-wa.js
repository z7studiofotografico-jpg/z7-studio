// Conversas do WhatsApp e dúvidas do cliente (26/11/2026), na aba "Conversa" da janela do aluno.
// 1) 🏷️ Dúvidas e objeções: um toque por dúvida (achou caro, vai pensar…). Vira número: por que vende e por que não.
// 2) 📎 Conversa do WhatsApp: o vendedor exporta a conversa no celular (⋮ → Mais → Exportar conversa → Incluir mídia)
//    e manda para o app (compartilhar → Z7 Studio, ou o botão Anexar). O arquivo fica guardado no site, fora da parte
//    pública; só o Adriano baixa, e o Claude lê (e transcreve os áudios) para melhorar as mensagens e as vendas.
import { el, sheet } from "./ui.js";
import * as U from "./util.js";
import { API_SITE } from "./site-previas.js";

export const OBJECOES = [
  "Achou caro",
  "Vai pensar",
  "Sem dinheiro agora",
  "Vai falar com o pai/mãe",
  "Não gostou das fotos",
  "Quer só as fotos digitais",
  "Dúvida no prazo de entrega",
  "Dúvida na forma de pagamento",
  "Já comprou de outro",
  "Não responde"
];

// o arquivo que veio pelo "Compartilhar → Z7 Studio" do WhatsApp (o sw.js guarda até o vendedor escolher o aluno)
const CACHE = "z7-compartilhado";
const CHAVE = "./__conversa-recebida__";
export async function conversaRecebida() {
  try {
    if (!("caches" in self)) return null;
    const r = await (await caches.open(CACHE)).match(CHAVE);
    if (!r) return null;
    const nome = decodeURIComponent(r.headers.get("X-Nome") || "conversa.txt");
    return { nome, blob: await r.blob() };
  } catch (_) {
    return null;
  }
}
// o app abriu pelo Compartilhar: explica o próximo passo (escolher o aluno)
export async function avisoConversaRecebida() {
  const rec = await conversaRecebida();
  sheet(
    "📥 Conversa recebida",
    (p, fechar) => {
      p.append(
        el(
          "p",
          null,
          rec
            ? `A conversa do WhatsApp chegou (${tamanho(rec.blob.size)}). Agora abra o aluno dela (busque pelo nome ou ID), vá na aba "Conversa" e toque em "📥 Guardar a conversa recebida".`
            : "Não chegou nenhum arquivo. No WhatsApp: ⋮ → Mais → Exportar conversa → Incluir mídia → Z7 Studio."
        )
      );
      const b = el("button", "btn btn-primary", "Entendi");
      b.type = "button";
      b.onclick = fechar;
      const a = el("div", "actions");
      a.append(b);
      p.append(a);
    },
    { div: true }
  );
}
async function esquecerRecebida() {
  try {
    await (await caches.open(CACHE)).delete(CHAVE);
  } catch (_) {
    // sem cache: nada a apagar
  }
}

async function enviar(C, it, col, arquivo, nome) {
  const f = new FormData();
  f.append("col", col);
  f.append("aluno", it.id);
  f.append("codigo", it.codigo || "");
  f.append("nome", it.nome || "");
  f.append("arquivo", arquivo, nome || arquivo.name || "conversa.txt");
  const t = C.token ? await C.token() : "";
  const r = await fetch(API_SITE + "/conversas.php", { method: "POST", body: f, headers: { Authorization: "Bearer " + t } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.id) throw new Error(j.erro || "Não consegui guardar a conversa (" + r.status + ").");
  return j;
}

const tamanho = b => (b > 1048576 ? (b / 1048576).toFixed(1).replace(".", ",") + " MB" : Math.max(1, Math.round(b / 1024)) + " KB");

// o = { C, col, salvar(patch, msg) }
export function blocoConversasWa(it, o) {
  const box = el("div", "ja-wa");
  // dúvidas e objeções
  box.append(
    el("h3", null, "🏷️ Dúvidas e objeções do cliente"),
    el("p", "hint", "Toque no que o cliente falou (pode marcar mais de uma).")
  );
  const chips = el("div", "chips");
  const marcadas = new Set(it.objecoes || []);
  OBJECOES.forEach(t => {
    const b = el("button", "chip chip-sm", t);
    b.type = "button";
    b.setAttribute("aria-pressed", String(marcadas.has(t)));
    b.onclick = async () => {
      if (marcadas.has(t)) marcadas.delete(t);
      else marcadas.add(t);
      b.setAttribute("aria-pressed", String(marcadas.has(t)));
      await o.salvar({ objecoes: [...marcadas], objecoesEm: new Date().toISOString() }, "Dúvida guardada");
    };
    chips.append(b);
  });
  box.append(chips);

  // conversas exportadas do WhatsApp
  box.append(
    el("h3", null, "📎 Conversa do WhatsApp"),
    el(
      "p",
      "hint",
      "No celular: abra a conversa → ⋮ → Mais → Exportar conversa → Incluir mídia → Z7 Studio. Ou salve o arquivo e toque em Anexar."
    )
  );
  const lista = el("div", "ja-dados");
  const desenhar = () => {
    lista.innerHTML = "";
    (it.conversasWa || []).forEach(x => {
      const d = el("div");
      d.append(
        el("small", null, dataBR(x.em)),
        el(
          "span",
          null,
          `${x.ext === "zip" ? "💬🎤 Conversa com áudios" : "💬 Conversa"} · ${tamanho(x.tam || 0)} · ${U.first(x.por) || ""}`
        )
      );
      lista.append(d);
    });
  };
  desenhar();
  const guardar = async (arquivo, nome) => {
    U.toast("Enviando a conversa…");
    const j = await enviar(o.C, it, o.col, arquivo, nome);
    const reg = { id: j.id, ext: j.ext, tam: j.tam, em: new Date().toISOString(), por: o.C.me || "" };
    await o.salvar({ conversasWa: [...(it.conversasWa || []), reg].slice(-30) }, "Conversa guardada ✅");
    desenhar();
  };
  const linha = el("div", "row");
  const inp = el("input");
  inp.type = "file";
  inp.accept = ".txt,.zip,text/plain,application/zip";
  inp.hidden = true;
  inp.onchange = async () => {
    const f = inp.files && inp.files[0];
    inp.value = "";
    if (!f) return;
    try {
      await guardar(f, f.name);
    } catch (e) {
      o.C.handleErr(e);
    }
  };
  linha.append(
    inp,
    U.mkBtn("📎 Anexar conversa", "btn-sm", () => inp.click())
  );
  // a que chegou pelo Compartilhar do WhatsApp
  conversaRecebida().then(rec => {
    if (!rec) return;
    const b = U.mkBtn(`📥 Guardar a conversa recebida (${tamanho(rec.blob.size)})`, "btn-sm btn-primary", async () => {
      b.disabled = true;
      try {
        await guardar(rec.blob, rec.nome);
        await esquecerRecebida();
        b.remove();
      } catch (e) {
        b.disabled = false;
        o.C.handleErr(e);
      }
    });
    linha.prepend(b);
  });
  box.append(linha, lista);
  return box;
}

function dataBR(iso) {
  const d = String(iso || "").slice(0, 10);
  return d ? U.fmtDate(d) : "";
}
