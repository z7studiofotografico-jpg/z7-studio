// Enviar a prévia pelo computador (10/11/2026): no Windows, o "compartilhar" do navegador abre a janela do sistema
// (Vincular ao Celular, Galaxy…), que falha ou manda para o celular em vez do WhatsApp. No computador o app não usa
// essa janela: copia a imagem (Ctrl+V na conversa do WhatsApp Web) e baixa o arquivo também.
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
export const msgComputador = copiou =>
  (copiou ? "Imagem copiada e baixada. No WhatsApp Web, abra a conversa e aperte Ctrl+V." : "Imagem baixada.") +
  (copiou ? "" : " No WhatsApp Web, clique no clipe 📎 e escolha a imagem (ou arraste o arquivo para a conversa).");
