/* ============================================================
   CODEX IG — painel de crescimento de Instagram (Codex Arena).
   Roda na SUA sessão logada: console do navegador (PC) OU
   bookmarklet (PC + celular). Zero servidor, cookies lidos em
   runtime (nunca gravados/enviados), x-ig-app-id público.

   Abas:
     PAINEL  — números da conta + quem deixou de te seguir (snapshot).
     LIMPAR  — unfollow de quem não retribui, ritmado, whitelist,
               quantidade e tempo à sua escolha, para sozinho no 429/400.
     ALVOS   — seguidores de concorrentes (= teu público) como fila.

   USO (PC): instagram.com logado -> F12 -> Console -> cola TUDO -> Enter.
   USO (PC+cel): instale como bookmarklet (veja install.html) -> 1 toque.
   Paulocodex · https://paulocodex.com · MIT
   ============================================================ */
(async () => {
  const APPID = "936619743392459"; // x-ig-app-id público do IG web (igual p/ qualquer usuário)
  const uid = document.cookie.match(/ds_user_id=(\d+)/)?.[1];
  const csrf = document.cookie.match(/csrftoken=([^;]+)/)?.[1];
  if (!location.hostname.endsWith("instagram.com"))
    return alert("Abra o instagram.com primeiro, depois rode o Codex IG.");
  if (!uid) return alert("Faça login no instagram.com nesta aba e rode de novo.");

  const H = { "x-ig-app-id": APPID };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const jitter = (b) => b + Math.floor(Math.random() * b * 0.45);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const nf = new Intl.NumberFormat("pt-BR");
  const LS = (k, v) => { // storage local por conta (nunca sai do seu aparelho)
    const key = "codexig:" + uid + ":" + k;
    try { if (v === undefined) return JSON.parse(localStorage.getItem(key) || "null"); localStorage.setItem(key, JSON.stringify(v)); } catch (e) { return null; }
  };

  // comentários-modelo por segmento (adapte ao post real; nunca "top!/🔥")
  const MODELOS = {
    "Editor / criador": "qual node você usou pro skin tone aí? ficou limpo.",
    "Dev / maker": "boa! tá usando o quê no back? montei um parecido semana passada.",
    "Dono de negócio": "isso resolveria mesmo — quanto tempo levou pra colocar no ar?",
    "Referência do nicho": "trabalho consistente. como você organiza o acervo de projeto?",
  };

  // ---------- data ----------
  async function fetchAll(kind, onProg) {
    let out = [], next = "", page = 0;
    do {
      const url = `https://www.instagram.com/api/v1/friendships/${uid}/${kind}/?count=200${next ? "&max_id=" + next : ""}`;
      const r = await fetch(url, { headers: H, credentials: "include" });
      if (!r.ok) { console.error(kind, r.status); break; }
      const j = await r.json();
      out.push(...(j.users || []).map((u) => ({ pk: String(u.pk), username: u.username, full: u.full_name, priv: u.is_private, verif: u.is_verified })));
      next = j.next_max_id || "";
      onProg && onProg(kind, out.length);
      await sleep(550);
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
      out.push(...(j.users || []).map((u) => ({ pk: String(u.pk), username: u.username, full: u.full_name, priv: u.is_private, verif: u.is_verified })));
      next = j.next_max_id || "";
      await sleep(650);
    } while (next && out.length < cap && page++ < 80);
    return out;
  }

  const state = { following: null, followers: null, followerSet: null, nonFollowers: null };
  async function loadGraph(log) {
    if (state.following) return;
    log && log("Puxando seguindo (só leitura)…");
    state.following = await fetchAll("following", (k, n) => log && log(`Seguindo: ${nf.format(n)}…`));
    log && log("Puxando seguidores (só leitura)…");
    state.followers = await fetchAll("followers", (k, n) => log && log(`Seguidores: ${nf.format(n)}…`));
    state.followerSet = new Set(state.followers.map((u) => u.pk));
    state.nonFollowers = state.following.filter((u) => !state.followerSet.has(u.pk)).sort((a, b) => a.username.localeCompare(b.username));
  }

  // snapshot: quem deixou de te seguir / novos seguidores desde a última vez
  function snapDiff() {
    const prev = LS("snap");
    const cur = state.followers.map((u) => ({ pk: u.pk, username: u.username }));
    let lost = [], gained = [];
    if (prev && prev.followers) {
      const curSet = new Set(cur.map((u) => u.pk)), prevSet = new Set(prev.followers.map((u) => u.pk));
      lost = prev.followers.filter((u) => !curSet.has(u.pk));
      gained = cur.filter((u) => !prevSet.has(u.pk));
    }
    return { prev, lost, gained };
  }
  const saveSnap = () => LS("snap", { t: Date.now(), followers: state.followers.map((u) => ({ pk: u.pk, username: u.username })) });
  const wl = () => new Set(LS("whitelist") || []);
  const toggleWl = (pk) => { const s = wl(); s.has(pk) ? s.delete(pk) : s.add(pk); LS("whitelist", [...s]); return s.has(pk); };

  // ---------- shell + tema Codex Arena ----------
  document.getElementById("codex-ig")?.remove();
  document.getElementById("codex-ig-style")?.remove();
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const S = document.createElement("style");
  S.id = "codex-ig-style";
  S.textContent = `
    #codex-ig{--void:#0b0e17;--void2:#10141f;--teal:#00e5c9;--teal2:#7ef7e6;--teal-dim:#0aa892;
      --coral:#ff4d3d;--coral2:#ff8a5c;--paper:#e8e4dc;--slate:#8892a0;--steel:#232c3b;--steel2:#161d29;--card:#0d1420;
      position:fixed;top:16px;right:16px;width:min(390px,94vw);max-height:92vh;z-index:2147483000;
      display:flex;flex-direction:column;color:var(--paper);
      background:linear-gradient(180deg,#0c111b,#090d14);border:1px solid #1b2536;border-radius:18px;overflow:hidden;
      font:13px/1.5 "Space Grotesk",ui-sans-serif,system-ui,-apple-system,sans-serif;
      box-shadow:0 26px 80px #000d,0 0 0 1px #ffffff08 inset;
      animation:cxRise .5s cubic-bezier(.16,1,.3,1) both;-webkit-font-smoothing:antialiased}
    #codex-ig *{box-sizing:border-box}
    #codex-ig .hd{position:relative;display:flex;justify-content:space-between;align-items:center;
      padding:13px 15px;border-bottom:1px solid #182233;cursor:grab;overflow:hidden;flex:0 0 auto;user-select:none}
    #codex-ig .hd:active{cursor:grabbing}
    #codex-ig .hd::before{content:"";position:absolute;inset:-60% -20% auto -20%;height:180%;z-index:0;pointer-events:none;
      background:radial-gradient(45% 60% at 22% 30%,rgba(0,229,201,.20),transparent 60%),radial-gradient(45% 55% at 82% 20%,rgba(255,77,61,.14),transparent 62%);
      filter:blur(24px);animation:cxAurora 20s ease-in-out infinite}
    #codex-ig .brand{position:relative;z-index:1;display:flex;align-items:center;gap:9px}
    #codex-ig .logo{width:26px;height:26px;border-radius:8px;display:grid;place-items:center;flex:0 0 auto;
      background:linear-gradient(135deg,var(--teal),var(--teal-dim));color:#04120f;font-weight:900;font-size:15px;
      box-shadow:0 0 16px rgba(0,229,201,.45)}
    #codex-ig .brand b{font-size:15px;font-weight:800;letter-spacing:-.02em;
      background:linear-gradient(90deg,#00e5c9,#7ef7e6,#00e5c9);background-size:200% auto;
      -webkit-background-clip:text;background-clip:text;color:transparent;animation:cxGrad 6s ease infinite}
    #codex-ig .brand span{display:block;font-size:10px;color:var(--slate);letter-spacing:.14em;text-transform:uppercase;font-weight:600}
    #codex-ig .x{position:relative;z-index:1;cursor:pointer;color:var(--slate);font-size:16px;line-height:1;
      width:26px;height:26px;border-radius:8px;display:grid;place-items:center;transition:.2s}
    #codex-ig .x:hover{color:var(--coral);background:#ffffff0c}
    #codex-ig .tabs{display:flex;gap:5px;padding:9px 11px;border-bottom:1px solid #182233;flex:0 0 auto}
    #codex-ig .tab{flex:1;position:relative;text-align:center;padding:8px 4px;border-radius:10px;cursor:pointer;
      color:var(--slate);font-weight:700;font-size:12px;border:1px solid transparent;transition:.22s}
    #codex-ig .tab:hover{color:var(--paper);background:#ffffff07}
    #codex-ig .tab.on{color:#04120f;background:linear-gradient(135deg,var(--teal),var(--teal-dim));
      box-shadow:0 6px 18px -6px rgba(0,229,201,.6)}
    #codex-ig .body{padding:13px 15px;overflow:auto;flex:1 1 auto;scrollbar-width:thin}
    #codex-ig .body::-webkit-scrollbar{width:8px}
    #codex-ig .body::-webkit-scrollbar-thumb{background:#1c2636;border-radius:8px}
    #codex-ig input,#codex-ig select{background:#0a0f18;color:var(--paper);border:1px solid #263145;border-radius:9px;
      padding:8px 9px;font:inherit;transition:.2s;outline:none}
    #codex-ig input:focus,#codex-ig select:focus{border-color:var(--teal);box-shadow:0 0 0 3px rgba(0,229,201,.14)}
    #codex-ig .grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}
    #codex-ig .stat{position:relative;background:var(--card);border:1px solid var(--steel2);border-radius:13px;padding:12px 13px;overflow:hidden;transition:.28s}
    #codex-ig .stat:hover{border-color:#2b3849;transform:translateY(-2px)}
    #codex-ig .stat::after{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--teal);opacity:.85}
    #codex-ig .stat.coral::after{background:var(--coral)}
    #codex-ig .stat b{display:block;font-size:26px;font-weight:800;letter-spacing:-.02em;color:var(--teal);line-height:1.05}
    #codex-ig .stat.coral b{color:var(--coral2)}
    #codex-ig .stat span{color:var(--slate);font-size:11px;font-weight:500}
    #codex-ig .row{display:flex;gap:9px;align-items:flex-end;flex-wrap:wrap}
    #codex-ig label.fld{flex:1;min-width:74px;color:var(--slate);font-size:11px;font-weight:600;display:flex;flex-direction:column;gap:4px}
    #codex-ig label.fld input,#codex-ig label.fld select{width:100%}
    #codex-ig .btn{width:100%;border:0;border-radius:11px;padding:11px;font-weight:800;font-size:13px;cursor:pointer;
      font-family:inherit;position:relative;overflow:hidden;transition:transform .18s,filter .2s,box-shadow .2s}
    #codex-ig .btn:hover{filter:brightness(1.06)}
    #codex-ig .btn:active{transform:scale(.985)}
    #codex-ig .btn-teal{background:linear-gradient(135deg,var(--teal),var(--teal-dim));color:#04120f;box-shadow:0 10px 26px -10px rgba(0,229,201,.7)}
    #codex-ig .btn-coral{background:linear-gradient(135deg,var(--coral),#e0392b);color:#fff;box-shadow:0 10px 26px -10px rgba(255,77,61,.6)}
    #codex-ig .btn-ghost{background:#0e1522;color:var(--paper);border:1px solid #263145;box-shadow:none}
    #codex-ig .btn::after{content:"";position:absolute;inset:0;opacity:0;transition:opacity .3s;pointer-events:none;
      background:linear-gradient(110deg,transparent 34%,#ffffff40 50%,transparent 66%);background-size:250% 100%;animation:cxShine 2.6s linear infinite}
    #codex-ig .btn:hover::after{opacity:.7}
    #codex-ig .list{max-height:38vh;overflow:auto;border:1px solid var(--steel2);border-radius:11px;padding:5px;margin-top:9px;scrollbar-width:thin}
    #codex-ig .list::-webkit-scrollbar{width:7px}#codex-ig .list::-webkit-scrollbar-thumb{background:#1c2636;border-radius:7px}
    #codex-ig .li{display:flex;gap:8px;align-items:center;padding:5px 6px;border-radius:8px;transition:.15s}
    #codex-ig .li:hover{background:#ffffff06}
    #codex-ig .li a{color:var(--paper);text-decoration:none;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    #codex-ig .li a:hover{color:var(--teal)}
    #codex-ig .li input[type=checkbox]{accent-color:var(--teal);width:15px;height:15px;flex:0 0 auto}
    #codex-ig .star{cursor:pointer;color:#3a4557;font-size:15px;line-height:1;flex:0 0 auto;transition:.15s;user-select:none}
    #codex-ig .star.on{color:#ffcf4d;text-shadow:0 0 10px rgba(255,207,77,.6)}
    #codex-ig .star:hover{transform:scale(1.2)}
    #codex-ig .meter{height:8px;border-radius:6px;background:#0a0f18;border:1px solid #263145;overflow:hidden;margin-top:3px}
    #codex-ig .meter i{display:block;height:100%;border-radius:6px;transition:width .35s cubic-bezier(.16,1,.3,1),background .3s}
    #codex-ig .prog{height:9px;border-radius:6px;background:#0a0f18;border:1px solid #263145;overflow:hidden;margin:10px 0 6px}
    #codex-ig .prog i{display:block;height:100%;width:0;border-radius:6px;background:linear-gradient(90deg,var(--teal),var(--teal2));transition:width .3s}
    #codex-ig .log{margin-top:9px;font-size:12px;color:var(--slate);max-height:16vh;overflow:auto;line-height:1.6}
    #codex-ig .log b{color:var(--paper)}
    #codex-ig .muted{color:var(--slate);font-size:12px;line-height:1.55}
    #codex-ig .muted b{color:var(--paper)}
    #codex-ig .chip{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:999px;font-size:11px;font-weight:700;
      border:1px solid var(--steel);color:var(--slate)}
    #codex-ig .warn{background:#1a0f0d;border:1px solid #43221d;border-radius:11px;padding:9px 11px;color:#ffb4a8;font-size:11.5px;line-height:1.5;margin-top:9px}
    #codex-ig .tsep{display:flex;align-items:center;gap:8px;color:var(--slate);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;margin:14px 0 8px}
    #codex-ig .tsep::before,#codex-ig .tsep::after{content:"";flex:1;height:1px;background:#1b2536}
    #codex-ig .skel{background:linear-gradient(90deg,#0e1522,#151d2b,#0e1522);background-size:200% 100%;animation:cxPulse 1.3s ease infinite;border-radius:11px}
    #codex-ig .load{display:flex;gap:9px;flex-direction:column}
    @keyframes cxRise{from{opacity:0;transform:translateY(-14px) scale(.98)}to{opacity:1;transform:none}}
    @keyframes cxAurora{0%,100%{transform:translate3d(-4%,-3%,0) scale(1.05)}50%{transform:translate3d(4%,3%,0) scale(1.14)}}
    @keyframes cxGrad{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
    @keyframes cxShine{0%{background-position:-150% 0}100%{background-position:250% 0}}
    @keyframes cxPulse{0%{background-position:0% 0}100%{background-position:-200% 0}}
    @media (prefers-reduced-motion:reduce){#codex-ig,#codex-ig *{animation:none!important;transition:none!important}}`;
  document.head.appendChild(S);

  const box = document.createElement("div");
  box.id = "codex-ig";
  box.innerHTML = `
    <div class="hd" id="cx-drag">
      <div class="brand"><div class="logo">C</div><div><b>Codex IG</b><span>growth suite</span></div></div>
      <div class="x" title="fechar">✕</div>
    </div>
    <div class="tabs">
      <div class="tab on" data-t="painel">Painel</div>
      <div class="tab" data-t="limpar">Limpar</div>
      <div class="tab" data-t="achar">Alvos</div>
    </div>
    <div class="body" id="cx-body"></div>`;
  document.body.appendChild(box);
  box.querySelector(".x").onclick = () => { box.remove(); S.remove(); };
  const body = box.querySelector("#cx-body");
  const tabs = [...box.querySelectorAll(".tab")];
  tabs.forEach((t) => (t.onclick = () => { tabs.forEach((x) => x.classList.toggle("on", x === t)); render(t.dataset.t); }));

  // painel arrastável (pointer = mouse + touch)
  (() => {
    const grip = box.querySelector("#cx-drag");
    let sx, sy, ox, oy, drag = false;
    grip.addEventListener("pointerdown", (e) => {
      if (e.target.closest(".x")) return;
      drag = true; sx = e.clientX; sy = e.clientY;
      const r = box.getBoundingClientRect(); ox = r.left; oy = r.top;
      box.style.right = "auto"; box.style.left = ox + "px"; box.style.top = oy + "px";
      grip.setPointerCapture(e.pointerId);
    });
    grip.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const nx = Math.max(4, Math.min(innerWidth - box.offsetWidth - 4, ox + e.clientX - sx));
      const ny = Math.max(4, Math.min(innerHeight - 60, oy + e.clientY - sy));
      box.style.left = nx + "px"; box.style.top = ny + "px";
    });
    grip.addEventListener("pointerup", () => (drag = false));
  })();

  // count-up de números
  function countUp(el, val) {
    if (reduce || val < 1) { el.textContent = nf.format(val); return; }
    const t0 = performance.now(), dur = 850;
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      el.textContent = nf.format(Math.round(val * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  const loading = (msg) => { body.innerHTML = `<div class="load"><div class="muted" id="cx-ld">${esc(msg)}</div><div class="skel" style="height:64px"></div><div class="skel" style="height:64px"></div><div class="skel" style="height:38px"></div></div>`; };
  const setLd = (m) => { const d = body.querySelector("#cx-ld"); if (d) d.textContent = m; };

  // ---------- tabs ----------
  async function render(tab) {
    if (tab === "painel") return painel();
    if (tab === "limpar") return limpar();
    if (tab === "achar") return achar();
  }

  async function painel() {
    loading("Lendo números da conta (só leitura)…");
    await loadGraph(setLd);
    const fol = state.following.length, seg = state.followers.length, nao = state.nonFollowers.length;
    const mut = fol - nao, fas = seg - mut, ratio = seg ? (fol / seg).toFixed(2) : "—";
    const { prev, lost, gained } = snapDiff();
    body.innerHTML = `
      <div class="grid">
        <div class="stat"><b data-cu="${fol}">0</b><span>seguindo</span></div>
        <div class="stat"><b data-cu="${seg}">0</b><span>seguidores</span></div>
        <div class="stat coral"><b data-cu="${nao}">0</b><span>não te seguem de volta</span></div>
        <div class="stat"><b data-cu="${mut}">0</b><span>mútuos (troca real)</span></div>
      </div>
      <div class="grid" style="margin-top:9px">
        <div class="stat"><b data-cu="${fas}">0</b><span>te seguem, você não</span></div>
        <div class="stat"><b>${ratio}</b><span>razão seg./segdores (~1 = saudável)</span></div>
      </div>
      <div class="tsep">Quem deixou de te seguir</div>
      <div id="cx-snap"></div>`;
    body.querySelectorAll("[data-cu]").forEach((el) => countUp(el, +el.dataset.cu));
    const snap = body.querySelector("#cx-snap");
    if (!prev) {
      snap.innerHTML = `<div class="muted">Primeiro uso: salve uma foto da sua lista de seguidores. Na próxima vez o Codex mostra <b>quem saiu</b> e <b>quem chegou</b>.</div>
        <button class="btn btn-ghost" id="cx-snapsave" style="margin-top:9px">Salvar foto de agora</button>`;
    } else {
      const when = new Date(prev.t).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
      snap.innerHTML = `<div class="muted">Comparado com <b>${when}</b>:</div>
        <div class="grid" style="margin-top:8px">
          <div class="stat coral"><b data-cu2="${lost.length}">0</b><span>deixaram de seguir</span></div>
          <div class="stat"><b data-cu2="${gained.length}">0</b><span>novos seguidores</span></div>
        </div>
        ${lost.length ? `<div class="list" style="max-height:22vh">${lost.map((u) => `<div class="li"><span style="color:var(--coral)">−</span><a href="https://instagram.com/${encodeURIComponent(u.username)}" target="_blank">@${esc(u.username)}</a></div>`).join("")}</div>` : ""}
        <button class="btn btn-ghost" id="cx-snapsave" style="margin-top:9px">Atualizar foto para agora</button>`;
      snap.querySelectorAll("[data-cu2]").forEach((el) => countUp(el, +el.dataset.cu2));
    }
    body.querySelector("#cx-snapsave").onclick = (e) => { saveSnap(); e.target.textContent = "Foto salva ✓"; e.target.disabled = true; };
  }

  function riskLevel(delay, cap, batch, pause) {
    let s = 0;
    s += delay < 3 ? 3 : delay < 5 ? 1 : 0;
    s += cap > 300 ? 3 : cap > 150 ? 1 : 0;
    s += batch > 70 ? 2 : batch > 50 ? 1 : 0;
    s += pause < 45 ? 2 : pause < 90 ? 1 : 0;
    if (s <= 1) return { pct: 28, col: "var(--teal)", txt: "Seguro — ritmo humano." };
    if (s <= 4) return { pct: 62, col: "#ffcf4d", txt: "Moderado — dá pra usar, fique de olho." };
    return { pct: 100, col: "var(--coral)", txt: "Agressivo — risco de bloqueio temporário. Você assume." };
  }

  function limpar() {
    loading("Preparando a limpeza…");
    (async () => {
      await loadGraph(setLd);
      const white = wl();
      const nfList = state.nonFollowers.filter((u) => !white.has(u.pk));
      const prot = state.nonFollowers.length - nfList.length;
      body.innerHTML = `
        <div class="muted">Você segue <b>${nf.format(state.following.length)}</b> · te seguem <b>${nf.format(state.followers.length)}</b> · não retribuem <b style="color:var(--coral2)">${nf.format(state.nonFollowers.length)}</b>${prot ? ` · <span class="chip">★ ${prot} protegidos</span>` : ""}</div>
        <div class="tsep">Ritmo (você escolhe)</div>
        <div class="row">
          <label class="fld">Quantidade<input id="cx-cap" type="number" value="150" min="1"></label>
          <label class="fld">Delay (s)<input id="cx-delay" type="number" value="4" min="2"></label>
          <label class="fld">Lote<input id="cx-batch" type="number" value="50" min="5"></label>
          <label class="fld">Pausa (s)<input id="cx-pause" type="number" value="120" min="20"></label>
        </div>
        <div style="margin-top:9px"><div class="meter"><i id="cx-riski"></i></div><div class="muted" id="cx-riskt" style="margin-top:4px"></div></div>
        <input id="cx-search" placeholder="filtrar por @ ou nome…" style="width:100%;margin-top:10px">
        <div class="muted" style="margin-top:8px"><span id="cx-all" style="cursor:pointer;color:var(--teal);font-weight:700">marcar todos</span> · <span id="cx-none" style="cursor:pointer;color:var(--teal);font-weight:700">nenhum</span> · <span class="chip" id="cx-count">0 marcados</span> <span class="muted" style="font-size:10.5px">★ = proteger (nunca dar unfollow)</span></div>
        <div class="list" id="cx-list"></div>
        <div class="prog" id="cx-prog" style="display:none"><i></i></div>
        <button class="btn btn-coral" id="cx-go" style="margin-top:6px">Deixar de seguir marcados</button>
        <div class="log" id="cx-log"></div>`;
      const listEl = body.querySelector("#cx-list");
      const countEl = body.querySelector("#cx-count");
      const drawList = (filter = "") => {
        const f = filter.trim().toLowerCase();
        const rows = nfList.filter((u) => !f || u.username.toLowerCase().includes(f) || (u.full || "").toLowerCase().includes(f));
        listEl.innerHTML = rows.length ? rows.map((u) => `<div class="li"><input type="checkbox" class="cx-ck" data-pk="${u.pk}" data-u="${esc(u.username)}" checked><a href="https://instagram.com/${encodeURIComponent(u.username)}" target="_blank">@${esc(u.username)}${u.verif ? " ✔" : ""}${u.priv ? " 🔒" : ""}</a><span class="star" data-pk="${u.pk}" title="proteger">★</span></div>`).join("") : `<div class="muted" style="padding:8px">Ninguém encontrado. ${nfList.length ? "" : "Todo mundo que você segue já te retribui 🎉"}</div>`;
        wireList();
      };
      const updCount = () => { const n = listEl.querySelectorAll(".cx-ck:checked").length; countEl.textContent = `${n} marcados`; };
      function wireList() {
        listEl.querySelectorAll(".cx-ck").forEach((c) => (c.onchange = updCount));
        listEl.querySelectorAll(".star").forEach((s) => (s.onclick = () => {
          const on = toggleWl(s.dataset.pk);
          if (on) { // protegeu -> some da lista de limpeza
            const i = nfList.findIndex((u) => u.pk === s.dataset.pk);
            if (i >= 0) nfList.splice(i, 1);
            drawList(body.querySelector("#cx-search").value);
          }
        }));
        updCount();
      }
      drawList();
      body.querySelector("#cx-search").oninput = (e) => drawList(e.target.value);
      body.querySelector("#cx-all").onclick = () => { listEl.querySelectorAll(".cx-ck").forEach((c) => (c.checked = true)); updCount(); };
      body.querySelector("#cx-none").onclick = () => { listEl.querySelectorAll(".cx-ck").forEach((c) => (c.checked = false)); updCount(); };

      const riskI = body.querySelector("#cx-riski"), riskT = body.querySelector("#cx-riskt");
      const upRisk = () => {
        const d = +body.querySelector("#cx-delay").value, c = +body.querySelector("#cx-cap").value, b = +body.querySelector("#cx-batch").value, p = +body.querySelector("#cx-pause").value;
        const r = riskLevel(d, c, b, p);
        riskI.style.width = r.pct + "%"; riskI.style.background = r.col; riskT.innerHTML = `<b style="color:${r.col}">Risco:</b> ${r.txt}`;
      };
      ["cx-delay", "cx-cap", "cx-batch", "cx-pause"].forEach((id) => (body.querySelector("#" + id).oninput = upRisk));
      upRisk();

      const prog = body.querySelector("#cx-prog"), progI = prog.querySelector("i");
      const log = (m) => { const d = body.querySelector("#cx-log"); d.innerHTML = m + "<br>" + d.innerHTML; };
      const btn = body.querySelector("#cx-go");
      let stop = false;
      btn.onclick = async () => {
        if (btn.dataset.run) { stop = true; btn.textContent = "parando…"; return; }
        const delay = Math.max(2, +body.querySelector("#cx-delay").value) * 1000;
        const cap = Math.max(1, +body.querySelector("#cx-cap").value);
        const BATCH = Math.max(5, +body.querySelector("#cx-batch").value);
        const PAUSE = Math.max(20, +body.querySelector("#cx-pause").value);
        const white = wl();
        const marked = [...body.querySelectorAll(".cx-ck:checked")].filter((c) => !white.has(c.dataset.pk)).slice(0, cap);
        if (!marked.length) return alert("Marque pelo menos uma conta.");
        if (!confirm(`Deixar de seguir ${marked.length} conta(s)?\n~${delay / 1000}s cada + pausa de ${PAUSE}s a cada ${BATCH}.\nClique de novo pra PARAR a qualquer momento.`)) return;
        btn.dataset.run = "1"; btn.textContent = "PARAR"; prog.style.display = "block";
        let ok = 0;
        for (let i = 0; i < marked.length; i++) {
          if (stop) break;
          const ck = marked[i];
          try {
            const r = await fetch(`https://www.instagram.com/api/v1/friendships/destroy/${ck.dataset.pk}/`, { method: "POST", headers: { ...H, "x-csrftoken": csrf, "content-type": "application/x-www-form-urlencoded" }, credentials: "include" });
            if (r.ok) { ok++; ck.closest(".li").style.opacity = .3; log(`✓ @${esc(ck.dataset.u)} <span class="muted">(${ok}/${marked.length})</span>`); }
            else { log(`⚠ @${esc(ck.dataset.u)} HTTP ${r.status}`); if (r.status === 429 || r.status === 400) { log("<b style='color:var(--coral2)'>IG bloqueou temporário → PARANDO. Volte amanhã.</b>"); break; } }
          } catch (e) { log("erro: " + esc(e.message)); }
          progI.style.width = ((i + 1) / marked.length * 100) + "%";
          if (ok > 0 && ok % BATCH === 0 && i < marked.length - 1) {
            for (let s = PAUSE; s > 0 && !stop; s--) { btn.textContent = `PAUSA ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")} — clique = PARAR`; await sleep(1000); }
            btn.textContent = "PARAR";
          } else await sleep(jitter(delay));
        }
        log(`<b>Fim: ${ok} deixados de seguir.</b> ${ok < marked.length && !stop ? "Rode de novo amanhã pro resto." : ""}`);
        btn.dataset.run = ""; btn.textContent = "Deixar de seguir marcados"; stop = false;
      };
    })();
  }

  function achar() {
    body.innerHTML = `
      <div class="muted">Concorrentes/referências do teu nicho (sem @, separados por vírgula):</div>
      <input id="cx-in" placeholder="ex: davinciresolve.br, editor.pro…" style="width:100%;margin:8px 0">
      <div class="row">
        <label class="fld">Amostra/conta<input id="cx-samp" type="number" value="300" min="50" max="2000"></label>
        <label class="fld">Segmento<select id="cx-seg">${Object.keys(MODELOS).map((k) => `<option>${esc(k)}</option>`).join("")}</select></label>
      </div>
      <button class="btn btn-teal" id="cx-find" style="margin-top:10px">Buscar público real</button>
      <div id="cx-model" class="stat" style="margin-top:12px"></div>
      <div class="muted" id="cx-flog" style="margin-top:9px"></div>
      <div class="list" id="cx-flist" style="display:none"></div>
      <button class="btn btn-ghost" id="cx-copy" style="margin-top:9px;display:none">Copiar lista</button>`;
    const model = () => { const seg = body.querySelector("#cx-seg").value; body.querySelector("#cx-model").innerHTML = `<span style="color:var(--teal);font-weight:700">Comentário-modelo (${esc(seg)})</span><br><span style="color:var(--paper)">"${esc(MODELOS[seg])}"</span><br><span class="muted">Adapte ao post. Curta 2-3 antes. 10-15/dia, genuíno — nunca em massa por script (é o que bane).</span>`; };
    body.querySelector("#cx-seg").onchange = model; model();
    let found = [];
    const flog = (m) => (body.querySelector("#cx-flog").innerHTML = m);
    body.querySelector("#cx-find").onclick = async () => {
      const names = body.querySelector("#cx-in").value.split(",").map((s) => s.trim().replace(/^@/, "")).filter(Boolean);
      if (!names.length) return alert("Digite ao menos um @ de concorrente.");
      const cap = Math.min(2000, Math.max(50, +body.querySelector("#cx-samp").value));
      flog("Lendo quem você já segue…");
      await loadGraph();
      const already = new Set(state.following.map((u) => u.pk));
      const seen = new Set(), agg = [];
      for (const n of names) {
        flog(`Buscando @${esc(n)}…`);
        const prof = await uidOf(n);
        if (!prof) { flog(`⚠ @${esc(n)} não encontrado (pulei).`); continue; }
        flog(`@${esc(n)}: ${nf.format(prof.edge_followed_by?.count ?? 0)} seguidores. Amostra de ${cap}…`);
        for (const u of await followersOf(prof.id, cap)) {
          if (seen.has(u.pk) || already.has(u.pk) || u.pk === uid) continue;
          seen.add(u.pk); agg.push({ ...u, via: n });
        }
      }
      agg.sort((a, b) => (Number(a.priv) - Number(b.priv)) || (Number(!b.full) - Number(!a.full)) || (Number(a.verif) - Number(b.verif)));
      found = agg;
      flog(`<b style="color:var(--teal)">${nf.format(agg.length)} alvos reais</b> (tirei quem você já segue). Abra, curta 2-3, comente o modelo.`);
      const list = body.querySelector("#cx-flist");
      list.style.display = "block";
      list.innerHTML = agg.slice(0, 400).map((u, i) => `<div class="li" style="align-items:flex-start"><span style="color:#556;width:26px;flex:0 0 auto">${i + 1}</span><a href="https://instagram.com/${encodeURIComponent(u.username)}" target="_blank" style="white-space:normal">@${esc(u.username)}${u.priv ? " 🔒" : ""}${u.verif ? " ✔" : ""}<br><span style="color:#667;font-size:11px">${esc(u.full || "")} · via @${esc(u.via)}</span></a></div>`).join("");
      body.querySelector("#cx-copy").style.display = "block";
    };
    body.querySelector("#cx-copy").onclick = () => {
      const txt = found.map((u, i) => `${i + 1}. @${u.username} — ${u.full || ""} (via @${u.via}) https://instagram.com/${u.username}`).join("\n");
      navigator.clipboard.writeText(txt).then(() => flog("Lista copiada ✓")).catch(() => flog("Não consegui copiar (permissão do navegador)."));
    };
  }

  render("painel");
  console.log("%cCodex IG aberto no canto superior direito.", "color:#00e5c9;font-weight:700");
})();
