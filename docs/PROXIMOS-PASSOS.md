# Próximos passos (combinados em 07/11/2026)

Feito e no ar: formaturas no ano em que foram trabalhadas (sem repetidos), repetidos do PR 2024 apagados,
CIEP 135 em 2021, fotos achadas nas pastas por ano do Drive (nomes novos das prévias e nomes de colégio parecidos),
botão "Mudar ano" nas importações de Formatura/Paspatur, aba Vendidos (admin) e Minhas vendas (equipe).

## Fazer, nesta ordem

1. **Revisão completa de código** e correção do que aparecer (rodar `node --test tests/*.test.mjs` antes e depois).
2. **Alunos sem foto**: separar em "vendido" (normal não ter prévia; o gerador pula quem comprou) e
   "não vendido" (precisa gerar prévia), por colégio e ano.
3. **Telas novas do PR/Paspatur** (aprovadas pela Luciana):
   - lista única; filtro Todos / Só PR / Só Paspatur; filtro por pessoa da equipe com contagem;
   - no aluno, chave PR / Paspatur com confirmação ("Deseja vender como …?"); qualquer pessoa pode trocar; o valor troca junto;
   - abas na ordem: Caídos · Incompletos · Para hoje · Interessados · Buscar · Conferir pagamento | Vendido · Entregar · Entregue (+ Vendidos/Minhas vendas);
   - "Conferir pagamento": o representante confirma com foto do comprovante obrigatória; admins podem desfazer;
   - botão "Produção" antes de "+ Aluno": o que imprimir; a Luciana escolhe a entrega (ela, equipe ou correio);
     baixa: correio e "eu entrego" = Luciana; equipe = o responsável;
   - prazo: pagamento + 20 dias, em cores (verde / amarelo faltando 3 dias / vermelho); entrega própria marca dia e turno;
   - endereço completo obrigatório em toda venda (CEP preenche rua e bairro);
   - caído por "achou caro": oferecer Paspatur antes;
   - colégio: "Quem paga: cada aluno / o colégio" (colégio paga = entra direto em Vendido);
   - tabela de preços organizada na ⚙️ (só admin), por grupo; descontos em R$ sem pedir, iguais para toda a equipe:
     Linha de Frente PR 50 / Paspatur 20; Repasse PR 100 / Paspatur 40; acima disso, pedido de autorização;
   - total do mês (quantidade e valor) no topo de "Minhas vendas";
   - botão para apagar as fotos de quem já comprou ou de incompleto sem contato.
4. **Fichas**: ler a ficha de identificação nas fotos dos alunos com prévia e sem planilha e associar a nome e
   telefones; telefone só é acrescentado, nunca substituído.
