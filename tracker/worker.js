/* ============================================================
   Codex IG · tracker de cliques em links (Cloudflare Worker)
   O Instagram nao deixa um script contar clique no link da bio —
   todo contador (Linktree etc.) roda num servidor. Este worker
   redireciona /l/<slug> pro destino e conta cada toque no KV.
   Zero PII: guarda so { slug -> url } e contadores. Sem cookie,
   sem IP, sem nada do visitante.

   IMPORTANTE (por que tem uma pagina propria): a CSP da Instagram
   bloqueia `fetch` da pagina do IG pra qualquer dominio externo,
   entao criar link / ler cliques NAO funciona de dentro do painel
   que roda no instagram.com. Por isso o worker serve seu PROPRIO
   painel em GET / (mesmo dominio = sem bloqueio). O painel do IG
   so ABRE esta pagina numa aba nova.

   Rotas:
     GET  /                      -> painel web (criar link + ver cliques)
     GET  /l/<slug>              -> 302 pro destino + conta o clique
     POST /api/link  (x-write-key) { slug, url } -> cria/atualiza link
     GET  /api/stats?k=READ_KEY  -> { links:[{slug,clicks}] }
   Segredos (wrangler secret put): WRITE_KEY, READ_KEY. Binding KV: CLICKS.
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

    // ---- painel web (mesmo dominio -> sem bloqueio de CSP) ----
    if (url.pathname === "/" && req.method === "GET")
      return new Response(PAGE, { headers: { ...cors, "content-type": "text/html; charset=utf-8" } });

    // ---- redirect + contagem ----
    if (url.pathname.startsWith("/l/")) {
      const slug = url.pathname.slice(3).replace(/\/+$/, "").toLowerCase();
      if (!/^[a-z0-9-]{1,40}$/.test(slug)) return new Response("slug inválido", { status: 400 });
      const rec = await env.CLICKS.get("link:" + slug, "json");
      if (!rec || !rec.url) return new Response("link não encontrado", { status: 404 });
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
        const rec = await env.CLICKS.get(k.name, "json");
        const clicks = parseInt(await env.CLICKS.get("count:" + slug)) || 0;
        links.push({ slug, clicks, url: rec?.url || "" });
      }
      links.sort((a, b) => b.clicks - a.clicks);
      return json({ links });
    }

    return new Response("Codex IG · link tracker. Abra a raiz / no navegador pra usar o painel.", { headers: { ...cors, "content-type": "text/plain; charset=utf-8" } });
  },
};

// painel web servido em GET / (Codex Arena, self-contained, zero emoji, responsivo)
const PAGE = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Codex IG · Cliques</title>
<style>
:root{--void:#0b0e17;--card:#0d1420;--line:#1b2536;--line2:#161d29;--teal:#00e5c9;--teal2:#7ef7e6;--teal-dim:#0aa892;--coral:#ff4d3d;--coral2:#ff8a5c;--paper:#e8e4dc;--slate:#8892a0;--steel:#232c3b}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--void);color:var(--paper);font:15px/1.55 "Space Grotesk",ui-sans-serif,system-ui,-apple-system,sans-serif;-webkit-font-smoothing:antialiased;overflow-x:hidden;min-height:100vh}
.aur{position:fixed;inset:-20% 0 auto 0;height:60vh;z-index:0;pointer-events:none;filter:blur(60px);background:radial-gradient(40% 55% at 24% 28%,rgba(0,229,201,.16),transparent 60%),radial-gradient(45% 50% at 80% 18%,rgba(255,77,61,.12),transparent 62%);animation:pan 24s ease-in-out infinite}
@keyframes pan{0%,100%{transform:translate3d(-3%,-2%,0) scale(1.05)}50%{transform:translate3d(3%,3%,0) scale(1.12)}}
.wrap{position:relative;z-index:1;max-width:640px;margin:0 auto;padding:34px 20px 60px}
.hd{display:flex;align-items:center;gap:12px;margin-bottom:8px}
.logo{width:44px;height:44px;border-radius:12px;display:grid;place-items:center;background:linear-gradient(135deg,var(--teal),var(--teal-dim));color:#04120f;font-weight:900;font-size:22px;box-shadow:0 0 28px rgba(0,229,201,.5)}
h1{font-size:24px;font-weight:800;letter-spacing:-.02em}
h1 b{background:linear-gradient(90deg,#00e5c9,#7ef7e6,#00e5c9);background-size:200% auto;-webkit-background-clip:text;background-clip:text;color:transparent;animation:g 6s linear infinite}
@keyframes g{0%,100%{background-position:0 50%}50%{background-position:100% 50%}}
.hd span{display:block;font-size:11px;color:var(--slate);letter-spacing:.16em;text-transform:uppercase}
.sub{color:var(--slate);font-size:13.5px;margin:2px 0 22px}
.card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:18px;margin-top:16px}
.card h2{font-size:12px;text-transform:uppercase;letter-spacing:.1em;color:var(--slate);margin-bottom:14px}
label{display:block;font-size:12px;color:var(--slate);font-weight:600;margin-bottom:14px}
input{width:100%;margin-top:5px;background:#0a0f18;color:var(--paper);border:1px solid var(--steel);border-radius:10px;padding:11px 12px;font:inherit;font-size:14px;outline:none;transition:.2s}
input:focus{border-color:var(--teal);box-shadow:0 0 0 3px rgba(0,229,201,.15)}
.grid2{display:grid;grid-template-columns:1fr 140px;gap:12px}
@media(max-width:480px){.grid2{grid-template-columns:1fr}}
.btn{width:100%;border:0;border-radius:11px;padding:13px;font:inherit;font-weight:800;font-size:14px;cursor:pointer;transition:transform .15s,filter .2s}
.btn:active{transform:scale(.99)}.btn:hover{filter:brightness(1.07)}
.btn-teal{background:linear-gradient(135deg,var(--teal),var(--teal-dim));color:#04120f}
.btn-ghost{background:#0e1522;color:var(--paper);border:1px solid var(--steel)}
.out{background:#0a0f18;border:1px solid var(--steel);border-radius:10px;padding:11px 12px;font:13px ui-monospace,monospace;color:var(--teal2);word-break:break-all;margin-top:12px}
.msg{font-size:12.5px;margin-top:10px}.msg.err{color:var(--coral2)}.msg.ok{color:var(--teal)}
.rowc{display:flex;justify-content:space-between;align-items:center;font-size:14px;margin-bottom:6px}
.rowc a{color:var(--slate);text-decoration:none;font-size:12px;max-width:60%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rowc b{color:var(--teal);font-weight:800}
.bar{height:9px;border-radius:6px;background:#0a0f18;border:1px solid var(--steel);overflow:hidden;margin-bottom:16px}
.bar i{display:block;height:100%;border-radius:6px;background:linear-gradient(90deg,var(--teal),var(--teal2));transition:width .5s cubic-bezier(.16,1,.3,1)}
.foot{color:var(--slate);font-size:11.5px;text-align:center;margin-top:26px}
.foot a{color:var(--teal)}
.muted{color:var(--slate);font-size:12.5px}
.hide{display:none}
.linkbtn{background:none;border:0;color:var(--teal);font:inherit;font-weight:700;cursor:pointer;padding:2px 0;text-decoration:underline}
</style></head><body>
<div class="aur"></div>
<div class="wrap">
  <div class="hd"><div class="logo">C</div><div><h1><b>Codex IG</b> · Cliques</h1><span>link tracker</span></div></div>
  <p class="sub">Painel do seu tracker de cliques. Roda no domínio do worker, então funciona (a Instagram bloqueia isso dentro do painel do app — por isso esta página existe).</p>
  <button id="editkeys" class="linkbtn hide">Editar chaves</button>
  <div class="muted" id="keyhint" style="font-size:11px"></div>

  <div class="card" id="cfg">
    <h2>Suas chaves</h2>
    <label>Chave de leitura (READ_KEY)<input id="rk" placeholder="READ_KEY" autocomplete="off"></label>
    <label>Chave de escrita (WRITE_KEY)<input id="wk" placeholder="WRITE_KEY" autocomplete="off"></label>
    <button class="btn btn-ghost" id="save">Salvar chaves neste navegador</button>
    <div class="muted" style="margin-top:10px">Ficam só no localStorage deste aparelho.</div>
  </div>

  <div class="card hide" id="app">
    <h2>Criar link rastreado</h2>
    <div class="grid2">
      <label>Destino<input id="url" placeholder="https://paulocodex.com"></label>
      <label>Slug<input id="slug" placeholder="bio"></label>
    </div>
    <button class="btn btn-teal" id="create">Criar link</button>
    <div id="cout"></div>
  </div>

  <div class="card hide" id="statsc">
    <h2>Cliques por link</h2>
    <div id="stats"><div class="muted">Carregando…</div></div>
    <button class="btn btn-ghost" id="refresh" style="margin-top:6px">Atualizar</button>
  </div>

  <div class="foot">Feito no estúdio <a href="https://paulocodex.com" target="_blank">Paulocodex</a> · zero PII (só conta o toque, não guarda quem)</div>
</div>
<script>
const $=s=>document.querySelector(s), K="codexig-tracker-keys";
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let keys=JSON.parse(localStorage.getItem(K)||"null");
function show(){
  const has=keys&&keys.rk;
  $("#cfg").classList.toggle("hide",!!has);
  $("#editkeys").classList.toggle("hide",!has);
  $("#app").classList.toggle("hide",!has);
  $("#statsc").classList.toggle("hide",!has);
  $("#keyhint").textContent = has ? ("leitura salva termina em …"+keys.rk.slice(-4)+(keys.wk?" · escrita …"+keys.wk.slice(-4):"")) : "";
  if(has) loadStats();
}
$("#save").onclick=()=>{ keys={rk:$("#rk").value.trim(),wk:$("#wk").value.trim()}; if(!keys.rk){alert("Cole ao menos a chave de leitura.");return;} localStorage.setItem(K,JSON.stringify(keys)); show(); };
$("#editkeys").onclick=()=>{ $("#cfg").classList.remove("hide"); if(keys){$("#rk").value=keys.rk||"";$("#wk").value=keys.wk||"";} $("#rk").focus(); };
if(keys){ $("#rk").value=keys.rk||""; $("#wk").value=keys.wk||""; }
show();
$("#create").onclick=async()=>{
  const url=$("#url").value.trim(), slug=$("#slug").value.trim().toLowerCase(), out=$("#cout");
  if(!/^https?:\\/\\//.test(url)||!/^[a-z0-9-]{1,40}$/.test(slug)){ out.innerHTML='<div class="msg err">Destino https:// e slug (letras/números/hífen).</div>'; return; }
  out.innerHTML='<div class="muted" style="margin-top:10px">Criando…</div>';
  try{
    const r=await fetch("/api/link",{method:"POST",headers:{"content-type":"application/json","x-write-key":keys.wk},body:JSON.stringify({slug,url})});
    const j=await r.json(); if(!r.ok||!j.short) throw new Error(j.error||("HTTP "+r.status));
    out.innerHTML='<div class="out">'+esc(j.short)+'</div><button class="btn btn-ghost" id="cp" style="margin-top:10px">Copiar (use na bio)</button><div class="msg ok" id="cpm"></div>';
    $("#cp").onclick=()=>navigator.clipboard.writeText(j.short).then(()=>$("#cpm").textContent="Copiado.");
    loadStats();
  }catch(e){ out.innerHTML='<div class="msg err">Falhou: '+esc(e.message)+' (confira a chave de escrita).</div>'; }
};
$("#refresh").onclick=loadStats;
async function loadStats(){
  const st=$("#stats"); st.innerHTML='<div class="muted">Carregando…</div>';
  try{
    const r=await fetch("/api/stats?k="+encodeURIComponent(keys.rk)); const j=await r.json();
    if(!r.ok) throw new Error(j.error||("HTTP "+r.status));
    const links=j.links||[];
    if(!links.length){ st.innerHTML='<div class="muted">Nenhum link ainda. Crie um acima.</div>'; return; }
    const max=Math.max(...links.map(l=>l.clicks),1);
    st.innerHTML=links.map(l=>'<div class="rowc"><a href="/l/'+esc(l.slug)+'" target="_blank">/l/'+esc(l.slug)+'</a><b>'+l.clicks+'</b></div><div class="bar"><i style="width:'+(l.clicks/max*100).toFixed(0)+'%"></i></div>').join("");
  }catch(e){ st.innerHTML='<div class="msg err">Falhou: '+esc(e.message)+' — reabri as chaves acima, confira e salve de novo.</div>'; $("#cfg").classList.remove("hide"); if(keys){$("#rk").value=keys.rk||"";} }
}
</script></body></html>`;
