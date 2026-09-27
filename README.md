# Cantinho da Leitura

Site simples para registrar os livros lidos, abandonados, a leitura atual e as listas de "pretendo ler" e "desejo comprar" — sem depender do Notion.

- **Site público:** `index.html` — mostra tudo (capas, notas, estatísticas, gráficos por mês/nota).
- **Página de edição:** `admin.html` — formulários para adicionar/editar/excluir livros, que salvam direto neste repositório do GitHub.
- **Dados:** tudo fica em [`data/books.json`](data/books.json).

## Como editar seus livros

1. Acesse `https://SEU-USUARIO.github.io/cantinho-da-leitura/admin.html`
2. Na primeira vez, crie um **token de acesso pessoal** (fine-grained) só para este repositório — o passo a passo está na própria página.
3. Cole o token — ele fica salvo só no seu navegador.
4. Use as abas (Lendo agora, Lidos, Abandonados, Pretendo ler, Desejo comprar) para adicionar, editar ou excluir itens.
5. Cada "salvar" faz um commit neste repositório. O site (GitHub Pages) recarrega sozinho em cerca de 1 minuto.

No formulário de "Lidos", o botão **Buscar capa** consulta a [Open Library](https://openlibrary.org) pelo título/autor e preenche capa, páginas e idioma automaticamente quando encontra o livro.

> O token fica salvo apenas no `localStorage` do navegador usado para editar. Não use a página de edição em computadores públicos/compartilhados. Para revogar o acesso a qualquer momento: [github.com/settings/tokens](https://github.com/settings/tokens).

## Estrutura dos dados

`data/books.json`:

```jsonc
{
  "meta": { "title": "...", "quote": { "text": "...", "author": "..." } },
  "currentlyReading": { "title": "", "author": "", "pagesRead": 0, "totalPages": 0, "cover": "" },
  "nextUp": { "title": "", "author": "" },
  "read": [
    { "id": "...", "title": "", "author": "", "rating": 1-5, "pages": 0, "national": true/false, "language": "", "finishedAt": "AAAA-MM-DD | AAAA-MM | AAAA", "cover": "" }
  ],
  "abandoned": [{ "id": "...", "title": "", "author": "", "when": "" }],
  "wantToRead": [{ "id": "...", "title": "", "when": "" }],
  "wishlist": [{ "id": "...", "title": "", "author": "" }]
}
```

As datas de "quando terminou"/"quando abandonou" são escolhidas num calendário (input nativo do navegador) e ficam guardadas como `AAAA-MM-DD`.

Editar esse arquivo direto pelo GitHub também funciona (interface web do GitHub) — a página de edição é só um jeito mais confortável de fazer a mesma coisa.

## Rodar localmente

Como o site é só HTML/CSS/JS estático, basta servir a pasta:

```bash
npx serve .
```

(A busca de capas e o salvamento pelo GitHub funcionam normalmente em `localhost`.)

## Atualizando o site

Os arquivos em `assets/` são carregados com `?v=2` no final do link (ex.: `assets/admin.js?v=2`) só pra forçar o navegador a buscar a versão nova em vez de usar uma copiada em cache. Toda vez que `style.css`, `common.js`, `app.js` ou `admin.js` mudar, aumente esse número nos dois HTMLs (`index.html` e `admin.html`) — senão quem já visitou o site pode continuar vendo a versão antiga por um tempo.

## Configuração

O repositório de destino está definido em [`assets/common.js`](assets/common.js) (`GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_BRANCH`). Só precisa mudar se você renomear o repositório ou o dono.
