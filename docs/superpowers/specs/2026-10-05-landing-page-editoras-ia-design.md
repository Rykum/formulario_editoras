# Landing page de pesquisa sobre IA em editoras universitárias

## Objetivo

Criar uma landing page em português, responsiva e minimalista, que apresente uma pesquisa sobre o uso de inteligência artificial generativa em editoras universitárias e permita responder a um questionário de no máximo dez perguntas. Cada envio deve ser registrado em uma planilha Google, em uma nova linha, com as respostas ordenadas pelo nome da editora.

## Público e uso

O público são editoras universitárias convidadas a responder à pesquisa. A página será pública e não exigirá que respondentes entrem em uma conta Google. A pesquisa terá um formulário de página única dividido em seções curtas.

## Conteúdo do formulário

O formulário terá dez grupos de perguntas:

1. **Nome da editora** — texto curto, obrigatório.
2. **Instituição à qual a editora está vinculada** — texto curto, obrigatório.
3. **Uso atual de IA generativa em atividades editoriais** — escolha única: sim; em fase de testes; não; não sei informar.
4. **Atividades em que IA é utilizada ou testada** — caixas de seleção, exibidas se a resposta anterior for sim ou em fase de testes. Opções: elaboração ou revisão de textos; tradução; resumos ou metadados; imagens ou diagramação; acessibilidade; verificação de originalidade; apoio editorial; comunicação ou divulgação; outra.
5. **Situação da política formal da editora sobre IA** — escolha única: adotada e pública; adotada, mas não pública; em elaboração; não existe; não sei informar. Exibir um campo de URL opcional quando a opção pública for escolhida.
6. **Orientação da editora sobre o uso de IA por pareceristas** — escolha única: proibido; permitido com restrições; permitido sem restrições específicas; não há orientação; não sei informar. Se a opção com restrições for escolhida, mostrar caixas para indicar quais se aplicam: declarar o uso; não inserir originais ou informações confidenciais em ferramentas públicas; outra restrição. Esses detalhes complementam a mesma pergunta.
7. **Benefícios percebidos ou esperados** — caixas de seleção: agilidade; apoio à revisão; tradução; acessibilidade; divulgação; redução de custos; outros; nenhum; não sei informar.
8. **Principais preocupações** — caixas de seleção: direitos autorais ou plágio; erros ou informações falsas; confidencialidade ou proteção de dados; autoria ou qualidade editorial; dependência tecnológica; uso não declarado; outros; nenhuma; não sei informar.
9. **Prioridade para o futuro** — texto longo opcional: “Qual deve ser a principal prioridade para as editoras universitárias diante das mudanças que a IA pode trazer ao trabalho editorial nos próximos anos?”
10. **Autorização de identificação** — escolha obrigatória sim/não: “A editora autoriza que sua instituição seja identificada em publicações resultantes desta pesquisa?”

As perguntas 4 e 5 têm campos condicionais vinculados à resposta principal; não introduzem novos grupos de pergunta. Listas de benefícios e preocupações permanecem separadas para permitir análise distinta. A situação da política formal e as regras para pareceristas também permanecem separadas: uma mede a existência e a disponibilidade da política; a outra, uma orientação editorial específica.

## Experiência e aparência

- Título: “Pesquisa sobre o uso de IA nas editoras universitárias”.
- Introdução curta que explica o propósito da pesquisa e informa que as respostas serão registradas em uma planilha Google para análise.
- Página única com seções: identificação; uso e orientações; percepções e prioridades; autorização de identificação.
- Visual editorial sóbrio e minimalista: fundo claro, texto escuro, uma cor de destaque discreta, largura de leitura confortável e sem imagens decorativas genéricas.
- Layout de coluna única em telas pequenas, campos e controles com rótulos visíveis, grupos de seleção acessíveis e foco de teclado evidente.
- Mensagens claras de envio, sucesso e erro. A interface só confirma sucesso depois de o servidor informar que o registro foi gravado.
- Não afirmar anonimato, confidencialidade ou aprovação ética, pois esses termos não foram especificados para a pesquisa.

## Planilha e integração

A interface será servida por um Google Apps Script Web App. O cliente chamará uma função server-side com `google.script.run`; o servidor validará os dados e gravará uma resposta por linha em uma planilha Google. Essa abordagem mantém a interface e a gravação no mesmo ambiente Apps Script e não depende de uma API externa com credenciais no navegador.

Uma função de configuração autorizada pelo proprietário criará uma planilha intitulada “Pesquisa sobre IA nas editoras universitárias”, com uma aba “Respostas”. A aba terá cabeçalho congelado, filtro e colunas para data e hora, editora, instituição, uso de IA, atividades, situação da política, link público, orientação para pareceristas, benefícios, preocupações, prioridade futura e autorização de identificação. Após cada envio, as linhas serão ordenadas pelo nome da editora e pela data de envio, mantendo respostas repetidas da mesma editora próximas e preservando cada envio como histórico separado.

O Web App será publicado para acesso público e executado como a conta proprietária para poder gravar na planilha sem pedir login a cada editora. O proprietário deverá autorizar o acesso inicial e publicar a implantação. A disponibilidade de acesso anônimo pode depender das políticas da conta Google Workspace usada para publicar.

## Validação e proteção de dados

- Validar no servidor as opções fechadas, os campos obrigatórios e limites de tamanho para respostas abertas.
- Não confiar em validação exclusivamente no navegador.
- Tratar as respostas como texto, evitando que conteúdo enviado seja interpretado como fórmula na planilha.
- Usar bloqueio de concorrência durante a gravação para evitar colisão entre envios simultâneos.
- Incluir um campo antispam invisível e ignorar envios preenchidos nele.
- Exibir uma nota objetiva sobre a gravação das respostas na planilha; não prometer retenção, anonimato ou acesso restrito sem instruções específicas.

## Fora do escopo

- Cadastro de respondentes, autenticação, envio de e-mails, upload de arquivos, dashboards de resultados ou exportação de relatórios.
- Publicação em domínio próprio ou provisionamento de uma conta Google.
- Regras separadas para direitos autorais de imagens e identificação automatizada de conteúdo gerado por IA; esses temas poderão aparecer nas opções de preocupação e nas respostas abertas sem aumentar o número de perguntas.

## Critérios de aceite

1. A página mostra exatamente dez grupos de pergunta, em português, com a redação definida neste documento.
2. A pergunta sobre atividades só aparece para quem informa uso atual ou testes de IA.
3. A pergunta sobre URL só aparece quando a política é pública.
4. Seleções de múltipla escolha aceitam várias opções e oferecem alternativas “nenhum/não sei” sem obrigar respostas inventadas.
5. Um envio válido produz exatamente uma nova linha na planilha e é ordenado junto às respostas da mesma editora.
6. Valores inválidos ou envios que falham não são apresentados como enviados com sucesso.
7. A página funciona em layouts móveis e pode ser preenchida por teclado.
8. As respostas e consentimento são preservados como enviados, sem substituir respostas anteriores.

## Referências consultadas

- [Pew Research Center: Writing Survey Questions](https://www.pewresearch.org/writing-survey-questions/) — evitar perguntas que misturem aspectos diferentes e escolher opções de resposta adequadas.
- [GOV.UK Design System: Question pages](https://design-system.service.gov.uk/patterns/question-pages/) — perguntar cada informação uma única vez, deixar claro por que ela é solicitada e oferecer “não sei” quando for uma resposta válida.
- [W3C WAI: Grouping Controls](https://www.w3.org/WAI/tutorials/forms/grouping/) — agrupar controles relacionados com `fieldset` e `legend`.
- [Google Apps Script: HTML Service communication](https://developers.google.com/apps-script/guides/html/communication) — chamada assíncrona do navegador a funções server-side por `google.script.run`.
- [Google Apps Script: Web Apps](https://developers.google.com/apps-script/guides/web) e [Sheet.appendRow](https://developers.google.com/apps-script/reference/spreadsheet/sheet#appendRow(Object)) — publicação do Web App e gravação de novas linhas na planilha.
