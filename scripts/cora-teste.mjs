// 🧪 Teste da API da Cora (25/11/2026): confere o certificado e a chave, emite 1 boleto de teste (R$ 10,00, para a
// "conta secundária" de teste da Cora), lê os detalhes e cancela. Não mexe em nada do app (Firestore).
// Só roda no ambiente de teste (stage).
import { conectar, chaveDe, ambiente } from "./cora-api.mjs";

if (ambiente !== "stage") {
  console.error("O teste só roda no ambiente de teste da Cora (CORA_AMBIENTE=stage).");
  process.exit(1);
}
const api = await conectar();
console.log("✓ Certificado e chave aceitos: token da Cora recebido (ambiente de teste).");
const venc = new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10);
const b = await api.emitir(
  {
    code: "z7-teste-" + Date.now(),
    customer: { name: "Cliente Teste Z7", document: { identity: "03639026438", type: "CPF" } },
    services: [{ name: "Teste Z7 Studio", description: "Boleto de teste da integração", amount: 1000 }],
    payment_terms: { due_date: venc, fine: { rate: 2 }, interest: { rate: 1 } },
    payment_forms: ["BANK_SLIP", "PIX"]
  },
  chaveDe("teste-" + Date.now())
);
const bs = (b.payment_options || {}).bank_slip || {};
console.log(`✓ Boleto de teste emitido: ${b.id} · ${b.status} · R$ ${(b.total_amount / 100).toFixed(2)} · vence ${venc}`);
console.log(
  `  linha digitável: ${bs.digitable ? "ok" : "—"} · PDF: ${bs.url ? "ok" : "—"} · Pix: ${b.pix && b.pix.emv ? "ok" : "sem chave Pix na conta de teste"}`
);
const d = await api.detalhes(b.id);
console.log(`✓ Consulta do boleto: ${d.status}`);
await api.cancelar(b.id).then(
  () => console.log("✓ Boleto de teste cancelado."),
  e => console.log("(não cancelou: " + e.message + ")")
);
console.log("Tudo certo com a API da Cora ✅");
