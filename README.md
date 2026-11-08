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
- Transições de página com a View Transitions API, entrada escalonada dos resultados, animação de diálogos e menus, feedback de hover/press e barra de progresso de navegação. Navegadores sem a API continuam navegando normalmente; movimento reduzido desativa as animações.

## Dados e privacidade

Não há analytics nem histórico de consultas mantido pela interface. Aparência fica no `localStorage` (`nexus-appearance`); preferências de pesquisa ficam em cookies locais por um ano. As pesquisas fazem parte da URL, podendo aparecer no histórico normal do navegador. A preferência antiga de tema é migrada automaticamente. Se o armazenamento estiver bloqueado, a personalização continua funcionando na aba atual e a interface informa que não será mantida ao recarregar.

As quatro opções de fonte não dependem de serviços externos: sistema usa a fonte do dispositivo; Geist, Source Serif 4 e JetBrains Mono são distribuídas junto da aplicação. As preferências já salvas como `serif` ou `mono` passam a usar automaticamente as novas famílias. Source Serif 4 usa os eixos óptico e de peso; os textos dos resultados serifados têm 15 px para facilitar a leitura. Para personalizar, use o ícone de paleta no cabeçalho ou **Preferências → Aparência → Personalizar**. Os ajustes visuais são aplicados e salvos imediatamente, independentemente das preferências de pesquisa.

As consultas passam pelo servidor da aplicação para a instância SearXNG informada. O processamento e os logs dessa instância dependem de seu operador. Imagens são carregadas diretamente de fontes externas, sem enviar o cabeçalho de referência. Favicons são obtidos em `/favicon?domain=…`: o servidor consulta o serviço S2 do Google com **apenas o domínio**, sem a pesquisa, os cookies ou o IP do navegador. Nenhuma URL arbitrária é acessada por esse endpoint. Os resultados e as imagens aceitam apenas URLs HTTP/HTTPS; conteúdo da API é renderizado como texto, nunca como HTML.

Os filtros de domínio e formato acrescentam os operadores `site:` e `filetype:` à consulta enviada, sem alterar o texto exibido na barra de pesquisa. O suporte a esses operadores e aos demais filtros depende do buscador selecionado.

## Verificar

```sh
bun run check
bun run test:unit --run
bunx playwright install chromium
bunx playwright test
bun run build
```

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
