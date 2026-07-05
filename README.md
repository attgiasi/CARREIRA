# Career Hunter Agent

Agente local, seguro e modular para busca, análise, filtragem, preparação, candidatura assistida e acompanhamento de vagas formais e oportunidades informais para Giasi Mandela Silva.

O objetivo não é sair se candidatando em massa. O agente funciona como assistente estratégico de carreira: encontra oportunidades, remove ruído, calcula risco, prepara materiais personalizados e coloca tudo em fila de aprovação.

## O que ele faz

- Lê alertas de vagas do Gmail quando a API estiver configurada.
- Importa links reais pelo painel ou por `data/manual-urls.txt`.
- Importa mensagens copiadas/exportadas de grupos do WhatsApp em `data/whatsapp-vagas.txt`.
- Mantém conectores preparados para Greenhouse, Lever, Gupy, RSS e páginas de carreira.
- Usa Google Programmable Search, quando configurado, para pesquisar cargos no Google e importar apenas os links finais das vagas que aparecem nos resultados. Também cria fontes diretas em SINE/Emprega Curitiba, InfoJobs, 99jobs e agências de RH em Curitiba.
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
- Mostra painel local em `http://localhost:8788` com fluxo direto: Painel, Vagas, Aprovadas, Candidaturas, IA Candidatura, Freelas, Agências Conectadas, Meu Perfil e Logs.
- Mantém perfis de candidatura para pessoas diferentes.
- Pergunta dados ausentes, salva na memória do perfil e reutiliza nas próximas candidaturas.
- Separa vagas aprovadas em: candidatura por IA, candidatura manual, e-mail, telefone, WhatsApp e vagas que ainda precisam de link real.
- Identifica possíveis vagas duplicadas entre fontes diferentes por link, ID de plataforma, cargo, empresa e local.
- Tem uma aba **IA Candidatura** para colar o link real da vaga, importar, aprovar e preparar dados de preenchimento.
- Inclui botão para candidatar novamente em vagas já trabalhadas.
- Monitora candidaturas enviadas e registra quando uma vaga parece fechada ou indisponível.
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
GEMINI_MODEL=gemini-1.5-flash
```

Mesmo sem IA externa, o projeto roda com regras determinísticas.

Você também pode abrir o painel, ir em **Meu Perfil > IA e online** e salvar a chave/modelo sem editar arquivo manualmente. O painel grava no `.env`, que é ignorado pelo Git.

## Google, SINE, InfoJobs, 99jobs e agências de RH

O agente cria buscas direcionadas usando seus cargos e localidades configuradas. Sem chave do Google, ele não salva links de pesquisa do Google como vagas. Com Google Programmable Search configurado, ele importa automaticamente apenas links finais de resultados que parecem vagas reais.

Para ativar importação automática via Google Programmable Search:

```env
GOOGLE_SEARCH_API_KEY=
GOOGLE_SEARCH_ENGINE_ID=
```

Fontes incluídas:

- Google Programmable Search somente para links finais de vagas que aparecem nos resultados;
- SINE / Emprega Curitiba;
- InfoJobs;
- 99jobs;
- LinkedIn Jobs apenas para encontrar vagas;
- Indeed;
- Vagas.com;
- Catho;
- NetVagas;
- BNE;
- Trabalha Brasil;
- Glassdoor;
- Empregos.com.br;
- Sólides Jobs;
- Abler;
- Pandapé;
- agências de RH em Curitiba;
- páginas diretas cadastradas em `data/rh-agencies-curitiba.json`.

O agente não faz scraping agressivo dessas plataformas. Quando o resultado for uma página de busca, abra o link, escolha a vaga real e cole o link específico no campo **Importar link real** ou na aba **IA Candidatura**. No LinkedIn, o agente encontra a vaga, mas a candidatura continua manual pela sua conta.

## Perfis, memória e candidatura por IA

Use a aba **Meu Perfil** para manter dados, currículo, preferências de vagas, fontes de busca, chaves de IA e memória de respostas em um lugar só.

Fluxo principal:

- `Vagas`: mostra oportunidades encontradas. Selecione e aprove as melhores.
- `Aprovadas`: mostra o que já foi aprovado para candidatura. Divide em candidatura por IA, manual, e-mail, WhatsApp, telefone e precisa link real.
- `Candidaturas`: mostra o que já foi enviado ou marcado como enviado.
- `Candidaturas`: mostra o próximo passo de cada vaga, inclusive o que a IA pode fazer, o que você precisa fazer e o que já foi enviado.
- `IA Candidatura`: cole um link real da vaga para importar, aprovar e preparar os campos.

Se faltar telefone, disponibilidade, pretensão salarial ou outra resposta recorrente, o painel pergunta e salva em `answer_memory` para preencher automaticamente nas próximas vagas do mesmo perfil.

O botão `Candidatar novamente` recoloca uma candidatura na fila sem apagar o histórico anterior.

Envio automático real só deve acontecer quando houver canal oficial permitido, dados completos, sem CAPTCHA e com configuração explícita. O agente não faz stealth, não tenta ficar "indetectável" e não burla rastreamento, CAPTCHA ou bloqueios anti-bot. LinkedIn permanece manual por segurança. Antes de transmitir dados pessoais para um site externo, revise e confirme.

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
npm run agent
npm run dashboard
npm run scan
npm run score
npm run prepare
npm run daily-summary
npm run weekly-radar
npm run test
npm run lint
```

`npm start` sobe o painel web. Para executar comandos do agente diretamente, use `npm run agent -- scan`, `npm run scan` ou os scripts específicos.

## Fluxo recomendado

1. Configure `.env`.
2. Ajuste `agent-settings.json`.
3. Abra `npm run dashboard`.
4. Rode `Buscar vagas`.
5. Em `Vagas`, revise filtros, riscos e aprove as melhores.
6. Em `Aprovadas`, escolha se você fará sozinho, por e-mail/telefone/WhatsApp ou por IA.
7. Quando uma página de busca abrir uma vaga individual, cole o link oficial em **Importar link real** ou na aba **IA Candidatura**.
8. Depois de enviar, marque como enviada. Ela vai para `Candidaturas`.
9. Use `Verificar disponibilidade` em `Candidaturas` para monitorar se a vaga ainda parece aberta.
10. Cole mensagens de grupos de vagas em `data/whatsapp-vagas.txt`, se quiser processar WhatsApp de forma segura.

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

Para uso online privado ou multiusuário, veja `docs/ONLINE_DEPLOY.md`. Para evolução de produto público, veja `docs/MULTIUSER_PRODUCT_PLAN.md`.

O GitHub Actions serve para automação agendada e histórico por artefatos; o painel em `localhost:8788` serve para operação local com aprovação manual.

## Rodar online e sincronizado

GitHub sozinho não mantém este painel online porque o app depende de Node.js, Express e SQLite. Para acessar de qualquer lugar e manter tudo sincronizado, hospede em Render, Railway, Fly.io ou VPS com disco persistente.

O painel já possui cadastro/login multiusuário. No primeiro acesso online, crie a conta administradora; os dados antigos do banco local serão vinculados ao primeiro usuário criado. Depois disso, cada pessoa usa sua própria conta, com vagas, candidaturas, configurações, perfis e memória separados.

Para automação online em todos os usuários ativos, use `npm run scan-all` e `npm run prepare-all`. Para rodar em apenas um usuário, defina `CAREER_HUNTER_USER_ID` e use `npm run scan` ou `npm run prepare`.

A aba **Agências Conectadas** centraliza acessos de InfoJobs, Vagas.com, Gupy, Catho, SINE e outros portais. Em produção, configure `ACCOUNT_VAULT_KEY` no Render para criptografar senhas conectadas.

Arquivos preparados:

- `Dockerfile`
- `render.yaml`
- `docs/ONLINE_DEPLOY.md`

No Render, use `DATABASE_URL=file:/var/data/jobs.sqlite` e configure um disco persistente em `/var/data`. As chaves ficam em environment variables do serviço, não no repositório.

O arquivo `render.yaml` está preparado para uso real com instância `starter` e disco persistente. O plano gratuito do Render serve para teste, mas não é recomendado para este agente com SQLite porque serviços gratuitos não preservam arquivos locais como banco/currículos em reinícios e redeploys.

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

No primeiro acesso, cadastre ou entre com sua conta. Abas disponíveis: Painel, Vagas, Aprovadas, Candidaturas, IA Candidatura, Freelas, Agências Conectadas, Meu Perfil e Logs.
