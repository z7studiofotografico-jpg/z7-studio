// Service worker do Z7 Studio: deixa o app abrir rápido (e sem internet) e recebe as notificações.
// Os arquivos do app são sempre buscados de novo na internet (sem cache do navegador), então
// uma atualização publicada aparece na próxima abertura, sem precisar trocar versão aqui
// (com sinal fraco, em até 2,5 s usa a cópia guardada e atualiza para a próxima vez).
// A lista abaixo só garante que o app abra sem internet; um teste confere que nenhum arquivo ficou de fora.
const CACHE = "z7-app";
const CDN = "z7-cdn-v1";
const SHELL = [
  "./",
  "./index.html",
  "./config.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  "./js/ui.js",
  "./js/instituicao-cadastro.js",
  "./js/pendencias-equipe.js",
  "./js/criar-senha.js",
  "./js/escolas-pr.js",
  "./js/passar-pr.js",
  "./js/regras.js",
  "./js/calc.js",
  "./js/feriados.js",
  "./js/repasse.js",
  "./js/mockup.js",
  "./js/instituicoes.js",
  "./js/agenda.js",
  "./js/vendas.js",
  "./js/util.js",
  "./js/precos.js",
  "./js/turma-ajustes.js",
  "./js/repasse-dados.js",
  "./js/repasse-import.js",
  "./js/instituicoes-import.js",
  "./js/agenda-tempo.js",
  "./js/agenda-form.js",
  "./js/pedidos.js",
  "./js/app.js",
  "./js/endereco.js",
  "./js/erros.js",
  "./js/fontes-resumo.js",
  "./js/relatorio.js",
  "./js/aluno-id.js",
  "./js/ensaio-id.js",
  "./js/vendas-anos.js",
  "./js/retorno.js",
  "./js/historico-dados.js",
  "./js/vendas-historico.js",
  "./js/numeros-celular.js",
  "./js/repasse-estado.js",
  "./js/repasse-mensagens.js",
  "./js/repasse-cartao.js",
  "./js/repasse-janelas.js",
  "./js/repasse-form.js",
  "./js/repasse-lote.js",
  "./js/vercomo.js",
  "./js/notificacoes.js",
  "./js/ajustes.js",
  "./js/inicio.js",
  "./js/turma-formando.js",
  "./js/instituicoes-dados.js",
  "./js/instituicoes-estado.js",
  "./js/instituicoes-form.js",
  "./js/instituicoes-agendar.js",
  "./js/agenda-estado.js",
  "./js/agenda-entregas.js",
  "./js/agenda-colegios.js",
  "./js/agenda-ensaios.js",
  "./js/agenda-relatorio.js",
  "./js/numeros.js",
  "./js/numeros-tela.js",
  "./js/turma.js",
  "./js/formaturas.js",
  "./js/becas.js",
  "./js/funil.js",
  "./js/equipe.js",
  "./js/mensagens.js",
  "./js/eventos.js",
  "./js/migracao.js",
  "./js/contrato.js",
  "./js/previa.js",
  "./css/app.css"
];

importScripts("./config.js");
importScripts(
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js"
);

self.addEventListener("install", e => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== CDN).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Bibliotecas de fora (Firebase, gráficos, planilha): têm a versão no endereço, então podem ficar guardadas.
const ehCDN = u => /^(www\.gstatic\.com|cdn\.jsdelivr\.net|unpkg\.com)$/.test(u.hostname);
// Arquivos do próprio app: busca na internet primeiro (sem cache do navegador).
// Sinal fraco: se a internet não responder em 2,5 s, usa a cópia guardada (a resposta da internet, quando
// chegar, atualiza a cópia para a próxima vez). Só guarda resposta boa: um erro do servidor não apaga a cópia.
// Arquivo que não existe nem na cópia: página → abre o app (index.html); código → erro de rede (nunca HTML no lugar de JS).
const ESPERA_MS = 2500;
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (ehCDN(url)) {
    e.respondWith(
      caches.open(CDN).then(c =>
        c.match(e.request).then(
          r =>
            r ||
            fetch(e.request).then(res => {
              if (res.ok) c.put(e.request, res.clone());
              return res;
            })
        )
      )
    );
    return;
  }
  if (url.origin !== self.location.origin) return;
  const pagina = e.request.mode === "navigate";
  e.respondWith(
    (async () => {
      const guardado = await caches.match(e.request, { ignoreSearch: pagina });
      const daRede = fetch(e.request, { cache: "no-cache" }).then(res => {
        if (res.ok) {
          const copia = res.clone();
          e.waitUntil(caches.open(CACHE).then(c => c.put(e.request, copia)));
        }
        return res;
      });
      const semNada = () => (pagina ? caches.match("./index.html") : Response.error());
      if (!guardado) return daRede.catch(semNada);
      let espera;
      const tempo = new Promise(r => (espera = setTimeout(() => r(guardado), ESPERA_MS)));
      const rede = daRede.then(
        // erro do servidor: fica com a cópia boa; endereço que mudou (redirecionamento): segue para o novo
        res => (res.ok || res.type === "opaqueredirect" ? res : guardado),
        () => guardado
      );
      const res = await Promise.race([rede, tempo]);
      clearTimeout(espera);
      return res;
    })()
  );
});

// Notificações (Firebase Cloud Messaging). A notificação é mostrada automaticamente;
// ao tocar nela, o app abre.
const cfg = self.Z7_CONFIG && self.Z7_CONFIG.firebase;
if (cfg && cfg.apiKey) {
  firebase.initializeApp(cfg);
  firebase.messaging();
}

self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if ("focus" in c) return c.focus();
      }
      return self.clients.openWindow("./");
    })
  );
});
