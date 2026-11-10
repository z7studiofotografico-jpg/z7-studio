# Próximos passos (combinados em 07/11/2026)

Feito e no ar: formaturas no ano em que foram trabalhadas (sem repetidos), repetidos do PR 2024 apagados,
CIEP 135 em 2021, fotos achadas nas pastas por ano do Drive (nomes novos das prévias e nomes de colégio parecidos),
botão "Mudar ano" nas importações de Formatura/Paspatur, aba Vendidos (admin) e Minhas vendas (equipe).

## Fazer, nesta ordem

1. ~~Revisão de código~~ (07/11: regras do banco, textos na tela, datas e fuso conferidos; corrigido "A conferir"
   que escondia venda entregue). Falta revisar a fundo os importadores de planilha e as telas de Formaturas e Becas.
2. ~~Alunos sem foto~~ (07/11): "🔎 Conferir fotos" (admin) no PR, Paspatur e Formatura separa por colégio e ano em
   com foto · já comprou · sem telefone · falta gerar; quem falta tem "📤 Enviar foto" (também em "🖼️ Fotos do aluno"),
   que gera a prévia e grava na pasta do colégio no Drive com a conta Google do admin (precisa ser Editor da pasta).
3. **Telas novas do PR/Paspatur**. Já feitos (07-08/11): total do mês em Minhas vendas; prazo de entrega em cores;
   caído por preço (PR oferece o Paspatur; Formatura escolhe entre oferecer o PR ou as fotos digitais, em janela);
   endereço completo obrigatório com CEP. ("Quem paga" saiu do PR em 08/11: vai para o Contrato do colégio,
   em Aluguel de Becas → Alunos dos colégios.) Falta o resto abaixo (aprovadas pela Luciana):
   - lista única; filtro Todos / Só PR / Só Paspatur; filtro por pessoa da equipe com contagem;
   - no aluno, chave PR / Paspatur com confirmação ("Deseja vender como …?"); qualquer pessoa pode trocar; o valor troca junto;
   - abas na ordem: Caídos · Incompletos · Para hoje · Interessados · Buscar · Conferir pagamento | Vendido · Entregar · Entregue (+ Vendidos/Minhas vendas);
   - "Conferir pagamento": o representante confirma com foto do comprovante obrigatória; admins podem desfazer;
   - botão "Produção" antes de "+ Aluno": o que imprimir; a Luciana escolhe a entrega (ela, equipe ou correio);
     baixa: correio e "eu entrego" = Luciana; equipe = o responsável;
   - prazo: pagamento + 20 dias, em cores (verde / amarelo faltando 3 dias / vermelho); entrega própria marca dia e turno;
   - endereço completo obrigatório em toda venda (CEP preenche rua e bairro);
   - caído por "achou caro": oferecer Paspatur antes;
   - tabela de preços organizada na ⚙️ (só admin), por grupo; limites de desconto em R$ sem pedir, iguais para toda a
     equipe, cadastrados pelo admin na ⚙️ (valores fora deste arquivo); acima do limite, pedido de autorização;
   - total do mês (quantidade e valor) no topo de "Minhas vendas";
   - botão para apagar as fotos de quem já comprou ou de incompleto sem contato.
   **Feito em 08/11:** abas na ordem Caídos · Incompletos · Para hoje · Interessados · Buscar · A conferir (admin) |
   Entregar · Entregues (equipe: Minhas vendas). Confirmado pela Luciana: limite de desconto IGUAL para toda a equipe.
   **Feito em 08/11 (tarde): lista única.** Decisão da Luciana/Adriano: juntar. Os 181 alunos da coleção paspatur
   passaram para repasse com vendaComo "paspatur" (script do GitHub "Juntar Paspatur no PR"; cópia de segurança na
   coleção copiaPaspatur, que o app não lê). No PR: filtro Todos / Só PR / Só Paspatur com contagem; admin filtra
   por pessoa da equipe; selo 🎞️ Paspatur na linha; chave "Vender como" na janela do aluno com a pergunta
   "Deseja vender como …?" e o valor que muda (depois de pago só o admin troca); "+ Aluno" e "Importar planilha"
   escolhem PR ou Paspatur (planilha com PASPATUR no nome já vem marcada); caído por preço: "Vou oferecer agora"
   já pergunta se passa para Paspatur. Preço, mensagens, prévia e ajuda de vendas seguem o vendaComo do aluno.
   Dashboard: venda de Paspatur aparece como "Paspatur" e entra na comissão com a taxa do PR (confirmar com o Adriano).
   **Falta (fazer numa conversa nova, "continuar o Z7"):**
   - Conferir pagamento: o representante confirma com foto do comprovante (obrigatória) e o aluno vai para a
     produção; admin desfaz. Muda a regra do banco de "conferido" (hoje só admin) e o cálculo da comissão.
   - Produção (antes do "+ Aluno"), tabela de preços na ⚙️ por grupo, limites de desconto (LF R$ 50 PR / R$ 20
     Paspatur; Repasse R$ 100 / R$ 40) com pedido de autorização, e apagar fotos de vendidos/incompletos sem contato.
4. **Fichas**: ler a ficha de identificação nas fotos dos alunos com prévia e sem planilha e associar a nome e
   telefones; telefone só é acrescentado, nunca substituído.

## Feito em 08/11 (aprovado pela Luciana)

- **Lista compacta** no PR, Paspatur e Formatura: uma linha por aluno (cor da situação, nome, ID, colégio · turma · ano,
  próximo passo, selo); tocar abre o cartão completo embaixo e tocar de novo fecha. Verde entregue, azul pago,
  amarelo interessado, cinza na fila, vermelho atrasado.
- **Janela do aluno** (08/11): tocar no aluno da lista compacta (PR, Paspatur, Formatura) abre uma janela com abas
  Resumo (o cartão completo) · Prévia e fotos · Conversa (mensagem pronta, resposta do cliente guardada em
  "conversa", "✨ Pedir ao Claude" copia o texto sem telefone e abre o claude.ai) · Venda e entrega · Histórico.
  No Contrato do colégio, tocar no nome abre Resumo · Pacote e pagamentos · Histórico.
  Prévia e fotos: a folha e as fotos do Drive em miniatura (tocar amplia) e "🔄 Trocar as fotos" (escolher o colégio
  e o aluno certo na pasta das prévias; grava "fotosDrive" no aluno e vale antes da busca pelo nome; o Drive não muda).
- **Contrato do colégio** (Aluguel de becas → Alunos dos colégios → escolher o colégio → "📄 Contrato do colégio"),
  coleção `contratosColegio` (id = colégio_ano) e pagamentos em `contratosColegio/{id}/pagamentos`:
  - quem fechou, quem paga (o colégio paga tudo / cada aluno paga), valor e parcelas, quem costuma receber,
    contato do colégio (nome, cargo: diretor, coordenadora, secretaria, comercial… e WhatsApp), entrega combinada
    com dia/mês/ano e com quem, pacote padrão, unidade;
  - pacote por aluno (beca, paspatur, certificado, canudo): coluna PACOTE da planilha (vazia = padrão), no "Editar"
    do aluno ou "Aplicar pacote a vários";
  - cada pagamento diz quem recebeu (estúdio, contato do colégio ou representante); "Falta repassar" separado por
    colégio e representante; o representante marca que o colégio repassou e avisa o próprio repasse, que só o
    admin confirma; conferir é do admin;
  - preço de cada item no contrato (o aluno paga a soma do pacote dele); comissão de quem fechou item por item, com a
    porcentagem de cada item em ⚙️ Ajustes → Comissão; cada pagamento conferido se divide pelos itens do pacote
    (pagamento antigo sem itens usa a taxa do Álbum de formatura);
  - relatório de produção com colégio, unidade, representante, entrega e contato no topo; aluno, turma, itens e
    "PRECISA DE FOTO" para quem tem paspatur; totais por item;
  - cada mudança guarda quem fez e quando.
- Dashboard (08/11): pagamento do contrato que chega ao estúdio entra como venda "Contrato do colégio" (origem Becas)
  no mês em que entrou; a comissão de quem fechou (item por item) entra no Desempenho da pessoa depois de conferida.
- **Falta:** colar as regras novas (`firestore.rules`) no Firebase.

## 09/11 — feito
- IDs dos colégios: a sigla não perde mais o E de C.E./E.M. (CENBJ, EMAN, CEYMSA…); E.E. = CE, C.M = EM, GET não
  entra; Zenóbio = CEMZC e Diuma (2023 e 2025, mesmo colégio) = CEPDMS (gravadas no cadastro). 4.275 alunos do PR
  acertados pelo script do GitHub "Acertar IDs dos colégios" (cópia em copiaIds); nomes dos colégios = os do cadastro.
- Importação: o nome do colégio da planilha vira o do cadastro de Instituições e a sigla vem do cadastro
  (js/colegio-nome.js); o aluno continua sendo reconhecido pelo nome que veio da planilha (escolaOrig).
- Kit Paspatur: prévia em livro A4 (imagem + vídeo do livro abrindo), encarte calendário (público) ou foto da turma
  em mosaico (particular) — o app sempre pergunta, com a sugestão pelo tipo do colégio.
- Agenda: WhatsApp/e-mail de quem combinou não são mais obrigatórios; telefone com 0 na frente (021…) é aceito.
- PR e Formatura: botão "📤 Passar o colégio para a equipe" (colégio e ano do "Seu lote de hoje").

## Falta (pedidos de 08 e 09/11 — fazer numa conversa nova, "continuar o Z7")
1. ~~Drive~~: combinado em 09/11 deixar como está (o app acha as fotos pelo nome do aluno e pelo número do ID;
   daqui para frente os nomes já saem com o ID novo).
2. Agenda: várias formaturas para o mesmo colégio (dias, locais e turmas diferentes; o botão fica aberto) e a
   quantidade de alunos de cada formatura só é confirmada depois que a formatura acontece.
3. ~~Agendar colégio~~ (10/11): pergunta primeiro Particular / Público / Faculdade-curso; a lista de colégios mostra
   só os do grupo; colégio digitado no grupo errado avisa onde está cadastrado.
4. ~~Instituições~~ (10/11): lista compacta (uma linha por colégio: cor, responsável, bairro · cidade, próximo
   passo, etapa); tocar abre a janela do colégio (js/inst-janela.js) com Resumo (o cartão completo) · Alunos (por ano,
   no PR e na Formatura, com "Ver alunos" que abre a Busca já com o colégio e o ano) · Agendamentos (fotos,
   formatura, Paspatur, becas: marcar ou mudar) · Visitas. A Busca do PR ignora resposta atrasada de busca antiga.
5. ~~Aluguel de becas~~ (10/11): lista compacta (linhaGenerica em lista-compacta.js) e janela com abas
   (janela.js, genérica para as próximas listas): Resumo · Colégio e contrato (informações do colégio e
   "📄 Abrir o Contrato do colégio") · Histórico. Falta organizar o resto do Aluguel de becas com a Luciana.
6. Venda antecipada (Formaturas): mostrar os alunos e colégios fechados.
7. Fotos do aluno: botão para excluir foto (ex.: a da ficha) — sai do Drive e não vai para o aluno; equipe pode.
8. Preços mínimos: organizar os vários valores (conversar com Adriano/Luciana antes).
9. "Erros do app (5)" em Ajustes: ver o que são e corrigir (pedir o print aberto).
