import { test } from "node:test";
import assert from "node:assert/strict";
const { jaExistem } = await import("../js/repasse-import.js");

const fsFake = resp => ({
  query: (c, w) => w,
  where: (_, __, g) => g,
  documentId: () => "id",
  getDocs: g => resp(g)
});

test("jaExistem mostra o andamento e acha os ids", async () => {
  const ids = Array.from({ length: 200 }, (_, i) => "a" + i);
  const passos = [];
  const FS = fsFake(async g => ({ docs: g.filter(x => x === "a5").map(id => ({ id, data: () => ({ etapa: "NOVO" }) })) }));
  const m = await jaExistem(FS, null, ids, (f, t) => passos.push([f, t]));
  assert.equal(m.get("a5"), "NOVO");
  assert.deepEqual(passos.at(-1), [200, 200]);
});

test("jaExistem para com aviso claro quando o Firebase não responde", async () => {
  const FS = fsFake(() => new Promise(() => {}));
  await assert.rejects(jaExistem(FS, null, ["a"], undefined, 30), e => e.code === "sem-resposta" && /4h/.test(e.message));
});
