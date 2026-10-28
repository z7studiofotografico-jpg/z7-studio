// Endereço oficial do app: https://app.z7studio.com.br
// Quem abrir pelo endereço antigo (github.io) vai sozinho para o novo, na mesma tela. Inclusive o celular que
// guardou uma página antiga: ela sempre carrega o ui.js e o app.js da internet, e os dois importam este arquivo.
// (No Node, scripts e testes, não há "location": não faz nada.)
export const ENDERECO = "https://app.z7studio.com.br/";
if (typeof location !== "undefined" && /\.github\.io$/i.test(location.hostname)) location.replace(ENDERECO + location.hash);
