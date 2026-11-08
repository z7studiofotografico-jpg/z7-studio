// Endereço da venda: o CEP preenche rua, bairro e cidade (ViaCEP, gratuito); o endereço completo é obrigatório
// em toda venda (CEP, rua, número, bairro e cidade). Complemento e referência são opcionais.

// "26.540-000", "26540000" → "26540000"; outro → ""
export const lerCep = s => {
  const d = String(s || "").replace(/\D/g, "");
  return d.length === 8 ? d : "";
};
export const mostrarCep = s => {
  const d = lerCep(s);
  return d ? d.slice(0, 5) + "-" + d.slice(5) : String(s || "");
};

// { rua, bairro, cidade, uf } ou null (CEP que não existe); erro de internet: lança
export async function buscarCep(cep, buscar = (u, o) => fetch(u, o)) {
  const d = lerCep(cep);
  if (!d) return null;
  const r = await buscar(`https://viacep.com.br/ws/${d}/json/`);
  if (!r.ok) throw new Error("CEP " + r.status);
  const j = await r.json();
  if (!j || j.erro) return null;
  return { rua: j.logradouro || "", bairro: j.bairro || "", cidade: j.localidade || "", uf: j.uf || "" };
}

// o que falta no endereço (nomes dos campos, na ordem do formulário)
export function faltaEndereco(e) {
  const a = e || {};
  const falta = [];
  if (!lerCep(a.cep)) falta.push("CEP");
  if (!String(a.rua || "").trim()) falta.push("Rua");
  if (!String(a.numero || "").trim()) falta.push("Número");
  if (!String(a.bairro || "").trim()) falta.push("Bairro");
  if (!String(a.cidade || "").trim()) falta.push("Cidade");
  return falta;
}
