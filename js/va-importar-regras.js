// Venda Antecipada · importar a planilha do colégio (18/11/2026), sem tela (testado em tests/va-importar.test.mjs).
// A planilha que o estúdio já usa: uma linha por aluno, com os dados do contrato (responsável, CPF, endereço),
// a beca, os itens (QUADRO A3, PR 10X15, ALBUM, FOTOS, CANUDO), a OBS e uma coluna por mês ("PG. 05 JUNHO",
// "PG JULHO"…) com o valor da parcela daquele mês.
// - O kit sai do total das parcelas (65 = Kit 01; 9× 41 = Kit 02…; perto do total de um kit = aquele kit), e,
//   se não bater, das colunas de itens (álbum 170g = Kit 04, álbum = Kit 05, quadro/PR = Kit 03, fotos = Kit 02).
// - O que foi pago sai da OBS: "Quitou" = tudo; "pagou" = em dia até o mês atual; "atrasado" = falta só a deste mês;
//   "boleto enviado"/"confirmou boleto"/vazio = nada pago ainda (fica para conferir).
// - Quem não tem kit de fotos (só o Kit 01, ou nada) vai também para a Linha de Frente (venda depois das fotos).
import { centavos, reais, somar } from "./regras.js";
import { chave } from "./util.js";
import { comAno } from "./aluno-id.js";

const MESES = ["JANEIRO", "FEVEREIRO", "MARCO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
const p2 = n => String(n).padStart(2, "0");
const txt = v => (v == null ? "" : String(v).trim());
const vazio = v => !txt(v) || /^-+$/.test(txt(v));
// telefone que o Excel virou número (21982032346.0) → só os dígitos
export const fone = v => (vazio(v) ? "" : txt(v).replace(/\.0+$/, "").replace(/\D/g, ""));
const num = v => (typeof v === "number" ? v : vazio(v) ? 0 : reais(centavos(v)));
const marcado = v => !vazio(v) && !/^(0|NAO|N)$/.test(chave(v));

// coluna do cabeçalho pelo começo do nome (sem acento, sem pontuação)
const limpa = h =>
  chave(h)
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
function coluna(cab, ...nomes) {
  const cs = cab.map(limpa);
  for (const n of nomes) {
    const i = cs.findIndex(c => c === n || c.startsWith(n + " ") || c === n.replace(/ /g, ""));
    if (i >= 0) return i;
  }
  return -1;
}
// as colunas de mês, em ordem: [{ i, mes (1-12), ano }] — os meses depois de dezembro são do ano seguinte
export function colunasDeMes(cab, ano) {
  const out = [];
  let a = Number(ano),
    ult = 0;
  cab.forEach((h, i) => {
    const c = limpa(h);
    if (!/^PG\b/.test(c)) return;
    const m = MESES.findIndex(n => c.includes(n));
    if (m < 0) return;
    if (ult && m + 1 < ult) a++;
    ult = m + 1;
    const dia = Number((c.match(/\b(\d{1,2})\b/) || [])[1]) || 5;
    out.push({ i, data: `${a}-${p2(m + 1)}-${p2(dia > 28 ? 5 : dia)}` });
  });
  // o dia do vencimento é o mesmo em todos os meses (o "05" do primeiro)
  const d0 = out.length ? out[0].data.slice(8) : "05";
  return out.map(x => ({ i: x.i, data: x.data.slice(0, 8) + d0 }));
}

// kit pelo total (até 6% de diferença: negociações e quem entrou depois) e, senão, pelos itens marcados
export function kitDoTotal(total, kits, itens = {}) {
  const t = centavos(total);
  if (!t) return null;
  const comPreco = kits.filter(k => centavos(k.ant && k.ant.valor) && k.id !== "k01s");
  const exato = comPreco.find(k => centavos(k.ant.valor) === t);
  if (exato) return exato;
  const perto = comPreco.map(k => ({ k, d: Math.abs(centavos(k.ant.valor) - t) / centavos(k.ant.valor) })).sort((a, b) => a.d - b.d)[0];
  if (perto && perto.d <= 0.06) return perto.k;
  const id = itens.album170 ? "k04" : itens.album ? "k05" : itens.quadro || itens.pr ? "k03" : itens.fotos ? "k02" : "";
  return kits.find(k => k.id === id) || null;
}

// "pagou" / "atrasado" / "quitou" / "conferir"
export function situacaoDaObs(obs) {
  const o = chave(obs);
  if (/QUIT/.test(o)) return "quitou";
  if (/ATRAS/.test(o)) return "atrasado";
  if (/^PAG|EM DIA|PAGO/.test(o)) return "pagou";
  return "conferir";
}

// Lê a planilha inteira: cab = 1ª linha (nomes das colunas), linhas = as outras (listas de células).
// Devolve { alunos: [...], ignorados: [...] }; cada aluno = { doc (formando da Venda Antecipada ou null),
// lf (true = também na Linha de Frente), avisos: [], resumo }.
export function lerPlanilhaVA(cab, linhas, { kits, ano, hoje }) {
  const c = {
    beca: coluna(cab, "BECA"),
    turma: coluna(cab, "TURMA"),
    curso: coluna(cab, "CURSO", "SERIE"),
    fotoEscola: coluna(cab, "FOTO ESCOLA"),
    status: coluna(cab, "STATUS"),
    vendedor: coluna(cab, "VENDEDOR"),
    id: coluna(cab, "ID", "CODIGO"),
    nome: coluna(cab, "FORMANDO", "ALUNO", "NOME"),
    cel: coluna(cab, "CELULAR 1", "CELULAR", "TELEFONE 1", "TELEFONE"),
    mae: coluna(cab, "CEL 2 MAE", "TEL MAE", "MAE"),
    pai: coluna(cab, "CEL 3 PAI", "TEL PAI", "PAI"),
    resp: coluna(cab, "REPONSAVEL", "RESPONSAVEL"),
    cpf: coluna(cab, "CPF"),
    email: coluna(cab, "E MAIL", "EMAIL"),
    rua: coluna(cab, "ENDERECO"),
    numero: coluna(cab, "N", "NUMERO"),
    compl: coluna(cab, "COMPLEMENTO"),
    bairro: coluna(cab, "BAIRRO"),
    cidade: coluna(cab, "CIDADE"),
    quadro: coluna(cab, "QUADRO A3", "QUADRO"),
    pr: coluna(cab, "PR 10X15", "PR"),
    album: coluna(cab, "ALBUM"),
    fotos: coluna(cab, "FOTOS"),
    obs: coluna(cab, "OBS"),
    canudo: coluna(cab, "CANUDO"),
    escola: coluna(cab, "ESCOLA", "COLEGIO", "INSTITUICAO")
  };
  const meses = colunasDeMes(cab, ano);
  const corte = hoje.slice(0, 8) + (meses[0] ? meses[0].data.slice(8) : "05"); // o vencimento deste mês
  const v = (r, k) => (c[k] >= 0 ? r[c[k]] : "");
  const alunos = [],
    ignorados = [];
  linhas.forEach((r, ix) => {
    const nome = txt(v(r, "nome")).replace(/\s+/g, " ");
    // linha de recado (texto longo, "*INFORME:*…") não é aluno
    if (!nome || nome.length > 70 || /[*:]/.test(nome)) return;
    const linha = ix + 2;
    if (/SAIU|DESIST|TRANSFER/.test(chave(v(r, "status")))) return ignorados.push({ linha, nome, motivo: txt(v(r, "status")) });
    const avisos = [];
    const parcelas = [];
    meses.forEach(m => {
      const x = r[m.i];
      if (vazio(x)) return;
      const n = num(x);
      if (n > 0) parcelas.push({ data: m.data, valor: n });
      else avisos.push(`mês ${m.data.slice(5, 7)}/${m.data.slice(0, 4)}: “${txt(x)}”`);
    });
    const total = somar(parcelas.map(p => p.valor));
    const itens = {
      quadro: marcado(v(r, "quadro")),
      pr: marcado(v(r, "pr")),
      album: marcado(v(r, "album")),
      album170: /170/.test(txt(v(r, "album"))),
      fotos: marcado(v(r, "fotos")),
      canudo: marcado(v(r, "canudo"))
    };
    const kit = parcelas.length ? kitDoTotal(total, kits, itens) : null;
    if (parcelas.length && !kit) avisos.push(`não achei o kit pelo total (${total.toFixed(2).replace(".", ",")})`);
    const sit = situacaoDaObs(v(r, "obs"));
    const pagas =
      sit === "quitou"
        ? parcelas
        : sit === "pagou"
          ? parcelas.filter(p => p.data <= corte)
          : sit === "atrasado"
            ? parcelas.filter(p => p.data < corte)
            : [];
    if (parcelas.length && sit === "conferir") avisos.push(`OBS “${txt(v(r, "obs")) || "vazia"}”: entrou sem parcela paga, confira`);
    const beca = chave(v(r, "beca"));
    if (/FALT/.test(beca) || vazio(v(r, "beca"))) avisos.push("sem a medida da beca");
    const contatos = [
      ["Formando", nome, fone(v(r, "cel"))],
      ["Mãe", "", fone(v(r, "mae"))],
      ["Pai", "", fone(v(r, "pai"))]
    ]
      .filter(([, , t]) => t)
      .map(([tipo, n, tel]) => ({ tipo, nome: n, tel }));
    const resp = txt(v(r, "resp"));
    if (resp) {
      const m = contatos.find(x => x.tipo === "Mãe");
      if (m) m.nome = resp;
    }
    const tel = (contatos.find(x => x.tipo === "Formando") || contatos[0] || {}).tel || "";
    if (!tel) avisos.push("sem telefone");
    const idTxt = txt(v(r, "id"));
    const codigo = idTxt && /\d/.test(idTxt) ? comAno(idTxt.toUpperCase(), ano) : "";
    const turma = txt(v(r, "turma")).replace(/\.0+$/, "");
    const semFotos = !kit || kit.id === "k01" || kit.id === "k01s";
    const comum = {
      nome,
      codigo,
      tel,
      contatos,
      serie: txt(v(r, "curso")).replace(/°/g, "º"),
      sala: turma,
      responsavel: resp,
      cpf: fone(v(r, "cpf"))
        .padStart(11, "0")
        .replace(/^0{11}$/, ""),
      email: vazio(v(r, "email")) ? "" : txt(v(r, "email")).toLowerCase(),
      endereco: {
        rua: vazio(v(r, "rua")) ? "" : txt(v(r, "rua")),
        numero: vazio(v(r, "numero")) ? "" : txt(v(r, "numero")).replace(/\.0+$/, ""),
        complemento: vazio(v(r, "compl")) ? "" : txt(v(r, "compl")),
        bairro: vazio(v(r, "bairro")) ? "" : txt(v(r, "bairro")),
        cidade: vazio(v(r, "cidade")) ? "" : txt(v(r, "cidade"))
      },
      beca: /FALT/.test(beca) || vazio(v(r, "beca")) ? "" : beca,
      fotoEscola: /^SIM/.test(chave(v(r, "fotoEscola"))) ? "fez" : vazio(v(r, "fotoEscola")) ? "" : "faltou",
      vendedor: txt(v(r, "vendedor"))
    };
    // sem kit: entra como "ainda não comprou" (vai para a Linha de Frente quando mandar)
    const doc = !kit
      ? {
          ...comum,
          contrato: "album",
          kitId: "",
          kit: "",
          venda: "ant",
          status: "semkit",
          valor: 0,
          parcelas: 1,
          primeiroVenc: "",
          formaPag: "",
          pagamentos: [],
          pagas: 0,
          obs: txt(v(r, "obs"))
        }
      : {
          ...comum,
          contrato: kit.id === "k01" || kit.id === "k01s" ? "adesao" : "album",
          kitId: kit.id,
          kit: kit.nome,
          venda: "ant",
          status: "ativo",
          valor: total,
          parcelas: parcelas.length,
          primeiroVenc: parcelas[0].data,
          // os valores de cada mês, como na planilha (negociações com parcelas diferentes)
          valores: parcelas.map(p => p.valor),
          formaPag: "Boleto",
          pagamentos: pagas.map(p => ({ data: p.data, valor: p.valor, por: "planilha", forma: "Boleto" })),
          pagas: pagas.length,
          obs: txt(v(r, "obs"))
        };
    const quitado = !!kit && pagas.length >= parcelas.length;
    alunos.push({
      linha,
      doc,
      comum,
      lf: semFotos,
      avisos,
      resumo: {
        kit: kit ? kit.nome.split(" · ")[0] : "sem kit",
        parcelas: parcelas.length,
        pagas: pagas.length,
        total,
        situacao: !kit ? "sem kit" : quitado ? "quitado" : sit === "atrasado" ? "atrasado" : sit === "conferir" ? "conferir" : "em dia"
      }
    });
  });
  const escola = c.escola >= 0 ? linhas.map(r => txt(r[c.escola])).find(x => x && x.length > 3) || "" : "";
  return { alunos, ignorados, meses: meses.length, escola };
}
