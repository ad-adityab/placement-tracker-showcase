importScripts("lib.js", "xlsx.js");

const PORTAL = "https://placements.isb.edu/";

const PORTAL15 = "pt-15", BG2H = "pt-bg2h", LIST10 = "pt-list10", NETRETRY = "pt-netretry", OLD_ALARMS = [ "pt-hourly", "pt-3h", "pt-30" ];

const BG_REFUSED_RETEST = 7 * 864e5;

const MIN_GAP_MS = 10 * 60 * 1e3;

const STALE_MS = 6 * 3600 * 1e3;

let running = false;

chrome.runtime.onInstalled.addListener(d => {
  setup();
  if (d && d.reason === "install") {
    set({
      firstRunArmed: Date.now()
    });
    if (!self.PT_NO_WELCOME) chrome.tabs.create({
      url: chrome.runtime.getURL("welcome.html")
    }).catch(() => {});
    firstRead();
  }
  if (d && (d.reason === "install" || d.reason === "update")) set({
    usagePending: d.reason === "install" ? "pt_install" : "pt_update"
  });
  if (d && d.reason === "update") wnOnUpdate(d.previousVersion);
});

const IS_BETA = /beta/i.test(chrome.runtime.getManifest().version_name || "");

async function noCount() {
  if (IS_BETA) return true;
  const {devNoCount: devNoCount} = await get([ "devNoCount" ]);
  return devNoCount === true;
}

async function byePage() {
  try {
    chrome.runtime.setUninstallURL(await noCount() ? "" : PT.BYE_URL(chrome.runtime.getManifest().version));
  } catch (e) {}
}

const usageLast = {};

async function usage(name, params) {
  const ev = PT.usageEvent(name, params);
  if (!ev || await noCount()) return;
  const now = Date.now(), key = name + JSON.stringify(ev.params);
  if (now - (usageLast[key] || 0) < 5e3) return;
  usageLast[key] = now;
  const st = await get([ "usageOff", "installId", "installWeek", "coolUI", "gcal", "gsheet", "ffOn", "listView" ]);
  if (st.usageOff === true) return;
  let id = st.installId;
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2);
    await set({
      installId: id
    });
  }
  if (!st.installWeek) {
    st.installWeek = PT.isoWeek(new Date);
    await set({
      installWeek: st.installWeek
    });
  }
  ev.params.v = chrome.runtime.getManifest().version;
  ev.params.engagement_time_msec = 1;
  const body = JSON.stringify({
    client_id: id,
    non_personalized_ads: true,
    user_properties: PT.usageProps(st),
    events: [ ev ]
  });
  fetch("https://www.google-analytics.com/mp/collect?measurement_id=" + PT.GA.mid + "&api_secret=" + encodeURIComponent(PT.GA.secret), {
    method: "POST",
    mode: "no-cors",
    credentials: "omit",
    cache: "no-store",
    body: body
  }).catch(() => {});
}

async function usagePage(page, ui) {
  const today = (new Date).toLocaleDateString("en-CA", {
    timeZone: "Asia/Kolkata"
  }), {usagePortalDay: usagePortalDay, usagePageAt: usagePageAt} = await get([ "usagePortalDay", "usagePageAt" ]);
  if (usagePortalDay !== today) {
    await set({
      usagePortalDay: today
    });
    usage("pt_portal_day", {
      ui: ui
    });
  }
  const k = page + "|" + ui, at = Object.assign({}, usagePageAt || {});
  if (Date.now() - (at[k] || 0) < 30 * 6e4) return;
  at[k] = Date.now();
  await set({
    usagePageAt: at
  });
  usage("pt_page", {
    page: page,
    ui: ui
  });
}

async function usageActive() {
  const d = (new Date).toISOString().slice(0, 10), {usageDay: usageDay} = await get([ "usageDay" ]);
  if (usageDay !== d) {
    await set({
      usageDay: d
    });
    usage("pt_active");
  }
}

async function health(kind, e) {
  const {usageHealthAt: usageHealthAt} = await get([ "usageHealthAt" ]), at = Object.assign({}, usageHealthAt || {});
  if (Date.now() - (at[kind] || 0) < 36e5) return;
  at[kind] = Date.now();
  await set({
    usageHealthAt: at
  });
  usage("pt_health", {
    kind: kind,
    err: PT.errClass(e)
  });
}

chrome.storage.onChanged.addListener((ch, area) => {
  if (area !== "local") return;
  if (ch.devNoCount) byePage();
  if (ch.gcal) refreshBadge();
  if (ch.lastError && ch.lastError.newValue) health("portal_check", /login|logged/.test(ch.lastError.newValue) ? "auth" : ch.lastError.newValue);
  const g = ch.gcal && ch.gcal.newValue, g0 = ch.gcal && ch.gcal.oldValue || {};
  if (g && g.needsReconnect && !g0.needsReconnect) health("google_signin", "auth");
  if (g && g.error && g.error !== g0.error) health("calendar_sync", g.error);
  if (ch.sheetError && ch.sheetError.newValue) health("sheet_read", ch.sheetError.newValue);
  const sh = ch.gsheet && ch.gsheet.newValue, sh0 = ch.gsheet && ch.gsheet.oldValue || {};
  if (sh && sh.error && sh.error !== sh0.error) health("sheet_update", sh.error);
});

chrome.runtime.onStartup.addListener(async () => {
  await setup(true);
  if ((await portalTabs()).length) checkNow("chrome opened");
});

chrome.alarms.getAll().then(a => {
  const n = a.map(x => x.name);
  if (!n.includes(PORTAL15) || !n.includes(BG2H) || !n.includes(LIST10) || n.includes("pt-30")) setup();
});

async function setup(restartBg) {
  let {alarmSeed: alarmSeed, config: config} = await chrome.storage.local.get([ "alarmSeed", "config" ]);
  if (typeof alarmSeed !== "number") {
    alarmSeed = Math.random();
    await chrome.storage.local.set({
      alarmSeed: alarmSeed
    });
  }
  const cfg = Object.assign({}, PT.CONFIG_DEFAULTS, config || {});
  const p = cfg.check_portal_minutes, bg = cfg.check_background_minutes;
  for (const n of OLD_ALARMS) chrome.alarms.clear(n);
  chrome.alarms.create(PORTAL15, {
    periodInMinutes: p,
    when: Date.now() + 6e4 + alarmSeed * p * 6e4
  });
  const bgA = await chrome.alarms.get(BG2H);
  if (restartBg || !bgA || bgA.periodInMinutes !== bg) chrome.alarms.create(BG2H, {
    periodInMinutes: bg,
    when: Date.now() + bg * 6e4
  });
  chrome.alarms.create(LIST10, {
    periodInMinutes: 10,
    when: Date.now() + 9e4 + alarmSeed * 10 * 6e4
  });
  refreshBadge();
  refreshSheet();
  byePage();
}

const SHEET_TTL = 45 * 60 * 1e3, SHEET_RETRY = 5 * 60 * 1e3;

let sheetBusy = false;

let qaBusy = null;

function refreshQA(withSheet) {
  if (qaBusy) return qaBusy;
  const read = tab => fetch(PT.sheetUrl(tab), {
    credentials: "omit",
    cache: "no-store"
  }).then(r => {
    if (!r.ok) throw new Error("sheet " + r.status);
    return r.text();
  });
  qaBusy = (async () => {
    if (!withSheet) {
      const {qa: qa, qaTriedAt: qaTriedAt} = await get([ "qa", "qaTriedAt" ]);
      if (qa && (qa.rows || []).length) return;
      if (Date.now() - (qaTriedAt || 0) < 2e4) return;
    }
    await set({
      qaTriedAt: Date.now()
    });
    const [qaFTxt, qaTxt] = await Promise.all([ read("QA_Firms").catch(() => ""), read("QA").catch(() => "") ]);
    const qf = qaFTxt ? PT.parseGviz(qaFTxt) : [], merged = qf.length && "times_asked" in qf[0];
    const rows = (merged ? qf : qaTxt ? PT.parseGviz(qaTxt) : []).map(PT.wlQA).filter(Boolean);
    if (!rows.length) return;
    const {qaKnown: qaKnown, qa: qa} = await get([ "qaKnown", "qa" ]), next = {
      rows: rows,
      merged: !!merged
    };
    await set(Object.assign({
      qaAt: Date.now()
    }, JSON.stringify(qa) === JSON.stringify(next) ? {} : {
      qa: next
    }, Array.isArray(qaKnown) ? {} : {
      qaKnown: rows.map(PT.qaKey)
    }));
  })().catch(() => {}).finally(() => {
    qaBusy = null;
  });
  return qaBusy;
}

async function refreshSheet(force) {
  if (sheetBusy) return;
  const {sheet: sheet} = await get([ "sheet" ]), now = Date.now();
  if (!force && sheet && (now - (sheet.fetchedAt || 0) < SHEET_TTL || now - (sheet.triedAt || 0) < SHEET_RETRY)) {
    refreshQA();
    return;
  }
  sheetBusy = true;
  const read = tab => fetch(PT.sheetUrl(tab), {
    credentials: "omit",
    cache: "no-store"
  }).then(r => {
    if (!r.ok) throw new Error("sheet " + r.status);
    return r.text();
  });
  try {
    const [jobsTxt, metaTxt, cfgTxt] = await Promise.all([ read("Jobs"), read("Meta").catch(() => ""), read("Tracker").catch(() => ""), refreshQA(true) ]);
    const jobs = PT.parseGviz(jobsTxt).map(PT.wlSheetRow).filter(r => r.application_id);
    let pulledAt = null;
    try {
      pulledAt = metaTxt ? PT.sheetPulledAt(PT.parseGviz(metaTxt)) : null;
    } catch (e) {}
    let config = null;
    try {
      config = cfgTxt ? PT.readConfig(PT.parseGviz(cfgTxt)) : null;
    } catch (e) {}
    const prev = (await get([ "config" ])).config || PT.CONFIG_DEFAULTS;
    await set(Object.assign({
      sheet: {
        jobs: jobs,
        pulledAt: pulledAt,
        fetchedAt: Date.now(),
        triedAt: Date.now()
      },
      sheetError: null
    }, config ? {
      config: config
    } : {}));
    if (config && (config.check_portal_minutes !== prev.check_portal_minutes || config.check_background_minutes !== prev.check_background_minutes)) setup();
    if (config && config.reminder_minutes !== prev.reminder_minutes) syncCalendar("reminder changed");
  } catch (e) {
    await set({
      sheet: Object.assign({}, sheet || {}, {
        triedAt: Date.now()
      }),
      sheetError: String(e && e.message || e).slice(0, 80)
    });
  } finally {
    sheetBusy = false;
  }
}

const get = keys => chrome.storage.local.get(keys);

const set = obj => chrome.storage.local.set(obj);

function istHour(d = new Date) {
  return (d.getUTCHours() + 5 + (d.getUTCMinutes() + 30 >= 60 ? 1 : 0)) % 24;
}

async function portalTabs() {
  return chrome.tabs.query({
    url: PORTAL + "*"
  });
}

const paused = async () => {
  const {config: config} = await get([ "config" ]);
  return !!(config && config.checks_paused);
};

const waiting = new Map;

const CHECK_TIMEOUT = 12 * 60 * 1e3;

async function checkInTab(tabId, trigger, maxDetails) {
  if (running) return {
    skipped: "busy"
  };
  if (await paused()) return {
    skipped: "portal checks paused from the Sheet"
  };
  if (!navigator.onLine) return {
    skipped: "offline"
  };
  running = true;
  const runId = Date.now() + "-" + Math.random().toString(36).slice(2, 8);
  try {
    const st = await get([ "facts", "details", "snapshot", "subsAt" ]);
    const stale = new Set(PT.staleDetails(st.details, st.snapshot, Date.now(), 3));
    const held = Object.fromEntries(Object.entries(st.details || {}).filter(([k, d]) => d && (d.v || 1) >= PT.DETAIL_V && !d.stale && !stale.has(k)).map(([k]) => [ k, 1 ]));
    await set({
      checkRun: {
        runId: runId,
        trigger: trigger,
        at: Date.now()
      }
    });
    const done = new Promise(resolve => {
      waiting.set(runId, resolve);
      checking = {
        runId: runId,
        tabId: tabId
      };
      setTimeout(() => resolve({
        timeout: true
      }), CHECK_TIMEOUT);
    });
    const ack = await sendToPortal(tabId, {
      type: "PT_RUN_CHECK",
      runId: runId,
      known: st.facts || {},
      knownJobs: held,
      maxDetails: maxDetails || 0,
      subsKnown: {
        at: st.subsAt || {},
        tasks: (st.snapshot || {}).tasks || []
      }
    });
    if (!ack) {
      waiting.delete(runId);
      await set({
        lastError: "no reply from portal tab",
        lastRun: {
          at: Date.now(),
          trigger: trigger,
          calls: []
        }
      });
      return ack;
    }
    if (ack.busy) {
      waiting.delete(runId);
      return {
        skipped: "a check is already running in that tab"
      };
    }
    const res = await done;
    waiting.delete(runId);
    if (res && res.timeout) {
      await set({
        lastError: "check didn't finish (the portal tab was closed or reloaded); it will retry"
      });
      await refreshBadge();
      return res;
    }
    if (res && res.aborted) return res;
    return res;
  } catch (e) {
    waiting.delete(runId);
    await checkFailed("check failed: " + String(e.message || e).slice(0, 60));
    return {
      error: String(e)
    };
  } finally {
    running = false;
    checking = null;
    set({
      progress: null
    });
  }
}

let checking = null;

function abortCheck(tabId, why) {
  if (!checking || checking.tabId !== tabId) return;
  const w = waiting.get(checking.runId);
  checking = null;
  if (w) w({
    aborted: why
  });
}

chrome.tabs.onRemoved.addListener(tabId => abortCheck(tabId, "tab closed"));

chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status === "loading" || info.url && !info.url.startsWith(PORTAL)) abortCheck(tabId, "tab reloaded");
});

async function checkFailed(msg) {
  const net = /failed to fetch|network|offline|load failed/i.test(String(msg));
  if (net) {
    const {netRetryAt: netRetryAt} = await get([ "netRetryAt" ]);
    if (!netRetryAt || Date.now() - netRetryAt > 15 * 6e4) {
      await set({
        netRetryAt: Date.now()
      });
      chrome.alarms.create(NETRETRY, {
        when: Date.now() + 2 * 6e4
      });
      return;
    }
  }
  await set({
    lastError: navigator.onLine ? msg : "offline",
    netRetryAt: null
  });
}

async function finishCheck(runId, res) {
  const {checkRun: checkRun} = await get([ "checkRun" ]);
  const trigger = checkRun && checkRun.trigger || "check";
  const st = await get([ "snapshot", "details" ]);
  const now = Date.now();
  const log = {
    at: now,
    trigger: trigger,
    calls: res && res.calls || []
  };
  let out;
  if (!res) {
    await set({
      lastError: "no reply from portal tab",
      lastRun: log
    });
    out = res;
  } else if (res.loggedOut || res.expired) {
    await set({
      paused: true,
      loginExp: res.loginExp || null,
      lastRun: log,
      lastError: null,
      loginState: res.loggedOut ? "out" : "expired"
    });
    await refreshBadge();
    out = res;
  } else if (res.error) {
    await set({
      lastRun: log,
      loginExp: res.loginExp || null
    });
    await checkFailed(res.error);
    await refreshBadge();
    out = res;
  } else {
    await partialQueue;
    const details = Object.assign({}, (await get([ "details" ])).details || st.details || {}, res.details);
    const ids = new Set(res.snapshot.apps.map(a => a.id).concat((res.snapshot.jobs || []).map(j => j.id), (res.snapshot.closedJobs || []).map(j => j.id)));
    for (const k of Object.keys(details)) if (!ids.has(k)) delete details[k];
    const facts = Object.fromEntries(res.snapshot.apps.filter(a => details[a.id]).map(a => [ a.id, PT.listFacts(a) ]));
    if (!res.snapshot.closedJobs && st.snapshot && st.snapshot.closedJobs) res.snapshot.closedJobs = st.snapshot.closedJobs;
    const changes = PT.diff(st.snapshot, res.snapshot).map(c => Object.assign(c, {
      at: now
    }));
    const cur = await get([ "changes", "unseen", "hiddenJobs", "plus" ]);
    const unseen = (cur.unseen || 0) + changes.filter(c => !(c.job && PT.effectiveHidden(cur)[c.job])).length;
    await set(Object.assign(res.subsAt ? {
      subsAt: res.subsAt
    } : {}, {
      snapshot: res.snapshot,
      details: details,
      facts: facts,
      lastCheck: now,
      lastFresh: now,
      loginExp: res.loginExp || null,
      paused: false,
      lastError: null,
      loginState: null,
      netRetryAt: null,
      lastRun: log,
      changes: changes.concat(cur.changes || []).slice(0, 20),
      unseen: unseen,
      progress: null
    }));
    await refreshBadge();
    refreshSheet();
    syncCalendar("check");
    out = {
      ok: true,
      changes: changes.length
    };
  }
  const w = waiting.get(runId);
  if (w) w(out === undefined ? {
    ok: false
  } : out);
  return out;
}

async function sendToPortal(tabId, msg) {
  try {
    return await chrome.tabs.sendMessage(tabId, msg);
  } catch (e) {
    if (!/Receiving end does not exist|Could not establish connection/i.test(String(e && e.message || e))) throw e;
    await chrome.scripting.executeScript({
      target: {
        tabId: tabId
      },
      files: [ "lib.js", "content.js", "tbc-jobcard.js", "cool.js" ]
    });
    await chrome.scripting.insertCSS({
      target: {
        tabId: tabId
      },
      files: [ "tbc-jobcard.css", "pt-cards.css", "cool.css" ]
    }).catch(() => {});
    return await chrome.tabs.sendMessage(tabId, msg);
  }
}

const SESSION_KEY = "ptPortalLogin";

async function loginCopy() {
  const v = (await chrome.storage.session.get([ SESSION_KEY ]))[SESSION_KEY];
  if (!v || !v.jwt) return null;
  if (v.exp && v.exp < Date.now() + 6e4) {
    await chrome.storage.session.remove(SESSION_KEY);
    return null;
  }
  return v;
}

async function keepLogin(jwt, exp) {
  if (!jwt) {
    await chrome.storage.session.remove(SESSION_KEY);
    return;
  }
  await chrome.storage.session.set({
    [SESSION_KEY]: {
      jwt: jwt,
      exp: exp || null,
      at: Date.now()
    }
  });
}

let swSlowUntil = 0;

async function swCall(method, path, jwt, body) {
  let r;
  for (let n = 0; ;n++) {
    r = await fetch(PORTAL + "ssms/api/" + path, {
      method: method,
      credentials: "omit",
      cache: "no-store",
      body: body ? JSON.stringify(body) : undefined,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "x-access-token": jwt,
        token: jwt,
        Authorization: "Bearer " + jwt
      }
    });
    if (!(r.status === 429 || r.status >= 500) || n >= 2) break;
    swSlowUntil = Date.now() + 5 * 6e4;
    await new Promise(res => setTimeout(res, 3e3 * (n + 1)));
  }
  if (r.status === 401 || r.status === 403) throw new Error("auth");
  if (r.status === 400) {
    const t = await r.clone().text().catch(() => "");
    if (/token_expired/i.test(t)) throw new Error("auth");
  }
  if (!r.ok) throw new Error("http " + r.status + " on " + path.split("/")[0]);
  return r.json();
}

async function swPool(items, fn) {
  let i = 0;
  const lane = async () => {
    while (i < items.length) {
      const it = items[i++];
      if (Date.now() < swSlowUntil) await new Promise(r => setTimeout(r, 2e3 + Math.random() * 2e3));
      await fn(it);
    }
  };
  await Promise.all(Array.from({
    length: Math.min(items.length, Date.now() < swSlowUntil ? 1 : 4)
  }, lane));
}

async function checkInBackground(trigger, maxDetails = 15) {
  if (running) return {
    skipped: "busy"
  };
  if (await paused()) return {
    skipped: "portal checks paused from the Sheet"
  };
  const {bgRefused: bgRefused} = await get([ "bgRefused" ]);
  if (bgRefused && Date.now() - bgRefused < BG_REFUSED_RETEST) return {
    skipped: "the portal reads only while it is open"
  };
  if (!navigator.onLine) return {
    skipped: "offline"
  };
  const login = await loginCopy();
  if (!login) {
    await set({
      needPortal: true
    });
    refreshBadge();
    return {
      skipped: "open the portal"
    };
  }
  running = true;
  const runId = Date.now() + "-bg-" + Math.random().toString(36).slice(2, 8);
  try {
    const st = await get([ "facts", "details", "snapshot", "subsAt" ]);
    const stale = new Set(PT.staleDetails(st.details, st.snapshot, Date.now(), 3));
    const held = Object.fromEntries(Object.entries(st.details || {}).filter(([k, d]) => d && (d.v || 1) >= PT.DETAIL_V && !d.stale && !stale.has(k)).map(([k]) => [ k, 1 ]));
    await set({
      checkRun: {
        runId: runId,
        trigger: trigger,
        at: Date.now()
      },
      needPortal: false
    });
    const res = await PT.portalRead({
      call: (m, path, body) => swCall(m, path, login.jwt, body),
      partial: applyPartial,
      pool: swPool,
      known: st.facts || {},
      knownJobs: held,
      maxDetails: maxDetails,
      exp: login.exp,
      subsKnown: {
        at: st.subsAt || {},
        tasks: (st.snapshot || {}).tasks || []
      }
    });
    if (res && res.expired) {
      if (login.exp && login.exp > Date.now() + 6e4) {
        await set({
          bgRefused: Date.now(),
          checkRun: null
        });
        health("background_read", "refused");
        return {
          refused: true
        };
      }
      await chrome.storage.session.remove(SESSION_KEY);
    }
    await finishCheck(runId, res);
    return res;
  } catch (e) {
    await checkFailed("check failed: " + String(e.message || e).slice(0, 60));
    return {
      error: String(e)
    };
  } finally {
    running = false;
    set({
      progress: null
    });
  }
}

async function backgroundTab() {
  if (await paused() || !navigator.onLine) return {
    skipped: true
  };
  if ((await portalTabs()).length) return {
    skipped: "a portal tab is open"
  };
  const {bgRefused: bgRefused} = await get([ "bgRefused" ]);
  if (!bgRefused || Date.now() - bgRefused >= BG_REFUSED_RETEST) {
    const r = await checkInBackground("every 2 hours");
    if (r && (r.ok || r.changes !== undefined)) return r;
  }
  if ((await portalTabs()).length) return {
    skipped: "a portal tab is open"
  };
  const t = await chrome.tabs.create({
    url: PORTAL + "#/student/home",
    active: false
  }).catch(() => null);
  if (t) await set({
    bgTabAt: Date.now()
  });
  return {
    opened: !!t
  };
}

async function firstRead() {
  const tabs = await portalTabs();
  return tabs.length ? checkInTab(tabs[0].id, "first read") : checkInBackground("first read", 0);
}

async function checkNow(trigger) {
  const {paused: paused, loginExp: loginExp} = await get([ "paused", "loginExp" ]);
  const tabs = await portalTabs();
  if (tabs.length) return checkInTab(tabs[0].id, trigger);
  return checkInBackground(trigger);
}

chrome.alarms.onAlarm.addListener(async a => {
  if (a.name === "pt-gsheet") {
    syncGSheet().catch(() => {});
    return;
  }
  if (a.name === PORTAL15) {
    const tabs = await portalTabs();
    if (tabs.length) await checkInTab(tabs[0].id, "every 15 min");
  } else if (a.name === LIST10) {
    const tabs = await portalTabs(), st = await get([ "paused" ]);
    if (tabs.length && !running && !st.paused && !await paused()) sendToPortal(tabs[0].id, {
      type: "PT_LIST_CHECK"
    }).catch(() => {});
  } else if (a.name === NETRETRY) {
    await checkNow("retry after a network failure");
  } else if (a.name === BG2H) {
    await backgroundTab();
  }
  refreshBadge();
});

let partialQueue = Promise.resolve();

function applyPartial(part) {
  partialQueue = partialQueue.then(async () => {
    const st = await get([ "snapshot", "details", "progress" ]);
    const snap = Object.assign({
      dash: [],
      apps: [],
      tasks: []
    }, st.snapshot || {});
    const out = {};
    if (!st.snapshot && !part.apps) out.progress = {
      due: 0,
      done: 0,
      lists: true
    };
    if (part.dash) snap.dash = part.dash;
    if (part.apps) {
      snap.apps = part.apps;
      out.progress = {
        due: part.detailsDue || 0,
        done: 0
      };
    }
    if (part.tasks) snap.tasks = PT.mergeTasks(part.tasks, (snap.tasks || []).filter(t => t.src === "job"));
    if (part.jobs) snap.jobs = part.jobs;
    if (part.closedJobs) snap.closedJobs = part.closedJobs;
    if (part.jobDetailsDue) {
      const p = out.progress || st.progress || {
        due: 0,
        done: 0
      };
      out.progress = {
        due: p.due + part.jobDetailsDue,
        done: p.done
      };
    }
    if (part.detail) {
      out.details = Object.assign({}, st.details || {}, {
        [part.detail.id]: part.detail.data
      });
      const p = st.progress || {
        due: 0,
        done: 0
      };
      out.progress = {
        due: p.due,
        done: Math.min(p.due, p.done + 1)
      };
    }
    if (part.dash || part.apps || part.tasks || part.jobs) out.snapshot = snap;
    await set(out);
  }).catch(() => {});
}

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg.type === "PT_PARTIAL" && sender.tab && (sender.url || "").startsWith(PORTAL)) {
    applyPartial(msg.part || {});
    return;
  }
  if (msg.type === "PT_DONE" && sender.tab && (sender.url || "").startsWith(PORTAL)) {
    finishCheck(msg.runId, msg.result).catch(e => checkFailed("check failed: " + String(e.message || e).slice(0, 60)));
    return;
  }
  if (msg.type === "PT_TAP" && sender.tab && (sender.url || "").startsWith(PORTAL)) {
    applyTap(msg.part || {}, sender.tab.id);
    return;
  }
  if (msg.type === "PT_APPLIED" && sender.tab && (sender.url || "").startsWith(PORTAL)) {
    markApplied(msg.id, msg.at);
    return;
  }
  if (msg.type === "PT_DETAIL_NOW" && sender.tab && (sender.url || "").startsWith(PORTAL)) {
    detailNow(msg.id, sender.tab.id);
    return;
  }
  if (msg.type === "PT_COUNT") {
    usage(msg.name, msg.params || msg.where);
    return;
  }
  if (msg.type === "PT_PAGE") {
    usagePage(msg.page, msg.ui);
    return;
  }
  if (msg.type === "PT_QA_NOW") {
    refreshQA();
    return;
  }
  if (msg.type === "PT_SESSION" && sender.tab && (sender.url || "").startsWith(PORTAL)) {
    keepLogin(msg.jwt || null, msg.exp || null).then(refreshBadge).catch(() => {});
    return;
  }
  if (msg.type === "PT_PORTAL_OPENED" && sender.tab) {
    (async () => {
      if (msg.nocount === true) {
        await set({
          devNoCount: true
        });
        byePage();
      }
      const {usagePending: usagePending} = await get([ "usagePending" ]);
      if (usagePending) {
        await set({
          usagePending: null
        });
        usage(usagePending);
      }
      usageActive().catch(() => {});
    })().catch(() => {});
    refreshQA();
    get([ "lastCheck", "paused" ]).then(({lastCheck: lastCheck, paused: paused}) => {
      if (paused || !lastCheck || Date.now() - lastCheck > MIN_GAP_MS) checkInTab(sender.tab.id, "portal opened");
    });
    calStillThere().catch(() => {});
  } else if (msg.type === "PT_FIRST_READ") {
    firstRead().then(reply).catch(() => reply(null));
    return true;
  } else if (msg.type === "PT_CHECK_NOW") {
    checkNow("check now").then(async r => {
      if (r && (r.skipped === "open the portal" || /reads only while/.test(r.skipped || ""))) {
        await chrome.tabs.create({
          url: PORTAL + "#/student/home",
          active: true
        }).catch(() => {});
        r = {
          opening: true
        };
      }
      reply(r);
    });
    return true;
  } else if (msg.type === "PT_SEEN") {
    set({
      unseen: 0
    }).then(refreshBadge);
    refreshSheet();
  } else if (msg.type === "PT_GCAL_CONNECT") {
    gcalConnect().then(reply);
    return true;
  } else if (msg.type === "PT_GCAL_DISCONNECT") {
    gcalDisconnect().then(reply);
    return true;
  } else if (msg.type === "PT_GCAL_REMAKE") {
    gcalRemake().then(reply);
    return true;
  } else if (msg.type === "PT_SHEET_MAKE" && PT.FEATURES.sheet && sender.tab && (sender.url || "").startsWith(PORTAL)) {
    makeGSheet().then(reply);
    return true;
  } else if (msg.type === "PT_SHEET_OPEN") {
    openGSheet().then(reply);
    return true;
  } else if (msg.type === "PT_COPIES" && sender.tab) {
    set({
      copies: {
        n: msg.n,
        at: Date.now()
      }
    });
  }
});

let tapQueue = Promise.resolve(), tapSync = 0;

const detailWant = new Map;

function applyTap(part, tabId) {
  tapQueue = tapQueue.then(async () => {
    await partialQueue;
    const st = await get([ "snapshot", "details", "changes", "unseen", "hiddenJobs", "plus" ]);
    if (!st.snapshot && !part.apps && !part.jobs) {
      if (part.detail) await set({
        details: Object.assign({}, st.details || {}, {
          [part.detail.id]: part.detail.data
        })
      });
      return;
    }
    const prev = st.snapshot || null, snap = Object.assign({
      dash: [],
      apps: [],
      tasks: [],
      jobs: []
    }, prev || {});
    const out = {
      lastFresh: Date.now()
    }, now = Date.now();
    let details = st.details || {}, touched = false;
    if (part.apps) {
      snap.apps = part.apps;
      touched = true;
    }
    if (part.dash && JSON.stringify(part.dash) !== JSON.stringify(snap.dash)) {
      snap.dash = part.dash;
      touched = true;
    }
    if (part.tasks) {
      snap.tasks = PT.mergeTasks(part.tasks, (snap.tasks || []).filter(t => t.src === "job"));
      touched = true;
    }
    if (part.jobForms && part.jobForms.id) {
      const id = part.jobForms.id, who = [].concat(snap.apps || [], snap.jobs || []).find(x => x.id === id) || {};
      const list = (part.jobForms.list || []).map(t => Object.assign({}, t, {
        company: t.company || who.company || "",
        role: t.role || who.role || ""
      }));
      const others = (snap.tasks || []).filter(t => !(t.src === "job" && t.appId === id)), pend = others.filter(t => t.src !== "job");
      snap.tasks = others.concat(PT.mergeTasks(pend, list).slice(pend.length));
      touched = true;
      out.subsAt = Object.assign({}, (await get([ "subsAt" ])).subsAt || {}, {
        [id]: now
      });
    }
    if (part.closedJobs) {
      snap.closedJobs = part.closedJobs;
      touched = true;
    }
    if (part.jobs) {
      const changed = PT.changedJobs(prev && prev.jobs, part.jobs), had = new Set((prev && prev.jobs || []).map(j => j.id));
      const fresh = part.jobs.filter(j => !had.has(j.id) && !details[j.id]).map(j => j.id);
      if (changed.length) {
        details = Object.assign({}, details);
        for (const id of changed) if (details[id]) details[id] = Object.assign({}, details[id], {
          stale: true
        });
        out.details = details;
      }
      snap.jobs = part.jobs;
      touched = true;
      const want = changed.concat(fresh).slice(0, 12);
      if (want.length && tabId) {
        const w = detailWant.get(tabId) || new Set;
        want.forEach(id => w.add(id));
        detailWant.set(tabId, w);
      }
    }
    if (part.detail) {
      details = Object.assign({}, out.details || details, {
        [part.detail.id]: part.detail.data
      });
      out.details = details;
    }
    if (touched) {
      out.snapshot = snap;
      if (prev) {
        const changes = PT.diff(prev, snap).map(c => Object.assign(c, {
          at: now
        }));
        if (changes.length) {
          out.changes = changes.concat(st.changes || []).slice(0, 20);
          out.unseen = (st.unseen || 0) + changes.filter(c => !(c.job && PT.effectiveHidden(st)[c.job])).length;
        }
      }
    }
    await set(out);
    if (out.unseen !== undefined) refreshBadge();
    if (touched || part.detail) {
      clearTimeout(tapSync);
      tapSync = setTimeout(() => syncCalendar("portal page"), 2e3);
    }
    for (const [tid, ids] of detailWant) {
      detailWant.delete(tid);
      if (ids.size) sendToPortal(tid, {
        type: "PT_DETAIL_FETCH",
        ids: [ ...ids ]
      }).catch(() => {});
    }
  }).catch(() => {});
}

async function markApplied(id, at) {
  if (!/^[0-9a-f-]{36}$/i.test(String(id || ""))) return;
  const {justApplied: justApplied} = await get([ "justApplied" ]), keep = {};
  for (const [k, v] of Object.entries(justApplied || {})) if (Date.now() - (v && v.at || 0) < 15 * 6e4) keep[k] = v;
  keep[String(id).toLowerCase()] = {
    at: at || Date.now()
  };
  await set({
    justApplied: keep
  });
  syncCalendar("applied");
}

async function detailNow(id, tabId) {
  if (!/^[0-9a-f-]{36}$/i.test(String(id || ""))) return;
  const {details: details} = await get([ "details" ]), d = (details || {})[String(id).toLowerCase()];
  if (d && d.v >= PT.DETAIL_V && !d.stale && Date.now() - (d.at || 0) < 5 * 6e4) return;
  sendToPortal(tabId, {
    type: "PT_DETAIL_FETCH",
    ids: [ String(id).toLowerCase() ]
  }).catch(() => {});
}

async function refreshBadge() {
  const {unseen: unseen, gcal: gcal, lastCheck: lastCheck} = await get([ "unseen", "gcal", "lastCheck" ]);
  const stale = lastCheck && Date.now() - lastCheck > STALE_MS;
  try {
    chrome.action.setTitle({
      title: stale ? "Placement Tracker · not updated since " + new Date(lastCheck).toLocaleString("en-IN", {
        weekday: "short",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "Asia/Kolkata"
      }) + " · open the placement portal once to bring it up to date" : "Placement Tracker"
    });
  } catch (e) {}
  if (!(gcal && gcal.connected) && PT.googleReady()) {
    chrome.action.setBadgeText({
      text: "!"
    });
    chrome.action.setBadgeBackgroundColor({
      color: "#d92d20"
    });
  } else if (stale) {
    chrome.action.setBadgeText({
      text: "!"
    });
    chrome.action.setBadgeBackgroundColor({
      color: "#8a8f98"
    });
  } else if (unseen) {
    chrome.action.setBadgeText({
      text: String(Math.min(unseen, 99))
    });
    chrome.action.setBadgeBackgroundColor({
      color: "#0b5cab"
    });
  } else chrome.action.setBadgeText({
    text: ""
  });
}

const GOOGLE_CLIENT_ID = PT.GOOGLE_CLIENT_ID;

const G_AUTH = "https://accounts.google.com/o/oauth2/v2/auth", G_API = "https://www.googleapis.com/calendar/v3";

const G_SCOPE = "https://www.googleapis.com/auth/calendar.app.created", TZ = "Asia/Kolkata";

const rand = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), b => b.toString(16).padStart(2, "0")).join("");

const G_DRIVE = "https://www.googleapis.com/auth/drive.file";

async function googleToken(interactive, wantDrive) {
  const state = rand();
  const p = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: chrome.identity.getRedirectURL(),
    response_type: "token",
    scope: wantDrive ? G_DRIVE : G_SCOPE,
    state: state,
    include_granted_scopes: "true"
  });
  if (!interactive) p.set("prompt", "none");
  const opts = {
    url: G_AUTH + "?" + p,
    interactive: interactive
  };
  if (!interactive) Object.assign(opts, {
    abortOnLoadForNonInteractive: false,
    timeoutMsForNonInteractive: 2e4
  });
  const back = await chrome.identity.launchWebAuthFlow(opts);
  const h = new URLSearchParams(new URL(back).hash.slice(1));
  if (h.get("error")) throw new Error(h.get("error"));
  if (h.get("state") !== state) throw new Error("state mismatch");
  await chrome.storage.session.set({
    gToken: h.get("access_token"),
    gExp: Date.now() + Number(h.get("expires_in") || 0) * 1e3,
    gDrive: /\bdrive\.file\b/.test(h.get("scope") || "")
  });
  return {
    scope: h.get("scope") || ""
  };
}

class AuthNeeded extends Error {}

async function gapi(method, path, body, retried) {
  let {gToken: gToken, gExp: gExp} = await chrome.storage.session.get([ "gToken", "gExp" ]);
  if (!gToken || Date.now() > (gExp || 0) - 6e4) {
    try {
      await googleToken(false);
    } catch (e) {
      throw new AuthNeeded(String(e && e.message || e));
    }
    ({gToken: gToken} = await chrome.storage.session.get("gToken"));
  }
  const r = await fetch(G_API + path, {
    method: method,
    headers: {
      Authorization: "Bearer " + gToken,
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined,
    credentials: "omit"
  });
  if (r.status === 401 && !retried) {
    await chrome.storage.session.remove("gToken");
    return gapi(method, path, body, true);
  }
  if (r.status === 401) throw new AuthNeeded("401");
  const j = r.status === 204 ? {} : await r.json().catch(() => ({}));
  return {
    ok: r.ok,
    status: r.status,
    j: j
  };
}

const setGcal = async patch => {
  const {gcal: gcal} = await get([ "gcal" ]);
  await set({
    gcal: Object.assign({}, gcal || {}, patch)
  });
};

async function ensureCalendar() {
  const {gcal: gcal} = await get([ "gcal" ]);
  if (gcal && gcal.calId) return gcal.calId;
  let {calBackup: calBackup} = await get([ "calBackup" ]);
  if (!calBackup) try {
    for (const t of await chrome.tabs.query({
      url: "https://placements.isb.edu/*"
    })) {
      const [r] = await chrome.scripting.executeScript({
        target: {
          tabId: t.id
        },
        func: k => {
          try {
            return localStorage.getItem(k);
          } catch (e) {
            return null;
          }
        },
        args: [ PT.CAL_KEY ]
      });
      if (r && PT.CAL_ID_RE.test(String(r.result || ""))) {
        calBackup = r.result;
        break;
      }
    }
  } catch (e) {}
  if (calBackup && PT.CAL_ID_RE.test(calBackup)) {
    const c = await gapi("GET", "/calendars/" + encodeURIComponent(calBackup));
    if (c.ok) {
      await setGcal({
        calId: calBackup,
        calCreatedAt: Date.now(),
        calReused: true
      });
      await set({
        calSync: {}
      });
      return calBackup;
    }
  }
  const r = await gapi("POST", "/calendars", {
    summary: "Placement Tracker",
    timeZone: TZ,
    description: "Placement deadlines from Placement Tracker (unofficial). It keeps this calendar up to date on its own."
  });
  if (!r.ok) throw new Error("calendar " + r.status);
  await setGcal({
    calId: r.j.id,
    calCreatedAt: Date.now()
  });
  await set({
    calSync: {}
  });
  return r.j.id;
}

let syncing = false, syncAgain = false;

const LOCK_MS = 3 * 60 * 1e3;

async function listEvents(calId) {
  const items = [];
  let page = "";
  do {
    const q = "?maxResults=2500&showDeleted=false&fields=items(id,extendedProperties,end),nextPageToken" + (page ? "&pageToken=" + encodeURIComponent(page) : "");
    const r = await gapi("GET", "/calendars/" + encodeURIComponent(calId) + "/events" + q);
    if (r.status === 404 || r.status === 410) return null;
    if (!r.ok) throw new Error("list " + r.status);
    items.push(...r.j.items || []);
    page = r.j.nextPageToken || "";
  } while (page);
  return items;
}

async function syncCalendar(reason) {
  const st = await get([ "gcal", "snapshot", "details", "hiddenJobs", "plus", "calSync", "config", "webDone" ]);
  if (!st.gcal || !st.gcal.connected || !st.snapshot) return {
    skipped: true
  };
  if (syncing) {
    syncAgain = true;
    return {
      queued: true
    };
  }
  const {syncLock: syncLock} = await chrome.storage.session.get("syncLock");
  if (syncLock && Date.now() - syncLock < LOCK_MS) {
    syncAgain = true;
    setTimeout(() => {
      if (syncAgain && !syncing) {
        syncAgain = false;
        syncCalendar("retry");
      }
    }, 3e4);
    return {
      queued: true
    };
  }
  if (st.gcal.calMissing) return {
    missing: true
  };
  syncing = true;
  await chrome.storage.session.set({
    syncLock: Date.now()
  });
  let calSync = {}, done = 0, failed = 0, dupes = 0, ops = 0;
  let total = 0;
  const save = async force => {
    if (force || ++ops % 5 === 0) await set({
      calSync: calSync,
      calProg: force ? null : {
        done: ops,
        total: total
      }
    });
  };
  try {
    let calId = await ensureCalendar(), items = await listEvents(calId);
    if (items === null) {
      const {gcal: gcal} = await get([ "gcal" ]);
      const check = await gapi("GET", "/calendars/" + encodeURIComponent(calId));
      const fresh = gcal && gcal.calCreatedAt && Date.now() - gcal.calCreatedAt < 10 * 60 * 1e3;
      if (check.ok || fresh || !(check.status === 404 || check.status === 410)) throw new Error("calendar not ready yet; next sync retries");
      await calMissing();
      return {
        missing: true
      };
    }
    const adopted = PT.calAdopt(items, st.calSync);
    calSync = adopted.synced;
    const ev = id => "/calendars/" + encodeURIComponent(calId) + "/events" + (id ? "/" + encodeURIComponent(id) : "");
    const gone = s => s === 404 || s === 410;
    for (const x of adopted.extra) {
      const r = await gapi("DELETE", ev(x.id));
      if (r.ok || gone(r.status)) dupes++; else failed++;
    }
    const plan = PT.calPlan(PT.wantedEvents(st.snapshot, st.details, PT.effectiveHidden(st), Date.now(), st.webDone), calSync, Object.assign({}, PT.CONFIG_DEFAULTS, st.config || {}), PT.FEATURES.keepPast ? {
      now: Date.now(),
      mustGo: PT.calMustGo(st.snapshot)
    } : undefined);
    total = plan.create.length + plan.update.length + plan.remove.length;
    if (total) await set({
      calProg: {
        done: 0,
        total: total
      }
    });
    for (const c of plan.create) {
      const r = await gapi("POST", ev(), c.resource);
      if (r.ok) {
        calSync[c.key] = {
          id: r.j.id,
          sig: c.sig,
          due: c.due
        };
        done++;
        await save();
      } else failed++;
    }
    for (const u of plan.update) {
      let r = await gapi("PATCH", ev(u.id), u.resource);
      if (gone(r.status)) r = await gapi("POST", ev(), u.resource);
      if (r.ok) {
        calSync[u.key] = {
          id: r.j.id,
          sig: u.sig,
          due: u.due
        };
        done++;
        await save();
      } else failed++;
    }
    for (const d of plan.remove) {
      const r = await gapi("DELETE", ev(d.id));
      if (r.ok || gone(r.status)) {
        delete calSync[d.key];
        done++;
        await save();
      } else failed++;
    }
    await save(true);
    await setGcal({
      lastSync: Date.now(),
      needsReconnect: false,
      error: failed ? failed + " calendar change(s) failed; retried next time" : null
    });
    return {
      ok: true,
      done: done,
      failed: failed,
      dupes: dupes
    };
  } catch (e) {
    await set(Object.keys(calSync).length ? {
      calSync: calSync,
      calProg: null
    } : {
      calProg: null
    });
    if (e instanceof AuthNeeded) {
      const g = (await chrome.storage.local.get("gcal")).gcal || {};
      if (g.connected) await setGcal({
        needsReconnect: true
      });
    } else await setGcal({
      error: String(e && e.message || e).slice(0, 80)
    });
    return {
      error: String(e && e.message || e)
    };
  } finally {
    syncing = false;
    await chrome.storage.session.remove("syncLock");
    if (syncAgain) {
      syncAgain = false;
      syncCalendar("again");
    }
  }
}

async function calMissing() {
  await setGcal({
    calId: null,
    calMissing: true,
    calMissingAt: Date.now()
  });
  await set({
    calSync: {},
    calBackup: null
  });
  await forgetPortalBackup();
}

async function forgetPortalBackup() {
  try {
    for (const t of await chrome.tabs.query({
      url: "https://placements.isb.edu/*"
    })) await chrome.scripting.executeScript({
      target: {
        tabId: t.id
      },
      func: k => {
        try {
          localStorage.removeItem(k);
        } catch (e) {}
      },
      args: [ PT.CAL_KEY ]
    });
  } catch (e) {}
}

async function calStillThere() {
  const {gcal: gcal} = await get([ "gcal" ]);
  if (!gcal || !gcal.connected || !gcal.calId || gcal.calMissing || gcal.needsReconnect) return;
  if (gcal.calCreatedAt && Date.now() - gcal.calCreatedAt < 10 * 60 * 1e3) return;
  const r = await gapi("GET", "/calendars/" + encodeURIComponent(gcal.calId));
  if (r.status === 404 || r.status === 410) await calMissing();
}

async function gcalRemake() {
  await setGcal({
    calMissing: false,
    calMissingAt: null,
    calId: null,
    error: null
  });
  await set({
    calSync: {},
    calBackup: null
  });
  await forgetPortalBackup();
  return syncCalendar("remake");
}

async function gcalConnect() {
  try {
    await googleToken(true);
  } catch (e) {
    await setGcal({
      error: "Google sign-in didn't finish: " + String(e && e.message || e).slice(0, 60).replace(/[.\s]+$/, "")
    });
    return {
      ok: false
    };
  }
  await setGcal({
    connected: true,
    everConnected: true,
    connectedAt: Date.now(),
    needsReconnect: false,
    error: null
  });
  return syncCalendar("connect");
}

async function gcalDisconnect() {
  await chrome.storage.session.remove([ "gToken", "gExp" ]);
  await setGcal({
    connected: false,
    everConnected: true,
    disconnectedAt: Date.now(),
    needsReconnect: false
  });
  return {
    ok: true
  };
}

const SHEET_NAME = "Placement Tracker · my jobs", XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const SHEET_PAY = false, SHEET_ELIGIBLE = false;

async function driveToken(force) {
  let {gToken: gToken, gExp: gExp, gDrive: gDrive} = await chrome.storage.session.get([ "gToken", "gExp", "gDrive" ]);
  if (force || !gToken || !gDrive || Date.now() > (gExp || 0) - 6e4) {
    const g = await googleToken(false, true);
    if (!/\bdrive\.file\b/.test(g.scope)) throw new AuthNeeded("no drive access");
    await chrome.storage.session.set({
      gDrive: true
    });
    ({gToken: gToken} = await chrome.storage.session.get("gToken"));
  }
  return gToken;
}

async function gUpload(method, url, body, type, retried) {
  const tok = await driveToken(retried);
  const r = await fetch(url, {
    method: method,
    headers: Object.assign({
      Authorization: "Bearer " + tok
    }, type ? {
      "Content-Type": type
    } : {}),
    body: body,
    credentials: "omit"
  });
  if ((r.status === 401 || r.status === 403) && !retried) return gUpload(method, url, body, type, true);
  const j = await r.json().catch(() => ({}));
  return {
    ok: r.ok,
    status: r.status,
    j: j
  };
}

async function sheetData() {
  const st = await get([ "snapshot", "details", "hiddenJobs", "plus", "stars", "clDone", "webDone", "sheet" ]);
  const t = PT.sheetTable(st.snapshot || {}, st.details || {}, {
    now: Date.now(),
    hidden: PT.effectiveHidden(st),
    stars: st.stars,
    clDone: st.clDone,
    webDone: st.webDone,
    sheetJobs: (st.sheet || {}).jobs,
    pay: SHEET_PAY,
    eligible: SHEET_ELIGIBLE
  });
  const j = JSON.stringify([ t.rows, t.counters.rows ]);
  return {
    t: t,
    sig: PTX.crc32((new TextEncoder).encode(j)).toString(16) + ":" + j.length
  };
}

async function sheetBytes() {
  const {t: t, sig: sig} = await sheetData();
  const bytes = PTX.workbook([ {
    name: "My jobs",
    groups: t.groups,
    header: t.header,
    rows: t.rows,
    filterRows: 3e3
  }, {
    name: "Counters",
    header: t.counters.header,
    rows: t.counters.rows
  } ]);
  return {
    bytes: bytes,
    sig: sig
  };
}

const setSheet = async patch => {
  const {gsheet: gsheet} = await get([ "gsheet" ]);
  await set({
    gsheet: Object.assign({}, gsheet || {}, patch)
  });
};

const SHEET_WAIT = 12e4, SHEET_LATE = "Google didn't finish. If a Google window is open somewhere, finish it there; otherwise try again.";

async function makeGSheet() {
  usage("pt_sheet_make");
  const {snapshot: snapshot} = await get([ "snapshot" ]);
  if (!snapshot) return {
    error: "Open the placement portal once first"
  };
  await setSheet({
    busy: true,
    busyAt: Date.now(),
    error: null
  });
  let timer;
  const late = new Promise(res => {
    timer = setTimeout(res, self.PT_SHEET_WAIT || SHEET_WAIT, "late");
  });
  const r = await Promise.race([ makeGSheetNow(), late ]);
  clearTimeout(timer);
  if (r === "late") {
    await setSheet({
      busy: false,
      error: SHEET_LATE
    });
    return {
      error: "timeout"
    };
  }
  return r;
}

async function makeGSheetNow() {
  try {
    const g = await googleToken(true, true);
    if (!/\bdrive\.file\b/.test(g.scope)) {
      await setSheet({
        busy: false,
        error: "Google didn't give access to the Sheet. Try again and tick the Drive box."
      });
      return {
        error: "no access"
      };
    }
    await setSheet({
      granted: true,
      needsAccess: false
    });
    const {gsheet: gsheet} = await get([ "gsheet" ]);
    if (gsheet && gsheet.id) {
      await setSheet({
        busy: false,
        at: 0,
        sig: ""
      });
      await syncGSheet();
      chrome.tabs.create({
        url: gsheet.url
      });
      return {
        ok: true
      };
    }
    const {bytes: bytes, sig: sig} = await sheetBytes(), b = "pt" + rand();
    const meta = JSON.stringify({
      name: SHEET_NAME,
      mimeType: "application/vnd.google-apps.spreadsheet"
    });
    const body = new Blob([ `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${b}\r\nContent-Type: ${XLSX}\r\n\r\n`, bytes, `\r\n--${b}--` ]);
    const r = await gUpload("POST", "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink", body, "multipart/related; boundary=" + b);
    if (!r.ok || !r.j.id) {
      await setSheet({
        busy: false,
        error: "Couldn't make the Sheet (" + r.status + "). Try again."
      });
      return {
        error: String(r.status)
      };
    }
    const url = r.j.webViewLink || "https://docs.google.com/spreadsheets/d/" + r.j.id + "/edit";
    await setSheet({
      busy: false,
      error: null,
      id: r.j.id,
      url: url,
      sig: sig,
      at: Date.now()
    });
    chrome.tabs.create({
      url: url
    });
    return {
      ok: true
    };
  } catch (e) {
    const m = String(e && e.message || e);
    await setSheet({
      busy: false,
      error: /closed|did not approve|cancel/i.test(m) ? null : "Couldn't reach Google. Try again."
    });
    return {
      error: m
    };
  }
}

let gsxBusy = false;

function soonSheet(ms) {
  chrome.alarms.create("pt-gsheet", {
    when: Date.now() + Math.max(1e3, ms)
  });
}

async function syncGSheet() {
  const {gsheet: gsheet} = await get([ "gsheet" ]);
  if (!gsheet || !gsheet.id || gsxBusy) return;
  if (gsheet.at && Date.now() - gsheet.at < 3 * 6e4) {
    soonSheet(3 * 6e4 - (Date.now() - gsheet.at) + 1e3);
    return;
  }
  gsxBusy = true;
  try {
    const {t: t, sig: sig} = await sheetData();
    if (sig === gsheet.sig) return;
    const base = "https://sheets.googleapis.com/v4/spreadsheets/" + encodeURIComponent(gsheet.id) + "/values";
    const clear = await gUpload("POST", base + ":batchClear", JSON.stringify({
      ranges: [ "'My jobs'!A3:AZ", "'Counters'!A2:Z" ]
    }), "application/json");
    if (clear.status === 404) {
      await set({
        gsheet: {
          granted: gsheet.granted
        }
      });
      return;
    }
    if (!clear.ok) {
      await setSheet({
        at: Date.now(),
        needsAccess: clear.status === 401 || clear.status === 403
      });
      return;
    }
    const r = await gUpload("POST", base + ":batchUpdate", JSON.stringify({
      valueInputOption: "USER_ENTERED",
      data: [ {
        range: "'My jobs'!A3",
        values: t.rows.map(row => row.map(v => v === null || v === undefined ? "" : v))
      }, {
        range: "'Counters'!A2",
        values: t.counters.rows
      } ]
    }), "application/json");
    if (r.ok) await setSheet({
      sig: sig,
      at: Date.now(),
      error: null,
      needsAccess: false
    }); else await setSheet({
      at: Date.now(),
      needsAccess: r.status === 401 || r.status === 403
    });
  } catch (e) {
    if (e instanceof AuthNeeded) await setSheet({
      needsAccess: true
    }); else if (e instanceof TypeError) await replaceGSheet(gsheet).catch(() => {});
  } finally {
    gsxBusy = false;
  }
}

async function replaceGSheet(gsheet) {
  const {bytes: bytes, sig: sig} = await sheetBytes();
  const r = await gUpload("PATCH", "https://www.googleapis.com/upload/drive/v3/files/" + encodeURIComponent(gsheet.id) + "?uploadType=media&fields=id", new Blob([ bytes ]), XLSX);
  if (r.status === 404) {
    await set({
      gsheet: {
        granted: gsheet.granted
      }
    });
    return;
  }
  await setSheet(r.ok ? {
    sig: sig,
    at: Date.now(),
    error: null
  } : {
    at: Date.now()
  });
}

async function openGSheet() {
  usage("pt_sheet_open");
  const {gsheet: gsheet} = await get([ "gsheet" ]);
  if (!gsheet || !gsheet.url) return {
    error: "no sheet"
  };
  chrome.tabs.create({
    url: gsheet.url
  });
  soonSheet(1e3);
  return {
    ok: true
  };
}

let niTimer = 0;

chrome.storage.onChanged.addListener((ch, area) => {
  if (area !== "local") return;
  if (ch.hiddenJobs || ch.plus || ch.webDone) {
    clearTimeout(niTimer);
    niTimer = setTimeout(() => syncCalendar(ch.plus ? "isb plus marks" : ch.webDone ? "marked done" : "not interested"), 2e3);
  }
  if (ch.snapshot && ch.snapshot.newValue) clearNiOnApply(ch.snapshot.newValue);
  if (ch.snapshot || ch.details || ch.hiddenJobs || ch.plus || ch.stars || ch.clDone || ch.webDone) soonSheet(2e4);
});

async function clearNiOnApply(snap) {
  const {hiddenJobs: hiddenJobs} = await get([ "hiddenJobs" ]), h = Object.assign({}, hiddenJobs || {});
  const ids = PT.niApplied(snap, h);
  if (!ids.length) return;
  ids.forEach(id => delete h[id]);
  await set({
    hiddenJobs: h
  });
}

let movesQ = Promise.resolve();

const dayIST = s => {
  const d = PT.parseIST(s);
  return d ? d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata"
  }).replace(",", "") : "no date";
};

const payTxt = d => {
  const c = PT.ctcInfo(d && d.ctc, d && d.cur);
  return c.na ? "not disclosed" : String(c.label || "").replace(/^CTC:\s*/, "");
};

function watchMoves(ch) {
  if (!ch.snapshot && !ch.details) return;
  movesQ = movesQ.then(async () => {
    const st = await get([ "hiddenJobs", "backJobs", "changes", "snapshot", "unseen" ]), now = Date.now(), snap = st.snapshot || {};
    const hid = Object.assign({}, st.hiddenJobs || {}), back = Object.assign({}, st.backJobs || {}), applied = new Set((snap.apps || []).map(a => a.id));
    const open = new Map((snap.jobs || []).filter(j => !j.deadline || (PT.parseIST(j.deadline) || 0) > now).map(j => [ j.id, j ]));
    const name = id => {
      const j = open.get(id) || (snap.apps || []).find(a => a.id === id);
      return j ? j.company + " · " + j.role : "";
    };
    const notes = {}, log = [];
    if (ch.snapshot) {
      const o = ch.snapshot.oldValue || {}, was = {};
      (o.closedJobs || []).concat(o.jobs || []).forEach(j => {
        if (j && j.id) was[j.id] = j.deadline;
      });
      for (const [id, j] of open) if (hid[id] && !applied.has(id) && was[id] !== undefined && was[id] !== j.deadline) notes[id] = "Deadline moved: " + dayIST(was[id]) + " → " + dayIST(j.deadline);
    }
    if (ch.details) {
      const o = ch.details.oldValue || {}, n = ch.details.newValue || {};
      for (const id of Object.keys(n)) {
        const a = o[id], b = n[id];
        if (!a || !b || (a.v || 1) !== (b.v || 1) || !(open.has(id) || applied.has(id))) continue;
        const pay = (a.ctc || "") !== (b.ctc || "") || (a.cur || "") !== (b.cur || ""), elig = a.eligible === false && b.eligible === true;
        if (pay) {
          const t = "Pay changed: " + payTxt(a) + " → " + payTxt(b);
          log.push({
            kind: "pay",
            co: (open.get(id) || {}).company || "",
            job: id,
            text: name(id) + ": " + t.toLowerCase().replace(/^pay/, "pay"),
            at: now
          });
          if (hid[id] && !applied.has(id)) notes[id] = notes[id] ? notes[id] + " · " + t : t;
        }
        if (elig) {
          log.push({
            kind: "elig",
            co: (open.get(id) || {}).company || "",
            job: id,
            text: name(id) + ": you're now eligible",
            at: now
          });
          if (hid[id] && !applied.has(id)) notes[id] = notes[id] ? notes[id] + " · You're now eligible" : "You're now eligible";
        }
      }
    }
    const ids = Object.keys(notes);
    if (!ids.length && !log.length) return;
    for (const id of ids) {
      delete hid[id];
      back[id] = {
        text: notes[id],
        at: now
      };
      log.push({
        kind: "back",
        job: id,
        co: (open.get(id) || {}).company || "",
        text: name(id) + ": back from Not interested (" + notes[id] + ")",
        at: now
      });
    }
    const out = {
      changes: log.concat(st.changes || []).slice(0, 20),
      unseen: (st.unseen || 0) + log.length
    };
    if (ids.length) Object.assign(out, {
      hiddenJobs: hid,
      backJobs: back
    });
    await set(out);
    refreshBadge();
    if (ids.length) syncCalendar("back from not interested");
  }).catch(() => {});
}

chrome.storage.onChanged.addListener((ch, area) => {
  if (area === "local") watchMoves(ch);
});

function wnOnUpdate(prev) {
  return PT.wnFrom(prev) ? set({
    whatsNewDue: "2.0.4"
  }) : chrome.storage.local.remove("whatsNewDue");
}

chrome.storage.onChanged.addListener((ch, area) => {
  if (area !== "local" || !ch.snapshot || !ch.snapshot.newValue) return;
  get([ "slHist" ]).then(x => {
    const h = PT.slRecord(x.slHist, ch.snapshot.newValue.apps, Date.now());
    if (h) set({
      slHist: h
    });
  }).catch(() => {});
});