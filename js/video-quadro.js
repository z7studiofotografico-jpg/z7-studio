// Vídeo do Kit Quadro + porta-retratos (11/11/2026), no mesmo jeito do vídeo do Paspatur: parte da prévia pronta
// (o que está no canvas) e faz um passeio de câmera: chega perto do quadro, abre a cena, passa pelos
// porta-retratos e termina na prévia inteira. ~9 s, 1080 x 1350, com a marca d'água da prévia.
import { tipoVideo } from "./mockup-paspatur.js";
export { tipoVideo };

export const DURACAO = 9;
const W = 1080,
  H = 1350;
// [tempo, zoom, centro x, centro y] — entre um e outro, suave
const CENAS = [
  [0, 1.7, 350, 470],
  [1.2, 1.7, 350, 470],
  [4.2, 1.0, W / 2, H / 2],
  [5.4, 1.0, W / 2, H / 2],
  [6.6, 1.6, 790, 1070],
  [7.6, 1.6, 790, 1070],
  [8.6, 1.0, W / 2, H / 2],
  [DURACAO, 1.0, W / 2, H / 2]
];
const suave = x => x * x * (3 - 2 * x);
export function cameraEm(t) {
  const i = Math.max(0, CENAS.findIndex(c => c[0] > t) - 1);
  const a = CENAS[i],
    b = CENAS[Math.min(i + 1, CENAS.length - 1)];
  const k = b[0] > a[0] ? suave(Math.min(1, Math.max(0, (t - a[0]) / (b[0] - a[0])))) : 1;
  return [a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k, a[3] + (b[3] - a[3]) * k];
}
function quadro(ctx, base, t) {
  const [z, cx, cy] = cameraEm(t);
  // não deixa a câmera mostrar fora da imagem
  const x = Math.min(Math.max(cx, W / (2 * z)), W - W / (2 * z)),
    y = Math.min(Math.max(cy, H / (2 * z)), H - H / (2 * z));
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#202225";
  ctx.fillRect(0, 0, W, H);
  ctx.setTransform(z, 0, 0, z, W / 2 - x * z, H / 2 - y * z);
  ctx.globalAlpha = Math.min(1, t / 0.6); // entra aos poucos
  ctx.drawImage(base, 0, 0, W, H);
  ctx.globalAlpha = 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
function copia(cv) {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  c.getContext("2d").drawImage(cv, 0, 0, W, H);
  return c;
}
// toca no canvas da janela (o canvas já tem a prévia desenhada); devolve uma função para parar
export async function tocar(cv, _st, aoAcabar) {
  const base = copia(cv);
  const ctx = cv.getContext("2d");
  const t0 = performance.now();
  let parar = false;
  const passo = agora => {
    if (parar) return;
    const t = (agora - t0) / 1000;
    quadro(ctx, base, Math.min(t, DURACAO));
    if (t < DURACAO) requestAnimationFrame(passo);
    else if (aoAcabar) aoAcabar();
  };
  requestAnimationFrame(passo);
  return () => (parar = true);
}
// grava o vídeo (MP4 quando dá; senão WebM). Devolve { blob, tipo } ou null.
export async function gravarVideo(cv, st) {
  const tipo = tipoVideo();
  if (!tipo || !cv.captureStream) return null;
  const rec = new MediaRecorder(cv.captureStream(30), { mimeType: tipo, videoBitsPerSecond: 4_000_000 });
  const partes = [];
  rec.ondataavailable = e => e.data && e.data.size && partes.push(e.data);
  const fim = new Promise(res => (rec.onstop = res));
  rec.start(250);
  await new Promise(res => tocar(cv, st, res));
  await new Promise(r => setTimeout(r, 300));
  rec.stop();
  await fim;
  return { blob: new Blob(partes, { type: tipo.split(";")[0] }), tipo: tipo.split(";")[0] };
}
