// Lê o config.js do app (donos e aprovadores) para os scripts não repetirem os e-mails.
import fs from "node:fs";
import vm from "node:vm";
const ctx = { self: {} };
vm.runInNewContext(fs.readFileSync(new URL("../config.js", import.meta.url), "utf8"), ctx);
export const CFG = ctx.self.Z7_CONFIG;
export const DONOS = (CFG.donos || []).map(d => d.email.toLowerCase());
export const APROVADORES = (CFG.aprovadores || []).map(e => e.toLowerCase());
