(() => {
  if (window.__ptFormLoaded) return;
  window.__ptFormLoaded = true;
  if (!PT.FEATURES.formFill) return;
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;"
  }[c]));
  const onApplyPage = () => /application-details\/[0-9a-f-]{36}/i.test(location.hash || "");
  const count = (name, params) => {
    try {
      chrome.runtime.sendMessage({
        type: "PT_COUNT",
        name: name,
        params: params
      }).catch(() => {});
    } catch (e) {}
  };
  let S = {
    ffAnswers: {},
    ffOn: true,
    ffTip: false,
    ffNote: false,
    ffProfile: null,
    ffProfileEdits: {},
    details: {}
  };
  const store = () => chrome.storage.local.get([ "ffAnswers", "ffOn", "ffTip", "ffNote", "ffProfile", "ffProfileEdits", "details" ]).then(x => {
    S = {
      ffAnswers: x.ffAnswers || {},
      ffOn: x.ffOn !== false,
      ffTip: !!x.ffTip,
      ffNote: !!x.ffNote,
      ffProfile: x.ffProfile || null,
      ffProfileEdits: x.ffProfileEdits || {},
      details: x.details || {}
    };
  });
  const CGPA_Q = /share\s+(?:the\s+|your\s+)?cgpa|cgpa\s+with\s+the\s+recruiter/i;
  const isCgpa = f => f.kind === "choice" && f.cgpa === true;
  function cgpaBox(el) {
    const own = el.closest("nz-form-item, .ant-form-item");
    if (own) {
      const t = String(own.innerText || "");
      if (CGPA_Q.test(t)) return t.match(/(?:^|\s)\*?\s*Q\s*\d+\s*[.):-]\s*\S/) ? null : own;
    }
    for (let n = el.parentElement, i = 0; n && i < 9; n = n.parentElement, i++) {
      const t = String(n.innerText || "");
      if (CGPA_Q.test(t)) return t.match(/(?:^|\s)\*?\s*Q\s*\d+\s*[.):-]\s*\S/) ? null : n;
    }
    return null;
  }
  const cgpaFlag = id => {
    const d = id && (S.details[id] || S.details[String(id).toLowerCase()]);
    const v = String(d && d.cgpa || "").trim().toLowerCase();
    return v === "yes" ? "yes" : v === "no" ? "no" : "";
  };
  chrome.storage.onChanged.addListener((ch, area) => {
    if (area !== "local") return;
    if (ch.details) {
      S.details = ch.details.newValue || {};
      if (current && current.cg) {
        const m = cgpaFlag(current.id);
        if (m !== current.cgMode) {
          current.cgMode = m;
          if (m === "yes" && !valueOf(current.cg) && S.ffOn) {
            const yes = current.cg.opts.find(o => /^\s*yes\b/i.test(o.text));
            if (yes) clickOpt(yes);
          }
          tint();
        }
      }
    }
    if (ch.ffProfile && ch.ffProfile.newValue && !ch.ffProfile.newValue.at) {
      profTried = 0;
      store().then(() => {
        if (S.ffOn) loadProfile();
      });
    }
    if (ch.ffAnswers || ch.ffOn || ch.ffTip || ch.ffNote || ch.ffProfile || ch.ffProfileEdits) store().then(() => {
      if (panelOpen) drawPanel();
      drawBar();
    });
  });
  let profTried = 0;
  async function loadProfile() {
    const p = S.ffProfile;
    if (p && (p.cleared || Date.now() - (p.at || 0) < 864e5)) return;
    if (Date.now() - profTried < 10 * 6e4) return;
    profTried = Date.now();
    try {
      const jwt = JSON.parse(localStorage.getItem("_token") || "{}").token;
      if (!jwt) return;
      const h = {
        Accept: "application/json",
        "x-access-token": jwt,
        token: jwt,
        Authorization: "Bearer " + jwt
      };
      const get = u => fetch("/ssms/api/" + u, {
        headers: h
      }).then(r => r.ok ? r.json() : null).catch(() => null);
      const [pre, contact] = await Promise.all([ get("sk-form-templates/form-type/with-template/1"), get("sk-form-templates/find-all-form-data-with-deadline/2") ]);
      if (!pre && !contact) return;
      const list = PT.wlProfile(pre, contact);
      if (!list.length) return;
      await chrome.storage.local.set({
        ffProfile: {
          at: Date.now(),
          list: list
        }
      });
      await store();
      fillMore();
    } catch (e) {}
  }
  const profVal = id => {
    if (!id) return "";
    const e = S.ffProfileEdits || {};
    if (id in e) return e[id];
    const x = ((S.ffProfile || {}).list || []).find(y => y.id === id);
    return x ? x.v : "";
  };
  const answerFor = f => S.ffAnswers[f.key] ? {
    a: S.ffAnswers[f.key].a,
    src: "saved"
  } : (v => v ? {
    a: v,
    src: "profile"
  } : null)(profVal(PT.profileField(f.label)));
  const QRE = /(?:^|\s)\*?\s*Q\s*\d+\s*[.):-]\s*\S/g;
  const ROW = "nz-form-item, .ant-form-item";
  function ownLabel(el) {
    const row = el.closest(ROW);
    if (!row) return null;
    const rowsInside = row.querySelectorAll(ROW).length;
    if (rowsInside) return null;
    const lab = row.querySelector("nz-form-label, .ant-form-item-label");
    if (!lab) return null;
    const t = String(lab.innerText || lab.textContent || "").trim().split("\n")[0].trim();
    if (t.length < 2 || [ ...t.matchAll(QRE) ].length > 1) return null;
    return {
      box: row,
      label: t
    };
  }
  function questionOf(el) {
    const own = ownLabel(el);
    if (own) return own;
    for (let n = el.parentElement, i = 0; n && i < 9; n = n.parentElement, i++) {
      const t = String(n.innerText || ""), hits = [ ...t.matchAll(QRE) ];
      if (hits.length === 1) {
        const texts = n.querySelectorAll("textarea, input[type=text], input[type=number], input[type=email], input[type=tel]").length, choices = n.querySelectorAll("input[type=checkbox], input[type=radio]").length;
        if (texts > 1 || texts && choices) return null;
        return {
          box: n,
          label: t.slice(hits[0].index).trim().split("\n")[0].trim()
        };
      }
      if (hits.length > 1) return null;
    }
    return null;
  }
  const activeTab = () => {
    const t = document.querySelector('.ant-tabs-tab-active, .ant-tabs-tab.ant-tabs-tab-active, [role="tab"][aria-selected="true"]');
    return t ? String(t.textContent || "").replace(/\s+/g, " ").trim().slice(0, 60) : "";
  };
  const onTasksTab = () => /assess?ment released/i.test(activeTab());
  const HIDDEN_PANE = '.ant-tabs-tabpane-hidden, .ant-tabs-tabpane[aria-hidden="true"], [role="tabpanel"][aria-hidden="true"], [hidden]';
  const selText = el => {
    const x = el.querySelector(".ant-select-selection-item");
    return x ? String(x.getAttribute("title") || x.textContent || "").trim() : "";
  };
  function pickSelect(f, v) {
    const want = String(v || "").trim().toLowerCase();
    if (!want) return false;
    if (f.busy) return true;
    f.busy = true;
    const box = f.el.querySelector(".ant-select-selector") || f.el;
    selfEdit++;
    try {
      box.dispatchEvent(new MouseEvent("mousedown", {
        bubbles: true
      }));
      box.click();
    } finally {
      selfEdit--;
    }
    let tries = 0;
    const t = setInterval(() => {
      const opts = [ ...document.querySelectorAll(".ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option, nz-option-item") ];
      const o = opts.find(x => String(x.getAttribute("title") || x.textContent || "").trim().toLowerCase() === want);
      if (o || ++tries > 10) {
        clearInterval(t);
        f.busy = false;
        selfEdit++;
        try {
          if (o) o.click(); else document.body.dispatchEvent(new MouseEvent("mousedown", {
            bubbles: true
          }));
        } finally {
          selfEdit--;
        }
        if (o) setTimeout(tint, 50);
      }
    }, 60);
    return true;
  }
  const optLabel = inp => {
    const l = inp.closest("label");
    return String((l ? l.innerText : (inp.parentElement && inp.parentElement.parentElement || {}).innerText) || "").trim();
  };
  function scan() {
    const fields = [], byBox = new Map;
    for (const el of document.querySelectorAll("textarea, input[type=text], input[type=number], input[type=email], input[type=tel], input[type=checkbox], input[type=radio]")) {
      if (el.closest("#pt-cool, .pt-ff-bar, nz-select, .ant-select") || el.closest(HIDDEN_PANE) || el.disabled || el.readOnly) continue;
      const cb = el.type === "radio" ? cgpaBox(el) : null;
      if (cb) {
        let f = byBox.get(cb);
        if (!f) {
          f = {
            kind: "choice",
            key: "share cgpa",
            label: "Share CGPA with the recruiter",
            box: cb,
            opts: [],
            cgpa: true
          };
          byBox.set(cb, f);
          fields.push(f);
        }
        f.opts.push({
          el: el,
          text: optLabel(el)
        });
        continue;
      }
      const q = questionOf(el);
      if (!q) continue;
      if (el.type === "checkbox" || el.type === "radio") {
        let f = byBox.get(q.box);
        if (!f) {
          f = {
            kind: "choice",
            key: PT.normQ(q.label),
            label: PT.normQ(q.label) && q.label.replace(/^\s*\*?\s*/, ""),
            box: q.box,
            opts: []
          };
          byBox.set(q.box, f);
          fields.push(f);
        }
        f.opts.push({
          el: el,
          text: optLabel(el)
        });
      } else fields.push({
        kind: "text",
        key: PT.normQ(q.label),
        label: q.label.replace(/^\s*\*?\s*/, ""),
        box: q.box,
        el: el
      });
    }
    for (const el of document.querySelectorAll("nz-select, .ant-select")) {
      if (el.parentElement && el.parentElement.closest("nz-select, .ant-select")) continue;
      if (el.closest("#pt-cool, .pt-ff-bar") || el.closest(HIDDEN_PANE) || el.matches(".ant-select-disabled") || el.querySelector(".ant-select-disabled")) continue;
      const q = ownLabel(el) || questionOf(el);
      if (!q || CGPA_Q.test(q.label) || !new RegExp(QRE.source).test(" " + q.label) || /resume/i.test(el.id || "")) continue;
      fields.push({
        kind: "select",
        key: PT.normQ(q.label),
        label: q.label.replace(/^\s*\*?\s*/, ""),
        box: q.box,
        el: el
      });
    }
    return fields.filter(f => f.key);
  }
  const valueOf = f => f.kind === "text" ? String(f.el.value || "").trim() : f.kind === "select" ? selText(f.el) : f.opts.filter(o => o.el.checked).map(o => o.text).join(", ");
  let selfEdit = 0;
  function setText(el, v) {
    selfEdit++;
    try {
      setText0(el, v);
    } finally {
      selfEdit--;
    }
  }
  function setText0(el, v) {
    const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, v);
    el.dispatchEvent(new Event("input", {
      bubbles: true
    }));
    el.dispatchEvent(new Event("change", {
      bubbles: true
    }));
    el.dispatchEvent(new Event("blur"));
  }
  const clickOpt = o => {
    selfEdit++;
    try {
      const l = o.el.closest("label");
      (l || o.el).click();
    } finally {
      selfEdit--;
    }
  };
  let current = null;
  function fill(force) {
    if (PT.dead) return;
    if (!onApplyPage()) {
      teardown();
      return;
    }
    const id = (/application-details\/([0-9a-f-]{36})/i.exec(location.hash) || [])[1];
    if (current && !force && current.id === id && current.tab === activeTab() && current.fields.every(f => document.contains(f.kind === "choice" ? f.opts[0].el : f.el))) {
      keepFilled();
      const pre = current.filled.length ? -1 : current.fields.filter(f => valueOf(f)).length;
      if (!bar || !document.contains(bar) || pre !== current.pre && !panelOpen) {
        current.pre = pre;
        drawBar();
      }
      return;
    }
    const fields = scan();
    if (!fields.length) {
      if (current) teardown();
      return;
    }
    const tab = activeTab(), sig = id + "|" + tab + "|" + fields.length;
    if (current && current.sig === sig && !force) {
      const cg = fields.find(isCgpa);
      if (cg) fields.splice(fields.indexOf(cg), 1);
      current.cg = cg;
      current.fields = fields;
      refillRedrawn();
      tint();
      drawBar();
      return;
    }
    if (!current || current.id !== id) typed.clear();
    const cg = fields.find(isCgpa);
    if (cg) fields.splice(fields.indexOf(cg), 1);
    current = {
      sig: sig,
      id: id,
      tab: tab,
      tasks: onTasksTab(),
      fields: fields,
      filled: [],
      cg: cg,
      cgMode: cg ? cgpaFlag(id) : ""
    };
    if (cg && current.cgMode === "yes" && !valueOf(cg) && S.ffOn) {
      const yes = cg.opts.find(o => /^\s*yes\b/i.test(o.text));
      if (yes) clickOpt(yes);
    }
    if (S.ffOn) for (const f of fields) {
      const saved = answerFor(f);
      if (!saved || valueOf(f)) continue;
      if (f.kind === "text") {
        setText(f.el, saved.a);
        current.filled.push({
          f: f,
          value: saved.a,
          src: saved.src
        });
      } else if (f.kind === "select") {
        if (pickSelect(f, saved.a)) current.filled.push({
          f: f,
          value: saved.a,
          src: saved.src
        });
      } else {
        const want = String(saved.a).split(/\s*,\s*/).map(x => x.toLowerCase()), hit = f.opts.filter(o => want.includes(o.text.toLowerCase()));
        if (hit.length) {
          hit.forEach(clickOpt);
          current.filled.push({
            f: f,
            value: saved.a,
            src: saved.src
          });
        }
      }
    }
    if (S.ffOn) loadProfile();
    const nf = current.filled.length;
    if (nf) count("pt_form", {
      action: "filled",
      bucket: nf <= 5 ? "1-5" : nf <= 15 ? "6-15" : "16+"
    });
    if (current.cg && current.cgMode) count("pt_form", {
      action: current.cgMode === "yes" ? "cgpa_mandatory" : "cgpa_optional"
    });
    tint();
    drawBar();
  }
  const typed = new Set;
  document.addEventListener("input", e => {
    if (!e.isTrusted || selfEdit || !current) return;
    const f = current.fields.find(x => x.kind === "text" ? x.el === e.target : x.opts.some(o => o.el === e.target));
    if (f) typed.add(f.key);
  }, true);
  document.addEventListener("click", e => {
    if (!e.isTrusted || selfEdit || !current) return;
    const f = current.fields.find(x => x.kind === "choice" && x.opts.some(o => o.el === e.target || o.el.closest("label") && o.el.closest("label").contains(e.target)));
    if (f) typed.add(f.key);
  }, true);
  const putBack = (f, v) => {
    if (f.kind === "text") {
      setText(f.el, v);
      return true;
    }
    if (f.kind === "select") return pickSelect(f, v);
    const want = String(v).split(/\s*,\s*/).map(x => x.toLowerCase()), hit = f.opts.filter(o => want.includes(o.text.toLowerCase()));
    if (hit.length) {
      hit.forEach(clickOpt);
      return true;
    }
    return false;
  };
  function keepFilled() {
    if (!current || current.undone || !S.ffOn) return;
    let n = 0;
    for (const x of current.filled) {
      if (valueOf(x.f) || typed.has(x.f.key) || (x.re || 0) >= 5) continue;
      if (putBack(x.f, x.value)) {
        x.re = (x.re || 0) + 1;
        n++;
      }
    }
    if (n) tint();
  }
  function refillRedrawn() {
    if (current.undone || !S.ffOn) {
      tint();
      return;
    }
    const before = new Map(current.filled.map(x => [ x.f.key, x ]));
    current.filled = [];
    for (const f of current.fields) {
      const old = before.get(f.key);
      if (valueOf(f)) {
        if (old) current.filled.push(Object.assign({}, old, {
          f: f
        }));
        continue;
      }
      if (typed.has(f.key)) continue;
      const v = old ? {
        a: old.value,
        src: old.src
      } : answerFor(f);
      if (!v) continue;
      if (putBack(f, v.a)) current.filled.push({
        f: f,
        value: v.a,
        src: v.src,
        re: old ? (old.re || 0) + 1 : 0
      });
    }
    tint();
  }
  function fillMore() {
    if (!current || !S.ffOn) {
      fill(true);
      return;
    }
    if (current.undone || !onApplyPage()) return;
    const done = new Set(current.filled.map(x => x.f));
    for (const f of current.fields) {
      if (done.has(f) || valueOf(f)) continue;
      const v = answerFor(f);
      if (!v) continue;
      if (f.kind === "text") {
        setText(f.el, v.a);
        current.filled.push({
          f: f,
          value: v.a,
          src: v.src
        });
      } else if (f.kind === "select") {
        if (pickSelect(f, v.a)) current.filled.push({
          f: f,
          value: v.a,
          src: v.src
        });
      } else {
        const want = String(v.a).split(/\s*,\s*/).map(x => x.toLowerCase()), hit = f.opts.filter(o => want.includes(o.text.toLowerCase()));
        if (hit.length) {
          hit.forEach(clickOpt);
          current.filled.push({
            f: f,
            value: v.a,
            src: v.src
          });
        }
      }
    }
    tint();
    drawBar();
  }
  function tint() {
    document.querySelectorAll(".pt-ff-fill, .pt-ff-new").forEach(x => x.classList.remove("pt-ff-fill", "pt-ff-new"));
    document.querySelectorAll(".pt-ff-note").forEach(x => x.remove());
    if (!current) return;
    const filled = new Set(current.filled.map(x => x.f));
    if (S.ffOn) for (const f of current.fields) {
      if (isCgpa(f)) continue;
      const target = f.kind === "text" ? f.el : f.kind === "select" ? f.el : f.opts[0].el.closest("nz-form-control, nz-checkbox-group, .ant-checkbox-group") || f.opts[0].el.parentElement.parentElement;
      if (filled.has(f)) target.classList.add("pt-ff-fill"); else if (!answerFor(f) && !valueOf(f)) {
        target.classList.add("pt-ff-new");
        const n = document.createElement("span");
        n.className = "pt-ff-note";
        n.textContent = "New question: answer it once and it's saved for next time";
        target.insertAdjacentElement("afterend", n);
      }
    }
    const cg = current.cg;
    if (cg && current.cgMode) {
      const target = cg.opts[0].el.closest("nz-form-control, nz-radio-group, .ant-radio-group") || cg.opts[0].el.parentElement.parentElement;
      const n = document.createElement("span");
      n.className = "pt-ff-note pt-ff-cg" + (current.cgMode === "yes" ? " must" : "");
      n.textContent = current.cgMode === "yes" ? "CGPA sharing is mandatory for this job" : "CGPA not mandatory: your choice";
      target.insertAdjacentElement("afterend", n);
    }
  }
  function undo() {
    if (!current) return;
    for (const {f: f, value: value} of current.filled) {
      if (f.kind === "text") {
        if (String(f.el.value) === String(value)) setText(f.el, "");
      } else if (f.kind === "select") {
        const c = f.el.querySelector(".ant-select-clear");
        if (c && selText(f.el).toLowerCase() === String(value).toLowerCase()) {
          selfEdit++;
          try {
            c.dispatchEvent(new MouseEvent("mousedown", {
              bubbles: true
            }));
            c.click();
          } finally {
            selfEdit--;
          }
        }
      } else f.opts.filter(o => o.el.checked).forEach(clickOpt);
    }
    current.filled = [];
    current.undone = true;
    tint();
    drawBar();
  }
  document.addEventListener("input", e => {
    const t = e.target;
    if (t instanceof Element && t.classList.contains("pt-ff-new") && String(t.value || "").trim()) {
      t.classList.remove("pt-ff-new");
      const n = t.nextElementSibling;
      if (n && n.classList.contains("pt-ff-note")) n.remove();
    }
  }, true);
  let bar = null, panelOpen = false;
  function teardown() {
    if (bar) bar.remove();
    bar = null;
    current = null;
    panelOpen = false;
    document.querySelectorAll(".pt-ff-note").forEach(x => x.remove());
  }
  function barAnchor(box) {
    let a = box;
    while (a.parentElement && !a.parentElement.matches("form, .ant-card-body, body")) {
      const cs = getComputedStyle(a.parentElement);
      const sideBySide = /flex/.test(cs.display) && !/column/.test(cs.flexDirection) || /grid/.test(cs.display) || a.parentElement.matches(".ant-row, [nz-row]");
      if (!sideBySide) break;
      a = a.parentElement;
    }
    return a;
  }
  function drawBar() {
    if (!current) return;
    const real = current.fields.filter(f => !isCgpa(f));
    if (!real.length) {
      if (bar) bar.remove();
      bar = null;
      return;
    }
    const first = barAnchor(current.fields[0].box);
    if (!bar || !document.contains(bar)) {
      bar = document.createElement("div");
      bar.className = "pt-ff-bar";
      first.parentElement.insertBefore(bar, first);
      bar.addEventListener("click", onBarClick);
    } else if (bar.nextElementSibling !== first && first.parentElement) first.parentElement.insertBefore(bar, first);
    const n = current.filled.length, m = real.length, saved = Object.keys(S.ffAnswers).length;
    const fset = new Set(current.filled.map(x => x.f)), pre = real.filter(f => !fset.has(f) && valueOf(f)).length;
    const line = !S.ffOn ? `Auto-fill is off. <button type="button" class="pt-ff-link" data-ff="on">Turn it on</button>` : n ? `✓ <b>Filled ${n} of ${m}</b> from ${current.filled.some(x => x.src === "profile") ? current.filled.some(x => x.src === "saved") ? "your saved answers and portal profile" : "your portal profile" : current.tasks ? "your saved answers" : "your last application"} · check them before you submit · <button type="button" class="pt-ff-link" data-ff="undo">Undo</button>` : current.undone ? `Filled answers cleared · <button type="button" class="pt-ff-link" data-ff="refill">Fill again</button>` : pre ? `<b>${pre} of ${m}</b> already filled in by the portal from your last application · the tracker left them as they are · check them before you submit` : saved ? `Nothing here matches your saved answers yet. Fill it once and press Submit; these get saved for next time.` : `Fill this form once and press Submit: the tracker saves your answers on this computer and fills them in next time.`;
    const showTip = S.ffOn && n && !S.ffTip;
    bar.className = "pt-ff-bar" + (n ? " ok" : "");
    bar.innerHTML = `<span class="pt-ff-line">${line}</span>\n      <button type="button" class="pt-ff-fab${showTip ? " pulse" : ""}" data-ff="panel" title="Your saved answers (Placement Tracker)"><i>PT</i>${S.ffOn ? `${n}/${m}` : "off"}</button>\n      ${showTip ? `<div class="pt-ff-tip">Filled from your last application. Click to check or change. <button type="button" class="pt-ff-link" data-ff="tip">Got it</button></div>` : ""}\n      <div class="pt-ff-panel"${panelOpen ? "" : " hidden"}></div>`;
    if (panelOpen) drawPanel();
  }
  let editing = null, confirmClear = false;
  function drawPanel() {
    const p = bar && bar.querySelector(".pt-ff-panel");
    if (!p) return;
    const list = Object.entries(S.ffAnswers).sort((a, b) => String(a[1].q).localeCompare(String(b[1].q), "en", {
      numeric: true
    }));
    p.innerHTML = `<div class="pt-ff-ph"><b>Your saved answers</b><button type="button" class="pt-ff-x" data-ff="close" aria-label="Close">✕</button></div>\n      <label class="pt-ff-row"><span>Fill recruiter forms from saved answers</span><input type="checkbox" data-ff="toggle"${S.ffOn ? " checked" : ""}></label>\n      ${current && current.filled.length ? `<div class="pt-ff-row"><span>${current.filled.length} filled on this form</span><button type="button" class="pt-ff-link" data-ff="undo">Undo fill</button></div>` : ""}\n      <div class="pt-ff-list">${list.length ? list.map(([k, v]) => `<div class="pt-ff-item"><span class="q">${esc(v.q)}</span>${editing === k ? `<input type="text" data-ff-edit="${esc(k)}" value="${esc(v.a)}"><button type="button" class="pt-ff-link" data-ff="save" data-k="${esc(k)}">Save</button>` : `<em>${esc(v.a)}</em><button type="button" class="pt-ff-link" data-ff="edit" data-k="${esc(k)}">Edit</button><button type="button" class="pt-ff-link del" data-ff="del" data-k="${esc(k)}">Delete</button>`}</div>`).join("") : `<div class="pt-ff-empty">Nothing saved yet.</div>`}</div>\n      <div class="pt-ff-pf"><span>On this computer only. Never sent anywhere.</span>${list.length ? confirmClear ? `<span>Clear all? <button type="button" class="pt-ff-link del" data-ff="clear-yes">Yes</button> <button type="button" class="pt-ff-link" data-ff="clear-no">No</button></span>` : `<button type="button" class="pt-ff-link del" data-ff="clear">Clear all</button>` : ""}</div>`;
  }
  async function onBarClick(e) {
    const b = e.target.closest("[data-ff]");
    if (!b) return;
    const a = b.dataset.ff;
    if (a === "toggle") {
      await chrome.storage.local.set({
        ffOn: b.checked
      });
      if (b.checked) fill(true); else {
        undo();
      }
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    if (a === "panel") {
      panelOpen = !panelOpen;
      if (!S.ffTip) await chrome.storage.local.set({
        ffTip: true
      });
      drawBar();
    } else if (a === "close") {
      panelOpen = false;
      drawBar();
    } else if (a === "tip") {
      await chrome.storage.local.set({
        ffTip: true
      });
      drawBar();
    } else if (a === "undo") {
      count("pt_form", {
        action: "undo"
      });
      undo();
    } else if (a === "refill") {
      count("pt_form", {
        action: "fill_again"
      });
      current.undone = false;
      fill(true);
    } else if (a === "on") {
      await chrome.storage.local.set({
        ffOn: true
      });
      await store();
      fill(true);
    } else if (a === "edit") {
      editing = b.dataset.k;
      drawPanel();
    } else if (a === "save") {
      const k = b.dataset.k, inp = bar.querySelector(`[data-ff-edit="${CSS.escape(k)}"]`), all = Object.assign({}, S.ffAnswers);
      if (inp && all[k]) {
        all[k] = Object.assign({}, all[k], {
          a: inp.value.trim().slice(0, 1e3),
          at: Date.now()
        });
        await chrome.storage.local.set({
          ffAnswers: all
        });
      }
      editing = null;
    } else if (a === "del") {
      const all = Object.assign({}, S.ffAnswers);
      delete all[b.dataset.k];
      await chrome.storage.local.set({
        ffAnswers: all
      });
    } else if (a === "clear") {
      confirmClear = true;
      drawPanel();
    } else if (a === "clear-no") {
      confirmClear = false;
      drawPanel();
    } else if (a === "clear-yes") {
      confirmClear = false;
      await chrome.storage.local.set({
        ffAnswers: {}
      });
    }
  }
  function snapshot() {
    if (!S.ffOn || !onApplyPage()) return null;
    const byKey = new Map((current && current.filled || []).map(x => [ x.f.key, x ]));
    return scan().filter(f => !isCgpa(f)).map(f => {
      const was = byKey.get(f.key);
      return {
        key: f.key,
        q: f.label.slice(0, 300),
        a: valueOf(f).slice(0, 1e3),
        pf: was && was.src === "profile" ? was.value : null
      };
    }).filter(x => x.a);
  }
  async function save(items) {
    if (!S.ffOn || !items || !items.length) return;
    await store();
    const all = Object.assign({}, S.ffAnswers), now = Date.now();
    for (const it of items) all[it.key] = {
      q: it.q,
      a: it.a,
      at: now
    };
    const edits = Object.assign({}, S.ffProfileEdits);
    for (const it of items) {
      const id = PT.profileField(it.q);
      if (!id || !it.a) continue;
      if (it.pf != null && it.a !== it.pf || id === "ctc" && !profVal("ctc")) edits[id] = it.a;
    }
    const first = !S.ffNote;
    await chrome.storage.local.set(Object.assign({
      ffAnswers: all,
      ffProfileEdits: edits
    }, first ? {
      ffNote: true
    } : {}));
    if (first) note();
  }
  function note() {
    const n = document.createElement("div");
    n.className = "pt-ff-toast";
    n.innerHTML = `💾 <span><b>Saved.</b> Your answers are kept on this computer to fill your next form. You can turn this off in the tracker's menu.</span><button type="button" class="pt-ff-link">Got it</button>`;
    n.querySelector("button").onclick = () => n.remove();
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 2e4);
  }
  window.PTForm = {
    snapshot: snapshot,
    save: save,
    onTasksTab: onTasksTab
  };
  let jobCache = {}, webDoneN = {};
  chrome.storage.local.get("webDone").then(x => {
    webDoneN = x.webDone || {};
  }).catch(() => {});
  chrome.storage.onChanged.addListener((ch, area) => {
    if (area === "local" && ch.webDone) {
      webDoneN = ch.webDone.newValue || {};
      notes(true);
    }
    if (area === "local" && ch.snapshot) jobCache = {};
  });
  const detailOf = id => id && (S.details[id] || S.details[String(id).toLowerCase()]);
  function jobInfo(id) {
    if (jobCache[id]) return jobCache[id].v;
    jobCache[id] = {
      v: null
    };
    chrome.storage.local.get("snapshot").then(x => {
      const sn = x.snapshot || {};
      const j = [ ...sn.jobs || [], ...sn.apps || [], ...sn.closedJobs || [] ].find(y => y && String(y.id).toLowerCase() === String(id).toLowerCase());
      jobCache[id] = {
        v: j ? {
          company: j.company || "",
          role: j.role || ""
        } : {
          company: "",
          role: ""
        }
      };
      notes(true);
    }).catch(() => {});
    return null;
  }
  const firstCity = s => String(s || "").split(/\s*[,/;|]\s*|\s+and\s+/i).map(x => x.trim()).filter(Boolean)[0] || "";
  function clLabel() {
    const l = document.querySelector("label.cover-letter-label, .cover-letter-label");
    if (l) return l;
    const f = document.querySelector(".cover-letter-field");
    return f || null;
  }
  function submitBtn() {
    return [ ...document.querySelectorAll("button") ].find(b => /^\s*(re)?submit(\s+application)?\s*$/i.test(b.innerText || b.textContent || "") && !b.closest("#pt-cool, .pt-ff-bar, .pt-web") && !b.closest(HIDDEN_PANE)) || null;
  }
  let notesSig = "";
  const w0 = el => {
    const w = el && document.querySelector(".pt-web");
    return w ? String(w.previousElementSibling === (el.parentElement && el.parentElement.children.length <= 3 ? el.parentElement : el)) : "";
  };
  function notes(force) {
    if (PT.dead) return;
    const id = onApplyPage() && (/application-details\/([0-9a-f-]{36})/i.exec(location.hash) || [])[1];
    if (!id) {
      document.querySelectorAll(".pt-cl, .pt-clbox, .pt-web").forEach(x => x.remove());
      notesSig = "";
      return;
    }
    const d = detailOf(id), info = jobInfo(id) || {
      company: "",
      role: ""
    };
    const tk = onTasksTab(), lab = tk ? null : clLabel(), sub = tk ? null : submitBtn();
    const sig = [ id, !!d, d && d.cl, d && d.clTo, d && d.website, !!webDoneN[id], info.company, !!lab, !!sub, !!document.querySelector(".pt-cl"), !!document.querySelector(".pt-web"), w0(sub) ].join("|");
    if (!force && sig === notesSig) return;
    notesSig = sig;
    document.querySelectorAll(".pt-cl").forEach(x => x.remove());
    if (lab && d && typeof d.cl === "boolean") {
      const n = document.createElement("span");
      n.className = "pt-cl" + (d.cl ? " must" : "");
      n.innerHTML = d.cl ? `<span class="pt-clpill">Required for this job${d.clTo ? " · address it to the " + esc(d.clTo) : ""}</span><button type="button" class="pt-clcopy" data-cl-copy="1" title="Copies who to address it to, the firm, the city and the role, to paste at the top of your letter">⧉ Copy details</button>` : `<span class="pt-clpill">Not required for this job</span>`;
      if (lab.matches("label")) lab.insertAdjacentElement("afterend", n); else lab.insertBefore(n, lab.querySelector("input") || null);
      const b = n.querySelector("[data-cl-copy]");
      if (b) b.addEventListener("click", e => {
        e.preventDefault();
        e.stopPropagation();
        copyDetails(id, d, n);
      });
    }
    const want = !!(d && d.website && !webDoneN[id]);
    let w = document.querySelector(".pt-web");
    if (!want || !sub) {
      if (w) w.remove();
      return;
    }
    const sp = sub.parentElement, anchor = sp && sp.children.length <= 3 && !sp.matches("form, .ant-card-body") ? sp : sub, firm = info.company || "This firm";
    if (!w) {
      w = document.createElement("div");
      w.className = "pt-web";
      w.addEventListener("click", onWeb);
    }
    w.dataset.id = id;
    w.innerHTML = `<span class="pt-webline">🌐 <b>Reminder:</b> ${esc(firm)} also takes applications on its website (own deadline, see JD)</span>\n      <span class="pt-webacts">${/^https?:\/\//i.test(d.websiteLink || "") ? `<a class="pt-webbtn" href="${esc(d.websiteLink)}" target="_blank" rel="noopener" data-web="go">Apply there ↗</a>` : ""}<button type="button" class="pt-webbtn" data-web="done">✓ Done</button></span>`;
    if (w.previousElementSibling !== anchor) anchor.insertAdjacentElement("afterend", w);
  }
  async function onWeb(e) {
    const t = e.target.closest("[data-web]");
    if (!t) return;
    const id = this.dataset.id;
    if (t.dataset.web === "go") {
      count("pt_form", {
        action: "web_site"
      });
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    const x = await chrome.storage.local.get("webDone"), webDone = Object.assign({}, x.webDone);
    webDone[id] = Date.now();
    count("pt_form", {
      action: "web_done"
    });
    await chrome.storage.local.set({
      webDone: webDone
    });
  }
  async function copyDetails(id, d, n) {
    const info = jobInfo(id) || {
      company: "",
      role: ""
    };
    const txt = [ d.clTo ? "The " + d.clTo : "", info.company, firstCity(d.locations), "", info.role ? "Re: Application for " + info.role : "" ].filter((x, i, a) => x || i === 3 && a[4]).join("\n").replace(/^\n+/, "");
    let ok = true;
    try {
      await navigator.clipboard.writeText(txt);
    } catch (e) {
      ok = false;
    }
    count("pt_form", {
      action: "cl_copy"
    });
    document.querySelectorAll(".pt-clbox").forEach(x => x.remove());
    const box = document.createElement("div");
    box.className = "pt-clbox";
    box.innerHTML = `<b>${ok ? "✓ Copied. Paste it at the top of your cover letter:" : "Copy this to the top of your cover letter:"}</b><pre>${esc(txt)}</pre><small>From the job's own details. Copied on your computer only; nothing is sent.</small>`;
    n.appendChild(box);
    setTimeout(() => box.remove(), 9e3);
  }
  store().then(() => {
    if (S.ffOn) loadProfile();
    setInterval(() => {
      try {
        fill(false);
      } catch (e) {}
      try {
        notes(false);
      } catch (e) {}
    }, 800);
  });
  window.addEventListener("hashchange", () => {
    teardown();
    notes(true);
  });
})();