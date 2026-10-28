// Instituições: importar a planilha de colégios (só admin). Quem já existe é atualizado, sem duplicar.
import { el, field, sheet, botoes as actions, carregarLib, parseTel } from "./ui.js";
import * as U from "./util.js";
let FS, db;
const norm = U.chave,
  slug = U.slug,
  loadXLSX = () => carregarLib("xlsx");
export const MAPA = {
  PRE: "pre",
  PREESCOLA: "pre",
  INSTITUICAO: "nome",
  ESCOLA: "nome",
  COLEGIO: "nome",
  INFANTIL: "infantil",
  FUNDAMENTALI: "fund1",
  "5ANO": "ano5",
  FUNDAMENTALII: "fund2",
  "9ANO": "ano9",
  ENSINOMEDIO: "medio",
  TELEFONE1: "t1",
  TELEFONE2: "t2",
  TELEFONE3: "t3",
  EMAIL: "email",
  ENDERECO: "rua",
  N: "numero",
  NO: "numero",
  NUMERO: "numero",
  BAIRRO: "bairro",
  CIDADE: "cidade",
  DATADAVISITA: "dataVisita",
  STATUS: "status",
  MEDIADEALUNOS: "media",
  RESPONSAVEL: "responsavel",
  TEMFOTOSDEFORMATURA: "temFotos",
  DATADAFOTO: "dataFoto",
  OBSERVACAO: "obs",
  OBSERVACOES: "obs",
  OBS: "obs"
};
export const hkey = h =>
  String(h || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/^(\d)O?ANO$/, "$1ANO");
export function dataISO(v, X) {
  if (!v) return "";
  if (v instanceof Date && !isNaN(v)) return U.ds(v);
  if (typeof v === "number") {
    const p0 = X.SSF.parse_date_code(v);
    return p0 ? `${p0.y}-${U.pad(p0.m)}-${U.pad(p0.d)}` : "";
  }
  const m = String(v).match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) return `${m[3].length === 2 ? "20" + m[3] : m[3]}-${U.pad(m[2])}-${U.pad(m[1])}`;
  return "";
}

// tipos = tipos do cartão (ex.: ["particular"] ou ["faculdade", "profissionalizante"]), nomeTipo = nome do cartão,
// items = instituições já carregadas desse cartão
const NOMES = {
  particular: "Colégio particular",
  publico: "Colégio público",
  faculdade: "Faculdade",
  profissionalizante: "Curso profissionalizante"
};
export function openImport(ctx, tipos, nomeTipo, items) {
  FS = ctx.FS;
  db = ctx.db;
  tipos = [].concat(tipos);
  let tipo = tipos[0];
  sheet("Importar planilha · " + nomeTipo, (p, close) => {
    // cartão com dois tipos: escolhe qual é a planilha
    if (tipos.length > 1) {
      const s = el("select");
      tipos.forEach(t => {
        const o = el("option", null, NOMES[t] || t);
        o.value = t;
        s.append(o);
      });
      s.onchange = () => (tipo = s.value);
      p.append(field("A planilha é de", s));
    }
    p.append(
      el(
        "p",
        "hint",
        "Escolha o Excel (.xlsx). Todas as linhas da aba escolhida entram como “" +
          nomeTipo +
          "”. Quem já existe é atualizado, sem duplicar."
      )
    );
    const f = el("input");
    f.type = "file";
    f.accept = ".xlsx,.xls,.csv";
    p.append(field("Arquivo", f));
    const aba = el("select");
    aba.hidden = true;
    const fAba = field("Aba da planilha", aba);
    fAba.hidden = true;
    p.append(fAba);
    const out = el("div", "imp");
    p.append(out);
    const acts = actions(close, "Importar");
    const ok = acts.querySelector("button[type=submit]");
    ok.disabled = true;
    p.append(acts);
    let wb = null,
      X = null,
      rows = [];
    const ler = () => {
      out.innerHTML = "";
      rows = [];
      ok.disabled = true;
      const m = X.utils.sheet_to_json(wb.Sheets[aba.value], { header: 1, defval: "", raw: true });
      const hi = m.findIndex(r => r.some(c => ["INSTITUICAO", "ESCOLA", "COLEGIO"].includes(hkey(c))));
      if (hi < 0) {
        out.append(el("p", "err", "Não achei a coluna INSTITUIÇÃO nessa aba."));
        return;
      }
      const cols = m[hi].map(h => MAPA[hkey(h)] || null);
      for (const r of m.slice(hi + 1)) {
        const o = {};
        cols.forEach((k, i) => {
          if (k && (o[k] == null || o[k] === "")) o[k] = r[i];
        });
        if (!String(o.nome || "").trim()) continue;
        rows.push(o);
      }
      const visitados = rows.filter(r => dataISO(r.dataVisita, X) || String(r.obs || "").trim()).length;
      out.append(el("p", null, `${rows.length} instituições encontradas (${visitados} já visitadas ou com observação).`));
      const st = {};
      rows.forEach(r => {
        const k = String(r.status || "(vazio)").trim() || "(vazio)";
        st[k] = (st[k] || 0) + 1;
      });
      out.append(
        el(
          "p",
          "hint",
          "STATUS na planilha: " +
            Object.entries(st)
              .map(([k, n]) => `${k} (${n})`)
              .join(" · ")
        )
      );
      ok.disabled = !rows.length;
    };
    f.onchange = async () => {
      out.innerHTML = "";
      const file = f.files[0];
      if (!file) return;
      try {
        X = await loadXLSX();
        wb = X.read(await file.arrayBuffer(), { type: "array", cellDates: true, codepage: 65001 });
        aba.innerHTML = "";
        wb.SheetNames.forEach(n => {
          const o = el("option", null, n);
          o.value = n;
          aba.append(o);
        });
        aba.hidden = false;
        fAba.hidden = wb.SheetNames.length < 2;
        aba.onchange = ler;
        ler();
      } catch (e) {
        out.append(el("p", "err", "Não consegui ler o arquivo."));
      }
    };
    p.addEventListener("submit", async ev => {
      ev.preventDefault();
      if (!rows.length) return;
      ok.disabled = true;
      const prog = el("p", "hint", "Importando…");
      out.append(prog);
      try {
        const exist = new Map(items.map(i => [i.id, i]));
        const agora = new Date().toISOString();
        let novos = 0,
          atual = 0;
        const ids = new Set();
        const ops = rows.map((r, i) => {
          const s = v => (v == null ? "" : String(v).trim());
          const sim = v => /^(X|SIM|S|OK|1|TEM)$/i.test(s(v)) || Number(s(v)) > 0;
          const contatos = [];
          [r.t1, r.t2, r.t3].forEach((t, k) => {
            const tel = parseTel(t);
            if (tel || s(t)) contatos.push({ nome: k === 0 ? s(r.responsavel) : "", cargo: "", tel: tel || s(t) });
          });
          if (!contatos.length && s(r.responsavel)) contatos.push({ nome: s(r.responsavel), cargo: "", tel: "" });
          const dv = dataISO(r.dataVisita, X),
            st = norm(r.status);
          const etapa = /FECH/.test(st)
            ? "FECHADO"
            : /NAO|PERD|SEM INTERESSE/.test(st)
              ? "NÃO FECHOU"
              : dv || s(r.obs)
                ? "VISITADO"
                : "A VISITAR";
          const base = {
            nome: s(r.nome),
            nomeBusca: norm(r.nome),
            tipo,
            segmentos: { pre: sim(r.infantil) || sim(r.pre), ano5: sim(r.ano5), ano9: sim(r.ano9), medio: sim(r.medio) },
            alunosPorSerie: {
              pre: Number(s(r.infantil) || s(r.pre)) || 0,
              ano5: Number(s(r.ano5)) || 0,
              ano9: Number(s(r.ano9)) || 0,
              medio: Number(s(r.medio)) || 0
            },
            segmentosOrig: {
              infantil: s(r.infantil),
              fund1: s(r.fund1),
              ano5: s(r.ano5),
              fund2: s(r.fund2),
              ano9: s(r.ano9),
              medio: s(r.medio)
            },
            contatos,
            email: s(r.email).toLowerCase(),
            endereco: { rua: s(r.rua), numero: s(r.numero), bairro: s(r.bairro), cidade: s(r.cidade) },
            statusOrig: s(r.status),
            mediaAlunos: Number(String(r.media).replace(/\D/g, "")) || null,
            temFotosOrig: s(r.temFotos),
            dataFoto: dataISO(r.dataFoto, X),
            atualizadoEm: agora
          };
          let id = [tipo, slug(r.nome).slice(0, 60) || "inst", slug(r.bairro).slice(0, 24)].filter(Boolean).join("_");
          while (ids.has(id)) id += "-" + i;
          ids.add(id);
          if (exist.has(id)) {
            atual++;
            return [id, base, true];
          }
          novos++;
          const visitas = dv || s(r.obs) ? [{ data: dv, por: "", resultado: s(r.status), obs: s(r.obs), origem: "planilha" }] : [];
          return [
            id,
            Object.assign(base, {
              etapa,
              followup: null,
              visitas,
              tentativas: (s(r.obs).match(/TENTEI LIGAR/gi) || []).length,
              resp: "",
              importadoEm: agora
            }),
            false
          ];
        });
        for (let i = 0; i < ops.length; i += 400) {
          const b = FS.writeBatch(db);
          ops
            .slice(i, i + 400)
            .forEach(([id, data, merge]) =>
              merge ? b.set(FS.doc(db, "instituicoes", id), data, { merge: true }) : b.set(FS.doc(db, "instituicoes", id), data)
            );
          await b.commit();
          prog.textContent = `Importando… ${Math.min(i + 400, ops.length)} de ${ops.length}`;
        }
        prog.textContent = `Pronto! ${novos} novas${atual ? ` e ${atual} atualizadas` : ""}.`;
        U.toast("Planilha importada ✅");
        const fc = el("button", "btn btn-primary", "Fechar");
        fc.type = "button";
        fc.onclick = close;
        out.append(fc);
      } catch (e) {
        console.warn(e);
        prog.textContent = "";
        out.append(
          el(
            "p",
            "err",
            e.code === "permission-denied"
              ? "Só administradores podem importar."
              : "A importação parou. Pode importar de novo: ninguém é duplicado."
          )
        );
        ok.disabled = false;
      }
    });
  });
}
