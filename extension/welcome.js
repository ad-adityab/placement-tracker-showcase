(() => {
  const $ = id => document.getElementById(id);
  const PORTAL = "https://placements.isb.edu/#/student/home";
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;"
  }[c]));
  let st = {}, connecting = false;
  const KEYS = [ "snapshot", "progress", "details", "lastCheck", "gcal", "calProg", "calSync", "lastError", "paused", "checkRun", "firstRunArmed", "needPortal", "loginState" ];
  function draw() {
    const snap = st.snapshot || null, p = st.progress || null, g = st.gcal || {}, cal = !!g.connected;
    const apps = snap && snap.apps, jobs = snap && snap.jobs, dash = snap && (snap.dash || []).length;
    const read = !!st.lastCheck, due = p && p.due ? p.due : 0, done = p && p.due ? p.done : 0;
    const inCal = Object.keys(st.calSync || {}).length, cp = st.calProg;
    const calDone = cal && !!g.lastSync && !cp;
    const loggedOut = !snap && (!!st.loginState || /not logged in|login expired/.test(String(st.lastError || "")));
    const recent = Object.keys(st.details || {}).slice(-2).map(id => {
      const j = snap && (snap.jobs || []).concat(snap.apps || []).find(x => x.id === id);
      return j ? PT.shortFirm(j.company) : "";
    }).filter(Boolean);
    const row = (k, t, n, sm) => `<div class="st ${k}"><i>${k === "d" ? "✓" : ""}</i><span>${esc(t)}${sm ? `<small>${esc(sm)}</small>` : ""}</span><span class="n2">${esc(n || "")}</span></div>`;
    const lists = !!(apps || jobs);
    $("items").innerHTML = row(apps ? "d" : loggedOut ? "n" : "w", "Your applications", apps ? String(apps.length) : "") + row(jobs ? "d" : lists ? "w" : "n", "Open jobs", jobs ? String(jobs.length) : "") + row(dash ? "d" : lists ? "w" : "n", "Your counters", dash ? `${dash} pool${dash === 1 ? "" : "s"}` : "") + row(read ? "d" : due ? "w" : "n", "Job details", read ? (n => `${n} of ${n}`)(Object.keys(st.details || {}).length) : due ? `${done} of ${due}` : "", !read && due && done < due ? recent.join(", ") + (recent.length ? "…" : "") : "") + (cal ? row(calDone ? "d" : "w", "Deadlines into your Google Calendar", calDone ? `${inCal} of ${inCal}` : cp ? `${cp.done} of ${cp.total}` : "") : row("n opt", "Google Calendar", "Off", "Optional · turn it on here or from the 📅 Calendar switch on the portal's right edge"));
    $("warn").innerHTML = loggedOut ? `<div class="warnbox">🔑 Log in to the placement portal so the tracker can read your applications.<a href="${PORTAL}" target="_blank" rel="noopener" id="login">Open the portal ↗</a></div>` : "";
    const parts = [ apps ? 1 : 0, jobs ? 1 : 0, dash ? 1 : 0, read ? 1 : due ? done / due : 0 ].concat(cal ? [ calDone ? 1 : cp && cp.total ? cp.done / cp.total : 0 ] : []);
    const all = read && (calDone || !cal), pct = Math.round(parts.reduce((a, b) => a + b, 0) / parts.length * 100);
    $("bar").style.width = Math.max(3, pct) + "%";
    $("bar").classList.toggle("ok", all);
    const secs = all && st.firstRunArmed ? Math.max(1, Math.round((Math.max(st.lastCheck || 0, g.lastSync || 0) - st.firstRunArmed) / 1e3)) : 0;
    $("sub").textContent = all ? secs && secs < 3600 ? `Done in ${secs < 90 ? secs + " seconds" : Math.round(secs / 60) + " minutes"}` : "Done" : loggedOut || !snap && st.needPortal ? "Waiting for the placement portal" : "Reading your own portal data · about a minute";
    $("hint").hidden = true;
    const frac = read ? 1 : due ? done / due : 0, ready = read && (calDone || !cal);
    const needOpen = !snap && !loggedOut && !!st.needPortal;
    const [msg, cls, label] = loggedOut ? [ "🔑 Log in to the placement portal so the tracker can read it.", "login", "Log in to placement portal ↗" ] : needOpen ? [ "👋 Open the placement portal once: the tracker starts reading as soon as it's open.", "login", "Go to placement portal ↗" ] : ready ? [ "✅ Your portal is ready.", "ready", "Go to placement portal ↗" ] : frac >= .4 ? [ "✨ Your portal is getting ready. You can have a look now.", "look", "Go to placement portal ↗" ] : [ "⏳ Getting your portal ready…", "wait", "Go to placement portal ↗" ];
    const go = `<span class="gm">${msg}</span><a class="gb ${cls}" href="${PORTAL}" target="_blank" rel="noopener">${label}</a>`;
    if ($("go").dataset.h !== go) {
      $("go").innerHTML = go;
      $("go").dataset.h = go;
      $("go").className = "go " + cls;
    }
    $("done").innerHTML = all ? `<div class="allset">✓ All set</div>` : "";
    const b = $("connect");
    if (cal) {
      b.className = "big done";
      b.disabled = true;
      b.textContent = "✓ Google Calendar connected";
      $("connectNote").hidden = true;
    } else {
      b.className = "big opt";
      b.disabled = connecting;
      b.textContent = connecting ? "Opening Google…" : "📅 Also put deadlines in Google Calendar (optional)";
      $("connectNote").hidden = false;
    }
    if (all) {
      $("lead").textContent = "You're set up. Here's what to try first.";
      $("what").innerHTML = (cal ? `<li><span class="e">📅</span><b>Open Google Calendar</b>Look for the “Placement Tracker” calendar: ${inCal} ${inCal === 1 ? "entry is" : "entries are"} in it.</li>` : `<li><span class="e">📅</span><b>Deadlines in your Google Calendar, if you want</b>Turn it on any time; everything else works without it.</li>`) + `\n        <li><span class="e">✨</span><b>Open the portal</b>Manage All Jobs now shows every job in one list, and Manage Applications your applications in order.</li>\n        <li><span class="e">❓</span><b>Take the 1-minute tour</b>❓ Tour at the bottom of the portal's pages plays it any time.</li>`;
    }
    document.title = (all ? "✓ " : "") + "Welcome · Placement Tracker";
  }
  $("connect").addEventListener("click", async () => {
    connecting = true;
    draw();
    const r = await chrome.runtime.sendMessage({
      type: "PT_GCAL_CONNECT"
    }).catch(() => null);
    connecting = false;
    draw();
    if (r && r.ok === false) $("connectNote").textContent = ((st.gcal || {}).error || "Google didn't finish") + ". Try again.";
  });
  chrome.storage.local.get(KEYS).then(s => {
    st = s;
    draw();
  });
  chrome.storage.onChanged.addListener((ch, area) => {
    if (area !== "local") return;
    let n = false;
    for (const k of KEYS) if (ch[k]) {
      st[k] = ch[k].newValue;
      n = true;
    }
    if (n) draw();
  });
})();