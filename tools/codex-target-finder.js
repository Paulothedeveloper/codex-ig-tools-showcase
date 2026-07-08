/* ============================================================
   CODEX TARGET FINDER — acha contas REAIS pra você engajar.
   Paulocodex · roda no CONSOLE do instagram.com logado.
   Dá 1+ @concorrente/referência do teu nicho → devolve os
   seguidores DELES (= teu público) como lista clicável, já
   marcando quem VOCÊ JÁ segue. Você abre, curte 2-3 e comenta
   genuíno (com o modelo do segmento). NÃO auto-comenta (isso bane).
   USO: instagram.com logado → F12 → Console → cola TUDO → Enter.
   ============================================================ */
(async () => {
  const APPID = "936619743392459";
  const uid  = document.cookie.match(/ds_user_id=(\d+)/)?.[1];
  const csrf = document.cookie.match(/csrftoken=([^;]+)/)?.[1];
  if (!uid) return alert("Faça login no instagram.com nesta aba primeiro.");
  const H = { "x-ig-app-id": APPID };
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); // API do IG é untrusted → escapar antes de innerHTML (anti-XSS na SUA sessão)

  // comentários-modelo por segmento (nota "02 - Contas-alvo"). Adapte ao post real.
  const MODELOS = {
    "Editor / criador":     "qual node você usou pro skin tone aí? ficou limpo.",
    "Dev / maker":          "boa! tá usando o quê no back? montei um parecido semana passada.",
    "Dono de negócio":      "isso resolveria mesmo — quanto tempo levou pra colocar no ar?",
    "Referência do nicho":  "trabalho consistente. como você organiza o acervo de projeto?"
  };

  async function uidOf(username) {
    const r = await fetch(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`, { headers: H, credentials: "include" });
    if (!r.ok) return null;
    const j = await r.json(); return j?.data?.user || null;
  }
  async function followersOf(pk, cap) {                               // amostra dos seguidores do concorrente
    let out = [], next = "", page = 0;
    do {
      const url = `https://www.instagram.com/api/v1/friendships/${pk}/followers/?count=100${next ? "&max_id=" + next : ""}`;
      const r = await fetch(url, { headers: H, credentials: "include" });
      if (!r.ok) { console.error("followers", r.status); break; }
      const j = await r.json();
      out.push(...(j.users || []).map(u => ({ pk: u.pk, username: u.username, full: u.full_name, priv: u.is_private, verif: u.is_verified })));
      next = j.next_max_id || ""; console.log(`  seguidores: ${out.length}...`);
      await sleep(700);
    } while (next && out.length < cap && page++ < 60);
    return out;
  }
  async function myFollowing() {                                     // pra marcar quem eu já sigo (não sugerir de novo)
    let out = [], next = "", page = 0;
    do {
      const url = `https://www.instagram.com/api/v1/friendships/${uid}/following/?count=200${next ? "&max_id=" + next : ""}`;
      const r = await fetch(url, { headers: H, credentials: "include" });
      if (!r.ok) break; const j = await r.json();
      out.push(...(j.users || []).map(u => u.pk)); next = j.next_max_id || "";
      await sleep(500);
    } while (next && page++ < 200);
    return new Set(out);
  }

  // ---- painel ----
  document.getElementById("codex-finder")?.remove();
  const box = document.createElement("div");
  box.id = "codex-finder";
  box.style.cssText = "position:fixed;top:16px;right:16px;width:380px;max-height:90vh;overflow:auto;z-index:999999;background:#0A0F17;color:#F5F2EB;border:1px solid #00C4B4;border-radius:14px;padding:14px;font:13px/1.45 system-ui;box-shadow:0 12px 40px #000a";
  box.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <b style="color:#00E5C9">Codex Target Finder</b>
      <span id="cf-x" style="cursor:pointer;color:#FF6B35">fechar ✕</span>
    </div>
    <div style="font-size:12px;color:#9aa;margin-bottom:8px">Concorrentes/referências do teu nicho (sem @, vírgula):</div>
    <input id="cf-in" placeholder="ex: editoraudiovisual, davinciresolve.br" style="width:100%;box-sizing:border-box;background:#111;color:#fff;border:1px solid #333;border-radius:8px;padding:8px;margin-bottom:8px">
    <div style="display:flex;gap:8px;align-items:center;font-size:12px;margin-bottom:8px">
      <label>Amostra/conta <input id="cf-cap" type="number" value="300" min="50" max="1500" style="width:60px;background:#111;color:#fff;border:1px solid #333;border-radius:6px"></label>
      <label>Segmento
        <select id="cf-seg" style="background:#111;color:#fff;border:1px solid #333;border-radius:6px;padding:3px">
          ${Object.keys(MODELOS).map(k => `<option>${k}</option>`).join("")}
        </select>
      </label>
    </div>
    <button id="cf-go" style="width:100%;padding:10px;background:#00C4B4;color:#031;border:0;border-radius:10px;font-weight:800;cursor:pointer">Buscar alvos reais</button>
    <div id="cf-modelo" style="margin-top:10px;font-size:12px;color:#cde;background:#0e1622;border:1px solid #1c2a3a;border-radius:8px;padding:8px"></div>
    <div id="cf-log" style="margin-top:8px;font-size:12px;color:#9aa"></div>
    <div id="cf-list" style="margin-top:8px;max-height:44vh;overflow:auto;border:1px solid #222;border-radius:8px;padding:6px"></div>
    <button id="cf-copy" style="display:none;width:100%;margin-top:8px;padding:9px;background:#FF6B35;color:#fff;border:0;border-radius:10px;font-weight:700;cursor:pointer">Copiar lista (links) p/ colar no vault</button>
  `;
  document.body.appendChild(box);
  box.querySelector("#cf-x").onclick = () => box.remove();
  const log = (m) => box.querySelector("#cf-log").innerHTML = m;
  const showModelo = () => {
    const seg = box.querySelector("#cf-seg").value;
    box.querySelector("#cf-modelo").innerHTML = `<b style="color:#00E5C9">Comentário-modelo (${seg}):</b><br>"${MODELOS[seg]}"<br><span style="color:#778">Adapte ao post real. Curta 2-3 antes. 10-15/dia, genuíno.</span>`;
  };
  box.querySelector("#cf-seg").onchange = showModelo; showModelo();

  let found = [];
  box.querySelector("#cf-go").onclick = async () => {
    const names = box.querySelector("#cf-in").value.split(",").map(s => s.trim().replace(/^@/, "")).filter(Boolean);
    if (!names.length) return;
    const cap = Math.min(1500, +box.querySelector("#cf-cap").value);
    log("Lendo quem VOCÊ já segue (pra não repetir)...");
    const already = await myFollowing();
    const seen = new Set(), agg = [];
    for (const n of names) {
      log(`Buscando @${n}...`);
      const prof = await uidOf(n);
      if (!prof) { log(`⚠ @${n} não encontrado (pulei).`); continue; }
      log(`@${n}: ${prof.edge_followed_by?.count ?? "?"} seguidores. Puxando amostra de ${cap}...`);
      const fol = await followersOf(prof.id, cap);
      for (const u of fol) {
        if (seen.has(u.pk) || already.has(u.pk) || u.pk === uid) continue;
        seen.add(u.pk); agg.push({ ...u, via: n });
      }
    }
    // prioriza: público (não privado) + tem nome real + não verificado (verificado raramente responde)
    agg.sort((a, b) => (Number(a.priv) - Number(b.priv)) || (Number(!b.full) - Number(!a.full)) || (Number(a.verif) - Number(b.verif)));
    found = agg;
    log(`<b style="color:#00E5C9">${agg.length} alvos reais</b> (já tirei quem você segue). Abra, curta 2-3, comente o modelo adaptado.`);
    const list = box.querySelector("#cf-list");
    list.innerHTML = agg.slice(0, 400).map((u, i) =>
      `<div style="display:flex;gap:6px;align-items:center;padding:3px 0;border-bottom:1px solid #161d29">
         <span style="color:#556;width:26px">${i + 1}</span>
         <a href="https://instagram.com/${encodeURIComponent(u.username)}" target="_blank" style="color:#F5F2EB;text-decoration:none;flex:1">@${esc(u.username)}${u.priv ? " 🔒" : ""}${u.verif ? " ✔" : ""}<br><span style="color:#667;font-size:11px">${esc(u.full || "")} · via @${esc(u.via)}</span></a>
       </div>`).join("");
    box.querySelector("#cf-copy").style.display = "block";
  };
  box.querySelector("#cf-copy").onclick = () => {
    const txt = found.map((u, i) => `${i + 1}. @${u.username} — ${u.full || ""} (via @${u.via}) https://instagram.com/${u.username}`).join("\n");
    navigator.clipboard.writeText(txt).then(() => log("Lista copiada — cola no vault '02 - Contas-alvo'."));
  };
  console.log("Codex Target Finder aberto no canto superior direito.");
})();
