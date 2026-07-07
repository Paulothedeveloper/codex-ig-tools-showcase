<p align="center">
  <img src="assets/banner.png" alt="Codex IG Tools" width="100%">
</p>

<h1 align="center">Codex IG Tools</h1>

<p align="center">
  Duas ferramentas de crescimento de Instagram que rodam <b>no console do seu próprio navegador</b> — na sua sessão logada.<br>
  Sem servidor, sem senha, sem bot que loga por você. Você continua no controle.
</p>

<p align="center">
  <a href="https://paulocodex.com">paulocodex.com</a> · feito para <a href="https://instagram.com/paulo.videodev">@paulo.videodev</a>
</p>

> **Showcase.** Esta página apresenta a ferramenta. O código roda localmente e não é distribuído aqui — fale em **contato@paulocodex.com**.

---

## As duas ferramentas

### Codex IG Cleaner
Acha **quem você segue e não te segue de volta** e deixa de seguir de forma **ritmada**, com pausa anti-bloqueio. A detecção é 100% leitura (não altera nada). O unfollow é opcional, com limite por vez, pausa de 5 min a cada lote e **parada automática** se o Instagram reclamar.

### Codex Target Finder
Você dá **um ou mais concorrentes/referências** do seu nicho → ele devolve os **seguidores deles** (que são o seu público-alvo) como uma **lista clicável**, já tirando quem você segue, e mostra um **comentário-modelo** por segmento. Ele **não comenta por você** — a inteligência (o *quem*) é entregue; o clique humano é seu.

---

## Por que é diferente (e seguro por design)

- **Roda local, na sua sessão.** Usa os cookies que já estão no navegador (lidos em tempo de execução, nunca gravados nem enviados). Nada trafega para um servidor.
- **Detecção = leitura.** Listar quem não retribui não muda nada na conta.
- **Ritmo humano.** O que é gray-area do ToS (unfollow) é feito devagar, com pausas e parada em erro — nunca em rajada. O Target Finder de propósito **não** automatiza curtir/comentar (é isso que bane).
- **Você no comando.** A ferramenta decide o *quem* e o *quando sugerido*; a ação sensível fica na sua mão.

Não serve para spam, assédio, ou contas que não são suas.

---

## Stack

JavaScript puro (Web API interna do Instagram via `fetch` na sessão logada) · painel injetado no DOM · zero dependências · zero backend.

---

<p align="center"><sub>© 2026 Paulo Batista · Paulocodex — parte do estúdio, não um produto à venda.</sub></p>
