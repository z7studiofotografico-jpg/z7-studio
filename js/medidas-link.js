// (24/11/2026) Botão "📏 Link das medidas" do aluguel avulso: manda ao cliente a página aberta medidas.html
import { title, wa as abrirWa } from "./ui.js";
import { ESTUDIO } from "./mensagens.js";
import * as U from "./util.js";

// (24/11/2026) a página aberta de medidas: o cliente mede, vê o tamanho ideal e manda pelo WhatsApp do estúdio
export function linkMedidas(x) {
  const inf = Object.keys(x.becasQtd || {}).some(k => /^inf/.test(k) && Number(x.becasQtd[k]));
  const url = `${location.origin}/medidas.html${inf ? "?tipo=infantil" : ""}`;
  const msg = `Oi, ${U.first(title(x.cliente || ""))}! Aqui é do ${ESTUDIO.nome} 📸 Para acertar o tamanho da beca, tire as medidas por este link (mostra como medir e já calcula o tamanho ideal): ${url}`;
  if (x.tel) return abrirWa(x.tel, msg, U.toast);
  navigator.clipboard.writeText(url).then(
    () => U.toast("Sem telefone no aluguel: o link das medidas foi copiado."),
    () => U.toast(url)
  );
}
