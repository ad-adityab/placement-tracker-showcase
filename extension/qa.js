(() => {
  if (window.__ptQaLoaded) return;
  window.__ptQaLoaded = true;
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({
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
  let st = null, open = false, q = "", firm = "", chip = "", toastT = 0, searchT = 0;
  const rows = () => (st && st.qa || {}).rows || [];
  const cfg = () => Object.assign({}, PT.CONFIG_DEFAULTS, st && st.config || {});
  const dShort = k => /^\d{4}-\d{2}-\d{2}/.test(k || "") ? new Date(k.slice(0, 10) + "T12:00:00+05:30").toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata"
  }) : "";
  const timesTxt = n => n >= 3 ? `asked ${n} times` : n === 2 ? "asked twice" : "";
  function myFirms() {
    const snap = st && st.snapshot || {}, out = [];
    (snap.apps || []).filter(a => ![ 3, 4, 5 ].includes(a.statusCode)).forEach(a => out.push(a.company));
    const seen = new Set;
    return out.filter(c => {
      const k = PT.shortFirm(c).toLowerCase();
      if (!c || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }
  const applied = c => (st && st.snapshot && st.snapshot.apps || []).some(a => PT.qaSameFirm(a.company, c));
  const forFirm = (name, all) => (all || rows()).filter(e => e.status !== "unanswered" && PT.qaSameFirm(PT.qaFirmOf(e), name));
  window.__ptQaCount = name => forFirm(name).length;
  function qaHtml(e, isNew) {
    const src = /cas/i.test(e.source || "") ? "cas" : /pol/i.test(e.source || "") ? "pol" : "cac";
    const srcTxt = src === "pol" ? "Placement Policy" : src.toUpperCase();
    const t = timesTxt(e.times_asked || 0);
    const meta = e.status === "unanswered" ? `<span class="qwait">Not answered yet</span>${e.asked_on ? ` · asked ${esc(dShort(e.asked_on))}` : ""}` : `<span class="qsrc ${src}">${esc(srcTxt)}</span>${e.answered_on ? esc(dShort(e.answered_on)) : ""}${t ? ` · <b>${esc(t)}</b>` : ""}${isNew ? `<i class="qnew" title="New since you last looked"></i>` : ""}`;
    return `<div class="qa${e.status === "unanswered" ? " un" : ""}"><div class="qq">${esc(e.question)}</div>${e.answer ? `<div class="qan">${esc(e.answer)}</div>` : ""}\n      <div class="qm">${meta}</div>${e.changed_previous ? `<div class="qchg">Answer changed${e.changed_on ? " " + esc(dShort(e.changed_on)) : ""} · was “${esc(e.changed_previous)}”</div>` : ""}</div>`;
  }
  const byDate = (a, b) => String(b.changed_on || b.answered_on || b.asked_on || "").localeCompare(String(a.changed_on || a.answered_on || a.asked_on || ""));
  function grouped(list, fresh, head) {
    const groups = new Map;
    for (const e of list) {
      const k = PT.qaFirmOf(e) || "Rules & process";
      const g = [ ...groups.keys() ].find(x => x !== "Rules & process" && k !== "Rules & process" && PT.qaSameFirm(x, k)) || k;
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(e);
    }
    return [ ...groups.entries() ].map(([g, es]) => `<div class="qfirm">${esc(g === "Rules & process" ? g : PT.shortFirm(g))}<span>${head ? head(g, es) : es.length + (es.length === 1 ? " question" : " questions")}</span></div>${es.sort(byDate).map(e => qaHtml(e, fresh.has(e))).join("")}`).join("");
  }
  function askHtml(text, title, sub) {
    const g = cfg().ask_group_name;
    return `<div class="qmiss"><b>${esc(title)}</b><span>${esc(sub)}</span>\n      <button type="button" class="qask" data-qask="1">Ask in the group ↗</button>\n      <div class="qhow"><span>① your question is typed</span><span>② search <b>${esc(g)}</b></span><span>③ send</span></div></div>`;
  }
  function bodyHtml() {
    const all = rows(), fresh = new Set(PT.qaNew(all, st.qaKnownShown || st.qaKnown));
    if (!all.length) return `<div class="qempty">Answers are loading…</div>`;
    if (firm) {
      const es = forFirm(firm, all);
      return es.length ? grouped(es, fresh, (g, xs) => xs.length + (xs.length === 1 ? " question" : " questions")) + askHtml(firm, "Didn't find yours?", "Ask the group; CAC or CAS usually answer there.") : askHtml(firm, "No answers for " + PT.shortFirm(firm) + " yet", "Ask in the group and CAC or CAS can answer it.");
    }
    if (q.trim()) {
      const r = PT.qaSearch(all, q);
      if (r.hits.length) return grouped(r.hits.slice(0, 40), fresh) + askHtml(q, "Not what you meant?", "Ask the group with your question typed in.");
      return askHtml(q, "Not answered yet", "Nothing from CAC or CAS matches this question.") + (r.close.length ? `<div class="qfirm">Closest we have</div>${r.close.map(e => qaHtml(e, false)).join("")}` : "");
    }
    const c = curChip(all);
    let list = [];
    if (c === "mine") {
      const fs = myFirms();
      list = all.filter(e => e.status !== "unanswered" && fs.some(f => PT.qaSameFirm(PT.qaFirmOf(e), f)));
    } else if (c === "rules") list = all.filter(e => e.status !== "unanswered" && !PT.qaFirmOf(e)); else if (c === "changed") list = all.filter(e => e.changed_previous); else if (c === "un") list = all.filter(e => e.status === "unanswered");
    if (!list.length) return `<div class="qempty">${c === "mine" ? "No answers yet for the firms you applied to." : c === "un" ? "Nothing waiting for an answer." : "Nothing here yet."}</div>`;
    return c === "mine" ? grouped(list, fresh, (g, xs) => (applied(g) ? "you applied · " : "") + xs.length) : grouped(list, fresh);
  }
  function curChip(all) {
    if (chip) return chip;
    const fs = myFirms();
    return all.some(e => e.status !== "unanswered" && fs.some(f => PT.qaSameFirm(PT.qaFirmOf(e), f))) ? "mine" : "rules";
  }
  function panelHtml() {
    const all = rows(), c = q.trim() || firm ? "" : curChip(all), n = k => k === "un" ? all.filter(e => e.status === "unanswered").length : k === "changed" ? all.filter(e => e.changed_previous).length : 0;
    const ch = [ [ "mine", "Your firms" ], [ "rules", "Rules & process" ], [ "changed", "Changed" ], [ "un", "Unanswered" ] ].map(([k, w]) => `<button type="button" class="qchip${c === k ? " on" : ""}" data-qchip="${k}">${esc(w)}${n(k) ? ` <em>${n(k)}</em>` : ""}</button>`).join("");
    const fresh = PT.qaNew(all, st.qaKnownShown || st.qaKnown).length, at = st.qaAt;
    const asOf = at ? new Date(at).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata"
    }) : "";
    return `<div class="qhd"><b>🗨 Q&amp;A<small>CAC / CAS answers from the placement group, via The 40L Question</small></b><button type="button" class="qx" data-qclose="1" aria-label="Close">✕</button></div>\n      <div class="qsearch"><span>🔍</span><input type="search" id="pt-qinput" placeholder="Search: cover letter, counters, GPA…" value="${esc(firm ? PT.shortFirm(firm) : q)}" autocomplete="off" aria-label="Search the group's answers">${q || firm ? `<button type="button" class="qclr" data-qclear="1" aria-label="Clear the search">✕</button>` : ""}</div>\n      <div class="qchips">${ch}</div><div class="qbody">${bodyHtml()}</div>\n      <div class="qfoot">${asOf ? "Answers as of " + esc(asOf) : ""}${fresh ? ` · new since you last looked: ${fresh}` : ""}</div>`;
  }
  const headerBottom = () => {
    const h = document.querySelector(".alain-default__header, .ant-layout-header, header");
    return h && getComputedStyle(h).position === "fixed" ? Math.max(0, h.getBoundingClientRect().bottom) : 0;
  };
  function draw(keepInput) {
    let pn = document.getElementById("pt-qpanel");
    const tab = document.querySelector("#pt-edge [data-qa]");
    if (tab) tab.classList.toggle("on", open);
    if (!open) {
      if (pn) pn.remove();
      return;
    }
    if (!pn) {
      pn = document.createElement("aside");
      pn.id = "pt-qpanel";
      pn.setAttribute("aria-label", "Answers from the placement group");
      document.body.appendChild(pn);
    }
    const top = headerBottom();
    pn.style.top = top + "px";
    pn.style.height = `calc(100vh - ${top}px)`;
    if (keepInput && pn.querySelector("#pt-qinput")) {
      pn.dataset.html = "";
      const tmp = document.createElement("div");
      tmp.innerHTML = panelHtml();
      [ "qchips", "qbody", "qfoot" ].forEach(k => {
        const a = pn.querySelector("." + k), b = tmp.querySelector("." + k);
        if (a && b && a.innerHTML !== b.innerHTML) a.innerHTML = b.innerHTML;
      });
      const clr = pn.querySelector(".qclr"), want = !!(q || firm);
      if (want && !clr) pn.querySelector(".qsearch").insertAdjacentHTML("beforeend", `<button type="button" class="qclr" data-qclear="1" aria-label="Clear the search">✕</button>`); else if (!want && clr) clr.remove();
      return;
    }
    const h = panelHtml();
    if (pn.dataset.html !== h) {
      pn.innerHTML = h;
      pn.dataset.html = h;
    }
  }
  function openPanel(opts) {
    if (!open) {
      document.dispatchEvent(new CustomEvent("pt-panel", {
        detail: "qa"
      }));
      st.qaKnownShown = Array.isArray(st.qaKnown) ? st.qaKnown.slice() : null;
      chrome.storage.local.set({
        qaKnown: rows().map(PT.qaKey)
      }).catch(() => {});
    }
    open = true;
    firm = opts && opts.firm || "";
    q = "";
    chip = "";
    if (!rows().length) chrome.runtime.sendMessage({
      type: "PT_QA_NOW"
    }).catch(() => {});
    draw();
    count(firm ? "pt_qa_card" : "pt_qa_open", opts && opts.where);
    const inp = document.getElementById("pt-qinput");
    if (inp && !firm) inp.focus({
      preventScroll: true
    });
  }
  function close() {
    open = false;
    firm = "";
    q = "";
    st.qaKnownShown = null;
    draw();
  }
  function ask() {
    const text = firm ? `Question about ${PT.shortFirm(firm)}: ` : q.trim(), g = cfg().ask_group_name;
    let copied = false;
    try {
      const ta = document.createElement("textarea");
      ta.value = g;
      ta.style.cssText = "position:fixed;left:-9999px";
      document.body.appendChild(ta);
      ta.select();
      copied = document.execCommand("copy");
      ta.remove();
    } catch (e) {}
    if (!copied && navigator.clipboard) navigator.clipboard.writeText(g).catch(() => {});
    window.open(PT.askLink(text), "_blank", "noopener");
    count("pt_qa_ask");
    const old = document.getElementById("pt-qtoast");
    if (old) old.remove();
    const t = document.createElement("div");
    t.id = "pt-qtoast";
    t.setAttribute("role", "status");
    t.innerHTML = `<b>WhatsApp is opening with your question typed</b><span>Pick this group from your chats and press send:</span><span class="grp">🔍 ${esc(g)}</span><small>${copied ? "Group name copied, paste it in WhatsApp's search" : "Search for it in WhatsApp"}</small>`;
    document.body.appendChild(t);
    clearTimeout(toastT);
    toastT = setTimeout(() => {
      t.classList.add("out");
      setTimeout(() => t.remove(), 400);
    }, 6500);
  }
  document.addEventListener("click", e => {
    const tab = e.target.closest("#pt-edge [data-qa]");
    if (tab) {
      e.preventDefault();
      if (open) close(); else openPanel({
        where: "tab"
      });
      return;
    }
    const ab = e.target.closest("[data-qaskfirm]");
    if (ab) {
      e.preventDefault();
      e.stopPropagation();
      const f0 = firm;
      firm = ab.dataset.qaskfirm;
      ask();
      firm = f0;
      return;
    }
    const cb = e.target.closest("[data-qfirm]");
    if (cb) {
      e.preventDefault();
      e.stopPropagation();
      openPanel({
        firm: cb.dataset.qfirm,
        where: cb.dataset.qwhere || "card"
      });
      return;
    }
    if (!e.target.closest("#pt-qpanel")) return;
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.qclose) {
      close();
      return;
    }
    if (b.dataset.qclear) {
      firm = "";
      q = "";
      draw();
      const inp = document.getElementById("pt-qinput");
      if (inp) {
        inp.value = "";
        inp.focus();
      }
      return;
    }
    if (b.dataset.qchip) {
      chip = b.dataset.qchip;
      firm = "";
      q = "";
      draw();
      return;
    }
    if (b.dataset.qask) {
      ask();
      return;
    }
  }, true);
  document.addEventListener("input", e => {
    if (e.target.id !== "pt-qinput") return;
    q = e.target.value;
    firm = "";
    draw(true);
    clearTimeout(searchT);
    if (q.trim().length > 2) searchT = setTimeout(() => count("pt_qa_search"), 1500);
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && open && !document.getElementById("pt-tour")) {
      close();
    }
  });
  document.addEventListener("pt-panel", e => {
    if (e.detail !== "qa" && open) close();
  });
  window.__ptQaOpen = openPanel;
  chrome.storage.onChanged.addListener((ch, area) => {
    if (area !== "local" || !st) return;
    const shown = st.qaKnownShown;
    Object.keys(ch).forEach(k => {
      st[k] = ch[k].newValue;
    });
    st.qaKnownShown = shown;
    if (open && (ch.qa || ch.snapshot || ch.config)) draw(true);
  });
  chrome.storage.local.get(null).then(v => {
    st = v;
    draw();
  });
})();