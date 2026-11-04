import { test } from "node:test";
import assert from "node:assert/strict";
import { nomeDentroDaFoto } from "../js/foto-nome.js";
import { nomeSobrenome } from "../js/previas-lote.js";

const bytes = s => new TextEncoder().encode(s);
const junta = (...ps) => {
  const n = ps.reduce((t, p) => t + p.length, 0),
    u = new Uint8Array(n);
  let o = 0;
  ps.forEach(p => (u.set(p, o), (o += p.length)));
  return u;
};

test("nome dentro da foto: Título do Windows (EXIF XPTitle)", () => {
  const nome = "BERNARDO GOMES\0";
  const d = new Uint8Array(nome.length * 2);
  [...nome].forEach((c, i) => (d[i * 2] = c.charCodeAt(0)));
  const tiff = new Uint8Array(26 + d.length);
  const dv = new DataView(tiff.buffer);
  tiff.set([0x49, 0x49, 0x2a, 0x00]);
  dv.setUint32(4, 8, true);
  dv.setUint16(8, 1, true);
  dv.setUint16(10, 0x9c9b, true);
  dv.setUint16(12, 1, true);
  dv.setUint32(14, d.length, true);
  dv.setUint32(18, 26, true);
  dv.setUint32(22, 0, true);
  tiff.set(d, 26);
  const jpg = junta(new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0, 0]), bytes("Exif\0\0"), tiff);
  assert.equal(nomeDentroDaFoto(jpg), "BERNARDO GOMES");
});

test("nome dentro da foto: título do Lightroom (XMP dc:title) e IPTC", () => {
  const xmp = bytes(
    '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF><rdf:Description><dc:title><rdf:Alt><rdf:li xml:lang="x-default">Ana Clara Souza</rdf:li></rdf:Alt></dc:title></rdf:Description></rdf:RDF></x:xmpmeta>'
  );
  assert.equal(nomeDentroDaFoto(junta(new Uint8Array([0xff, 0xd8]), xmp)), "Ana Clara Souza");
  const iptc = junta(new Uint8Array([0x1c, 0x02, 0x05, 0x00, 9]), bytes("JOAO LIMA"));
  assert.equal(nomeDentroDaFoto(junta(new Uint8Array([0xff, 0xd8, 0, 0]), iptc)), "JOAO LIMA");
});

test("nome dentro da foto: sem nome (ou só a marca da câmera) devolve vazio", () => {
  assert.equal(nomeDentroDaFoto(bytes("nada aqui")), "");
  const iptc = junta(new Uint8Array([0x1c, 0x02, 0x05, 0x00, 23]), bytes("OLYMPUS DIGITAL CAMERA "));
  assert.equal(nomeDentroDaFoto(iptc), "");
  assert.equal(nomeSobrenome("BERNARDO GOMES"), "BERNARDO GOMES");
});
