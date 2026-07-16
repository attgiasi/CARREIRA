# Ápice - Carreira inteligente

O Ápice é um produto multiusuário para descobrir vagas reais, priorizar oportunidades, preparar candidaturas com IA e acompanhar respostas de recrutadores pelo Gmail.

O painel foi desenhado para uso sem conhecimento de programação. As preferências são preenchidas com campos, seletores e botões; o JSON correspondente continua disponível para portabilidade e auditoria.

## Fluxo direto

1. **Vagas:** o agente encontra, normaliza, classifica e remove duplicidades.
2. **Candidaturas:** você aprova e autoriza as oportunidades escolhidas.
3. **IA:** o Ápice prepara currículo, respostas e campos permitidos para cada vaga.
4. **Acompanhamento:** somente envios confirmados entram no histórico; Gmail informa avanços, recusas e ações pendentes.

Não existe uma etapa separada de “Aprovadas”. A autorização e o acompanhamento ficam juntos em **Candidaturas**.

## Recursos principais

- painel executivo com vagas, autorizações, candidaturas reais, avanços e pendências;
- filtros por nota, salário-base, local, modelo de trabalho, fonte e disponibilidade;
- links finais de anúncios, sem apresentar pesquisas do Google como se fossem vagas;
- detecção de anúncios repetidos em fontes diferentes;
- classificação por aderência, chance estimada, qualidade e risco;
- perfil e currículo separados por usuário;
- memória de respostas para campos recorrentes;
- busca em Google Programmable Search, Gmail, ATS e fontes configuradas;
- acompanhamento de confirmações, recusas, entrevistas, fases e propostas no Gmail;
- modo claro e escuro, responsivo para computador e celular;
- configuração visual com exportação pública sem dados pessoais e backup privado;
- logs de auditoria com dados sensíveis mascarados;
- execução local ou online com Docker, HTTPS e armazenamento persistente.

## Como a IA ajuda na candidatura

Depois da sua autorização, o Ápice pode:

- escolher o currículo oficial do perfil;
- preparar uma apresentação adaptada à vaga sem inventar experiência;
- recuperar respostas já aprovadas da memória;
- indicar dados ausentes e pedir somente o que realmente falta;
- preencher campos em canais oficialmente permitidos;
- abrir a página oficial e organizar o próximo passo;
- registrar resultado, erro ou intervenção necessária.

Login, CAPTCHA, SMS, aceite jurídico, pagamento e etapas que o portal exige do titular continuam sob controle da pessoa usuária. LinkedIn é assistido: o agente encontra a vaga e prepara os dados, mas não burla as regras da plataforma nem envia candidaturas de forma clandestina.

## Rodar localmente

Requisitos: Node.js 20 ou superior.

```bash
npm install
cp .env.example .env
npm run dashboard
```

No Windows PowerShell:

```powershell
Copy-Item .env.example .env
npm install
npm run dashboard
```

Abra `http://localhost:8788` e crie a primeira conta administradora.

## Comandos

```bash
npm run dashboard
npm run scan
npm run scan-all
npm run score
npm run prepare-applications
npm run prepare-all
npm run daily-summary
npm run weekly-radar
npm run lint
npm test
```

## Configuração online

GitHub armazena e versiona o código, mas não executa continuamente um servidor Node.js com SQLite. Para usar o mesmo painel de qualquer lugar, o projeto inclui implantação em uma VM Oracle Cloud Always Free:

- `Dockerfile` com processo sem privilégios;
- `deploy/oracle/compose.yaml` com volumes persistentes;
- Caddy para HTTPS automático;
- scripts de instalação, atualização e backup;
- workflow opcional para atualizar a VM após cada envio ao GitHub.

O guia completo está em [`docs/ORACLE_ALWAYS_FREE.md`](docs/ORACLE_ALWAYS_FREE.md).

## Variáveis protegidas

Copie `.env.example` para `.env` no ambiente local. Na Oracle, use `deploy/oracle/.env.production`, que é ignorado pelo Git.

Integrações opcionais:

```env
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
GEMINI_API_KEY=
GEMINI_MODEL=gemini-1.5-flash
GOOGLE_SEARCH_API_KEY=
GOOGLE_SEARCH_ENGINE_ID=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GMAIL_REFRESH_TOKEN=
ACCOUNT_VAULT_KEY=
```

Nunca publique `.env`, tokens do Gmail, banco SQLite, currículo ou chaves privadas. Esses arquivos já estão excluídos do Git.

## Gmail

O Gmail é opcional. Quando conectado, o Ápice:

- importa alertas e newsletters de vagas;
- relaciona respostas à candidatura correta;
- classifica confirmação, recusa, entrevista, avanço, proposta e ação solicitada;
- mantém atualização automática no intervalo configurado e um botão de atualização manual.

Sem Gmail, a busca e o painel continuam funcionando; apenas os retornos por e-mail deixam de ser sincronizados.

## Privacidade e segurança

- cada usuário possui vagas, perfil, currículo, memória e configurações próprios;
- senhas de agências são cifradas com `ACCOUNT_VAULT_KEY`;
- chaves de IA não aparecem no JSON exportado;
- páginas externas não podem incorporar ou controlar o painel;
- nenhuma automação tenta ficar “indetectável”, contornar CAPTCHA ou violar regras de plataformas;
- candidaturas reais exigem autorização rastreável e confirmação de envio.

## Dados persistentes

Localmente, o banco padrão fica em `data/jobs.sqlite`. Na Oracle, banco, currículos enviados, materiais gerados e logs ficam em volumes Docker persistentes e sobrevivem a atualizações do código.

Para começar novamente, use **Configurações > Sincronização > Zerar candidaturas**. Essa operação apaga o histórico do usuário atual e devolve as vagas ao início, sem apagar currículo nem preferências.

## Estrutura

```text
public/                 interface do painel
src/modules/jobs/       normalização, notas e duplicidades
src/modules/sources/    conectores de fontes
src/modules/applications/ preparação e autorização
src/modules/gmail/      alertas e retornos de recrutadores
src/modules/auth/       contas e sessões
deploy/oracle/          produção gratuita na Oracle
tests/                  testes automatizados
```

## Garantia de qualidade

Antes de publicar:

```bash
npm run lint
npm test
```

O conjunto cobre o fluxo de autorização, currículo oficial, Gmail, resiliência a limites, fontes reais, duplicidades, salários, LinkedIn assistido, portabilidade e implantação Oracle.
