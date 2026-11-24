(() => {
  if (window.__ptEdgeLoaded) return;
  window.__ptEdgeLoaded = true;
  const count = (name, params) => chrome.runtime.sendMessage({
    type: "PT_COUNT",
    name: name,
    params: params
  }).catch(() => {});
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;"
  }[c]));
  const parseIST = PT.parseIST, H = 36e5, DAYS = 14;
  const dayKey = d => d.toLocaleDateString("en-CA", {
    timeZone: "Asia/Kolkata"
  });
  const timeOf = d => d.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata"
  }).replace(":00", "");
  const dayHead = d => {
    const k = dayKey(d), today = dayKey(new Date), tmr = dayKey(new Date(Date.now() + 864e5));
    return (k === today ? "Today · " : k === tmr ? "Tomorrow · " : "") + d.toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: "Asia/Kolkata"
    });
  };
  const KINDS = [ [ "apply", "Apply by" ], [ "step", "Next step" ], [ "web", "Website" ], [ "shortlist", "Shortlist" ], [ "done", "Done" ], [ "ni", "Not interested" ] ];
  const WAIT = [ "wait", "Results awaited" ];
  let st = null, open = false, monthDay = "", monthYm = "", sheetCard = false, copied = false, calWant = null;
  function items() {
    const snap = st && st.snapshot;
    if (!snap) return [];
    const now = Date.now(), from = new Date(dayKey(new Date) + "T00:00:00+05:30").getTime(), to = from + DAYS * 864e5;
    const hid = PT.effectiveHidden(st), out = [];
    const applied = new Set((snap.apps || []).map(a => a.id));
    for (const e of PT.wantedEvents(snap, st.details || {}, {}, now, st.webDone)) {
      const d = parseIST(e.due);
      if (!d) continue;
      const t = d.getTime();
      if (t < from || t >= to) continue;
      let kind = e.kind;
      if (kind === "applied" || kind === "ended") continue;
      if (kind === "apply" && hid[e.appId]) kind = "ni"; else if (kind === "apply") kind = "apply"; else if (kind === "step" && e.mine) kind = "web"; else if (kind === "shortlisted") kind = "shortlist"; else if (kind === "submitted") kind = "done";
      if ((kind === "apply" || kind === "ni") && t <= now) continue;
      out.push({
        kind: kind,
        d: d,
        t: t,
        allDay: !!e.allDay,
        firm: PT.shortFirm(e.company),
        role: e.role || "",
        what: whatOf(kind, e),
        id: e.appId,
        applied: applied.has(e.appId),
        soon: (kind === "step" || kind === "web") && t > now && t - now < 24 * H
      });
    }
    return out.sort((a, b) => a.t - b.t || (a.allDay ? 1 : 0) - (b.allDay ? 1 : 0));
  }
  function whatOf(kind, e) {
    return kind === "apply" || kind === "ni" ? "Apply by" : kind === "shortlist" ? e.kind === "shortlisted" ? "Shortlisted" : "Shortlist expected" : kind === "done" ? "✓ " + e.label : e.label;
  }
  function awaited() {
    const snap = st && st.snapshot;
    if (!snap) return [];
    const today = dayKey(new Date), D = k => new Date(k + "T12:00:00+05:30").getTime();
    return (snap.apps || []).filter(a => [ 1, 6, 999 ].includes(a.statusCode) && /^\d{4}-\d{2}-\d{2}/.test(a.shortlistBy || "") && a.shortlistBy.slice(0, 10) < today).map(a => {
      const due = a.shortlistBy.slice(0, 10), ago = Math.round((D(today) - D(due)) / 864e5), rel = PT.releaseDate(due);
      const back = a.statusCode === 999 || a.counterReleased;
      return {
        id: a.id,
        firm: PT.shortFirm(a.company),
        role: a.role || "",
        due: due,
        ago: ago,
        back: back,
        rel: rel
      };
    }).sort((x, y) => x.due < y.due ? -1 : x.due > y.due ? 1 : 0);
  }
  const dShort = k => new Date(k + "T12:00:00+05:30").toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata"
  });
  function waitHtml(ws, isOpen) {
    if (!ws.length) return "";
    const line = w => `<button type="button" class="ul uw" data-open="${esc(w.id)}" data-applied="1" data-kind="wait"><i></i><span class="tx"><b>${esc(w.firm)}</b> · ${esc(w.role)}\n      <small>shortlist was due ${esc(dShort(w.due))} · ${w.ago} day${w.ago === 1 ? "" : "s"} ago</small><small class="uc${w.back ? " back" : ""}">${w.back ? "counter back" : "counter back on " + esc(dShort(w.rel))}</small></span></button>`;
    return `<details class="uwait"${isOpen ? " open" : ""}><summary data-wait-fold="1"><span>⏳ Results awaited · ${ws.length}</span><span class="ua">${isOpen ? "▾" : "▸"}</span></summary><div class="uwl">${ws.map(line).join("")}</div></details>`;
  }
  const prefs = () => Object.assign({
    view: "list",
    hide: {}
  }, st && st.upcomingPrefs || {});
  const savePrefs = p => chrome.storage.local.set({
    upcomingPrefs: p
  });
  function lineHtml(x) {
    return `<button type="button" class="ul k-${x.kind}${x.soon ? " soon" : ""}" data-open="${esc(x.id)}" data-applied="${x.applied ? 1 : 0}" data-kind="${x.kind}">\n      <span class="tm">${x.allDay ? "all day" : esc(timeOf(x.d))}</span><i></i><span class="tx"><b>${esc(x.firm)}</b> · ${esc(x.what)}${x.role && x.kind !== "shortlist" ? `<small>${esc(x.role)}</small>` : ""}</span></button>`;
  }
  function listHtml(xs) {
    const wk = Date.now() + 7 * 864e5, clear = !xs.some(x => x.d < wk && x.kind !== "done" && x.kind !== "ni") ? `<div class="uclear">Clear week 😌</div>` : "";
    if (!xs.length) return clear + `<div class="uempty">Nothing in the next ${DAYS} days.</div>`;
    const by = [];
    let cur = null;
    for (const x of xs) {
      const k = dayKey(x.d);
      if (!cur || cur.k !== k) {
        cur = {
          k: k,
          d: x.d,
          xs: []
        };
        by.push(cur);
      }
      cur.xs.push(x);
    }
    return clear + by.map(g => `<div class="uday"><h4>${esc(dayHead(g.d))}</h4>${g.xs.map(lineHtml).join("")}</div>`).join("");
  }
  function monthHtml(xs) {
    const now = new Date, endKey = dayKey(new Date(Date.now() + (DAYS - 1) * 864e5));
    const first = dayKey(now).slice(0, 7), last = endKey.slice(0, 7), ym = monthYm && monthYm >= first && monthYm <= last ? monthYm : first;
    const byDay = {};
    xs.forEach(x => (byDay[dayKey(x.d)] = byDay[dayKey(x.d)] || []).push(x));
    const day = monthDay || dayKey(now), its = byDay[day] || [];
    const sel = its.length ? `<div class="uday"><h4>${esc(dayHead(its[0].d))}</h4>${its.map(lineHtml).join("")}</div>` : `<div class="uempty">${day === dayKey(now) ? "Nothing today" : "Nothing on " + esc(dayHead(new Date(day + "T12:00:00+05:30")))}.</div>`;
    return oneMonth(ym, byDay, ym > first, ym < last) + sel;
  }
  function oneMonth(ym, byDay, canBack, canNext) {
    const now = new Date, first = new Date(ym + "-01T12:00:00+05:30");
    const startDow = (new Date(first.getTime()).getUTCDay() + 6) % 7;
    const y = +dayKey(first).slice(0, 4), m = +dayKey(first).slice(5, 7), n = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const today = dayKey(now);
    let cells = "";
    for (let i = 0; i < startDow; i++) cells += `<span class="mc blank"></span>`;
    for (let d = 1; d <= n; d++) {
      const k = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`, its = byDay[k] || [];
      const dots = [ ...new Set(its.map(x => x.kind)) ].slice(0, 4).map(k2 => `<i class="k-${k2}"></i>`).join("");
      cells += `<button type="button" class="mc${k === today ? " today" : ""}${k === (monthDay || today) ? " sel" : ""}${its.length ? " has" : ""}" data-day="${k}"><b>${d}</b><span>${dots}</span></button>`;
    }
    const mname = first.toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric",
      timeZone: "Asia/Kolkata"
    });
    const arrow = (d, on, lbl) => `<button type="button" class="mnav" data-month-step="${d}"${on ? "" : " disabled"} aria-label="${lbl}">${d < 0 ? "‹" : "›"}</button>`;
    return `<div class="umonth"><div class="mh">${arrow(-1, canBack, "Previous month")}<span>${esc(mname)}</span>${arrow(1, canNext, "Next month")}</div><div class="mg">${[ "M", "T", "W", "T", "F", "S", "S" ].map(d => `<span class="mw">${d}</span>`).join("")}${cells}</div></div>`;
  }
  function panelHtml() {
    const p = prefs(), all = items(), xs = all.filter(x => !p.hide[x.kind]);
    const ws = awaited();
    const key = KINDS.map(([k, w], i) => (i === 4 ? `<span class="ubr"></span>` : "") + `<button type="button" class="uk k-${k}${p.hide[k] ? " off" : ""}" data-kind-toggle="${k}" title="${p.hide[k] ? "Show" : "Hide"} ${esc(w)}"><i></i>${esc(w)}</button>`).join("") + `<button type="button" class="uk k-wait${p.waitOpen ? " on" : ""}" data-wait-chip="1" title="${ws.length ? (p.waitOpen ? "Close" : "Open") + " the list of results you're waiting for" : "No results awaited right now"}"${ws.length ? "" : " disabled"}><i></i>${esc(WAIT[1])}${ws.length ? ` <em>${ws.length}</em>` : ""}</button>`;
    return `<div class="uhd"><b>📅 Upcoming</b><span class="uview"><button type="button" data-view="list" class="${p.view === "list" ? "on" : ""}">List</button><button type="button" data-view="month" class="${p.view === "month" ? "on" : ""}">Month</button></span><button type="button" class="ux" data-close="1" aria-label="Close">✕</button></div>\n      <div class="ukey">${key}</div><div class="ubody">${waitHtml(ws, !!p.waitOpen)}${p.view === "month" ? monthHtml(xs) : listHtml(xs)}</div>\n      ${(st.gcal || {}).connected || !PT.googleReady() ? `<div class="ufoot">Next ${DAYS} days · Not interested jobs are never in your Google Calendar</div>` : `<div class="ufoot">📅 Your Google Calendar is off · <button type="button" class="ucal" data-cal="on" title="Puts your deadlines in a “Placement Tracker” calendar in your Google account">Turn it on</button></div>`}`;
  }
  const SHEET_IC = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><rect x="4" y="2.5" width="16" height="19" rx="2.5" fill="#1e8e3e"/><rect x="7" y="8" width="10" height="9" rx="1" fill="#fff"/><path d="M7 11h10M7 14h10M11 8v9" stroke="#1e8e3e" stroke-width="1.3"/></svg>';
  function draw() {
    if (PT.dead) return;
    document.documentElement.setAttribute("data-pt-edge", "1");
    if (!st) return;
    const sf = `<div class="esf"><button type="button" class="etab2" data-share="1" title="Copies a message and a link to the tracker, to paste to a friend">${copied ? "✓ Copied" : "🔗 Share"}</button><button type="button" class="etab2" data-feedback="1" title="An anonymous form: what works, what's broken, what's missing">💬 Feedback</button></div>`;
    const calOn = !!(st.gcal || {}).connected, calBusy = calWant && Date.now() - calWant.at < 6e4 && calWant.on !== calOn;
    const cal = PT.googleReady() ? `<div class="ecal${calOn ? " on" : ""}" role="group" aria-label="Google Calendar" title="${calOn ? "Your deadlines go into a “Placement Tracker” calendar in your Google account" : "Turn on to put your deadlines in a “Placement Tracker” calendar in your Google account. It can't see or change your other calendars"}"><button type="button" data-cal="on" class="${calOn ? "on" : ""}" aria-pressed="${calOn}"${calBusy ? " disabled" : ""}>On</button><button type="button" data-cal="off" class="${calOn ? "" : "on"}" aria-pressed="${!calOn}"${calBusy ? " disabled" : ""}>Off</button><span class="ecl">📅<em> Calendar</em></span></div>` : "";
    const qaN = st.qa && (st.qa.rows || []).length ? PT.qaNew(st.qa.rows, st.qaKnown).length : 0;
    const qaTab = `<button type="button" class="etab eqa${document.getElementById("pt-qpanel") ? " on" : ""}" data-qa="1" title="Answers from the placement group (CAC / CAS)"><span>🗨 Q&amp;A</span>${qaN ? `<b>${qaN}</b>` : ""}</button>`;
    if (!st.snapshot || !PT.googleReady()) {
      open = false;
      const pn = document.getElementById("pt-upanel");
      if (pn) pn.remove();
      let r = document.getElementById("pt-edge");
      if (!r) {
        r = document.createElement("div");
        r.id = "pt-edge";
        document.body.appendChild(r);
      }
      if (r.dataset.html !== qaTab + cal + sf) {
        r.innerHTML = qaTab + cal + sf;
        r.dataset.html = qaTab + cal + sf;
      }
      return;
    }
    let root = document.getElementById("pt-edge");
    if (!root) {
      root = document.createElement("div");
      root.id = "pt-edge";
      document.body.appendChild(root);
    }
    const today = items().filter(x => dayKey(x.d) === dayKey(new Date) && !prefs().hide[x.kind] && x.kind !== "ni" && x.kind !== "done").length;
    const sh = st.gsheet || {}, made = !!sh.id, busy = !!sh.busy && Date.now() - (sh.busyAt || 0) < 12e4;
    const re = made && sh.needsAccess;
    const card = (!made || re) && sheetCard ? re ? `<div class="scard" role="dialog" aria-label="Your Google Sheet"><b>Your Google Sheet</b><span>Google needs your OK again before the tracker can keep your Sheet up to date.</span>\n        <button type="button" class="sgo" data-sheet-make="1"${busy ? " disabled" : ""}>${busy ? "Connecting…" : sh.error ? "Try again" : "Reconnect my Sheet"}</button>${sh.error ? `<span class="serr">${esc(sh.error)}</span>` : ""}<small>Google asks for access to this Sheet only.</small></div>` : `<div class="scard" role="dialog" aria-label="Your jobs in a Google Sheet"><b>Your jobs in a Google Sheet</b><span>Every job and its status in one Sheet in your Google Drive, ready for your own filters and pivots. It auto-updates.</span>\n        <button type="button" class="sgo" data-sheet-make="1"${busy ? " disabled" : ""}>${busy ? "Making your Sheet…" : sh.error ? "Try again" : "Make my Sheet"}</button>${sh.error ? `<span class="serr">${esc(sh.error)}</span>` : ""}<small>Google asks once for access to this Sheet only.</small></div>` : "";
    const html = `<button type="button" class="etab${open ? " on" : ""}" data-edge="1" title="Upcoming deadlines and steps"><span>📅 Upcoming</span>${today ? `<b>${today}</b>` : ""}</button>\n      <div class="esh${made ? " made" : ""}"><button type="button" class="eshb" data-sheet="1" title="${made ? "Open your Google Sheet" : "Your jobs in a Google Sheet"}">${SHEET_IC}${made ? '<i class="dot"></i>' : ""}</button>${card}</div>`;
    const at = html.indexOf('<div class="esh'), shown = html.slice(0, at) + qaTab + (PT.FEATURES.sheet ? html.slice(at) : "") + cal + sf;
    if (root.dataset.html !== shown) {
      root.innerHTML = shown;
      root.dataset.html = shown;
    }
    let pn = document.getElementById("pt-upanel");
    if (open) {
      if (!pn) {
        pn = document.createElement("aside");
        pn.id = "pt-upanel";
        document.body.appendChild(pn);
      }
      const top = headerBottom();
      pn.style.top = top + "px";
      pn.style.height = `calc(100vh - ${top}px)`;
      const h2 = panelHtml();
      if (pn.dataset.html !== h2) {
        pn.innerHTML = h2;
        pn.dataset.html = h2;
      }
    } else if (pn) pn.remove();
  }
  const headerBottom = () => {
    const h = document.querySelector(".alain-default__header, .ant-layout-header, header");
    return h && getComputedStyle(h).position === "fixed" ? Math.max(0, h.getBoundingClientRect().bottom) : 0;
  };
  function openCard(id, isApp, kind) {
    const page = isApp ? "#/student/my-applications" : "#/student/student-jobs";
    const sel = isApp ? `#pt-cool article.jc[data-app="${CSS.escape(id)}"]` : `#pt-cool article.jc[data-jobs~="${CSS.escape(id)}"]`;
    const cool = st && st.coolUI !== false && kind !== "ni";
    if (!cool) {
      location.href = PT.portalJobUrl(id);
      return;
    }
    if (!location.hash.startsWith(page)) location.hash = page;
    let n = 0;
    const find = () => {
      const c = document.querySelector(sel);
      if (c) {
        open = false;
        draw();
        c.scrollIntoView({
          behavior: "smooth",
          block: "center"
        });
        c.classList.remove("ptglow");
        void c.offsetWidth;
        c.classList.add("ptglow");
        return;
      }
      if (++n < 25) setTimeout(find, 200); else location.href = PT.portalJobUrl(id);
    };
    find();
  }
  async function copyText(t) {
    try {
      await navigator.clipboard.writeText(t);
      return true;
    } catch (e) {}
    const ta = document.createElement("textarea");
    ta.value = t;
    ta.style.cssText = "position:fixed;left:-9999px";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
    } catch (e) {}
    ta.remove();
    return true;
  }
  let copiedT = 0;
  function hoopla(r) {
    const old = document.getElementById("pt-sharefx");
    if (old) old.remove();
    const fx = document.createElement("div");
    fx.id = "pt-sharefx";
    fx.setAttribute("role", "status");
    const calm = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches, cols = [ "#1e7a46", "#d9741a", "#2563eb", "#0d9488", "#e11d48", "#f5b301" ];
    const x = r.left, y = r.top + r.height / 2;
    fx.innerHTML = (calm ? "" : Array.from({
      length: 28
    }, (_, i) => {
      const a = Math.PI * (.55 + i / 27 * .9), d = 60 + i * 37 % 90;
      return `<i style="left:${x}px;top:${y}px;background:${cols[i % cols.length]};--dx:${Math.round(Math.cos(a) * d)}px;--dy:${Math.round(-Math.sin(a) * d * .9 + 30)}px;--r:${i * 97 % 360}deg;animation-delay:${i % 5 * 30}ms"></i>`;
    }).join("")) + `<div class="sc" style="right:${Math.round(innerWidth - x + 12)}px;top:${Math.round(y - 34)}px"><b>Message copied 🎉</b><span>Paste it in WhatsApp, email or anywhere.</span></div>`;
    document.body.appendChild(fx);
    setTimeout(() => fx.classList.add("out"), 3600);
    setTimeout(() => fx.remove(), 4100);
  }
  document.addEventListener("click", async e => {
    const inEdge = e.target.closest("#pt-edge"), inPanel = e.target.closest("#pt-upanel");
    if (!inEdge && !inPanel) {
      if (sheetCard) {
        sheetCard = false;
        draw();
      }
      return;
    }
    const fold = e.target.closest("summary[data-wait-fold]");
    if (fold) {
      e.preventDefault();
      const p = prefs();
      p.waitOpen = !p.waitOpen;
      if (p.waitOpen) count("pt_upcoming", {
        action: "results_awaited"
      });
      await savePrefs(p);
      return;
    }
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.cal) {
      const on = b.dataset.cal === "on", now = !!(st && st.gcal || {}).connected;
      if (on === now) return;
      calWant = {
        on: on,
        at: Date.now()
      };
      count("pt_edge", {
        action: on ? "cal_on" : "cal_off"
      });
      draw();
      setTimeout(draw, 61e3);
      chrome.runtime.sendMessage({
        type: on ? "PT_GCAL_CONNECT" : "PT_GCAL_DISCONNECT"
      }).catch(() => {}).finally(() => {
        calWant = null;
        draw();
      });
      return;
    }
    if (b.dataset.share) {
      const r = b.getBoundingClientRect();
      count("pt_share", "float");
      await copyText(PT.shareText("float"));
      copied = true;
      draw();
      hoopla(r);
      clearTimeout(copiedT);
      copiedT = setTimeout(() => {
        copied = false;
        draw();
      }, 4e3);
      return;
    }
    if (b.dataset.feedback) {
      count("pt_feedback", "float");
      window.open(PT.FEEDBACK_URL, "_blank", "noopener");
      return;
    }
    if (b.dataset.edge) {
      open = !open;
      sheetCard = false;
      if (open) {
        monthDay = dayKey(new Date);
        monthYm = "";
        document.dispatchEvent(new CustomEvent("pt-panel", {
          detail: "up"
        }));
        count("pt_upcoming_open");
      }
      draw();
      return;
    }
    if (b.dataset.close) {
      open = false;
      draw();
      return;
    }
    if (b.dataset.view) {
      const p = prefs();
      p.view = b.dataset.view;
      count("pt_upcoming", {
        action: p.view === "month" ? "view_month" : "view_list"
      });
      if (p.view === "month") {
        monthDay = dayKey(new Date);
        monthYm = "";
      }
      await savePrefs(p);
      draw();
      return;
    }
    if (b.dataset.kindToggle) {
      const p = prefs();
      p.hide = Object.assign({}, p.hide, {
        [b.dataset.kindToggle]: !p.hide[b.dataset.kindToggle]
      });
      count("pt_upcoming", {
        action: p.hide[b.dataset.kindToggle] ? "chip_off" : "chip_on",
        feature: b.dataset.kindToggle
      });
      await savePrefs(p);
      return;
    }
    if (b.dataset.waitChip) {
      const p = prefs();
      p.waitOpen = !p.waitOpen;
      if (p.waitOpen) count("pt_upcoming", {
        action: "results_awaited"
      });
      await savePrefs(p);
      return;
    }
    if (b.dataset.day) {
      monthDay = b.dataset.day;
      draw();
      return;
    }
    if (b.dataset.monthStep) {
      count("pt_upcoming", {
        action: "month_step"
      });
      const now = new Date, cur = monthYm || dayKey(now).slice(0, 7), d = new Date(cur + "-15T12:00:00+05:30");
      d.setUTCMonth(d.getUTCMonth() + +b.dataset.monthStep);
      monthYm = dayKey(d).slice(0, 7);
      const has = items().filter(x => !prefs().hide[x.kind]).map(x => dayKey(x.d)).filter(k => k.startsWith(monthYm)).sort()[0];
      monthDay = dayKey(now).startsWith(monthYm) ? dayKey(now) : has || monthYm + "-01";
      draw();
      return;
    }
    if (b.dataset.open) {
      count("pt_upcoming", {
        action: "line_open"
      });
      openCard(b.dataset.open, b.dataset.applied === "1", b.dataset.kind);
      return;
    }
    if (b.dataset.sheet) {
      const sh = st && st.gsheet || {};
      if (sh.id && !sh.needsAccess) {
        chrome.runtime.sendMessage({
          type: "PT_SHEET_OPEN"
        }).catch(() => {});
        return;
      }
      sheetCard = !sheetCard;
      open = false;
      draw();
      return;
    }
    if (b.dataset.sheetMake) {
      b.disabled = true;
      b.textContent = "Making your Sheet…";
      const r = await chrome.runtime.sendMessage({
        type: "PT_SHEET_MAKE"
      }).catch(e2 => ({
        error: String(e2)
      }));
      if (r && r.ok) sheetCard = false;
      draw();
      return;
    }
  });
  document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    if (open) {
      open = false;
      draw();
    } else if (sheetCard) {
      sheetCard = false;
      draw();
    }
  });
  document.addEventListener("pt-panel", e => {
    if (e.detail !== "up" && (open || sheetCard)) {
      open = false;
      sheetCard = false;
      draw();
    }
  });
  chrome.storage.onChanged.addListener((ch, area) => {
    if (area !== "local" || !st) return;
    Object.keys(ch).forEach(k => {
      st[k] = ch[k].newValue;
    });
    draw();
  });
  chrome.storage.local.get(null).then(v => {
    st = v;
    draw();
  });
  setInterval(() => {
    if (st) draw();
  }, 6e4);
})();