// Endereço oficial do app: https://app.z7studio.com.br
// Quem abrir pelo endereço antigo (github.io), inclusive pelo app instalado com a cópia guardada no celular,
// vai sozinho para o novo, na mesma tela. (Importado primeiro no app.js, antes de tudo.)
export const ENDERECO = "https://app.z7studio.com.br/";
if (/\.github\.io$/i.test(location.hostname)) location.replace(ENDERECO + location.hash);
