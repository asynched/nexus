# nexus — A web, sem distrações.

Interface de pesquisa independente em português com SvelteKit 3, Svelte 5, Tailwind CSS 4 e Lucide, movida por SearXNG. Identidade em verde-floresta, marfim e lima, monograma N próprio e tipografia Geist hospedada localmente.

## Identidade visual

- Marca: **nexus**, sempre em minúsculas. SearXNG identifica a tecnologia, não o nome do aplicativo.
- Símbolo: duas hastes conectadas por uma faixa diagonal, formando um N. O desenho vetorial substitui a lupa genérica e se mantém legível em tamanhos pequenos.
- O símbolo na interface e o favicon da aba acompanham a paleta e o modo claro/escuro, inclusive ao recarregar. O desenho permanece o mesmo, com contraste verificado nas dez combinações. Os ícones instaláveis e a imagem de compartilhamento mantêm as cores oficiais da marca.
- Cores principais: floresta `#173e35`, marfim `#f4f7ec` e lima `#c9e88e`.
- Fonte dos ícones: `static/favicon.svg`. Configuração da marca: `src/lib/brand.ts`. Componente compartilhado: `src/lib/components/BrandMark.svelte`.
- Ícones PNG (16, 32, 180, 192 e 512 px), versão maskable e imagem de compartilhamento ficam em `static/brand/`. O manifest e os metadados usam a nova identidade.

Para regenerar os arquivos a partir do SVG, sem serviço externo ou dependências adicionais:

```sh
bunx playwright install chromium
bun run brand:generate
```

## Executar

```sh
bun install
cp .env.example .env
bun run dev --host 0.0.0.0
```

### Configurar a instância de pesquisa

Defina `SEARXNG_URL` no `.env` local ou no ambiente do servidor em produção:

```dotenv
SEARXNG_URL=https://search.asynched.tech/
```

O padrão, quando a variável estiver ausente ou vazia, continua sendo `https://search.asynched.tech/`. A configuração é declarada em `src/env.ts` e lida em runtime via `$app/env/private` (SvelteKit 3): não precisa de prefixo `PUBLIC_`, não é enviada ao navegador e não pode ser alterada por parâmetros da pesquisa. Reinicie o processo após mudar o ambiente.

Use uma URL base HTTP(S), com prefixo de proxy opcional (por exemplo, `http://searxng:8080/` ou `https://example.com/searxng/`). Uma URL terminada em `/search` também é aceita. A instância deve permitir respostas JSON (`format=json`). URLs com credenciais, query string ou fragmento são rejeitadas; use um proxy ou configuração de rede para autenticação. O `.env` não é versionado; `.env.example` contém apenas um exemplo público.

### Fontes de pesquisa e bloqueios

Na categoria **Tudo**, sem filtro de buscador, o nexus consulta os mecanismos habilitados por padrão no SearXNG e acrescenta **Bing e Yahoo** à mesma requisição. Isso evita depender apenas do Brave quando Google CSE e DuckDuckGo estão bloqueados. Muitas instalações SearXNG incluem Bing e Yahoo, mas os deixam desativados nas pesquisas padrão.

Para personalizar essas fontes adicionais no ambiente de runtime:

```dotenv
SEARXNG_EXTRA_ENGINES=bing,yahoo
```

O valor é uma lista de nomes de engines separados por vírgula. Defina `SEARXNG_EXTRA_ENGINES=` para respeitar somente os padrões da instância. Essas adições não afetam imagens, vídeos, notícias nem pesquisas com um buscador específico. O filtro **Google** consulta `google` e `google cse` (nas imagens, `google images` e `google cse images`), sem substituí-los silenciosamente por outros provedores.

O nexus mostra as fontes indisponíveis e distingue CAPTCHA, limite de requisições, acesso negado e timeout. Esses bloqueios ocorrem entre o SearXNG e os buscadores, não no navegador: o frontend não consegue removê-los. Para restaurar Google/DuckDuckGo, revise a configuração da instância e a reputação/limitação do IP de saída, aguarde o período de suspensão ou use uma integração de API autorizada. Evite repetir consultas automaticamente, pois isso pode prolongar o bloqueio.

Para diagnosticar a instância diretamente, consulte `/config` para ver os mecanismos e `/search?q=Brazil&format=json&categories=general&engines=bing,yahoo`. Compare `results[].engines` e `unresponsive_engines`; selecionar somente `engines=google,google%20cse`, sem `categories`, permite isolar a família Google.

## Recursos

- Busca real em uma instância SearXNG configurável por `SEARXNG_URL`, via servidor SvelteKit.
- Resultados web, imagens, vídeos e notícias, com paginação.
- Seis filtros por pesquisa: período, idioma, pesquisa segura, buscador, domínio e formato de arquivo. Podem ser preparados na página inicial, combinados e removidos individualmente. Os filtros ficam na URL e acompanham paginação e troca de categoria; formato de arquivo é exclusivo da categoria Tudo.
- Busca por Brave, DuckDuckGo, Google ou Bing, usando os nomes reais dos engines configurados na instância.
- Selects próprios e consistentes, com navegação por setas, Home/End, busca por digitação, Escape e menus na top layer do navegador (inclusive dentro de diálogos).
- Favicons reais nos resultados, obtidos pelo servidor com cache de 24 horas, requisições deduplicadas, limite de tamanho e fallback para a inicial do domínio.
- Sugestões e correções retornadas pelo SearXNG.
- Aparência personalizável: fontes do sistema, Geist (sans), Source Serif 4 (serifada, com ajuste óptico) e JetBrains Mono; paletas Regular, GitHub, Ayu, Dracula e Gruvbox, cada uma com versões claras e escuras.
- Modos claro, escuro e sistema; cantos retos, suaves ou arredondados; bordas ausentes, discretas ou marcadas; sombras opcionais.
- Prévia ao vivo, restauração do padrão, persistência sem flash inicial e sincronização entre abas. A identidade da marca mantém sua tipografia.
- Idioma, pesquisa segura e abertura em nova aba.
- Atalhos `/` e `Ctrl/Cmd + K`, diálogos nativos e navegação por teclado.
- Estados de carregamento, resposta parcial, resultados vazios e falha com opção de tentar novamente.
- Layout responsivo e respeito à preferência de movimento reduzido.
- Resumo opcional com IA e pesquisa com agente, com referências às fontes, quando habilitados pelo operador.
- Transições de página com a View Transitions API, entrada escalonada dos resultados, animação de diálogos e menus, feedback de hover/press e barra de progresso de navegação. Navegadores sem a API continuam navegando normalmente; movimento reduzido desativa as animações.

## Dados e privacidade

Não há analytics nem histórico de consultas mantido pela interface. Aparência fica no `localStorage` (`nexus-appearance`); preferências de pesquisa ficam em cookies locais por um ano. As pesquisas fazem parte da URL, podendo aparecer no histórico normal do navegador. A preferência antiga de tema é migrada automaticamente. Se o armazenamento estiver bloqueado, a personalização continua funcionando na aba atual e a interface informa que não será mantida ao recarregar.

As quatro opções de fonte não dependem de serviços externos: sistema usa a fonte do dispositivo; Geist, Source Serif 4 e JetBrains Mono são distribuídas junto da aplicação. As preferências já salvas como `serif` ou `mono` passam a usar automaticamente as novas famílias. Source Serif 4 usa os eixos óptico e de peso; os textos dos resultados serifados têm 15 px para facilitar a leitura. Para personalizar, use o ícone de paleta no cabeçalho ou **Preferências → Aparência → Personalizar**. Os ajustes visuais são aplicados e salvos imediatamente, independentemente das preferências de pesquisa.

As consultas passam pelo servidor da aplicação para a instância SearXNG informada. O processamento e os logs dessa instância dependem de seu operador. Imagens são carregadas diretamente de fontes externas, sem enviar o cabeçalho de referência. Favicons são obtidos em `/favicon?domain=…`: o servidor consulta o serviço S2 do Google com **apenas o domínio**, sem a pesquisa, os cookies ou o IP do navegador. Nenhuma URL arbitrária é acessada por esse endpoint. Os resultados e as imagens aceitam apenas URLs HTTP/HTTPS; conteúdo da API é renderizado como texto, nunca como HTML.

Ao clicar em **Resumir com IA** ou **Pesquisar com agente**, o servidor envia a consulta, títulos, domínios e trechos dos resultados ao provedor de IA. O agente pode reformular a consulta e realizar buscas adicionais no SearXNG, preservando os filtros. A política de retenção e treinamento do provedor se aplica a esses dados. O nexus não persiste prompts, respostas ou raciocínio; um cookie HttpOnly/SameSite Strict com identificador aleatório, válido por até 30 minutos, mantém a sessão técnica do provedor. A sessão não contém o texto da pesquisa nem a chave.

Os filtros de domínio e formato acrescentam os operadores `site:` e `filetype:` à consulta enviada, sem alterar o texto exibido na barra de pesquisa. O suporte a esses operadores e aos demais filtros depende do buscador selecionado.

## Verificar

```sh
bun run check
bun run test:unit --run
bunx playwright install chromium
bunx playwright test
bun run build
```

Os testes de navegador existentes consultam uma instância real; defina `SEARXNG_URL` no ambiente para usar a sua. Os testes novos de IA são determinísticos e não usam credenciais nem créditos reais:

```sh
bun run test:unit --run
bun run test:ai
```

`test:ai` constrói o app, inicia o servidor de produção e simula apenas os serviços externos. Verifica o AI SDK OpenAI-compatible, texto visível antes do término da geração, ciclo de ferramentas do agente, acionamento pela página inicial, citações, cancelamento até o provedor, falhas no meio da transmissão, bloqueio de requisições cross-origin, IA desativada, erros redigidos, ausência de configuração privada no bundle, sessão HttpOnly, layout móvel e acessibilidade.

## Resumos com IA e pesquisa com agente

A IA vem **desativada**. Não há chamadas automáticas em GET, renderização do servidor ou navegação: somente ações explícitas do usuário disparam o endpoint `POST /api/ai`. A pesquisa comum funciona sem chave, sem IA ou quando o provedor falha.

- **Resumir com IA:** sintetiza até seis resultados da página atual e oferece referências numeradas.
- **Pesquisar com agente:** usa tool calling do AI SDK para reformular a pergunta, realizar até três buscas no SearXNG e sintetizar uma resposta com fontes. Também pode ser iniciado junto à barra de pesquisa na página inicial.
- Ambos estão disponíveis em **Tudo** e **Notícias**. O agente usa a primeira página das buscas e mantém idioma, pesquisa segura, período, buscador, domínio e formato aplicável.
- O contexto é composto por **trechos dos resultados**, não páginas completas. O agente não executa código, não lê arquivos e não abre URLs arbitrárias. Citações só viram links quando correspondem a uma fonte retornada pelo servidor. O texto do modelo nunca é tratado como HTML ou Markdown executável.

### Streaming

Resumos e respostas do agente são exibidos progressivamente com `streamText` do AI SDK da Vercel. O servidor usa o protocolo SSE de UI Messages do SDK; o navegador usa `DefaultChatTransport` e `readUIMessageStream`, carregados somente quando a IA é acionada. Fontes chegam antes do texto e citações continuam funcionando mesmo quando seus caracteres chegam em fragmentos separados.

O indicador permanece ativo enquanto a resposta chega, e **Cancelar IA** encerra a transmissão e aborta a chamada ao provedor. Se a conexão ou o provedor falhar depois dos primeiros trechos, o texto recebido é preservado e marcado como **incompleto**, nunca como uma resposta concluída. O raciocínio interno do modelo, metadados, mensagens brutas de ferramentas e credenciais não são transmitidos; a telemetria de inferência está desativada explicitamente.

A resposta usa `Content-Type: text/event-stream`, `Cache-Control: no-store, no-transform`, `X-Accel-Buffering: no` e keep-alive SSE. Não habilite buffering/cache de SSE no proxy reverso. O streaming não elimina o tempo das buscas nem o raciocínio inicial do modelo: o texto aparece assim que o provedor começa a resposta pública.

### Configuração privada de runtime

Todas estas variáveis são declaradas com `public: false` e `static: false` em `src/env.ts`. O navegador recebe apenas duas flags de disponibilidade, nunca a chave, endpoint, nome do modelo ou limites.

| Variável               | Padrão                                       | Uso                                                                                            |
| ---------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `AI_ENABLED`           | `false`                                      | Habilita os recursos de IA; também exige uma chave válida na configuração.                     |
| `AI_AGENT_ENABLED`     | `true`                                       | Permite desabilitar só o agente e manter resumos.                                              |
| `AI_API_KEY`           | vazio                                        | Credencial exclusiva do servidor.                                                              |
| `AI_BASE_URL`          | `https://opencode.ai/inference/go/openai/v1` | URL base OpenAI-compatible, sem `/chat/completions`.                                           |
| `AI_MODEL`             | `deepseek-v4.1-flash`                        | ID do modelo.                                                                                  |
| `AI_MAX_STEPS`         | `4`                                          | Limite de etapas do agente, de 2 a 6; no máximo três buscas e uma etapa final sem ferramentas. |
| `AI_MAX_OUTPUT_TOKENS` | `1800`                                       | Limite de saída por chamada ao modelo, de 128 a 4096.                                          |

Use HTTPS para o provedor. HTTP é aceito apenas em loopback para desenvolvimento/testes. A integração usa `ai` e `@ai-sdk/openai-compatible`, envia um User-Agent verdadeiro (`nexus/0.0.1`) e um `x-opencode-session` estável por sessão. Não há retries automáticos de inferência.

No Coolify, cadastre a chave como **Secret**, exclusiva de **runtime** (desmarque buildtime), e habilite `AI_ENABLED=true` apenas no ambiente desejado. Não use prefixo `PUBLIC_`, argumentos de build, arquivos versionados, screenshots, corpo do PR ou logs para transportar credenciais. O `.env.example` mantém a chave vazia; `.env*` é ignorado pelo Git e pelo contexto Docker. O Compose passa os valores somente ao container em runtime. Não compartilhe saídas de `docker inspect`, `docker compose config` ou dumps de ambiente, que podem revelar os valores.

### OpenCode Go / DeepSeek

O endpoint e o modelo acima seguem a [documentação oficial do OpenCode Go](https://opencode.ai/v2/docs/go#endpoints). O DeepSeek exige que o administrador permita a região **Global** em **Settings → Privacy → Regions** no workspace. Caso contrário, a API rejeita a chamada com HTTP 400 antes de gerar texto; o app mantém a busca comum e mostra uma mensagem segura.

**Condições de uso:** a documentação do Go orienta seu uso a agentes de código e tráfego equivalente. Antes de ativá-lo para pesquisas gerais em uma instalação pública, confirme com o provedor se esse uso é permitido. A aplicação não disfarça o tráfego como outro cliente. Para outro serviço autorizado a esse caso de uso, basta alterar `AI_BASE_URL`, `AI_MODEL` e a chave privada.

### Limites e segurança operacional

Cada operação tem prazo total de 60 segundos, cancelamento propagado ao modelo/ferramentas, no máximo três buscas adicionais no agente e uma etapa final sem ferramentas. Há limites em memória por processo: uma operação simultânea e seis inícios por minuto por IP, quatro operações simultâneas e 60 inícios por minuto no total. Respostas e erros usam `Cache-Control: no-store`; erros brutos do SDK, headers e mensagens do provedor não são logados nem devolvidos.

Esses limites não substituem autenticação, orçamento no provedor ou proteção antiabuso no proxy. Para uso público ou múltiplas réplicas, adicione autenticação e um rate limiter compartilhado no gateway, configure um limite de gastos no provedor e mantenha a resolução de IPs atrás de um proxy confiável. Headers `Origin` não autenticam clientes não-browser. Os resultados externos são dados não confiáveis; as ferramentas expostas são limitadas a consultas no upstream configurado pelo operador.

Os testes unitários cobrem normalização, serialização e validação de filtros, integração do servidor e segurança/cache dos favicons, inclusive falhas. Aparência tem testes de validação de preferências, inicialização antes da hidratação, migração, armazenamento corrompido/bloqueado e contraste WCAG AA das dez combinações de paleta e modo. Os testes de navegador verificam buscas **reais** (exigem acesso à API), favicons e fallback, filtros compartilháveis, View Transitions, selects por teclado, preferências, as quatro fontes, todas as paletas, modo automático, sincronização entre abas, mobile, movimento reduzido e acessibilidade com axe. Capturas são gravadas em `test-results/`.

Para formatar: `bun run format`.

## Produção

O app usa `@sveltejs/adapter-bun` e requer **Bun 1.4 ou superior**. O script de build força a execução do Vite em Bun, como exigido pelo adapter. `preview` é apenas para inspeção local; o processo de produção é `start`.

```sh
bun run build
HOST=0.0.0.0 PORT=3000 SEARXNG_URL=https://search.asynched.tech/ bun run start
```

### Docker

O `Dockerfile` usa etapas separadas de instalação, build e runtime. A imagem final roda como usuário **não root** (`bun`), contém apenas o build, `package.json` e dependências de produção, e inclui healthcheck. As imagens oficiais Bun 1.4.3 são fixadas por digest e suportam builds nativos em amd64 e arm64. `.env`, `.git`, configurações locais, caches e resultados de testes não entram no contexto de build.

```sh
docker build -t nexus:local .
docker run --rm --name nexus --stop-timeout 35 \
  -p 127.0.0.1:3000:3000 \
  -e SEARXNG_URL=https://search.asynched.tech/ \
  nexus:local
```

Abra `http://localhost:3000`. A URL do SearXNG é lida **quando o container inicia**, não no build: a mesma imagem pode ser usada com instâncias diferentes. A porta interna padrão é `3000`. Não é preciso publicar a imagem em um registry para executar na VPS.

Com Docker Compose, a configuração do `.env` é passada ao container, sem copiar esse arquivo para a imagem:

```sh
cp .env.example .env
docker compose up -d --build
docker compose ps
docker compose logs -f nexus
```

Por segurança, os exemplos publicam a porta apenas em `127.0.0.1`. Na VPS, use um proxy reverso para HTTPS. Se precisar de acesso direto pela rede, defina `NEXUS_BIND_ADDRESS=0.0.0.0` para o Compose e configure o firewall; `NEXUS_PORT` altera somente a porta publicada no host.

O endpoint `GET /healthz` retorna `{"status":"ok"}` sem consultar buscadores externos. Assim, uma falha temporária do SearXNG não marca o processo da interface como indisponível. O adapter recebe `SIGTERM` e encerra o servidor de forma controlada.

### Coolify com Dockerfile

1. Conecte o repositório e a branch `main`.
2. Selecione o build pack **Dockerfile**, diretório base `/` e arquivo `/Dockerfile`.
3. Use a porta interna `3000` e configure o domínio/HTTPS no proxy do Coolify.
4. Defina `SEARXNG_URL` como variável de **runtime**, não como argumento de build.
5. Habilite o healthcheck HTTP com caminho `/healthz` e faça o deploy.

O Coolify constrói a imagem na VPS. Não selecione site estático: a pesquisa precisa do servidor SvelteKit. Os headers `PROTOCOL_HEADER` e `HOST_HEADER` só devem ser configurados se houver um proxy confiável que controle os headers encaminhados; consulte a [documentação do adapter](https://svelte.dev/docs/kit/adapter-bun).

### Testar o artefato de produção

```sh
bun run build
bun run test:production
```

O smoke test cria um diretório temporário, instala apenas dependências de produção, inicia `bun ./build` e verifica SSR, assets, cache imutável, healthcheck e `SEARXNG_URL` em runtime com uma instância de teste local. Ele não precisa de Docker, mas **não substitui** `docker build` e um teste do container no ambiente de destino.
