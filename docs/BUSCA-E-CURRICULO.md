# Busca de vagas e curriculo

## Uso local

1. Instale as dependencias com `npm ci` e compile com `npm run build`.
2. Inicie com `npm start` e abra `http://localhost:8788`.
3. Entre na sua conta e revise Meu Perfil e Preferencias de busca.
4. Em Fontes de vagas, configure paginas de carreira publicas, uma por linha.
   Paginas Quickin no formato `https://jobs.quickin.io/EMPRESA/jobs` possuem
   coleta paginada; outras paginas precisam oferecer links de anuncios e
   dados publicos JobPosting. Nem todo site permite essa leitura.
   SmartRecruiters no formato `https://careers.smartrecruiters.com/EMPRESA`
   consulta a API publica de anuncios ativos e verifica cada vaga relevante.
5. Clique em Buscar novas vagas. Em Fontes, Ultima busca informa resultados,
   indisponibilidade e configuracoes pendentes. Zero resultados nao significa
   que todos os sites da internet foram pesquisados.

## O que mudou

- As buscas nao criam vagas ficticias a partir de paginas de pesquisa.
- Google precisa de `GOOGLE_SEARCH_API_KEY` e `GOOGLE_SEARCH_ENGINE_ID`.
  Resultados sao abertos e validados; snippets nao substituem anuncios.
- A busca aplica cargo, local quando restrito e salario-base. Gorjetas,
  bonus e beneficios nao compoem a base. Salario desconhecido continua
  sinalizado; nao e promessa de remuneracao acima da meta.
- Links canonicos evitam repeticao. Mesmo cargo, empresa e local em fontes
  diferentes podem ser agrupados. Anuncios distintos da mesma fonte nao
  sao unidos apenas por terem o mesmo titulo.
- Paginas expiradas, pesquisas, respostas bloqueadas e dados incompletos
  nao sao tratados como novas oportunidades verificadas.
- O envio de um novo curriculo atualiza a referencia do perfil ativo e
  invalida fatos extraidos do arquivo anterior. Dados estruturados precisam
  ser revisados; o upload sozinho nao inventa cargos, datas ou idiomas.
- Busca nao envia candidaturas. Aprovacao, autorizacao, preparo e envio
  continuam separados. So uma confirmacao real pode marcar uma inscricao.

## GitHub e hospedagem

GitHub versiona codigo; nao hospeda o processo Node nem sincroniza o banco
particular. O workflow de validacao executa testes sem Gmail, curriculos ou
banco de candidaturas. Foi removida a antiga busca em ambiente descartavel,
que nao atualizava o painel e publicava um artefato com banco e logs.

Para continuar online, use o deploy Oracle existente em `deploy/oracle` e
armazenamento persistente para banco e arquivos. Os segredos ficam no ambiente
do servidor, nunca no repositorio. Preferencias de cada conta ficam no banco;
exportar a configuracao publica nao transfere dados pessoais, curriculo ou
senhas. Faca backup privado do volume e teste a restauracao.

Esta versao usa sql.js: mantenha **um unico processo escritor**. A busca do
painel agora roda no mesmo processo do servidor e chamadas repetidas do mesmo
usuario compartilham uma execucao. Nao execute CLI scan em paralelo ao servidor,
nem use varias replicas sobre o mesmo arquivo. Escala horizontal exige migrar
o armazenamento para um banco transacional de servidor.

Gmail e o arquivo legado `data/manual-urls.txt` locais pertencem exclusivamente
ao usuario definido por `CAREER_HUNTER_USER_ID` (padrao 1). Outras contas nao
devem usar as credenciais do proprietario. A busca nao contorna login, CAPTCHA
ou protecoes de plataformas.

## Verificacao

Execute `npm test` e `npm run lint` antes de publicar. Os testes cobrem parser
de anuncios, salario-base, preferencias, fontes parcialmente indisponiveis,
duplicatas, URLs privadas, curriculo ativo e exportacao sem arquivo pessoal.
