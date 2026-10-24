// Turma de um colégio FECHADO: formandos, kit escolhido, parcelas e cobrança no WhatsApp.
// Coleção "formandos": { instId, instNome, ano, nome, tel, serie, kit, valor, parcelas, pagas, primeiroVenc, status, resp, vendidoEm }
let C, FS, db, unsub = null;
function el(tag, cls, text){ const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function title(s){ return String(s || "").toLowerCase().replace(/(^|[\s(-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase()).replace(/\b(Da|De|Do|Das|Dos|E)\b/g, w => w.toLowerCase()); }
const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const n0 = v => Number(v) || 0;
let fid = 0;
function field(lbl, i){ const f = el("div", "field"); const l = el("label", null, lbl); i.id = i.id || "tm" + (++fid); l.htmlFor = i.id; f.append(l, i); return f; }
function inp(v, ph, max){ const i = el("input"); i.value = v == null ? "" : v; i.placeholder = ph || ""; i.maxLength = max || 120; return i; }

// Quantas parcelas já deveriam estar pagas hoje (uma por mês a partir do 1º vencimento)
export function esperadas(f, hoje){
  if (!f.primeiroVenc || !n0(f.parcelas)) return 0;
  const [y, m, d] = f.primeiroVenc.split("-").map(Number), [ty, tm, td] = hoje.split("-").map(Number);
  const k = (ty - y) * 12 + (tm - m) + (td > d ? 1 : 0);
  return Math.max(0, Math.min(n0(f.parcelas), k));
}
function vencDa(f, n){ const [y, m, d] = f.primeiroVenc.split("-").map(Number); const dt = new Date(y, m - 1 + n - 1, d); return `${dt.getFullYear()}-${C.pad(dt.getMonth() + 1)}-${C.pad(dt.getDate())}`; }
const parcela = f => n0(f.valor) / (n0(f.parcelas) || 1);
const quitado = f => n0(f.pagas) >= (n0(f.parcelas) || 1);
const atrasado = f => !quitado(f) && f.status !== "desistiu" && esperadas(f, C.todayStr()) > n0(f.pagas);

export function openTurma(ctx, inst, kits){
  C = ctx; FS = ctx.FS; db = ctx.db;
  const col = FS.collection(db, "formandos");
  let lista = [], filtro = "todos", busca = "";
  const sh = el("div", "sheet"); const p = el("div", "panel wide"); sh.append(p);
  const close = () => { if (unsub) { unsub(); unsub = null; } sh.remove(); };
  sh.addEventListener("click", ev => { if (ev.target === sh) close(); });
  const head = el("div", "vhead"); head.append(el("h2", null, "Formandos · " + title(inst.nome)), C.mkBtn("Fechar", "btn-sm", close)); p.append(head);
  const resumo = el("div", "kpis"); p.append(resumo);
  const bar = el("div", "actions");
  bar.append(C.mkBtn("+ Formando", "btn-primary", () => form()), C.mkBtn("Importar planilha", "", () => importar()));
  p.append(bar);
  const chips = el("div", "chips"); p.append(chips);
  const q = inp("", "Buscar nome ou telefone"); q.type = "search"; q.className = "search"; q.oninput = () => { busca = norm(q.value); desenhar(); }; p.append(q);
  const lst = el("div", "grid"); p.append(lst);
  document.body.append(sh);
  unsub = FS.onSnapshot(FS.query(col, FS.where("instId", "==", inst.id), FS.limit(2000)), snap => {
    lista = snap.docs.map(d => Object.assign({ id: d.id }, d.data())).sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR")); desenhar();
  }, e => { console.warn(e); lst.innerHTML = ""; lst.append(el("div", "empty", e.code === "permission-denied" ? "Cole as regras novas do Firebase para usar a lista de formandos." : "Não foi possível carregar.")); });

  function desenhar(){
    const ativos = lista.filter(f => f.status !== "desistiu");
    const vendido = ativos.reduce((a, f) => a + n0(f.valor), 0), recebido = ativos.reduce((a, f) => a + parcela(f) * Math.min(n0(f.pagas), n0(f.parcelas) || 1), 0);
    const atr = ativos.filter(atrasado);
    resumo.innerHTML = "";
    [["Formandos", String(ativos.length)], ["Vendido", C.money(Math.round(vendido))], ["Recebido", C.money(Math.round(recebido))], ["Em aberto", C.money(Math.round(vendido - recebido))], ["Atrasados", String(atr.length)]]
      .forEach(([t, v], i) => { const c = el("div", "kpi" + (i === 4 && atr.length ? " late" : "")); c.append(el("small", null, t), el("b", null, v)); resumo.append(c); });
    chips.innerHTML = "";
    [["todos", "Todos", ativos.length], ["atrasados", "Atrasados", atr.length], ["aberto", "Em dia", ativos.filter(f => !quitado(f) && !atrasado(f)).length], ["quitados", "Quitados", ativos.filter(quitado).length], ["desistiu", "Desistiram", lista.length - ativos.length]]
      .forEach(([k, t, n]) => { const b = el("button", "chip", t); b.type = "button"; b.setAttribute("aria-pressed", String(filtro === k)); b.append(el("span", "n", String(n))); b.onclick = () => { filtro = k; desenhar(); }; chips.append(b); });
    let arr = lista.filter(f => filtro === "desistiu" ? f.status === "desistiu" : f.status !== "desistiu" && (filtro === "todos" || (filtro === "atrasados" && atrasado(f)) || (filtro === "quitados" && quitado(f)) || (filtro === "aberto" && !quitado(f) && !atrasado(f))));
    if (busca) arr = arr.filter(f => norm(f.nome + " " + f.tel + " " + f.serie).includes(busca) || C.digits(f.tel).includes(busca.replace(/\D/g, "") || "x"));
    lst.innerHTML = "";
    if (!lista.length) { const e = el("div", "empty"); e.append(el("strong", null, "Nenhum formando ainda"), el("span", null, "Toque em “+ Formando” ou importe a planilha da turma.")); lst.append(e); return; }
    if (!arr.length) { lst.append(el("div", "empty", "Ninguém nesse filtro.")); return; }
    arr.forEach(f => lst.append(card(f)));
  }

  function card(f){
    const at = atrasado(f), q0 = quitado(f);
    const e = el("article", "card " + (f.status === "desistiu" ? "" : at ? "late" : q0 ? "won" : ""));
    const top = el("div", "card-top"); top.append(el("h3", "name", title(f.nome)), el("span", "stage", f.status === "desistiu" ? "DESISTIU" : q0 ? "QUITADO" : at ? "ATRASADO" : "EM DIA")); e.append(top);
    const meta = el("div", "meta"); [f.serie, f.kit, f.valor ? C.money(f.valor) : "", f.formaPag, f.tel].filter(Boolean).forEach((t, i) => meta.append(el("span", "tag" + (i === 1 ? " svc" : ""), t))); e.append(meta);
    if (n0(f.parcelas)) {
      const prox = n0(f.pagas) + 1;
      e.append(el("div", "fu " + (at ? "late" : ""), q0 ? `${f.parcelas}/${f.parcelas} parcelas pagas ✓` : `${n0(f.pagas)}/${f.parcelas} pagas · ${C.money(Math.round(parcela(f)))} por parcela` + (f.primeiroVenc ? ` · ${at ? "venceu" : "vence"} ${C.fmtDate(vencDa(f, prox))}` : "")));
    }
    if (f.obs) e.append(el("p", "notes", f.obs));
    const act = el("div", "actions");
    if (f.status !== "desistiu" && !q0) act.append(C.mkBtn("✅ +1 parcela paga", "btn-ok", () => salvar(f, { pagas: n0(f.pagas) + 1, ultimoPag: C.todayStr() }, `Parcela ${n0(f.pagas) + 1} registrada`)));
    if (f.status !== "desistiu" && !q0 && f.tel) act.append(C.mkBtn("💬 Cobrar", at ? "btn-primary" : "", () => cobrar(f)));
    act.append(C.mkBtn("Editar", "", () => form(f)));
    e.append(act); return e;
  }
  function cobrar(f){
    const prox = n0(f.pagas) + 1, venc = f.primeiroVenc ? vencDa(f, prox) : "";
    const pix = C.P.pix ? `\nChave Pix: ${C.P.pix}` : "";
    const msg = atrasado(f)
      ? `Oi, ${C.first(title(f.nome))}! Aqui é do Z7 Studio Fotográfico 📸 Passando para lembrar da parcela ${prox}/${f.parcelas} do kit de formatura (${f.kit || "kit"}), de ${C.money(Math.round(parcela(f)))}, que venceu ${venc ? "dia " + C.fmtDate(venc) : "este mês"}.${pix}\nPode me mandar o comprovante por aqui? Se já pagou, é só desconsiderar 😊`
      : `Oi, ${C.first(title(f.nome))}! Aqui é do Z7 Studio Fotográfico 📸 Só lembrando que a parcela ${prox}/${f.parcelas} do kit de formatura, de ${C.money(Math.round(parcela(f)))}, vence ${venc ? "dia " + C.fmtDate(venc) : "em breve"}.${pix}\nQualquer dúvida, estou por aqui 😊`;
    window.open(`https://wa.me/${C.digits(f.tel)}?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
  }
  async function salvar(f, patch, msg){ try { await FS.updateDoc(FS.doc(db, "formandos", f.id), Object.assign(patch, { atualizadoEm: new Date().toISOString() })); C.toast(msg); } catch (e) { C.handleErr(e); } }

  function form(f){
    const s2 = el("div", "sheet"); const fp = el("form", "panel"); fp.autocomplete = "off"; s2.append(fp);
    const fechar = () => s2.remove(); s2.addEventListener("click", ev => { if (ev.target === s2) fechar(); });
    fp.append(el("h2", null, f ? "Editar formando" : "Novo formando"));
    const nome = inp(f ? title(f.nome) : "", "nome do formando"); nome.required = true;
    const tel = inp(f ? f.tel : "", "WhatsApp do responsável", 30); tel.inputMode = "tel";
    const r1 = el("div", "row2"); r1.append(field("Nome", nome), field("WhatsApp", tel)); fp.append(r1);
    const serie = el("select"); ["", "Pré", "5º ano", "9º ano", "Ensino médio", "Outra"].forEach(t => { const o = el("option", null, t || "série"); o.value = t; serie.append(o); }); serie.value = f ? f.serie || "" : "";
    const kit = inp(f ? f.kit : "", "ex.: Kit Quadro + PR"); const dl = el("datalist"); dl.id = "tmKits" + (++fid); kit.setAttribute("list", dl.id);
    (kits || []).forEach(k => { const o = el("option"); o.value = k.nome; dl.append(o); });
    kit.addEventListener("change", () => { const k = (kits || []).find(x => x.nome === kit.value); if (k && k.preco && !valor.value) valor.value = k.preco; });
    const r2 = el("div", "row2"); r2.append(field("Série", serie), field("Kit", kit)); fp.append(r2, dl);
    const valor = inp(f ? f.valor || "" : "", "R$", 10); valor.inputMode = "decimal";
    const parc = inp(f ? f.parcelas || "" : "1", "1", 3); parc.inputMode = "numeric";
    const pagas = inp(f ? f.pagas || 0 : "0", "0", 3); pagas.inputMode = "numeric";
    const r3 = el("div", "row3"); r3.append(field("Valor total", valor), field("Parcelas", parc), field("Já pagas", pagas)); fp.append(r3);
    const venc = el("input"); venc.type = "date"; venc.value = f ? f.primeiroVenc || "" : C.todayStr();
    const fpg = el("select"); [["", "forma de pagamento"], ...["Pix", "Cartão", "Link", "Recorrente", "Dinheiro", "Boleto"].map(x => [x, x])].forEach(([v, t]) => { const o = el("option", null, t); o.value = v; fpg.append(o); }); fpg.value = f ? f.formaPag || "" : "";
    const st = el("select"); [["ativo", "Comprou"], ["desistiu", "Desistiu"]].forEach(([v, t]) => { const o = el("option", null, t); o.value = v; st.append(o); }); st.value = f ? f.status || "ativo" : "ativo";
    const r4 = el("div", "row3"); r4.append(field("1º vencimento", venc), field("Pagamento", fpg), field("Situação", st)); fp.append(r4);
    const obs = el("textarea"); obs.rows = 2; obs.maxLength = 500; obs.value = f ? f.obs || "" : ""; fp.append(field("Observação", obs));
    const err = el("p", "err"); err.hidden = true; fp.append(err);
    const a = el("div", "panel-actions");
    if (f && C.isAdmin) { const del = el("button", "btn btn-danger", "Excluir"); del.type = "button"; del.onclick = async () => { if (!fp._del) { fp._del = true; del.textContent = "Toque de novo"; return; } try { await FS.deleteDoc(FS.doc(db, "formandos", f.id)); fechar(); C.toast("Excluído"); } catch (e) { C.handleErr(e); } }; a.append(del); }
    const sp = el("span"); sp.style.flex = "1"; const c = el("button", "btn", "Cancelar"); c.type = "button"; c.onclick = fechar; const ok = el("button", "btn btn-primary", "Salvar"); ok.type = "submit"; a.append(sp, c, ok); fp.append(a);
    document.body.append(s2); setTimeout(() => nome.focus(), 30);
    fp.addEventListener("submit", async ev => {
      ev.preventDefault();
      const P = n0(parc.value) || 1, pg = n0(pagas.value);
      if (pg > P) { err.textContent = "Já pagas não pode ser maior que o número de parcelas."; err.hidden = false; return; }
      const body = { nome: nome.value.trim(), tel: tel.value.trim(), serie: serie.value, kit: kit.value.trim(), valor: C.num(valor.value), parcelas: P, pagas: pg, primeiroVenc: venc.value, formaPag: fpg.value, status: st.value, obs: obs.value.trim(), atualizadoEm: new Date().toISOString() };
      try {
        if (f) await FS.updateDoc(FS.doc(db, "formandos", f.id), body);
        else await FS.addDoc(col, Object.assign(body, { instId: inst.id, instNome: inst.nome, instTipo: inst.tipo || "", ano: Number(C.todayStr().slice(0, 4)), resp: inst.resp || C.me || "", vendidoEm: C.todayStr(), criadoEm: new Date().toISOString(), por: C.me || "" }));
        fechar(); C.toast(f ? "Salvo" : "Formando incluído");
      } catch (e) { C.handleErr(e); }
    });
  }

  function importar(){
    const s2 = el("div", "sheet"); const fp = el("form", "panel"); s2.append(fp);
    const fechar = () => s2.remove(); s2.addEventListener("click", ev => { if (ev.target === s2) fechar(); });
    fp.append(el("h2", null, "Importar formandos"), el("p", "hint", "Planilha do Excel com as colunas (os nomes podem variar): NOME, TELEFONE, SÉRIE, KIT, VALOR, PARCELAS, PAGAS, VENCIMENTO, PAGAMENTO. Só o nome é obrigatório."));
    const file = el("input"); file.type = "file"; file.accept = ".xlsx,.xls,.csv"; fp.append(file);
    const prev = el("div", "imp"); fp.append(prev);
    const a = el("div", "panel-actions"); const sp = el("span"); sp.style.flex = "1"; const c = el("button", "btn", "Cancelar"); c.type = "button"; c.onclick = fechar; const ok = el("button", "btn btn-primary", "Importar"); ok.type = "submit"; ok.disabled = true; a.append(sp, c, ok); fp.append(a);
    document.body.append(s2);
    let linhas = [];
    file.onchange = async () => {
      prev.textContent = "Lendo…";
      try {
        const XLSX = await loadXLSX(); const wb = XLSX.read(await file.files[0].arrayBuffer(), { cellDates: true });
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
        const pega = (r, ...ks) => { const e = Object.entries(r).find(([k]) => ks.some(x => norm(k).includes(x))); return e ? e[1] : ""; };
        const iso = v => v instanceof Date ? `${v.getFullYear()}-${C.pad(v.getMonth() + 1)}-${C.pad(v.getDate())}` : /^(\d{2})\/(\d{2})\/(\d{4})$/.test(String(v).trim()) ? String(v).trim().replace(/^(\d{2})\/(\d{2})\/(\d{4})$/, "$3-$2-$1") : "";
        const ja = new Set(lista.map(f => norm(f.nome)));
        linhas = rows.map(r => ({ nome: String(pega(r, "nome", "formando", "aluno")).trim(), tel: String(pega(r, "telefone", "celular", "whats", "tel")).trim(), serie: String(pega(r, "serie", "turma", "ano")).trim(),
          kit: String(pega(r, "kit", "produto", "pacote")).trim(), valor: C.num(String(pega(r, "valor", "preco", "total"))), parcelas: n0(pega(r, "parcela")) || 1, pagas: n0(pega(r, "paga")), primeiroVenc: iso(pega(r, "venc")), formaPag: String(pega(r, "pagamento", "forma")).trim() }))
          .filter(x => x.nome && !ja.has(norm(x.nome)));
        prev.textContent = linhas.length ? `${linhas.length} formando${linhas.length > 1 ? "s" : ""} novo${linhas.length > 1 ? "s" : ""}: ${linhas.slice(0, 5).map(x => title(x.nome)).join(", ")}${linhas.length > 5 ? "…" : ""}` : "Nenhum formando novo na planilha.";
        ok.disabled = !linhas.length;
      } catch (e) { console.warn(e); prev.textContent = "Não consegui ler a planilha."; }
    };
    fp.addEventListener("submit", async ev => {
      ev.preventDefault(); ok.disabled = true; let n = 0;
      try {
        for (const x of linhas) {
          await FS.addDoc(col, Object.assign(x, { pagas: Math.min(x.pagas, x.parcelas), status: "ativo", instId: inst.id, instNome: inst.nome, instTipo: inst.tipo || "", ano: Number(C.todayStr().slice(0, 4)), resp: inst.resp || C.me || "", vendidoEm: C.todayStr(), criadoEm: new Date().toISOString(), por: C.me || "" }));
          n++;
        }
        fechar(); C.toast(`${n} formando${n > 1 ? "s" : ""} importado${n > 1 ? "s" : ""}`);
      } catch (e) { C.handleErr(e); prev.textContent = `Importados ${n}. Erro no restante.`; }
    });
  }
}
function loadXLSX(){
  if (window.XLSX) return Promise.resolve(window.XLSX);
  return new Promise((res, rej) => { const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"; s.onload = () => res(window.XLSX); s.onerror = rej; document.head.append(s); });
}
