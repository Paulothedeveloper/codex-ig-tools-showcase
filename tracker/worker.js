/* ============================================================
   Codex IG · tracker de cliques em links (Cloudflare Worker)
   O Instagram nao deixa um script contar clique no link da bio —
   todo contador (Linktree etc.) roda num servidor. Este worker
   redireciona /l/<slug> pro destino e conta cada toque no KV.
   Zero PII: guarda so { slug -> url } e contadores. Sem cookie,
   sem IP, sem nada do visitante.
   Rotas:
     GET  /l/<slug>              -> 302 pro destino + conta o clique
     POST /api/link  (x-write-key) { slug, url } -> cria/atualiza link
     GET  /api/stats?k=READ_KEY  -> { links:[{slug,clicks}] }
   Segredos (wrangler secret put): WRITE_KEY, READ_KEY.
   Binding KV: CLICKS.
   Paulocodex · MIT
   ============================================================ */
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const cors = {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type,x-write-key",
    };
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { ...cors, "content-type": "application/json" } });

    // ---- redirect + contagem ----
    if (url.pathname.startsWith("/l/")) {
      const slug = url.pathname.slice(3).replace(/\/+$/, "").toLowerCase();
      if (!/^[a-z0-9-]{1,40}$/.test(slug)) return new Response("slug inválido", { status: 400 });
      const rec = await env.CLICKS.get("link:" + slug, "json");
      if (!rec || !rec.url) return new Response("link não encontrado", { status: 404 });
      // contadores (best-effort; KV é eventual, ok pra clique)
      const total = (parseInt(await env.CLICKS.get("count:" + slug)) || 0) + 1;
      const day = new Date().toISOString().slice(0, 10);
      const dkey = "day:" + slug + ":" + day;
      const dcount = (parseInt(await env.CLICKS.get(dkey)) || 0) + 1;
      await Promise.all([
        env.CLICKS.put("count:" + slug, String(total)),
        env.CLICKS.put(dkey, String(dcount), { expirationTtl: 60 * 60 * 24 * 180 }),
      ]);
      return new Response(null, { status: 302, headers: { location: rec.url, "cache-control": "no-store" } });
    }

    // ---- criar/atualizar link ----
    if (url.pathname === "/api/link" && req.method === "POST") {
      if (!env.WRITE_KEY || req.headers.get("x-write-key") !== env.WRITE_KEY) return json({ error: "chave de escrita inválida" }, 401);
      let body;
      try { body = await req.json(); } catch { return json({ error: "json inválido" }, 400); }
      const slug = String(body.slug || "").toLowerCase();
      const target = String(body.url || "");
      if (!/^[a-z0-9-]{1,40}$/.test(slug)) return json({ error: "slug: use letras, números e hífen (1-40)" }, 400);
      if (!/^https?:\/\/.+/.test(target)) return json({ error: "url: precisa começar com http(s)://" }, 400);
      await env.CLICKS.put("link:" + slug, JSON.stringify({ url: target, t: Date.now() }));
      return json({ ok: true, slug, short: url.origin + "/l/" + slug });
    }

    // ---- estatísticas ----
    if (url.pathname === "/api/stats") {
      if (!env.READ_KEY || url.searchParams.get("k") !== env.READ_KEY) return json({ error: "chave de leitura inválida" }, 401);
      const list = await env.CLICKS.list({ prefix: "link:" });
      const links = [];
      for (const k of list.keys) {
        const slug = k.name.slice(5);
        const clicks = parseInt(await env.CLICKS.get("count:" + slug)) || 0;
        links.push({ slug, clicks });
      }
      links.sort((a, b) => b.clicks - a.clicks);
      return json({ links });
    }

    return new Response("Codex IG · link tracker. Rotas: /l/<slug>, POST /api/link, GET /api/stats", { headers: { ...cors, "content-type": "text/plain; charset=utf-8" } });
  },
};
