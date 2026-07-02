# Career Hunter Agent

Agente local, seguro e modular para busca, análise, filtragem, preparação, candidatura assistida e acompanhamento de vagas formais e oportunidades informais para Giasi Mandela Silva.

O objetivo não é sair se candidatando em massa. O agente funciona como assistente estratégico de carreira: encontra oportunidades, remove ruído, calcula risco, prepara materiais personalizados e coloca tudo em fila de aprovação.

## O que ele faz

- Lê alertas de vagas do Gmail quando a API estiver configurada.
- Importa links manuais em `data/manual-urls.txt`.
- Importa mensagens copiadas/exportadas de grupos do WhatsApp em `data/whatsapp-vagas.txt`.
- Mantém conectores preparados para Greenhouse, Lever, Gupy, RSS e páginas de carreira.
- Cria buscas direcionadas no Google, SINE/Emprega Curitiba, InfoJobs, 99jobs e agências de RH em Curitiba.
- Normaliza vagas em um formato único.
- Detecta modelo de trabalho, viagem, CNH, veículo próprio, escolaridade, senioridade, salário e trilha de carreira.
- Calcula `Fit Score`, `Hire Chance Score`, `Job Quality Score` e `Risk Score`.
- Detecta vagas ruins, suspeitas e golpe provável.
- Analisa freelas, taxas, bicos, eventos e consultorias.
- Calcula valor por hora e `Freela Score`.
- Escolhe currículo base por trilha.
- Gera currículo direcionado em Markdown sem inventar informações.
- Gera carta de apresentação.
- Coloca candidatura em fila de aprovação.
- Gera resumo diário e radar semanal.
- Mostra painel local em `http://localhost:8788`.
- Registra auditoria em JSONL com dados sensíveis mascarados.

## O que ele não faz

- Não automatiza LinkedIn.
- Não burla CAPTCHA.
- Não faz scraping agressivo.
- Não envia e-mail sem aprovação quando a configuração exige.
- Não confirma freela automaticamente.
- Não inventa experiência, formação, idiomas, certificações, CNH ou dados pessoais.
- Não paga taxa de cadastro nem aceita proposta que peça pagamento antecipado.

## Por que não automatiza LinkedIn

LinkedIn tem regras rígidas contra automação não autorizada, scraping e ações robóticas em conta logada. Para proteger sua conta, reputação e dados, este projeto só usa alertas por e-mail e assistência manual para LinkedIn.

## Instalação

Instale Node.js 20 ou superior. Depois:

```bash
npm install
```

Copie `.env.example` para `.env` e preencha apenas o que for usar:

```bash
cp .env.example .env
```

No Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

## Configuração principal

Edite `agent-settings.json`. Nele você controla:

- trilhas de carreira;
- cargos buscados;
- cidade, remoto e híbrido;
- escolaridade aceita;
- CNH e veículo próprio;
- salário mínimo/desejado;
- freelas, taxas e bicos;
- fontes de busca;
- `dryRun`;
- limites de candidatura;
- regras de segurança.

Por padrão, `dryRun=true`, `autoApply=false` e aprovação é obrigatória.

## Gmail API

1. Crie um projeto no Google Cloud.
2. Ative Gmail API.
3. Crie credenciais OAuth.
4. Gere um refresh token com escopo de leitura e criação de rascunhos.
5. Preencha:

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=
GMAIL_REFRESH_TOKEN=
```

Se não configurar Gmail, o sistema não quebra. Ele apenas registra no log e segue com fontes disponíveis.

## Google Calendar

Opcional. Ative com:

```env
GOOGLE_CALENDAR_ENABLED=true
```

A base já possui módulos para eventos de entrevista, follow-up e bloqueio de freela aprovado.

## OpenAI e Gemini

Configure a OpenAI:

```env
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
```

Gemini fallback fica desligado por padrão:

```env
GEMINI_API_KEY=
```

Mesmo sem IA externa, o projeto roda com regras determinísticas.

## Google, SINE, InfoJobs, 99jobs e agências de RH

O agente cria buscas direcionadas usando seus cargos e localidades configuradas. Sem chave do Google, ele gera links prontos para abrir no painel. Com Google Programmable Search configurado, ele importa resultados automaticamente.

Para ativar importação automática via Google Programmable Search:

```env
GOOGLE_SEARCH_API_KEY=
GOOGLE_SEARCH_ENGINE_ID=
```

Fontes incluídas:

- Google Search assistido;
- SINE / Emprega Curitiba;
- InfoJobs;
- 99jobs;
- agências de RH em Curitiba;
- páginas diretas cadastradas em `data/rh-agencies-curitiba.json`.

O agente não faz scraping agressivo dessas plataformas. Quando o resultado for uma busca assistida, abra o link, escolha a vaga real e cole o link específico em `data/manual-urls.txt` para análise detalhada.

## Currículos

Coloque seus PDFs reais em:

- `resumes/cv-hospitalidade.pdf`
- `resumes/cv-atendimento.pdf`
- `resumes/cv-prevencao.pdf`
- `resumes/cv-gestao.pdf`

Enquanto os PDFs não existirem, o agente ainda gera versões Markdown em `generated/resumes/`.

## Comandos

```bash
npm run dev
npm run build
npm start
npm run dashboard
npm run scan
npm run score
npm run prepare
npm run daily-summary
npm run weekly-radar
npm run test
npm run lint
```

## Fluxo recomendado

1. Configure `.env`.
2. Ajuste `agent-settings.json`.
3. Adicione links manuais em `data/manual-urls.txt`.
4. Cole mensagens de grupos de vagas em `data/whatsapp-vagas.txt`, se quiser monitorar WhatsApp de forma segura.
5. Rode `npm run scan`.
6. Rode `npm run prepare`.
7. Abra `npm run dashboard`.
8. Revise vagas, fontes, riscos, cartas e currículos gerados.
9. Aprove manualmente antes de enviar qualquer candidatura.

## WhatsApp

O agente não entra automaticamente na sua conta do WhatsApp e não monitora grupos por WhatsApp Web. Isso evita risco de bloqueio, exposição de conta e automação indevida.

Use o caminho seguro:

1. Copie mensagens de grupos de vagas ou exporte a conversa.
2. Cole em `data/whatsapp-vagas.txt`.
3. Rode `npm run scan`.
4. Veja as oportunidades no painel, com fonte `whatsapp` ou `whatsapp-informal`.

## Freelas, taxas e bicos

O agente avalia:

- valor total;
- valor por hora;
- local;
- horário;
- alimentação;
- transporte;
- prazo de pagamento;
- risco;
- clareza da proposta.

Ele sugere pedir detalhes, negociar, aceitar ou recusar, mas não confirma automaticamente.

## Logs

Arquivos:

- `logs/audit.jsonl`
- `logs/errors.jsonl`

E-mails, telefones, CPFs e tokens são mascarados nos logs.

## Exportar ou apagar histórico

O histórico fica em `data/jobs.sqlite`. Para backup, copie esse arquivo com o agente parado. Para apagar histórico, pare o agente e remova `data/jobs.sqlite`, `logs/*.jsonl` e os arquivos em `generated/`.

## GitHub Actions

O workflow `.github/workflows/career-hunter.yml` roda manualmente ou a cada 4 horas no cron `17 */4 * * *`.

Configure segredos no GitHub Actions. Nunca coloque tokens no repositório.

Quando roda no GitHub, o agente executa em servidor temporário do Actions: instala dependências, faz scan, pontua, prepara candidaturas e salva artefatos com banco, logs e relatórios. O painel web local não fica “hospedado” pelo GitHub Pages, porque ele depende de Node.js, Express e SQLite. Para painel online contínuo, use um serviço com Node.js persistente, como Render, Railway, Fly.io ou VPS.

O GitHub Actions serve para automação agendada e histórico por artefatos; o painel em `localhost:8788` serve para operação local com aprovação manual.

## Expansão de conectores

Os conectores estão em `src/modules/sources/`. A regra é simples:

- prefira API oficial;
- se exigir token, pule com log amigável quando não estiver configurado;
- não automatize plataforma logada sem permissão explícita e API permitida;
- não faça scraping do LinkedIn.

## Painel

Rode:

```bash
npm run dashboard
```

Abra:

```text
http://localhost:8788
```

Abas disponíveis: Dashboard, Vagas, Freelas e Bicos, Candidaturas, Configurações e Logs.
