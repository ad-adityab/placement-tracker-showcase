(() => {
  if (window.__ptTourLoaded) return;
  window.__ptTourLoaded = true;
  const $ = q => document.querySelector(q);
  const calOn = () => !!(fr && fr.gcal && fr.gcal.connected);
  const cardsStep = () => /^#\/student\/my-applications\b/.test(location.hash) ? {
    t: "#pt-cool article.jc.pc",
    k: "Manage Applications",
    h: "Every application as a card",
    body: "<ul><li>The next step and its deadline up front, the whole process one click away</li><li>Changed your mind while a job is still open? <b>Withdraw ↗</b> points at the portal's own button</li></ul>"
  } : /^#\/student\/student-jobs\b/.test(location.hash) ? document.querySelector("#pt-cool #pt-list") ? {
    t: "#pt-cool #pt-list tr.ptlr",
    k: "Manage All Jobs",
    h: "Every job as one row",
    body: "<ul><li>Grouped by when it closes; click a row for its JD summary, Apply and <b>Not interested</b></li><li>Click a column's name to sort; <b>▦ Cards</b> shows each firm as a card</li></ul>"
  } : {
    t: "#pt-cards article.jc",
    k: "Manage All Jobs",
    h: "Every job as a card",
    body: "<ul><li>Eligibility, CGPA cut-off, work type, what it costs in counters</li><li><b>Not interested</b> " + (calOn() ? "takes it out of your calendar" : "hides it") + "; <b>☰ List</b> shows every job as one row</li></ul>"
  } : null;
  function steps() {
    return [ {
      t: null,
      k: "Welcome",
      h: "Welcome to Placement Tracker 👋",
      body: "<p>A one-minute look at what it adds to this portal. Close it any time with ✕; <b>❓ Tour</b> at the bottom of the page plays it again.</p>",
      go: "Start the tour"
    }, {
      t: "#pt-edge .etab[data-edge]",
      k: "Upcoming",
      h: "📅 Your next two weeks",
      body: "<ul><li>Every apply-by, next step and shortlist date, as a list or a month</li><li><b>⏳ Results awaited</b>: shortlists past their date, and when the counter comes back</li></ul>"
    }, {
      t: "#pt-edge .eqa",
      k: "Q&A",
      h: "🗨 Answers from the placement group",
      body: "<ul><li>What CAC and CAS answered, grouped by your firms; search it instantly</li><li>Nothing there? <b>Ask in the group ↗</b> opens WhatsApp with your question typed in</li></ul>"
    }, cardsStep(), {
      t: "#pt-edge .eshb",
      k: "Google Sheet",
      h: "Your jobs in a Google Sheet",
      body: "<p>One click makes a Sheet of every job and its status in your own Drive, for your own filters and pivots. It auto-updates.</p>"
    }, {
      t: "#pt-edge .esf [data-share]",
      t2: "#pt-edge .esf [data-feedback]",
      k: "Share · Feedback",
      h: "Liked it? Tell a friend",
      body: "<ul><li><b>🔗 Share</b> copies a message with the link</li><li><b>💬 Feedback</b> opens a short, anonymous form</li></ul>"
    } ].filter(s => s && (!s.t || $(s.t)));
  }
  let S = [], i = 0, box = null, ring = null, card = null;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;"
  }[c]));
  const count = (name, params) => chrome.runtime.sendMessage({
    type: "PT_COUNT",
    name: name,
    params: params
  }).catch(() => {});
  function start(where) {
    if (box) end();
    S = steps();
    i = 0;
    if (!S.length) return;
    count("pt_tour_start", where);
    frDraw();
    chrome.storage.local.set({
      tourSeen: Date.now()
    }).catch(() => {});
    box = document.createElement("div");
    box.id = "pt-tour";
    box.innerHTML = `<div class="tblock"></div><div class="tring"></div><div class="tcard" role="dialog" aria-modal="true" aria-label="Placement Tracker tour"></div>`;
    document.body.appendChild(box);
    ring = box.querySelector(".tring");
    card = box.querySelector(".tcard");
    box.addEventListener("click", onClick);
    addEventListener("keydown", onKey, true);
    addEventListener("resize", draw);
    addEventListener("scroll", draw, true);
    draw();
  }
  function end() {
    if (!box) return;
    box.remove();
    box = ring = card = null;
    removeEventListener("keydown", onKey, true);
    removeEventListener("resize", draw);
    removeEventListener("scroll", draw, true);
    frDraw();
  }
  function onKey(e) {
    if (!box) return;
    if (e.key === "Escape") {
      e.stopPropagation();
      e.preventDefault();
      closeTour();
    } else if (e.key === "ArrowRight" || e.key === "Enter") {
      e.preventDefault();
      next();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (i > 0) {
        i--;
        draw(true);
      }
    }
  }
  const stepKey = () => {
    const k = String((S[i] || {}).k || "");
    return /welcome/i.test(k) ? "welcome" : /upcoming/i.test(k) ? "upcoming" : /q&a/i.test(k) ? "qa" : /manage/i.test(k) ? "cards" : /sheet/i.test(k) ? "sheet" : /share/i.test(k) ? "share" : "welcome";
  };
  const closeTour = () => {
    count("pt_tour_end", {
      step: stepKey()
    });
    end();
    hint();
  };
  function next() {
    if (i >= S.length - 1) {
      count("pt_tour_done");
      count("pt_tour_end", {
        step: "done"
      });
      end();
      hint();
    } else {
      i++;
      draw(true);
    }
  }
  function hint() {
    const tab = $("#pt-cool [data-tour]"), old = document.getElementById("pt-tourhint");
    if (old) old.remove();
    const n = document.createElement("div");
    n.id = "pt-tourhint";
    n.setAttribute("role", "status");
    const r = tab && tab.getBoundingClientRect(), seen = !!(r && r.width && r.top >= 0 && r.bottom <= innerHeight);
    if (tab) {
      tab.classList.remove("pt-tourglow");
      void tab.offsetWidth;
      tab.classList.add("pt-tourglow");
    }
    n.textContent = seen ? "❓ Tour plays it again any time" : "❓ Tour at the bottom of the page plays it again any time";
    if (seen) {
      n.style.top = Math.round(r.top - 44) + "px";
      n.style.left = Math.round(Math.max(12, r.left + r.width / 2 - 130)) + "px";
      n.style.right = "auto";
    } else {
      n.classList.add("low");
    }
    document.body.appendChild(n);
    setTimeout(() => n.classList.add("out"), 3200);
    setTimeout(() => {
      n.remove();
      if (tab) tab.classList.remove("pt-tourglow");
    }, 3700);
  }
  function onClick(e) {
    const b = e.target.closest("button[data-tg]");
    if (!b) return;
    const g = b.dataset.tg;
    if (g === "next") next(); else if (g === "back" && i > 0) {
      i--;
      draw(true);
    } else if (g === "close") closeTour();
  }
  function rectOf(s) {
    const a = s.t && $(s.t);
    if (!a) return null;
    const r = a.getBoundingClientRect(), b = s.t2 && $(s.t2), r2 = b ? b.getBoundingClientRect() : r;
    return {
      left: Math.min(r.left, r2.left),
      top: Math.min(r.top, r2.top),
      right: Math.max(r.right, r2.right),
      bottom: Math.max(r.bottom, r2.bottom)
    };
  }
  function draw(scroll) {
    if (!box) return;
    const s = S[i];
    if (!s) return end();
    if (scroll && s.t) {
      const a = $(s.t), r = a && a.getBoundingClientRect();
      if (r && (r.top < 70 || r.bottom > innerHeight - 20)) a.scrollIntoView({
        block: "center"
      });
    }
    const n = S.length - 1, pos = i;
    const dots = S.map((_, j) => `<i class="${j === i ? "on" : ""}"></i>`).join("");
    card.innerHTML = `<div class="tk"><span>${i ? `${pos} of ${n} · ${esc(s.k)}` : esc(s.k)}</span><span class="tdots">${dots}</span><button type="button" class="tx" data-tg="close" aria-label="Close the tour" title="Close the tour">✕</button></div><h4>${esc(s.h)}</h4>${s.body}\n      <div class="tnav">${i ? `<button type="button" class="tbk" data-tg="back">Back</button>` : ""}<button type="button" class="tgo" data-tg="next">${esc(s.go || (i >= S.length - 1 ? "Done" : "Next"))}</button></div>`;
    const cw = card.offsetWidth, ch = card.offsetHeight, r = rectOf(s), p = 6;
    if (r) {
      ring.classList.remove("none");
      const top = Math.max(r.top - p, 4), bottom = Math.min(r.bottom + p, innerHeight - 4);
      Object.assign(ring.style, {
        left: r.left - p + "px",
        top: top + "px",
        width: r.right - r.left + 2 * p + "px",
        height: Math.max(0, bottom - top) + "px"
      });
      let left = r.left - cw - 24, ctop = (r.top + r.bottom) / 2 - ch / 2;
      if (left < 12) {
        left = (r.left + r.right) / 2 - cw / 2;
        ctop = r.bottom + 18 + ch < innerHeight ? r.bottom + 18 : r.top - ch - 18;
      }
      card.style.left = Math.max(12, Math.min(innerWidth - cw - 12, left)) + "px";
      card.style.top = Math.max(12, Math.min(innerHeight - ch - 12, ctop)) + "px";
    } else {
      ring.classList.add("none");
      Object.assign(ring.style, {
        left: innerWidth / 2 + "px",
        top: innerHeight / 2 + "px",
        width: "0px",
        height: "0px"
      });
      card.style.left = (innerWidth - cw) / 2 + "px";
      card.style.top = Math.max(12, (innerHeight - ch) / 2) + "px";
    }
    const go = card.querySelector(".tgo");
    if (go && document.activeElement !== go) go.focus({
      preventScroll: true
    });
  }
  let fr = null, frHidden = false, frOkT = 0;
  const frEsc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;"
  }[c]));
  const calDone = f => !!(f.gcal && f.gcal.connected && f.gcal.lastSync && !f.calProg);
  function frState() {
    const snap = fr.snapshot || null, p = fr.progress || null, det = fr.details || {};
    const lists = !!(snap && (snap.apps || snap.jobs)), apps = snap ? (snap.apps || []).length : 0, jobs = snap ? (snap.jobs || []).length : 0;
    const due = p && p.due ? p.due : 0, done = p && p.due ? p.done : 0;
    const names = Object.keys(det).slice(-2).map(id => {
      const j = snap && (snap.jobs || []).concat(snap.apps || []).find(x => x.id === id) || null;
      return j ? PT.shortFirm(j.company) : "";
    }).filter(Boolean);
    const cal = !!(fr.gcal && fr.gcal.connected);
    const items = [ [ snap && snap.apps ? "d" : "w", `Your applications${snap && snap.apps ? " · " + apps : ""}` ], [ snap && snap.jobs ? "d" : lists ? "w" : "n", `Open jobs${snap && snap.jobs ? " · " + jobs : ""}` ], [ snap && (snap.dash || []).length ? "d" : lists ? "w" : "n", "Your counters" ], [ fr.lastCheck || due && done >= due ? "d" : due ? "w" : "n", `Job details${due ? ` · ${done} of ${due}` : ""}`, names.length && due && done < due ? names.join(", ") + "…" : "" ], [ cal ? calDone(fr) ? "d" : "w" : "n", cal ? `Deadlines into your Google Calendar${fr.calProg ? ` · ${fr.calProg.done} of ${fr.calProg.total}` : ""}` : "Google Calendar (optional) · Off", cal ? "" : "Turn it on any time from 📅 Calendar on the right edge" ] ];
    const calPart = !cal ? 0 : calDone(fr) ? 1 : fr.calProg && fr.calProg.total ? fr.calProg.done / fr.calProg.total : 0;
    const pct = Math.round(((snap && snap.apps ? 1 : 0) + (snap && snap.jobs ? 1 : 0) + (snap && (snap.dash || []).length ? 1 : 0) + (fr.lastCheck ? 1 : due ? done / due : 0) + calPart) / (cal ? 5 : 4) * 100);
    return {
      items: items,
      pct: pct,
      due: due,
      done: done
    };
  }
  function frDraw() {
    if (PT.dead) return;
    if (!fr) return;
    let c = document.getElementById("pt-firstrun"), chip = document.getElementById("pt-frchip");
    const ended = (!!fr.lastCheck || !fr.progress && !!fr.snapshot && !!fr.checkRun) && (!(fr.gcal && fr.gcal.connected) || calDone(fr) || Date.now() - (fr.firstRunArmed || 0) > 20 * 6e4);
    const reading = !!fr.firstRunArmed && !ended && !fr.firstRunDone && !!(fr.progress || fr.checkRun && Date.now() - (fr.checkRun.at || 0) < 15 * 6e4) && /^https:\/\/placements\.isb\.edu\//.test(location.href) && !isApply();
    if (!reading) {
      if (c) c.remove();
      if (chip && !chip.classList.contains("ok") && ended) {
        chip.classList.add("ok");
        chip.textContent = "✓ All set";
        clearTimeout(frOkT);
        frOkT = setTimeout(() => {
          chip.classList.add("out");
          setTimeout(() => chip.remove(), 450);
        }, 3200);
      }
      if (ended && fr.firstRunArmed && !fr.firstRunDone) {
        fr.firstRunDone = Date.now();
        chrome.storage.local.set({
          firstRunDone: fr.firstRunDone
        }).catch(() => {});
        const m = (Date.now() - fr.firstRunArmed) / 6e4;
        count("pt_firstrun_done", {
          bucket: m < 1 ? "<1m" : m < 3 ? "1-3m" : m < 10 ? "3-10m" : "10m+"
        });
      }
      return;
    }
    const s = frState();
    if (box || frHidden) {
      if (c) c.remove();
      if (!box && frHidden) {
        if (chip) chip.remove();
        return;
      }
      if (!chip) {
        chip = document.createElement("div");
        chip.id = "pt-frchip";
        chip.setAttribute("role", "status");
        document.body.appendChild(chip);
      }
      const t = `⏳ Setting up${s.due ? ` · ${s.done} of ${s.due} job details` : "…"}`;
      if (chip.textContent !== t) chip.textContent = t;
      return;
    }
    if (chip) chip.remove();
    if (!c) {
      c = document.createElement("div");
      c.id = "pt-firstrun";
      c.setAttribute("role", "status");
      c.setAttribute("aria-live", "polite");
      document.body.appendChild(c);
    }
    const h = `<button type="button" class="fx" data-fr="close" aria-label="Close; reading carries on">✕</button><h4>Setting up your tracker</h4><div class="sub">Reading your own portal data, about a minute the first time</div>\n      ${s.items.map(([k, t, sm]) => `<div class="st ${k}"><i>${k === "d" ? "✓" : ""}</i><span>${frEsc(t)}${sm ? `<small>${frEsc(sm)}</small>` : ""}</span></div>`).join("")}\n      <div class="bar"><i style="width:${Math.max(4, s.pct)}%"></i></div>\n      ${fr.tourSeen ? "" : `<button type="button" class="tourbtn" data-fr="tour">Take the 1-minute tour while you wait <span>Start ▸</span></button>`}\n      <div class="trust">🔒 It only reads what you see on the portal. Your data stays on this computer and, if you turn Calendar on, in your own calendar; only anonymous usage counts are sent, and you can turn those off in the extension.</div>`;
    if (c.dataset.html !== h) {
      c.innerHTML = h;
      c.dataset.html = h;
    }
  }
  document.addEventListener("click", e => {
    const b = e.target.closest("#pt-firstrun [data-fr]");
    if (!b) return;
    e.preventDefault();
    if (b.dataset.fr === "close") {
      frHidden = true;
      frDraw();
    } else if (b.dataset.fr === "tour") start("firstrun");
  });
  const FR_KEYS = [ "snapshot", "progress", "details", "lastCheck", "firstRunDone", "gcal", "tourSeen", "checkRun", "firstRunArmed", "calProg" ];
  chrome.storage.local.get(FR_KEYS).then(v => {
    fr = v;
    frDraw();
  }).catch(() => {});
  chrome.storage.onChanged.addListener((ch, area) => {
    if (area !== "local" || !fr) return;
    let hit = false;
    FR_KEYS.forEach(k => {
      if (k in ch) {
        fr[k] = ch[k].newValue;
        hit = true;
      }
    });
    if (hit) frDraw();
  });
  addEventListener("hashchange", () => frDraw());
  document.addEventListener("click", e => {
    if (e.target.closest("#pt-cool [data-tour], #pt-edge [data-tour]")) {
      e.preventDefault();
      start("tab");
    }
  });
  const isApply = () => /application-details/.test(location.hash);
  let tries = 0;
  const busy = () => !!(fr && fr.firstRunArmed && !fr.lastCheck && !fr.firstRunDone) || !!document.getElementById("pt-frchip");
  const auto = () => chrome.storage.local.get([ "tourSeen", "snapshot" ]).then(v => {
    if (v.tourSeen || box) return;
    if (isApply() || !$("#pt-edge") || busy()) {
      if (++tries < 400) setTimeout(auto, 1500);
      return;
    }
    setTimeout(() => {
      if (!box && !isApply() && !busy()) chrome.storage.local.get("tourSeen").then(w => {
        if (!w.tourSeen) start("auto");
      });
    }, 1200);
  }).catch(() => {});
  setTimeout(auto, 1500);
  addEventListener("hashchange", () => {
    if (box && isApply()) end();
  });
})();