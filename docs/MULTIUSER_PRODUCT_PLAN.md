# Plano Online Multiusuario

Este projeto agora possui a base multiusuario online: cadastro, login, sessao segura por cookie, configuracoes por usuario e isolamento por `user_id` nas vagas, candidaturas, perfis, memoria e tentativas. O primeiro usuario criado no painel assume os dados antigos do banco local, para preservar o historico atual.

## Caminho 1: online privado para uma pessoa

Use quando o objetivo e acessar de qualquer lugar sem deixar publico para clientes.

1. Subir o repositorio no GitHub.
2. Implantar no Render, Railway, Fly.io ou VPS.
3. Configurar variaveis de ambiente:
   - `OPENAI_API_KEY`
   - `GEMINI_API_KEY`
   - `GOOGLE_SEARCH_API_KEY`
   - `GOOGLE_SEARCH_ENGINE_ID`
   - `DATABASE_URL`
4. Usar disco/volume persistente para o SQLite.
5. Criar a primeira conta administradora ao abrir o painel.

Esse modo sincroniza buscas, candidaturas, configuracoes e memoria porque todos os acessos usam o mesmo banco online.

## Caminho 2: produto com cadastro de usuarios

Use quando cada pessoa precisa ter sua propria conta, curriculo, memoria, vagas e candidaturas.

### Implementado agora

- `users`: contas com nome, e-mail unico, senha criptografada e status.
- `user_sessions`: sessoes por cookie `httpOnly`, `sameSite=Lax`, expiracao e revogacao no logout.
- `user_settings`: configuracoes de busca, IA e automacao separadas por usuario.
- `user_id` em vagas, candidaturas, perfis, memoria, tentativas e freelas.
- Middleware `requireAuth` protegendo as rotas principais da API.
- Migração de dados legados para o primeiro usuario cadastrado.
- Tela de primeiro acesso, login, cadastro e logout no painel.
- Comandos `scan-all` e `prepare-all` para automacoes online em todos os usuarios ativos.
- Central **Agências Conectadas** para portais de vagas com senha criptografada por `ACCOUNT_VAULT_KEY`.
- Upload de curriculo por perfil em `resumes/users/{userId}/...`.
- Botao de aceleracao que leva uma vaga real direto para **IA Candidatura** com link carregado.
- Registro de candidatura enviada para mover a vaga para acompanhamento.

### Banco

O SQLite com disco persistente ja funciona para uso privado, equipe pequena e validacao. Para produto publico com muitos usuarios, migre para PostgreSQL em producao.

Tabelas e campos ja criados:

- `users`: id, nome, email, senha com hash, status, plano, criado_em.
- `user_sessions`: sessao segura por usuario.
- `user_settings`: configuracoes por usuario.
- `candidate_profiles.user_id`.
- `jobs.user_id`.
- `applications.user_id`.
- `answer_memory.user_id`.
- `application_attempts.user_id`.

Regra central: toda consulta precisa filtrar por `user_id`.

### Login

O login proprio ja foi implementado. Para escalar como SaaS, ainda vale evoluir com:

- cookie `secure` obrigatorio em HTTPS;
- recuperacao de senha por e-mail;
- Confirmacao de e-mail antes de permitir candidatura.
- rate limit contra tentativa de senha;
- painel administrativo de usuarios.

### Arquivos

Curriculos e cartas nao devem ficar misturados em pasta local publica.

Proxima evolucao recomendada:

- S3, Cloudflare R2, Supabase Storage ou volume privado.
- Caminho por usuario: `users/{userId}/resumes/...`.
- Nunca expor arquivo sem verificar sessao e permissao.

### Buscas e automacoes

Use fila de tarefas para nao travar o painel:

- `scan_jobs`: busca vagas por usuario.
- `prepare_application`: gera curriculo, carta e respostas.
- `check_availability`: verifica se vaga segue ativa.
- `follow_up`: cria lembretes.

Em producao, isso pode rodar em worker separado com cron/scheduler.

### IA e candidatura

Por usuario, guardar:

- perfil profissional;
- respostas memorizadas;
- curriculo base;
- preferencia salarial;
- limites de candidatura;
- aprovacoes e consentimentos.

A IA pode preparar campos e textos. Envio automatico so deve acontecer quando houver canal permitido, sem CAPTCHA, sem violar regra da plataforma e com consentimento registrado. Nao implementar stealth, evasao de rastreamento, burla de CAPTCHA ou contorno de bloqueios anti-bot.

## LinkedIn

LinkedIn deve ficar como descoberta e apoio manual:

- o agente encontra vagas;
- abre o link;
- prepara curriculo, carta e respostas;
- mostra o que copiar/preencher;
- voce envia pela sua conta.

Nao automatizar login, clique em candidatura, scraping ou envio no LinkedIn. Isso protege a conta e evita bloqueios.

## Google

O uso correto e:

1. Gerar buscas por cargo/localidade.
2. Consultar Google Programmable Search.
3. Ler os resultados.
4. Salvar apenas URLs finais de vagas.
5. Rejeitar paginas `google.com/search`, `google.com/url` sem link final e qualquer pagina que seja apenas busca.

Se uma vaga aparece no Google em varias fontes, o sistema deve marcar como possivel duplicada e priorizar a fonte com candidatura mais direta.

## Roadmap de implementacao

1. Concluido: autenticacao e tabela `users`.
2. Concluido: `user_id` em vagas, candidaturas, memoria e perfis.
3. Concluido: middleware `requireAuth` nas rotas principais.
4. Concluido base local: storage de curriculos por usuario em pasta separada.
5. Proximo: migrar storage para S3/R2/Supabase quando abrir publicamente.
6. Proximo: migrar banco para PostgreSQL quando houver muitos usuarios.
7. Proximo: worker/cron por usuario.
8. Proximo: painel administrativo para ver uso, erros e limites.
9. Proximo: termos de uso e consentimentos de candidatura.

## Regra de seguranca

Ja existe isolamento por usuario no fluxo principal. Antes de abrir publicamente para clientes, implemente HTTPS obrigatorio, recuperacao de senha, rate limit, storage privado e politicas de consentimento.
