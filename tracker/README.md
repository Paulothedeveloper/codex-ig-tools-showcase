# Codex IG · tracker de cliques em links

O Instagram **não** deixa um script contar clique no link da bio — todo contador (Linktree, Beacons, etc.) roda num **servidor**. Este é o servidor do Codex: um Cloudflare Worker minúsculo que **redireciona** `/l/<slug>` pro destino e **conta cada toque** num KV.

**Privacidade:** guarda só `slug → url` e um contador. **Não** guarda IP, cookie, user-agent nem nada do visitante. Zero PII.

Grátis no plano free da Cloudflare (100 mil requisições/dia).

---

## Ligar em 5 passos

Você precisa de uma conta Cloudflare (grátis) e do `wrangler` (`npm i -g wrangler`).

1. **Entrar na conta**
   ```
   cd tracker
   wrangler login
   ```

2. **Criar o banco de contadores (KV)**
   ```
   wrangler kv namespace create CLICKS
   ```
   Copie o `id` que aparecer e cole em [`wrangler.toml`](wrangler.toml) no lugar de `COLE_O_ID_DO_KV_AQUI`.

3. **Definir as duas chaves** (invente senhas fortes — são suas):
   ```
   wrangler secret put WRITE_KEY
   wrangler secret put READ_KEY
   ```

4. **Publicar**
   ```
   wrangler deploy
   ```
   No fim ele mostra a URL, algo como `https://codex-ig-tracker.SEU-USUARIO.workers.dev`.

5. **Conectar no painel** — no Codex IG, aba **Relatório → Cliques em links**, cole essa URL + `READ_KEY` + `WRITE_KEY`. Pronto: crie o link rastreado, ponha na bio, e veja os cliques ali.

---

## Como usar depois de ligado

- **Criar link** (pelo painel ou por API):
  ```
  curl -X POST https://SEU-WORKER/api/link \
    -H "x-write-key: SUA_WRITE_KEY" -H "content-type: application/json" \
    -d '{"slug":"bio","url":"https://paulocodex.com"}'
  ```
  Devolve `https://SEU-WORKER/l/bio` — é esse link que vai na bio.

- **Ver cliques**: `GET https://SEU-WORKER/api/stats?k=SUA_READ_KEY`

## Rotas
| Rota | O que faz |
|---|---|
| `GET /l/<slug>` | 302 pro destino + conta o clique |
| `POST /api/link` (header `x-write-key`) | cria/atualiza `{slug, url}` |
| `GET /api/stats?k=READ_KEY` | `{ links: [{slug, clicks}] }` |

Feito no estúdio [Paulocodex](https://paulocodex.com) · Licença MIT.
