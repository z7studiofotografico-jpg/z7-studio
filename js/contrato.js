// Regras do contrato de formatura (venda antecipada e venda depois das fotos), sem tela.
// Contrato: kits opcionais com parcelas no dia 05; entrega só com o contrato quitado, em até 120 dias úteis;
// desistência devolve 70% do valor pago; reprovação devolve o pago menos os serviços já feitos; mínimo de 30 formandos.
import { centavos, reais, somaMeses, somaDias, pagamentosDe, quitado } from "./regras.js";
import { feriado } from "./feriados.js";

// Tabela padrão (contrato de 27/04/2026). "pos" = preço para quem compra depois de ver as fotos; "rep" = preço do Repasse
// (turmas de anos anteriores). O Adriano e a Luciana definem em Kits e preços.
// O Kit 01 é a adesão (beca + canudo): entra na comissão da colação.
export const KITS_PADRAO = [
  { id: "k01", nome: "Kit 01 · Beca + canudo (adesão)", ant: { valor: 65, parcelas: 1 }, pos: { valor: 0, parcelas: 0 } },
  { id: "k01s", nome: "Kit 01 · Só beca, sem canudo (adesão)", ant: { valor: 0, parcelas: 1 }, pos: { valor: 0, parcelas: 0 } },
  { id: "k02", nome: "Kit 02 · Ensaio + fotos digitais + canudo", ant: { valor: 369, parcelas: 9 }, pos: { valor: 0, parcelas: 0 } },
  {
    id: "k03",
    nome: "Kit 03 · Quadro 30x40 + 2 porta-retratos + canudo",
    ant: { valor: 533, parcelas: 10 },
    pos: { valor: 0, parcelas: 0 }
  },
  { id: "k04", nome: "Kit 04 · Álbum revista 21x30 (170g) + canudo", ant: { valor: 850, parcelas: 10 }, pos: { valor: 0, parcelas: 0 } },
  { id: "k05", nome: "Kit 05 · Álbum Layflat 21x30 (500g) + canudo", ant: { valor: 1350, parcelas: 10 }, pos: { valor: 0, parcelas: 0 } }
];
export const DIA_VENC = 5;
export const MINIMO_FORMANDOS = 30;
export const DIAS_UTEIS_ENTREGA = 120;
export const DEVOLVE_DESISTENCIA = 70; // %

// Tabela em uso: a da turma (cada colégio pode ter valores e vezes próprios), senão a padrão de Kits e preços,
// senão a do contrato. Kits que faltam numa tabela antiga entram com os valores do contrato.
export function kitsPadrao(P) {
  const salvos = P && Array.isArray(P.kitsFormatura) ? P.kitsFormatura : [];
  return KITS_PADRAO.map(k => salvos.find(x => x.id === k.id) || k)
    .concat(salvos.filter(x => !KITS_PADRAO.some(k => k.id === x.id)))
    .map(x => ({ ...x, ant: { ...(x.ant || {}) }, pos: { ...(x.pos || {}) }, rep: { ...(x.rep || {}) } }));
}
export function kitsDe(P, inst) {
  const base = kitsPadrao(P);
  const daTurma = inst && Array.isArray(inst.kits) ? inst.kits : null;
  if (!daTurma) return base;
  return base.map(k => {
    const t = daTurma.find(x => x.id === k.id);
    return t ? { ...k, ant: { ...k.ant, ...(t.ant || {}) }, pos: { ...k.pos, ...(t.pos || {}) }, rep: { ...k.rep, ...(t.rep || {}) } } : k;
  });
}
// O que a turma tem diferente da tabela padrão (para o aviso na turma)
export function diferencasDaTurma(P, inst) {
  const base = kitsPadrao(P),
    t = kitsDe(P, inst),
    out = [];
  t.forEach(k => {
    const b = base.find(x => x.id === k.id) || k;
    ["ant", "pos", "rep"].forEach(q => {
      if (centavos(k[q].valor) !== centavos(b[q].valor) || (Number(k[q].parcelas) || 0) !== (Number(b[q].parcelas) || 0))
        out.push(k.id + "|" + q);
    });
  });
  return out;
}
// Kit 01 (com ou sem canudo) é a adesão: todo formando entra pelo menos com ele
export const ehAdesao = kitId => kitId === "k01" || kitId === "k01s";
// Ano da turma: o da formatura (ou o do fechamento). Turma de ano anterior = Repasse (vira sozinho em 1º de janeiro)
export const anoDaTurma = inst =>
  Number(String((inst && ((inst.formatura && inst.formatura.data) || inst.fechadoEm || inst.criadoEm)) || "").slice(0, 4)) || 0;
export const ehRepasse = (inst, hoje) => !!anoDaTurma(inst) && anoDaTurma(inst) < Number(String(hoje).slice(0, 4));
// Antecipado vale até o dia da formatura; depois dela, o preço é o de depois das fotos; turma de ano anterior, o de repasse
export const vendaSugerida = (inst, hoje) =>
  ehRepasse(inst, hoje) ? "rep" : inst && inst.formatura && inst.formatura.data && hoje > inst.formatura.data ? "pos" : "ant";

// Próximo dia 05 a partir de hoje (o de hoje vale se ainda não passou)
export function proximoVenc(hoje, dia = DIA_VENC) {
  const [y, m, d] = hoje.split("-").map(Number);
  const mes = d > dia ? m + 1 : m;
  const dt = new Date(y, mes - 1, dia);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}
const mesesEntre = (a, b) => (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7));

// Plano de pagamento de um kit.
// Antecipado: as parcelas da turma terminam todas no mesmo mês; quem entra depois paga em menos parcelas (mesmo total).
// Depois das fotos: preço e parcelas da tabela "pos", começando no próximo dia 05.
// inicioTurma = 1º vencimento da turma ("AAAA-MM-05"); devolve { valor, parcelas, primeiroVenc } ou null se o kit não tem preço.
export function plano(kit, venda, inicioTurma, hoje) {
  if (!kit) return null;
  const t = venda === "pos" ? kit.pos : venda === "rep" ? kit.rep : kit.ant;
  if (!t || !centavos(t.valor)) return null;
  const prox = proximoVenc(hoje);
  if (venda === "pos" || venda === "rep")
    return { valor: reais(centavos(t.valor)), parcelas: Math.max(1, Number(t.parcelas) || 1), primeiroVenc: prox };
  const inicio = inicioTurma && inicioTurma > prox ? inicioTurma : prox;
  const fim = somaMeses(inicioTurma || prox, Math.max(1, Number(t.parcelas) || 1) - 1);
  const n = Math.max(1, Math.min(Number(t.parcelas) || 1, mesesEntre(inicio, fim) + 1));
  return { valor: reais(centavos(t.valor)), parcelas: n, primeiroVenc: inicio };
}

// Data da quitação = data do último pagamento (se quitado)
export function quitadoEm(f) {
  if (!quitado(f)) return "";
  const ps = pagamentosDe(f)
    .map(p => p.data)
    .filter(Boolean)
    .sort();
  return ps[ps.length - 1] || "";
}
// Soma dias úteis (pula sábado, domingo e feriados)
export function somaDiasUteis(dataIso, n) {
  let d = dataIso,
    falta = n;
  while (falta > 0) {
    d = somaDias(d, 1);
    const [y, m, dd] = d.split("-").map(Number),
      sem = new Date(y, m - 1, dd).getDay();
    if (sem !== 0 && sem !== 6 && !feriado(d)) falta--;
  }
  return d;
}
// Previsão de entrega: até 120 dias úteis depois da quitação ("" se ainda não quitou)
export const previsaoEntrega = f => (quitadoEm(f) ? somaDiasUteis(quitadoEm(f), DIAS_UTEIS_ENTREGA) : "");

// Devolução (em reais): desistência = 70% do pago; reprovação = pago menos os serviços já feitos
export function devolucao(tipo, pagoReais, servicosReais) {
  const pago = centavos(pagoReais);
  if (tipo === "desistiu") return reais(Math.round((pago * DEVOLVE_DESISTENCIA) / 100));
  if (tipo === "reprovou") return reais(Math.max(0, pago - centavos(servicosReais)));
  return 0;
}

// Quem pode receber a oferta depois das fotos: alunos que têm só o Kit 01 (adesão) na turma,
// sem outra compra ativa. Registros antigos "semkit" (ainda não comprou) também entram.
export function candidatosPosFoto(listaDaTurma) {
  const chave = f =>
    String(f.nome || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim();
  const ativos = listaDaTurma.filter(f => !["desistiu", "reprovou"].includes(f.status));
  const comKit = new Set(
    ativos.filter(f => f.status !== "semkit" && !ehAdesao(f.kitId || (f.contrato === "colacao" ? "k01" : ""))).map(chave)
  );
  return ativos.filter(
    f => (f.status === "semkit" || ehAdesao(f.kitId || (f.contrato === "colacao" ? "k01" : ""))) && !comKit.has(chave(f))
  );
}
