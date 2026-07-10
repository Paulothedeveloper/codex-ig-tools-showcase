<p align="center">
  <img src="assets/banner.png" alt="Codex IG Tools" width="100%">
</p>

<h1 align="center">Codex IG Tools</h1>

<p align="center">
  Crescimento de Instagram que roda <b>na sua própria sessão</b> — no PC e no celular.<br>
  Sem servidor, sem senha, sem bot que loga por você. <b>Você continua no controle.</b>
</p>

<p align="center">
  <img alt="license" src="https://img.shields.io/badge/licença-MIT-00E5C9?style=flat&labelColor=0B0E17">
  <img alt="runtime" src="https://img.shields.io/badge/roda_no-navegador-FF4D3D?style=flat&labelColor=0B0E17">
  <img alt="install" src="https://img.shields.io/badge/PC_+_celular-bookmarklet-00E5C9?style=flat&labelColor=0B0E17">
  <img alt="backend" src="https://img.shields.io/badge/servidor-zero-8892a0?style=flat&labelColor=0B0E17">
  <a href="https://paulocodex.com"><img alt="site" src="https://img.shields.io/badge/paulocodex.com-00E5C9?style=flat&labelColor=0B0E17"></a>
</p>

---

## ⚡ Instalar (um toque, PC + celular)

Abra a página **[`install.html`](install.html)** — ela tem o botão de instalar e o passo a passo.

**No computador (Firefox/Chrome):**
1. Mostre a barra de favoritos (`Ctrl+Shift+B`).
2. **Arraste** o botão **⚡ Codex IG** da página para a barra.
3. No **instagram.com** logado, clique no favorito. O painel abre.

**No celular (Firefox recomendado):**
1. Toque em **Copiar bookmarklet** na página.
2. Crie um favorito de qualquer página → **edite** → **cole** no campo de endereço.
3. No instagram.com logado, abra esse favorito.

> Prefere sem instalar nada? Abra o **Console** (`F12`) no instagram.com, cole o **[`codex-ig.js`](codex-ig.js)** e dê Enter.

---

## 🧰 Quatro ferramentas num painel só

| Aba | O que faz |
|---|---|
| **Painel** | Números da conta: seguindo, seguidores, **quem não te segue de volta**, mútuos, fãs e a razão saudável — **mais**: um *snapshot* que mostra **quem deixou de te seguir** e quem chegou desde a última vez. |
| **Limpar** | Deixa de seguir quem **não te retribui**, no **seu ritmo**: **quantidade e tempo à sua escolha** (sem teto de 200), **whitelist** para proteger contas, busca/filtro, **medidor de risco** honesto e **parada automática** se o Instagram reclamar. |
| **Alvos** | Você dá **um concorrente do seu nicho** → devolve os **seguidores dele** (= seu público-alvo) como lista clicável, já tirando quem você segue, com um **comentário-modelo** por segmento. |
| **Relatório** | Métricas **reais** da sua sessão: **crescimento de seguidores** (histórico local, 1 ponto/dia), **engajamento e top posts** (curtidas/comentários/views dos últimos posts, melhor horário), gerador de **link com UTM** e **contagem de cliques** no link da bio. |

O painel é **arrastável** e usa a identidade **Codex Arena** (Deep Void + Electric Teal + Burnt Coral).

### 📈 Contar cliques no link da bio (honesto)

O Instagram **não** deixa um script contar clique no link da bio — todo contador (Linktree etc.) roda num **servidor**. Por isso o repo traz um **tracker próprio** em **[`tracker/`](tracker/)**: um Cloudflare Worker minúsculo (grátis) que redireciona `/l/<slug>` e **conta cada toque**, sem servidor de terceiro e **sem PII** (não guarda IP, cookie nem user-agent). Passo a passo em **[`tracker/README.md`](tracker/README.md)** — depois é só colar a URL no painel, aba **Relatório**.

> Prefere separado? Os scripts individuais estão em **[`tools/`](tools/)** (`codex-ig-cleaner.js`, `codex-target-finder.js`).

---

## 🔒 Seguro por design

- **Roda local, na sua sessão.** Usa os cookies que **já estão** no navegador (lidos em tempo de execução, **nunca gravados nem enviados**). Nada trafega para servidor nenhum. O `x-ig-app-id` usado é o público do IG web, igual para qualquer usuário. O snapshot e a whitelist ficam no `localStorage` do **seu** aparelho.
- **Ver é leitura.** Listar números e não-seguidores não altera nada.
- **Unfollow é seu.** Você define a **quantidade** e o **tempo**. O painel mostra um **medidor de risco** (Seguro / Moderado / Agressivo) porque automação de follow/unfollow é gray-area do ToS do Instagram — volume alto pode dar **bloqueio temporário**. Há **jitter**, **pausa por lote** e **parada automática** em `429/400`. Use na **sua** conta, em volume humano. **Você assume o risco.**
- **Alvos não interage por você** — de propósito. Curtir/comentar em massa por script é o que bane. A parte segura (achar o *quem*) é automatizada; o clique humano é seu.

Não use para spam, assédio, ou em contas que não são suas.

---

## 🗺️ Roadmap

- [x] **Quem deixou de me seguir** — comparação entre execuções (snapshot).
- [x] **Whitelist** — nunca dar unfollow em contas marcadas.
- [x] **Instalável** — bookmarklet no PC e no celular.
- [ ] **Melhor horário** — quando seus seguidores estão online.
- [ ] **Pesquisa de hashtag** — hashtags do nicho por volume e concorrência.
- [ ] **Exportar CSV** — levar as listas pra planilha.

Sugestões? Abra uma *issue* ou fale em **contato@paulocodex.com**.

---

## 🛠️ Stack

JavaScript puro (Web API interna do Instagram via `fetch` na sessão logada) · painel injetado no DOM com CSS próprio · bookmarklet gerado por `build-bookmarklet.js` (a fonte exata, sem minificação que possa quebrar) · **zero dependências · zero backend · zero build de framework**.

```
node build-bookmarklet.js   # gera codex-ig.bookmarklet.txt + install.html a partir de codex-ig.js
```

---

<p align="center">
  <sub>Feito no estúdio <a href="https://paulocodex.com">Paulocodex</a> · © 2026 Paulo Batista · Licença MIT</sub>
</p>
