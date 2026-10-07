# Pesquisa sobre IA nas editoras universitárias

Landing page responsiva para uma pesquisa institucional sobre o uso de inteligência artificial generativa em editoras universitárias. O formulário reúne onze perguntas, valida as respostas no servidor e registra cada envio em uma nova linha de uma planilha Google, agrupando as respostas pelo nome da editora.

## Arquivos do Apps Script

| Arquivo local | Tipo no editor do Apps Script |
| --- | --- |
| `Code.gs` | Script |
| `Survey.gs` | Script |
| `Index.html` | HTML |
| `Styles.html` | HTML |
| `Client.html` | HTML |
| `appsscript.json` | Manifesto do projeto |

O formulário reúne as onze perguntas em quatro seções: identificação da editora; uso e orientações sobre IA; percepções e prioridades; e autorização de identificação em publicações. A pergunta 4 registra os nomes das ferramentas utilizadas ou avaliadas. As perguntas sobre benefícios e preocupações combinam seleções com campos opcionais de texto. Campos condicionais aparecem conforme as respostas.

## Marca e tipografia

O cabeçalho usa a versão horizontal colorida da marca, servida pela [página oficial da UTFPR](https://www.utfpr.edu.br/comunicacao/design/marca-da-utfpr/). A pilha tipográfica prioriza Futura MD BT, indicada no [manual de identidade visual da UTFPR](https://www.utfpr.edu.br/comunicacao/design/manual-de-uso-da-identidade-visual-da-utfpr/), e usa fontes sans-serif alternativas quando ela não está disponível.

## Configurar a planilha e o formulário

1. Acesse [script.google.com](https://script.google.com/) com a conta Google que será proprietária da pesquisa e crie um **Novo projeto** independente.
2. No editor, crie os arquivos `Code.gs` e `Survey.gs` como arquivos de script. Crie `Index.html`, `Styles.html` e `Client.html` como arquivos HTML. Copie o conteúdo de cada arquivo local para o arquivo homônimo no projeto.
3. Para configurar o manifesto, abra **Configurações do projeto**, marque **Mostrar o arquivo de manifesto `appsscript.json` no editor** e substitua o conteúdo pelo arquivo `apps-script/appsscript.json` deste repositório. Salve o projeto. Ele usa o runtime V8 e o fuso `America/Sao_Paulo`; os escopos de acesso à planilha são detectados pelo Apps Script a partir do código.
4. No seletor de funções, escolha `setupSurveySpreadsheet()` e clique em **Executar**. Na primeira execução, revise e autorize as permissões solicitadas. A função cria a planilha **Pesquisa sobre IA nas editoras universitárias**, com uma aba **Respostas**, cabeçalho congelado e filtro. A execução também retorna e registra a URL da planilha. Se a planilha já existir, a função acrescenta a nova coluna de ferramentas ao final, preservando a posição dos dados antigos.
5. Abra **Registro de execução** no editor após rodar a função e copie a linha `URL da planilha de respostas: ...`. Guarde esse link para analisar as respostas; não é necessário inserir o ID da planilha no código do navegador.

## Implantar como aplicativo da web

1. No canto superior direito do Apps Script, selecione **Implantar > Nova implantação** e escolha o tipo **App da web**.
2. Em **Executar como**, selecione **Eu** (a conta proprietária). Assim, os envios usam a autorização do proprietário para gravar na planilha, sem pedir que cada editora acesse a planilha.
3. Em **Quem pode acessar**, escolha a opção mais ampla que a conta permitir. Para receber respostas sem exigir login Google, essa opção precisa permitir acesso anônimo. O acesso anônimo depende das políticas do Google Workspace e das configurações administrativas da conta; se não estiver disponível, não divulgue o link como formulário sem login.
4. Clique em **Implantar**, conclua a autorização solicitada e copie o URL do app da web. Abra o link em uma janela privada ou em outra conta para confirmar que a página carrega conforme a configuração de acesso escolhida.

> A implantação como proprietário permite que qualquer pessoa com acesso ao link acione o código autorizado a gravar na planilha. O servidor usa a chave temporária do usuário do Apps Script para limitar uma resposta por chave a cada 60 minutos; essa chave não revela a identidade nem coleta o e-mail. O intervalo reduz envios repetidos, mas não impede automação coordenada ou o uso de várias contas. Compartilhe o URL somente com o público previsto e revise as permissões da própria planilha na conta proprietária. O formulário não promete anonimato nem define retenção de dados.

## Verificação de um envio

1. Faça um envio de teste identificando o nome da editora como `TESTE — remover depois`.
2. Aguarde a confirmação exibida pela página e abra a aba **Respostas** da planilha.
3. Confirme que uma nova linha foi criada e ficou junto às linhas com o mesmo nome de editora, ordenada pela data mais recente. Esse envio também confirma que a implantação consegue obter a chave temporária usada para o limite de repetição.
4. Apague manualmente somente a linha que você identificou como teste.

As respostas anteriores permanecem como linhas independentes. A planilha ordena por editora (A–Z) e, dentro de cada editora, pelos envios mais recentes primeiro.

## Testes locais

Com Node.js 22 ou mais recente, execute na raiz do repositório:

```powershell
node --test tests/*.test.js
```

Os testes cobrem validação no servidor, serialização segura para o Sheets, armazenamento, ordenação, regras condicionais do formulário e o manifesto de implantação.

## Referências oficiais

- [Apps Script: publicar um aplicativo da web](https://developers.google.com/apps-script/guides/web) — modos de execução, acesso e implantação.
- [Apps Script: manifesto do projeto](https://developers.google.com/apps-script/manifest) — opções de runtime e fuso horário.
- [Apps Script: registro de execução](https://developers.google.com/apps-script/guides/logging) — consulta de mensagens `Logger` e `console` no editor.
- [Apps Script: comunicação com HTML Service](https://developers.google.com/apps-script/guides/html/communication) — chamadas do navegador para funções do Apps Script.
- [Apps Script: Session](https://developers.google.com/apps-script/reference/base/session) — chave temporária que identifica um usuário sem revelar sua identidade.
- [Apps Script: Cache Service](https://developers.google.com/apps-script/reference/cache) — armazenamento temporário usado pelo intervalo de envios.
