(function() {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let gapMs = 0, slowUntil = 0;
  try {
    const pace = c => {
      gapMs = Math.max(0, Math.min(10, Number((c || {}).call_gap_seconds) || 0)) * 1e3;
    };
    chrome.storage.local.get([ "config" ], s => pace(s && s.config));
    chrome.storage.onChanged.addListener((ch, a) => {
      if (a === "local" && ch.config) pace(ch.config.newValue);
    });
  } catch (e) {}
  const slow = () => Date.now() < slowUntil;
  const gap = () => slow() ? sleep(2e3 + Math.random() * 2e3) : gapMs ? sleep(gapMs + Math.random() * gapMs) : Promise.resolve();
  async function pool(items, fn) {
    let i = 0;
    const lane = async () => {
      while (i < items.length) {
        const it = items[i++];
        await gap();
        await fn(it);
      }
    };
    await Promise.all(Array.from({
      length: Math.min(items.length, slow() || gapMs ? 1 : 4)
    }, lane));
  }
  function calBackup() {
    try {
      chrome.storage.local.get([ "gcal", "calBackup" ], s => {
        const mine = s && s.gcal && s.gcal.calId;
        let b = null;
        try {
          b = localStorage.getItem(PT.CAL_KEY);
        } catch (e) {}
        if (mine && PT.CAL_ID_RE.test(mine)) {
          if (mine !== b) try {
            localStorage.setItem(PT.CAL_KEY, mine);
          } catch (e) {}
        } else if (b && PT.CAL_ID_RE.test(b) && b !== s.calBackup) chrome.storage.local.set({
          calBackup: b
        });
      });
      chrome.storage.onChanged.addListener((ch, area) => {
        if (area === "local" && ch.gcal) calBackup.once();
      });
    } catch (e) {}
  }
  calBackup.once = () => {
    try {
      chrome.storage.local.get([ "gcal" ], s => {
        const id = s && s.gcal && s.gcal.calId;
        if (id && PT.CAL_ID_RE.test(id)) try {
          if (localStorage.getItem(PT.CAL_KEY) !== id) localStorage.setItem(PT.CAL_KEY, id);
        } catch (e) {}
      });
    } catch (e) {}
  };
  calBackup();
  try {
    const de = document.documentElement, ids = new Set(String(de.getAttribute("data-pt-copies") || "").split(" ").filter(Boolean));
    ids.add(chrome.runtime.id);
    de.setAttribute("data-pt-copies", [ ...ids ].join(" "));
    setTimeout(() => {
      const n = new Set(String(de.getAttribute("data-pt-copies") || "").split(" ").filter(Boolean)).size;
      send({
        type: "PT_COPIES",
        n: n
      });
    }, 3e3);
  } catch (e) {}
  function session() {
    try {
      const raw = localStorage.getItem("_token");
      if (!raw) return null;
      const jwt = JSON.parse(raw).token;
      if (!jwt) return null;
      const p = JSON.parse(atob(jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
      return {
        exp: p.exp ? p.exp * 1e3 : null,
        headers: () => ({
          Accept: "application/json",
          "Content-Type": "application/json",
          "x-access-token": jwt,
          token: jwt,
          Authorization: "Bearer " + jwt
        })
      };
    } catch (e) {
      return null;
    }
  }
  async function call(method, path, s, body) {
    let r;
    for (let n = 0; ;n++) {
      r = await fetch("/ssms/api/" + path, {
        method: method,
        headers: s.headers(),
        body: body ? JSON.stringify(body) : undefined
      });
      if (!(r.status === 429 || r.status >= 500) || n >= 2) break;
      slowUntil = Date.now() + 5 * 6e4;
      await sleep(3e3 * (n + 1));
    }
    if (r.status === 401 || r.status === 403) throw new Error("auth");
    if (r.status === 400) {
      const t = await r.clone().text().catch(() => "");
      if (/token_expired/i.test(t)) throw new Error("auth");
    }
    if (!r.ok) throw new Error("http " + r.status + " on " + path.split("/")[0]);
    return r.json();
  }
  const send = msg => {
    try {
      chrome.runtime.sendMessage(msg).catch(() => {});
    } catch (e) {}
  };
  const partial = part => send({
    type: "PT_PARTIAL",
    part: part
  });
  async function runCheck(known, knownJobs, maxDetails, subsKnown) {
    const s = session();
    if (!s) {
      send({
        type: "PT_SESSION",
        jwt: null
      });
      return {
        loggedOut: true
      };
    }
    if (s.exp && s.exp < Date.now()) return {
      expired: true,
      loginExp: s.exp
    };
    shareSession();
    return PT.portalRead({
      call: (m, path, body) => call(m, path, s, body),
      partial: partial,
      pool: pool,
      known: known,
      knownJobs: knownJobs,
      maxDetails: maxDetails,
      exp: s.exp,
      subsKnown: subsKnown
    });
  }
  let shared = "";
  function shareSession() {
    let raw = "";
    try {
      raw = localStorage.getItem("_token") || "";
    } catch (e) {}
    const s = raw ? session() : null, jwt = s ? JSON.parse(raw).token : null;
    const key = jwt || "-";
    if (key === shared) return;
    shared = key;
    send({
      type: "PT_SESSION",
      jwt: s && (!s.exp || s.exp > Date.now()) ? jwt : null,
      exp: s ? s.exp : null
    });
  }
  shareSession();
  setInterval(shareSession, 3e4);
  async function openResume(appId, win) {
    const s = session();
    if (!s) throw new Error("not logged in to the portal");
    const all = await call("GET", "sk-student-application-statuses/allApplications", s);
    const a = (Array.isArray(all) ? all : []).find(x => String(x.applicationId).toLowerCase() === String(appId).toLowerCase());
    if (!a) throw new Error("application not found");
    const doc = a.jsonData && a.jsonData.document || {};
    const ids = [ ...new Set([ a.id, a._id, a.applicationStatusId, doc.uuid, doc.id, a.applicationId ].filter(x => /^[0-9a-f-]{36}$/i.test(String(x || "")))) ];
    for (const id of ids) {
      const r = await fetch("/ssms/api/sk-student-application-statuses/download-student-resume/" + encodeURIComponent(id), {
        method: "GET",
        headers: Object.assign(s.headers(), {
          Accept: "*/*"
        })
      });
      if (!r.ok) continue;
      const type = (r.headers.get("content-type") || "").toLowerCase();
      let blob;
      if (/json/.test(type)) {
        const j = await r.json().catch(() => null);
        const b64 = j && Object.values(j.data || j).find(v => typeof v === "string" && v.length > 200 && /^[A-Za-z0-9+/=\s]+$/.test(v.slice(0, 200)));
        if (!b64) continue;
        const bin = atob(b64.replace(/\s/g, "")), u8 = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        blob = new Blob([ u8 ], {
          type: "application/pdf"
        });
      } else blob = new Blob([ await r.arrayBuffer() ], {
        type: type && !/octet/.test(type) ? type : "application/pdf"
      });
      if (!blob.size) continue;
      const url = URL.createObjectURL(blob);
      if (win && !win.closed) win.location.href = url; else window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1e3);
      return true;
    }
    throw new Error("the portal didn't return the resume");
  }
  window.PTPortal = {
    openResume: openResume
  };
  let busy = false;
  chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
    if (!msg || msg.type !== "PT_RUN_CHECK") return;
    if (busy) {
      reply({
        busy: true
      });
      return;
    }
    busy = true;
    reply({
      started: true
    });
    runCheck(msg.known, msg.knownJobs, msg.maxDetails, msg.subsKnown).then(result => send({
      type: "PT_DONE",
      runId: msg.runId,
      result: result
    })).catch(e => send({
      type: "PT_DONE",
      runId: msg.runId,
      result: {
        error: String(e && e.message || e).slice(0, 80)
      }
    })).finally(() => {
      busy = false;
    });
  });
  const parseJ = t => {
    try {
      return JSON.parse(t);
    } catch (e) {
      return null;
    }
  };
  function fromReply(path, body) {
    const p = path.replace(/^\/ssms\/api\//, "");
    if (/allApplications$/i.test(p)) return {
      apps: (Array.isArray(body) ? body : []).map(PT.wlApplication)
    };
    if (/dashboard$/i.test(p)) return {
      dash: PT.wlDashboard(body)
    };
    if (/^sk-submissions\/pending$/i.test(p)) return {
      tasks: (Array.isArray(body) ? body : []).map(PT.wlTask)
    };
    if (/student\/active$/i.test(p)) return {
      jobs: (body && body.applicationDetails || []).map(PT.wlJob)
    };
    if (/student\/closed$/i.test(p)) return {
      closedJobs: (body && body.applicationDetails || []).map(PT.wlJob).slice(0, 300)
    };
    const f = /^sk-submissions\/([0-9a-f-]{36})$/i.exec(p);
    if (f && Array.isArray(body)) return {
      jobForms: {
        id: f[1].toLowerCase(),
        list: body.slice(0, 10).map(x => PT.wlJobForm(x, f[1].toLowerCase(), "", "")).filter(t => t.label || t.deadline)
      }
    };
    const m = /^sk-applications\/([0-9a-f-]{36})$/i.exec(p);
    if (m && body && body.json_data) return {
      detail: {
        id: m[1].toLowerCase(),
        data: PT.wlDetail(body)
      }
    };
    return null;
  }
  const tap = part => send({
    type: "PT_TAP",
    part: part
  });
  window.addEventListener("message", e => {
    const d = e.data;
    if (e.source !== window || !d || d.__ptTap !== 1) return;
    if (d.kind === "reply" && typeof d.text === "string") {
      const part = fromReply(String(d.path || ""), parseJ(d.text));
      if (part) tap(part);
    } else if (d.kind === "write") {
      onWrite();
      if (/sk-submissions\/submission\//i.test(String(d.path || ""))) {
        tasksNow();
        formsNow();
      }
    }
  });
  window.postMessage({
    __ptTapReady: 1
  }, location.origin);
  let armed = null;
  const jobOnPage = () => {
    const m = /application-details\/([0-9a-f-]{36})/i.exec(location.hash || "");
    return m ? m[1].toLowerCase() : null;
  };
  document.addEventListener("click", e => {
    const b = e.target instanceof Element && e.target.closest("button");
    if (!b || !/^\s*submit application\s*$/i.test(b.textContent || "")) return;
    const id = jobOnPage();
    if (!id) return;
    const answers = window.PTForm ? window.PTForm.snapshot() : null;
    if (armed) clearTimeout(armed.timer);
    armed = {
      id: id,
      at: Date.now(),
      answers: answers,
      timer: setTimeout(() => confirmApplied(), 1e4)
    };
  }, true);
  let tasksT = 0;
  function tasksNow() {
    clearTimeout(tasksT);
    tasksT = setTimeout(async () => {
      const s = session();
      if (!s) return;
      try {
        const T = await call("GET", "sk-submissions/pending", s);
        tap({
          tasks: (Array.isArray(T) ? T : []).map(PT.wlTask)
        });
      } catch (e) {}
    }, 800);
  }
  let formArmed = null;
  document.addEventListener("click", e => {
    const b = e.target instanceof Element && e.target.closest("button");
    if (!b || !/^\s*((re)?submit|save)\s*$/i.test(b.textContent || "") || !window.PTForm || !window.PTForm.onTasksTab()) return;
    const id = jobOnPage();
    if (!id) return;
    formArmed = {
      id: id,
      at: Date.now(),
      answers: window.PTForm.snapshot()
    };
  }, true);
  let formsT = 0;
  function formsNow() {
    const id = jobOnPage();
    if (!id) return;
    if (formArmed && formArmed.id === id && Date.now() - formArmed.at < 6e4 && formArmed.answers && window.PTForm) window.PTForm.save(formArmed.answers);
    formArmed = null;
    clearTimeout(formsT);
    formsT = setTimeout(async () => {
      const s = session();
      if (!s) return;
      try {
        const L = await call("GET", "sk-submissions/" + encodeURIComponent(id), s);
        tap({
          jobForms: {
            id: id,
            list: (Array.isArray(L) ? L : []).slice(0, 10).map(x => PT.wlJobForm(x, id, "", "")).filter(t => t.label || t.deadline)
          }
        });
      } catch (e) {}
    }, 900);
  }
  function onWrite() {
    if (armed && Date.now() - armed.at < 6e4) {
      clearTimeout(armed.timer);
      setTimeout(confirmApplied, 600);
    }
  }
  async function confirmApplied() {
    const a = armed;
    armed = null;
    if (!a) return;
    const s = session();
    if (!s) return;
    try {
      const apps = (await call("GET", "sk-student-application-statuses/allApplications", s) || []).map(PT.wlApplication);
      tap({
        apps: apps
      });
      countersNow(true);
      if (apps.some(x => String(x.id).toLowerCase() === a.id)) {
        send({
          type: "PT_APPLIED",
          id: a.id,
          at: Date.now()
        });
        if (a.answers && window.PTForm) window.PTForm.save(a.answers);
      }
    } catch (e) {}
  }
  let listBusy = false;
  async function listCheck() {
    if (listBusy) return;
    listBusy = true;
    try {
      const s = session();
      if (!s || s.exp && s.exp < Date.now()) return;
      const L = await call("POST", "sk-applications/student/active", s, {
        company: "0",
        groupFunction: "0",
        jobTitle: "0",
        industryGroup: "0",
        jobStatus: "0",
        daySlot: "0",
        jobDaySlot: "0",
        sortBy: "0"
      });
      tap({
        jobs: (L && L.applicationDetails || []).map(PT.wlJob),
        via: "list"
      });
    } catch (e) {} finally {
      listBusy = false;
    }
  }
  const fetching = new Set;
  async function detailsNow(ids) {
    const s = session();
    if (!s) return;
    let first = true;
    for (const id of ids || []) {
      if (!/^[0-9a-f-]{36}$/i.test(String(id)) || fetching.has(id)) continue;
      fetching.add(id);
      try {
        if (!first) await gap();
        first = false;
        tap({
          detail: {
            id: String(id).toLowerCase(),
            data: PT.wlDetail(await call("GET", "sk-applications/" + encodeURIComponent(id), s))
          }
        });
      } catch (e) {} finally {
        fetching.delete(id);
      }
    }
  }
  chrome.runtime.onMessage.addListener((msg, _s, reply) => {
    if (!msg) return;
    if (msg.type === "PT_LIST_CHECK") {
      reply({
        started: true
      });
      listCheck();
    } else if (msg.type === "PT_DETAIL_FETCH") {
      reply({
        started: true
      });
      detailsNow(msg.ids);
    }
  });
  async function countersNow(force) {
    try {
      const k = "ptDashAt", last = +(sessionStorage.getItem(k) || 0);
      if (!force && Date.now() - last < 6e4) return;
      sessionStorage.setItem(k, String(Date.now()));
      const s = session();
      if (!s || s.exp && s.exp < Date.now()) return;
      const dash = PT.wlDashboard(await call("POST", "sk-student-application-statuses/dashboard", s, {}));
      if (dash.length) tap({
        dash: dash
      });
    } catch (e) {}
  }
  setTimeout(() => countersNow(false), 1500);
  if (/[?&]ptTab=tasks\b/.test(location.search)) {
    let tries = 0;
    const t = setInterval(() => {
      const tab = [ ...document.querySelectorAll('[role="tab"], .ant-tabs-tab, .ant-tabs-tab-btn, a, li, div') ].find(el => el.children.length <= 2 && /^\s*assess?ment released post deadline\s*$/i.test(el.textContent || ""));
      if (tab) {
        clearInterval(t);
        tab.click();
        try {
          history.replaceState(history.state, "", location.pathname + location.hash);
        } catch (e) {}
      } else if (++tries > 40) clearInterval(t);
    }, 500);
  }
  let wdTimer = 0;
  const wdTip = (txt, at) => {
    const o = document.getElementById("pt-wdtip");
    if (o) o.remove();
    const d = document.createElement("div");
    d.id = "pt-wdtip";
    d.textContent = txt;
    d.style.cssText = "position:fixed;z-index:2147483646;max-width:300px;background:#1f2937;color:#fff;font:13px/1.4 -apple-system,Segoe UI,Roboto,sans-serif;padding:8px 12px;border-radius:8px;box-shadow:0 4px 14px rgba(0,0,0,.25)";
    document.body.appendChild(d);
    if (at) {
      const r = at.getBoundingClientRect();
      d.style.top = Math.max(8, r.top - d.offsetHeight - 10) + "px";
      d.style.left = Math.max(8, Math.min(innerWidth - d.offsetWidth - 8, r.left - 120)) + "px";
    } else {
      d.style.top = "80px";
      d.style.right = "60px";
    }
    setTimeout(() => d.remove(), 1e4);
  };
  window.__ptWithdraw = appId => {
    appId = String(appId || "").toLowerCase();
    clearInterval(wdTimer);
    let tries = 0, searched = false, app = null;
    chrome.storage.local.get("snapshot").then(v => {
      app = ((v.snapshot || {}).apps || []).find(a => String(a.id).toLowerCase() === appId) || null;
    }).catch(() => {});
    const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const isWd = el => el.children.length <= 2 && /^\s*withdraw(\s+application)?\s*$/i.test(el.textContent || "") && el.offsetParent !== null;
    const rowFor = () => {
      const rows = [ ...document.querySelectorAll("tr, [role='row']") ].filter(r => r.offsetParent !== null && !r.closest("#pt-cool"));
      const byId = rows.find(r => [ ...r.querySelectorAll("a[href]") ].some(a => a.getAttribute("href").toLowerCase().includes(appId)));
      if (byId || !app) return byId;
      const role = norm(app.role), co = norm(app.company).split(" ").slice(0, 2).join(" ");
      return rows.find(r => {
        const t = norm(r.textContent);
        return role && t.includes(role) && (!co || t.includes(co));
      });
    };
    wdTimer = setInterval(() => {
      tries++;
      if (!/^#\/student\/my-applications\b/.test(location.hash) || !window.__ptPeek) {
        clearInterval(wdTimer);
        return;
      }
      const row = rowFor();
      if (row) {
        clearInterval(wdTimer);
        const btn = [ ...row.querySelectorAll('a, button, [role="button"], span') ].filter(isWd).map(el => el.closest('a, button, [role="button"]') || el)[0];
        if (btn) {
          btn.scrollIntoView({
            block: "center"
          });
          btn.style.outline = "3px solid #f59e0b";
          btn.style.outlineOffset = "3px";
          btn.style.borderRadius = btn.style.borderRadius || "6px";
          setTimeout(() => wdTip("Press Withdraw here if you want out. The portal asks you to confirm. The tracker doesn't press it for you.", btn), 400);
        } else {
          row.scrollIntoView({
            block: "center"
          });
          row.style.outline = "3px solid #f59e0b";
          setTimeout(() => wdTip("This application has no Withdraw on the portal now (it may be closed for changes, or already withdrawn).", row), 400);
        }
        return;
      }
      if (!searched && tries > 6 && app) {
        const box = [ ...document.querySelectorAll("input") ].find(i => i.offsetParent !== null && !i.closest("#pt-cool") && /search/i.test((i.placeholder || "") + " " + (i.getAttribute("aria-label") || "")));
        if (box) {
          searched = true;
          box.focus();
          box.value = app.role || "";
          box.dispatchEvent(new Event("input", {
            bubbles: true
          }));
          box.dispatchEvent(new KeyboardEvent("keyup", {
            key: "Enter",
            bubbles: true
          }));
        }
      }
      if (tries > 40) {
        clearInterval(wdTimer);
        wdTip("Couldn't find this application in the table. Find it in the list and use its Withdraw link.");
      }
    }, 400);
  };
  const NOCOUNT = "pt_nocount";
  let nocount = false;
  try {
    nocount = localStorage.getItem(NOCOUNT) === "1";
  } catch (e) {}
  try {
    chrome.storage.local.get([ "devNoCount" ], s => {
      try {
        if (s && s.devNoCount === true) localStorage.setItem(NOCOUNT, "1"); else if (s && s.devNoCount === false) localStorage.removeItem(NOCOUNT);
      } catch (e) {}
    });
    chrome.storage.onChanged.addListener((ch, area) => {
      if (area !== "local" || !ch.devNoCount) return;
      try {
        if (ch.devNoCount.newValue === true) localStorage.setItem(NOCOUNT, "1"); else if (ch.devNoCount.newValue === false) localStorage.removeItem(NOCOUNT);
      } catch (e) {}
    });
  } catch (e) {}
  send({
    type: "PT_PORTAL_OPENED",
    nocount: nocount
  });
})();