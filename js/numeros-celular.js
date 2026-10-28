// Qual app de WhatsApp cada número usa NESTE celular (WhatsApp normal ou WhatsApp Business).
// No mesmo celular, dois números só funcionam um em cada app. Marcando aqui uma vez, o app abre sozinho
// o WhatsApp certo do número em uso (o do seletor 📱 da tela): assim ninguém manda pelo número errado.
// Funciona no Android. No iPhone não dá para escolher o app pelo link: o app só lembra qual número usar.
// A marcação fica só neste aparelho (cada celular tem os seus apps).
import { el } from "./ui.js";
import * as U from "./util.js";
import { FRENTES, fmtTel, opcoesWhats } from "./numeros.js";
import { whatsAtivo } from "./numeros-tela.js";

export const APPS = {
  whatsapp: { nome: "WhatsApp", pacote: "com.whatsapp" },
  business: { nome: "WhatsApp Business", pacote: "com.whatsapp.w4b" }
};
const chave = (C, n) => `z7app:${C.email}:${n}`;
export function appDoNumero(C, n) {
  try {
    const v = localStorage.getItem(chave(C, n)) || "";
    return APPS[v] ? v : "";
  } catch (_) {
    return "";
  }
}
function guardarApp(C, n, v) {
  try {
    if (v) localStorage.setItem(chave(C, n), v);
    else localStorage.removeItem(chave(C, n));
  } catch (_) {}
}
export const ehAndroid = () => /Android/i.test(navigator.userAgent || "");

// Link wa.me → link que abre direto o app escolhido (Android). Sem o app instalado, cai no wa.me normal.
export function linkNoApp(href, app) {
  const m = /^https:\/\/wa\.me\/(\d*)\/?(?:\?(.*))?$/.exec(String(href || ""));
  if (!m || !APPS[app]) return "";
  const q = new URLSearchParams(m[2] || "");
  // espaço vira %20 (com "+" o WhatsApp mostraria o sinal no texto)
  const p = [m[1] ? "phone=" + m[1] : "", q.has("text") ? "text=" + encodeURIComponent(q.get("text")) : ""].filter(Boolean).join("&");
  return (
    `intent://send/?${p}#Intent;scheme=whatsapp;package=${APPS[app].pacote};` + `S.browser_fallback_url=${encodeURIComponent(href)};end`
  );
}

// Todos os números que esta pessoa pode usar (em qualquer tela)
const todosNumeros = C => [...new Set(Object.keys(FRENTES).flatMap(f => opcoesWhats(C, f)))];

// Ajustes: "Neste celular" (para todos, admin e equipe)
export function secaoNesteCelular(C, box) {
  box.innerHTML = "";
  const nums = todosNumeros(C);
  box.hidden = !nums.length;
  if (!nums.length) return;
  box.append(el("h3", null, "📱 Neste celular"));
  box.append(
    el(
      "p",
      "hint",
      ehAndroid()
        ? "Diga em qual app cada número está neste celular. Assim, ao tocar em “Abrir no WhatsApp”, o app abre direto o WhatsApp do número em uso (nunca o errado)."
        : /iPhone|iPad|iPod/i.test(navigator.userAgent || "")
          ? "No iPhone o app não consegue escolher entre WhatsApp e WhatsApp Business: antes de enviar, confira o número no topo da conversa. Marque mesmo assim para lembrar qual app usar."
          : "Neste computador o link abre o WhatsApp Web ou o app do computador, com o número que estiver conectado nele: confira antes de enviar. A escolha automática do app funciona no celular Android."
    )
  );
  nums.forEach(n => {
    const s = el("select");
    s.setAttribute("aria-label", "App do WhatsApp " + fmtTel(n));
    [["", "não está neste celular / não sei"], ...Object.entries(APPS).map(([k, a]) => [k, a.nome])].forEach(([v, t]) => {
      const o = el("option", null, t);
      o.value = v;
      s.append(o);
    });
    s.value = appDoNumero(C, n);
    s.onchange = () => {
      // o mesmo app não pode ter dois números neste celular
      if (s.value)
        nums.forEach(o => {
          if (o !== n && appDoNumero(C, o) === s.value) guardarApp(C, o, "");
        });
      guardarApp(C, n, s.value);
      secaoNesteCelular(C, box);
      U.toast(s.value ? `${fmtTel(n)} abre no ${APPS[s.value].nome}` : "Ok, sem app marcado para " + fmtTel(n));
    };
    const r = el("div", "field");
    r.append(el("label", null, fmtTel(n)), s);
    box.append(r);
  });
}

// A frente da tela aberta (o seletor 📱 visível diz qual é)
function frenteDaTela() {
  const s = [...document.querySelectorAll("[data-frente]")].find(x => x.offsetParent !== null);
  return s ? s.dataset.frente : "";
}
// Toque em qualquer "Abrir no WhatsApp": abre no app do número em uso (Android) ou lembra qual número usar
export function ligarWhatsCerto(C) {
  document.addEventListener(
    "click",
    e => {
      const a = e.target.closest && e.target.closest('a[href^="https://wa.me/"]');
      if (!a || e.defaultPrevented) return;
      const frente = frenteDaTela();
      if (!frente) return;
      const n = whatsAtivo(C, frente);
      if (!n) return;
      const app = appDoNumero(C, n);
      if (app && ehAndroid()) {
        const url = linkNoApp(a.href, app);
        if (!url) return;
        e.preventDefault();
        U.toast(`Abrindo no ${APPS[app].nome} · ${fmtTel(n)}`);
        (window.__abrirLink || (u => (location.href = u)))(url); // (__abrirLink: só nos testes)
        return;
      }
      if (opcoesWhats(C, frente).length > 1) U.toast(`Confira: mande pelo WhatsApp ${fmtTel(n)}`);
    },
    true
  );
}
