import test from "node:test";
import assert from "node:assert/strict";
import { linkDoApp, conviteEmail } from "../scripts/convite.mjs";

const fb = "https://z7-funil-e-repasse.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=AbC-123_x&apiKey=k&lang=en";

test("convite leva para o app, com o código do Firebase", () => {
  assert.equal(linkDoApp(fb), "https://app.z7studio.com.br/?mode=resetPassword&oobCode=AbC-123_x");
});
test("e-mail em português, com assunto e primeiro nome", () => {
  const c = conviteEmail("Roberto Silva", fb);
  assert.equal(c.subject, "Crie sua senha do app Z7 Studio");
  assert.match(c.text, /^Olá, Roberto!/);
  assert.match(c.html, /app\.z7studio\.com\.br\/\?mode=resetPassword&oobCode=AbC-123_x/);
  assert.doesNotMatch(c.text + c.html, /firebaseapp/);
});
test("link sem código dá erro", () => {
  assert.throws(() => linkDoApp("https://exemplo.com/"));
});
