// API da Cora (Integração Direta, 25/11/2026): mTLS (certificado + chave privada) + token client_credentials.
// Os segredos ficam só no GitHub (Settings → Secrets): CORA_CLIENT_ID, CORA_CERT (certificate.pem), CORA_KEY
// (private-key.key). CORA_AMBIENTE (variável): "stage" (teste, padrão) ou "prod" (boletos de verdade).
import https from "node:https";
import crypto from "node:crypto";

const AMB = (process.env.CORA_AMBIENTE || "stage").trim() === "prod" ? "prod" : "stage";
const HOST = AMB === "prod" ? "matls-clients.api.cora.com.br" : "matls-clients.api.stage.cora.com.br";
export const ambiente = AMB;

function faltando() {
  return ["CORA_CLIENT_ID", "CORA_CERT", "CORA_KEY"].filter(k => !String(process.env[k] || "").trim());
}
const agente = () =>
  new https.Agent({ cert: process.env.CORA_CERT.replace(/\\n/g, "\n"), key: process.env.CORA_KEY.replace(/\\n/g, "\n"), keepAlive: true });

function pedir(ag, metodo, caminho, { corpo, headers = {}, form } = {}) {
  return new Promise((ok, erro) => {
    const dados = form ? new URLSearchParams(form).toString() : corpo ? JSON.stringify(corpo) : "";
    const req = https.request(
      {
        host: HOST,
        path: caminho,
        method: metodo,
        agent: ag,
        headers: Object.assign(
          { accept: "application/json" },
          dados
            ? {
                "Content-Type": form ? "application/x-www-form-urlencoded" : "application/json",
                "Content-Length": Buffer.byteLength(dados)
              }
            : {},
          headers
        )
      },
      res => {
        let t = "";
        res.on("data", c => (t += c));
        res.on("end", () => {
          let j = null;
          try {
            j = t ? JSON.parse(t) : null;
          } catch (e) {
            j = { texto: t };
          }
          if (res.statusCode >= 400)
            return erro(
              Object.assign(new Error(`Cora ${metodo} ${caminho}: HTTP ${res.statusCode} ${t.slice(0, 300)}`), { status: res.statusCode })
            );
          ok(j);
        });
      }
    );
    req.on("error", erro);
    req.setTimeout(30000, () => req.destroy(new Error("Cora: tempo esgotado")));
    if (dados) req.write(dados);
    req.end();
  });
}

// cliente da API: token na primeira chamada (vale ~24h; o robô roda e termina)
export async function conectar() {
  const f = faltando();
  if (f.length) throw new Error("Faltam os segredos da Cora no GitHub: " + f.join(", "));
  const ag = agente();
  // o Client-id às vezes vem colado com texto em volta ("Client-id: int-… Copiar"): fica só o int-…
  const id = (process.env.CORA_CLIENT_ID.match(/int-[A-Za-z0-9]+/) || [process.env.CORA_CLIENT_ID.trim()])[0];
  // diagnóstico sem expor segredo: o certificado (parte pública) diz para qual Client-id e ambiente ele foi feito
  try {
    const c = new crypto.X509Certificate(process.env.CORA_CERT.replace(/\\n/g, "\n"));
    console.log(`Certificado: ${c.subject.replace(/\n/g, " · ")} · válido até ${c.validTo}`);
  } catch (e) {
    console.log("Certificado: não consegui ler (confira se colou o certificate.pem inteiro, com as linhas BEGIN e END)");
  }
  console.log(`Client-id: ${id.slice(0, 6)}… (${id.length} letras) · ambiente ${AMB}`);
  const t = await pedir(ag, "POST", "/token", { form: { grant_type: "client_credentials", client_id: id } });
  const auth = { Authorization: "Bearer " + t.access_token };
  return {
    emitir: (corpo, chave) => pedir(ag, "POST", "/v2/invoices/", { corpo, headers: Object.assign({ "Idempotency-Key": chave }, auth) }),
    detalhes: id => pedir(ag, "GET", "/v2/invoices/" + encodeURIComponent(id), { headers: auth }),
    cancelar: id => pedir(ag, "DELETE", "/v2/invoices/" + encodeURIComponent(id), { headers: auth })
  };
}

// a mesma parcela sempre com a mesma chave: se o robô cair no meio, a Cora devolve o boleto já emitido (não duplica)
export function chaveDe(texto) {
  const h = crypto
    .createHash("sha256")
    .update("z7-cora:" + texto)
    .digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
