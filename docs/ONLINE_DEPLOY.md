# Rodar Online e Sincronizado

O GitHub guarda o código e roda automações pelo GitHub Actions, mas ele não hospeda sozinho este painel porque o projeto usa Node.js, Express e SQLite. Para acessar de qualquer computador, celular ou rede, hospede o app em um serviço com servidor Node.js e disco persistente.

O projeto já possui cadastro/login multiusuário no painel. Para transformar em produto público com mais segurança e escala, leia também: [`MULTIUSER_PRODUCT_PLAN.md`](./MULTIUSER_PRODUCT_PLAN.md).

## Opção recomendada: Render

### Passo a passo

1. Suba o projeto completo no GitHub.
2. Entre em https://dashboard.render.com e faça login.
3. Clique em **New +**.
4. Escolha **Blueprint**.
5. Conecte o GitHub, selecione o repositório `CARREIRA` e confirme o arquivo `render.yaml`.
6. Em **Service name**, mantenha `career-hunter-agent` ou escolha um nome curto.
7. O arquivo `render.yaml` usa **Starter** para preservar os dados. Para uma demonstração gratuita, crie o serviço manualmente como **Free** usando as configurações de `render-free.yaml`.
8. Confira o disco persistente:
   - nome: `career-hunter-data`;
   - mount path: `/var/data`;
   - `DATABASE_URL=file:/var/data/jobs.sqlite`.
9. Configure os segredos do serviço:
   - `OPENAI_API_KEY`
   - `GEMINI_API_KEY`
   - `GOOGLE_SEARCH_API_KEY`, se quiser importação automática dos links finais encontrados pelo Google.
   - `GOOGLE_SEARCH_ENGINE_ID`, se quiser importação automática dos links finais encontrados pelo Google.
   - `ACCOUNT_VAULT_KEY`, uma chave longa aleatória para criptografar senhas de contas conectadas.
   - `GMAIL_SYNC_INTERVAL_MINUTES=30`, para atualizar retornos, alertas e newsletters automaticamente.
   - `ALLOW_PUBLIC_REGISTRATION=false`, para fechar novos cadastros após a primeira conta administradora.
10. Clique em **Apply** / **Create Resources**.
11. Aguarde o build terminar.
12. Abra a URL pública gerada pelo Render.
13. Crie a primeira conta administradora.
14. Acesse **Meu currículo > Sincronizar** e importe o JSON gerado na instalação local.
15. Use **Buscar vagas** no painel ou configure scheduler para `npm run scan-all`.

Com isso, as buscas, candidaturas, configurações, usuários e alterações feitas fora do computador local ficam no mesmo banco online.

### Levar a configuração local para o online

A página **Meu currículo** é a mesma no computador e no Render. No fim dela, abra **Sincronizar**:

1. use **Baixar para GitHub** para gerar `apice-preferencias-github.json`, sem nome, e-mail, telefone, documentos ou credenciais;
2. esse arquivo seguro pode ser versionado no repositório;
3. para levar também os dados pessoais, use **Baixar backup privado** e mantenha o arquivo fora do GitHub;
4. no painel online, selecione o arquivo e clique em **Importar configuração**;
5. envie o PDF do currículo separadamente em **Currículo para candidaturas**, pois documentos não são embutidos no JSON.

As chaves OpenAI, Gemini, Google, Gmail e `ACCOUNT_VAULT_KEY` nunca entram nesses arquivos. Localmente elas ficam no `.env`; no Render, ficam em **Environment Variables**.

### O Render é gratuito?

O Render tem Web Services gratuitos, mas o plano grátis tem limitações importantes: o serviço dorme após período sem acesso, demora para acordar, não tem disco persistente para SQLite e pode perder arquivos locais em reinícios/redeploys. Portanto:

- para testar o painel: **Free** serve;
- para usar de verdade com usuários, histórico, currículos e candidaturas: use **Starter** ou superior com disco persistente, ou migre para Postgres.

## Fluxo online do produto

- **Vagas**: oportunidades encontradas. Selecione e escolha Candidatar com IA ou Preparar para eu fazer.
- **Candidaturas**: reúne vagas ainda não enviadas, candidaturas realizadas, seleções, recusas e retornos do Gmail.
- **Próximas ações**: mostra somente o que exige uma ação sua agora.
- **IA Candidatura**: cole o link real da vaga para importar e preparar os dados de preenchimento.
- **Agências Conectadas**: central de logins de InfoJobs, Vagas.com, Gupy, Catho, SINE e outros portais. Senhas ficam criptografadas com `ACCOUNT_VAULT_KEY`.
- **Meu Perfil**: currículo, dados pessoais, preferências de vagas, fontes de busca, IA e código gerado.

## Cadastro e perfis de usuários

O projeto já possui cadastro, login e isolamento por usuário no fluxo principal:

- cada pessoa cria uma conta com nome, e-mail e senha;
- vagas, candidaturas, configurações, perfis e memória ficam vinculados ao `user_id`;
- a sessão usa cookie `httpOnly`, expiração e logout;
- o primeiro usuário criado assume os dados antigos do banco, caso existam.

Para abrir como produto público, ainda recomendo adicionar recuperação de senha por e-mail, rate limit, confirmação de e-mail, storage privado por usuário e PostgreSQL.

## Cofre de contas conectadas

Em produção, defina `ACCOUNT_VAULT_KEY` nas variáveis do Render. Use uma chave longa, por exemplo um valor aleatório gerado por gerenciador de senhas. Não coloque essa chave no GitHub.

O painel salva usuário, URL de login, observações e senha criptografada. A senha não é devolvida para a tela. O objetivo é login assistido e organização de busca; o agente não submete login ou candidatura externa sem ação/consentimento do usuário.

## Candidatura por IA na web

A IA consegue preparar campos, currículo, carta e respostas usando seu perfil e memória. A automação completa depende de três condições:

- o link precisa ser de uma vaga real, não de uma página de busca;
- a plataforma precisa permitir preenchimento/envio automatizado ou assistido;
- login, CAPTCHA, aceite legal e envio final de dados pessoais precisam de sua confirmação.

Sites externos muitas vezes bloqueiam iframe dentro do painel. Nesses casos, use a aba **IA Candidatura** para importar/preparar e clique em **Abrir fonte** para concluir na página oficial.

## Busca online em qualquer lugar

Para buscar vagas mesmo fora do computador local:

1. Configure `GOOGLE_SEARCH_API_KEY` e `GOOGLE_SEARCH_ENGINE_ID` no Render/Railway/Fly.
2. Ative as fontes em **Meu Perfil**.
3. Use um scheduler do provedor para chamar `npm run scan-all` e buscar para todos os usuários ativos.
4. Mantenha `DATABASE_URL` apontando para disco persistente.
5. Revise a aba **Candidaturas** para transformar páginas de busca em links reais de candidatura e acompanhar o próximo passo.

O Google pode ser usado para aumentar o volume, mas o sistema deve salvar somente os links finais de vagas que aparecem nos resultados. Páginas do tipo `google.com/search` continuam bloqueadas.

O Gmail é lido de duas formas: respostas de recrutadores atualizam o funil; alertas e newsletters fornecem links individuais de vagas. O painel atualiza automaticamente no intervalo definido por `GMAIL_SYNC_INTERVAL_MINUTES` e também oferece o botão **Atualizar Gmail agora**.

Para uma conta específica, use `CAREER_HUNTER_USER_ID=ID_DO_USUARIO npm run scan`. Para todos os usuários ativos, use `npm run scan-all`. O mesmo vale para preparo: `npm run prepare-applications` por usuário ou `npm run prepare-all` para todos.

## Rodar com Docker

```bash
docker build -t career-hunter-agent .
docker run --rm -p 8788:8788 -v career-hunter-data:/data --env-file .env career-hunter-agent
```

Abra:

```text
http://localhost:8788
```

## GitHub Actions

O workflow em `.github/workflows/career-hunter.yml` continua útil para scans agendados e artefatos, mas o runner do GitHub é temporário. Ele não substitui um servidor online com banco persistente.

## Segredos

Nunca commite `.env`. Use:

- `.env` local no seu computador;
- secrets do GitHub Actions para automacoes;
- environment variables do Render/Railway/Fly para o painel online.

## Sobre candidaturas automáticas

O app prepara currículo, carta, respostas e status. O envio externo depende de canal oficial da vaga, permissão da plataforma, login, formulário e possíveis CAPTCHAs. O agente não faz stealth, não tenta ficar indetectável, não burla CAPTCHA, não automatiza LinkedIn e não envia dados pessoais sem aprovação.

## Perfis e memoria online

Perfis de candidatura, respostas memorizadas, tentativas de candidatura e status ficam no SQLite persistente configurado em `DATABASE_URL`. Em servidor online, use disco persistente; em runner temporário do GitHub Actions, esses dados viram artefato e não substituem um banco sempre ligado.
