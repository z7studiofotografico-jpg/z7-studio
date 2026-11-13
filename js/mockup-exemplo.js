// Foto de exemplo desenhada para a prévia sem foto (separada de mockup.js pelo limite de linhas)
// Sem foto ainda: uma foto de exemplo desenhada (formando de beca e capelo num fundo de estúdio), em vez do quadro branco
export function exemplo(ctx, x, y, w, h) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const bg = ctx.createRadialGradient(x + w / 2, y + h * 0.35, 10, x + w / 2, y + h * 0.45, Math.max(w, h));
  bg.addColorStop(0, "#d8c7b2");
  bg.addColorStop(0.55, "#9c8670");
  bg.addColorStop(1, "#4b3d31");
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  const cx = x + w / 2,
    u = Math.min(w, h * 0.75);
  // beca (ombros e corpo)
  const beca = ctx.createLinearGradient(cx - u * 0.5, 0, cx + u * 0.5, 0);
  beca.addColorStop(0, "#14182b");
  beca.addColorStop(0.5, "#252b47");
  beca.addColorStop(1, "#14182b");
  ctx.fillStyle = beca;
  ctx.beginPath();
  ctx.moveTo(cx - u * 0.46, y + h);
  ctx.quadraticCurveTo(cx - u * 0.44, y + h * 0.66, cx - u * 0.12, y + h * 0.6);
  ctx.lineTo(cx + u * 0.12, y + h * 0.6);
  ctx.quadraticCurveTo(cx + u * 0.44, y + h * 0.66, cx + u * 0.46, y + h);
  ctx.closePath();
  ctx.fill();
  // faixa
  ctx.fillStyle = "#b3202a";
  ctx.beginPath();
  ctx.moveTo(cx - u * 0.12, y + h * 0.6);
  ctx.lineTo(cx - u * 0.04, y + h);
  ctx.lineTo(cx - u * 0.12, y + h);
  ctx.lineTo(cx - u * 0.2, y + h * 0.63);
  ctx.closePath();
  ctx.fill();
  // pescoço e rosto
  ctx.fillStyle = "#c69c7d";
  ctx.fillRect(cx - u * 0.06, y + h * 0.5, u * 0.12, h * 0.11);
  ctx.beginPath();
  ctx.ellipse(cx, y + h * 0.43, u * 0.13, u * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
  // capelo
  ctx.fillStyle = "#111";
  ctx.beginPath();
  ctx.moveTo(cx, y + h * 0.27);
  ctx.lineTo(cx + u * 0.26, y + h * 0.31);
  ctx.lineTo(cx, y + h * 0.35);
  ctx.lineTo(cx - u * 0.26, y + h * 0.31);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(cx - u * 0.13, y + h * 0.32, u * 0.26, h * 0.05);
  ctx.strokeStyle = "#d4a017";
  ctx.lineWidth = Math.max(2, u * 0.012);
  ctx.beginPath();
  ctx.moveTo(cx, y + h * 0.31);
  ctx.lineTo(cx + u * 0.2, y + h * 0.33);
  ctx.lineTo(cx + u * 0.2, y + h * 0.42);
  ctx.stroke();
  // aviso discreto
  ctx.fillStyle = "rgba(255,255,255,.85)";
  ctx.font = `600 ${Math.max(14, Math.round(u * 0.07))}px 'Source Sans 3', sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("foto de exemplo", cx, y + h * 0.12);
  ctx.restore();
}
