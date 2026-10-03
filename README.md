# RX Vistorias

Aplicativo web da **RX Engenharia e Projetos** para vistorias técnicas de recebimento de imóveis após construção ou reforma.

Empresa: A X Campelo Engenharia · CNPJ 66.476.617/0001-96.

## Acessar no celular ou tablet

App publicado: https://vistoria-imoveis-recebimento.aristotelescampelo.chatgpt.site

Abra no Chrome, entre com sua conta e use o menu **Instalar aplicativo** ou **Adicionar à tela inicial**. As vistorias e imagens são salvas no servidor; o app precisa de conexão para salvamento e carregamento.

## Recursos

- Cadastro com e-mail e senha, login e saída da conta.
- Perfil profissional individual com nome, CREA/UF, RNP e telefone.
- Vistorias e fotos isoladas por conta, com autorização em todas as APIs.
- Nome, CREA e RNP preenchidos pelo perfil ao criar uma vistoria.
- Alteração de senha com encerramento das sessões nos outros aparelhos.

- Empreendimento, tipo de imóvel, endereço, área construída, cliente e construtora.
- Identificação do responsável técnico, CREA, RNP e ART.
- Checklist por ambiente com OK, NC e N/A.
- Descrição da não conformidade, localização e correção recomendada.
- Catálogo com 22 referências, filtro por serviço e problema, busca por número ou palavra e resumos para seleção rápida. Consulte as fontes e o escopo em [docs/NORMAS.md](docs/NORMAS.md).
- Até 10 referências normativas por não conformidade, com norma, edição, item/seção e fundamentação técnica, incluídas no relatório e no PDF. O responsável técnico registra as referências consultadas e confirma sua aplicabilidade; o app não atribui infrações automaticamente.
- Câmera ao vivo, captura, prévia, confirmação e seleção de fotos da galeria.
- Relatórios em PDF com registros fotográficos e conteúdo técnico.
- Identidade visual RX compartilhada: logo do relatório, imagem do app e rodapé; alterações somente pelo titular da RX.
- Copyright da RX no app e nos relatórios.

## Armazenamento

Este repositório guarda o código do aplicativo. Vistorias e metadados são armazenados em Cloudflare D1; fotos e imagens da empresa em R2, vinculados ao site publicado. O repositório não contém dados de clientes, fotos de vistorias, documentos usados como referência, credenciais ou cópias do banco de produção.

O GitHub Pages serve arquivos estáticos. Este aplicativo usa APIs e armazenamento no servidor e deve ser executado em um ambiente compatível com Cloudflare Workers, D1 e R2, como o site acima.

## Desenvolvimento local

Requisitos: Node.js 22 ou superior e npm. Instale e construa:

```sh
npm ci
npm run build
```

Aplique cada arquivo SQL de `drizzle/` uma única vez, na ordem, ao banco local. Por exemplo:

```sh
npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_lean_vector.sql
npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_wonderful_screwball.sql
npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0002_tidy_giant_girl.sql
```

Inicie o app local:

```sh
npx wrangler dev --local --config dist/server/wrangler.json --persist-to .wrangler/state
```

O navegador precisa de HTTPS, ou `localhost`, para acessar a câmera. A permissão é solicitada ao selecionar **Tirar foto**. O aplicativo pede apenas vídeo e encerra a câmera após capturar ou cancelar.

`src/auth-server.js` implementa autenticação e sessões; `src/auth.js` contém as telas de acesso e perfil; `src/worker.js` implementa as APIs; `src/app.js` contém a interface; `src/camera.js` controla a captura; `src/brand.js` gerencia a identidade visual; `src/pdf.js` gera os relatórios. O build incorpora esses arquivos em `dist/server/index.js`.

As migrações de banco já aplicadas devem ser preservadas. Gere uma nova migração com `npm run db:generate` ao alterar o esquema em `db/schema.ts`.

## Acesso e configuração do titular

Quem receber o link público escolhe **Criar cadastro** no primeiro acesso ou **Entrar** para usar sua conta existente. O aplicativo não exige conta ChatGPT para esse cadastro. O e-mail é o identificador de acesso e não é verificado por envio de mensagem. Não há recuperação automática de senha por e-mail nesta versão.

Consulte [docs/AUTENTICACAO.md](docs/AUTENTICACAO.md) para configuração segura da conta titular, migração das vistorias anteriores e detalhes de armazenamento de credenciais. Valores de produção ficam no ambiente de hospedagem, fora do código e do GitHub.

## Direitos autorais

© 2026 RX Engenharia e Projetos · A X Campelo Engenharia · CNPJ 66.476.617/0001-96. Todos os direitos reservados.

Os componentes de terceiros preservam suas próprias licenças.
