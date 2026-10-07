# IA nas editoras universitárias — UTFPR

Landing page de uma página para uma pesquisa institucional sobre práticas, orientações e percepções de IA generativa nas editoras universitárias. O formulário reúne dez perguntas numeradas, mantém os campos abertos das perguntas 07 e 08 e envia as respostas à aba `Respostas` de uma planilha Google por uma função server-side na Vercel.

O código está preparado para Vercel e Google Sheets. A publicação ainda depende da configuração das contas e das credenciais pelo responsável. A implantação do Apps Script é externa ao Git e não foi migrada nem desativada por este repositório.

## Perguntas

1. Nome da editora — texto obrigatório.
2. Instituição à qual a editora está vinculada — texto obrigatório.
3. Uso ou teste de IA generativa — escolha única.
4. Atividades em que a IA é usada ou testada — múltipla seleção; nomes das ferramentas em texto. Fica visível e mostra “Não se aplica” quando a resposta à pergunta 03 indicar que não se aplica.
5. Situação da política ou orientação formal — escolha única; link público opcional.
6. Orientação para o uso de IA por pareceristas — escolha única; restrições complementares quando aplicável.
7. Benefícios percebidos ou esperados — múltipla seleção e resposta aberta.
8. Principais preocupações — múltipla seleção e resposta aberta.
9. Prioridade futura — resposta aberta opcional.
10. Autorização para identificar a instituição em publicações — escolha única.

Os campos de detalhe fazem parte do grupo correspondente, não acrescentam números nem repetem perguntas. As respostas múltiplas “nenhum” e “não sei informar” são exclusivas. O endpoint valida as respostas e acrescenta uma linha com os 19 campos compatíveis com a planilha existente.

## Desenvolvimento local

Use Node.js 24.x, igual ao runtime configurado para a função Vercel.

```powershell
npm install
npm test
npm run dev
```

`npm run dev` inicia um servidor Node nativo na mesma origem para servir a página e `/api/submit`. Em produção, a Vercel publica a mesma rota como uma Vercel Function. O envio local requer as variáveis de ambiente descritas abaixo. Sem elas, a página abre normalmente, mas a API informa que não conseguiu registrar a resposta. A interface mantém os campos preenchidos quando ocorre uma falha.

## Preparar Google Sheets

1. No Google Cloud Console, crie ou escolha um projeto e habilite a **Google Sheets API**.
2. Crie uma **conta de serviço (service account)** exclusiva para o formulário e gere uma chave privada para ela. Não coloque a chave no HTML, no JavaScript do navegador, em commits ou em mensagens de chat.
3. Compartilhe somente a planilha de respostas com o e-mail da conta de serviço, dando a permissão **Editor**. Não torne a planilha pública.
4. Separe a URL da planilha e o ID, encontrado entre `/d/` e `/edit` no endereço da planilha.

## Configurar Vercel

Importe `Rykum/formulario_editoras` na Vercel usando a raiz do repositório como diretório do projeto. Não é necessário framework nem etapa de build.

Adicione estas variáveis no projeto Vercel para os ambientes **Preview** e **Production**:

| Variável | Valor |
| --- | --- |
| `GOOGLE_SHEETS_ID` | ID da planilha de respostas |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | E-mail da conta de serviço |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | Campo `private_key` da chave da conta de serviço; marque como variável **sensível (Sensitive)** |

Para desenvolvimento local, copie `.env.example` para `.env.local` e preencha esses valores localmente. Arquivos `.env` e `.env.*` (exceto `.env.example`) e a pasta `.vercel` estão excluídos do Git. Se a chave privada estiver em formato com `\\n`, a função converte os separadores para que a autenticação funcione.

Depois de salvar as variáveis, faça o deploy pela Vercel. A função `POST /api/submit` responde sucesso somente depois da confirmação da API Google; falhas não expõem mensagens internas ou credenciais.

## Organizar as respostas por editora

Mantenha a aba `Respostas` como base bruta, com o cabeçalho abaixo na linha 1 e os envios novos anexados ao final. Para uma consulta alfabética sem reordenar os dados brutos:

1. Crie uma aba chamada `Respostas organizadas`.
2. Copie o cabeçalho abaixo para a linha 1 dessa aba.
3. Cole em `A2` a fórmula a seguir. Ela ordena por editora (A–Z) e, para cada editora, mostra primeiro o envio mais recente.

```text
=IFERROR(SORT(FILTER(Respostas!A2:S,Respostas!A2:A<>""),3,TRUE,2,FALSE),"")
```

Em planilhas configuradas para português do Brasil, talvez seja necessário usar ponto e vírgula como separador de argumentos:

```text
=IFERROR(SORT(FILTER(Respostas!A2:S;Respostas!A2:A<>"");3;TRUE;2;FALSE);"")
```

Ordem das 19 colunas:

```text
ID | Enviado em | Editora | Instituição | Uso de IA | Atividades | Outra atividade | Política formal | Link da política | Orientação para pareceristas | Restrições para pareceristas | Outra restrição | Benefícios | Outro benefício | Preocupações | Outra preocupação | Prioridade futura | Autoriza identificação | Ferramentas de IA utilizadas ou avaliadas
```

## Verificação antes de divulgar

O código nesta branch ainda não confirma uma implantação Vercel nem uma gravação real na planilha. Depois de configurar as contas e publicar:

1. Faça um envio de teste com a editora `TESTE — remover depois`.
2. Confirme a mensagem de sucesso e verifique a mesma linha na aba `Respostas` e na visualização ordenada.
3. Remova somente a linha identificada como teste.
4. Troque o link divulgado pelo endereço Vercel. Se a equipe administra o projeto Apps Script antigo, retire a implantação anterior após confirmar a nova.

A pergunta sobre autorização trata somente da identificação da instituição em publicações desta pesquisa; ela não é apresentada como consentimento geral para outras finalidades.

## Arquivos do Apps Script legado

O diretório `apps-script/` preserva a implementação antiga como referência. Os arquivos locais correspondem a `Code.gs`, `Survey.gs`, `Index.html`, `Styles.html`, `Client.html` e `appsscript.json` no editor do Apps Script. A implantação daquele serviço é externa ao Git: alterar ou fazer deploy deste repositório não a atualiza nem a desativa.

Se a equipe precisar operar temporariamente a versão antiga, `setupSurveySpreadsheet()` cria ou prepara a aba `Respostas`. Para uma publicação antiga como aplicativo da web, a configuração era **Executar como** e selecione **Eu**; a opção de acesso anônimo depende das políticas do Google Workspace e das configurações administrativas da conta. Essas instruções são apenas de referência para o serviço legado e não configuram a função Vercel.

## Marca

O arquivo `public/utfpr-logo.png` usa a versão horizontal colorida disponibilizada na [página oficial da marca UTFPR](https://www.utfpr.edu.br/comunicacao/design/marca-da-utfpr/). A imagem local evita depender do servidor externo e aparece sobre a superfície clara do cabeçalho.

## Referências técnicas

- [Vercel Functions para Node.js](https://vercel.com/docs/functions/runtimes/node-js).
- [Google Sheets API — append de linhas](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values.append).
- [Google Identity — contas de serviço](https://developers.google.com/identity/protocols/oauth2/service-account).
- [Variáveis de ambiente sensíveis na Vercel](https://vercel.com/docs/environment-variables/sensitive-environment-variables).
