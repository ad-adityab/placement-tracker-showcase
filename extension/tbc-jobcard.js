(function() {
  "use strict";
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
  function parseGviz(text) {
    const j = JSON.parse(String(text).slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
    if (j.status === "error") throw new Error("sheet error");
    const cols = j.table.cols.map(c => (c.label || c.id || "").trim());
    return (j.table.rows || []).map(r => {
      const o = {};
      cols.forEach((c, i) => {
        const v = r.c && r.c[i];
        o[c] = v == null ? "" : String(v.v ?? v.f ?? "");
      });
      return o;
    }).filter(o => Object.values(o).some(v => v !== ""));
  }
  const SUFFIX = /\b(private|pvt|limited|ltd|llp|inc|india services|consulting india|corporate advisory india|and company|& company|company)\b\.?|\(.*?\)|,/gi;
  const shortOf = j => j.company_short || String(j.company || "").replace(SUFFIX, " ").replace(/\s+/g, " ").trim();
  const deadlineOf = j => new Date(String(j.deadline_ist).replace(" ", "T") + ":00+05:30");
  const isClosedJob = (j, now) => j.listing_status === "closed" || deadlineOf(j) - now <= 0;
  const PORTAL_JOBS = "https://placements.isb.edu/#/student/student-jobs";
  const portalJob = j => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(j.application_id || "").trim()) ? "https://placements.isb.edu/#/applications/application-details/" + String(j.application_id).trim().toLowerCase() : PORTAL_JOBS;
  function groupFirms(jobs, opts) {
    const now = opts && opts.now || new Date, view = opts && opts.view || "open";
    const open = jobs.filter(j => !isClosedJob(j, now)).sort((a, b) => deadlineOf(a) - deadlineOf(b));
    const closed = jobs.filter(j => isClosedJob(j, now)).sort((a, b) => deadlineOf(b) - deadlineOf(a));
    const list = view === "closed" ? closed : view === "all" ? open.concat(closed) : open;
    const F = new Map;
    list.forEach(j => {
      const k = shortOf(j);
      if (!F.has(k)) F.set(k, []);
      F.get(k).push(j);
    });
    return [ ...F.values() ];
  }
  const fmtIST = d => d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata"
  });
  const fmtDate = d => {
    if (!d) return "";
    const x = new Date(d + (d.length === 10 ? "T00:00:00+05:30" : ""));
    return isNaN(x) ? d : x.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short"
    });
  };
  const CLN = c => (String(c).match(/\d+/) || [ "" ])[0];
  const clClass = c => ({
    1: "",
    2: "c2",
    3: "c3",
    4: "c4"
  }[CLN(c)] ?? "cx");
  const CL_NAME = {
    1: "Consulting & Investment Banking",
    2: "Technology, BFSI & FMCG",
    3: "Conglomerates & rest (manufacturing, pharma, infrastructure, others)"
  };
  const BLUE_TIP = "Blue tag job: the posting fixes the designation, location, job description and total CTC (fixed and variable). Salary can't be negotiated. Placement Policy §5.3.";
  const BLUE = `<span class="tip icon" tabindex="0" role="note" aria-label="${esc(BLUE_TIP)}" data-tip="${esc(BLUE_TIP)}"><svg class="bflag" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 1v14" stroke="#1d4ed8" stroke-width="2" stroke-linecap="round"/><path d="M4.5 2h8.5l-2.4 3.4L13 9H4.5z" fill="#2563eb"/></svg></span>`;
  const isIntl = j => /international/i.test(j.job_type || "");
  const PLANE = `<svg class="bflag plane" viewBox="0 0 24 24" aria-hidden="true"><path fill="#2563eb" d="M21.5 4.2c.6-.6.6-1.5 0-2-.5-.5-1.4-.5-2 .1l-4.1 4.1L5.6 3.6 3.9 5.3l7.8 4.8-3.9 3.9-2.9-.4-1.5 1.5 3.6 1.9 1.9 3.6 1.5-1.5-.4-2.9 3.9-3.9 4.8 7.8 1.7-1.7-2.8-9.8z"/></svg>`;
  const planeMark = j => {
    const tip = window.PT && PT.intlTip ? PT.intlTip(j.locations, j.country) : "International role: " + (j.locations || "outside India");
    return `<span class="tip icon" tabindex="0" role="note" aria-label="${esc(tip)}" data-tip="${esc(tip)}">${PLANE}</span>`;
  };
  const workOf = j => /remote/i.test(j.work_type || "") ? "Remote" : /hybrid/i.test(j.work_type || "") ? "Hybrid" : "";
  const HOUSE = `<svg class="house" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" d="M3.5 11 12 4l8.5 7M6 9.5V20h12V9.5"/><path fill="currentColor" d="M10 20v-5h4v5z"/></svg>`;
  function counterNote(j, n) {
    if (n < 2) return "";
    const c = String(j.counter || "").toLowerCase();
    const tip = c.startsWith("company") ? `Company-wise counter: applying to all ${n} roles at this firm on the same placement day uses one application counter. Placement Policy §12.1.` : c.startsWith("job") ? `Job-wise counter: each of the ${n} roles uses its own application counter. Placement Policy §12.1.` : `Counter: ${j.counter || "not stated"} (check the portal).`;
    const label = c.startsWith("company") ? `${n} roles · one counter` : c.startsWith("job") ? `${n} roles · one counter each` : `${n} roles`;
    return `<span class="tip" tabindex="0" data-tip="${esc(tip)}">${label}</span>`;
  }
  const shortStages = s => String(s || "").replace(/Applied with Resume/gi, "Resume").replace(/Personal Interview/gi, "PI").replace(/Group Discussion/gi, "GD").replace(/Online Test/gi, "Test").replace(/ assessment/gi, "");
  function stagesLine(s) {
    if (!s) return "";
    const body = String(s).split(" > ").map(x => esc(x.replace(/\s*\*\s*$/, "")) + (/\*\s*$/.test(x) ? ` <abbr class="star" title="Elimination round">✱</abbr>` : "")).join(" → ");
    return `<p class="stages" data-k="stages">${body}</p>`;
  }
  const leftCompact = ms => {
    if (ms <= 0) return "Closed";
    const h = ms / 36e5;
    return h < 1 ? Math.max(1, Math.round(ms / 6e4)) + " min" : h < 48 ? Math.round(h) + " h" : Math.floor(h / 24) + " d " + Math.floor(h % 24) + " h";
  };
  const tierOf = ms => {
    const h = ms / 36e5;
    return h <= 0 ? "" : h < 12 ? "t12" : h < 24 ? "t24" : "";
  };
  function roleChips(j) {
    const f = [];
    if (j.apply_on_company_website === "Yes") f.push(`<span class="tag do" data-k="apply" title="Apply on the company's own site too, as well as the portal">+ Company site</span>`);
    if (j.cover_letter_eoi === "Yes") f.push(`<span class="tag do" data-k="cl">Cover letter needed</span>`);
    const wk = workOf(j);
    if (wk) f.push(`<span class="tag wk" data-k="work">${HOUSE}${wk}</span>`);
    if (j.cgpa_required === "Yes") f.push(`<span class="tag cg yes" data-k="cgpa" title="Your CGPA is shared with the firm">CGPA: Yes <span aria-hidden="true">😢</span></span>`); else if (j.cgpa_required === "No") f.push(`<span class="tag cg no" data-k="cgpa" title="Your CGPA is not shared with the firm">CGPA: No <span aria-hidden="true">🎉</span></span>`);
    return f.join("");
  }
  function firmQs(o, name, pid) {
    const fq = (o.qa || []).filter(e => e.company === name && e.status !== "unanswered");
    if (!fq.length) return {
      btn: "",
      panel: ""
    };
    return {
      btn: `<button type="button" class="btn light qbtn" aria-expanded="false" aria-controls="${pid}">${fq.length} question${fq.length === 1 ? "" : "s"}</button>`,
      panel: `<div class="jdpanel qpanel" id="${pid}" hidden><span class="lbl">Answered in the group · CAC/CAS only</span>${fq.map(e => `<div class="qi"><b>${esc(e.question)}</b><p>${e.source === "CAS" ? `<span class="tagc cas">CAS</span>` : `<span class="tagc">CAC</span>`}${esc(e.answer)}</p>${e.changed_previous ? `<p class="ch">Earlier answer changed by ${esc(e.changed_by || "the CAC")}${e.changed_on ? " on " + fmtDate(e.changed_on) : ""}.</p>` : ""}</div>`).join("")}</div>`
    };
  }
  function roleBody(j, now, o, uid) {
    const d = deadlineOf(j), closed = isClosedJob(j, now), sn = shortOf(j), id = esc(j.application_id);
    const flex = j.exp_min_flexible === "Flexible" || j.exp_max_flexible === "Flexible" ? " (flexible)" : "";
    const exp = j.exp_min || j.exp_max ? `${j.exp_min}–${j.exp_max}${flex}` : "";
    const link = /^https?:\/\//.test(j.company_website_link || "") ? j.company_website_link.split(/\s+/)[0] : "";
    const linkNote = j.company_website_link && (!link || j.company_website_link.includes(";")) ? `<p class="stages">${esc(j.company_website_link)}</p>` : "";
    const nt = ((o.notes || {})[j.application_id] || []).map(x => `<p class="jobnote"><b>From the group${x.source ? " (" + esc(x.source) + ")" : ""}:</b> ${esc(x.what_the_group_said)}${x.status === "pending" ? " · not on the portal yet" : ""}</p>`).join("");
    const facts = [ [ "Deadline", fmtIST(d) + " IST" ], [ "Shortlist by", fmtDate(j.shortlist_expected) ], [ "Interviews", j.interview_mode ], [ "Experience", exp ], [ "Where", j.locations ] ].filter(x => x[1]).map(x => `<span data-k="${x[0]}"><b>${x[0]}</b> ${esc(x[1])}</span>`).join("");
    const jd = String(j.jd_summary || "").trim(), pid = `tbcjc-jd-${uid}-${id}`;
    const jdBtn = jd ? `<button type="button" class="btn light jdbtn" aria-expanded="false" aria-controls="${pid}">JD</button>` : "";
    const jdPanel = jd ? `<div class="jdpanel" id="${pid}" hidden><span class="lbl">Summary of the JD — check the JD</span>${jd.split(/\n+/).map(x => `<p>${esc(x)}</p>`).join("")}\n        <p class="src">From: ${esc(j.jd_sources || "the portal")}. Full JD: <a href="${esc(portalJob(j))}" target="_blank" rel="noopener">on the placement portal ↗</a>${link ? ` · <a href="${esc(link)}" target="_blank" rel="noopener">firm's own page ↗</a>` : ""}</p></div>` : "";
    const qB = o.qa ? firmQs(o, sn, `tbcjc-q-${uid}-${id}`) : {
      btn: "",
      panel: ""
    };
    const slot = o.slot ? o.slot(j) || "" : "";
    return `<p class="r2">${facts}</p>\n      ${stagesLine(shortStages(j.stages))}\n      ${linkNote}${nt}\n      <div class="btns">${closed ? "" : `<a class="btn" href="${esc(portalJob(j))}" target="_blank" rel="noopener" data-portal="${esc(sn)}" title="Apply on the ISB placement portal">Apply<span class="wide"> on portal</span> ↗</a>`}${link && !closed ? `<a class="btn light" href="${esc(link)}" target="_blank" rel="noopener" data-co="${esc(sn)}"><span class="wide">Company </span>site ↗</a>` : ""}${qB.btn}${jdBtn}</div>\n      ${jdPanel}${qB.panel}<div class="slot">${slot}</div>`;
  }
  let UID = 0;
  function firmCard(js, o) {
    o = o || {};
    const now = o.now || new Date, uid = ++UID;
    const a = js[0], sn = shortOf(a), many = js.length > 1, n = CLN(a.cluster);
    const openN = js.filter(j => !isClosedJob(j, now)).length;
    const hid = i => i ? " hidden" : "";
    const badge = a.cluster ? `<span class="tip icon" tabindex="0" data-tip="${esc(a.cluster + (CL_NAME[n] ? ": " + CL_NAME[n] : ""))}"><span class="cl ${clClass(a.cluster)}" title="${esc(a.cluster)}">C${esc(n || "?")}</span></span>` : "";
    const roles = many ? `<span class="rseglbl">${openN > 1 ? counterNote(a, openN) : js.length + " roles"}</span><span class="rseg" role="tablist" aria-label="Roles at ${esc(sn)}">${js.map((j, i) => `<button type="button" class="rp" role="tab" data-rp="${esc(j.application_id)}" aria-selected="${!i}">${esc(j.role)}</button>`).join("")}</span>` : `<span class="role1">${esc(a.role)}</span>`;
    const planes = js.map((j, i) => isIntl(j) ? `<span class="rplane" data-role="${esc(j.application_id)}"${hid(i)}>${planeMark(j)}</span>` : "").join("");
    const chips = js.map((j, i) => {
      const c = roleChips(j);
      return c ? `<span class="rchips" data-role="${esc(j.application_id)}"${hid(i)}>${c}</span>` : "";
    }).join("");
    const lefts = js.map((j, i) => `<span data-role="${esc(j.application_id)}"${hid(i)}><span data-k="left" class="left${isClosedJob(j, now) ? "" : " " + tierOf(deadlineOf(j) - now)}"${isClosedJob(j, now) ? "" : ` data-dl="${+deadlineOf(j)}"`}>${isClosedJob(j, now) ? "Closed" : leftCompact(deadlineOf(j) - now)}</span></span>`).join("");
    const soonest = js.filter(j => !isClosedJob(j, now)).sort((x, y) => deadlineOf(x) - deadlineOf(y))[0];
    const cardTier = soonest ? tierOf(deadlineOf(soonest) - now) : "";
    const bodies = js.map((j, i) => `<div class="rbody" data-role="${esc(j.application_id)}"${hid(i)}>${roleBody(j, now, o, uid)}</div>`).join("");
    const cardSlot = o.cardSlot ? o.cardSlot(js) || "" : "";
    return `<article class="jc${!openN ? " closed" : cardTier ? " " + cardTier : ""}" data-firm="${esc(sn)}" data-jobs="${js.map(j => esc(j.application_id)).join(" ")}"${soonest ? ` data-next="${+deadlineOf(soonest)}"` : ""}>\n      <div class="r1"><div class="nm">${badge}<h3>${esc(sn)}</h3>${js.some(j => j.blue_tag === "Yes") ? BLUE : ""}${planes}${many ? "" : roles}</div><div class="rt">${chips}${lefts}</div></div>\n      ${many ? `<div class="rrow">${roles}</div>` : ""}${chips ? `<div class="chipsm">${chips}</div>` : ""}<div class="cardslot">${cardSlot}</div>\n      ${bodies}\n    </article>`;
  }
  function pickRole(card, id, byHand) {
    const was = card.dataset.jd === "1";
    const prev = byHand && card.querySelector(".rp[aria-selected=true]"), prevId = prev && prev.dataset.rp;
    const snap = el => {
      const m = {};
      if (el) el.querySelectorAll("[data-k]").forEach(x => {
        m[x.dataset.k] = x.textContent.trim();
      });
      return m;
    };
    const before = prevId && prevId !== id ? {} : null;
    if (before) card.querySelectorAll(`[data-role="${prevId}"]`).forEach(el => Object.assign(before, snap(el)));
    card.querySelectorAll("[data-role]").forEach(x => {
      x.hidden = x.dataset.role !== id;
    });
    card.querySelectorAll(".rp").forEach(x => x.setAttribute("aria-selected", String(x.dataset.rp === id)));
    const b = card.querySelector(`.rbody[data-role="${id}"]`);
    const jb = b && b.querySelector(".jdbtn"), jp = b && b.querySelector(".jdpanel:not(.qpanel)");
    if (jb && jp) {
      jp.hidden = !was;
      jb.setAttribute("aria-expanded", String(was));
    }
    if (before) card.querySelectorAll(`[data-role="${id}"] [data-k]`).forEach(x => {
      if (before[x.dataset.k] === x.textContent.trim()) return;
      x.classList.remove("chg");
      void x.offsetWidth;
      x.classList.add("chg");
      setTimeout(() => x.classList.remove("chg"), 1700);
    });
  }
  function placeTip(el) {
    const r = el.getBoundingClientRect(), w = Math.min(260, innerWidth * .72);
    el.style.setProperty("--tx", Math.min(0, innerWidth - 12 - r.left - w) + "px");
  }
  function bind(root, onEvent) {
    if (root.__tbcjc) return;
    root.__tbcjc = true;
    const fire = (n, d) => {
      try {
        onEvent && onEvent(n, d);
      } catch {}
    };
    const firmOf = el => (el.closest(".jc") || {}).dataset ? el.closest(".jc").dataset.firm : "";
    root.addEventListener("click", e => {
      const qb = e.target.closest(".qbtn");
      if (qb) {
        const card = qb.closest(".jc"), body = qb.closest(".rbody") || card, pnl = root.querySelector("#" + CSS.escape(qb.getAttribute("aria-controls"))), open = pnl.hidden;
        body.querySelectorAll(".jdpanel").forEach(x => x.hidden = true);
        body.querySelectorAll(".jdbtn,.qbtn").forEach(x => x.setAttribute("aria-expanded", "false"));
        card.dataset.jd = "";
        pnl.hidden = !open;
        qb.setAttribute("aria-expanded", String(open));
        if (open) fire("firm_questions", {
          firm: firmOf(qb)
        });
        return;
      }
      const jb = e.target.closest(".jdbtn");
      if (jb) {
        const bq = jb.closest(".rbody") || jb.closest(".jc");
        bq.querySelectorAll(".qpanel").forEach(x => x.hidden = true);
        bq.querySelectorAll(".qbtn").forEach(x => x.setAttribute("aria-expanded", "false"));
        const pnl = root.querySelector("#" + CSS.escape(jb.getAttribute("aria-controls")));
        pnl.hidden = !pnl.hidden;
        jb.setAttribute("aria-expanded", String(!pnl.hidden));
        jb.closest(".jc").dataset.jd = pnl.hidden ? "" : "1";
        if (!pnl.hidden) fire("jd_open", {
          firm: firmOf(jb)
        });
        return;
      }
      const rp = e.target.closest(".rp[data-rp]");
      if (rp) {
        pickRole(rp.closest(".jc"), rp.dataset.rp, true);
        fire("role_pick", {
          firm: firmOf(rp),
          id: rp.dataset.rp
        });
        return;
      }
      const tp = e.target.closest(".tip");
      root.querySelectorAll(".tip.open").forEach(x => {
        if (x !== tp) x.classList.remove("open");
      });
      if (tp) {
        placeTip(tp);
        tp.classList.toggle("open");
        return;
      }
      const po = e.target.closest("a[data-portal]");
      if (po) fire("apply_portal", {
        firm: po.dataset.portal,
        href: po.href
      });
      const co = e.target.closest("a[data-co]");
      if (co) fire("job_link", {
        firm: co.dataset.co,
        href: co.href
      });
    });
    root.addEventListener("pointerover", e => {
      const t = e.target.closest && e.target.closest(".tip");
      if (t) placeTip(t);
    });
    root.addEventListener("focusin", e => {
      const t = e.target.closest && e.target.closest(".tip");
      if (t) placeTip(t);
    });
  }
  function render(root, firms, o) {
    root.classList.add("tbcjc");
    root.innerHTML = firms.map(js => firmCard(js, o)).join("");
    bind(root, o && o.onEvent);
    return firms.length;
  }
  function tick(root, now) {
    now = now || new Date;
    root.querySelectorAll(".jc .left[data-dl]").forEach(x => {
      const ms = +x.dataset.dl - now;
      x.classList.remove("t12", "t24");
      const t = tierOf(ms);
      if (t) x.classList.add(t);
      x.textContent = leftCompact(ms);
    });
    root.querySelectorAll(".jc[data-next]").forEach(c => {
      c.classList.remove("t12", "t24");
      const t = tierOf(+c.dataset.next - now);
      if (t) c.classList.add(t);
    });
  }
  window.TBCJobCard = {
    version: "1.0",
    parseGviz: parseGviz,
    groupFirms: groupFirms,
    firmCard: firmCard,
    render: render,
    bind: bind,
    tick: tick,
    pickRole: pickRole,
    util: {
      esc: esc,
      shortOf: shortOf,
      deadlineOf: deadlineOf,
      isClosedJob: isClosedJob,
      portalJob: portalJob,
      fmtIST: fmtIST,
      fmtDate: fmtDate,
      workOf: workOf,
      isIntl: isIntl,
      leftCompact: leftCompact,
      tierOf: tierOf
    }
  };
})();