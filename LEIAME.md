# Z7 Funil

App de funil de vendas do Z7 Studio: leads, follow-ups, mensagens prontas para o WhatsApp,
aviso de "quem está respondendo" e lembrete diário às 9h no celular.

## Como funciona
- **App**: `index.html` (instalável no celular e no PC), hospedado no GitHub Pages.
- **Dados e login**: Firebase (Firestore + login por e-mail e senha), plano gratuito.
- **Lembrete das 9h**: `.github/workflows/lembrete.yml` roda `scripts/lembrete.mjs` de segunda a sábado.

## Configuração (uma vez)
1. `config.js`: dados do app Web do Firebase e a chave de push (VAPID).
2. Firebase → Firestore → **Regras**: colar `firestore.rules` com os dois e-mails da equipe.
3. GitHub → Settings → Pages: publicar a partir da branch `main`, pasta raiz.
4. GitHub → Settings → Secrets and variables → Actions:
   - Segredo `FIREBASE_SERVICE_ACCOUNT`: conteúdo do arquivo JSON de
     Firebase → Configurações do projeto → Contas de serviço → Gerar nova chave privada.
     **Esse arquivo é secreto: cole só no GitHub, nunca em conversas.**
   - Variável `APP_URL`: endereço do app no GitHub Pages.
5. GitHub → Actions → "Lembrete das 9h" → Run workflow: manda uma notificação de teste.

## Observações
- O GitHub pode atrasar alguns minutos o lembrete agendado.
- Se o repositório ficar 60 dias sem alterações, o GitHub pausa o agendamento;
  basta entrar em Actions e reativar.
- No iPhone (iOS 16.4 ou mais novo), as notificações só funcionam com o app adicionado à Tela de Início.
