// O nome do aluno guardado DENTRO da foto (propriedades do arquivo: Título, Assunto, Descrição — EXIF, IPTC ou XMP),
// para quando o nome do arquivo é um código (ex.: "26-(E.PART)LEGACY (2).jpg" com o título "BERNARDO GOMES").
// Lê só o começo do arquivo (onde ficam essas informações). Sem nome dentro da foto, devolve "".
const GENERICO = /^(olympus|sony|nikon|canon|fujifilm|samsung|digital camera|default|untitled|sem t[ií]tulo|image|imagem|foto)\b/i;
const limpar = t =>
  String(t || "")
    .replace(/\0+/g, "")
    .replace(/\s+/g, " ")
    .trim();
const ok = t => {
  const s = limpar(t);
  return s && !GENERICO.test(s) && /[a-zà-ú]/i.test(s) ? s : "";
};
const utf8 = b => new TextDecoder("utf-8").decode(b);
const utf16 = b => new TextDecoder("utf-16le").decode(b);

// EXIF (APP1 "Exif"): ImageDescription (0x010E) e os campos do Windows XPTitle/XPSubject/XPComment (UTF-16)
function lerExif(u8) {
  const out = {};
  for (let i = 2; i < Math.min(u8.length - 10, 65536); i++) {
    if (u8[i] !== 0x45 || u8[i + 1] !== 0x78 || u8[i + 2] !== 0x69 || u8[i + 3] !== 0x66 || u8[i + 4] !== 0 || u8[i + 5] !== 0) continue;
    const t = i + 6;
    const le = u8[t] === 0x49;
    const dv = new DataView(u8.buffer, u8.byteOffset);
    const r16 = o => dv.getUint16(t + o, le),
      r32 = o => dv.getUint32(t + o, le);
    try {
      const ifd = r32(4),
        n = r16(ifd);
      for (let k = 0; k < n; k++) {
        const e = ifd + 2 + k * 12,
          tag = r16(e),
          type = r16(e + 2),
          cnt = r32(e + 4);
        const tam = cnt * (type === 3 ? 2 : type === 4 ? 4 : 1);
        const pos = tam > 4 ? t + r32(e + 8) : t + e + 8;
        const b = u8.subarray(pos, pos + tam);
        if (tag === 0x010e) out.descricao = utf8(b);
        if (tag === 0x9c9b) out.xpTitulo = utf16(b);
        if (tag === 0x9c9f) out.xpAssunto = utf16(b);
        if (tag === 0x9c9c) out.xpComentario = utf16(b);
      }
    } catch (_) {}
    break;
  }
  return out;
}
// IPTC (Photoshop): 2:05 Nome do objeto (título) e 2:120 Legenda
function lerIptc(u8) {
  const out = {};
  for (let i = 0; i < u8.length - 5; i++) {
    if (u8[i] !== 0x1c || u8[i + 1] !== 0x02) continue;
    const ds = u8[i + 2],
      len = (u8[i + 3] << 8) | u8[i + 4];
    if (len > 0 && len < 2000 && (ds === 5 || ds === 120)) {
      const v = utf8(u8.subarray(i + 5, i + 5 + len));
      if (ds === 5 && !out.titulo) out.titulo = v;
      if (ds === 120 && !out.legenda) out.legenda = v;
    }
  }
  return out;
}
// XMP (Lightroom, Bridge, Windows): dc:title, photoshop:Headline, dc:description
function lerXmp(u8) {
  const s = utf8(u8);
  const ini = s.indexOf("<x:xmpmeta");
  if (ini < 0) return {};
  const fim = s.indexOf("</x:xmpmeta>", ini);
  const x = s.slice(ini, fim < 0 ? undefined : fim + 12);
  const alt = tag => {
    const m = x.match(new RegExp(`<${tag}[^>]*>[\\s\\S]*?<rdf:li[^>]*>([\\s\\S]*?)</rdf:li>`));
    return m ? m[1] : "";
  };
  const attr = tag => {
    const m = x.match(new RegExp(`${tag}="([^"]*)"`)) || x.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
    return m ? m[1] : "";
  };
  const des = t =>
    t
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  return { titulo: des(alt("dc:title")), manchete: des(attr("photoshop:Headline")), descricao: des(alt("dc:description")) };
}

// bytes do começo do arquivo → o nome guardado na foto ("" se não houver)
export function nomeDentroDaFoto(buf) {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const e = lerExif(u8),
    i = lerIptc(u8),
    x = lerXmp(u8);
  return (
    [e.xpTitulo, x.titulo, i.titulo, x.manchete, e.descricao, e.xpAssunto, i.legenda, x.descricao, e.xpComentario].map(ok).find(Boolean) ||
    ""
  );
}
export async function nomeDaFoto(file) {
  try {
    return nomeDentroDaFoto(await file.slice(0, 512 * 1024).arrayBuffer());
  } catch (_) {
    return "";
  }
}
