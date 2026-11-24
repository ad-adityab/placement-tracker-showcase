const $ = id => document.getElementById(id);

const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;"
}[c]));

const PORTAL = "https://placements.isb.edu/#/student/home";

let CFG = Object.assign({}, PT.CONFIG_DEFAULTS);

const count = (name, params) => chrome.runtime.sendMessage({
  type: "PT_COUNT",
  name: name,
  params: params
}).catch(() => {});

const win = action => count("pt_window", {
  action: action
});

const ago = t => {
  const m = Math.round((Date.now() - t) / 6e4);
  return m < 1 ? "just now" : m < 60 ? m + " min ago" : Math.round(m / 60) + " h ago";
};

const OUTLOOK_GUIDE = "https://drive.google.com/file/d/1bGia0Ag0K3ti2ggG3mOgN2uRvqxryD8n/view?usp=sharing";

let confirmOff = false;

const item = (n, done, off, title, right, more) => `<div class="item${done ? " done" : ""}${off ? " off" : ""}" data-step="${n}"><div class="num">${done ? "✓" : n}</div><div class="t">${title}</div><div class="r">${right}</div>${more || ""}</div>`;

function stepGoogle(st, wanted) {
  const g = st.gcal || {};
  if (!PT.googleReady()) return item("📅", false, true, "Google Calendar", "", `<div class="d">Test build: Google Calendar isn't set up in this build yet (its Google client ID is missing), so the calendar is off.</div>`);
  const sw = on => `<span class="pseg"><button data-gcal="${on ? "off" : "noop"}" class="${on ? "" : "on"}" aria-pressed="${!on}">Off</button><button data-gcal="${on ? "noop" : "connect"}" class="${on ? "on" : ""}" aria-pressed="${on}">On</button></span>`;
  if (!g.connected) return item("📅", false, false, `Google Calendar <span class="opt">· optional</span>`, sw(false), `<div class="d">${g.everConnected ? "Off. Entries already in your calendar have stopped updating; turn it on to keep them current." : "Deadlines in a “Placement Tracker” calendar in your Google account, if you want them. Same as the 📅 Calendar switch on the portal's right edge."}\n      <span class="fine">It can't see or change your other calendars or events.</span></div>${g.error ? `<div class="d gerr">${esc(String(g.error).replace(/[.\s]+$/, ""))}. Try again, or ask for help below.</div>` : ""}`);
  if (g.needsReconnect) return item("📅", false, false, "Google needs you to sign in again", `<button class="btn p" data-gcal="connect">Sign in again</button>`, `<div class="d">Nothing is lost; the tracker catches up as soon as you do.</div>`);
  if (g.calMissing) return item("📅", false, false, '<span class="bad">!</span> Your calendar was deleted', `<button class="btn p" data-gcal="remake">Make a new one</button>`, `<div class="d">The “Placement Tracker” calendar is gone from your Google account, and its entries with it. A new one gets every entry back.</div>`);
  const help = st.gcalHelp ? `<div class="d ghelp"><b>iPhone:</b> ${esc(CFG.phone_help_iphone)}<br><b>Android:</b> ${esc(CFG.phone_help_android)}</div>` : "";
  const what = st.paused ? "kept as they are" : `updated ${g.lastSync ? ago(g.lastSync) : "…"}`;
  return item("📅", true, false, `Google Calendar <span class="opt">· optional</span>`, sw(true), `<div class="mini"><span class="m">${wanted.length} entr${wanted.length === 1 ? "y" : "ies"} · ${what}${g.error ? ` · <span title="${esc(g.error)}">some changes will retry</span>` : ""}</span><span class="rcol row"><a href="#" data-gcal="help">${st.gcalHelp ? "Hide" : "On your phone ↗"}</a><button class="btn s xs" id="outlook">📅 Outlook guide ↗</button></span></div>${help}`);
}

function stepCool(st) {
  const plus = !!(st.plus && st.plus.active), on = st.coolUI !== false && !plus;
  const d = plus ? "Off while <b>ISB Placements Plus</b> is on: two extensions redrawing the same page would be a mess. Turn it off in chrome://extensions and reload the portal, and Cool UI comes back." : "Same as the pill at the bottom of the portal";
  return item("✓", true, false, "Portal look", `<span class="pseg${plus ? " dis" : ""}"><button data-look="boring" class="${on ? "" : "on"}" ${plus ? "disabled" : ""}>Boring UI</button><button data-look="cool" class="${on ? "on" : ""}" ${plus ? "disabled" : ""}>✨ Cool UI</button></span>`, `<div class="mini"><span class="m">${d}</span></div>`);
}

const stepOutlook = () => item(3, false, false, `Outlook calendar <span class="opt">· optional</span>`, `<button class="btn s" id="outlook">Open guide ↗</button>`, `<div class="d">Use Outlook? See the same deadlines there too. A 2-minute guide (PDF): the Outlook app on your phone, or Outlook on your laptop.</div>`);

const FORM_FILL = ((chrome.runtime.getManifest && chrome.runtime.getManifest() || {}).content_scripts || []).some(c => (c.js || []).includes("formfill.js")) && PT.FEATURES.formFill;

let showAll = false, editing = null, confirmClear = false;

let undo = null;

const keepUndo = (state, label) => {
  if (undo) clearTimeout(undo.timer);
  undo = {
    state: state,
    label: label,
    timer: setTimeout(() => {
      undo = null;
      load();
    }, 3e4)
  };
};

let pfOpen = false, pEditing = null, saOpen = false;

function stepAnswers(st) {
  const on = st.ffOn !== false, all = Object.entries(st.ffAnswers || {}).sort((a, b) => String(a[1].q).localeCompare(String(b[1].q), "en", {
    numeric: true
  }));
  const shown = showAll ? all : all.slice(0, 5);
  const qText = q => String(q || "").replace(/^Q\d+\.\s*/, "");
  const rows = shown.map(([k, v]) => `<div class="sa"><span class="q" title="${esc(qText(v.q))}">${esc(qText(v.q))}</span>${editing === k ? `<input type="text" id="saedit" value="${esc(v.a)}"><a href="#" data-sa="save" data-k="${esc(k)}">Save</a>` : `<em title="${esc(v.a)}">${esc(v.a)}</em><a href="#" data-sa="edit" data-k="${esc(k)}">Edit</a><a href="#" data-sa="del" data-k="${esc(k)}" class="del">Delete</a>`}</div>`).join("");
  const more = all.length > 5 ? `<a href="#" data-sa="more">${showAll ? "Show fewer" : `… ${all.length - 5} more · Show all`}</a>` : "";
  const und = undo ? `<span class="saundo">${esc(undo.label)} · <a href="#" data-sa="undo">Undo</a></span>` : "";
  const pfN = ((st.ffProfile || {}).list || []).length;
  const clear = all.length || pfN ? confirmClear ? `<span>Clear all saved answers? <a href="#" data-sa="clear-yes" class="del">Yes</a> <a href="#" data-sa="clear-no">No</a></span>` : `<a href="#" data-sa="clear" class="del">Clear all</a>` : "";
  const ed = st.ffProfileEdits || {}, pl = ((st.ffProfile || {}).list || []).map(x => ({
    id: x.id,
    label: x.label,
    v: x.id in ed ? ed[x.id] : x.v
  })).filter(x => x.v);
  const prow = x => `<div class="sa"><span class="q" title="${esc(x.label)}">${esc(x.label)}</span>${pEditing === x.id ? `<input type="text" id="pfedit" value="${esc(x.v)}"><a href="#" data-sa="psave" data-k="${esc(x.id)}">Save</a>` : `<em title="${esc(x.v)}">${esc(x.v)}</em><a href="#" data-sa="pedit" data-k="${esc(x.id)}">Edit</a><a href="#" data-sa="pdel" data-k="${esc(x.id)}" class="del">Delete</a>`}</div>`;
  const pf = st.ffProfile && st.ffProfile.cleared ? `<div class="mini"><a href="#" data-sa="preread">Read my details from the portal profile again</a></div>` : st.ffProfile ? `<details class="pfgrp"${pfOpen ? " open" : ""}><summary data-sa="pftoggle">${pl.length} answer${pl.length === 1 ? "" : "s"} ready from your portal profile</summary><div class="salist">${pl.map(prow).join("")}</div><div class="mini"><a href="#" data-sa="preread">${st.ffProfile.at || 0 ? "Read again from the portal" : "Read again on your next Apply page"}</a></div></details>` : "";
  const nAns = all.length + pl.length;
  return item("✎", on && nAns > 0, false, `Saved answers${nAns ? " · " + nAns : ""}`, `<span class="rcol row"><a href="#" data-sa="manage">${saOpen ? "Close ▴" : "Manage ▸"}</a><label class="sw"><input type="checkbox" id="ffon" ${on ? "checked" : ""}><span></span></label></span>`, `<div class="mini"><span class="m">Fills recruiter forms on the Apply page · this computer only · you always press Submit</span></div>` + (!saOpen ? "" : `\n     ${pf}${all.length ? `<div class="salist">${rows}</div><div class="mini">${und}${more}${clear}</div>` : und || pl.length ? `<div class="mini">${und}${pl.length && !und ? clear : ""}</div>` : `<div class="d"><span class="fine">Nothing saved yet: fill one recruiter form and submit it, and its answers are saved for next time.${st.ffProfile ? "" : " Your basic details are read from your portal profile the first time you open a job's Apply page."}</span></div>`}`));
}

const USAGE_NOTE_OPENS = 3;

function usageBar(st) {
  const on = st.usageOff !== true, fresh = (st.usageOpens || 0) <= USAGE_NOTE_OPENS;
  return `<span class="ut">📊 ${fresh ? "Anonymous usage counts (which features get used, never anything about you) help improve the tracker" : "Anonymous usage counts"}</span>\n    <label class="sw sm" title="${on ? "Turn off" : "Turn on"} anonymous usage counts"><input type="checkbox" id="usage" ${on ? "checked" : ""}><span></span>${on ? "On" : "Off"}</label>\n    <span class="ut">💡 Tips and reminders</span>\n    <label class="sw sm" title="${st.nudgeOff ? "Turn on" : "Turn off"} tips and reminders on the portal"><input type="checkbox" id="tips" ${st.nudgeOff ? "" : "checked"}><span></span>${st.nudgeOff ? "Off" : "On"}</label>`;
}

function render(st) {
  CFG = Object.assign({}, PT.CONFIG_DEFAULTS, st.config || {});
  const snap = st.snapshot;
  const stale = st.lastCheck && Date.now() - st.lastCheck > 6 * 36e5;
  $("checked").textContent = st.paused ? "Paused until you next sign in to the portal" : stale ? "Not updated since " + new Date(st.lastCheck).toLocaleString("en-IN", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata"
  }) + ". Open the placement portal once to bring it up to date." : st.lastCheck ? "Checked " + ago(st.lastCheck) : "Not checked yet";
  $("checked").classList.toggle("stale", !!stale);
  if (!st.paused && !stale) {
    $("checked").insertAdjacentHTML("beforeend", ` <span class="quiet" aria-hidden="true">ⓘ</span>`);
    $("checked").title = "Updates while the portal is open, and every 2 hours in a background tab";
  }
  const wanted = snap ? PT.wantedEvents(snap, st.details, PT.effectiveHidden(st)) : [];
  let banner = "";
  if (CFG.announcement) banner += `<div class="alert note">📣 ${esc(CFG.announcement)}${CFG.announcement_link ? ` <a href="${esc(CFG.announcement_link)}" target="_blank" rel="noopener">More ↗</a>` : ""}</div>`;
  if (CFG.checks_paused) banner += `<div class="alert amb">Portal checks are paused for now. Your calendar keeps what it has.</div>`; else if (st.lastError && !st.paused) banner += `<div class="alert amb">Last check had a problem: ${esc(st.lastError)}</div>`;
  if (st.copies && st.copies.n > 1 && Date.now() - (st.copies.at || 0) < 3 * 864e5) banner += `<div class="alert amb"><b>Two copies of Placement Tracker are on in this Chrome.</b> Keep one (chrome://extensions → remove the other), or you'll get two calendars.</div>`;
  $("banner").innerHTML = banner;
  $("steps").innerHTML = stepCool(st) + stepGoogle(st, wanted) + (FORM_FILL ? stepAnswers(st) : "");
  $("usagebar").innerHTML = usageBar(st);
  const apps = snap ? (snap.apps || []).length : 0;
  $("sum").innerHTML = !snap ? st.paused ? "" : `Reading your placement portal for the first time… a few seconds. You need to be logged in to the portal.` : `${PT.openJobs(snap).length} open jobs · ${apps} applied${(st.gcal || {}).connected ? ` · ${wanted.length} calendar entr${wanted.length === 1 ? "y" : "ies"}` : ""}. Open the portal to see them.`;
  $("now").hidden = !!st.paused;
}

document.addEventListener("click", async e => {
  if (e.target.closest("[data-wa], #help")) {
    e.preventDefault();
    win("help");
    chrome.tabs.create({
      url: PT.waLink(CFG)
    });
    return;
  }
  if (e.target.closest("#outlook")) {
    e.preventDefault();
    win("outlook_guide");
    chrome.tabs.create({
      url: OUTLOOK_GUIDE
    });
    return;
  }
  if (e.target.closest("#tbc")) {
    e.preventDefault();
    win("tbc");
    chrome.tabs.create({
      url: TBC_HOME
    });
    return;
  }
  const t = e.target.closest("[data-gcal]");
  if (!t) return;
  e.preventDefault();
  const st = await chrome.storage.local.get([ "gcalHelp" ]);
  if (t.dataset.gcal === "noop") return;
  if (t.dataset.gcal === "help") {
    if (!st.gcalHelp) win("phone_help");
    await chrome.storage.local.set({
      gcalHelp: !st.gcalHelp
    });
  } else if (t.dataset.gcal === "disconnect") {
    confirmOff = true;
    load();
  } else if (t.dataset.gcal === "keep") {
    confirmOff = false;
    load();
  } else if (t.dataset.gcal === "off") {
    confirmOff = false;
    win("cal_off");
    chrome.runtime.sendMessage({
      type: "PT_GCAL_DISCONNECT"
    }).catch(() => {});
  } else if (t.dataset.gcal === "connect") {
    win(((await chrome.storage.local.get("gcal")).gcal || {}).everConnected ? "cal_reconnect" : "cal_connect");
    chrome.runtime.sendMessage({
      type: "PT_GCAL_CONNECT"
    }).catch(() => {});
  } else if (t.dataset.gcal === "remake") {
    win("cal_remake");
    t.textContent = "Making a new one…";
    t.disabled = true;
    chrome.runtime.sendMessage({
      type: "PT_GCAL_REMAKE"
    }).catch(() => {});
  }
});

document.addEventListener("click", e => {
  const b = e.target.closest("[data-look]");
  if (!b || b.disabled) return;
  e.preventDefault();
  const cool = b.dataset.look === "cool";
  win(cool ? "cool_on" : "cool_off");
  chrome.storage.local.set({
    coolUI: cool
  });
});

document.addEventListener("change", e => {
  if (e.target.id === "cool") {
    win(e.target.checked ? "cool_on" : "cool_off");
    chrome.storage.local.set({
      coolUI: e.target.checked
    });
  }
  if (e.target.id === "ffon") {
    win(e.target.checked ? "formfill_on" : "formfill_off");
    chrome.storage.local.set({
      ffOn: e.target.checked
    });
  }
  if (e.target.id === "usage") chrome.storage.local.set({
    usageOff: !e.target.checked
  });
  if (e.target.id === "tips") {
    chrome.storage.local.set({
      nudgeOff: !e.target.checked
    });
    chrome.runtime.sendMessage({
      type: "PT_COUNT",
      name: "pt_nudge",
      params: {
        action: e.target.checked ? "tips_on" : "tips_off"
      }
    }).catch(() => {});
  }
});

document.addEventListener("click", async e => {
  const a = e.target.closest("[data-sa]");
  if (!a) return;
  if (a.dataset.sa === "pftoggle") {
    pfOpen = !pfOpen;
    return;
  }
  if (a.dataset.sa === "manage") {
    e.preventDefault();
    saOpen = !saOpen;
    if (saOpen) win("answers_manage");
    load();
    return;
  }
  e.preventDefault();
  const k = a.dataset.k, cur = await chrome.storage.local.get([ "ffAnswers", "ffProfile", "ffProfileEdits" ]), all = Object.assign({}, cur.ffAnswers || {}), edits = Object.assign({}, cur.ffProfileEdits || {});
  const snap = () => ({
    ffAnswers: Object.assign({}, all),
    ffProfile: cur.ffProfile || null,
    ffProfileEdits: Object.assign({}, edits)
  });
  if (a.dataset.sa === "pedit") {
    pEditing = k;
    pfOpen = true;
  } else if (a.dataset.sa === "psave") {
    win("answer_edit");
    const v = ($("pfedit") || {}).value;
    if (v !== undefined) {
      edits[k] = String(v).trim().slice(0, 500);
      pEditing = null;
      await chrome.storage.local.set({
        ffProfileEdits: edits
      });
      return;
    }
    pEditing = null;
  } else if (a.dataset.sa === "pdel") {
    win("answer_delete");
    keepUndo(snap(), "Deleted");
    edits[k] = "";
    await chrome.storage.local.set({
      ffProfileEdits: edits
    });
    return;
  } else if (a.dataset.sa === "preread") {
    await chrome.storage.local.set({
      ffProfile: {
        at: 0,
        list: (cur.ffProfile || {}).list || []
      }
    });
    return;
  } else if (a.dataset.sa === "more") showAll = !showAll; else if (a.dataset.sa === "edit") editing = k; else if (a.dataset.sa === "save") {
    win("answer_edit");
    const v = ($("saedit") || {}).value;
    if (all[k] && v !== undefined) {
      all[k] = Object.assign({}, all[k], {
        a: String(v).trim().slice(0, 1e3),
        at: Date.now()
      });
      editing = null;
      await chrome.storage.local.set({
        ffAnswers: all
      });
      return;
    }
    editing = null;
  } else if (a.dataset.sa === "del") {
    win("answer_delete");
    keepUndo(snap(), "Deleted");
    delete all[k];
    await chrome.storage.local.set({
      ffAnswers: all
    });
    return;
  } else if (a.dataset.sa === "undo") {
    win("answers_undo");
    if (undo) {
      const s = undo.state, back = Object.assign({}, s.ffAnswers, all);
      clearTimeout(undo.timer);
      undo = null;
      await chrome.storage.local.set({
        ffAnswers: back,
        ffProfileEdits: s.ffProfileEdits || {}
      });
      if (s.ffProfile) await chrome.storage.local.set({
        ffProfile: s.ffProfile
      }); else await chrome.storage.local.remove("ffProfile");
      return;
    }
  } else if (a.dataset.sa === "clear") confirmClear = true; else if (a.dataset.sa === "clear-no") confirmClear = false; else if (a.dataset.sa === "clear-yes") {
    win("answers_clear");
    confirmClear = false;
    keepUndo(snap(), "All saved answers cleared");
    await chrome.storage.local.set({
      ffAnswers: {},
      ffProfileEdits: {},
      ffProfile: {
        at: Date.now(),
        list: [],
        cleared: true
      }
    });
    return;
  }
  load();
});

const TBC_HOME = "https://thebettercampus.netlify.app/?utm_source=placement_tracker&utm_medium=extension&utm_campaign=tracker_link&utm_content=footer";

$("portal").onclick = e => {
  e.preventDefault();
  win("open_portal");
  chrome.tabs.create({
    url: PORTAL
  });
};

$("share").onclick = async e => {
  e.preventDefault();
  count("pt_share", "popup").catch(() => {});
  const a = $("share"), rest = [ ...a.parentElement.children ].filter(x => x !== a);
  rest.forEach(x => {
    x.hidden = true;
  });
  try {
    await navigator.clipboard.writeText(PT.shareText("popup"));
    a.textContent = "✓ Copied 🎉 Paste it in WhatsApp or anywhere";
  } catch (x) {
    a.textContent = "Couldn't copy · try again";
  }
  setTimeout(() => {
    a.textContent = "🔗 Share";
    rest.forEach(x => {
      x.hidden = false;
    });
  }, 4e3);
};

$("remove").onclick = e => {
  e.preventDefault();
  try {
    chrome.management.uninstallSelf({
      showConfirmDialog: true
    });
  } catch (x) {}
};

$("fb").onclick = e => {
  e.preventDefault();
  count("pt_feedback", "popup").catch(() => {});
  chrome.tabs.create({
    url: PT.FEEDBACK_URL
  });
};

const nowLbl = () => $("now").querySelector("b");

$("now").onclick = async e => {
  e.preventDefault();
  win("check_now");
  nowLbl().textContent = "Checking…";
  await chrome.runtime.sendMessage({
    type: "PT_CHECK_NOW"
  }).catch(() => {});
  nowLbl().textContent = "Check now";
  load();
};

async function load() {
  render(await chrome.storage.local.get(null));
  chrome.runtime.sendMessage({
    type: "PT_SEEN"
  }).catch(() => {});
}

chrome.storage.onChanged.addListener(load);

chrome.storage.local.get("usageOpens").then(v => chrome.storage.local.set({
  usageOpens: (v.usageOpens || 0) + 1
})).catch(() => {}).finally(load);

count("pt_popup_open");

(() => {
  const el = document.getElementById("ver");
  if (!el) return;
  const m = chrome.runtime.getManifest();
  let n = 0, t = 0;
  const draw = off => {
    el.textContent = "v" + (m.version_name || m.version) + (off ? " · not counted on this computer" : "");
  };
  chrome.storage.local.get([ "devNoCount" ]).then(s => draw(s.devNoCount === true));
  el.addEventListener("click", async () => {
    const now = Date.now();
    n = now - t < 3e3 ? n + 1 : 1;
    t = now;
    if (n < 5) return;
    n = 0;
    const {devNoCount: devNoCount} = await chrome.storage.local.get([ "devNoCount" ]);
    const off = devNoCount !== true;
    await chrome.storage.local.set({
      devNoCount: off
    });
    draw(off);
  });
})();