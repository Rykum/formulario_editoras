# Migração do formulário editorial para Vercel e Google Sheets

## Objetivo

Publicar a pesquisa sobre inteligência artificial generativa em editoras universitárias na Vercel e registrar cada resposta em uma planilha Google já administrada pela equipe. O formulário continua em português, em uma página, com visual limpo inspirado na identidade UTFPR e no máximo dez perguntas numeradas.

## Público e sucesso

Editoras universitárias devem conseguir responder sem conta Google. A equipe da pesquisa deve receber cada envio na planilha, com campos tabulares que permitam comparar respostas e uma visualização ordenada pelo nome da editora. Nenhuma chave ou credencial Google pode chegar ao navegador ou ser versionada no repositório.

## Abordagens consideradas

1. **Vercel estática + Vercel Function + Google Sheets API (escolhida).** O navegador envia JSON para `/api/submit`; a função valida a resposta e usa credenciais de conta de serviço guardadas no ambiente da Vercel para anexar uma linha à planilha. Mantém interface e backend no mesmo projeto e não depende do Apps Script para receber respostas.
2. **Vercel com Apps Script como ponte.** Reaproveita a função atual de gravação, mas preserva um serviço hospedado e autorizado pelo Apps Script, adicionando dependência entre duas plataformas e uma chamada externa.
3. **Manter o Apps Script.** Preserva a integração já existente, mas não atende ao objetivo explícito de migrar a publicação e o endpoint para Vercel.

A primeira opção foi escolhida por manter o envio no mesmo domínio da página e usar a integração oficial de append da Sheets API. A documentação da Vercel suporta funções Node.js no diretório `api`; a API Sheets oferece `spreadsheets.values.append`; contas de serviço acessam recursos compartilhados com elas. Fontes: [Vercel Functions para Node.js](https://vercel.com/docs/functions/runtimes/node-js), [Sheets API — append](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values.append) e [OAuth para contas de serviço](https://developers.google.com/identity/protocols/oauth2/service-account).

## Arquitetura e fluxo

- A raiz do projeto Vercel contém a página estática, os estilos e o JavaScript de interação, sem dependência de `HtmlService`, templates `include()` ou `google.script.run`.
- `POST /api/submit` aceita um objeto JSON. A função valida método, tamanho do corpo, honeypot, campos obrigatórios, limites de texto e valores de seleção no servidor; normaliza campos condicionais; e serializa a resposta segundo a ordem oficial das colunas.
- A função acrescenta exatamente uma linha em `Respostas` com a Sheets API e só responde sucesso depois da confirmação do Google. O envio usa valores tratados como texto para impedir que respostas virem fórmulas. A interface mantém os dados preenchidos quando ocorre erro e mostra confirmação somente após sucesso real.
- O navegador não recebe ID da planilha, e-mail de serviço, chave privada nem token OAuth. Configuração necessária na Vercel: `GOOGLE_SHEETS_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL` e `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`. A chave privada deve ser variável sensível; o arquivo local de ambiente fica fora do Git. A documentação da Vercel descreve variáveis sensíveis para valores secretos: [Sensitive environment variables](https://vercel.com/docs/environment-variables/sensitive-environment-variables).
- A conta de serviço precisa ter acesso de editor à planilha e a Google Sheets API precisa estar habilitada no projeto Google Cloud correspondente. O ID da planilha atual será configurado no ambiente; nenhum ID ou segredo é inventado ou salvo nesta especificação.
- `Respostas` é a fonte bruta, append-only, com o cabeçalho e os 19 campos compatíveis com o esquema já utilizado pelo Apps Script. Uma aba `Respostas organizadas` apresenta a mesma informação ordenada por editora (A–Z) e data (mais recente primeiro), para a leitura da equipe. Não se reescrevem as linhas brutas a cada envio, evitando corrida entre envios simultâneos.
- O código existente em `apps-script/` é mantido como referência histórica e para eventual retorno temporário. Após implantação e verificação do novo endpoint, a equipe deverá substituir o link divulgado pelo novo endereço Vercel; a implantação antiga não é desativada automaticamente por uma alteração no Git.

## Perguntas e respostas

O questionário tem exatamente dez grupos numerados:

1. **Nome da editora** — texto curto obrigatório.
2. **Instituição à qual a editora está vinculada** — texto curto obrigatório.
3. **Uso atual de IA generativa em atividades editoriais** — escolha única: sim, já utiliza; está testando; não utiliza nem testa; não sei informar.
4. **Atividades em que IA é usada ou testada** — seleção múltipla, aplicável quando a resposta anterior é “sim” ou “está testando”. Um campo de texto opcional, dentro do mesmo grupo, registra os nomes das ferramentas usadas ou avaliadas. “Outra atividade” abre um campo descritivo. Se a editora não usa IA ou não sabe informar, o grupo continua visível com a indicação “Não se aplica conforme a resposta anterior”, sem campos respondíveis.
5. **Situação da política ou orientação formal da editora** — escolha única: adotada e pública; adotada, mas não pública; em elaboração; não existe; não sei informar. Se pública, mostrar URL opcional como campo complementar da mesma pergunta.
6. **Orientação sobre IA por pareceristas** — escolha única: proibido; permitido com restrições; permitido sem restrições específicas; não há orientação; não sei informar. Se permitido com restrições, seleção múltipla de declaração de uso, proteção de originais/informações confidenciais e outra restrição, com descrição condicional.
7. **Benefícios percebidos ou esperados** — seleção múltipla entre agilidade/redução de tarefas repetitivas, apoio à revisão, tradução, acessibilidade, divulgação, redução de custos, outro, nenhum ou não sei informar. “Outro” abre texto opcional; “nenhum” e “não sei” são exclusivos.
8. **Principais preocupações** — seleção múltipla entre direitos autorais/plágio, erros/informações falsas, confidencialidade/proteção de dados, autoria/qualidade editorial, dependência tecnológica, uso não declarado, outra, nenhuma ou não sei informar. “Outra” abre texto opcional; “nenhuma” e “não sei” são exclusivos.
9. **Prioridade para o futuro** — resposta aberta opcional sobre a principal prioridade das editoras universitárias diante das mudanças no trabalho editorial.
10. **Autorização de identificação** — escolha obrigatória sim/não sobre identificar a instituição em publicações resultantes da pesquisa.

O campo de ferramentas, a URL de política, as descrições “outro” e as restrições de pareceristas são complementos dentro dos grupos correspondentes, não perguntas adicionais. Benefícios e preocupações continuam em grupos separados para permitir análises distintas. Os dez grupos e sua numeração permanecem visíveis e fixos em todas as respostas; controles complementares são habilitados ou substituídos por uma indicação “não se aplica” conforme a resposta anterior, sem criar lacunas ou renumerar perguntas.

## Interface e acessibilidade

- Uma página responsiva, com fundo claro, tipografia sem serifa reta, verde institucional como acento moderado e contraste legível. Usar a marca horizontal colorida oficial UTFPR em fundo claro, com texto alternativo; não usar versão preta sobre fundo escuro.
- Manter as seções de identificação, uso/orientações, percepções/prioridades e autorização; controles nativos de rádio e checkbox com `fieldset`/`legend`, rótulos associados, foco visível por teclado e mensagens de status em região `aria-live`.
- Animações de seleção curtas e discretas respeitam `prefers-reduced-motion`. O texto e a forma do estado selecionado permanecem perceptíveis sem depender só de cor ou movimento.
- Apresentar nota factual de que as respostas são registradas em planilha Google para análise. Não prometer anonimato, confidencialidade, retenção específica ou aprovação ética sem base aprovada pela equipe. A pergunta de autorização se refere à identificação da instituição em publicações; não deve ser apresentada como consentimento geral para usos diferentes.

## Validação, erros e segurança

- A validação do servidor é a autoridade; a validação HTML melhora a experiência, mas não substitui a validação da função.
- Rejeitar JSON malformado, corpos acima do limite definido na implementação, opções fora do conjunto permitido, seleção duplicada/contraditória e texto acima dos limites existentes em `apps-script/Survey.gs`.
- Ignorar submissões com honeypot preenchido e aceitar apenas `POST`. Erros devolvem HTTP adequado e uma mensagem compreensível sem expor exceções, credenciais ou detalhes internos; sucesso só é devolvido após a API confirmar a escrita.
- Usar `valueInputOption=RAW` no append e sanitizar texto compatível com a proteção atual contra fórmulas. Não registrar conteúdo de respostas em logs do servidor.
- A Vercel não herda o limitador de 60 minutos do Apps Script, que dependia de uma chave temporária de usuário. Nesta migração, não há bloqueio individual de um envio por editora nem garantia de resistência a automação; o honeypot e as validações são barreiras básicas. Adicionar rate limit persistente ou CAPTCHA requer serviço/configuração adicional e fica fora deste recorte.
- A conta de serviço recebe acesso apenas à planilha de respostas. A planilha não é tornada pública como consequência da publicação do formulário.

## Compatibilidade e publicação

- Preservar a ordem e semântica das 19 colunas atuais para permitir que registros antigos e novos permaneçam na mesma tabela. Campos que não se aplicam são gravados vazios; listas múltiplas são gravadas em texto delimitado de modo consistente.
- O envio no Apps Script atual grava diretamente na aba `Respostas`. A migração reutiliza a planilha e seus dados já existentes. A implantação Vercel deve ser testada com uma resposta identificada como teste e essa linha removida pela equipe após a conferência; só então o novo URL deve ser divulgado.
- O projeto Vercel será conectado ao repositório GitHub usando a conta da equipe. A criação/vinculação do projeto, armazenamento de credenciais, compartilhamento da planilha com a conta de serviço e publicação exigem acesso à conta Google/Vercel do proprietário; instruções para configuração não incluem pedir que o proprietário cole segredos no chat.
- Não afirmar que o site já está publicado até que exista uma URL de produção verificável e uma resposta de teste confirmada na planilha.

## Fora do escopo

- Painel administrativo, login, edição/exclusão de respostas, exportação, e-mail, CAPTCHA/rate limiter persistente, deduplicação automática de editoras ou migração de respostas para uma planilha nova.
- Desativar automaticamente uma implantação Apps Script externa existente. O link antigo só deve ser retirado quando a equipe confirmar a nova implantação.
- Expor, ler ou publicar dados de resposta em uma interface pública.

## Critérios de aceite

1. A página Vercel serve o formulário completo sem recursos do Apps Script.
2. Há exatamente dez perguntas numeradas e sempre visíveis; os detalhes de ferramentas e campos condicionais não aumentam a contagem nem criam duplicidade ou lacunas na numeração.
3. A página usa marca UTFPR legível em superfície clara, verde institucional com contraste suficiente, reduz movimento quando solicitado e funciona por teclado em tela pequena.
4. Submissão válida passa pela validação da Vercel Function, grava exatamente uma linha na aba `Respostas` e só então mostra sucesso.
5. A estrutura gravada mantém compatibilidade com as 19 colunas existentes, protege textos contra interpretação como fórmulas e não expõe credenciais no HTML, JavaScript ou Git.
6. A equipe encontra todas as respostas na aba bruta e uma visualização ordenada por editora e data na aba `Respostas organizadas`.
7. Falhas do serviço Google mantêm as respostas preenchidas e mostram erro útil, sem falso sucesso nem detalhes internos.
8. O guia explica criação/configuração do projeto Google Cloud e conta de serviço, permissões da planilha, variáveis Vercel, conexão GitHub, implantação e verificação de um envio de teste.

## Referências de redação e implementação

- [Pew Research Center — Writing Survey Questions](https://www.pewresearch.org/writing-survey-questions/) — redação clara, respostas equilibradas e evitar perguntas duplas.
- [GOV.UK Design System — Question pages](https://design-system.service.gov.uk/patterns/question-pages/) — coletar uma informação por vez e explicar perguntas.
- [W3C WAI — Grouping Controls](https://www.w3.org/WAI/tutorials/forms/grouping/) — agrupar controles relacionados com `fieldset` e `legend`.
- [Vercel — Node.js Functions](https://vercel.com/docs/functions/runtimes/node-js) — funções server-side para o endpoint.
- [Google Sheets API — append values](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values.append) — anexar uma resposta como linha.
- [Google Identity — service accounts](https://developers.google.com/identity/protocols/oauth2/service-account) — autenticação de servidor para servidor.
- [Vercel — Sensitive environment variables](https://vercel.com/docs/environment-variables/sensitive-environment-variables) — armazenamento de segredos da função.
