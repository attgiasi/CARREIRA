# Publicar o Ápice na Oracle Cloud Always Free

Este guia coloca o painel online com HTTPS, banco persistente e atualização pelo GitHub. Nenhum currículo, token ou banco é publicado no repositório.

## Arquitetura

```text
Internet -> HTTPS/Caddy -> Ápice/Node.js -> volumes privados
                                      |-> jobs.sqlite
                                      |-> currículos enviados
                                      |-> materiais gerados
                                      |-> logs
```

## 1. Criar a VM gratuita

No Console da Oracle Cloud, abra **Compute > Instances > Create instance**.

Use estas escolhas:

- nome: `apice-carreira`;
- região: a **Home Region** da conta;
- imagem: Ubuntu 24.04 ou Ubuntu 22.04 marcada como elegível;
- shape preferido: `VM.Standard.A1.Flex`, marcado como **Always Free eligible**;
- recursos: 1 OCPU e 6 GB de memória são suficientes para o Ápice;
- alternativa: `VM.Standard.E2.1.Micro` se o A1 estiver sem capacidade;
- boot volume: 50 GB, sem aumentar o desempenho pago;
- rede: VCN e subnet públicas, com IPv4 público;
- SSH: gere ou envie uma chave pública e guarde a chave privada com segurança.

Antes de confirmar, confira se o resumo mostra **Always Free eligible** e nenhum custo mensal estimado.

## 2. Abrir somente as portas necessárias

Na Security List ou Network Security Group da VM, adicione regras TCP de entrada:

| Porta | Origem | Uso |
|---|---|---|
| 22 | seu IP público `/32` | administração por SSH |
| 80 | `0.0.0.0/0` | emissão e redirecionamento HTTPS |
| 443 | `0.0.0.0/0` | painel HTTPS |

Não exponha a porta `8788`; ela permanece na rede privada do Docker.

## 3. Instalar a base

Conecte-se à VM:

```bash
ssh -i sua-chave.key ubuntu@IP_PUBLICO
```

Clone o repositório e execute o instalador:

```bash
git clone https://github.com/attgiasi/CARREIRA.git /tmp/apice-install
cd /tmp/apice-install
sudo bash deploy/oracle/bootstrap.sh
```

O instalador configura Docker, Compose, firewall local, repositório em `/opt/apice` e gera uma chave privada para o cofre de contas.

Saia e conecte novamente para que seu usuário receba acesso ao Docker:

```bash
exit
ssh -i sua-chave.key ubuntu@IP_PUBLICO
```

## 4. Configurar endereço e segredos

Para um endereço gratuito, transforme o IP público em um domínio `sslip.io`.

Exemplo:

```text
IP: 203.0.113.10
APICE_DOMAIN: apice.203-0-113-10.sslip.io
```

Edite o arquivo privado:

```bash
sudo nano /opt/apice/deploy/oracle/.env.production
```

Preencha no mínimo:

```env
APICE_DOMAIN=apice.203-0-113-10.sslip.io
ACCOUNT_VAULT_KEY=valor_gerado_pelo_instalador
ALLOW_PUBLIC_REGISTRATION=false
```

Adicione OpenAI, Gemini, Google Search e Gmail apenas se desejar. O arquivo tem permissão `600`, não entra no Git e não deve ser enviado em capturas de tela.

Para Gmail online, cadastre no Google Cloud o redirecionamento HTTPS correspondente ao domínio configurado.

## 5. Subir o painel

```bash
cd /opt/apice/deploy/oracle
./update.sh
```

Verifique:

```bash
docker compose --env-file .env.production ps
docker compose --env-file .env.production logs --tail=100 app
```

Abra:

```text
https://SEU_APICE_DOMAIN
```

A primeira conta criada será administradora. Depois dela, cadastros permanecem fechados enquanto `ALLOW_PUBLIC_REGISTRATION=false`. Para liberar novos usuários, altere para `true` e execute:

```bash
docker compose --env-file .env.production up -d
```

## 6. Atualização automática pelo GitHub

O workflow `.github/workflows/deploy-oracle.yml` pode atualizar a VM a cada `push` na branch `main`.

No GitHub, abra **Settings > Secrets and variables > Actions** e crie:

- `ORACLE_HOST`: IP público da VM;
- `ORACLE_USER`: `ubuntu`;
- `ORACLE_SSH_KEY`: conteúdo completo da chave privada usada na VM.

Depois, execute o workflow **Deploy Oracle** manualmente uma vez e crie a variável
de repositório `ORACLE_DEPLOY_ENABLED` com o valor `true`. Até essa variável existir,
cada envio para `main` valida o projeto, mas não tenta acessar uma máquina ainda não
configurada. Com ela ativa, os novos envios passam por lint e testes antes da atualização.

## 7. Backup

Crie um backup manual:

```bash
cd /opt/apice/deploy/oracle
./backup.sh
```

Os arquivos ficam em `deploy/oracle/backups/`, são ignorados pelo Git e backups com mais de 14 dias são removidos pelo script.

Agendamento diário opcional:

```bash
(crontab -l 2>/dev/null; echo '20 3 * * * /opt/apice/deploy/oracle/backup.sh >> /opt/apice/deploy/oracle/backup.log 2>&1') | crontab -
```

## 8. Comandos úteis

```bash
# Estado
docker compose --env-file .env.production ps

# Logs
docker compose --env-file .env.production logs -f --tail=200

# Reiniciar
docker compose --env-file .env.production restart

# Atualizar do GitHub
./update.sh

# Parar sem apagar dados
docker compose --env-file .env.production down
```

Não use `down -v`: a opção `-v` apagaria os volumes persistentes.
