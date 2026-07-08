/* ============================================================
   CODEX IG CLEANER — limpa quem você segue e não te segue de volta.
   Paulocodex · roda no CONSOLE do navegador logado no instagram.com.
   Local, tua sessão, você no controle. Detecta = seguro. Unfollow = paced.
   USO: instagram.com logado → F12 → aba Console → cola TUDO → Enter.
   ============================================================ */
(async () => {
  const APPID = "936619743392459";                                  // x-ig-app-id publico do IG web (igual para qualquer usuario)
  const uid  = document.cookie.match(/ds_user_id=(\d+)/)?.[1];
  const csrf = document.cookie.match(/csrftoken=([^;]+)/)?.[1];
  if (!uid || !csrf) return alert("Faça login no instagram.com nesta aba primeiro (não achei ds_user_id/csrftoken).");

  const H = { "x-ig-app-id": APPID };
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const jitter = (base) => base + Math.floor(Math.random() * base * 0.6); // ±60% pra parecer humano

  // ---- paginação de following/followers ----
  async function fetchAll(kind) {                                    // kind = 'following' | 'followers'
    let out = [], next = "", page = 0;
    do {
      const url = `https://www.instagram.com/api/v1/friendships/${uid}/${kind}/?count=200${next ? "&max_id=" + next : ""}`;
      const r = await fetch(url, { headers: H, credentials: "include" });
      if (!r.ok) { console.error(kind, r.status); break; }
      const j = await r.json();
      out.push(...(j.users || []).map(u => ({ pk: u.pk, username: u.username, full: u.full_name })));
      next = j.next_max_id || "";
      console.log(`  ${kind}: ${out.length}...`);
      await sleep(600);                                              // respeitoso entre páginas
    } while (next && page++ < 200);
    return out;
  }

  console.log("Puxando following + followers (só leitura, seguro)...");
  const [following, followers] = [await fetchAll("following"), await fetchAll("followers")];
  const followerSet = new Set(followers.map(u => u.pk));
  const nonFollowers = following.filter(u => !followerSet.has(u.pk)).sort((a,b)=>a.username.localeCompare(b.username));
  console.log(`Segue ${following.length} · te segue ${followers.length} · NÃO te seguem de volta: ${nonFollowers.length}`);

  // ---- painel UI ----
  document.getElementById("codex-cleaner")?.remove();
  const box = document.createElement("div");
  box.id = "codex-cleaner";
  box.style.cssText = "position:fixed;top:16px;right:16px;width:360px;max-height:86vh;overflow:auto;z-index:999999;background:#0A0F17;color:#F5F2EB;border:1px solid #00C4B4;border-radius:14px;padding:14px;font:13px/1.4 system-ui;box-shadow:0 12px 40px #000a";
  box.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <b style="color:#00E5C9">Codex IG Cleaner</b>
      <span onclick="this.closest('#codex-cleaner').remove()" style="cursor:pointer;color:#FF6B35">fechar ✕</span>
    </div>
    <div style="font-size:12px;color:#9aa">Segue <b>${following.length}</b> · te segue <b>${followers.length}</b> · não retribuem <b style="color:#FF6B35">${nonFollowers.length}</b></div>
    <div style="display:flex;gap:8px;margin:10px 0;font-size:12px">
      <label>Delay(s) <input id="cx-delay" type="number" value="7" min="4" style="width:46px;background:#111;color:#fff;border:1px solid #333;border-radius:6px"></label>
      <label>Limite/vez <input id="cx-cap" type="number" value="100" min="1" max="200" style="width:52px;background:#111;color:#fff;border:1px solid #333;border-radius:6px"></label>
    </div>
    <div style="display:flex;gap:6px;font-size:12px;margin-bottom:6px">
      <span onclick="document.querySelectorAll('.cx-ck').forEach(c=>c.checked=true)" style="cursor:pointer;color:#00E5C9">marcar todos</span>·
      <span onclick="document.querySelectorAll('.cx-ck').forEach(c=>c.checked=false)" style="cursor:pointer;color:#00E5C9">nenhum</span>
    </div>
    <div id="cx-list" style="max-height:38vh;overflow:auto;border:1px solid #222;border-radius:8px;padding:6px"></div>
    <button id="cx-go" style="width:100%;margin-top:10px;padding:10px;background:#FF4D3D;color:#fff;border:0;border-radius:10px;font-weight:700;cursor:pointer">Deixar de seguir marcados (paced)</button>
    <div id="cx-log" style="margin-top:8px;font-size:12px;color:#9aa;max-height:16vh;overflow:auto"></div>
  `;
  document.body.appendChild(box);
  const list = box.querySelector("#cx-list");
  list.innerHTML = nonFollowers.map(u =>
    `<label style="display:flex;gap:6px;align-items:center;padding:2px 0">
      <input type="checkbox" class="cx-ck" data-pk="${u.pk}" data-u="${u.username}" checked>
      <a href="https://instagram.com/${u.username}" target="_blank" style="color:#F5F2EB;text-decoration:none">@${u.username}</a>
     </label>`).join("");

  // ---- unfollow paced ----
  let stop = false;
  const log = (m) => { const d = box.querySelector("#cx-log"); d.innerHTML = m + "<br>" + d.innerHTML; };
  const btn = box.querySelector("#cx-go");
  btn.onclick = async () => {
    if (btn.dataset.running) { stop = true; btn.textContent = "parando..."; return; }
    const delay = Math.max(4, +box.querySelector("#cx-delay").value) * 1000;
    const cap   = Math.min(200, +box.querySelector("#cx-cap").value);
    const BATCH = 40, PAUSE = 300;                                   // a cada 40 unfollows, dorme 5 min (anti-block, igual o do github)
    const marked = [...box.querySelectorAll(".cx-ck:checked")].slice(0, cap);
    if (!marked.length) return;
    if (!confirm(`Deixar de seguir ${marked.length} (cap ${cap}/dia), ~${delay/1000}s cada + pausa de 5min a cada ${BATCH}? Para ao clicar de novo.`)) return;
    btn.dataset.running = "1"; btn.textContent = "PARAR";
    let ok = 0;
    for (let i = 0; i < marked.length; i++) {
      if (stop) break;
      const ck = marked[i];
      try {
        const r = await fetch(`https://www.instagram.com/api/v1/friendships/destroy/${ck.dataset.pk}/`,
          { method: "POST", headers: { ...H, "x-csrftoken": csrf, "content-type": "application/x-www-form-urlencoded" }, credentials: "include" });
        if (r.ok) { ok++; ck.closest("label").style.opacity = .35; log(`✓ @${ck.dataset.u} (${ok}/${marked.length})`); }
        else { log(`⚠ @${ck.dataset.u} HTTP ${r.status}`); if (r.status === 429 || r.status === 400) { log("<b>IG bloqueou temporário → PARANDO. Volte amanhã.</b>"); break; } }
      } catch (err) { log("erro: " + err.message); }
      // pausa de lote com CONTAGEM VISÍVEL (nunca parece travado)
      if (ok > 0 && ok % BATCH === 0 && i < marked.length - 1) {
        log(`⏸ pausa anti-block (5 min)...`);
        for (let s = PAUSE; s > 0 && !stop; s--) { btn.textContent = `PAUSA ${Math.floor(s/60)}:${String(s%60).padStart(2,"0")} (clique = PARAR)`; await sleep(1000); }
        btn.textContent = "PARAR";
      } else { await sleep(jitter(delay)); }
    }
    log(`<b>Fim: ${ok} deixados de seguir hoje (cap ${cap}). Roda de novo amanhã pro resto.</b>`);
    btn.dataset.running = ""; btn.textContent = "Deixar de seguir marcados (paced)"; stop = false;
  };
  console.log("Painel aberto no canto superior direito.");
})();
