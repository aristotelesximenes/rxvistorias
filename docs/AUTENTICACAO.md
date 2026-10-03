# Cadastro, perfis e privacidade

Cada profissional cria uma conta com e-mail e senha de 6 a 128 caracteres, sem exigir símbolos, maiúsculas ou combinação de letras e números. Senhas somente com números, somente com letras ou com ambos são aceitas. O perfil guarda nome profissional, CREA/UF, RNP e telefone opcional. Novas vistorias recebem esses dados; registros anteriores mantêm sua identificação histórica. O cadastro não valida registro profissional nem verifica a propriedade do e-mail por mensagem.

## Autorização

O servidor determina o usuário pela sessão. Campos de proprietário e papel enviados pelo navegador são ignorados. Listagem, atualização, upload, leitura e exclusão de fotos exigem que `inspections.owner_id` corresponda ao usuário autenticado. Vistorias e fotos de outra conta retornam 404. Nem o administrador pode ler vistorias dos outros engenheiros. A marca RX e seus arquivos são compartilhados; apenas o titular pode substituir imagens da empresa.

A migração `0002_tidy_giant_girl.sql` cria contas, sessões e controle de tentativas, e adiciona o proprietário às vistorias existentes. Ela preserva documentos, fotos e versões. Registros anteriores ficam sem proprietário e invisíveis aos cadastros comuns até a ativação exclusiva do titular.

## Ativação do titular

Configure no ambiente de execução, nunca no repositório:

- `RX_OWNER_EMAIL`: e-mail reservado à conta titular.
- `RX_OWNER_NAME`: nome profissional inicialmente sugerido.
- `RX_OWNER_SETUP_HASH`: SHA-256 hexadecimal de um token aleatório de 32 bytes.

O token original é entregue somente ao titular no fragmento `#ativar=TOKEN` do endereço do app. Fragmentos não são enviados como parte do endereço HTTP; o app remove esse fragmento do histórico ao abrir a ativação e envia o token por POST. Não publique o link exclusivo, token, hash ou senha. A página de ativação preenche o nome e recupera CREA/RNP das vistorias anteriores. O titular escolhe a própria senha no formulário.

O cadastro desse e-mail exige o token. A criação da conta titular e a vinculação das vistorias anteriores ocorrem na mesma transação D1. O e-mail possui índice único; após a criação da conta, o link não permite outra ativação. O primeiro cadastro comum nunca recebe dados antigos ou acesso de administrador. Sem essas variáveis, novos profissionais ainda podem cadastrar contas isoladas, mas o cadastro de administrador e a migração de dados antigos não acontecem.

Para testar localmente, coloque apenas valores de teste em `dist/server/.dev.vars`, que é ignorado pelo Git. Para outro ambiente de produção, gere um token novo e configure as três variáveis como segredos do serviço de hospedagem.

## Senhas e sessões

Senhas não são armazenadas em texto puro nem em armazenamento do navegador. São derivadas com PBKDF2-HMAC-SHA-256, sal aleatório de 32 bytes por senha, 100.000 iterações (limite do WebCrypto no Cloudflare Workers) e resultado de 256 bits. Login inválido faz a mesma derivação para contas inexistentes. Tentativas de cadastro, login, ativação e alteração de senha têm limite persistente no D1.

A sessão usa token aleatório de 32 bytes. Somente seu SHA-256 fica no banco. Em HTTPS, o cookie usa o prefixo `__Host-`, `HttpOnly`, `Secure`, `SameSite=Strict` e caminho `/`; desenvolvimento HTTP local usa outro nome de cookie. Sessões expiram em 14 dias. Sair revoga a sessão atual; alterar senha exige a senha atual e revoga todas as sessões anteriores, emitindo uma nova para o aparelho atual.

As APIs verificam origem nas alterações, não habilitam CORS e não permitem cache de fotos ou dados pessoais. Não existe envio de e-mail nem recuperação automática de senha nesta versão. Não use o token de ativação como método de recuperação.

## Verificação realizada

Contas de teste separadas foram usadas para confirmar ausência de acesso anônimo, listagem isolada, impossibilidade de alterar ou anexar fotos na vistoria de outro profissional, leitura/exclusão de foto alheia, isolamento do perfil, prevenção de elevação de papel pelo cadastro, bloqueio de origem cruzada, revogação das sessões ao trocar senha, saída da conta e ativação reservada das vistorias antigas. Também foram verificados preenchimento pelo perfil, captura pela câmera e relatório em PDF no celular e no tablet.
