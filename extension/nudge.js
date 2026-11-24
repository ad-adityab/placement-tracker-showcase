(() => {
  if (window.__ptNudgeLoaded) return;
  window.__ptNudgeLoaded = true;
  const ROUTES = [ [ "home", /^#\/student\/home\b/ ], [ "jobs", /^#\/student\/student-jobs\b/ ], [ "apps", /^#\/student\/my-applications\b/ ] ];
  const route = () => {
    const h = location.hash || "";
    for (const [k, re] of ROUTES) if (re.test(h)) return k;
    return null;
  };
  const DAY = 864e5, today = () => new Date(Date.now() + 5.5 * 36e5).toISOString().slice(0, 10);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
  const count = (action, feature) => {
    try {
      chrome.runtime.sendMessage({
        type: "PT_COUNT",
        name: "pt_nudge",
        params: {
          action: action,
          feature: feature
        }
      }).catch(() => {});
    } catch (e) {}
  };
  const KEYS = [ "nudgeOff", "nudge", "nudgeUsed", "coolUI", "snapshot", "hiddenJobs", "plus", "seenShortlists", "listView", "gsheet", "ffAnswers", "ffProfile", "whatsNewDue", "gcal", "tourSeen" ];
  let st = null;
  const N = () => Object.assign({
    day: "",
    kind: "",
    closed: {},
    never: {},
    n3: {
      shown: 0,
      keep: 0,
      at: 0
    },
    tips: {},
    tipAt: 0,
    wnLater: 0,
    coolOffSince: 0,
    shownDay: {}
  }, st && st.nudge || {});
  const save = n => chrome.storage.local.set({
    nudge: n
  }).catch(() => {});
  const used = () => Object.assign({}, st && st.nudgeUsed || {});
  const markUsed = k => {
    const u = used();
    if (u[k]) return;
    u[k] = Date.now();
    chrome.storage.local.set({
      nudgeUsed: u
    }).catch(() => {});
  };
  const visitCool = () => {
    try {
      return sessionStorage.getItem("ptCoolVisit") === "1";
    } catch (e) {
      return false;
    }
  };
  const coolSetting = () => !(st && st.coolUI === false);
  const coolNow = () => coolSetting() || visitCool();
  const TIPS = [ [ "tip_list", "list", "☰ <b>List view</b>: every job in one table, grouped by when it closes.", "Show me" ], [ "tip_search", "search", "Press <kbd>/</kbd> to search every job: open, applied, closed and Not interested.", "Show me" ], [ "tip_upcoming", "upcoming", "📅 <b>Upcoming</b> on the right shows the next two weeks of deadlines, steps and shortlists.", "Show me" ], [ "tip_qa", "qa", "🗨 <b>Q&amp;A</b> on the right has the placement group's answered questions, by firm.", "Show me" ], [ "tip_sheet", "sheet", "📊 The green icon on the right makes <b>your own Google Sheet</b> of every job, for your own filters.", "Show me" ], [ "tip_form", "form", "📝 Answers you give on a recruiter's form fill the next one by themselves. See them in the extension's window → Saved answers.", "" ] ];
  function urgent() {
    const snap = st && st.snapshot;
    if (!snap) return null;
    const now = Date.now(), hid = PT.effectiveHidden(st), t = today();
    const soon = PT.openJobs(snap, now).filter(j => !hid[j.id] && j.deadline && (PT.parseIST(j.deadline) || 0) - now < DAY);
    if (soon.length) {
      const all = soon.every(j => new Date((PT.parseIST(j.deadline) || 0) + 5.5 * 36e5).toISOString().slice(0, 10) === t);
      return {
        text: `⏰ ${soon.length} close${soon.length === 1 ? "s" : ""} ${all ? "today" : "within 24 h"}`,
        go: "#/student/student-jobs",
        btn: "See in Cool UI"
      };
    }
    const seen = st.seenShortlists;
    if (!seen) return null;
    const fresh = (snap.apps || []).filter(a => (a.statusCode === 2 || a.statusCode === 8) && !seen[a.id]);
    if (fresh.length) return {
      text: `🎉 ${fresh.length === 1 ? "A new shortlist" : fresh.length + " new shortlists"}`,
      go: "#/student/my-applications",
      btn: "See in Cool UI"
    };
    return null;
  }
  function pickTip(n) {
    const u = used();
    if (st.listView !== false) u.list = 1;
    if (st.gsheet && st.gsheet.id) u.sheet = 1;
    if (st.ffAnswers && Object.keys(st.ffAnswers).length || st.ffProfile) u.form = 1;
    return TIPS.find(([k, f]) => !u[f] && !n.tips[k]) || null;
  }
  function choose() {
    if (!st || st.nudgeOff || PT.dead) return null;
    if (!(st.gcal && st.gcal.connected) || st.plus && st.plus.active) return null;
    const r = route();
    if (!r) return null;
    if (document.querySelector(".pt-ff-bar, #pt-tour, .pt-tour, #pt-firstrun, #pt-fr")) return null;
    const n = N(), d = today();
    if (n.day === d) {
      if (n.closed[n.kind] === d || n.never[n.kind] || n.never[n.kind === "urgent" ? "urgent" : n.kind]) return null;
      return fits(n.kind, n, r);
    }
    for (const k of [ "urgent", "whats_new", "try_cool", "tip" ]) {
      if (n.never[k] || n.closed[k] === d) continue;
      const c = fits(k, n, r);
      if (c) return c;
    }
    return null;
  }
  function fits(k, n, r) {
    if (k === "urgent") {
      if (coolNow()) return null;
      const u = urgent();
      return u ? {
        k: k,
        u: u
      } : null;
    }
    if (k === "whats_new") {
      if (!st.whatsNewDue || n.wnDone) return null;
      return {
        k: k
      };
    }
    if (k === "try_cool") {
      if (coolSetting() || visitCool() || r !== "jobs" || !n.coolOffSince || Date.now() - n.coolOffSince < 7 * DAY) return null;
      if (n.n3.shown >= 3 || n.n3.keep >= 2 || n.n3.at && Date.now() - n.n3.at < 7 * DAY && n.day !== today()) return null;
      return {
        k: k
      };
    }
    if (k === "tip") {
      if (!coolNow() || n.never.tip || n.tipAt && Date.now() - n.tipAt < 7 * DAY && n.day !== today()) return null;
      const t = n.day === today() && n.tipKey ? TIPS.find(x => x[0] === n.tipKey) : pickTip(n);
      return t ? {
        k: k,
        t: t
      } : null;
    }
    return null;
  }
  function claim(c) {
    const n = N(), d = today();
    if (n.day === d && n.kind === c.k) return;
    n.day = d;
    n.kind = c.k;
    if (c.k === "try_cool") {
      n.n3.shown++;
      n.n3.at = Date.now();
    }
    if (c.k === "tip") {
      n.tipAt = Date.now();
      n.tipKey = c.t[0];
      n.tips[c.t[0]] = Date.now();
    }
    save(n);
    count("shown", c.k === "tip" ? c.t[0] : c.k);
  }
  const feat = c => c.k === "tip" ? c.t ? c.t[0] : N().tipKey || "tip_list" : c.k;
  let current = null;
  function clear(except) {
    if (except !== "card") document.querySelectorAll("#pt-nudge-card").forEach(e => e.remove());
    if (except !== "tip") document.querySelectorAll("#pt-nudge-tip").forEach(e => e.remove());
  }
  window.__ptNudgePill = () => {
    if (!current || current.k !== "urgent") return null;
    const u = current.u;
    return {
      k: "urgent:" + u.text,
      html: `<span>${esc(u.text)}</span><button data-nudge="use">${esc(u.btn)}</button><button class="ptx" data-nudge="close" title="Not now (gone for today)" aria-label="Close">✕</button>`
    };
  };
  window.__ptNudge = (what, btn) => act(what);
  function card(html) {
    let c = document.getElementById("pt-nudge-card");
    if (!c) {
      c = document.createElement("div");
      c.id = "pt-nudge-card";
      c.setAttribute("role", "dialog");
      c.setAttribute("aria-label", "Placement Tracker");
      document.body.appendChild(c);
    } else if (c.parentElement !== document.body) document.body.appendChild(c);
    if (c.dataset.html !== html) {
      c.innerHTML = html;
      c.dataset.html = html;
    }
    const p = document.getElementById("pt-pill"), on = document.getElementById("pt-cool") || document.querySelector(".alain-default__content");
    const r = p && p.getBoundingClientRect().width ? p.getBoundingClientRect() : on ? on.getBoundingClientRect() : null;
    const x = r ? Math.round(r.left + r.width / 2) : Math.round(innerWidth / 2), y = p && p.getBoundingClientRect().height ? Math.round(innerHeight - p.getBoundingClientRect().top + 14) : 76;
    if (c.style.left !== x + "px") c.style.left = x + "px";
    if (c.style.bottom !== y + "px") c.style.bottom = y + "px";
  }
  function tipBubble(html) {
    let b = document.getElementById("pt-nudge-tip");
    if (!b) {
      b = document.createElement("div");
      b.id = "pt-nudge-tip";
      b.setAttribute("role", "status");
      document.body.appendChild(b);
    }
    if (b.dataset.html !== html) {
      b.innerHTML = html;
      b.dataset.html = html;
    }
    const p = document.getElementById("pt-pill");
    if (!p) {
      b.remove();
      return;
    }
    const r = p.getBoundingClientRect();
    b.style.left = Math.round(r.left + r.width / 2) + "px";
    b.style.bottom = Math.round(innerHeight - r.top + 12) + "px";
  }
  const X = `<button type="button" class="ndx" data-nudge="close" title="Not now (gone for today)" aria-label="Close">✕</button>`;
  function draw() {
    if (PT.dead) {
      clear();
      return;
    }
    const c = choose(), was = current && current.k + (current.u ? current.u.text : "");
    current = c;
    if (c) claim(c);
    if ((c && c.k + (c.u ? c.u.text : "")) !== was && window.__ptPillRefresh) window.__ptPillRefresh();
    if (!c || c.k === "urgent") {
      clear();
      return;
    }
    if (c.k === "tip") {
      clear("tip");
      tipBubble(`${X}<h4>💡 Did you know?</h4><p>${c.t[2]}</p><div class="nact">${c.t[3] ? `<button type="button" class="nbp" data-nudge="use">${c.t[3]}</button>` : `<button type="button" class="nbp" data-nudge="close">Got it</button>`}<button type="button" class="nlink" data-nudge="never">Don't show tips</button></div>`);
      return;
    }
    clear("card");
    if (c.k === "try_cool") card(`${X}<h4>Your jobs, easier to scan</h4><p>Cool UI shows these jobs as cards, sorted by when they close, with your counters, pay and the JD summary.</p><div class="nact"><button type="button" class="nbp" data-nudge="use">Try it for this visit</button><button type="button" class="nb" data-nudge="later">Keep it off</button><button type="button" class="nlink" data-nudge="never">Don't show again</button></div>`);
    if (c.k === "whats_new") card(`${X}<h4>What's new in the Placement Tracker</h4><ul><li>🔄 <b>Counters coming back</b> · which counter frees up when, on the Dashboard</li><li>📊 <b>Shortlist numbers at every round</b> · on your application cards</li><li>🎯 <b>Closed jobs</b> · filters, and how many applied and got shortlisted</li><li>↕ <b>Sort the list</b> · by firm, pay, cluster or closing time</li><li>🕑 <b>Keeps up when the portal is closed</b> · reads it every 2 hours</li></ul><div class="nact"><button type="button" class="nbp" data-nudge="use">${coolSetting() ? "Take a look" : "Take a look in Cool UI"}</button><button type="button" class="nb" data-nudge="later">Later</button></div>`);
  }
  async function act(what) {
    const c = current;
    if (!c) return;
    const n = N(), d = today(), f = feat(c);
    if (what === "close") {
      n.closed[c.k] = d;
      save(n);
      count("closed", f);
    } else if (what === "never") {
      n.never[c.k] = true;
      save(n);
      count(c.k === "tip" ? "tips_off" : "never", f);
    } else if (what === "later") {
      n.closed[c.k] = d;
      if (c.k === "try_cool") n.n3.keep++;
      if (c.k === "whats_new") {
        n.wnLater++;
        if (n.wnLater >= 2) n.wnDone = true;
      }
      save(n);
      count("later", f);
    } else if (what === "use") {
      count("used", f);
      n.closed[c.k] = d;
      if (c.k === "whats_new") n.wnDone = true;
      save(n);
      if (c.k === "urgent" || c.k === "try_cool" || c.k === "whats_new" && !coolSetting()) {
        if (window.__ptCoolVisit) window.__ptCoolVisit();
      }
      if (c.k === "urgent" && c.u.go && !location.hash.startsWith(c.u.go)) location.hash = c.u.go;
      if (c.k === "whats_new" && route() !== "jobs") location.hash = "#/student/student-jobs";
      if (c.k === "tip") setTimeout(() => showMe(c.t[1]), 50);
    }
    current = null;
    clear();
    if (window.__ptPillRefresh) window.__ptPillRefresh();
  }
  function showMe(what) {
    const q = s => document.querySelector(s);
    if (what === "list") {
      if (route() !== "jobs") {
        location.hash = "#/student/student-jobs";
        setTimeout(() => showMe("list"), 900);
        return;
      }
      const b = q('#pt-cool [data-view="list"]');
      if (b) b.click();
    }
    if (what === "search") {
      const i = q("#pt-cool #pt-gs");
      if (i) {
        i.focus();
        i.scrollIntoView({
          block: "center",
          behavior: "smooth"
        });
      }
    }
    if (what === "upcoming") {
      const b = q("#pt-edge [data-edge]");
      if (b) b.click();
    }
    if (what === "qa") {
      const b = q("#pt-edge [data-qa]");
      if (b) b.click();
    }
    if (what === "sheet") {
      const b = q("#pt-edge .eshb");
      if (b) {
        b.classList.add("ptglow");
        setTimeout(() => b.classList.remove("ptglow"), 1800);
      }
    }
  }
  document.addEventListener("click", e => {
    const b = e.target instanceof Element ? e.target.closest("#pt-nudge-card [data-nudge], #pt-nudge-tip [data-nudge]") : null;
    if (b) {
      e.preventDefault();
      act(b.dataset.nudge);
      return;
    }
    const t = e.target instanceof Element ? e.target : null;
    if (!t) return;
    if (t.closest('[data-view="list"]')) markUsed("list");
    if (t.closest("#pt-edge [data-edge]")) markUsed("upcoming");
    if (t.closest("#pt-edge [data-qa]")) markUsed("qa");
    if (t.closest("#pt-edge .eshb")) markUsed("sheet");
  }, true);
  document.addEventListener("focusin", e => {
    if (e.target && e.target.id === "pt-gs") markUsed("search");
  }, true);
  async function load() {
    st = await chrome.storage.local.get(KEYS).catch(() => null);
    if (!st) return;
    const n = N();
    if (st.coolUI === false && !n.coolOffSince) {
      n.coolOffSince = Date.now();
      save(n);
    } else if (st.coolUI !== false && n.coolOffSince) {
      n.coolOffSince = 0;
      save(n);
    }
    draw();
  }
  chrome.storage.onChanged.addListener((ch, area) => {
    if (area === "local" && KEYS.some(k => ch[k])) load();
  });
  window.addEventListener("hashchange", () => setTimeout(draw, 300));
  setInterval(() => {
    if (st) draw();
  }, 1500);
  load();
})();