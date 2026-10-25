# Z7 Studio

App do Z7 Studio Fotográfico: funil de vendas, PR (Linha de Frente e Repasse), agendamento,
instituições, formaturas (colação de grau e álbum), aluguel de becas e dashboard de vendas.
Instalável no celular e no PC, hospedado no GitHub Pages, com dados no Firebase (plano gratuito).

## Estrutura
- `index.html`: casca do app (login, tela inicial, ajustes, equipe, rotas, contadores) e o CSS.
- `js/`: um arquivo por módulo (`funil`, `repasse`, `agenda`, `instituicoes`, `turma`, `formaturas`, `becas`, `vendas`, `mockup`).
  - `js/regras.js`: regras de negócio num lugar só (dinheiro em centavos, parcelas, vencimentos, comissão, status).
    Usado pelo app e pelos scripts do GitHub.
  - `js/calc.js`: cálculo do Dashboard (o mesmo no app e no resumo noturno).
  - `js/ui.js`: peças de tela compartilhadas. `js/feriados.js`: feriados nacionais, Carnaval e RJ.
- `firestore.rules`: regras de segurança (colar no Firebase → Firestore → Regras).
- `scripts/`: lembrete das 9h, e-mails para os colégios e resumo noturno do Dashboard.

## Dinheiro
As contas são feitas em centavos inteiros (`js/regras.js`): "1.350,50", "9,5" e "9.5" são lidos certo,
e 400 em 3x vira 133,34 + 133,33 + 133,33. No banco o valor fica em reais com no máximo 2 casas.

## Testes
- `node --test tests/*.test.mjs`: regras de negócio, cálculo do Dashboard e conferências do projeto.
- `tests/firebase/`: regras de segurança no emulador do Firebase (roda no GitHub a cada envio).
- `tests/e2e/app.e2e.mjs`: abre o app de verdade num navegador com um Firebase falso e testa os fluxos
  (precisa de `npm install` em `tests/e2e`).
- `.github/workflows/testes.yml` roda os testes a cada alteração.

## Rotinas no GitHub
- **Lembrete das 9h** (`lembrete.yml`): notificação no celular de segunda a sábado.
- **E-mails** (`emails.yml`): envia as datas confirmadas para os colégios (precisa do Gmail configurado).
- **Resumo do Dashboard** (`resumo.yml`): toda madrugada, para o Dashboard abrir lendo 1 documento.

## Configuração (uma vez)
1. `config.js`: dados do app Web do Firebase, donos, aprovadores e a chave de push (VAPID).
   Se mudar os donos ou a aprovadora, mude também em `firestore.rules` (um teste confere).
2. Firebase → Firestore → **Regras**: colar `firestore.rules`.
3. GitHub → Settings → Pages: publicar a partir da branch `main`, pasta raiz.
4. GitHub → Settings → Secrets and variables → Actions:
   - Segredo `FIREBASE_SERVICE_ACCOUNT`: conteúdo do JSON de Firebase → Configurações do projeto → Contas de serviço.
     **Esse arquivo é secreto: cole só no GitHub, nunca em conversas.**
   - Variável `APP_URL`: endereço do app no GitHub Pages.

## Observações
- Atualização publicada aparece na próxima abertura do app (o service worker busca sempre a versão nova).
- O GitHub pode atrasar alguns minutos as rotinas agendadas e pausa o agendamento após 60 dias sem alterações.
- No iPhone (iOS 16.4 ou mais novo), as notificações só funcionam com o app adicionado à Tela de Início.
