# Rodar Online e Sincronizado

O GitHub guarda o codigo e roda automacoes pelo GitHub Actions, mas ele nao hospeda sozinho este painel porque o projeto usa Node.js, Express e SQLite. Para acessar de qualquer computador, celular ou rede, hospede o app em um servico com servidor Node.js e disco persistente.

## Opção recomendada: Render

1. Suba o repositorio no GitHub.
2. Entre no Render e crie um Blueprint usando `render.yaml`.
3. Configure os segredos do servico:
   - `OPENAI_API_KEY`
   - `GEMINI_API_KEY`
   - `GOOGLE_SEARCH_API_KEY`, se quiser importacao automatica pelo Google Search.
   - `GOOGLE_SEARCH_ENGINE_ID`, se quiser importacao automatica pelo Google Search.
4. Mantenha `DATABASE_URL=file:/var/data/jobs.sqlite`.
5. Use o disco persistente montado em `/var/data`.

Com isso, as buscas, candidaturas, configuracoes e alteracoes feitas fora do computador local ficam no mesmo banco online.

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

O workflow em `.github/workflows/career-hunter.yml` continua util para scans agendados e artefatos, mas o runner do GitHub e temporario. Ele nao substitui um servidor online com banco persistente.

## Segredos

Nunca commite `.env`. Use:

- `.env` local no seu computador;
- secrets do GitHub Actions para automacoes;
- environment variables do Render/Railway/Fly para o painel online.

## Sobre candidaturas automaticas

O app prepara curriculo, carta, respostas e status. O envio externo depende de canal oficial da vaga, permissao da plataforma, login, formulario e possiveis CAPTCHAs. O agente nao burla CAPTCHA, nao automatiza LinkedIn e nao envia dados pessoais sem aprovacao.

## Perfis e memoria online

Perfis de candidatura, respostas memorizadas, tentativas de candidatura e status ficam no SQLite persistente configurado em `DATABASE_URL`. Em servidor online, use disco persistente; em runner temporario do GitHub Actions, esses dados viram artefato e nao substituem um banco sempre ligado.
