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
4. **Fichas**: ler a ficha de identificação nas fotos dos alunos com prévia e sem planilha e associar a nome e
   telefones; telefone só é acrescentado, nunca substituído.

## Feito em 08/11 (aprovado pela Luciana)

- **Lista compacta** no PR, Paspatur e Formatura: uma linha por aluno (cor da situação, nome, ID, colégio · turma · ano,
  próximo passo, selo); tocar abre o cartão completo embaixo e tocar de novo fecha. Verde entregue, azul pago,
  amarelo interessado, cinza na fila, vermelho atrasado.
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
