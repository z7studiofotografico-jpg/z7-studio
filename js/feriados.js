// Feriados em que o estúdio não trabalha: nacionais, Carnaval e os do estado do RJ.
// Para um feriado da cidade ou um recesso, marque um compromisso "dia inteiro" na agenda.
const FIXOS = {
  "01-01": "Confraternização Universal", "04-21": "Tiradentes", "04-23": "São Jorge (RJ)", "05-01": "Dia do Trabalho",
  "09-07": "Independência do Brasil", "10-12": "Nossa Senhora Aparecida", "11-02": "Finados", "11-15": "Proclamação da República",
  "11-20": "Consciência Negra", "12-25": "Natal"
};
const cache = {};
function pascoa(y){ // algoritmo de Meeus/Jones/Butcher
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, mes - 1, dia);
}
const p2 = n => String(n).padStart(2, "0");
const iso = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
export function feriadosDoAno(y){
  if (cache[y]) return cache[y];
  const r = {}; Object.entries(FIXOS).forEach(([md, n]) => { r[`${y}-${md}`] = n; });
  const P = pascoa(y); const mais = (n) => { const d = new Date(P); d.setDate(d.getDate() + n); return iso(d); };
  r[mais(-48)] = "Carnaval"; r[mais(-47)] = "Carnaval"; r[mais(-2)] = "Sexta-feira Santa"; r[mais(60)] = "Corpus Christi";
  return (cache[y] = r);
}
// Nome do feriado no dia (AAAA-MM-DD), ou "" se não for feriado
export function feriado(data){ if (!data) return ""; return feriadosDoAno(Number(data.slice(0, 4)))[data] || ""; }
// Feriados entre duas datas, em ordem
export function feriadosEntre(de, ate){
  const out = []; for (let y = Number(de.slice(0, 4)); y <= Number(ate.slice(0, 4)); y++) Object.entries(feriadosDoAno(y)).forEach(([d, n]) => { if (d >= de && d <= ate) out.push({ data: d, nome: n }); });
  return out.sort((a, b) => a.data.localeCompare(b.data));
}
