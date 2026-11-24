(() => {
  if (window.__ptCoolLoaded) return;
  window.__ptCoolLoaded = true;
  const ROUTES = [ [ "home", /^#\/student\/home\b/ ], [ "jobs", /^#\/student\/student-jobs\b/ ], [ "apps", /^#\/student\/my-applications\b/ ], [ "dash", /^#\/student\/applications-dashboard\b/ ], [ "pending", /^#\/student\/pending-tasks\b/ ] ];
  const TITLES = {
    home: "Student Home",
    jobs: "Manage All Jobs",
    apps: "Manage Applications",
    dash: "Application Dashboard",
    pending: "Pending Tasks"
  };
  const CONTENT = ".alain-default__content";
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;"
  }[c]));
  const parseIST = PT.parseIST;
  const short = c => PT.shortFirm(c);
  const fmt = d => d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata"
  });
  const fmtDue = d => {
    if (!d) return "";
    const o = {
      timeZone: "Asia/Kolkata"
    }, day = x => x.toLocaleDateString("en-CA", o), t = d.toLocaleTimeString("en-IN", Object.assign({
      hour: "numeric",
      minute: d.getMinutes() ? "2-digit" : undefined,
      hour12: true
    }, o)).replace(/\s?([ap])\.?m\.?/i, " $1m");
    return day(d) === day(new Date) ? t : d - Date.now() < 6 * 864e5 ? d.toLocaleDateString("en-IN", Object.assign({
      weekday: "short"
    }, o)) + ", " + t : d.toLocaleDateString("en-IN", Object.assign({
      day: "numeric",
      month: "short"
    }, o)) + ", " + t;
  };
  const istDay = d => d.toLocaleDateString("en-CA", {
    timeZone: "Asia/Kolkata"
  });
  const slPassed = s => /^\d{4}-\d{2}-\d{2}/.test(String(s || "")) && String(s).slice(0, 10) < istDay(new Date);
  const awaitTxt = s => {
    if (!slPassed(s)) return "result awaited (shortlist expected " + fmtDay(s) + ")";
    const n = Math.round((new Date(istDay(new Date) + "T12:00:00+05:30") - new Date(String(s).slice(0, 10) + "T12:00:00+05:30")) / 864e5);
    return "result awaited (shortlist was expected " + fmtDay(s) + " · " + n + (n === 1 ? " day" : " days") + " ago)";
  };
  const fmtDay = s => {
    const d = parseIST(s);
    return d ? d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      timeZone: "Asia/Kolkata"
    }) : "–";
  };
  const ago = t => {
    const m = Math.round((Date.now() - t) / 6e4);
    return m < 1 ? "just now" : m < 60 ? m + " min ago" : Math.round(m / 60) + " h ago";
  };
  const left = d => {
    const ms = d - Date.now();
    if (ms < 0) return "passed";
    const h = Math.round(ms / 36e5);
    return h < 48 ? h + " h" : Math.floor(h / 24) + " d " + h % 24 + " h";
  };
  const tier = d => {
    const h = (d - Date.now()) / 36e5;
    return h <= 0 ? "" : h < 12 ? "t12" : h < 24 ? "t24" : "";
  };
  const LIVE = c => [ 1, 6, 2, 7, 8, 999 ].includes(c);
  const H = 36e5;
  const clApplied = id => !!((st && st.snapshot || {}).apps || []).find(a => a && a.id === id && a.statusCode !== 4 && a.statusCode !== 5);
  const formOf = id => {
    const L = ((st && st.snapshot || {}).tasks || []).filter(t => t && t.appId === id && (t.label || t.deadline));
    const open = L.filter(t => !/SUBMITTED/.test(t.status) && (parseIST(t.deadline) || Infinity) > Date.now()).sort((x, y) => String(x.deadline).localeCompare(String(y.deadline)));
    return open[0] ? Object.assign({
      open: true
    }, open[0]) : L.find(t => /SUBMITTED/.test(t.status)) ? Object.assign({
      open: false
    }, L.find(t => /SUBMITTED/.test(t.status))) : null;
  };
  const formTag = id => {
    const f = formOf(id);
    if (!f) return "";
    return f.open ? `<span class="tag ptx fm yes" data-k="form" title="${esc("The firm asks for a form on this job's page: " + (f.label || "form") + (f.deadline ? ", due " + fmtDue(parseIST(f.deadline)) : ""))}">📝 Form due ${esc(f.deadline ? fmtDay(f.deadline) : "")}</span>` : `<span class="tag ptx fm done" data-k="form" title="${esc((f.label || "Form") + ": submitted on the portal")}">📝 Form submitted ✓</span>`;
  };
  const clSent = id => !!(st && st.clDone || {})[id] || clApplied(id);
  let st = null, CFG = Object.assign({}, PT.CONFIG_DEFAULTS), route = null, mounted = null, dirty = true, headDirty = false, lastPlusJson = "";
  const F = {
    apps: "ip",
    pool: "all",
    hybrid: false,
    city: "",
    interviews: "",
    role: "",
    sector: "",
    exp: "",
    cgpa: false,
    cl: false,
    ctc: 0,
    eligible: false,
    starred: false,
    ni: false,
    closed: false,
    collapsed: true
  };
  const glowing = new Set;
  let confirmOff = false, lastSnap = null, lastOpenRole = {}, apOpen = false, scrollAp = false, slOpen = false, scrollSl = false, partOpen = {
    todo: true,
    rest: true
  }, stepsOpen = new Set;
  function scrapePlus() {
    const active = !!(document.getElementById("isbx-switch") || document.querySelector("[data-isbx], .isbx-ui, .isbx-board"));
    const hidden = {};
    const idOf = el => {
      const a = el.querySelector && el.querySelector('a[href*="application-details/"]');
      const m = a && /application-details\/([0-9a-f-]{36})/i.exec(a.getAttribute("href") || "");
      return m ? m[1].toLowerCase() : null;
    };
    document.querySelectorAll('tr[data-isbx-state="hide"]').forEach(tr => {
      const id = idOf(tr);
      if (id) hidden[id] = {
        at: Date.now(),
        from: "isb-plus"
      };
    });
    document.querySelectorAll('.isbx-board [data-id][data-state="hide"]').forEach(tr => {
      const id = String(tr.getAttribute("data-id") || "").toLowerCase();
      if (/^[0-9a-f-]{36}$/.test(id)) hidden[id] = {
        at: Date.now(),
        from: "isb-plus"
      };
    });
    return {
      active: active,
      hidden: hidden
    };
  }
  async function recordPlus() {
    const p = scrapePlus(), prev = st && st.plus || {};
    const hidden = Object.keys(p.hidden).length || !p.active ? p.hidden : prev.hidden || {};
    const next = {
      active: p.active,
      hidden: p.active ? hidden : {},
      seenAt: Date.now()
    };
    const j = JSON.stringify([ next.active, Object.keys(next.hidden).sort() ]);
    if (j === lastPlusJson) return;
    lastPlusJson = j;
    if (JSON.stringify([ !!prev.active, Object.keys(prev.hidden || {}).sort() ]) !== j) await chrome.storage.local.set({
      plus: next
    });
  }
  const routeNow = () => {
    const h = location.hash || "";
    for (const [k, re] of ROUTES) if (re.test(h)) return k;
    return null;
  };
  const visitCool = () => {
    try {
      return sessionStorage.getItem("ptCoolVisit") === "1";
    } catch (e) {
      return false;
    }
  };
  const coolOn = () => !!(st && (st.coolUI !== false || visitCool()));
  window.__ptCoolVisit = () => {
    try {
      sessionStorage.setItem("ptCoolVisit", "1");
    } catch (e) {}
    pillKey = "";
    dirty = true;
    tick();
  };
  window.__ptPillRefresh = () => {
    pillKey = "";
    pill(!!(st && st.plus && st.plus.active));
  };
  const connected = () => !!(st && st.gcal && st.gcal.connected && PT.googleReady());
  function host() {
    return document.querySelector(CONTENT) || document.querySelector("app-main") || document.body;
  }
  function ensureMounted() {
    let el = document.getElementById("pt-cool");
    const h = host();
    if (!el) {
      el = document.createElement("div");
      el.id = "pt-cool";
      el.className = "tbcjc-host";
      h.prepend(el);
      dirty = true;
    } else if (el.parentElement !== h) {
      h.prepend(el);
      dirty = true;
    }
    document.documentElement.setAttribute("data-pt-cool", "1");
    return el;
  }
  function unmount() {
    const el = document.getElementById("pt-cool");
    if (el) el.remove();
    document.documentElement.removeAttribute("data-pt-cool");
    mounted = null;
  }
  let pillKey = "", introUntil = 0;
  function topShow() {
    const p = document.getElementById("pt-pill"), c = document.getElementById("pt-cool") || document.querySelector(CONTENT), b = document.getElementById("pt-top");
    const y = c ? -c.getBoundingClientRect().top : window.scrollY;
    const show = Math.max(y, window.scrollY || 0) > window.innerHeight * .9;
    if (p) p.classList.toggle("pt-scrolled", show);
    if (b) b.classList.toggle("show", show && !!p);
  }
  window.addEventListener("scroll", () => topShow(), {
    capture: true,
    passive: true
  });
  let pillRO = null, pillOn = null;
  function placePill() {
    const p = document.getElementById("pt-pill");
    if (!p) return;
    const cool = document.getElementById("pt-cool"), content = document.querySelector(CONTENT);
    const on = cool && cool.getBoundingClientRect().width > 0 ? cool : content && content.getBoundingClientRect().width > 0 ? content : null;
    if (on !== pillOn) {
      pillOn = on;
      if (!pillRO && window.ResizeObserver) pillRO = new ResizeObserver(() => placePill());
      if (pillRO) {
        pillRO.disconnect();
        if (on) pillRO.observe(on);
      }
    }
    if (!on) {
      p.style.left = "";
      return;
    }
    const r = on.getBoundingClientRect(), x = Math.round((r.left + r.width / 2) * 10) / 10;
    if (p.style.left !== x + "px") p.style.left = x + "px";
    topShow();
  }
  window.addEventListener("resize", () => placePill());
  function pill(plusActive) {
    let p = document.getElementById("pt-pill");
    if (!PT.googleReady()) {
      if (p) p.remove();
      pillKey = "";
      return;
    }
    if (!document.getElementById("pt-top")) {
      const tb = document.createElement("button");
      tb.type = "button";
      tb.id = "pt-top";
      tb.title = "Back to the top";
      tb.textContent = "↑";
      document.body.appendChild(tb);
      tb.addEventListener("click", () => {
        const c = document.getElementById("pt-cool");
        window.scrollTo({
          top: 0,
          behavior: "smooth"
        });
        if (c && c.getBoundingClientRect().top < 0) c.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      });
    }
    if (!p) {
      p = document.createElement("div");
      p.id = "pt-pill";
      document.body.appendChild(p);
      pillKey = "";
      p.addEventListener("click", async e => {
        const b = e.target.closest("button");
        if (!b || b.disabled) return;
        const pg = routeNow() || "other";
        if (b.dataset.mode) {
          const cool = b.dataset.mode === "cool";
          if (cool === coolOn()) return;
          if (cool) {
            count("pt_pill", {
              action: "cool_on",
              page: pg
            });
            await chrome.storage.local.set({
              coolUI: true,
              coolIntroDone: true
            });
            return;
          }
          try {
            sessionStorage.removeItem("ptCoolVisit");
          } catch (e2) {}
          count("pt_pill", {
            action: "boring_on",
            page: pg
          });
          await chrome.storage.local.set({
            coolUI: false
          });
          pillKey = "";
          dirty = true;
          tick();
          return;
        }
        if (b.dataset.back) {
          window.__ptPeek = false;
          count("pt_pill", {
            action: "back_cool",
            page: pg
          });
          pillKey = "";
          dirty = true;
          tick();
          return;
        }
        if (b.dataset.nudge && window.__ptNudge) {
          window.__ptNudge(b.dataset.nudge, b);
          return;
        }
        if (b.dataset.connect) {
          b.textContent = "Opening Google…";
          chrome.runtime.sendMessage({
            type: "PT_GCAL_CONNECT"
          }).catch(() => {});
          return;
        }
        if (b.dataset.gotit) {
          introUntil = 1;
          pillKey = "";
          pill(false);
          return;
        }
        if (b.dataset.remake) {
          b.textContent = "Making…";
          chrome.runtime.sendMessage({
            type: "PT_GCAL_REMAKE"
          }).catch(() => {});
          return;
        }
        if (b.dataset.now) {
          b.textContent = "Checking…";
          await chrome.runtime.sendMessage({
            type: "PT_CHECK_NOW"
          }).catch(() => {});
          pillKey = "";
          pill(false);
          return;
        }
      });
    }
    const g = st && st.gcal || {}, on = coolOn(), conn = true, cal = connected();
    if (conn && on && !plusActive && !(st && st.coolIntroDone) && !introUntil) {
      introUntil = Date.now() + 9e3;
      chrome.storage.local.set({
        coolIntroDone: true
      });
    }
    const intro = conn && on && !plusActive && introUntil > Date.now();
    const w = cal && !plusActive ? pillWarn() : null;
    const wdPeek = on && !!window.__ptPeek && routeNow() === "apps";
    const ndg = !on && !plusActive && window.__ptNudgePill ? window.__ptNudgePill() : null;
    const key = [ conn, on, plusActive, g.needsReconnect, intro, w ? w.k + (w.k === "err" ? st.lastError : "") : "", wdPeek, ndg ? ndg.k : "" ].join();
    placePill();
    if (key === pillKey) return;
    pillKey = key;
    const sw = `<span class="ptseg" role="group" aria-label="How the portal looks"><button type="button" data-mode="boring" class="${on ? "" : "on"}" aria-pressed="${!on}" title="The portal's own pages, on every portal page">Boring UI</button><button type="button" data-mode="cool" class="${on ? "on" : ""}" aria-pressed="${on}" title="The tracker's view, on every portal page">✨ Cool UI</button></span>`;
    if (plusActive) {
      p.className = "lock";
      p.innerHTML = `<span>Cool UI is off while ISB Placements Plus is on</span><button disabled title="Turn ISB Placements Plus off in chrome://extensions, then reload">Cool UI</button>`;
    } else if (wdPeek) {
      p.className = "peek";
      p.innerHTML = `<span class="ptdot"></span><span>Portal's own page</span><span class="ptmuted">· find Withdraw in this application's row</span><button data-back="1">Back to Cool UI</button>`;
    } else if (on && !w) {
      p.className = "seg cool" + (intro ? " intro" : "");
      p.innerHTML = (intro ? `<div class="pt-hint">✨ Cool UI is on. <b>Boring UI</b> shows the portal's own pages. <button data-gotit="1">Got it</button></div>` : "") + sw;
    } else if (w) {
      p.className = "seg " + (on ? "cool" : "boring") + " stack" + (ndg ? " nudge" : "");
      p.innerHTML = `<span class="ptrow ptw">${w.html}</span><span class="ptrow${ndg ? " nudge" : ""}">${ndg ? ndg.html + `<i class="ptsep"></i>` : ""}${sw}</span>`;
    } else if (ndg) {
      p.className = "seg boring nudge";
      p.innerHTML = ndg.html + `<i class="ptsep"></i>` + sw;
    } else {
      p.className = "seg boring";
      p.innerHTML = sw;
    }
    topShow();
  }
  const ROLE_GROUPS = [ [ "Brand / Marketing", /brand|market|growth|category|digital|communic|media/i ], [ "Consulting / Strategy", /consult|strateg|advis|transformation|analyst/i ], [ "Finance", /financ|invest|treasur|bank|equity|risk|audit|account/i ], [ "Sales / KAM", /sales|account manag|key account|business develop|channel|bd\b/i ], [ "Product", /product/i ], [ "Operations / Supply", /operation|supply|logistic|procure|plant/i ], [ "Analytics / Data", /data|analytic|scien|insight/i ], [ "HR / People", /\bhr\b|human|talent|people/i ], [ "General Management / Leadership", /general manag|leadership|management trainee|gmt|associate program|chief of staff/i ] ];
  const roleGroup = r => (ROLE_GROUPS.find(([, re]) => re.test(String(r || ""))) || [ "Other" ])[0];
  const num = v => {
    const n = parseFloat(v);
    return isFinite(n) ? n : null;
  };
  function facts(row) {
    if (row.__f) return row.__f;
    const d = (st.details || {})[row.id] || {}, s = row.s || {}, j = row.j || {};
    const hasD = !!(st.details || {})[row.id];
    let ctc = hasD || j.ctc ? PT.ctcInfo(d.ctc || j.ctc, d.cur) : {
      label: "CTC: checking…",
      lakhs: null,
      approx: false,
      na: false,
      checking: true
    };
    if (ctc && ctc.na && d.ctcJd) {
      if (d.ctcJd === "see JD") ctc = {
        label: "CTC: see JD",
        lakhs: null,
        approx: false,
        na: false,
        jd: true
      }; else {
        ctc = Object.assign(PT.ctcInfo(d.ctcJd, d.cur), {
          jd: true
        });
        ctc.label += " · JD";
      }
    }
    return row.__f = {
      work: d.workType || "",
      interview: d.interview || "",
      locations: d.locations || "",
      cgpaNo: /^no\b/i.test(String(d.cgpa || "")),
      lo: d.expMin != null ? d.expMin : num(j.expMin),
      hi: d.expMax != null ? d.expMax : num(j.expMax),
      minFlex: !!d.minFlex,
      maxFlex: !!d.maxFlex,
      ctc: ctc,
      eligible: d.eligible,
      hasD: hasD,
      cl: d.cl === true,
      clTo: d.clTo || ""
    };
  }
  const cities = f => String(f.locations || "").split(/[,;/]|\band\b/).map(x => x.trim()).filter(x => x && !/pan india|multiple|various/i.test(x));
  const cityMatch = (f, c) => {
    const L = String(f.locations || "");
    if (!c) return true;
    if (/pan india/i.test(L) && !/dubai|singapore|london|new york|doha|riyadh|abu dhabi/i.test(c)) return true;
    return L.toLowerCase().includes(c.toLowerCase());
  };
  const expOk = (f, n) => {
    if (n === "" || n === null || n === undefined) return true;
    const N = +n;
    return (f.minFlex || f.lo === null || f.lo <= N) && (f.maxFlex || f.hi === null || N <= f.hi);
  };
  let PAGE = "";
  let Q = "", gsFocus = false, gsT = 0;
  const qWords = q => String(q || "").toLowerCase().split(/[^a-z0-9&+]+/).filter(Boolean);
  function qMatch(row) {
    const {j: j = {}, a: a = {}} = row, f = facts(row), hay = qWords([ j.company, a.company, j.role, a.role, j.industry, f.work, cities(f).join(" "), PT.shortFirm(j.company || a.company || "") ].join(" "));
    return qWords(Q).every(w => hay.some(h => h.startsWith(w)));
  }
  const slN = row => {
    const j = row.j || {}, a = row.applied || row.a || {};
    const n = j.shortlistCount != null ? j.shortlistCount : a.shortlistCount;
    return n == null ? null : +n;
  };
  const apN = row => {
    const j = row.j || {}, a = row.applied || row.a || {};
    const n = j.appliedCount != null ? j.appliedCount : a.appliedCount;
    return n == null ? null : +n;
  };
  function passes(row, G) {
    const g = G || F, {j: j = {}, a: a = {}, due: due} = row, f = facts(row), pool = row.pool || "";
    if (Q && !qMatch(row)) return false;
    if (g.pool !== "all" && !(g.pool === "intl" ? /international/i.test(pool) : pool === g.pool)) return false;
    if (g.hybrid && !/hybrid|remote/i.test(f.work)) return false;
    if (g.city && !cityMatch(f, g.city)) return false;
    if (g.interviews && !new RegExp(g.interviews, "i").test(f.interview)) return false;
    if (g.role && roleGroup(j.role || a.role) !== g.role) return false;
    if (g.sector && String(j.industry || "") !== g.sector) return false;
    if (!expOk(f, g.exp)) return false;
    if (g.cgpa && !f.cgpaNo) return false;
    if (g.eligible && f.eligible !== true) return false;
    if (g.cl && !f.cl) return false;
    if (g.ctc && !(f.ctc && f.ctc.lakhs !== null && f.ctc.lakhs >= g.ctc)) return false;
    if (g.slOut && row.closed && !(slN(row) > 0)) return false;
    return true;
  }
  const CLEAR = {
    pool: "all",
    hybrid: false,
    city: "",
    interviews: "",
    role: "",
    sector: "",
    exp: "",
    cgpa: false,
    eligible: false,
    cl: false,
    ctc: 0,
    starred: false,
    slOut: false
  };
  function filterBar(page, rows, sum) {
    const pools = [ ...new Set(rows.map(r => r.pool).filter(Boolean)) ].filter(p => !/international/i.test(p)).sort();
    const intl = rows.some(r => /international/i.test(r.pool || ""));
    const pool = pools.length + (intl ? 1 : 0) > 1 || F.pool !== "all" ? `<select class="fchip pool${F.pool !== "all" ? " on" : ""}" data-fs="pool" title="Only the jobs of one cluster (they share its counters)" aria-label="Cluster"><option value="all">Cluster: all</option>${pools.map(p => `<option value="${esc(p)}"${F.pool === p ? " selected" : ""}>${esc(p)}</option>`).join("")}${intl || F.pool === "intl" ? `<option value="intl"${F.pool === "intl" ? " selected" : ""}>International ✈</option>` : ""}</select>` : "";
    const elig = page === "jobs" ? `<button type="button" class="fchip elig${F.eligible ? " on" : ""}" data-f="eligible" aria-pressed="${F.eligible}" title="${F.eligible ? "Showing only the jobs the portal says you are eligible for · click to show all" : "Show only the jobs the portal says you are eligible for"}">✓ Eligible</button>` : "";
    const shut = page === "jobs" && F.closed ? rows.filter(r => r.closed && passes(r, Object.assign({}, F, {
      slOut: false
    }))) : [], shutSl = shut.filter(r => slN(r) > 0).length;
    const slc = page === "jobs" && F.closed && (F.slOut || shutSl && shutSl < shut.length) ? `<button type="button" class="fchip slout${F.slOut ? " on" : ""}" data-f="slOut" aria-pressed="${!!F.slOut}" title="${F.slOut ? "Showing only closed jobs whose shortlist is out · click to show all" : "Show only the closed jobs whose shortlist the portal has published"}">🎯 Shortlist out</button>` : "";
    const vt = `<span class="ptvt" role="group" aria-label="View"><button type="button" data-view="cards" class="${listOn() ? "" : "on"}" aria-pressed="${!listOn()}" title="Each firm as a card with everything on it">▦ Cards</button><button type="button" data-view="list" class="${listOn() ? "on" : ""}" aria-pressed="${listOn()}" title="One row per role, grouped by when it closes; click a row for its details">☰ List</button></span>`;
    const gs = `<label class="ptgs${Q ? " on" : ""}"><span aria-hidden="true">🔍</span><input type="text" id="pt-gs" autocomplete="off" spellcheck="false" placeholder="Press / to search, or click: firm, role, city" value="${esc(Q)}" aria-label="Search all jobs">${Q ? `<button type="button" data-gsx="1" title="Clear the search (Esc)">✕</button>` : `<kbd>/</kbd>`}</label>`;
    return `<div class="pt-filters">${sum || ""}<div class="ptsrow">${gs}${elig}${pool}${slc}${page === "jobs" ? vt : ""}</div></div>`;
  }
  const sumBtn = (k, n, label, note, on, cls) => `<button type="button" class="ptn ${cls || k}${on ? " on" : ""}${n ? "" : " zero"}" data-f="${k}" aria-pressed="${on}"${!n && !on && k !== "open" && k !== "apps-ip" ? " disabled" : ""} title="${esc(label)}"><b>${n}</b><span>${label}</span>${note ? `<small>${note}</small>` : ""}</button>`;
  const apShown = () => listOn() ? !bandFold.ap : apOpen;
  function onFilterClick(t) {
    const k = t.dataset.f, v = t.dataset.v;
    if (k === "pool") F[k] = v; else if (k === "apps-ip" && F.apps === "ip") {
      slOpen = false;
      scrollTo(0, 0);
    } else if (k === "apps-sl") {
      if (F.apps === "ip" && slOpen) slOpen = false; else {
        F.apps = "ip";
        slOpen = true;
        scrollSl = true;
      }
    } else if (/^apps-/.test(k)) {
      F.apps = k.slice(5);
    } else if (k === "open") {
      F.ni = false;
      F.closed = false;
      F.slOut = false;
      apOpen = false;
      bandFold.ap = true;
      scrollTo(0, 0);
    } else if (k === "applied") {
      const shown = !F.ni && !F.closed && apShown();
      F.ni = false;
      F.closed = false;
      if (shown) {
        apOpen = false;
        bandFold.ap = true;
      } else {
        apOpen = true;
        scrollAp = true;
        bandFold.ap = false;
      }
      count("pt_job", {
        action: shown ? "applied_fold" : "applied_open",
        where: listOn() ? "list_row" : "card"
      });
    } else if (k === "ni") {
      F.ni = true;
      F.closed = false;
    } else if (k === "closed") {
      if (!F.closed) count("pt_job", {
        action: "closed_open",
        where: listOn() ? "list_row" : "card"
      });
      F.closed = true;
      F.ni = false;
    } else F[k] = !F[k];
    dirty = true;
  }
  const sameTab = root => root.querySelectorAll('a[href^="https://placements.isb.edu/"], a[href^="#/"]').forEach(a => {
    a.removeAttribute("target");
    a.removeAttribute("rel");
    if (!a.closest(".pt-menu") && !a.matches(".ptwd")) a.textContent = a.textContent.replace(/\s*↗\s*$/, "");
  });
  function badges(row, opts) {
    const f = facts(row), o = opts || {}, out = [];
    if (o.counts) {
      if (o.counts.applied) out.push(`<span class="tag ptx cnt" data-k="cnt" title="Students who applied (from the portal)">👥 ${o.counts.applied} applied</span>`);
      const ap = +o.counts.applied || 0, sl = +o.counts.shortlisted || 0, pc = ap > 0 && sl > 0 && sl <= ap ? sl * 100 / ap < 1 ? "<1%" : Math.round(sl * 100 / ap) + "%" : "";
      if (o.counts.shortlisted) out.push(`<span class="tag ptx cnt sl" title="Students shortlisted (from the portal)${pc ? esc(`: ${pc} of those who applied`) : ""}">⭐ ${o.counts.shortlisted} shortlisted${pc ? ` (${esc(pc)})` : ""}</span>`);
    }
    if (f.ctc) out.push(`<span class="tag ptx ctc${f.ctc.na || f.ctc.checking ? " na" : ""}" data-k="ctc" title="${esc(f.ctc.checking ? "The tracker is reading this job's pay from the portal" : f.ctc.jd ? "Read from the JD — check the JD for the breakdown" : (f.ctc.raw ? "Firm's text: " + f.ctc.raw : "CTC as listed on the portal") + (f.ctc.approx ? " (≈ ₹ is a rough conversion)" : ""))} · only you see this">${esc(f.ctc.label)}</span>`);
    const done = clSent(row.id);
    out.push(f.cl ? done ? `<span class="tag ptx cvl done" data-k="cl" title="Cover letter sent">📩 Cover letter sent ✓</span>` : `<span class="tag ptx cvl yes" data-k="cl" title="Cover letter needed${f.clTo ? ". Address it to: " + esc(f.clTo) : ""}">📩 Cover letter</span>` : `<span class="ptx-none" data-k="cl" hidden></span>`);
    if (o.noEligible) {} else if (f.eligible === true) out.push(`<span class="tag ptx elig yes" data-k="elig" title="The portal says you are eligible for this job">✓ Eligible</span>`); else if (f.eligible === false) out.push(`<span class="tag ptx elig no" data-k="elig" title="The portal says you are not eligible for this job; open it on the portal to see why">✗ Not eligible</span>`);
    return out;
  }
  function siteChips(row) {
    const f = facts(row), c = String(((st.details || {})[row.id] || {}).cgpa || (row.s || {}).cgpa_required || "");
    return {
      work: /hybrid|remote/i.test(f.work) ? `<span class="tag wk" data-k="work"><svg class="house" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" d="M3.5 11 12 4l8.5 7M6 9.5V20h12V9.5"></path><path fill="currentColor" d="M10 20v-5h4v5z"></path></svg>${esc(/remote/i.test(f.work) ? "Remote" : "Hybrid")}</span>` : "",
      cgpa: /^no\b/i.test(c) ? `<span class="tag cg no" data-k="cgpa">CGPA: No 🎉</span>` : /^yes\b/i.test(c) ? `<span class="tag cg yes" data-k="cgpa">CGPA: Yes 😢</span>` : ""
    };
  }
  const roleKey = t => String(t || "").replace(/\s+/g, " ").trim();
  function roleGrid(card, rowsById) {
    const seg = card.querySelector(".rrow .rseg");
    if (!seg || seg.dataset.grid) return;
    const btns = [ ...seg.querySelectorAll(".rp[data-rp]") ];
    if (btns.length < 2) return;
    btns.sort((a, b) => roleKey(a.textContent).localeCompare(roleKey(b.textContent), "en", {
      numeric: true,
      sensitivity: "base"
    })).forEach(b => seg.appendChild(b));
    const n = btns.length;
    seg.style.setProperty("--cols", n <= 3 ? n : n === 4 || n >= 7 ? 4 : 3);
    seg.dataset.grid = "1";
    for (const b of btns) {
      const row = rowsById[String(b.dataset.rp).toLowerCase()], f = row ? facts(row) : null, j = row && row.j || {};
      const pay = !f || !f.ctc ? "" : f.ctc.checking ? "CTC checking…" : f.ctc.na ? "CTC not disclosed" : f.ctc.label.replace(/^CTC:\s*/, "");
      const meta = pay;
      const name = roleKey(b.textContent);
      b.title = name;
      b.innerHTML = `<span class="rpn">${esc(name)}</span>${meta ? `<span class="rpm">${esc(meta)}</span>` : ""}`;
    }
  }
  function ctrHtml(c) {
    if (!c) return "";
    if (c.none) return `<span class="ptcline"><b>No counter needed</b></span>`;
    const parts = [ `<b>${esc(c.pool || "Counters")}</b>` ];
    if (c.cost) parts.push(`<span class="${c.costCls || ""}">${esc(c.cost)}${c.backDate ? " on " + esc(fmtDay(c.backDate)) : ""}</span>`);
    if (c.heldBack) parts.push(c.heldBack < new Date(Date.now() + 5.5 * 36e5).toISOString().slice(0, 10) ? `<span>past its shortlist date, back once the portal releases it</span>` : `<span>comes back on ${esc(fmtDay(c.heldBack))} if no shortlist</span>`);
    if (c.left != null && c.total != null) {
      if (c.state === "last") parts.push(`<span class="pillr">⚠ LAST COUNTER · 1 of ${c.total} left</span>`); else if (c.state === "none") parts.push(`<span class="pillr">0 of ${c.total} left</span>${c.next ? ` · ${c.next.n} come${c.next.n === 1 ? "s" : ""} back on ${esc(fmtDay(c.next.date))} <small>(if no shortlist)</small>` : ""}`); else parts.push(`<span>${c.left} of ${c.total} left${c.left === 2 ? " 🫣" : ""}</span>`);
    }
    return `<span class="ptcline" title="Counters: the cluster this job draws from, what applying here costs, and how many you have left">${parts.join(" · ")}</span>`;
  }
  function badgeRow(row, opts) {
    const f = facts(row), c = siteChips(row);
    if (!f.hasD && !(opts && opts.noLoading)) return `<span class="tag ptx chk" data-k="ctc">reading details…</span>`;
    return c.work + badges(row, opts).join("") + formTag(row.id) + c.cgpa;
  }
  const hlineHtml = stages => `<div class="pthline" data-k="stages"><span class="pthlab">Hiring process</span>${stages.map(x => `<span class="hs${x.elim ? " e" : ""}"><i></i><span>${esc(x.name)}</span>${x.elim ? `<b class="pttt" role="tooltip">Elimination round</b>` : ""}</span>`).join('<i class="seg"></i>')}</div>`;
  function lockHeights(root) {
    root.querySelectorAll(".jc[data-ptd]").forEach(card => {
      const ids = [ ...card.querySelectorAll(".rp[data-rp]") ].map(b => b.dataset.rp);
      if (ids.length < 2) return;
      const cur = (card.querySelector(".rp[aria-selected=true]") || {}).dataset;
      const keep = cur ? cur.rp : ids[0];
      card.style.minHeight = "";
      let h = 0;
      ids.forEach(id => {
        TBCJobCard.pickRole(card, id, false);
        h = Math.max(h, card.offsetHeight);
      });
      TBCJobCard.pickRole(card, keep, false);
      card.style.minHeight = h + "px";
    });
  }
  const STC = c => [ 2, 8 ].includes(c) ? "sl" : c === 7 ? "wl" : c === 999 ? "cr" : [ 3, 4, 5 ].includes(c) ? "out" : "ip";
  function stopsFor(r) {
    const {a: a, s: s} = r, steps = r.steps || [], ended = !LIVE(a.statusCode), raw = stageList(s);
    const names = raw.map(x => x.replace(/\s*\*\s*$/, "")), elim = raw.map(x => /\*\s*$/.test(x));
    const key = String(a.stage || "").toLowerCase().split(" ")[0];
    let ci = key ? names.findIndex(x => x.toLowerCase().includes(key)) : 0;
    if (ci < 0) ci = 0;
    const off = connected() ? `<span class="tag off">left your calendar</span>` : "", used = new Set;
    const match = nm => {
      const w = nm.toLowerCase().split(" ")[0];
      for (let i = 0; i < steps.length; i++) {
        const l = String(steps[i].label).toLowerCase();
        if (!used.has(i) && (l.includes(w) || nm.toLowerCase().includes(l.split(" ")[0]))) {
          used.add(i);
          return steps[i];
        }
      }
      return null;
    };
    const hs = (st.slHist || {})[a.id] || {}, ap = a.appliedCount || hs.ap, byIdx = {};
    const idxOf = stg => {
      const w = String(stg).toLowerCase().split(" ")[0];
      const k = names.findIndex(x => x.toLowerCase().includes(w));
      return k < 0 ? 0 : k;
    };
    for (const [key, v] of Object.entries(hs.s || {})) {
      const [stg, how] = key.split("|");
      const k = how === "at" ? idxOf(stg) : idxOf(stg) - 1;
      if (k >= 0 && !byIdx[k]) byIdx[k] = v;
    }
    {
      const own = a.statusCode === 3 ? ci : ci - 1;
      if (own >= 0 && a.shortlistCount > 0) byIdx[own] = Object.assign({}, byIdx[own] && byIdx[own].n === a.shortlistCount ? byIdx[own] : {}, {
        n: a.shortlistCount
      });
    }
    const slTag = i => {
      if (!ap || !(i < ci || i === ci && (a.statusCode === 3 || [ 2, 8 ].includes(a.statusCode) && i === names.length - 1))) return "";
      const v = byIdx[i];
      return v ? `<span class="ptslr" title="${v.n} of the ${ap} who applied got through this round${v.at ? " · saved " + fmt(new Date(v.at)) : ""}">${v.n} / ${ap} · ${v.n * 100 / ap < 1 ? "<1" : Math.round(v.n / ap * 100)}%</span>` : `<span class="ptslr q" title="The portal shows only the latest number; the tracker keeps each round's number from version 2.0.4 on">— / ${ap}</span>`;
    };
    const out = [ {
      k: "done",
      n: "Applied",
      d: a.appliedAt ? fmt(new Date(a.appliedAt)) : "",
      t: ended ? off : a.deadline ? calChip("job|" + a.id, a.deadline) : ""
    } ];
    const why = {
      3: "not shortlisted",
      4: "withdrawn",
      5: "removed",
      999: "counter released"
    }[a.statusCode] || "ended";
    const body = names.map((nm, i) => {
      let k = i < ci ? "done" : i === ci ? ended ? "end" : "cur" : ended ? "next after" : "next";
      if (elim[i]) k += " elim";
      const it = ended ? null : match(nm);
      let d = "", t = "";
      if (ended) {
        d = i === ci ? why : "";
        t = i <= ci ? off : "";
      } else if (it && it.done) {
        k = "done" + (elim[i] ? " elim" : "");
        d = "✓ Submitted";
        t = calChip(it.key, it.due);
      } else if (it && it.missed) {
        k = "missed" + (elim[i] ? " elim" : "");
        d = it.mine ? `closed ${fmt(parseIST(it.due))} · not marked` : "missed · not submitted";
        t = it.mine ? markBtn(it) : "";
      } else if (it) {
        const due = parseIST(it.due);
        d = `due ${fmt(due)} · ${left(due)}`;
        t = calChip(it.key, it.due);
        if (due - Date.now() < 864e5) k += " soon";
      } else if (i === 0 && a.shortlistBy && i <= ci) {
        d = i < ci || [ 2, 8 ].includes(a.statusCode) ? "shortlisted" : a.statusCode === 7 ? "waitlisted · the portal will tell you if a place opens" : a.statusCode === 999 ? "counter back · " + awaitTxt(a.shortlistBy) : slPassed(a.shortlistBy) ? awaitTxt(a.shortlistBy) : "shortlist expected " + fmtDay(a.shortlistBy);
        t = calChip("sl|" + a.id, a.shortlistBy);
      } else if (i === ci && a.statusCode === 7) {
        d = "waitlisted · the portal will tell you if a place opens";
        t = "";
      } else if (i >= ci) {
        d = "date not announced";
        t = `<span class="tag wait">⏳ Deadline awaited</span>`;
      }
      const shown = i === 0 && /^applied\b/i.test(nm) ? "Resume shortlist" : nm;
      return {
        k: k,
        n: shown,
        d: d,
        t: t,
        e: elim[i],
        fn: shown !== nm ? nm : "",
        sl: slTag(i)
      };
    });
    function markBtn(it) {
      return it.mine ? `<button type="button" class="ptmark" data-webdone="${esc(it.appId)}" title="You applied on the firm's own site: tick it off here (the portal can't see it)">✓ Mark done</button>` : "";
    }
    const extra = ended ? [] : steps.filter((_, i) => !used.has(i)).map(it => {
      const due = parseIST(it.due);
      if (it.missed) return {
        k: "missed",
        n: it.label,
        d: it.mine ? `closed ${fmt(due)} · not marked` : "missed · not submitted",
        t: it.mine ? markBtn(it) : ""
      };
      return it.done ? {
        k: "done",
        n: it.label,
        d: it.mine ? "✓ Done · marked by you" : "✓ Submitted",
        t: it.mine ? `<span class="ptacts">${clapFor === it.appId && Date.now() - clapAt < 2500 ? '<span class="ptclap" aria-hidden="true">👏</span>' : ""}<button type="button" class="ptundo" data-webdone="${esc(it.appId)}" title="Not done after all? Undo">Undo</button>${calChip(it.key, it.due)}</span>` : calChip(it.key, it.due)
      } : {
        k: "next" + (due - Date.now() < 864e5 ? " soon" : ""),
        n: it.label,
        d: `due ${fmt(due)} · ${left(due)}`,
        t: markBtn(it) ? `<span class="ptacts">${markBtn(it)}${calChip(it.key, it.due)}</span>` : calChip(it.key, it.due)
      };
    });
    if (!names.length && !ended) body.push({
      k: "next",
      n: "Next steps",
      d: (st.details || {})[a.id] ? "the portal hasn't listed them" : "checking…",
      t: ""
    });
    const at = body.findIndex(x => !/^done/.test(x.k)), cut = at < 0 ? body.length : at;
    return {
      stops: out.concat(body.slice(0, cut), extra, body.slice(cut)),
      togo: ended ? "" : names.length ? Math.max(0, names.length - ci - 1) : null
    };
  }
  function nextLine(stops, n) {
    const i = stops.findIndex(x => /\bsoon\b/.test(x.k)), j = i >= 0 ? i : stops.findIndex(x => /^(cur|end)/.test(x.k)), k = j >= 0 ? j : stops.findIndex(x => /^next/.test(x.k));
    const x = stops[k], dots = stops.map(y => `<i class="${/^done/.test(y.k) ? "d" : /^(cur|end)/.test(y.k) ? "c" : /\bsoon\b/.test(y.k) ? "s" : ""}${y.e ? " e" : ""}" title="${esc(y.n)}"></i>`).join("");
    return `<div class="ptnextl${x && /\bsoon\b/.test(x.k) ? " soon" : ""}"><span class="ptdots">${dots}</span>${x ? `<span class="lab">${/^end/.test(x.k) ? "Ended at" : "Next"}</span><b>${esc(x.n)}</b>${x.d ? `<span class="dt">· ${esc(x.d)}</span>` : ""}${x.t || ""}` : `<span class="lab">All steps done</span>`}<span class="ptall">All ${n} steps</span></div>`;
  }
  const metroHtml = stops => `<div class="ptmetro">${stops.map(x => `<div class="stop ${x.k}"><span class="trk">${x.e ? `<span class="stn" tabindex="0" aria-label="Elimination round"></span><b class="pttt" role="tooltip">Elimination round</b>` : `<span class="stn"></span>`}</span><span class="sx"><span class="snm"${x.fn ? ` title="${esc("The firm calls this stage: " + x.fn)}"` : ""}>${esc(x.n)}</span>${/^cur/.test(x.k) ? '<span class="now">NOW</span>' : ""}${x.d ? ` <span class="dt">· ${esc(x.d)}</span>` : ""}${x.e ? ` <span class="ptelim">elimination round</span>` : ""}${x.sl || ""}</span>${x.t || ""}</div>`).join("")}</div>`;
  function closesPill(a) {
    const dl = parseIST(a.deadline), ms = dl ? dl - Date.now() : 0;
    if (!dl || ms <= 0 || STC(a.statusCode) === "out") return "";
    const w = when(dl);
    return `<span class="ptcloses ${w.tier}" title="Applications for this job close ${esc(fmt(dl))}">⏳ Closes ${esc(w.day)} ${esc(w.t)} · ${esc(w.left)} left</span>`;
  }
  const IST = {
    timeZone: "Asia/Kolkata"
  }, dkey = x => x.toLocaleDateString("en-CA", IST);
  function when(dl) {
    const ms = dl - Date.now(), h = ms / 36e5, now = new Date;
    const day = dkey(dl) === dkey(now) ? "today" : dkey(dl) === dkey(new Date(Date.now() + 864e5)) ? "tomorrow" : dl.toLocaleDateString("en-IN", Object.assign({
      weekday: "short",
      day: "numeric",
      month: "short"
    }, IST)).replace(",", "");
    const t = dl.toLocaleTimeString("en-IN", Object.assign({
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    }, IST)).toLowerCase().replace(/\s+/g, " ");
    const left = h < 1 ? Math.max(1, Math.round(ms / 6e4)) + " min" : h < 48 ? Math.round(h) + " h" : Math.round(h / 24) + " days";
    return {
      day: day,
      t: t,
      left: left,
      tier: h < 24 ? "r" : h <= 72 ? "a" : "g",
      pct: h >= 72 ? 100 : Math.max(4, h / 72 * 100)
    };
  }
  const stripIn = dl => {
    const w = when(dl);
    return `<div class="pt2a"><b>Closes ${esc(w.day)}</b><span>${esc(w.t)}</span></div><div class="pt2b"><span>${esc(w.left)} left</span><span class="ptbar"><span class="ptbf" style="width:${w.pct.toFixed(1)}%"></span></span></div>`;
  };
  const refreshStrips = () => {
    refreshDl();
    document.querySelectorAll("#pt-cool .ptclose.pt2[data-dl]").forEach(s => {
      const dl = new Date(+s.dataset.dl);
      if (dl - Date.now() <= 0) return;
      const w = when(dl), h = stripIn(dl);
      s.classList.remove("r", "a", "g");
      s.classList.add(w.tier);
      if (s.dataset.h !== h) {
        s.innerHTML = h;
        s.dataset.h = h;
      }
    });
  };
  const refreshDl = () => {
    let moved = false;
    document.querySelectorAll("#pt-cool .ptdl[data-dl]").forEach(s => {
      const dl = new Date(+s.dataset.dl);
      if (dl - Date.now() <= 0) {
        s.innerHTML = "<b>Closed just now</b>";
        s.className = "ptdl x";
        moved = true;
        return;
      }
      const w = when(dl), band = (s.closest(".ptlb") || {}).dataset;
      if (band && /^b[rag]$/.test(band.band || "") && band.band !== "b" + w.tier) moved = true;
      s.classList.remove("r", "a", "g");
      s.classList.add(w.tier);
      s.innerHTML = `<b>${esc(cap(w.day))} · ${esc(w.t)}</b><span class="bb">${esc(w.left)} left <i style="--p:${w.pct.toFixed(1)}%"></i></span>`;
    });
    if (moved && !document.querySelector("#pt-cool .ptlx") && !document.querySelector("#pt-cool .ptlr:hover")) dirty = true;
  };
  function procCard(r, o) {
    o = o || {};
    const {a: a} = r, d = (st.details || {})[a.id] || {}, sc = STC(a.statusCode);
    const {stops: stops, togo: togo} = stopsFor(r);
    const note = [ r.pool, togo === null ? "" : sc === "out" ? "out of the process" : a.statusCode === 7 ? "waitlisted" : `${togo} step${togo === 1 ? "" : "s"} to go` ].filter(Boolean).join(" · ");
    const site = d.website && d.websiteLink ? `<a class="btn light" href="${esc(d.websiteLink)}" target="_blank" rel="noopener">Company site ↗</a>` : "";
    const nx = sc === "out" ? null : (r.steps || []).find(it => !it.done && !/^website application$/i.test(it.label) && parseIST(it.due) > Date.now());
    const wb = sc === "out" ? null : (r.steps || []).find(it => it.mine && !it.done && /^https?:\/\//i.test(it.link || "") && parseIST(it.due) > Date.now());
    const wbtn = wb ? `<a class="btn ptnext${parseIST(wb.due) - Date.now() < 864e5 ? " soon" : ""}" href="${esc(wb.link)}" target="_blank" rel="noopener" title="Apply on the firm's own site, then tick it off with ✓ Mark done">Website application · due ${esc(fmtDue(parseIST(wb.due)))} ↗</a>` : "";
    const nxt = wb ? "" : nx ? `<a class="btn ptnext${parseIST(nx.due) - Date.now() < 864e5 ? " soon" : ""}" href="${esc(PT.portalTaskUrl(a.id))}" target="_blank" rel="noopener" title="Opens this job's tasks on the portal (Assessment Released Post Deadline)">${esc(nx.label)} · due ${esc(fmtDue(parseIST(nx.due)))} ↗</a>` : "";
    const wd = sc !== "out" && [ 1, 6 ].includes(a.statusCode) && parseIST(a.deadline) > Date.now() ? `<a class="btn light ptwd" data-wd="${esc(a.id)}" href="${esc(PT.portalWithdrawUrl(a.id))}" target="_blank" rel="noopener" title="Opens this job on the portal and points at its Withdraw button. Nothing is withdrawn until you press it there and confirm.">Withdraw ↗</a>` : "";
    const bdg = `<div class="ptbadges">${badgeRow(r, {
      noEligible: true,
      noLoading: true,
      counts: {
        applied: a.appliedCount,
        shortlisted: a.shortlistCount
      }
    })}</div>`;
    return `<article class="jc pc st-${sc}${o.glow ? " ptglow" : ""}" data-app="${esc(a.id)}"><div class="r1"><div class="nm"><h3>${esc(short(a.company))}</h3>${o.just ? `<span class="ptjust" title="The portal confirmed this application a moment ago">Just applied</span>` : ""}</div>\n        <div class="rt"><button type="button" class="ptbtn resume" data-resume="${esc(a.id)}" title="Opens the resume you sent with this application, straight from the portal. Nothing is saved.">📄 My resume</button><span class="ptstatus"><i></i>${esc(a.status)}${a.statusCode === 7 ? " 🤞" : ""}</span>${closesPill(a)}</div></div>\n      <div class="ptrole"><span>${esc(a.role)}${note ? ` <small>· ${esc(note)}</small>` : ""}</span>${bdg}</div>\n      <details class="ptsteps" data-steps="${esc(a.id)}"${stepsOpen.has(String(a.id)) ? " open" : ""}><summary>${nextLine(stops, stops.length)}</summary>${metroHtml(stops)}</details>\n      <div class="btns">${wbtn}${nxt}<a class="btn${nxt || wbtn ? " light" : ""}" href="${esc(PT.portalJobUrl(a.id))}" target="_blank" rel="noopener">Open on portal ↗</a>${wb ? "" : site}<span class="ptseg" role="group" aria-label="Show"><button type="button" class="btn light" data-jd="${esc(a.id)}" aria-pressed="false" title="The job's JD summary, under the buttons">JD summary</button><button type="button" class="btn light" data-jobcard="${esc(a.id)}" aria-pressed="false" title="The job card as it was when you applied">Job card</button></span>${qBtn(a.company, "process")}${wd}</div>\n      <div class="pt-jd" data-for="${esc(a.id)}" hidden></div><div class="pt-jobcard" data-for="${esc(a.id)}" hidden></div></article>`;
  }
  function decorate(root, rowsById) {
    sameTab(root);
    root.querySelectorAll(".jc").forEach(card => {
      if (card.dataset.ptd) return;
      card.dataset.ptd = "1";
      const nx = +card.dataset.next, dl = nx ? nx - Date.now() : null;
      card.dataset.urg = card.classList.contains("closed") || dl === null || dl <= 0 ? "x" : dl < 24 * H ? "24" : dl < 7 * 24 * H ? "wk" : "";
      roleGrid(card, rowsById);
      const ids = String(card.dataset.jobs || "").split(/[\s,]+/).filter(Boolean);
      const cur = ((card.querySelector(".rp[aria-selected=true]") || {}).dataset || {}).rp || ids[0];
      const rowOf = id => rowsById[String(id).toLowerCase()];
      const hid = id => id === cur ? "" : " hidden";
      const nm = card.querySelector(".r1 .nm");
      if (nm) nm.insertAdjacentHTML("beforeend", `<span class="ptctrs">${ids.map(id => {
        const r = rowOf(id);
        return `<span data-role="${esc(id)}"${hid(id)}>${r ? ctrHtml(r.ctr) : ""}</span>`;
      }).join("")}</span>`);
      const r1 = card.querySelector(".r1");
      if (r1) r1.insertAdjacentHTML("afterend", `<div class="ptbadges">${ids.map(id => {
        const r = rowOf(id);
        if (!r) return "";
        return `<span class="ptbset" data-role="${esc(id)}"${hid(id)}>${backTag(id)}${badgeRow(r, {
          counts: r.closed ? {
            applied: (r.j || {}).appliedCount,
            shortlisted: (r.j || {}).shortlistCount
          } : null
        })}</span>`;
      }).join("")}</div>`);
      if (ids.length === 1 && !card.querySelector(".rrow")) {
        const r = rowOf(ids[0]), f = r ? facts(r) : null, j = r && r.j || {};
        const pay = !f || !f.ctc ? "" : f.ctc.checking ? "checking…" : f.ctc.na ? "CTC not disclosed" : f.ctc.label.replace(/^CTC:\s*/, "");
        const meta = pay, role = (card.querySelector(".role1") || {}).textContent || j.role || "";
        card.querySelector(".ptbadges").insertAdjacentHTML("afterend", `<div class="rrow ptsolo"><span class="rseg" data-grid="1" style="--cols:3"><span class="rp" aria-selected="true" title="${esc(role)}"><span class="rpn">${esc(role)}</span>${meta ? `<span class="rpm">${esc(meta)}</span>` : ""}</span></span></div>`);
      }
      card.querySelectorAll(".rbody").forEach(b => {
        const r2 = b.querySelector(".r2");
        if (!r2 || b.querySelector(".ptpanel")) return;
        const panel = document.createElement("div");
        panel.className = "ptpanel";
        r2.before(panel);
        panel.appendChild(r2);
        const dl = r2.querySelector('[data-k="Deadline"]');
        if (dl) dl.remove();
        const sp = b.querySelector("p.stages[data-k=stages]");
        if (sp) {
          const stages = sp.textContent.split("→").map(x => x.trim()).filter(Boolean).map(x => ({
            name: x.replace(/\s*✱\s*$/, ""),
            elim: /✱\s*$/.test(x)
          }));
          panel.insertAdjacentHTML("beforeend", hlineHtml(stages));
          sp.remove();
        }
      });
      card.querySelectorAll("a.btn[data-portal]").forEach(b => {
        if (/^Apply\b/.test(b.textContent.trim())) b.textContent = "Full JD · Apply";
      });
      card.querySelectorAll("button.jdbtn").forEach(b => {
        if (/^JD\b/.test(b.textContent.trim())) b.textContent = "JD · summary";
      });
      rail(card, ids, cur, rowOf);
      card.querySelectorAll(".rbody").forEach(b => {
        const id = b.dataset.role, tile = card.querySelector(`.rp[data-rp="${CSS.escape(id)}"] .rpn`) || card.querySelector(`.rp[data-rp="${CSS.escape(id)}"]`) || ids.length === 1 && card.querySelector(".ptsolo .rpn");
        const r = rowOf(id) || {}, role = String(tile && tile.textContent || r.j && r.j.role || r.role || "").trim();
        if (!role) return;
        const l = b.querySelector(".jdpanel:not(.qpanel):not(.ptnojdp) > .lbl");
        if (l) {
          l.className = "lbl ptjdt";
          l.innerHTML = `<b>${esc(role)}</b> <span>(JD summary)</span>`;
        }
        const n = b.querySelector(".ptnojdp > .lbl");
        if (n) {
          n.className = "lbl ptjdt";
          n.innerHTML = `<b>${esc(role)}</b> <span>(JD summary not ready yet)</span>`;
        }
      });
    });
  }
  function qBtn(company, where, tr) {
    const n = company ? ((st && st.qa || {}).rows || []).filter(e => e.status !== "unanswered" && PT.qaSameFirm(PT.qaFirmOf(e), company)).length : 0;
    if (!company) return "";
    if (where === "card" && tr) return n ? `<button type="button" class="ptqc tr-${tr}" data-qfirm="${esc(company)}" data-qwhere="card" title="What CAC / CAS answered about ${esc(short(company))} in the placement group">🗨 ${n} answer${n === 1 ? "" : "s"}</button>` : `<button type="button" class="ptqc ask tr-${tr}" data-qaskfirm="${esc(company)}" title="Opens WhatsApp with your question about ${esc(short(company))} typed in; you pick the placement group and send it">💬 Ask the group ↗</button>`;
    return `<button type="button" class="btn light ptq${n ? "" : " zero"}" data-qfirm="${esc(company)}" data-qwhere="${where}" title="${n ? `What CAC / CAS answered about ${esc(short(company))} in the placement group` : `Nothing answered about ${esc(short(company))} yet: ask in the placement group`}">🗨 ${n} question${n === 1 ? "" : "s"}</button>`;
  }
  function rail(card, ids, cur, rowOf) {
    if (card.querySelector(".ptrail") || !ids.length) return;
    const hid = id => id === cur ? "" : " hidden", top = [], bot = [];
    for (const id of ids) {
      const body = card.querySelector(`.rbody[data-role="${CSS.escape(id)}"]`);
      if (!body) continue;
      const r = rowOf(id) || {}, j = r.j || {}, dl = parseIST(j.deadline), ms = dl ? dl - Date.now() : null, closed = r.closed || ms === null || ms <= 0;
      const tier = closed ? "x" : when(dl).tier;
      const left = card.querySelector(`.r1 .rt [data-role="${CSS.escape(id)}"] .left`);
      const strip = closed ? `<div class="ptclose x"><span>🔒 Applications closed</span>${dl ? `<b>${esc(fmt(dl))}</b>` : ""}</div>` : `<div class="ptclose pt2 ${tier}" data-dl="${dl.getTime()}">${stripIn(dl)}</div>`;
      const g = document.createElement("div");
      g.className = "ptrtop";
      g.dataset.role = id;
      if (hid(id)) g.hidden = true;
      g.innerHTML = strip;
      if (left) left.style.display = "none";
      const apply = body.querySelector("a.btn[data-portal]");
      if (apply) {
        apply.classList.add("ptapply");
        g.appendChild(apply);
      }
      const two = document.createElement("div");
      two.className = "pttwo";
      const site = body.querySelector("a.btn[data-co]");
      if (site) {
        site.innerHTML = "Company site ↗";
        two.appendChild(site);
      }
      const jdb = body.querySelector("button.jdbtn");
      if (jdb) two.appendChild(jdb); else {
        two.insertAdjacentHTML("beforeend", `<button type="button" class="btn light ptnojd" data-nojd="${esc(id)}" aria-expanded="false">JD · summary</button>`);
        const pn = body.querySelector(".ptpanel") || body.firstElementChild;
        (pn || body).insertAdjacentHTML(pn ? "afterend" : "afterbegin", `<div class="jdpanel ptnojdp" data-nojdp="${esc(id)}" hidden><span class="lbl">No summary for this job yet</span><p>The summary fills in here on its own once it's ready. Until then, the full JD is <a href="${esc(PT.portalJobUrl(id))}" target="_blank" rel="noopener">on the placement portal ↗</a></p></div>`);
      }
      if (two.children.length) g.appendChild(two);
      if (closed && !apply) g.insertAdjacentHTML("beforeend", `<a class="btn light ptopen" href="${esc(PT.portalJobUrl(id))}">Open on portal</a>`);
      top.push(g);
      const ptl = body.querySelector(".slot .ptl");
      if (ptl) {
        const b = document.createElement("div");
        b.className = "ptrbot" + (ptl.classList.contains("ptclosed") ? " ptclosed" : "");
        b.dataset.role = id;
        if (hid(id)) b.hidden = true;
        const cv = ptl.querySelector("button[data-cl]");
        if (cv) {
          const badge = card.querySelector(`.ptbset[data-role="${CSS.escape(id)}"] .cvl`);
          if (badge && !clSent(id)) {
            cv.className = "ptmarksent";
            cv.textContent = "Mark sent";
            badge.appendChild(cv);
          } else if (badge && !clApplied(id)) {
            cv.className = "ptmarksent undo";
            cv.textContent = "undo";
            cv.title = "Mark the cover letter as not sent";
            badge.appendChild(cv);
          } else cv.remove();
        }
        while (ptl.firstChild) b.appendChild(ptl.firstChild);
        b.querySelectorAll(".acts").forEach(a => {
          while (a.firstChild) b.insertBefore(a.firstChild, a);
          a.remove();
        });
        bot.push(b);
        ptl.remove();
      }
      const btns = body.querySelector(":scope > .btns");
      if (btns && !btns.querySelector("a,button")) btns.remove();
    }
    if (!top.length) return;
    {
      const rows = ids.map(id => rowOf(id) || {}), r0 = rows[0] || {}, co = (r0.j || {}).company || r0.company;
      const open = rows.map(r => parseIST((r.j || {}).deadline)).filter((d, n) => d && d - Date.now() > 0 && !rows[n].closed).sort((a, b) => a - b)[0];
      const qb = qBtn(co, "card", open ? when(open).tier : "x"), spot = card.querySelector(".ptbadges") || card.querySelector(".r1 .rt") || card.querySelector(".r1");
      const bots = bot.slice();
      if (qb && bots.length && !card.querySelector(".ptqc")) bots.forEach(b => {
        const cal = b.querySelector(".ptcal");
        if (cal) cal.insertAdjacentHTML("beforebegin", qb); else b.insertAdjacentHTML("afterbegin", qb);
        if (cal) {
          const set = card.querySelector(`.ptbset[data-role="${CSS.escape(b.dataset.role || "")}"]`) || card.querySelector(".ptbadges");
          cal.classList.add("ptcalsm");
          if (set) set.appendChild(cal); else cal.remove();
        }
      }); else if (qb && spot && !card.querySelector(".ptqc")) spot.insertAdjacentHTML("beforeend", qb);
    }
    const seg = card.querySelector(".rrow .rseg");
    card.querySelectorAll(".cardslot .ptyou button[data-up]").forEach(b => {
      if (!seg) return;
      const role = b.dataset.aprole || "", status = b.dataset.status || "In process";
      seg.insertAdjacentHTML("afterbegin", `<button type="button" class="rp ptaprole" data-up="1" title="Your application · in the Already applied list at the top"><span class="rpn">${esc(role)}</span><span class="rpm">✓ Applied · ${esc(status)} ↑</span></button>`);
      b.closest(".ptyou").remove();
    });
    if (seg) {
      const n = seg.querySelectorAll(".rp").length;
      if (seg.dataset.grid || n > 1) seg.style.setProperty("--cols", n <= 3 ? n : n === 4 || n >= 7 ? 4 : 3);
    }
    if (F.ni) {
      card.classList.add("ptni");
      card.querySelectorAll(".rp").forEach(rp => {
        let m = rp.querySelector(".rpm");
        if (!m) {
          if (!rp.querySelector(".rpn")) return;
          m = document.createElement("span");
          m.className = "rpm";
          rp.appendChild(m);
        }
        if (!/Not interested/.test(m.textContent)) m.textContent = m.textContent ? m.textContent + " · Not interested" : "Not interested";
      });
    }
    const main = document.createElement("div");
    main.className = "ptmain";
    while (card.firstChild) main.appendChild(card.firstChild);
    const aside = document.createElement("aside");
    aside.className = "ptrail" + (F.ni ? " ni" : "");
    aside.innerHTML = `<div class="ptrt"></div><div class="ptrb"></div>`;
    top.forEach(x => aside.firstChild.appendChild(x));
    bot.forEach(x => aside.lastChild.appendChild(x));
    card.append(main, aside);
    card.classList.add("ptr");
  }
  function pillWarn() {
    const g = st && st.gcal || {};
    if (g.connected && g.calMissing) return {
      k: "cal",
      html: `<span class="ptwarn" title="Your “Placement Tracker” Google calendar was deleted">⚠ Calendar missing</span><button data-remake="1">Make a new one</button>`
    };
    if (g.connected && g.needsReconnect) return {
      k: "sign",
      html: `<span class="ptwarn">⚠ Google needs you to sign in again</span><button data-connect="1">Sign in</button>`
    };
    if (st && st.lastError && !st.paused) return {
      k: "err",
      html: `<span class="ptwarn" title="${esc(st.lastError)}">⚠ Last check didn't finish</span><button data-now="1">Retry</button>`
    };
    return null;
  }
  function gcalStrip() {
    const g = st.gcal || {};
    if (g.connected && g.calMissing) return `<div class="gcal warn ptcalgone"><div><b>Your Placement Tracker calendar was deleted</b><div class="sub">Its entries went with it, so nothing below is in your calendar. A new one gets every entry back.</div></div>\n      <span class="gacts"><button class="gbtn" data-gcal="remake">Make a new one</button></span></div>`;
    if (g.connected && g.needsReconnect) return `<div class="gcal warn"><div><b>⚠️ Google needs you to sign in again</b> to keep your calendar up to date.<div class="sub">Nothing is lost; the tracker catches up as soon as you do.</div></div>\n      <span class="gacts"><button class="gbtn" data-gcal="connect">Sign in again</button></span></div>`;
    if (confirmOff) return `<div class="gcal warn"><span><b>Turn off Google Calendar?</b> Your calendar entries stay but stop updating, and new deadlines won't go in.</span>\n      <span class="gacts"><button class="gbtn" data-gcal="keep">Keep it on</button><a href="#" data-gcal="off" class="tiny">Turn off</a></span></div>`;
    return st.gcalHelp ? `<div class="ghelp"><b>iPhone:</b> ${esc(CFG.phone_help_iphone)}<br><b>Android:</b> ${esc(CFG.phone_help_android)} <a href="#" data-gcal="help">Hide</a></div>` : "";
  }
  function banners() {
    let b = "";
    if (CFG.announcement) b += `<div class="alert note">📣 ${esc(CFG.announcement)}${CFG.announcement_link ? ` <a href="${esc(CFG.announcement_link)}" target="_blank" rel="noopener">More ↗</a>` : ""}</div>`;
    if (CFG.checks_paused) b += `<div class="alert amb">Portal checks are paused for now. Your calendar keeps what it has.</div>`;
    return b;
  }
  const calChip = (key, due) => {
    const id = String(key).split("|")[1];
    if (/^job\|/.test(key) && PT.effectiveHidden(st)[id] && !(lastSnap.apps || []).some(a => a.id === id)) return connected() ? `<span class="ptcal off" title="Marked Not interested: out of your calendar">🚫 Not in calendar</span>` : "";
    if (!connected()) return PT.googleReady() ? `<button type="button" class="ptcal conn" data-gcal="connect" title="Turn on Google Calendar: your deadlines go into a “Placement Tracker” calendar in your Google account (the same as 📅 Calendar on the right edge)">📅 Connect calendar</button>` : "";
    if ((st.gcal || {}).calMissing) return `<span class="ptcal off" title="Your “Placement Tracker” calendar was deleted · Make a new one at the top">📅 Not in calendar</span>`;
    const rec = (st.calSync || {})[key], d = parseIST(due), past = d && d.getTime() <= Date.now();
    if (rec && rec.due === due) return `<span class="ptcal on" title="In your “Placement Tracker” Google calendar">📅 In calendar</span>`;
    if (!rec && past) return "";
    const cp = st.calProg;
    return `<span class="ptcal wait" title="Goes into your calendar at the next sync">📅 Adding…${cp && cp.total > 1 && cp.done < cp.total ? ` ${cp.done} of ${cp.total}` : ""}</span>`;
  };
  const stageList = s => String((s || {}).stages || "").split(/\s*(?:>|→|->)\s*/).map(x => x.trim()).filter(Boolean);
  function jobRows(snap) {
    const sheetBy = {};
    ((st.sheet || {}).jobs || []).forEach(r => {
      sheetBy[String(r.application_id || "").trim().toLowerCase()] = r;
    });
    return PT.openJobs(snap).map(j => {
      const p = PT.poolFor(j, snap.dash);
      return {
        id: j.id,
        j: j,
        s: sheetBy[String(j.id).toLowerCase()] || {},
        pool: p ? p.pool : "",
        due: parseIST(j.deadline)
      };
    });
  }
  function enrich(rows) {
    for (const r of rows) {
      const d = (st.details || {})[r.application_id];
      if (!d) continue;
      if (d.cgpa) r.cgpa_required = /^no\b/i.test(d.cgpa) ? "No" : /^yes\b/i.test(d.cgpa) ? "Yes" : d.cgpa;
      if (d.workType) r.work_type = d.workType;
      if (d.interview) r.interview_mode = d.interview;
      if (d.locations) r.locations = d.locations;
      if (d.country) r.country = d.country;
      if (d.website) r.apply_on_company_website = "Yes";
      if (d.websiteLink) r.company_website_link = d.websiteLink;
      if ((d.stages || []).length) r.stages = d.stages.slice().sort((a, b) => (a.seq || 0) - (b.seq || 0)).map(x => x.name + (x.elim ? "*" : "")).join(" > ");
      if (d.expMin != null && !/\d/.test(r.exp_min || "")) r.exp_min = String(d.expMin) + (d.minFlex ? " (flexible)" : "");
      if (d.expMax != null && !/\d/.test(r.exp_max || "")) r.exp_max = String(d.expMax) + (d.maxFlex ? " (flexible)" : "");
    }
    return rows;
  }
  function closedRows(snap) {
    const sheetBy = {};
    ((st.sheet || {}).jobs || []).forEach(r => {
      sheetBy[String(r.application_id || "").trim().toLowerCase()] = r;
    });
    const now = Date.now();
    const applied = (snap.apps || []).filter(a => a.deadline && (parseIST(a.deadline) || 0) <= now).map(a => ({
      id: a.id,
      company: a.company,
      role: a.role,
      cluster: a.cluster,
      jobType: a.jobType,
      deadline: a.deadline,
      shortlistBy: a.shortlistBy,
      counterType: a.counterType,
      appliedCount: a.appliedCount,
      shortlistCount: a.shortlistCount,
      __app: a
    }));
    return PT.closedJobs(snap).concat(applied).sort((x, y) => (parseIST(y.deadline) || 0) - (parseIST(x.deadline) || 0)).map(j => {
      const p = PT.poolFor(j, snap.dash);
      return {
        id: j.id,
        j: j,
        s: sheetBy[String(j.id).toLowerCase()] || {},
        pool: p ? p.pool : "",
        due: null,
        closed: true,
        applied: j.__app || null
      };
    });
  }
  function renderSearch(el, snap) {
    const keep = {
      ni: F.ni,
      closed: F.closed
    }, ap0 = apOpen, parts = [];
    el.innerHTML = "";
    for (const [k, ni, closed, label] of [ [ "open", false, false, "Open" ], [ "ni", true, false, "Not interested" ], [ "closed", false, true, "Closed" ] ]) {
      F.ni = ni;
      F.closed = closed;
      apOpen = true;
      const box = document.createElement("div");
      box.className = "ptsrch";
      box.dataset.view = k;
      el.appendChild(box);
      try {
        renderJobs(box, snap, true);
      } catch (e) {
        box.remove();
        continue;
      }
      const n = box.querySelectorAll("#pt-cards > .jc").length, na = box.querySelectorAll("#pt-apcards > .jc").length;
      parts.push([ k, label, n, na, box ]);
    }
    Object.assign(F, keep);
    apOpen = ap0;
    const bar = el.querySelector(".pt-filters"), fgs = el.querySelector(".pt-fgs");
    el.querySelectorAll(".ptsrch .pt-filters, .ptsrch .pt-fgs, .ptsrch .pt-ninote, .ptsrch .ptckey, .ptsrch .empty").forEach(x => {
      if (x !== bar && x !== fgs) x.remove();
    });
    if (bar) el.prepend(bar);
    if (fgs) bar.after(fgs);
    if (bar) bar.querySelectorAll(".pt-sum .ptn.on").forEach(b => {
      b.classList.remove("on");
      b.setAttribute("aria-pressed", "false");
    });
    let total = 0;
    for (const [k, label, n, na, box] of parts) {
      total += n + na;
      if (!n && !na) {
        box.remove();
        continue;
      }
      box.insertAdjacentHTML("afterbegin", `<div class="ptpart">${label}<span> · ${n + na} match${n + na === 1 ? "" : "es"}</span></div>`);
    }
    const line = `<div class="pt-gsline">${total ? `${total} match${total === 1 ? "" : "es"} for <b>“${esc(Q)}”</b>` : `Nothing matches <b>“${esc(Q)}”</b> in any list`}${parts.map(([, l, n, na]) => `<span>${l} ${n + na}</span>`).join("")}</div>`;
    (fgs || bar || el).insertAdjacentHTML(fgs || bar ? "afterend" : "afterbegin", line);
  }
  function renderJobs(el, snap, inSearch) {
    if (listOn() && !inSearch) return renderJobsList(el, snap);
    if (Q && !inSearch) return renderSearch(el, snap);
    PAGE = "jobs";
    const open = jobRows(snap), hid = st.hiddenJobs || {}, shut = closedRows(snap);
    const all = F.closed ? shut : open.filter(r => F.ni ? hid[r.id] : !hid[r.id]);
    const shown = all.filter(r => passes(r));
    const rowsById = {};
    open.concat(shut).forEach(r => {
      rowsById[String(r.id).toLowerCase()] = r;
    });
    const niN = open.filter(r => hid[r.id]).length;
    const sameCo = (x, y) => PT.shortFirm(x) === PT.shortFirm(y);
    open.forEach(r => {
      r.ctr = PT.counterLine(r.j, snap, {
        firmJobs: open.filter(x => sameCo(x.j.company, r.j.company)).length
      });
    });
    shut.forEach(r => {
      r.ctr = r.applied ? PT.counterLine(r.j, snap, {
        closed: true
      }) : null;
    });
    const sheet = st.sheet || {}, applied = (snap.apps || []).filter(a => LIVE(a.statusCode)), appById = Object.fromEntries(applied.map(a => [ a.id, a ]));
    const now = Date.now(), apLive = applied.filter(a => !a.deadline || (parseIST(a.deadline) || 0) > now);
    const istDay = d => new Date(+d + 5.5 * H).toISOString().slice(0, 10), today = istDay(now);
    const todayN = open.filter(r => !hid[r.id] && r.due && istDay(r.due) === today).length, view = F.closed ? "closed" : F.ni ? "ni" : "open";
    const sum = `<div class="pt-sum" role="group" aria-label="Summary">${sumBtn("open", open.length - niN + apLive.length, "Open", todayN ? `${todayN} close${todayN > 1 ? "" : "s"} today` : "", view === "open")}${sumBtn("applied", apLive.length, "Applied", apLive.length ? "still open" : "", view === "open" && apShown() && apLive.length > 0)}${sumBtn("ni", niN, "Not interested", "", view === "ni")}${sumBtn("closed", shut.length, "Closed", "", view === "closed")}</div>`;
    const openRows = enrich(PT.cardRows(shown.map(r => r.j), sheet.jobs));
    const firstOpen = js => js.map(r => +TBCJobCard.util.deadlineOf(r)).sort((a, b) => a - b)[0];
    const groups = TBCJobCard.groupFirms(openRows, {
      view: "all"
    }).sort((a, b) => F.closed ? firstOpen(b) - firstOpen(a) : firstOpen(a) - firstOpen(b));
    const apShow = F.ni || F.closed ? [] : appRows(snap).filter(r => apLive.some(a => a.id === r.id) && (!Q || qMatch(r))).sort((x, y) => (parseIST(x.a.deadline) || Infinity) - (parseIST(y.a.deadline) || Infinity));
    const apFirmNames = [ ...new Set(apShow.map(r => short(r.a.company))) ];
    const slot = r => {
      if (F.closed) {
        const row = rowsById[String(r.application_id).toLowerCase()] || {}, j = row.j || {}, d = parseIST(j.deadline);
        const firm = short(j.company || r.company || "").toLowerCase(), ap = row.applied ? row : Object.values(rowsById).find(x => x && x.applied && x.j && short(x.j.company || "").toLowerCase() === firm);
        if (ap) return `<div class="ptl ptclosed"><span class="ptappliedt">✓ You applied · ${esc(ap.applied.status || "Applied")}</span><a class="ptmal" href="#/student/my-applications">See it in Manage Applications ↗</a></div>`;
        return "";
      }
      const row = rowsById[String(r.application_id).toLowerCase()] || {}, j = row.j || {};
      const cl = facts(row).cl && !clApplied(j.id) ? `<button type="button" class="ptbtn cvbtn${(st.clDone || {})[j.id] ? " on" : ""}" data-cl="${esc(j.id)}" title="Tick when your cover letter is sent">${(st.clDone || {})[j.id] ? "✓ Cover letter sent" : "✉ Mark cover letter sent"}</button>` : "";
      const ni = F.ni ? `<a class="hide back" href="#" data-unhidejob="${esc(j.id)}">↩ Show again</a>` : `<a class="hide" href="#" data-hidejob="${esc(j.id)}" title="Hides this job here${connected() ? " and takes its deadline out of your calendar" : ""}. Nothing changes on the portal.">Not interested</a>`;
      const fo = j.id ? formOf(j.id) : null, fm = fo && fo.open ? `<a class="ptbtn fmbtn" href="${esc(PT.portalTaskUrl(j.id))}" data-form="${esc(j.id)}" title="${esc("Opens " + (fo.label || "the form") + " on the portal. The tracker fills what it can from your saved answers; you check it and press Submit.")}">📝 Fill the form ↗</a>` : "";
      return `<div class="ptl"><span class="acts">${fm}${cl}${calChip("job|" + j.id, j.deadline)}${ni}</span></div>`;
    };
    const niNote = F.ni ? `<div class="pt-ninote">Showing only the jobs you marked Not interested${connected() ? " · they're out of your calendar" : ""} · Show again puts one back</div>` : F.closed ? closedKey() : "";
    const apList = apShow.length ? `<details class="aplist" id="pt-aplist"${apOpen ? " open" : ""}><summary>✓ Already applied · ${apShow.length} open job${apShow.length === 1 ? "" : "s"}: ${apFirmNames.map(esc).join(", ")}</summary><div id="pt-apcards" class="tbcjc">${apShow.map(r => procCard(r)).join("")}</div></details>` : "";
    const cardSlot = js => {
      const mine = apShow.filter(r => short(r.a.company).toLowerCase() === short(js[0].company).toLowerCase());
      return mine.map(r => `<div class="ptyou"><button type="button" data-up="1" data-aprole="${esc(r.a.role)}" data-status="${esc(r.a.status || "In process")}" title="Your application is in the Already applied list at the top">✓ You applied to ${esc(r.a.role)} (above) ↑</button></div>`).join("");
    };
    el.innerHTML = filterBar("jobs", all, sum) + niNote + apList + `<div id="pt-cards"></div>` + (groups.length ? "" : `<div class="empty">${F.ni ? "Nothing marked Not interested." : F.closed ? "No closed jobs." : all.length ? "Nothing matches these filters." : "No open jobs you haven't applied to."}</div>`);
    const onEvent = (n, d) => {
      if (n === "role_pick" && d && d.firm) lastOpenRole[d.firm] = d.id;
    };
    TBCJobCard.render(el.querySelector("#pt-cards"), groups, {
      slot: slot,
      cardSlot: cardSlot,
      onEvent: onEvent
    });
    decorate(el.querySelector("#pt-cards"), rowsById);
    sameTab(el);
    [ ...el.querySelectorAll("#pt-cards .jc") ].forEach(c => {
      const all = [ ...c.querySelectorAll(".rp[data-rp]") ].map(b => b.dataset.rp);
      const pick = all.includes(lastOpenRole[c.dataset.firm]) ? lastOpenRole[c.dataset.firm] : null;
      if (pick && all.length > 1) TBCJobCard.pickRole(c, pick, false);
    });
    if (F.closed) closedColours(el.querySelector("#pt-cards"), rowsById, hid);
    lockHeights(el.querySelector("#pt-cards"));
    const strip = el.querySelector("#pt-aplist");
    if (scrollAp && strip) {
      scrollAp = false;
      const bar = el.querySelector(".pt-filters");
      strip.style.scrollMarginTop = (bar ? bar.offsetHeight : 0) + (parseInt(getComputedStyle(strip).getPropertyValue("--pt-top")) || 0) + 12 + "px";
      strip.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }
    scrollAp = false;
  }
  const CK = {
    live: true,
    end: true,
    plain: true
  };
  function closedColours(root, rowsById, hid) {
    if (!root) return;
    const n = {};
    root.querySelectorAll(".jc").forEach(card => {
      const ids = String(card.dataset.jobs || "").split(/[\s,]+/).filter(Boolean);
      const states = ids.map(id => {
        const a = (rowsById[String(id).toLowerCase()] || {}).applied;
        return a ? LIVE(a.statusCode) ? "live" : "end" : "plain";
      });
      const s = states.includes("live") ? "live" : states.includes("end") ? "end" : "plain";
      card.classList.remove("ptc-live", "ptc-end", "ptc-ni", "ptc-open");
      if (s !== "plain") card.classList.add("ptc-" + s);
      card.querySelectorAll(".rp[data-rp], .ptsolo .rp").forEach(b => {
        const k = b.dataset.rp ? states[ids.findIndex(x => String(x).toLowerCase() === String(b.dataset.rp).toLowerCase())] : states[0];
        b.classList.remove("ptr-live", "ptr-end");
        if (k && k !== "plain") b.classList.add("ptr-" + k);
      });
      card.dataset.ck = s;
      card.hidden = !CK[s];
      (states.length ? states : [ s ]).forEach(k => {
        n[k] = (n[k] || 0) + 1;
      });
    });
    const key = root.parentElement && root.parentElement.querySelector(".ptckey");
    if (key) {
      key.querySelectorAll("[data-ckn]").forEach(s => {
        s.textContent = n[s.dataset.ckn] || 0;
      });
      key.onchange = e => {
        const c = e.target.closest("input[data-ck]");
        if (!c) return;
        CK[c.dataset.ck] = c.checked;
        root.querySelectorAll(".jc[data-ck]").forEach(card => {
          card.hidden = !CK[card.dataset.ck];
        });
      };
    }
  }
  function closedKey() {
    const box = (k, cls, label) => `<label><input type="checkbox" data-ck="${k}"${CK[k] ? " checked" : ""}><i class="${cls}"></i>${label} <b data-ckn="${k}">0</b></label>`;
    return `<div class="ptckey" role="group" aria-label="Show closed jobs">${box("live", "g", "Applied, in process")}${box("end", "x", "Applied, not shortlisted or withdrawn")}${box("plain", "p", "Not applied")}</div>`;
  }
  function appRows(snap) {
    const sheetBy = {};
    ((st.sheet || {}).jobs || []).forEach(r => {
      sheetBy[String(r.application_id || "").trim().toLowerCase()] = r;
    });
    const jobBy = {};
    (snap.jobs || []).forEach(j => {
      jobBy[j.id] = j;
    });
    const items = PT.calItems(snap, st.details || {}, st.webDone);
    return (snap.apps || []).map(a => {
      const j = jobBy[a.id] || {
        id: a.id,
        role: a.role,
        industry: "",
        ctc: ""
      };
      const steps = items.filter(it => it.appId === a.id).map(it => {
        const s = PT.calState(it, null, a);
        return s === "new" || it.done && LIVE(a.statusCode) ? it : s === "past" && LIVE(a.statusCode) && (PT.FEATURES.markDone || it.label !== "Website application") ? Object.assign({}, it, {
          missed: true
        }) : null;
      }).filter(Boolean).sort((x, y) => parseIST(x.due) - parseIST(y.due));
      const open = steps.filter(it => !it.done && !it.missed);
      const d = (st.details || {})[a.id] || {}, stages = (d.stages || []).slice().sort((x, y) => (x.seq || 0) - (y.seq || 0)).map(x => x.name + (x.elim ? "*" : "")).join(" > ");
      return {
        id: a.id,
        a: a,
        j: j,
        s: Object.assign({}, sheetBy[String(a.id).toLowerCase()] || {}, stages ? {
          stages: stages
        } : {}),
        pool: (PT.poolFor(jobBy[a.id] || a, snap.dash) || {}).pool || "",
        due: open[0] ? parseIST(open[0].due) : null,
        steps: steps
      };
    });
  }
  let clapFor = "", clapAt = 0;
  function newShortlists(snap) {
    const sl = (snap.apps || []).filter(a => a.statusCode === 2 || a.statusCode === 8), seen = st.seenShortlists;
    if (!seen) {
      if (sl.length || snap.apps) chrome.storage.local.set({
        seenShortlists: Object.fromEntries(sl.map(a => [ a.id, Date.now() ]))
      });
      return;
    }
    const fresh = sl.filter(a => !seen[a.id]);
    if (!fresh.length) return;
    chrome.storage.local.set({
      seenShortlists: Object.assign({}, seen, Object.fromEntries(fresh.map(a => [ a.id, Date.now() ])))
    });
    const names = [ ...new Set(fresh.map(a => short(a.company))) ];
    const t = document.createElement("div");
    t.id = "pt-confetti";
    t.setAttribute("role", "status");
    const calm = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches, cols = [ "#1e7a46", "#d9741a", "#2563eb", "#0d9488", "#e11d48", "#f5b301" ];
    t.innerHTML = (calm ? "" : Array.from({
      length: 36
    }, (_, i) => `<i style="left:${i * 37 % 100}%;background:${cols[i % cols.length]};animation-delay:${i % 6 * 40}ms;--dx:${i * 53 % 120 - 60}px;--r:${i * 97 % 360}deg"></i>`).join("")) + `<b>🎉 New shortlist${names.length > 1 ? "s" : ""}: ${esc(names.join(", "))}</b>`;
    document.body.appendChild(t);
    setTimeout(() => t.classList.add("out"), 3200);
    setTimeout(() => t.remove(), 3800);
  }
  function renderApps(el, snap) {
    PAGE = "apps";
    newShortlists(snap);
    const all = appRows(snap), det = st.details || {};
    const now = Date.now(), live0 = all.filter(r => LIVE(r.a.statusCode)), slN = all.filter(r => [ 2, 7, 8 ].includes(r.a.statusCode));
    const dueRows = live0.filter(r => r.due && r.due - now > 0 && r.due - now <= 7 * 24 * H), in24 = dueRows.filter(r => r.due - now <= 24 * H).length;
    const shutN = all.length - live0.length, v = F.apps;
    const sum = `<div class="pt-sum" role="group" aria-label="Summary">${sumBtn("apps-ip", live0.length, "In process", "", v === "ip", "open")}${sumBtn("apps-sl", slN.length, "Shortlisted", "", v === "ip" && slOpen && slN.length > 0, "applied")}${sumBtn("apps-due", dueRows.length, "Steps due this week", in24 ? `${in24} in 24 h` : "", v === "due", "ni")}${sumBtn("apps-cl", shutN, "Rejected / closed", "", v === "cl", "closed")}</div>`;
    const inView = r => v === "sl" ? [ 2, 7, 8 ].includes(r.a.statusCode) : v === "due" ? dueRows.includes(r) : v === "cl" ? !LIVE(r.a.statusCode) : LIVE(r.a.statusCode);
    const rows = all.filter(inView).filter(r => passes(r));
    const isSl = r => [ 2, 7, 8 ].includes(r.a.statusCode), byDate = d => (x, y) => (d(x) || Infinity) - (d(y) || Infinity);
    const nextAt = r => (r.steps || []).filter(it => !it.done && !it.missed).map(it => parseIST(it.due)).filter(t => t && t > now).sort((a, b) => a - b)[0] || null;
    const slSort = (x, y) => (x.due && x.due > now ? 0 : 1) - (y.due && y.due > now ? 0 : 1) || byDate(r => r.due && r.due > now ? r.due : nextAt(r))(x, y) || byDate(r => parseIST(r.a.shortlistBy))(x, y);
    const waitSort = (x, y) => byDate(r => r.due)(x, y) || byDate(r => parseIST(r.a.shortlistBy))(x, y);
    const liveAll = rows.filter(r => LIVE(r.a.statusCode)), slRows = liveAll.filter(isSl).sort(slSort);
    const live = v === "ip" ? liveAll.filter(r => !isSl(r)).sort(waitSort) : liveAll.sort((x, y) => (isSl(x) ? 0 : 1) - (isSl(y) ? 0 : 1) || (isSl(x) ? slSort(x, y) : waitSort(x, y)));
    const openUntil = r => {
      const d = parseIST(r.a.deadline);
      return d && d > now ? d.getTime() : null;
    };
    const todoAt = r => Math.min(r.due && r.due > now ? r.due : Infinity, openUntil(r) || Infinity);
    const todo = v === "ip" ? live.filter(r => todoAt(r) < Infinity).sort((x, y) => todoAt(x) - todoAt(y)) : [];
    const rest = v === "ip" ? live.filter(r => todoAt(r) === Infinity).sort((x, y) => byDate(r => parseIST(r.a.shortlistBy))(x, y) || byDate(nextAt)(x, y)) : live;
    const closed = rows.filter(r => !LIVE(r.a.statusCode));
    const ja = st.justApplied || {}, just = id => {
      const x = ja[String(id).toLowerCase()];
      return x && now - x.at < 15 * 6e4 ? x : null;
    };
    const glowNow = [];
    const card = r => {
      const lid = String(r.a.id).toLowerCase(), j1 = just(r.a.id), glow = j1 && (!j1.seen || glowing.has(lid));
      if (j1 && !j1.seen) {
        glowNow.push(lid);
        glowing.add(lid);
      }
      return procCard(r, {
        just: j1,
        glow: glow
      });
    };
    const pr = st.progress, loading = pr && pr.due > pr.done ? `<div class="sub" style="margin-bottom:6px">⏳ Reading job details · <b>${pr.done} of ${pr.due}</b></div>` : "";
    const empty = pr && pr.lists ? "Loading your applications…" : !rows.length && all.filter(inView).length ? "Nothing matches these filters." : {
      ip: "No live applications.",
      sl: "No shortlists yet.",
      due: "No next step due this week.",
      cl: "Nothing rejected or closed."
    }[v];
    const slFold = v === "ip" && slRows.length ? `<details class="aplist slfold" id="pt-slfold"${slOpen ? " open" : ""}><summary title="Fold or open your shortlists">🎉 Shortlisted<span> · ${slRows.length} · ${[ ...new Set(slRows.map(r => short(r.a.company))) ].map(esc).join(", ")}</span></summary><div class="tbcjc">${slRows.map(card).join("")}</div></details>` : "";
    const part = (k, t, why, rs) => `<details class="aplist slfold ptpf" data-pf="${k}"${partOpen[k] ? " open" : ""}><summary title="Fold or open this part">${t}<span> · ${rs.length} · ${why}</span></summary><div class="tbcjc">${rs.map(card).join("")}</div></details>`;
    const parts = v !== "ip" ? "" : (todo.length ? part("todo", "Something to do", "a task or deadline still open", todo) : "") + (rest.length ? part("rest", "The rest", "waiting for a result or the next round", rest) : "");
    const body = v !== "ip" ? live.map(card).join("") : "";
    el.innerHTML = filterBar("apps", all, sum) + loading + slFold + parts + (v === "cl" || v === "ip" && (parts || slFold) ? "" : `<div class="tbcjc">${body || `<div class="empty">${empty}</div>`}</div>`) + (v === "cl" ? closed.length ? `<div class="tbcjc">${closed.map(r => procCard(r)).join("")}</div>` : `<div class="empty">${empty}</div>` : "");
    const fold = el.querySelector("#pt-slfold");
    if (scrollSl && fold) {
      const bar = el.querySelector(".pt-filters"), under = bar ? bar.getBoundingClientRect().bottom : 0, top = fold.getBoundingClientRect().top;
      if (top < under || top > innerHeight - 80) scrollBy({
        top: top - under - 8,
        behavior: "smooth"
      });
    }
    scrollSl = false;
    if (glowNow.length) {
      const next = Object.assign({}, ja);
      glowNow.forEach(id => {
        next[id] = Object.assign({}, next[id], {
          seen: true
        });
      });
      chrome.storage.local.set({
        justApplied: next
      });
    }
  }
  const listOn = () => !!st && st.listView !== false;
  let dashView = "list", listOpen = "", listIds = new Set, listTab = {}, bandFold = {
    ap: true
  }, listMore = {};
  const BANDS = [ [ "r", "Closes within 24 hours", "Nothing closes within 24 hours" ], [ "a", "Closes within 3 days", "Nothing closes within 3 days" ], [ "g", "Closes later", "Nothing else open" ] ];
  const cap = x => String(x || "").replace(/^./, c => c.toUpperCase());
  const LCOLS = `<colgroup><col class="k0"><col class="k1"><col class="k2"><col class="k3"><col class="k4"><col class="k5"><col class="k6"><col class="k7"></colgroup>`;
  const LSORT = {
    firm: "Firm · role",
    cluster: "Counters",
    pay: "Pay",
    closes: "Closes"
  };
  const shortPool = p => String(p || "").replace(/^\s*cluster\s*-?\s*(\d+)/i, "C$1");
  const lsort = () => {
    const v = st && st.listSort || {};
    return LSORT[v.k] ? {
      k: v.k,
      d: v.d === -1 ? -1 : 1
    } : {
      k: "closes",
      d: 1
    };
  };
  const sth = (k, cls, title) => {
    const s0 = lsort(), on = s0.k === k, arr = on ? s0.d === 1 ? " ▲" : " ▼" : " ↕";
    return `<th class="${cls} ptls${on ? " on" : ""}" data-lsort="${k}" aria-sort="${on ? s0.d === 1 ? "ascending" : "descending" : "none"}" title="${esc(title)} · click to sort${on ? ", again to reverse" : ""}">${LSORT[k]}<span class="ptlsa">${arr}</span></th>`;
  };
  const jobHead = () => `<tr><th class="k0"></th>${sth("firm", "k1", "Firm, A to Z")}${sth("cluster", "k2", "The cluster this job draws from and how many of its counters you have left")}${sth("pay", "k3", "The pay as the portal lists it, highest first. Only you see it")}<th class="k4" title="Only what needs your attention: a cover letter, a second application on the firm's site, eligibility, CGPA">Heads-up</th>${sth("closes", "k5", "When applications close (IST), soonest first; the bar empties over the last 3 days")}<th class="k6" title="What CAC and CAS answered about the firm in the placement group">Q&amp;A</th><th class="k7"></th></tr>`;
  const grpKey = (g, k) => k === "firm" ? short((g[0].j || g[0].a || {}).company || "").toLowerCase() : k === "cluster" ? String(g[0].pool || "~").toLowerCase() : k === "pay" ? Math.max(-1, ...g.map(r => {
    const c = facts(r).ctc;
    return c && !c.na && c.lakhs != null ? c.hiLakhs != null ? c.hiLakhs : c.lakhs : -1;
  })) : Math.min(...g.map(r => r.due || r.a && parseIST(r.a.deadline) || Infinity));
  function sortGroups(groups) {
    const {k: k, d: d} = lsort(), dd = k === "pay" ? -d : d;
    const tie = (x, y) => grpKey(x, "closes") - grpKey(y, "closes") || String(grpKey(x, "firm")).localeCompare(String(grpKey(y, "firm")));
    return groups.slice().sort((x, y) => {
      const a = grpKey(x, k), b = grpKey(y, k);
      if (k === "pay" && (a < 0 || b < 0) && a !== b) return a < 0 ? 1 : -1;
      const c = typeof a === "string" ? a.localeCompare(b) : a - b;
      return (c ? c * dd : 0) || tie(x, y);
    });
  }
  function dlBox(dl, lead) {
    if (!dl) return `<span class="ptlq" title="The portal hasn't given a date">No date given</span>`;
    const w = when(dl);
    return `<div class="ptdl ${w.tier}" data-dl="${dl.getTime()}" title="${esc((lead || "Closes") + " " + fmt(dl) + " IST")}"><b>${esc(cap(w.day))} · ${esc(w.t)}</b><span class="bb">${esc(w.left)} left <i style="--p:${w.pct.toFixed(1)}%"></i></span></div>`;
  }
  const payLabel = c => !c ? "" : c.na ? "Not disclosed" : String(c.label || "").replace(/^CTC:\s*/, "");
  const payTxt = row => {
    const c = facts(row).ctc;
    if (!c) return "";
    if (c.checking) return `<span class="ptlq" title="The tracker is reading this job's pay from the portal">reading…</span>`;
    const t = esc(c.na ? "The firm hasn't disclosed the pay" : (c.raw ? "Firm's text: " + c.raw : "CTC as listed on the portal") + " · only you see this"), l = payLabel(c), m = /^(.*?)[\s·]*(≈.*)$/.exec(l);
    const nb = x => esc(x).replace(/₹ /g, "₹ ").replace(/–/g, "–⁠").replace(/ (L|Cr|K|LPA)\b/g, " $1").replace(/\b([A-Z]{3}) (?=\d)/g, "$1 ");
    return `<span data-k="pay" title="${t}">${m ? nb(m[1]) + `<small>${esc(m[2])}</small>` : nb(l)}</span>`;
  };
  function payRange(rows) {
    const cs = rows.map(r => facts(r).ctc).filter(c => c && c.lakhs != null && !c.na), ls = cs.map(c => Math.round(c.lakhs)), hs = cs.map(c => Math.round(c.hiLakhs != null ? c.hiLakhs : c.lakhs));
    if (!ls.length) return rows.some(r => (facts(r).ctc || {}).checking) ? `<span class="ptlq">reading…</span>` : `<span class="ptlq">Not disclosed</span>`;
    const lo = Math.min(...ls), hi = Math.max(...hs);
    return `<span title="The roles' pay as the portal lists it · only you see this">₹ ${lo === hi ? lo : lo + "–" + hi} L</span>`;
  }
  const sharesCounter = r => !!(r.ctr && !r.ctr.none && !r.ctr.unknown && /company/i.test((r.j || {}).counterType || ""));
  function closedCnt(r) {
    const ap = apN(r), sl = slN(r);
    if (!ap) return "";
    const pc = sl > 0 && sl <= ap ? sl * 100 / ap < 1 ? "<1%" : Math.round(sl * 100 / ap) + "%" : "";
    return sl > 0 ? `<small class="ptlcn" title="From the portal: ${ap} students applied, ${sl} were shortlisted">${ap} applied · ${sl} shortlisted${pc ? ` <em>(${pc})</em>` : ""}</small>` : `<small class="ptlcn aw" title="From the portal: ${ap} students applied; the shortlist isn't out yet">${ap} applied · shortlist awaited</small>`;
  }
  function poolCell(rows) {
    const r = rows[0], c = r.ctr;
    if (r.closed) {
      const base = c ? poolCell0(rows) : `<span>${esc(shortPool(r.pool || (r.j || {}).cluster) || "—")}</span>`;
      return base + closedCnt(r);
    }
    return poolCell0(rows);
  }
  function poolCell0(rows) {
    const r = rows[0], c = r.ctr;
    if (!c) return `<span class="ptlq">—</span>`;
    if (c.none) return `<span title="Applying here uses no counter">${esc(r.pool && /international/i.test(r.pool) ? "International ✈" : "No counter")}<small>No counter needed</small></span>`;
    if (c.unknown) return `<span title="The tracker is still reading your counters">${esc(shortPool(c.pool) || "Counters")}<small>${esc(c.cost || "")}</small></span>`;
    const left = c.used ? `<b class="okc" title="One counter covers this firm's roles in this cluster, and your application here already used it">✓ No new counter</b>` : c.left != null && c.total != null ? c.state === "last" ? `<b class="ptllast" title="This would use your last counter in this cluster">last counter · 1 of ${c.total} left</b>` : `<span class="nw">${c.left} of ${c.total} left</span>` : "";
    return `<span title="The cluster this job draws from and how many of its counters you have left${/per role|^1 counter$/.test(c.cost || "") && rows.length === 1 && !c.used ? "; applying uses 1 counter" : ""}">${esc(shortPool(c.pool) || "Counters")}<small>${left}</small></span>`;
  }
  function huTags(row) {
    const f = facts(row), d = (st.details || {})[row.id] || {}, c = siteChips(row), out = [];
    if (!f.hasD) return null;
    if (f.cl) out.push([ "cl", clSent(row.id) ? `<span class="tag ptx cvl done" title="Cover letter sent">📩 Sent ✓</span>` : `<span class="tag ptx cvl yes" title="Cover letter needed${f.clTo ? ". Address it to: " + esc(f.clTo) : ""}">📩 Cover letter</span>` ]);
    if (formOf(row.id)) out.push([ "fm", formTag(row.id) ]);
    if (d.website) out.push([ "ws", `<span class="tag ptx ws" title="This job also asks for an application on the firm's own site, as well as the portal">🌐 Company site too</span>` ]);
    if (f.eligible === false) out.push([ "el", `<span class="tag ptx elig no" title="The portal says you are not eligible for this job; open it on the portal to see why">✗ Not eligible</span>` ]);
    if (c.cgpa) out.push([ "cg", c.cgpa.replace('data-k="cgpa"', `title="${/no/.test(c.cgpa) ? "Your CGPA is not shared with the firm" : "Your CGPA is shared with the firm"}"`) ]);
    return out;
  }
  function headsUp(rows) {
    const seen = new Map;
    let reading = false;
    for (const r of rows) {
      const t = huTags(r);
      if (!t) {
        reading = true;
        continue;
      }
      for (const [k, h] of t) if (!seen.has(k)) seen.set(k, h);
    }
    if (!seen.size) return reading ? `<span class="ptlq" title="The tracker is reading this job's details from the portal">reading…</span>` : `<span class="ptlq" title="Nothing special to watch for">—</span>`;
    return [ ...seen.values() ].join("");
  }
  function qCell(company, tr) {
    const n = company ? ((st && st.qa || {}).rows || []).filter(e => e.status !== "unanswered" && PT.qaSameFirm(PT.qaFirmOf(e), company)).length : 0;
    return n ? `<button type="button" class="ptlqa tr-${tr}" data-qfirm="${esc(company)}" data-qwhere="list" title="${n} question${n === 1 ? "" : "s"} about ${esc(short(company))} answered by CAC / CAS in the placement group · opens them">🗨 ${n}</button>` : `<button type="button" class="ptlqa ask tr-${tr}" data-qaskfirm="${esc(company)}" title="Nothing answered about ${esc(short(company))} yet · opens WhatsApp with your question typed in; you pick the placement group and send it">💬</button>`;
  }
  const applyBtn = id => `<a class="ptlap" href="${esc(PT.portalJobUrl(id))}" data-portal="1" title="Opens this job on the placement portal: the full JD and the Apply button">Full JD · Apply</a>`;
  const niBtn = id => F.ni ? `<button type="button" class="ptlni back" data-unhidejob="${esc(id)}" title="Show again: back in your list${connected() ? " and your calendar" : ""}">↩</button>` : `<button type="button" class="ptlni" data-hidejob="${esc(id)}" title="Not interested: hides this role${connected() ? " and takes its deadline out of your calendar" : ""} (Undo for a few seconds). Nothing changes on the portal.">✕</button>`;
  const siteBtn = (row, d) => d.website && /^https?:\/\//i.test(d.websiteLink || "") ? `<a class="ptlap ws sm2" href="${esc(d.websiteLink)}" target="_blank" rel="noopener" data-co="1" title="This role also asks you to apply on the firm's own site: opens it">Apply on ${esc(short((row.j || {}).company || row.company || ""))}’s site ↗</a>` : "";
  const actsFor = r => `<div class="ptlacts" data-lrole="${esc(r.id)}"><div>${applyBtn(r.id)}${F.ni ? niBtn(r.id) : ""}</div></div>`;
  function railFor(r, cur) {
    const id = r.id, j = r.j || {}, d = (st.details || {})[id] || {}, f = facts(r), sent = clSent(id);
    const site = d.website && /^https?:\/\//i.test(d.websiteLink || "") ? `<a class="ptlap ws" href="${esc(d.websiteLink)}" target="_blank" rel="noopener" data-co="1" title="${esc("This role also asks you to apply on " + short(j.company || "") + "'s own site: opens it")}">🌐 Apply on company site ↗</a>` : "";
    const cl = f.cl && clApplied(id) ? `<span class="ptlcl done" title="You applied, so your cover letter went with it">📩 Cover letter sent ✓</span>` : f.cl ? `<button type="button" class="ptlcl${sent ? " done" : ""}" data-cl="${esc(id)}" title="${sent ? "You marked your cover letter sent · click to undo" : "Tick when your cover letter is sent" + (f.clTo ? " (address it to: " + esc(f.clTo) + ")" : "")}">${sent ? "✓ Cover letter sent · undo" : "📩 Mark cover letter sent"}</button>` : "";
    const main = r.closed ? `<a class="ptlap light" href="${esc(PT.portalJobUrl(id))}" title="Opens this job on the placement portal">Open on portal</a>` : applyBtn(id);
    const ni = r.closed ? "" : F.ni || (st.hiddenJobs || {})[id] ? `<button type="button" class="ptlnil" data-unhidejob="${esc(id)}" title="Show again: back in your list${connected() ? " and your calendar" : ""}">↩ Show again</button>` : `<button type="button" class="ptlnil" data-hidejob="${esc(id)}" title="Not interested: hides this role${connected() ? " and takes its deadline out of your calendar" : ""} (Undo for a few seconds). Nothing changes on the portal.">Not interested</button>`;
    const cal = r.closed ? "" : calChip("job|" + id, j.deadline), fo = formOf(id);
    const form = fo && fo.open ? `<a class="ptlap fm" href="${esc(PT.portalTaskUrl(id))}" data-form="${esc(id)}" title="${esc("Opens " + (fo.label || "the form") + " on the portal, on the job's Assessment tab. The tracker fills what it can from your saved answers; you check it and press Submit.")}">📝 Fill the form ↗</a>` : "";
    return `<aside class="ptlrail" data-lrole="${esc(id)}"${id === cur ? "" : " hidden"}>${main}${form}${r.closed ? "" : site}${r.closed ? "" : cl}${cal || ni ? `<div class="ptlrf">${cal}${ni}</div>` : ""}</aside>`;
  }
  function stagesOf(id) {
    const d = (st.details || {})[id] || {};
    return (d.stages || []).slice().sort((x, y) => (x.seq || 0) - (y.seq || 0)).map(x => ({
      name: x.name,
      elim: !!x.elim
    }));
  }
  function jdBlock(row, id, links) {
    const jd = String((row.s || {}).jd_summary || "").trim(), role = (row.j || {}).role || (row.a || {}).role || "";
    return `<div class="ptljd"><div class="ptljh"><span class="ptllab">JD summary${role ? " ·" : ""}</span>${role ? `<span class="ptlfull" data-k="role" title="${esc(role)}">${esc(role)}</span>` : ""}</div><div data-k="jd">${jd ? jd.split(/\n+/).slice(0, 4).map(x => `<p>${esc(x)}</p>`).join("") : `<p class="ptlq">No summary for this job yet. The full JD is on the portal.</p>`}</div>\n      ${links === null ? "" : `<div class="ptllk"><a href="${esc(PT.portalJobUrl(id))}" title="The whole JD, as the firm posted it">Full JD on the portal ↗</a>${links || ""}</div>`}</div>`;
  }
  function factsBlock(row, id) {
    const d = (st.details || {})[id] || {}, j = row.j || {}, exp = d.expMin != null || d.expMax != null ? [ d.expMin, d.expMax ].filter(v => v != null && v !== "").join("–") + " yrs" + (d.minFlex || d.maxFlex ? " (flexible)" : "") : "";
    const fx = [ [ "Shortlist by", j.shortlistBy ? fmtDay(j.shortlistBy) : "", "When the firm expects to announce its shortlist", "sl" ], [ "Interviews", d.interview, "How the firm interviews", "iv" ], [ "Experience", exp, "The experience the firm asks for", "ex" ], [ "Where", d.locations, "Where the job is", "wh" ], [ "Work", d.workType, "Office, hybrid or remote", "wt" ] ].filter(x => x[1]);
    const stg = stagesOf(id);
    return `<div class="ptlfx">${fx.map(([k, v, t, dk]) => `<span title="${esc(t)}"><b>${esc(k)}</b><span data-k="${dk}">${esc(v)}</span></span>`).join("") || `<span class="ptlq">The tracker is reading this job's details…</span>`}</div>${stg.length ? `<div data-k="hp">${hlineHtml(stg)}</div>` : ""}`;
  }
  function jobPane(row) {
    const id = row.id, j = row.j || {}, f = facts(row);
    const cl = f.cl && !clApplied(id) ? `<button type="button" class="ptllink" data-cl="${esc(id)}" title="Tick when your cover letter is sent${f.clTo ? " (address it to: " + esc(f.clTo) + ")" : ""}">${(st.clDone || {})[id] ? "✓ Cover letter sent · undo" : "📩 Mark cover letter sent"}</button>` : "";
    void cl;
    const narrow = `<div class="ptlnarrow"><span><b>Pay</b>${payTxt(row) || "—"}</span><span><b>Heads-up</b>${headsUp([ row ])}</span></div>`;
    return `<div class="ptldr"><div>${narrow}${factsBlock(row, id)}</div>${jdBlock(row, id, null)}</div>`;
  }
  const keyOf = rows => rows.length > 1 ? "g:" + short(rows[0].j.company) + "|" + rows[0].j.deadline + "|" + (rows[0].pool || "") : "j:" + rows[0].id;
  const backOf = r => (st && st.backJobs || {})[r.id];
  function jobRowHtml(rows, o) {
    o = o || {};
    const r0 = rows[0], j0 = r0.j || {}, key = keyOf(rows);
    if (listOpen && listOpen !== key && /^[gj]:/.test(listOpen) && rows.some(r => listIds.has(String(r.id)))) listOpen = key;
    const open = listOpen === key;
    if (open) listIds = new Set(rows.map(r => String(r.id)));
    const dl = r0.closed ? null : parseIST(j0.deadline), tr = dl ? when(dl).tier : "x", grp = rows.length > 1;
    const cur = grp ? rows.find(r => r.id === listTab[key]) || rows[0] : r0;
    const chev = `<td class="k0" title="${open ? "Close the details" : "Click the row for its details"}">${open ? "▾" : "▸"}</td>`;
    const closedCell = row => {
      const d = parseIST((row.j || {}).deadline);
      return `<span class="ptlq" title="${d ? esc("Applications closed " + fmt(d) + " IST") : ""}">Closed${d ? " " + esc(fmtDay((row.j || {}).deadline)) : ""}</span>`;
    };
    const hu = row => row.closed && row.applied ? `<span class="tag ptx elig yes" title="Your application">✓ You applied · ${esc(row.applied.status || "Applied")}</span>` : headsUp(grp ? rows : [ row ]);
    const back = rows.map(r => [ r, backOf(r) ]).filter(x => x[1]);
    const backH = back.length ? `<span class="chgtag" title="You had marked this Not interested; it changed, so it's back in Open. This note goes once you open the job.">↻ ${grp ? esc(back[0][0].j.role) + ": " : ""}${esc(back[0][1].text)}</span>` : "";
    const link = o.link ? `<button type="button" class="sharel" data-ljump="${esc(o.link.to)}" title="One counter covers ${esc(short(j0.company))}'s roles in this cluster (${o.link.total} in all). Click to jump to the other row.">🔗 ${esc(o.link.text)}</button>` : "";
    const sub = grp ? `<small><span class="ptlcnt2" title="${esc(rows.map(r => r.j.role).join(" · "))}">${rows.length} roles</span> · ${link ? link : sharesCounter(r0) ? `1 counter for ${rows.length === 2 ? "both" : "all"}` : "close together"}</small>` : `<small title="${esc(j0.role || "")}">${esc(j0.role || "")}${link ? " · " + link : ""}</small>`;
    const act = open ? `<button type="button" class="ptlclose" data-lopen="${esc(key)}" title="Close the details">▴ Close</button>` : r0.closed ? `<a class="ptlap light" href="${esc(PT.portalJobUrl(r0.id))}" title="Opens this job on the placement portal">Open on portal</a>` : !grp ? actsFor(r0) : `<button type="button" class="ptlroles" data-lopen="${esc(key)}" title="Open the row to pick one of the ${rows.length} roles">${rows.length} roles ▸</button>`;
    const tr0 = `<tr class="ptlr${grp ? " grp" : ""}${open ? " on" : ""}${back.length ? " chgd" : ""}" data-lk="${esc(key)}" data-firm="${esc(short(j0.company))}">${chev}<td class="k1"><span class="ptlfn"><b title="${esc(j0.company || "")}">${esc(short(j0.company))}</b>${lmarks(rows)}</span>${sub}${backH}</td>\n      <td class="k2">${poolCell(rows)}</td><td class="k3">${grp ? String(payRange(rows)).replace(/₹ /g, "₹ ").replace(/(\d)–(\d)/g, "$1–⁠$2").replace(/ (L|Cr)\b/g, " $1") : payTxt(r0)}</td><td class="k4">${hu(r0)}</td><td class="k5">${r0.closed ? closedCell(r0) : dlBox(dl)}</td><td class="k6">${qCell(j0.company, tr)}</td><td class="k7">${act}</td></tr>`;
    if (!open) return tr0;
    let body;
    if (!grp) body = jobPane(r0); else {
      const tile = r => {
        const c = facts(r).ctc, d = (st.details || {})[r.id] || {}, meta = [ c && !c.checking ? payLabel(c) : "", d.website ? "🌐 site too" : "" ].filter(Boolean).join(" · ");
        return `<button type="button" class="ptltile${r.id === cur.id ? " on" : ""}" data-ltab="${esc(r.id)}" role="tab" aria-selected="${r.id === cur.id}" title="${esc(r.j.role + (meta ? " · " + meta : ""))}"><span class="rpn">${esc(r.j.role)}</span>${meta ? `<span class="rpm">${esc(meta)}</span>` : ""}</button>`;
      };
      body = `<div class="ptltiles" role="tablist" data-n="${rows.length}" data-more="${listMore[key] || 0}">${rows.map(tile).join("")}<button type="button" class="ptltile more" data-lmore="${esc(key)}" hidden></button></div>` + rows.map(r => `<div class="ptlpane" data-lrole="${esc(r.id)}"${r.id === cur.id ? "" : " hidden"}>${jobPane(r)}</div>`).join("");
    }
    const rails = (grp ? rows : [ r0 ]).map(r => railFor(r, cur.id)).join("");
    return tr0 + `<tr class="ptlx" data-lfor="${esc(key)}"><td colspan="8"><div class="ptlwrap"><div class="ptlmain">${body}</div>${rails}</div></td></tr>`;
  }
  function groupRows(rows) {
    const m = new Map;
    rows.forEach(r => {
      const k = r.closed || !sharesCounter(r) ? "j:" + r.id : short(r.j.company).toLowerCase() + "|" + r.j.deadline + "|" + (r.pool || "");
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(r);
    });
    return [ ...m.values() ];
  }
  function shareLinks(groupsInOrder) {
    const byFirm = new Map;
    groupsInOrder.forEach((g, i) => {
      if (!sharesCounter(g[0])) return;
      const k = short(g[0].j.company).toLowerCase() + "|" + (g[0].pool || "");
      if (!byFirm.has(k)) byFirm.set(k, []);
      byFirm.get(k).push(i);
    });
    const out = new Map;
    for (const idx of byFirm.values()) {
      if (idx.length < 2) continue;
      const total = idx.reduce((n, i) => n + groupsInOrder[i].length, 0);
      idx.forEach((i, p) => {
        const other = idx[p === 0 ? 1 : 0], down = other > i, more = total - groupsInOrder[i].length;
        out.set(i, {
          to: keyOf(groupsInOrder[other]),
          total: total,
          text: p === 0 ? `1 counter with ${more} more ${down ? "↓" : "↑"}` : `same counter ${down ? "↓" : "↑"}`
        });
      });
    }
    return out;
  }
  function ltable(cls, label, n, rows, head, extra, foldKey, note, cols) {
    const folded = !!bandFold[foldKey];
    return `<section class="ptlb ${cls}${folded ? " fold" : ""}" data-band="${foldKey}"><button type="button" class="ptlbh" data-lfold="${foldKey}" aria-expanded="${!folded}" title="${folded ? "Show" : "Fold"} this list"><i></i><span class="ptlar">${folded ? "▸" : "▾"}</span>${label}<span class="n">· ${n}</span>${extra || ""}</button>${note || ""}${folded ? "" : `<table class="ptlt${cols ? " apps" : ""}">${cols || LCOLS}${head}${rows}</table>`}</section>`;
  }
  const lempty = (cls, txt, tip) => `<div class="ptlb ${cls} empty" title="${esc(tip || "")}"><span class="ptle">${txt}</span></div>`;
  const hiddenBy = () => [ F.eligible ? "✓ Eligible" : "", F.pool !== "all" ? F.pool === "intl" ? "International" : "Cluster: " + F.pool : "", F.slOut && F.closed ? "🎯 Shortlist out" : "" ].filter(Boolean).join(" and ");
  function appParts(r) {
    const {a: a} = r, now = Date.now(), sc = STC(a.statusCode), isSl = [ 2, 8 ].includes(a.statusCode);
    const nx = sc === "out" ? null : (r.steps || []).filter(it => !it.done && !it.missed && parseIST(it.due) > now).sort((x, y) => parseIST(x.due) - parseIST(y.due))[0];
    const web = nx && nx.mine && /^https?:\/\//i.test(nx.link || "");
    const step = nx ? `<b title="${esc(web ? "Apply on the firm's own site, then tick it off with ✓ Done" : "A task the firm asks for on the portal")}">${web ? "🌐 " : ""}${esc(nx.label)}</b>` : sc === "out" ? `<span class="ptlq">${esc(a.status || "Ended")}</span>` : a.statusCode === 7 ? `<span title="The portal will tell you if a place opens">Waitlisted 🤞</span>` : isSl ? `<span title="Shortlisted; the firm hasn't set the next step yet">Waiting for the next round</span>` : `<span title="Waiting for the firm's shortlist">Waiting for the shortlist</span>`;
    const back = a.shortlistBy ? PT.releaseDate(a.shortlistBy) : "", backTxt = back ? `<span class="cb" title="If no shortlist arrives, your counter comes back on this day (shortlist date + 2 days)">Counter back ${esc(fmtDay(back))}</span>` : "";
    const sl = a.shortlistBy && !isSl && sc !== "out" ? `<div class="ptdl ${slPassed(a.shortlistBy) ? "x" : "g"} nob" title="${esc(awaitTxt(a.shortlistBy))}"><b>${slPassed(a.shortlistBy) ? "Result awaited" : "Shortlist by " + esc(fmtDay(a.shortlistBy))}</b>${backTxt}</div>` : "";
    const due = nx ? dlBox(parseIST(nx.due), "Due") : sl || `<span class="ptlq" title="No date from the portal yet">${sc === "out" ? "—" : "no date yet"}</span>`;
    const tier = nx ? when(parseIST(nx.due)).tier : sc === "out" ? "x" : "g";
    const act = web ? `<a class="ptlap ws" href="${esc(nx.link)}" target="_blank" rel="noopener" title="Opens the firm's own site to apply there">Site ↗</a><button type="button" class="ptldone" data-webdone="${esc(a.id)}" title="You applied on the firm's own site: tick it off (the portal can't see it)">✓ Done</button>` : nx ? `<a class="ptlap" href="${esc(PT.portalTaskUrl(a.id))}" title="Opens this job's tasks on the portal">Open task ↗</a>` : `<a class="ptlap light" href="${esc(PT.portalJobUrl(a.id))}" title="Opens this job on the placement portal">Full JD</a>`;
    const resume = `<button type="button" class="ptlres" data-resume="${esc(a.id)}" title="Opens the resume you sent with this application, straight from the portal. Nothing is saved.">📄 Resume</button>`;
    const stc = `<span class="ptlst st-${sc}" title="${esc("On the portal: " + (a.status || ""))}">${esc(a.status || "")}</span>`;
    return {
      a: a,
      sc: sc,
      step: step,
      due: due,
      tier: tier,
      act: act,
      resume: resume,
      stc: stc
    };
  }
  function appStrip(r, cols, withResume) {
    const {a: a} = r, now = Date.now(), sc = STC(a.statusCode), {stops: stops} = stopsFor(r), d = (st.details || {})[a.id] || {};
    const wd = sc !== "out" && [ 1, 6 ].includes(a.statusCode) && parseIST(a.deadline) > now ? `<a class="ptwd" data-wd="${esc(a.id)}" href="${esc(PT.portalWithdrawUrl(a.id))}" title="Shows the portal's own Manage Applications page for this one visit and points at this application's Withdraw button. Nothing is withdrawn until you press it there and confirm.">Withdraw on portal ↗</a>` : "";
    const links = `${d.website && d.websiteLink ? `<a href="${esc(d.websiteLink)}" target="_blank" rel="noopener" title="The firm's own site">Company site ↗</a>` : ""}${withResume ? "" : wd}${withResume ? `<button type="button" class="ptlres" data-resume="${esc(a.id)}" title="Opens the resume you sent with this application, straight from the portal. Nothing is saved.">📄 Resume</button>` : ""}`;
    return `<tr class="ptlx st-${sc}" data-lfor="a:${esc(a.id)}"><td colspan="${cols}"><div class="ptldr"><div><div class="ptlfx">${[ [ "Applied", a.appliedAt ? fmt(new Date(a.appliedAt)) : "" ], [ "Cluster", r.pool ], [ "Shortlist by", a.shortlistBy ? fmtDay(a.shortlistBy) : "" ] ].filter(x => x[1]).map(([k, v]) => `<span><b>${k}</b>${esc(v)}</span>`).join("")}</div>${metroHtml(stops)}</div>${jdBlock(r, a.id, links)}</div></td></tr>`;
  }
  function appRowJobs(r) {
    const p = appParts(r), a = p.a, key = "a:" + a.id, open = listOpen === key, now = Date.now(), sc = STC(a.statusCode);
    const tag = a.statusCode !== 1 ? ` <span class="ptlst sm st-${sc}" title="${esc("On the portal: " + (a.status || ""))}">${esc(a.status || "")}</span>` : "";
    const wd = sc !== "out" && [ 1, 6 ].includes(a.statusCode) && parseIST(a.deadline) > now ? `<a class="ptwd ptlwd" data-wd="${esc(a.id)}" href="${esc(PT.portalWithdrawUrl(a.id))}" title="Shows the portal's own Manage Applications page for this one visit and points at this application's Withdraw button. Nothing is withdrawn until you press it there and confirm.">Withdraw ↗</a>` : "";
    const main = /data-webdone|Open task/.test(p.act) ? p.act : `<a class="ptlap light" href="${esc(PT.portalJobUrl(a.id))}" title="Opens this job on the placement portal">Full JD</a>`;
    const back = a.shortlistBy ? PT.releaseDate(a.shortlistBy) : "";
    const slT = a.shortlistBy && sc !== "out" ? `<small class="ptlsl" title="${esc((slPassed(a.shortlistBy) ? "Result awaited (shortlist expected " + fmtDay(a.shortlistBy) + ")" : "The firm expects to announce its shortlist on " + fmtDay(a.shortlistBy)) + (back ? "; if none arrives, your counter comes back on " + fmtDay(back) : ""))}">${esc(slPassed(a.shortlistBy) ? "Result awaited" : "Shortlist " + fmtDay(a.shortlistBy))}${back ? " · back " + esc(fmtDay(back)) : ""}</small>` : "";
    const dl = parseIST(a.deadline);
    const tr0 = `<tr class="ptlr${open ? " on" : ""}" data-lk="${esc(key)}" data-firm="${esc(short(a.company))}"><td class="k0" title="${open ? "Close the details" : "Click the row for its steps and details"}">${open ? "▾" : "▸"}</td><td class="k1"><span class="ptlfn"><b title="${esc(a.company || "")}">${esc(short(a.company))}</b>${tag}</span><small title="${esc(a.role || "")}">${esc(a.role || "")}</small></td>\n      <td class="k2"><span title="The cluster your application drew its counter from">${esc(shortPool(r.pool) || "—")}<small>counter used</small></span></td><td class="k3">${payTxt(r)}</td><td class="k4"></td><td class="k5">${dl && dl > now ? dlBox(dl) : p.due}</td><td class="k6">${qCell(a.company, dl && dl > now ? when(dl).tier : p.tier)}</td><td class="k7"><div class="ptlacts ap2"><div>${main}${wd}</div>${slT}</div></td></tr>`;
    return open ? tr0 + appStrip(r, 8, true) : tr0;
  }
  function renderJobsList(el, snap) {
    PAGE = "jobs";
    const open = jobRows(snap), hid = st.hiddenJobs || {}, shut = closedRows(snap), now = Date.now();
    const sameCo = (x, y) => PT.shortFirm(x) === PT.shortFirm(y);
    open.forEach(r => {
      r.ctr = PT.counterLine(r.j, snap, {
        firmJobs: open.filter(x => sameCo(x.j.company, r.j.company)).length
      });
    });
    shut.forEach(r => {
      r.ctr = r.applied ? PT.counterLine(r.j, snap, {
        closed: true
      }) : null;
    });
    const applied = (snap.apps || []).filter(a => LIVE(a.statusCode)), apLive = applied.filter(a => !a.deadline || (parseIST(a.deadline) || 0) > now);
    const niN = open.filter(r => hid[r.id]).length, view = F.closed ? "closed" : F.ni ? "ni" : "open";
    const istD = d => new Date(+d + 5.5 * H).toISOString().slice(0, 10), todayN = open.filter(r => !hid[r.id] && r.due && istD(r.due) === istD(now)).length;
    const sum = `<div class="pt-sum" role="group" aria-label="Summary">${sumBtn("open", open.length - niN + apLive.length, "Open", todayN ? `${todayN} close${todayN > 1 ? "" : "s"} today` : "", view === "open" && !Q)}${sumBtn("applied", apLive.length, "Applied", apLive.length ? "still open" : "", view === "open" && apShown() && apLive.length > 0)}${sumBtn("ni", niN, "Not interested", "", view === "ni" && !Q)}${sumBtn("closed", shut.length, "Closed", "", view === "closed" && !Q)}</div>`;
    const loose = r => passes(r, Object.assign({}, F, {
      eligible: false,
      pool: "all"
    }));
    const apRows = appRows(snap).filter(r => apLive.some(a => a.id === r.id) && (!Q || qMatch(r)) && (F.pool === "all" || passes(r, Object.assign({}, F, {
      eligible: false
    })))).sort((x, y) => (parseIST(x.a.deadline) || Infinity) - (parseIST(y.a.deadline) || Infinity));
    const sec = [];
    const bandsFor = list => {
      const parts = BANDS.map(([k, label, none]) => {
        const base = list.filter(r => (r.due ? when(r.due).tier : "g") === k && loose(r)), shown = base.filter(r => passes(r));
        return {
          k: k,
          label: label,
          none: none,
          base: base,
          shown: shown,
          groups: sortGroups(groupRows(shown.sort((x, y) => (x.due || Infinity) - (y.due || Infinity) || short(x.j.company).localeCompare(short(y.j.company)))))
        };
      });
      const all = parts.flatMap(p => p.groups), links = shareLinks(all);
      let gi = 0;
      for (const p of parts) {
        const hN = p.base.length - p.shown.length;
        if (!p.shown.length) {
          const niR = p.k === "r" && !p.base.length && !Q ? open.filter(r => hid[r.id] && r.due && r.due > now && when(r.due).tier === "r").sort((x, y) => x.due - y.due) : [];
          const niTxt = niR.length ? ` · ${niR.length} you marked Not interested close${niR.length === 1 ? "s" : ""} ${esc(when(niR[0].due).day)} ${esc(when(niR[0].due).t)} · <button type="button" class="ptlshow" data-f="ni" title="Open the Not interested list">Show</button>` : "";
          sec.push(lempty(p.k + (p.k === "r" && !p.base.length && !Q ? " ok" : ""), p.base.length ? `0 of ${p.base.length} match · hidden by ${esc(hiddenBy())}` : Q ? `Nothing here matches “${esc(Q)}”` : "✓ " + (niR.length ? "Nothing else closes within 24 hours" : p.none) + niTxt, p.base.length ? "Turn the filter off to see them" : ""));
          continue;
        }
        const rowsH = p.groups.map(g => jobRowHtml(g, {
          link: links.get(gi++)
        })).join("");
        sec.push(ltable(p.k, p.label, `${p.shown.length} role${p.shown.length === 1 ? "" : "s"}`, rowsH, jobHead(), hN ? `<span class="ptlhid" title="Turn the filter off to see them">+${hN} hidden by ${esc(hiddenBy())}</span>` : "", "b" + p.k));
      }
    };
    if (view === "open" || Q) {
      if (apRows.length || !Q) sec.push(apRows.length ? ltable("ap", "✓ Applied", `${apRows.length} still open`, sortGroups(apRows.map(r => [ r ])).map(g => appRowJobs(g[0])).join(""), jobHead().replace(/>Heads-up</, "><"), "", "ap").replace('<table class="ptlt"', '<table class="ptlt nok4"') : "");
      bandsFor(open.filter(r => !hid[r.id]));
    }
    if (view === "ni" || Q) {
      const ni = open.filter(r => hid[r.id] && passes(r)).sort((x, y) => (x.due || Infinity) - (y.due || Infinity));
      if (ni.length || !Q) {
        const keep = F.ni;
        F.ni = true;
        sec.push(ni.length ? ltable("ni", "Not interested", `${ni.length}`, sortGroups(ni.map(r => [ r ])).map(g => jobRowHtml(g)).join(""), jobHead(), "", "ni", Q ? "" : `<div class="pt-ninote">${connected() ? "Out of your calendar · " : ""}↩ puts one back</div>`) : lempty("ni", "Nothing marked Not interested."));
        F.ni = keep;
      }
    }
    if (view === "closed" || Q) {
      const cl = shut.filter(r => passes(r)), cut = shut.filter(r => !Q || qMatch(r)).length - cl.length, by = hiddenBy();
      if (cl.length || !Q) sec.push(cl.length ? ltable("x", "Closed", `${cl.length}`, sortGroups(cl.map(r => [ r ])).map(g => jobRowHtml(g)).join(""), jobHead(), cut > 0 && by ? `<span class="ptlhid" title="Turn a filter off to see them">${cl.length} of ${cl.length + cut} · ${esc(by)}</span>` : "", "cl") : lempty("x", cut > 0 && by ? `0 of ${cut} match · hidden by ${esc(by)}` : "No closed jobs.", cut > 0 ? "Turn a filter off to see them" : ""));
    }
    const line = Q ? `<div class="pt-gsline">${(n => n ? `${n} match${n === 1 ? "" : "es"} for <b>“${esc(Q)}”</b>` : `Nothing matches <b>“${esc(Q)}”</b> in any list`)(apRows.length + open.filter(r => passes(r)).length + shut.filter(r => passes(r)).length)}</div>` : "";
    el.innerHTML = filterBar("jobs", open.concat(shut), sum) + line + `<div class="ptlist" id="pt-list">${sec.join("")}</div>`;
    sameTab(el);
    fitCols(el);
    fitTiles(el);
  }
  const tilesShown = (n, presses) => {
    if (n <= 6) return n;
    let v = 5;
    for (let i = 0; i < presses && v < n; i++) {
      const rem = n - v;
      v += rem <= 5 ? rem : 4;
    }
    return v;
  };
  function fitTiles(root) {
    (root || document).querySelectorAll("#pt-cool .ptltiles[data-n]").forEach(g => {
      const n = +g.dataset.n, presses = +g.dataset.more || 0, shown = tilesShown(n, presses);
      const tiles = [ ...g.querySelectorAll(".ptltile[data-ltab]") ], more = g.querySelector("[data-lmore]");
      const onIdx = tiles.findIndex(t => t.classList.contains("on"));
      tiles.forEach((t, i) => {
        t.hidden = i >= shown && i !== onIdx;
      });
      if (n <= 6) {
        more.hidden = true;
        return;
      }
      const rem = n - shown, next = rem <= 5 ? rem : 4;
      more.hidden = false;
      more.textContent = rem > 0 ? `Show ${next} more ▾` : "Show fewer ▴";
      more.title = rem > 0 ? `${rem} more role${rem === 1 ? "" : "s"}; shows ${next} of them` : "Show the first 5 roles only";
    });
  }
  addEventListener("resize", () => fitTiles());
  function fitOf(w) {
    return w >= 1120 ? "w" : w >= 860 ? "m" : w >= 760 ? "n" : "s";
  }
  function edgeRoom(l) {
    const e = document.querySelector("#pt-edge");
    if (!l || !e || e.hidden || !e.offsetWidth) {
      if (l) l.style.marginRight = "";
      return;
    }
    l.style.marginRight = "";
    const over = l.getBoundingClientRect().right - e.getBoundingClientRect().left + 6;
    l.style.marginRight = over > 0 ? Math.ceil(over) + "px" : "";
  }
  addEventListener("resize", () => edgeRoom(document.querySelector("#pt-cool #pt-list")));
  function fitCols(root) {
    const l = (root || document).querySelector("#pt-list") || document.querySelector("#pt-cool #pt-list");
    if (!l) return;
    edgeRoom(l);
    setTimeout(() => edgeRoom(l), 400);
    l.dataset.fit = fitOf(l.clientWidth || 930);
    if (!l.__ptro && window.ResizeObserver) {
      l.__ptro = new ResizeObserver(() => {
        const f = fitOf(l.clientWidth);
        if (f !== l.dataset.fit) {
          l.dataset.fit = f;
          fitTiles(l);
        }
      });
      l.__ptro.observe(l);
    }
  }
  function renderDash(el, snap) {
    const rel = PT.pendingRelease(snap.apps, snap.dash), sc = PT.statusCounts(snap.apps, snap.dash), sched = PT.releaseSchedule(snap.apps, snap.dash);
    const plural = (n, w) => n + " " + w + (n === 1 ? "" : "s");
    const chips = c => !c ? "" : `<div class="ptst">${[ [ "al", c.applied, "applied" ], [ "ip", c.inProcess, "in process" ], [ "sl", c.shortlisted, "shortlisted" ], [ "wl", c.waitlisted, "waitlisted" ], [ "ns", c.notShortlisted, "not shortlisted" ], [ "cr", c.counterBack, "counter back" ], [ "wd", c.withdrawn, "withdrawn" ] ].filter(x => x[1]).map(x => `<span class="${x[0]}">${x[1]} ${x[2]}</span>`).join("")}</div>`;
    const nextFor = k => {
      const g = sched.filter(x => x.key === k), od = g.filter(x => x.date === "overdue").reduce((n, x) => n + x.firms.length, 0), nx = g.find(x => x.date !== "overdue");
      return (od ? `<div class="ptnext od">⏳ ${od} past ${od === 1 ? "its" : "their"} shortlist date · back once the portal releases ${od === 1 ? "it" : "them"}</div>` : "") + (nx ? `<div class="ptnext">🔄 Next back: <b>${esc(fmtDay(nx.date))} · +${nx.firms.length}</b> if no shortlist</div>` : od ? "" : `<div class="ptnext none">Nothing held</div>`);
    };
    const row = (label, c) => c.total === null ? "" : `<div class="ptrow"><span>${label}</span><b>${c.used ?? c.total - c.left} of ${c.total} used</b></div>`;
    const rank = p => /international/i.test(p) ? [ 2, 0 ] : (m => m ? [ 0, +m[1] ] : [ 1, 0 ])(/Cluster[\s-]*(\d+)/i.exec(p));
    const cards = snap.dash.slice().sort((a, b) => {
      const x = rank(a.pool), y = rank(b.pool);
      return x[0] - y[0] || x[1] - y[1];
    }).map(r => {
      const used = r.app.used ?? r.app.total - r.app.left, pct = r.app.total ? Math.round(100 * used / r.app.total) : 0, f = rel[r.key], intl = /international/i.test(r.pool);
      return `<article class="jc ptctr"><div class="r1"><div class="nm"><h3>${esc(intl ? "International ✈" : r.pool)}</h3></div>\n          <div class="rt"><span class="big">${r.app.left ?? "–"}</span><span class="sub">left</span></div></div><div class="ptbar"><i style="width:${pct}%"></i></div>\n        ${row("Applications", r.app)}${row("Initial shortlists", r.isl)}${row("Final shortlists", r.fsl)}\n        ${chips(sc[r.key])}${nextFor(r.key)}</article>`;
    }).join("");
    const chg = (st.changes || []).slice(0, 8).map(c => `<div class="ptchg">${esc(c.text)}${c.job && (st.hiddenJobs || {})[c.job] ? '<span class="tag">not interested</span>' : ""}<span class="sub"> · ${ago(c.at)}</span></div>`).join("");
    const poolName = k => {
      const r = snap.dash.find(x => x.key === k) || {};
      return /international/i.test(r.pool || "") ? "International" : String(r.pool || k).replace(/\s*\(P\d+\)$/, "");
    };
    const ckey = k => {
      const m = /Cluster[\s-]*(\d+)/i.exec(poolName(k));
      return m ? "c" + m[1] : "ci";
    };
    const listV = sched.length ? sched.map(g => `<div class="d${g.date === "overdue" ? " od" : ""}">${g.date === "overdue" ? "Overdue" : esc(fmtDay(g.date))}</div><div class="e"><span class="pck ${ckey(g.key)}">${esc(poolName(g.key))}</span><b class="plus">+${g.firms.length}</b><span class="firm">${esc(g.firms.map(short).join(", "))}${g.date === "overdue" ? " · result still awaited" : ""}</span></div>`).join("") : "";
    const monthV = (() => {
      if (!sched.length) return "";
      const t = new Date(Date.now() + 5.5 * 36e5), start = new Date(t);
      start.setUTCDate(t.getUTCDate() - (t.getUTCDay() + 6) % 7);
      const td = t.toISOString().slice(0, 10), cells = [];
      for (let i = 0; i < 35; i++) {
        const d = new Date(start);
        d.setUTCDate(start.getUTCDate() + i);
        const k = d.toISOString().slice(0, 10), gs = sched.filter(x => x.date === k);
        cells.push(`<div class="${k === td ? "t" : k < td ? "x" : ""}"><span>${d.getUTCDate()}</span>${gs.map(x => `<b>+${x.firms.length} ${esc(poolName(x.key).replace("Cluster-", "C"))}</b>`).join("")}</div>`);
      }
      return `<div class="ptmon">${[ "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun" ].map(x => `<i>${x}</i>`).join("")}${cells.join("")}</div>`;
    })();
    const back = sched.length ? `<div class="tbcjc" style="margin-top:14px"><article class="jc ptback" id="pt-back"><div class="r1"><h3>🔄 Counters coming back</h3><span class="ptseg2"><button data-bv="list" class="${dashView === "month" ? "" : "on"}">List</button><button data-bv="month" class="${dashView === "month" ? "on" : ""}">Month</button></span></div>\n        <div class="sub">If no shortlist arrives by the expected date + 2 days (Placement Policy 10.7). A shortlist at a firm keeps its counter used, so it drops off by itself.</div>\n        ${dashView === "month" ? monthV : `<div class="pttl">${listV}</div>`}</article></div>` : "";
    el.innerHTML = `<div class="tbcjc ptgrid">${cards}</div>${back}\n      ${chg ? `<div class="tbcjc" style="margin-top:12px"><article class="jc"><span class="lbl">Recent changes</span>${chg}</article></div>` : ""}`;
  }
  function renderPending(el, snap) {
    const byId = Object.fromEntries((snap.apps || []).map(a => [ a.id, a ])), items = PT.calItems(snap, st.details || {}, st.webDone);
    const rows = items.map(it => ({
      it: it,
      a: byId[it.appId] || {},
      state: PT.calState(it, null, byId[it.appId]),
      due: parseIST(it.due)
    })).filter(r => r.state !== "none" || r.it.done).sort((x, y) => (x.state === "new" ? 0 : 1) - (y.state === "new" ? 0 : 1) || (x.due || Infinity) - (y.due || Infinity));
    const line = r => {
      const {it: it, a: a, state: state, due: due} = r;
      const chip = it.done ? `<span class="ptcal off">✓ Submitted</span>` : state === "past" ? `<span class="ptcal off">passed</span>` : calChip(it.key, it.due);
      return `<article class="jc mini task${it.done || state === "past" ? " dim" : " " + tier(due)}"><div class="r1"><div class="nm"><h3>${esc(short(it.company))}</h3><span class="role1">${esc(it.role)} · <b>${esc(it.label)}</b></span></div>\n        <div class="rt">${chip}</div></div><div class="sub">${it.done ? "submitted" : due ? `due ${esc(fmt(due))} · ${left(due)}` : "no deadline yet"}${it.link ? ` · <a href="${esc(it.link)}" target="_blank" rel="noopener">company site ↗</a>` : ""} · <a href="${esc(it.done ? PT.portalJobUrl(it.appId) : PT.portalTaskUrl(it.appId))}" target="_blank" rel="noopener">${it.done ? "open on portal" : "open the form"} ↗</a></div></article>`;
    };
    el.innerHTML = `<h2 class="pt-h2">Pending Tasks <small>every next step across your applications and the forms on job pages, soonest first</small></h2><div class="tbcjc">${rows.map(line).join("") || `<div class="empty">No pending tasks on the portal right now.</div>`}</div>`;
  }
  const poolLines = p => {
    p = String(p || "");
    if (/international/i.test(p)) return [ "International", "✈" ];
    const m = /^(.*?)\s*(\(P\d+\)|·\s*.+)$/.exec(p);
    return m ? [ m[1], m[2].replace(/^·\s*/, "") ] : [ p, "" ];
  };
  function renderHome(el, snap) {
    const hid = st.hiddenJobs || {}, open = PT.openJobs(snap).filter(j => !hid[j.id]);
    const closing = open.filter(j => (parseIST(j.deadline) || Infinity) - Date.now() < 24 * H);
    const byId = Object.fromEntries((snap.apps || []).map(a => [ a.id, a ]));
    const steps = PT.calItems(snap, st.details || {}, st.webDone).filter(it => PT.calState(it, null, byId[it.appId]) === "new").map(it => ({
      it: it,
      due: parseIST(it.due)
    })).filter(r => r.due && r.due - Date.now() < 7 * 24 * H).sort((x, y) => x.due - y.due);
    const sheetBy = {};
    ((st.sheet || {}).jobs || []).forEach(r => {
      sheetBy[String(r.application_id || "").trim().toLowerCase()] = r;
    });
    const cls = open.filter(j => ((st.details || {})[j.id] || {}).cl === true && !clApplied(j.id)).map(j => ({
      j: j,
      done: !!(st.clDone || {})[j.id]
    })).sort((x, y) => x.done - y.done || (parseIST(x.j.deadline) || Infinity) - (parseIST(y.j.deadline) || Infinity));
    const rank = p => /international/i.test(p) ? [ 2, 0 ] : (m => m ? [ 0, +m[1] ] : [ 1, 0 ])(/Cluster[\s-]*(\d+)/i.exec(p));
    const ctrs = (snap.dash || []).slice().sort((a, b) => {
      const x = rank(a.pool), y = rank(b.pool);
      return x[0] - y[0] || x[1] - y[1];
    }).filter(r => r.app.total !== null);
    const sched = PT.releaseSchedule(snap.apps, snap.dash);
    const li = (a, b, c) => `<li><b>${esc(a)}</b><span class="mid">· ${esc(b)}</span><span class="rt">${esc(c)}</span></li>`;
    el.innerHTML = `      <div class="pt-grid">\n        <div class="pt-card red"><h3>🔥 Closing in the next 24 h</h3><ul>${closing.slice(0, 6).map(j => li(short(j.company), j.role, (w => w.day.replace(/^./, c => c.toUpperCase()) + " " + w.t)(when(parseIST(j.deadline))))).join("") || "<li class='none'>Nothing due today ☕</li>"}</ul><a href="#/student/student-jobs">Open jobs ▸</a></div>\n        <div class="pt-card blue"><h3>🎟 Counters left</h3><div class="ctrs">${ctrs.map(r => {
      const [l1, l2] = poolLines(r.pool), g = sched.filter(x => x.key === r.key), od = g.filter(x => x.date === "overdue").reduce((n, x) => n + x.firms.length, 0), nx = g.find(x => x.date !== "overdue");
      const nb = nx ? `next back ${fmtDay(nx.date)} (+${nx.firms.length})` : "", odt = od ? `${od} overdue` : "";
      return `<div${r.app.left !== null && r.app.left <= 1 ? ' class="last"' : ""}><b>${r.app.left ?? "–"}</b><i><span>${esc(l1)}</span><span>${esc(l2)}</span></i>${nb || odt ? `<em>${esc([ nb, odt ].filter(Boolean).join(" · "))}</em>` : ""}</div>`;
    }).join("") || "<div><i>No counters read yet</i></div>"}</div>${sched.length ? `<a href="#/student/applications-dashboard">🔄 When counters come back ▸</a>` : `<a href="#/student/applications-dashboard">Dashboard ▸</a>`}</div>\n        <div class="pt-card amber"><h3>⏰ Next steps due this week</h3><ul>${steps.slice(0, 6).map(r => li(short(r.it.company), r.it.label, left(r.due))).join("") || "<li class='none'>Nothing due this week.</li>"}</ul><a href="#/student/pending-tasks">Pending tasks ▸</a></div>\n        <div class="pt-card violet"><h3>✉ Cover letters to write</h3><ul>${cls.slice(0, 6).map(x => `<li${x.done ? ' class="done"' : ""}><b>${esc(short(x.j.company))}</b><span class="mid">· ${esc(x.j.role)}${x.done ? " · sent ✓" : ""}</span><span class="rt${x.done ? " ok" : ""}">${x.done ? "done" : left(parseIST(x.j.deadline))}</span></li>`).join("") || "<li class='none'>No open job asks for one.</li>"}</ul><small>Only jobs that ask for one, soonest first. Each drops off once you apply.</small><a href="#/student/student-jobs">Open jobs ▸</a></div>\n        <div class="pt-card teal"><h3>🔔 Recent changes</h3><ul>${(st.changes || []).slice(0, 6).map(c => `<li><span class="mid">${esc(c.text)}</span><span class="rt">${esc(ago(c.at))}</span></li>`).join("") || "<li class='none'>No changes yet.</li>"}</ul></div>\n      </div>`;
  }
  function holdStill(anchor, fn) {
    const t0 = anchor && document.contains(anchor) ? anchor.getBoundingClientRect().top : null;
    fn();
    if (t0 === null || !document.contains(anchor)) return;
    const d = anchor.getBoundingClientRect().top - t0;
    if (Math.abs(d) >= 1) window.scrollBy(0, d);
  }
  function viewAnchor() {
    const root = document.getElementById("pt-cool");
    if (!root) return null;
    const bar = root.querySelector(".pt-filters"), floor = bar ? bar.getBoundingClientRect().bottom : 0;
    const c = [ ...root.querySelectorAll("article.jc[data-firm], article.jc[data-app]") ].find(x => x.getBoundingClientRect().bottom > floor + 4);
    return c ? {
      sel: c.dataset.app ? `article.jc[data-app="${CSS.escape(c.dataset.app)}"]` : `article.jc[data-firm="${CSS.escape(c.dataset.firm)}"]`,
      top: c.getBoundingClientRect().top
    } : null;
  }
  const ME = {
    name: "Aditya Bansal",
    li: "https://www.linkedin.com/in/withaditya/",
    ig: "https://www.instagram.com/memes_worth_40lakhs/",
    tbc: "https://thebettercampus.netlify.app/?utm_source=placement_tracker&utm_medium=extension&utm_campaign=tracker_link&utm_content=footer",
    privacy: "https://thebettercampus.netlify.app/tracker-privacy/"
  };
  const FI = {
    li: '<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9h4v12H3zM9 9h3.8v1.7h.05c.53-1 1.84-2.05 3.78-2.05 4.04 0 4.79 2.66 4.79 6.12V21h-4v-5.6c0-1.34-.03-3.06-1.86-3.06-1.87 0-2.15 1.46-2.15 2.96V21H9z"/></svg>',
    ig: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>'
  };
  function footerHtml() {
    return `<footer id="pt-foot">\n      <div class="l1"><span>Placement Tracker extension, made by <a class="me tip" href="${ME.li}" target="_blank" rel="noopener" data-tip="One of Eleven">${ME.name}</a></span>\n        <a class="b li" href="${ME.li}" target="_blank" rel="noopener" title="LinkedIn">${FI.li}</a><a class="b ig" href="${ME.ig}" target="_blank" rel="noopener" title="Instagram @memes_worth_40lakhs">${FI.ig}</a>\n        <span class="sep">·</span><a class="tbc" href="${ME.tbc}" target="_blank" rel="noopener">Part of <b>The Better Campus</b> ↗</a></div>\n      <div class="l2">Independent student project, not linked to ISB · your data stays in your browser${PT.FEATURES.sheet ? ", Google Calendar and Sheet" : " and Google Calendar"} · uninstall to undo it all · <a href="${ME.privacy}" target="_blank" rel="noopener">Privacy</a> · <a href="#" class="pttour" data-tour="1" title="A one-minute tour of what the tracker adds here">❓ Tour</a></div>\n      <div class="l3"><span class="mo tip" tabindex="0" data-tip="Hyderabad, we still love you 💛">Made in Mohali</span></div></footer>`;
  }
  function render() {
    const keep = mounted === route && window.scrollY > 0 ? viewAnchor() : null;
    const open = mounted === route ? [ ...document.querySelectorAll("#pt-cool .pt-jobcard:not([hidden]), #pt-cool .pt-jd:not([hidden])") ].map(b => [ b.classList.contains("pt-jd") ? "jd" : "jobcard", b.dataset.for || "" ]) : [];
    const openJd = mounted === route ? [ ...document.querySelectorAll("#pt-cool .tbcjc .jdpanel:not(.qpanel):not([hidden])") ].map(p => (p.closest(".rbody") || {}).dataset ? p.closest(".rbody").dataset.role || "" : "").filter(Boolean) : [];
    renderNow();
    openJd.forEach(id => {
      const body = document.querySelector(`#pt-cool .tbcjc .rbody[data-role="${CSS.escape(id)}"]`);
      if (!body) return;
      const pnl = body.querySelector(".jdpanel:not(.qpanel)"), jc = body.closest(".jc");
      if (!pnl || !pnl.hidden) return;
      const b = jc && pnl.id ? jc.querySelector(`.jdbtn[aria-controls="${CSS.escape(pnl.id)}"]`) : null;
      pnl.hidden = false;
      if (b) b.setAttribute("aria-expanded", "true");
      if (jc) jc.dataset.jd = "1";
    });
    open.forEach(([k, id]) => {
      const box = document.querySelector(`#pt-cool .pt-${k}[data-for="${CSS.escape(id)}"]`), b = document.querySelector(`#pt-cool button[data-${k}="${CSS.escape(id)}"]`);
      if (box && box.hidden && b) b.click();
    });
    if (keep) {
      const c = document.querySelector("#pt-cool " + keep.sel);
      if (c) {
        const d = c.getBoundingClientRect().top - keep.top;
        if (Math.abs(d) >= 1) window.scrollBy(0, d);
      }
    }
  }
  function renderNow() {
    const el = ensureMounted(), snap = st.snapshot;
    lastSnap = snap || {
      jobs: [],
      apps: []
    };
    CFG = Object.assign({}, PT.CONFIG_DEFAULTS, st.config || {});
    const body = document.createElement("div");
    body.className = "pt-body";
    el.innerHTML = gcalStrip() + banners();
    el.appendChild(body);
    if (!snap) {
      body.innerHTML = `<div class="empty">Reading your placement portal for the first time… a few seconds.</div>`;
      return;
    }
    ({
      home: renderHome,
      jobs: renderJobs,
      apps: renderApps,
      dash: renderDash,
      pending: renderPending
    })[route](body, snap);
    el.insertAdjacentHTML("beforeend", footerHtml());
    sameTab(el);
    const hdr = document.querySelector(".alain-default__header, .ant-layout-header, header");
    const top = hdr && getComputedStyle(hdr).position === "fixed" ? hdr.getBoundingClientRect().bottom : 0;
    el.style.setProperty("--pt-top", Math.max(0, top) + "px");
    mounted = route;
    dirty = false;
    headDirty = false;
    const gi = el.querySelector("#pt-gs");
    if (gi && gsFocus) {
      gi.focus();
      const n = gi.value.length;
      try {
        gi.setSelectionRange(n, n);
      } catch (e) {}
    }
    placePill();
  }
  let lastPage = "";
  function notePage(r, want) {
    const page = r || (/application-details/.test(location.hash) ? "apply" : "other"), ui = want && r ? "cool" : "portal", k = page + ui;
    if (k === lastPage) return;
    lastPage = k;
    chrome.runtime.sendMessage({
      type: "PT_PAGE",
      page: page,
      ui: ui
    }).catch(() => {});
  }
  async function tick() {
    if (PT.dead) return;
    if (!st) return;
    const r = routeNow(), plus = scrapePlus();
    if (plus.active !== !!(st.plus && st.plus.active) || Object.keys(plus.hidden).length) recordPlus();
    pill(plus.active);
    if (window.__ptPeek && r !== "apps") window.__ptPeek = false;
    document.documentElement.removeAttribute("data-pt-peek");
    const want = coolOn() && !plus.active && r && !(window.__ptPeek && r === "apps");
    notePage(r, want);
    if (!want) {
      if (document.getElementById("pt-cool") || document.documentElement.hasAttribute("data-pt-cool")) unmount();
      mounted = null;
      route = null;
      return;
    }
    if (r !== route) {
      route = r;
      dirty = true;
      glowing.clear();
      Object.assign(F, {
        ni: false,
        closed: false,
        apps: "ip"
      });
      apOpen = false;
      slOpen = false;
      listOpen = "";
      listIds = new Set;
      bandFold = {
        ap: true
      };
      partOpen = {
        todo: true,
        rest: true
      };
      stepsOpen = new Set;
    }
    if (!document.getElementById("pt-cool") || document.getElementById("pt-cool").parentElement !== host()) dirty = true;
    if (dirty || mounted !== route) render(); else if (headDirty) headDirty = false;
  }
  async function load() {
    st = await chrome.storage.local.get(null);
    dirty = true;
    tick();
  }
  const QUIET = new Set([ "lastCheck", "lastFresh", "unseen", "alarmSeed", "qaAt", "qaKnown", "installId", "usageDay", "usageNoteSeen", "firstRunDone", "usageOpens", "qaTriedAt", "usagePageAt", "usagePortalDay", "installWeek", "usageHealthAt", "nudge", "nudgeUsed", "bgRefused", "netRetryAt" ]);
  const DATA = new Set([ "details", "facts", "snapshot", "progress", "calProg", "sheet", "sheetError", "qa", "calSync", "checkRun", "lastRun", "changes", "lastError", "paused", "loginExp", "gsheet", "copies", "config", "plus", "gcal", "slHist" ]);
  const panelOpen = () => !!document.querySelector("#pt-cool .jdpanel:not(.qpanel):not([hidden]), #pt-cool .pt-jd:not([hidden]), #pt-cool .pt-jobcard:not([hidden]), #pt-cool .ptlx");
  let soft = 0;
  chrome.storage.onChanged.addListener((ch, area) => {
    if (area !== "local") return;
    const keys = Object.keys(ch);
    keys.forEach(k => {
      st[k] = ch[k].newValue;
    });
    if (keys.every(k => QUIET.has(k) || k === "progress" && route !== "apps")) headDirty = true; else if (keys.every(k => QUIET.has(k) || DATA.has(k)) && mounted === route && panelOpen()) {
      if (!soft) soft = Date.now();
    } else dirty = true;
  });
  setInterval(() => {
    if (soft && (!panelOpen() || Date.now() - soft > 5 * 6e4)) {
      soft = 0;
      dirty = true;
    }
  }, 700);
  window.addEventListener("hashchange", () => tick());
  setInterval(tick, 600);
  setInterval(() => {
    const ja = st && st.justApplied || {};
    if (Object.values(ja).some(x => x && Date.now() - x.at >= 15 * 6e4 && Date.now() - x.at < 15 * 6e4 + 31e3)) dirty = true;
  }, 3e4);
  setInterval(() => {
    const c = document.getElementById("pt-cool");
    if (c) c.querySelectorAll("#pt-cards, #pt-apcards").forEach(x => TBCJobCard.tick(x));
    refreshStrips();
  }, 6e4);
  function fly(fromEl, toEl, reverse) {
    if (!fromEl || !toEl) return;
    const r = fromEl.getBoundingClientRect(), c = toEl.getBoundingClientRect(), g = fromEl.cloneNode(true);
    const A = reverse ? c : r, B = reverse ? r : c;
    g.style.cssText = `position:fixed;left:${A.left}px;top:${A.top}px;width:${A.width}px;height:${A.height}px;margin:0;z-index:2147483000;transition:all .7s cubic-bezier(.4,0,.2,1);opacity:${reverse ? .2 : .95};transform:scale(${reverse ? .3 : 1});transform-origin:top left;pointer-events:none`;
    const host = document.createElement("div");
    host.className = "tbcjc ptfly";
    host.appendChild(g);
    g.style.overflow = "hidden";
    (document.getElementById("pt-cool") || document.body).appendChild(host);
    requestAnimationFrame(() => {
      g.style.left = B.left + "px";
      g.style.top = B.top + "px";
      g.style.width = B.width + "px";
      g.style.height = B.height + "px";
      g.style.opacity = reverse ? ".95" : ".15";
      g.style.transform = `scale(${reverse ? 1 : .3})`;
    });
    setTimeout(() => {
      host.remove();
      if (!reverse) {
        toEl.classList.add("pulse");
        setTimeout(() => toEl.classList.remove("pulse"), 900);
      }
    }, 720);
  }
  document.addEventListener("click", e => {
    const b = e.target instanceof Element && e.target.closest("#pt-cool button[data-nojd]");
    if (!b) return;
    const card = b.closest(".jc"), p = card && card.querySelector(`[data-nojdp="${CSS.escape(b.dataset.nojd)}"]`);
    if (!p) return;
    p.hidden = !p.hidden;
    b.setAttribute("aria-expanded", String(!p.hidden));
  });
  const niChip = () => document.querySelector('#pt-cool .pt-sum .ptn[data-f="ni"]');
  const backTag = id => {
    const b = (st && st.backJobs || {})[id];
    return b ? `<span class="tag ptx back" data-back="${esc(id)}" title="You had marked this Not interested; it changed, so it's back in Open. This note goes once you open the job.">↻ ${esc(b.text)}</span>` : "";
  };
  const clearBack = ids => {
    const b = Object.assign({}, st && st.backJobs || {});
    let n = 0;
    for (const id of ids) if (b[id]) {
      delete b[id];
      n++;
    }
    if (n) {
      st.backJobs = b;
      chrome.storage.local.set({
        backJobs: b
      });
    }
  };
  function undoToast(id) {
    let t = document.getElementById("pt-undo");
    if (t) t.remove();
    t = document.createElement("div");
    t.id = "pt-undo";
    t.setAttribute("role", "status");
    t.innerHTML = `<span>Marked Not interested${connected() ? " · out of your calendar" : ""}</span><button type="button">Undo</button>`;
    t.querySelector("button").addEventListener("click", async () => {
      const h = Object.assign({}, st.hiddenJobs);
      delete h[id];
      t.remove();
      count("pt_job", {
        action: "undo_ni",
        where: "card"
      });
      await chrome.storage.local.set({
        hiddenJobs: h
      });
    });
    document.body.appendChild(t);
    setTimeout(() => {
      if (t.isConnected) t.remove();
    }, 6e3);
  }
  document.addEventListener("click", async e => {
    const root = e.target.closest("#pt-cool");
    if (!root) return;
    const t = e.target.closest("button[data-jd],[data-resume],[data-f],[data-clear],[data-ribbon],[data-hidejob],[data-unhidejob],[data-star],[data-cl],[data-webdone],[data-jobcard],[data-ended],[data-gcal],[data-now],[data-up]");
    if (!t || t.closest(".tbcjc a[target=_blank]") || t.matches("a[href]") && !t.dataset.gcal && !t.dataset.now && !t.dataset.clear && t.getAttribute("href") !== "#") return;
    const segOff = (id, kind) => {
      const b = root.querySelector(`button[data-${kind}="${CSS.escape(id)}"]`), bx = root.querySelector(`.pt-${kind === "jd" ? "jd" : "jobcard"}[data-for="${CSS.escape(id)}"]`);
      if (bx) bx.hidden = true;
      if (b) {
        b.classList.remove("on");
        b.setAttribute("aria-pressed", "false");
      }
    };
    const segOn = b => {
      b.classList.add("on");
      b.setAttribute("aria-pressed", "true");
    };
    if (t.dataset.jd) {
      e.preventDefault();
      const id = t.dataset.jd, box = root.querySelector(`.pt-jd[data-for="${CSS.escape(id)}"]`);
      if (!box) return;
      if (!box.hidden) {
        segOff(id, "jd");
        return;
      }
      segOff(id, "jobcard");
      const srow = ((st.sheet || {}).jobs || []).find(r => String(r.application_id || "").toLowerCase() === String(id).toLowerCase()) || {};
      const jd = String(srow.jd_summary || "").trim();
      box.innerHTML = `<p class="lbl2">The JD${jd ? " · summary" : ""}</p>${jd ? jd.split(/\n+/).map(x => `<p>${esc(x)}</p>`).join("") : `<p class="sub">No summary for this job yet.</p>`}<p class="sub">Full JD: <a href="${esc(PT.portalJobUrl(id))}">on the placement portal</a></p>`;
      box.hidden = false;
      segOn(t);
      return;
    }
    if (t.dataset.resume) {
      e.preventDefault();
      e.stopPropagation();
      const w = window.open("", "_blank");
      try {
        w.document.title = "Your resume";
        w.document.body.style.font = "15px -apple-system,Segoe UI,Roboto,sans-serif";
        w.document.body.textContent = "Opening your resume from the placement portal…";
      } catch (x) {}
      const was = t.textContent;
      t.textContent = "Opening…";
      t.disabled = true;
      try {
        await window.PTPortal.openResume(t.dataset.resume, w);
        t.textContent = was;
      } catch (err) {
        try {
          w && w.close();
        } catch (x) {}
        t.textContent = "Couldn't open · try Open on portal";
        setTimeout(() => {
          t.textContent = was;
        }, 4e3);
      } finally {
        t.disabled = false;
      }
      return;
    }
    if (t.dataset.f) {
      onFilterClick(t);
      render();
      return;
    }
    if (t.dataset.up) {
      e.preventDefault();
      apOpen = true;
      scrollAp = true;
      render();
      return;
    }
    if (t.dataset.clear) {
      e.preventDefault();
      if (t.dataset.clear === "all") {
        Object.assign(F, CLEAR, {
          ni: false,
          closed: false
        });
      } else if (t.dataset.clear === "ni" || t.dataset.clear === "closed") F[t.dataset.clear] = false; else F[t.dataset.clear] = CLEAR[t.dataset.clear];
      render();
      return;
    }
    if (t.dataset.ribbon) {
      F.collapsed = !F.collapsed;
      render();
      return;
    }
    e.preventDefault();
    if (t.dataset.hidejob) {
      const id = t.dataset.hidejob;
      fly(t.closest("article"), niChip(), false);
      await chrome.storage.local.set({
        hiddenJobs: Object.assign({}, st.hiddenJobs, {
          [id]: {
            at: Date.now()
          }
        })
      });
      undoToast(id);
      return;
    }
    if (t.dataset.unhidejob) {
      const id = t.dataset.unhidejob;
      const hiddenJobs = Object.assign({}, st.hiddenJobs);
      delete hiddenJobs[id];
      fly(t.closest("article"), niChip(), true);
      await chrome.storage.local.set({
        hiddenJobs: hiddenJobs
      });
      return;
    }
    if (t.dataset.star) {
      const id = t.dataset.star, stars = Object.assign({}, st.stars);
      if (stars[id]) delete stars[id]; else stars[id] = Date.now();
      await chrome.storage.local.set({
        stars: stars
      });
      return;
    }
    if (t.dataset.webdone) {
      e.preventDefault();
      e.stopPropagation();
      const id = t.dataset.webdone, webDone = Object.assign({}, st.webDone);
      if (webDone[id]) delete webDone[id]; else {
        webDone[id] = Date.now();
        clapFor = id;
        clapAt = Date.now();
      }
      await chrome.storage.local.set({
        webDone: webDone
      });
      return;
    }
    if (t.dataset.cl) {
      const id = t.dataset.cl, clDone = Object.assign({}, st.clDone);
      if (clDone[id]) delete clDone[id]; else clDone[id] = Date.now();
      await chrome.storage.local.set({
        clDone: clDone
      });
      return;
    }
    if (t.dataset.jobcard) {
      const id = t.dataset.jobcard, box = root.querySelector(`.pt-jobcard[data-for="${CSS.escape(id)}"]`);
      if (!box) return;
      if (!box.hidden) {
        segOff(id, "jobcard");
        return;
      }
      segOff(id, "jd");
      const job = ((st.snapshot || {}).jobs || []).concat((st.snapshot || {}).closedJobs || []).find(j => j.id === id) || (a => a ? {
        id: id,
        company: a.company,
        role: a.role,
        cluster: a.cluster,
        jobType: a.jobType,
        deadline: a.deadline,
        shortlistBy: a.shortlistBy,
        counterType: a.counterType
      } : {
        id: id,
        company: "",
        role: ""
      })(((st.snapshot || {}).apps || []).find(x => x.id === id)), rows = enrich(PT.cardRows([ job ], (st.sheet || {}).jobs));
      box.innerHTML = `<p class="lbl2">The job card, as it was when you applied</p><div class="tbcjc"></div>`;
      if (rows[0] && rows[0].__sheet) {
        TBCJobCard.render(box.querySelector(".tbcjc"), TBCJobCard.groupFirms(rows, {
          view: "all"
        }), {});
        decorate(box, {
          [String(id).toLowerCase()]: {
            id: id,
            j: job,
            s: rows[0]
          }
        });
      } else box.querySelector(".tbcjc").innerHTML = `<div class="empty">Job details are not available for this job.</div>`;
      box.hidden = false;
      segOn(t);
      return;
    }
    if (t.dataset.ended !== undefined && t.matches("article")) {
      const d = t.querySelector(".pt-ended"), h = t.querySelector(".ended-hint");
      if (d) {
        d.hidden = !d.hidden;
        if (h) h.textContent = d.hidden ? "▸ where it ended" : "▾ where it ended";
      }
      return;
    }
    if (t.dataset.now) {
      t.textContent = "Checking…";
      await chrome.runtime.sendMessage({
        type: "PT_CHECK_NOW"
      }).catch(() => {});
      t.textContent = "Check now";
      return;
    }
    if (t.dataset.gcal === "help") await chrome.storage.local.set({
      gcalHelp: !st.gcalHelp
    }); else if (t.dataset.gcal === "disconnect") {
      confirmOff = true;
      render();
    } else if (t.dataset.gcal === "keep") {
      confirmOff = false;
      render();
    } else if (t.dataset.gcal === "off") {
      confirmOff = false;
      chrome.runtime.sendMessage({
        type: "PT_GCAL_DISCONNECT"
      }).catch(() => {});
    } else if (t.dataset.gcal === "connect") chrome.runtime.sendMessage({
      type: "PT_GCAL_CONNECT"
    }).catch(() => {}); else if (t.dataset.gcal === "remake") {
      t.textContent = "Making a new one…";
      t.disabled = true;
      chrome.runtime.sendMessage({
        type: "PT_GCAL_REMAKE"
      }).catch(() => {});
    }
  }, true);
  document.addEventListener("change", e => {
    const t = e.target.closest("#pt-cool [data-fs], #pt-cool [data-fi]");
    if (!t) return;
    if (t.dataset.fs === "ctc") F.ctc = +t.value || 0; else if (t.dataset.fs === "exp") F.exp = t.value === "" ? "" : +t.value; else if (t.dataset.fs) F[t.dataset.fs] = t.value;
    render();
  }, true);
  const KEEP_JD = "button, a, input, select, textarea, label, summary, [role=button], [role=switch], .jdpanel, .pt-jd, .pt-jobcard, .ptsolo .rp";
  function closeJDs() {
    const root = document.getElementById("pt-cool");
    if (!root) return;
    root.querySelectorAll(".tbcjc .jdpanel:not(.qpanel):not([hidden])").forEach(p => {
      const b = p.id && root.querySelector(`.jdbtn[aria-controls="${CSS.escape(p.id)}"]`);
      if (b) b.click(); else p.hidden = true;
    });
    root.querySelectorAll(".pt-jd:not([hidden])").forEach(box => {
      box.hidden = true;
      const b = root.querySelector(`button[data-jd="${CSS.escape(box.dataset.for || "")}"]`);
      if (b) {
        b.classList.remove("on");
        b.setAttribute("aria-pressed", "false");
      }
    });
    root.querySelectorAll(".pt-jobcard:not([hidden])").forEach(box => {
      box.hidden = true;
      const b = root.querySelector(`button[data-jobcard="${CSS.escape(box.dataset.for || "")}"]`);
      if (b) {
        b.classList.remove("on");
        b.setAttribute("aria-pressed", "false");
      }
    });
  }
  document.addEventListener("click", e => {
    const el = e.target;
    if (!(el instanceof Element) || el.closest(KEEP_JD)) return;
    if (!document.querySelector("#pt-cool .jdpanel:not(.qpanel):not([hidden]), #pt-cool .pt-jd:not([hidden]), #pt-cool .pt-jobcard:not([hidden])")) return;
    holdStill(el, closeJDs);
  }, true);
  let gsCounted = false;
  document.addEventListener("input", e => {
    if (e.target.id !== "pt-gs") return;
    gsFocus = true;
    clearTimeout(gsT);
    gsT = setTimeout(() => {
      Q = e.target.value.trim().slice(0, 60);
      if (Q && !gsCounted) {
        gsCounted = true;
        count("pt_job", {
          action: "search"
        });
      }
      dirty = true;
      render();
    }, 180);
  }, true);
  document.addEventListener("focusin", e => {
    if (e.target.id === "pt-gs") gsFocus = true;
  }, true);
  document.addEventListener("focusout", e => {
    if (e.target.id === "pt-gs") setTimeout(() => {
      const a = document.activeElement;
      if (!a || a.id !== "pt-gs") gsFocus = false;
    }, 0);
  }, true);
  document.addEventListener("click", e => {
    if (!e.target.closest("#pt-cool [data-gsx]")) return;
    e.preventDefault();
    Q = "";
    gsCounted = false;
    gsFocus = true;
    dirty = true;
    render();
  }, true);
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && e.target.id === "pt-gs" && Q) {
      e.preventDefault();
      Q = "";
      gsCounted = false;
      dirty = true;
      render();
      return;
    }
    if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target, typing = t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName));
    if (typing) return;
    const gi = document.querySelector("#pt-cool #pt-gs");
    if (!gi) return;
    e.preventDefault();
    gsFocus = true;
    gi.focus();
  }, true);
  document.addEventListener("toggle", e => {
    if (e.target.id === "pt-aplist") {
      apOpen = e.target.open;
      const b = document.querySelector('#pt-cool [data-f="applied"]');
      if (b && !b.disabled) {
        b.classList.toggle("on", apOpen);
        b.setAttribute("aria-pressed", String(apOpen));
      }
    }
    if (e.target.matches && e.target.matches("#pt-cool details.ptpf")) partOpen[e.target.dataset.pf] = e.target.open;
    if (e.target.matches && e.target.matches("#pt-cool details.ptsteps")) {
      const id = e.target.dataset.steps;
      if (e.target.open) stepsOpen.add(id); else stepsOpen.delete(id);
    }
    if (e.target.id === "pt-slfold" && slOpen !== e.target.open) {
      slOpen = e.target.open;
      const b = document.querySelector('#pt-cool [data-f="apps-sl"]');
      if (b) {
        b.classList.toggle("on", slOpen);
        b.setAttribute("aria-pressed", String(slOpen));
      }
    }
  }, true);
  document.addEventListener("click", e => {
    const a = e.target.closest("a.ptwd[data-wd]");
    if (!a) return;
    e.preventDefault();
    e.stopPropagation();
    if (!/^#\/student\/my-applications\b/.test(location.hash)) location.hash = "#/student/my-applications";
    window.__ptPeek = true;
    try {
      tick();
    } catch (x) {}
    scrollTo(0, 0);
    if (window.__ptWithdraw) window.__ptWithdraw(a.dataset.wd);
  }, true);
  const count = (name, params) => chrome.runtime.sendMessage({
    type: "PT_COUNT",
    name: name,
    params: params
  }).catch(() => {});
  const GROUP = {
    pool: "pool",
    hybrid: "where",
    city: "where",
    interviews: "where",
    role: "fit",
    sector: "fit",
    exp: "fit",
    cgpa: "fit",
    eligible: "fit",
    cl: "fit",
    ctc: "fit",
    starred: "mine",
    slOut: "fit"
  };
  document.addEventListener("click", e => {
    const t = e.target instanceof Element ? e.target : null;
    if (!t || !t.closest("#pt-cool")) return;
    const onJobs = route === "jobs", ev = onJobs ? "pt_job" : "pt_app";
    const where = t.closest(".ptlrail") ? "list_rail" : t.closest("#pt-list") ? "list_row" : "card";
    const act = a => count(ev, {
      action: a,
      where: where
    }), job = a => count("pt_job", {
      action: a,
      where: where
    });
    if (t.closest("a[data-portal]")) return job("apply_portal");
    if (t.closest("a[data-form]")) return job("form_open");
    if (t.closest("a[data-co]")) return job("company_site");
    const jb = t.closest(".ptrtop .jdbtn, .ptrtop .ptnojd");
    if (jb) {
      if (jb.getAttribute("aria-expanded") !== "true") job("jd_open");
      return;
    }
    const st0 = t.closest("[data-star]");
    if (st0) return job(st0.classList.contains("on") ? "unstar" : "star");
    if (t.closest("[data-hidejob]")) return job("not_interested");
    if (t.closest("[data-unhidejob]")) return job("undo_ni");
    if (t.closest("[data-cl]")) return job("cover_letter_sent");
    if (t.closest("a.ptwd")) return act("withdraw_help");
    const rb = t.closest("[data-ribbon]");
    if (rb) {
      if (F.collapsed) job("filters_open");
      return;
    }
    const f = t.closest("[data-f]");
    if (f) {
      const k = f.dataset.f;
      if (k === "applied") return;
      if (k === "closed") return;
      if (k === "open" && onJobs && listOn()) return job("applied_fold");
      if (GROUP[k]) return count(onJobs ? "pt_job" : "pt_job", {
        action: "filter",
        feature: GROUP[k]
      });
      return;
    }
    const app = a => count("pt_app", {
      action: a,
      where: where
    });
    if (t.closest("a.ptnext")) return app("next_step");
    const sm = t.closest("details.ptsteps > summary");
    if (sm) {
      if (!sm.parentElement.open) app("steps_open");
      return;
    }
    const pf = t.closest("details.ptpf > summary");
    if (pf) return app(pf.parentElement.dataset.pf + "_fold");
    if (t.closest("details.slfold > summary")) return app("sl_fold");
    if (t.closest("[data-webdone]")) return app("mark_done");
    if (t.closest("[data-resume]")) return app("resume_open");
    const pj = t.closest("button[data-jd]");
    if (pj) return app(pj.classList.contains("on") ? "jd_open" : "panel_close");
    const jc = t.closest("button[data-jobcard]");
    if (jc) return app(jc.classList.contains("on") ? "jobcard_open" : "panel_close");
  }, true);
  document.addEventListener("change", e => {
    const t = e.target instanceof Element && e.target.closest("#pt-cool [data-fs]");
    if (t && GROUP[t.dataset.fs] && t.value) count("pt_job", {
      action: "filter",
      feature: GROUP[t.dataset.fs]
    });
  }, true);
  const jdOf = (card, id) => {
    const body = card.querySelector(`.rbody[data-role="${CSS.escape(id)}"]`);
    return body && body.querySelector(".jdpanel:not(.qpanel)");
  };
  function showJd(card, id, open) {
    card.querySelectorAll(".rbody .jdpanel:not(.qpanel)").forEach(p => {
      p.hidden = true;
    });
    const pnl = open ? jdOf(card, id) : null;
    if (pnl) pnl.hidden = false;
    card.dataset.jd = pnl ? "1" : "";
    card.querySelectorAll(".ptrtop .jdbtn, .ptrtop .ptnojd").forEach(b => b.setAttribute("aria-expanded", String(!!pnl && b.closest(".ptrtop").dataset.role === id)));
  }
  function closeOtherJds(card) {
    document.querySelectorAll("#pt-cool .tbcjc .jc").forEach(c => {
      if (c !== card && c.querySelector(".rbody .jdpanel:not(.qpanel):not([hidden])")) showJd(c, "", false);
    });
  }
  let roleWas = null;
  const roleOf = rp => rp.dataset.rp || ((rp.closest(".jc").querySelector(".rbody") || {}).dataset || {}).role || "";
  const ROLE_SEL = "#pt-cool .jc .rp[data-rp], #pt-cool .jc .ptsolo .rp";
  document.addEventListener("click", e => {
    const rp = e.target instanceof Element && e.target.closest(ROLE_SEL);
    if (!rp) {
      roleWas = null;
      return;
    }
    const card = rp.closest(".jc"), sel = card.querySelector(".rp[aria-selected=true]"), id = sel ? sel.dataset.rp : roleOf(rp), p = id && jdOf(card, id);
    roleWas = {
      card: card,
      id: id,
      open: !!(p && !p.hidden)
    };
  }, true);
  document.addEventListener("click", e => {
    const rp = e.target instanceof Element && e.target.closest(ROLE_SEL);
    if (!rp || !roleWas) return;
    const {card: card, id: prev, open: open} = roleWas, id = roleOf(rp);
    roleWas = null;
    const willOpen = !(prev === id && open);
    showJd(card, id, willOpen);
    if (willOpen) {
      closeOtherJds(card);
      chrome.runtime.sendMessage({
        type: "PT_DETAIL_NOW",
        id: id
      }).catch(() => {});
      count("pt_job", {
        action: "role_jd_open"
      });
    }
  });
  const LBLUE = "Blue tag job: the posting fixes the designation, location, job description and total CTC (fixed and variable). Salary can't be negotiated. Placement Policy §5.3.";
  const lmarks = rows => {
    const js = rows.map(r => r.j || {}), blue = js.some(j => j.blueTag), ir = rows.find(r => /international/i.test((r.j || {}).jobType || "")), intl = ir && ir.j;
    return (blue ? `<span class="ptlmk" title="${esc(LBLUE)}" aria-label="${esc(LBLUE)}"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 1v14" stroke="#1d4ed8" stroke-width="2" stroke-linecap="round"/><path d="M4.5 2h8.5l-2.4 3.4L13 9H4.5z" fill="#2563eb"/></svg></span>` : "") + (intl ? (t => `<span class="ptlmk" title="${esc(t)}" aria-label="${esc(t)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#2563eb" d="M21.5 4.2c.6-.6.6-1.5 0-2-.5-.5-1.4-.5-2 .1l-4.1 4.1L5.6 3.6 3.9 5.3l7.8 4.8-3.9 3.9-2.9-.4-1.5 1.5 3.6 1.9 1.9 3.6 1.5-1.5-.4-2.9 3.9-3.9 4.8 7.8 1.7-1.7-2.8-9.8z"/></svg></span>`)((d => PT.intlTip(d.locations || intl.locations || intl.location, d.country))((st.details || {})[ir.id] || {})) : "");
  };
  document.addEventListener("click", e => {
    const b = e.target.closest && e.target.closest("#pt-cool [data-bv]");
    if (!b) return;
    e.preventDefault();
    dashView = b.dataset.bv;
    count("pt_app", {
      action: "back_" + dashView,
      where: "card"
    });
    dirty = true;
    tick();
  }, true);
  document.addEventListener("click", e => {
    const el = e.target instanceof Element && e.target.closest("#pt-cool .jc .rp, #pt-cool .jc .jdbtn, #pt-cool .jc .ptnojd, #pt-cool .jc a[data-portal], #pt-cool .jc a.ptapply, #pt-cool .jc [data-back]");
    if (!el) return;
    const card = el.closest(".jc"), t = el.closest("[data-back]"), rp = el.closest(".rp[data-rp]");
    const ids = t ? [ t.dataset.back ] : rp ? [ rp.dataset.rp ] : [ ...card.querySelectorAll(".ptbset:not([hidden]) [data-back]") ].map(x => x.dataset.back);
    if (ids.length) setTimeout(() => clearBack(ids), 1200);
  }, true);
  document.addEventListener("click", e => {
    const b = e.target instanceof Element && e.target.closest("#pt-cool .jc .jdbtn, #pt-cool .jc .ptnojd");
    if (!b) return;
    const card = b.closest(".jc");
    setTimeout(() => {
      if (card.querySelector(".rbody .jdpanel:not(.qpanel):not([hidden])")) closeOtherJds(card);
    }, 0);
  });
  document.addEventListener("click", e => {
    const el = e.target instanceof Element && e.target.closest("#pt-cool .jdbtn, #pt-cool button[data-jd]");
    if (!el) return;
    const id = el.dataset.jd || ((el.closest(".rbody") || {}).dataset || {}).role;
    if (id) chrome.runtime.sendMessage({
      type: "PT_DETAIL_NOW",
      id: id
    }).catch(() => {});
  }, true);
  document.addEventListener("click", e => {
    const el = e.target instanceof Element ? e.target : null;
    if (!el || !el.closest("#pt-cool")) return;
    const vb = el.closest("[data-view]");
    if (vb) {
      e.preventDefault();
      const on = vb.dataset.view === "list";
      listOpen = "";
      if (on !== listOn()) {
        count("pt_job", {
          action: on ? "view_list" : "view_cards",
          where: on ? "card" : "list_row"
        });
        st.listView = on;
        dirty = true;
        render();
        chrome.storage.local.set({
          listView: on
        });
      }
      return;
    }
    if (!el.closest("#pt-list")) return;
    const sb = el.closest("th[data-lsort]");
    if (sb) {
      e.preventDefault();
      const k = sb.dataset.lsort, s0 = lsort(), next = s0.k === k ? {
        k: k,
        d: -s0.d
      } : {
        k: k,
        d: 1
      };
      st.listSort = next;
      listOpen = "";
      count("pt_job", {
        action: "sort",
        feature: k,
        where: "list_row"
      });
      chrome.storage.local.set({
        listSort: next
      });
      holdStill(sb, render);
      return;
    }
    const fb = el.closest("[data-lfold]");
    if (fb) {
      e.preventDefault();
      const k = fb.dataset.lfold;
      if (k === "sl") slOpen = !slOpen; else bandFold[k] = !bandFold[k];
      holdStill(fb, render);
      return;
    }
    const tb = el.closest("[data-ltab]");
    if (tb) {
      e.preventDefault();
      const x = tb.closest(".ptlx"), key = x.dataset.lfor, id = tb.dataset.ltab, row = x.previousElementSibling;
      const was = x.querySelector(".ptlpane:not([hidden])"), snap = p => {
        const m = {};
        if (p) p.querySelectorAll("[data-k]").forEach(n => {
          m[n.dataset.k] = n.textContent.trim();
        });
        return m;
      }, before = snap(was);
      listTab[key] = id;
      x.querySelectorAll("[data-ltab]").forEach(b => {
        const on = b.dataset.ltab === id;
        b.classList.toggle("on", on);
        b.setAttribute("aria-selected", String(on));
      });
      x.querySelectorAll(".ptlpane[data-lrole]").forEach(p => {
        p.hidden = p.dataset.lrole !== id;
      });
      x.querySelectorAll(".ptlrail[data-lrole]").forEach(p => {
        p.hidden = p.dataset.lrole !== id;
      });
      const now = x.querySelector(".ptlpane:not([hidden])"), glow = n => {
        n.classList.remove("chg");
        void n.offsetWidth;
        n.classList.add("chg");
        setTimeout(() => n.classList.remove("chg"), 1700);
      };
      if (was && now && was !== now) {
        now.querySelectorAll("[data-k]").forEach(n => {
          if (before[n.dataset.k] !== n.textContent.trim()) glow(n);
        });
        const ap = x.querySelector(`.ptlrail[data-lrole="${CSS.escape(id)}"] .ptlap`);
        if (ap) glow(ap);
      }
      count("pt_job", {
        action: "role_tile",
        where: "list_row"
      });
      clearBack([ id ]);
      chrome.runtime.sendMessage({
        type: "PT_DETAIL_NOW",
        id: id
      }).catch(() => {});
      return;
    }
    const mb = el.closest("[data-lmore]");
    if (mb) {
      e.preventDefault();
      const k = mb.dataset.lmore, g = mb.closest(".ptltiles"), n = +g.dataset.n;
      listMore[k] = tilesShown(n, listMore[k] || 0) >= n ? 0 : (listMore[k] || 0) + 1;
      g.dataset.more = String(listMore[k]);
      fitTiles(g.parentElement);
      count("pt_job", {
        action: "tiles_more",
        where: "list_row"
      });
      return;
    }
    const jb = el.closest("[data-ljump]");
    if (jb) {
      e.preventDefault();
      const r = document.querySelector(`#pt-cool #pt-list tr.ptlr[data-lk="${CSS.escape(jb.dataset.ljump)}"]`);
      if (r) {
        const bar = document.querySelector("#pt-cool .pt-filters");
        r.style.scrollMarginTop = (bar ? bar.offsetHeight : 0) + 90 + "px";
        r.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
        r.classList.remove("ptflash");
        void r.offsetWidth;
        r.classList.add("ptflash");
        setTimeout(() => r.classList.remove("ptflash"), 1800);
      }
      return;
    }
    const ob = el.closest("[data-lopen]");
    if (ob) {
      e.preventDefault();
      const row = ob.closest("tr.ptlr");
      openRow(row);
      return;
    }
    if (el.closest("a, button, input, select, label, .ptlx")) return;
    const row = el.closest("tr.ptlr");
    if (!row) return;
    openRow(row);
  }, true);
  function openRow(row) {
    const k = row.dataset.lk;
    listOpen = listOpen === k ? "" : k;
    listIds = new Set;
    count("pt_job", {
      action: listOpen ? "row_open" : "row_close",
      where: "list_row"
    });
    if (listOpen) {
      const id = /^[ja]:/.test(k) ? k.slice(2) : listTab[k] || "";
      if (id) chrome.runtime.sendMessage({
        type: "PT_DETAIL_NOW",
        id: id
      }).catch(() => {});
      const back = st && st.backJobs || {}, ids = /^j:/.test(k) ? [ k.slice(2) ] : [];
      if (ids.some(id => back[id])) {
        count("pt_job", {
          action: "back_note_seen",
          where: "list_row"
        });
        setTimeout(() => clearBack(ids), 1200);
      }
    }
    holdStill(row, () => {
      render();
      if (listOpen && /^g:/.test(listOpen)) {
        const x = document.querySelector(`#pt-cool tr.ptlx[data-lfor="${CSS.escape(listOpen)}"]`), on = x && x.querySelector(".ptltile.on");
        if (on) clearBack([ on.dataset.ltab ]);
      }
    });
  }
  load();
})();