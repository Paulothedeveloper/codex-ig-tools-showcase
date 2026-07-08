/* ============================================================
   CODEX IG — painel único de crescimento de Instagram.
   Roda no CONSOLE do navegador logado no instagram.com.
   Abas: PAINEL (números da conta) · LIMPAR (unfollow de quem
   não te segue, ritmado) · ACHAR ALVOS (seguidores de
   concorrentes = teu público, fila assistida).
   Local · tua sessão · zero servidor · cookies lidos em runtime.
   USO: instagram.com logado -> F12 -> Console -> cola TUDO -> Enter.
   Paulocodex · https://paulocodex.com · MIT
   ============================================================ */
(async () => {
  const APPID = "936619743392459"; // x-ig-app-id publico do IG web (igual para qualquer usuario)
  const uid = document.cookie.match(/ds_user_id=(\d+)/)?.[1];
  const csrf = document.cookie.match(/csrftoken=([^;]+)/)?.[1];
  if (!uid) return alert("Faça login no instagram.com nesta aba primeiro.");

  const H = { "x-ig-app-id": APPID };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const jitter = (b) => b + Math.floor(Math.random() * b * 0.6);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // comentários-modelo por segmento (adapte ao post real; nunca "top!/🔥")
  const MODELOS = {
    "Editor / criador": "qual node você usou pro skin tone aí? ficou limpo.",
    "Dev / maker": "boa! tá usando o quê no back? montei um parecido semana passada.",
    "Dono de negócio": "isso resolveria mesmo — quanto tempo levou pra colocar no ar?",
    "Referência do nicho": "trabalho consistente. como você organiza o acervo de projeto?",
  };

  // ---------- data ----------
  async function fetchAll(kind) {
    let out = [], next = "", page = 0;
    do {
      const url = `https://www.instagram.com/api/v1/friendships/${uid}/${kind}/?count=200${next ? "&max_id=" + next : ""}`;
      const r = await fetch(url, { headers: H, credentials: "include" });
      if (!r.ok) { console.error(kind, r.status); break; }
      const j = await r.json();
      out.push(...(j.users || []).map((u) => ({ pk: u.pk, username: u.username, full: u.full_name, priv: u.is_private, verif: u.is_verified })));
      next = j.next_max_id || "";
      await sleep(600);
    } while (next && page++ < 200);
    return out;
  }
  async function uidOf(username) {
    const r = await fetch(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`, { headers: H, credentials: "include" });
    if (!r.ok) return null;
    return (await r.json())?.data?.user || null;
  }
  async function followersOf(pk, cap) {
    let out = [], next = "", page = 0;
    do {
      const url = `https://www.instagram.com/api/v1/friendships/${pk}/followers/?count=100${next ? "&max_id=" + next : ""}`;
      const r = await fetch(url, { headers: H, credentials: "include" });
      if (!r.ok) break;
      const j = await r.json();
      out.push(...(j.users || []).map((u) => ({ pk: u.pk, username: u.username, full: u.full_name, priv: u.is_private, verif: u.is_verified })));
      next = j.next_max_id || "";
      await sleep(700);
    } while (next && out.length < cap && page++ < 60);
    return out;
  }

  const state = { following: null, followers: null, followerSet: null, nonFollowers: null };
  async function loadGraph(log) {
    if (state.following) return;
    log && log("Puxando seguindo + seguidores (só leitura)...");
    state.following = await fetchAll("following");
    state.followers = await fetchAll("followers");
    state.followerSet = new Set(state.followers.map((u) => u.pk));
    state.nonFollowers = state.following.filter((u) => !state.followerSet.has(u.pk)).sort((a, b) => a.username.localeCompare(b.username));
  }

  // ---------- shell ----------
  document.getElementById("codex-ig")?.remove();
  const S = document.createElement("style");
  S.textContent = `
    #codex-ig{position:fixed;top:16px;right:16px;width:400px;max-height:90vh;overflow:auto;z-index:999999;background:#0A0F17;color:#F5F2EB;border:1px solid #00C4B4;border-radius:16px;padding:0;font:13px/1.45 system-ui;box-shadow:0 16px 50px #000b}
    #codex-ig .hd{display:flex;justify-content:space-between;align-items:center;padding:12px 14px;border-bottom:1px solid #182233}
    #codex-ig .hd b{color:#00E5C9;font-size:15px}
    #codex-ig .x{cursor:pointer;color:#FF6B35}
    #codex-ig .tabs{display:flex;gap:4px;padding:8px 10px;border-bottom:1px solid #182233}
    #codex-ig .tab{flex:1;text-align:center;padding:7px 4px;border-radius:9px;cursor:pointer;color:#9aa;font-weight:700;font-size:12px;border:1px solid transparent}
    #codex-ig .tab.on{color:#031;background:#00C4B4}
    #codex-ig .body{padding:12px 14px}
    #codex-ig input,#codex-ig select{background:#111;color:#fff;border:1px solid #333;border-radius:8px;padding:7px}
    #codex-ig .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px}
    #codex-ig .stat{background:#0e1622;border:1px solid #1c2a3a;border-radius:10px;padding:10px}
    #codex-ig .stat b{display:block;font-size:22px;color:#00E5C9}
    #codex-ig .stat span{color:#8a94a6;font-size:11px}
    #codex-ig .btn{width:100%;border:0;border-radius:10px;padding:10px;font-weight:800;cursor:pointer}
    #codex-ig .btn-teal{background:#00C4B4;color:#031}
    #codex-ig .btn-coral{background:#FF4D3D;color:#fff}
    #codex-ig .list{max-height:40vh;overflow:auto;border:1px solid #1c2a3a;border-radius:8px;padding:6px;margin-top:8px}
    #codex-ig .list a{color:#F5F2EB;text-decoration:none}
    #codex-ig .log{margin-top:8px;font-size:12px;color:#8a94a6;max-height:16vh;overflow:auto}
    #codex-ig .muted{color:#8a94a6;font-size:12px}`;
  document.head.appendChild(S);

  const box = document.createElement("div");
  box.id = "codex-ig";
  box.innerHTML = `
    <div class="hd"><b>Codex IG</b><span class="x">fechar ✕</span></div>
    <div class="tabs">
      <div class="tab on" data-t="painel">Painel</div>
      <div class="tab" data-t="limpar">Limpar</div>
      <div class="tab" data-t="achar">Achar alvos</div>
    </div>
    <div class="body" id="cx-body"></div>`;
  document.body.appendChild(box);
  box.querySelector(".x").onclick = () => { box.remove(); S.remove(); };
  const body = box.querySelector("#cx-body");
  const tabs = [...box.querySelectorAll(".tab")];
  tabs.forEach((t) => (t.onclick = () => { tabs.forEach((x) => x.classList.toggle("on", x === t)); render(t.dataset.t); }));

  // ---------- tabs ----------
  async function render(tab) {
    if (tab === "painel") return painel();
    if (tab === "limpar") return limpar();
    if (tab === "achar") return achar();
  }

  async function painel() {
    body.innerHTML = `<div class="muted">Carregando números da conta...</div>`;
    const log = (m) => (body.querySelector(".muted") && (body.querySelector(".muted").textContent = m));
    await loadGraph(log);
    const fol = state.following.length, seg = state.followers.length, nao = state.nonFollowers.length;
    const mut = seg - (state.followers.filter((u) => !new Set(state.following.map((x) => x.pk)).has(u.pk)).length);
    const ratio = seg ? (fol / seg).toFixed(2) : "—";
    body.innerHTML = `
      <div class="grid">
        <div class="stat"><b>${fol}</b><span>seguindo</span></div>
        <div class="stat"><b>${seg}</b><span>seguidores</span></div>
        <div class="stat"><b style="color:#FF6B35">${nao}</b><span>não te seguem de volta</span></div>
        <div class="stat"><b>${mut}</b><span>mútuos (te seguem)</span></div>
      </div>
      <div class="stat" style="margin-bottom:8px"><b>${ratio}</b><span>razão seguindo/seguidores (perto de 1 = saudável)</span></div>
      <div class="muted">Vá em <b>Limpar</b> pra soltar quem não retribui, ou <b>Achar alvos</b> pra crescer.</div>`;
  }

  function limpar() {
    body.innerHTML = `<div class="muted">Carregando...</div>`;
    (async () => {
      await loadGraph((m) => body.querySelector(".muted") && (body.querySelector(".muted").textContent = m));
      const nf = state.nonFollowers;
      body.innerHTML = `
        <div class="muted">Segue <b>${state.following.length}</b> · te segue <b>${state.followers.length}</b> · não retribuem <b style="color:#FF6B35">${nf.length}</b></div>
        <div class="grid" style="grid-template-columns:1fr 1fr;margin-top:8px">
          <label class="muted">Delay(s)<br><input id="cx-delay" type="number" value="7" min="4" style="width:60px"></label>
          <label class="muted">Limite/vez<br><input id="cx-cap" type="number" value="100" min="1" max="200" style="width:70px"></label>
        </div>
        <div class="muted"><span id="cx-all" style="cursor:pointer;color:#00E5C9">marcar todos</span> · <span id="cx-none" style="cursor:pointer;color:#00E5C9">nenhum</span></div>
        <div class="list" id="cx-list">${nf.map((u) => `<label style="display:flex;gap:6px;align-items:center;padding:2px 0"><input type="checkbox" class="cx-ck" data-pk="${u.pk}" data-u="${esc(u.username)}" checked><a href="https://instagram.com/${encodeURIComponent(u.username)}" target="_blank">@${esc(u.username)}</a></label>`).join("")}</div>
        <button class="btn btn-coral" id="cx-go" style="margin-top:10px">Deixar de seguir marcados (ritmado)</button>
        <div class="log" id="cx-log"></div>`;
      body.querySelector("#cx-all").onclick = () => body.querySelectorAll(".cx-ck").forEach((c) => (c.checked = true));
      body.querySelector("#cx-none").onclick = () => body.querySelectorAll(".cx-ck").forEach((c) => (c.checked = false));
      const log = (m) => { const d = body.querySelector("#cx-log"); d.innerHTML = m + "<br>" + d.innerHTML; };
      const btn = body.querySelector("#cx-go");
      let stop = false;
      btn.onclick = async () => {
        if (btn.dataset.run) { stop = true; btn.textContent = "parando..."; return; }
        const delay = Math.max(4, +body.querySelector("#cx-delay").value) * 1000;
        const cap = Math.min(200, +body.querySelector("#cx-cap").value);
        const BATCH = 40, PAUSE = 300;
        const marked = [...body.querySelectorAll(".cx-ck:checked")].slice(0, cap);
        if (!marked.length) return;
        if (!confirm(`Deixar de seguir ${marked.length} (cap ${cap}), ~${delay / 1000}s cada + pausa de 5min a cada ${BATCH}? Clique de novo pra PARAR.`)) return;
        btn.dataset.run = "1"; btn.textContent = "PARAR";
        let ok = 0;
        for (let i = 0; i < marked.length; i++) {
          if (stop) break;
          const ck = marked[i];
          try {
            const r = await fetch(`https://www.instagram.com/api/v1/friendships/destroy/${ck.dataset.pk}/`, { method: "POST", headers: { ...H, "x-csrftoken": csrf, "content-type": "application/x-www-form-urlencoded" }, credentials: "include" });
            if (r.ok) { ok++; ck.closest("label").style.opacity = .35; log(`✓ @${esc(ck.dataset.u)} (${ok}/${marked.length})`); }
            else { log(`⚠ @${esc(ck.dataset.u)} HTTP ${r.status}`); if (r.status === 429 || r.status === 400) { log("<b>IG bloqueou temporário → PARANDO. Volte amanhã.</b>"); break; } }
          } catch (e) { log("erro: " + esc(e.message)); }
          if (ok > 0 && ok % BATCH === 0 && i < marked.length - 1) {
            log("⏸ pausa anti-block (5 min)...");
            for (let s = PAUSE; s > 0 && !stop; s--) { btn.textContent = `PAUSA ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")} (clique = PARAR)`; await sleep(1000); }
            btn.textContent = "PARAR";
          } else await sleep(jitter(delay));
        }
        log(`<b>Fim: ${ok} deixados de seguir. Roda de novo amanhã pro resto.</b>`);
        btn.dataset.run = ""; btn.textContent = "Deixar de seguir marcados (ritmado)"; stop = false;
      };
    })();
  }

  function achar() {
    body.innerHTML = `
      <div class="muted">Concorrentes/referências do teu nicho (sem @, vírgula):</div>
      <input id="cx-in" placeholder="ex: davinciresolve.br, editor..." style="width:100%;box-sizing:border-box;margin:6px 0">
      <div class="grid" style="grid-template-columns:1fr 1fr">
        <label class="muted">Amostra/conta<br><input id="cx-samp" type="number" value="300" min="50" max="1500" style="width:70px"></label>
        <label class="muted">Segmento<br><select id="cx-seg">${Object.keys(MODELOS).map((k) => `<option>${k}</option>`).join("")}</select></label>
      </div>
      <button class="btn btn-teal" id="cx-find" style="margin-top:8px">Buscar alvos reais</button>
      <div id="cx-model" class="stat" style="margin-top:10px"></div>
      <div class="muted" id="cx-flog" style="margin-top:8px"></div>
      <div class="list" id="cx-flist" style="display:none"></div>
      <button class="btn btn-coral" id="cx-copy" style="margin-top:8px;display:none">Copiar lista</button>`;
    const model = () => { const seg = body.querySelector("#cx-seg").value; body.querySelector("#cx-model").innerHTML = `<span style="color:#00E5C9;font-weight:700">Comentário-modelo (${esc(seg)}):</span><br>"${esc(MODELOS[seg])}"<br><span class="muted">Adapte ao post. Curta 2-3 antes. 10-15/dia, genuíno.</span>`; };
    body.querySelector("#cx-seg").onchange = model; model();
    let found = [];
    const flog = (m) => (body.querySelector("#cx-flog").innerHTML = m);
    body.querySelector("#cx-find").onclick = async () => {
      const names = body.querySelector("#cx-in").value.split(",").map((s) => s.trim().replace(/^@/, "")).filter(Boolean);
      if (!names.length) return;
      const cap = Math.min(1500, +body.querySelector("#cx-samp").value);
      flog("Lendo quem você já segue...");
      await loadGraph();
      const already = new Set(state.following.map((u) => u.pk));
      const seen = new Set(), agg = [];
      for (const n of names) {
        flog(`Buscando @${esc(n)}...`);
        const prof = await uidOf(n);
        if (!prof) { flog(`⚠ @${esc(n)} não encontrado (pulei).`); continue; }
        flog(`@${esc(n)}: ${prof.edge_followed_by?.count ?? "?"} seguidores. Amostra de ${cap}...`);
        for (const u of await followersOf(prof.id, cap)) {
          if (seen.has(u.pk) || already.has(u.pk) || u.pk === uid) continue;
          seen.add(u.pk); agg.push({ ...u, via: n });
        }
      }
      agg.sort((a, b) => (Number(a.priv) - Number(b.priv)) || (Number(!b.full) - Number(!a.full)) || (Number(a.verif) - Number(b.verif)));
      found = agg;
      flog(`<b style="color:#00E5C9">${agg.length} alvos reais</b> (tirei quem você segue). Abra, curta 2-3, comente o modelo.`);
      const list = body.querySelector("#cx-flist");
      list.style.display = "block";
      list.innerHTML = agg.slice(0, 400).map((u, i) => `<div style="display:flex;gap:6px;padding:3px 0;border-bottom:1px solid #161d29"><span style="color:#556;width:26px">${i + 1}</span><a href="https://instagram.com/${encodeURIComponent(u.username)}" target="_blank" style="flex:1">@${esc(u.username)}${u.priv ? " 🔒" : ""}${u.verif ? " ✔" : ""}<br><span style="color:#667;font-size:11px">${esc(u.full || "")} · via @${esc(u.via)}</span></a></div>`).join("");
      body.querySelector("#cx-copy").style.display = "block";
    };
    body.querySelector("#cx-copy").onclick = () => {
      const txt = found.map((u, i) => `${i + 1}. @${u.username} — ${u.full || ""} (via @${u.via}) https://instagram.com/${u.username}`).join("\n");
      navigator.clipboard.writeText(txt).then(() => flog("Lista copiada."));
    };
  }

  render("painel");
  console.log("Codex IG aberto no canto superior direito.");
})();
