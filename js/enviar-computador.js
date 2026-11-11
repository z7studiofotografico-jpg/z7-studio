// Enviar a prévia pelo computador (10/11/2026): no Windows, o "compartilhar" do navegador abre a janela do sistema
// (Vincular ao Celular, Galaxy…), que falha ou manda para o celular em vez do WhatsApp. No computador o app não usa
// essa janela: copia a imagem e abre a conversa no WhatsApp Web (Ctrl+V cola a imagem).
export const noComputador = () => {
  try {
    return !matchMedia("(pointer: coarse)").matches;
  } catch (_) {
    return false;
  }
};
// copia a imagem para colar com Ctrl+V (a área de transferência só aceita PNG); true se deu certo
export async function copiarImagem(blob) {
  try {
    if (!navigator.clipboard || typeof ClipboardItem === "undefined") return false;
    let png = blob;
    if (blob.type !== "image/png") {
      const bmp = await createImageBitmap(blob);
      const c = document.createElement("canvas");
      c.width = bmp.width;
      c.height = bmp.height;
      c.getContext("2d").drawImage(bmp, 0, 0);
      png = await new Promise(r => c.toBlob(r, "image/png"));
    }
    await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
    return true;
  } catch (e) {
    console.warn("[Z7] copiar imagem", e);
    return false;
  }
}
// abre a conversa no WhatsApp Web (sempre na mesma aba "z7whatsapp", sem abrir uma nova a cada envio)
export function abrirWhatsAppWeb(tel, texto) {
  const d = String(tel || "").replace(/\D/g, "");
  const n = d && d.length <= 11 ? "55" + d : d;
  const url = n
    ? `https://web.whatsapp.com/send?phone=${n}${texto ? "&text=" + encodeURIComponent(texto) : ""}`
    : "https://web.whatsapp.com/";
  window.open(url, "z7whatsapp");
}
