var PT = function() {
  const PRIVACY_115 = true;
  const FEATURES = {
    formFill: PRIVACY_115,
    sheet: PRIVACY_115,
    keepPast: PRIVACY_115,
    markDone: PRIVACY_115
  };
  const STATUS = {
    1: "In Process",
    2: "Shortlisted",
    3: "Not Shortlisted",
    4: "Withdrawn",
    5: "Removed",
    6: "In Process",
    7: "Waitlisted",
    8: "Shortlisted for another role",
    999: "Counter back · result awaited"
  };
  const clip24 = t => {
    t = String(t || "");
    if (t.length <= 24) return t;
    const c = t.slice(0, 23).replace(/[\s,;:·-]+\S*$/, "");
    return (c.length >= 8 ? c : t.slice(0, 23)).replace(/[\s,;:·-]+$/, "") + "…";
  };
  const num = v => v === "-" || v === null || v === undefined || v === "" ? null : Number(v);
  function wlDashboard(D) {
    const name = (lab, slot) => {
      const m = /Priority\s*(\d)\s*Cluster\s*\((Cluster\s*\d)\)/i.exec(slot || "");
      if (m) return m[2].replace(/Cluster\s*/i, "Cluster-") + " (P" + m[1] + ")";
      if (!slot || slot === "All" || slot === "-") return lab || "Pool";
      return (lab ? lab + " · " : "") + slot;
    };
    return (D && D.data || []).map(r => ({
      key: (r.jobPositionLabel || "") + "|" + (r.dayslot || ""),
      pool: name(r.jobPositionLabel, r.dayslot),
      slot: r.dayslot,
      app: {
        total: num(r.total_counter),
        used: num(r.used),
        left: num(r.remaining)
      },
      isl: {
        total: num(r.total_shortlist_counter),
        used: num(r.used_shortlist),
        left: num(r.remaining_shortlist)
      },
      fsl: {
        total: num(r.total_final_shortlist_counter),
        used: num(r.used_final_shortlist),
        left: num(r.remaining_final_shortlist)
      },
      blocked: (num(r.in_progress) || 0) + (num(r.all_shortlisted) || 0)
    }));
  }
  function wlApplication(a) {
    return {
      id: a.applicationId,
      company: a.registeredCompanyName,
      role: a.jobRoleLabel,
      statusCode: a.status,
      status: STATUS[a.status] || "Status " + a.status,
      stage: a.stageName || "",
      counterReleased: !!a.counterReleased,
      deadline: a.applicationDeadline || "",
      shortlistBy: a.shortlistExpectedDate || "",
      cluster: a.tieringDayLabel || "",
      jobType: a.jobTypeLabel || "",
      counterType: a.jobCounter || "",
      appliedAt: a.createdAt || "",
      appliedCount: countOf(a.appliedCount),
      shortlistCount: countOf(a.shortlistCount)
    };
  }
  const countOf = v => {
    const n = Number(v);
    return v === null || v === undefined || v === "" || !isFinite(n) || n < 0 ? null : Math.round(n);
  };
  const COUNTRY_CUR = {
    india: "INR",
    "saudi arabia": "SAR",
    ksa: "SAR",
    qatar: "QAR",
    "united arab emirates": "AED",
    uae: "AED",
    singapore: "SGD",
    "united states": "USD",
    usa: "USD",
    "united kingdom": "GBP",
    uk: "GBP",
    oman: "OMR",
    kuwait: "KWD",
    bahrain: "BHD",
    "hong kong": "HKD",
    japan: "JPY",
    germany: "EUR",
    france: "EUR",
    netherlands: "EUR",
    ireland: "EUR",
    spain: "EUR",
    italy: "EUR",
    malaysia: "MYR",
    indonesia: "IDR",
    thailand: "THB",
    vietnam: "VND",
    australia: "AUD",
    canada: "CAD",
    switzerland: "CHF",
    china: "CNY",
    philippines: "PHP"
  };
  const yrs = (y, m) => {
    const a = Number(y), b = Number(m);
    if ((y === undefined || y === null || y === "") && !b) return null;
    return Math.round(((isFinite(a) ? a : 0) + (isFinite(b) ? b : 0) / 12) * 10) / 10;
  };
  const CAL_KEY = "placementTracker.calendarId", CAL_ID_RE = /^[A-Za-z0-9._%+-]{6,200}@group\.calendar\.google\.com$/;
  const DETAIL_V = 4;
  const htmlText = h => String(h || "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|h\d|tr)>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&").replace(/&#8377;|&#x20b9;/gi, "₹").replace(/&[a-z]+;|&#\d+;/gi, " ");
  const PAY_WORD = /\b(ctc|cost to (the )?company|salary|compensation|remuneration|stipend|package|pay|base|bonus|fixed|variable|lpa)\b/i;
  const SIZE_WORD = /^\s*(billion|million|trillion|bn|mn)\b/i;
  const FIG = /((?:₹|rs\.?|inr|usd|us\$|\$|aed|sgd|eur|€|£|gbp)\s*)?(\d{1,3}(?:,\d{2,3})+|\d+(?:\.\d+)?)(\s*(?:-|–|to)\s*(\d{1,3}(?:,\d{2,3})+|\d+(?:\.\d+)?))?\s*(lpa|lakhs?\s*per\s*annum|lakhs?|lacs?|crores?|cr\b|l\b|k\b|per\s*annum|p\.\s*a\.?)?/gi;
  function jdPay(html) {
    const text = htmlText(html).replace(/\s+/g, " ").slice(0, 2e4);
    if (!text) return "";
    const found = [];
    for (const m of text.matchAll(FIG)) {
      const [all, cur, , range, , unit] = m, at = m.index, after = text.slice(at + all.length, at + all.length + 14);
      if (SIZE_WORD.test(after) || /^cr/i.test(unit || "") && !PAY_WORD.test(text.slice(Math.max(0, at - 30), at))) continue;
      if (!cur && !unit) continue;
      const near = text.slice(Math.max(0, at - 80), at + all.length + 80);
      const lpa = /lpa|per\s*annum|p\.\s*a/i.test(unit || "");
      if (!lpa && !PAY_WORD.test(near)) continue;
      const label = /\b(total\s*)?(ctc|cost to (the )?company|total compensation|package)\b/i.test(text.slice(Math.max(0, at - 50), at));
      found.push({
        s: all.trim().replace(/\s+/g, " ").slice(0, 40),
        label: label
      });
    }
    if (!found.length) return "";
    const lab = found.filter(f => f.label), pick = lab.length ? lab : found;
    const uniq = [ ...new Set(pick.map(f => f.s)) ];
    return uniq.length === 1 ? uniq[0] : lab.length ? lab[0].s : "see JD";
  }
  async function portalRead({call: call, partial: partial, pool: pool, known: known, knownJobs: knownJobs, maxDetails: maxDetails, exp: exp, subsKnown: subsKnown}) {
    const calls = [];
    try {
      let queue = [];
      const JOBS_BODY = {
        company: "0",
        groupFunction: "0",
        jobTitle: "0",
        industryGroup: "0",
        jobStatus: "0",
        daySlot: "0",
        jobDaySlot: "0",
        sortBy: "0"
      };
      const [dash, apps, tasks, jobs, closedJobs] = await Promise.all([ call("POST", "sk-student-application-statuses/dashboard", {}).then(D => {
        calls.push("dashboard");
        const dash = PT.wlDashboard(D);
        partial({
          dash: dash
        });
        return dash;
      }), call("GET", "sk-student-application-statuses/allApplications").then(A => {
        calls.push("applications");
        const apps = (Array.isArray(A) ? A : []).map(PT.wlApplication);
        queue = PT.detailQueue(apps, known);
        partial({
          apps: apps,
          detailsDue: queue.length
        });
        return apps;
      }), call("GET", "sk-submissions/pending").then(T => {
        calls.push("pending");
        const tasks = (Array.isArray(T) ? T : []).map(PT.wlTask);
        partial({
          tasks: tasks
        });
        return tasks;
      }), call("POST", "sk-applications/student/active", JOBS_BODY).then(L => {
        calls.push("jobs");
        const jobs = (L && L.applicationDetails || []).map(PT.wlJob);
        partial({
          jobs: jobs
        });
        return jobs;
      }), call("POST", "sk-applications/student/closed", JOBS_BODY).then(L => {
        calls.push("closed");
        return (L && L.applicationDetails || []).map(PT.wlJob).slice(0, 300);
      }).catch(e => {
        if (String(e.message) === "auth") throw e;
        return null;
      }) ]);
      const details = {};
      await pool(queue, async a => {
        try {
          details[a.id] = PT.wlDetail(await call("GET", "sk-applications/" + encodeURIComponent(a.id)));
          calls.push("detail");
          partial({
            detail: {
              id: a.id,
              data: details[a.id]
            }
          });
        } catch (e) {
          if (String(e.message) === "auth") throw e;
        }
      });
      const wanted = [].concat((jobs || []).map(j => Object.assign({
        __rank: 0
      }, j)), (apps || []).map(a => ({
        id: a.id,
        deadline: a.deadline,
        __rank: 1
      })), (closedJobs || []).map(j => Object.assign({
        __rank: 2
      }, j)));
      let closedLeft = 20;
      const q = PT.jobDetailQueue(wanted, Object.assign({}, knownJobs || {}, details)).filter(j => j.__rank !== 2 || closedLeft-- > 0).slice(0, maxDetails || Infinity);
      partial({
        jobDetailsDue: q.length
      });
      await pool(q, async j => {
        try {
          details[j.id] = PT.wlDetail(await call("GET", "sk-applications/" + encodeURIComponent(j.id)));
          calls.push("job-detail");
          partial({
            detail: {
              id: j.id,
              data: details[j.id]
            }
          });
        } catch (e) {
          if (String(e.message) === "auth") throw e;
        }
      });
      const sub = await jobForms({
        call: call,
        pool: pool,
        apps: apps,
        jobs: jobs,
        details: details,
        subsKnown: subsKnown,
        calls: calls
      });
      const allTasks = mergeTasks(tasks, sub.tasks);
      if (sub.read) partial({
        tasks: allTasks
      });
      return {
        ok: true,
        loginExp: exp,
        snapshot: Object.assign({
          dash: dash,
          apps: apps,
          tasks: allTasks,
          jobs: jobs
        }, closedJobs ? {
          closedJobs: closedJobs
        } : {}),
        details: details,
        calls: calls,
        subsAt: sub.at
      };
    } catch (e) {
      if (String(e.message) === "auth") return {
        expired: true,
        loginExp: exp,
        calls: calls
      };
      return {
        error: String(e.message).slice(0, 80),
        loginExp: exp,
        calls: calls
      };
    }
  }
  function intlTip(locations, country) {
    const L = String(locations || "").trim();
    return /^\s*india\s*$/i.test(String(country || "")) ? "International counter · this job starts in India" + (L ? " (" + L + ")" : "") : "International role: " + (L || "outside India");
  }
  function wlDetail(D) {
    const j = D && D.json_data || {}, p = j.job_posting_details || {}, st = (j.hiring_workflow_details || {}).stages || [], e = j.eligibility || {};
    const cur = /^[A-Z]{3}$/.test(String(p.currency || "")) ? p.currency : COUNTRY_CUR[String(p.country || "").trim().toLowerCase()] || (p.country ? "" : "INR");
    const t = (v, n) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, n);
    return {
      v: DETAIL_V,
      at: Date.now(),
      cl: /^yes$/i.test(String(p.eoi || "")),
      clTo: /^yes$/i.test(String(p.eoi || "")) ? t(p.eoi_designation || p.eoi_title, 60) : "",
      website: /^yes$/i.test(String(p.apply_on_website || "")),
      websiteLink: p.website || "",
      locations: p.city || "",
      eligible: typeof e.is_eligible === "boolean" ? e.is_eligible : null,
      stages: st.map(s => ({
        seq: s.stage_sequence_number,
        name: s.name,
        elim: s.eliminative === "Yes"
      })),
      ctc: t(p.salary_range, 60),
      cur: cur,
      ctcJd: ctcInfo(p.salary_range).na ? jdPay(p.description) : "",
      expMin: yrs(p.min_years, p.min_months),
      expMax: yrs(p.max_years, p.max_months),
      minFlex: /flex/i.test(String(p.is_min_exp_flexible || "")),
      maxFlex: /flex/i.test(String(p.is_max_exp_flexible || "")),
      workType: t(p.work_type, 40),
      interview: t(p.mode_of_interview, 40),
      cgpa: t(p.cgpa_required, 20),
      country: t(p.country, 40)
    };
  }
  function wlJob(j) {
    return {
      id: j.application_id,
      company: j.registered_company_name,
      role: j.job_role_name,
      cluster: j.tiering_day_label || "",
      jobType: j.job_type_label || "",
      industry: j.recruiter_industry_label || "",
      counterType: j.job_counter || "",
      blueTag: /^yes$/i.test(String(j.blue_tag_job || "")),
      expMin: j.min_experience || "",
      expMax: j.max_experience || "",
      minFlexL: String(j.is_min_exp_flexible || "").slice(0, 20),
      maxFlexL: String(j.is_max_exp_flexible || "").slice(0, 20),
      deadline: j.application_deadline || "",
      shortlistBy: j.shortlist_expected_date || "",
      appliedCount: countOf(j.appliedCount != null ? j.appliedCount : j.applied_count),
      shortlistCount: countOf(j.shortlistCount != null ? j.shortlistCount : j.shortlist_count),
      ctc: String(j.ctc || "").slice(0, 60)
    };
  }
  function ctcLakhs(s) {
    const t = String(s || "").toLowerCase().replace(/,/g, "");
    if (/usd|\$|€|eur\b|£|gbp|aed|sgd|sar|qar|jpy|hkd|myr|thb|omr|kwd|bhd|aud|cad|chf/.test(t)) return null;
    const m = /(\d+(?:\.\d+)?)\s*(cr|crore|l|lpa|lakh|lac|k)?/.exec(t.replace(/₹|rs\.?|inr/g, ""));
    if (!m) return null;
    let n = parseFloat(m[1]), u = m[2] || "";
    if (/cr/.test(u)) n *= 100; else if (u === "k") n /= 100; else if (!u && n > 1e4) n /= 1e5;
    return isFinite(n) && n > 0 ? Math.round(n * 10) / 10 : null;
  }
  const FX_INR = {
    USD: 86,
    EUR: 97,
    GBP: 113,
    AED: 23.4,
    SAR: 22.9,
    QAR: 23.6,
    SGD: 66,
    HKD: 11,
    JPY: .58,
    OMR: 223,
    KWD: 280,
    BHD: 228,
    MYR: 19.5,
    AUD: 56,
    CAD: 62,
    CHF: 104,
    THB: 2.5,
    IDR: .0053,
    VND: .0033,
    CNY: 12,
    PHP: 1.5
  };
  const CUR_RE = /\b(usd|eur|gbp|aed|sar|qar|sgd|hkd|jpy|omr|kwd|bhd|myr|aud|cad|chf|thb|idr|vnd|cny|php|inr)\b|\$|€|£|₹/i;
  const SYM = {
    $: "USD",
    "€": "EUR",
    "£": "GBP",
    "₹": "INR"
  };
  const NA_RE = /^(na|n\/a|nil|-+|0|not disclosed|undisclosed|tbd|to be disclosed|as per (industry|company|norms).*|competitive)$/i;
  const COMPONENT = /\b(fixed|base|basic|variable|bonus|incentive|joining|retention|esop|stock|allowance|performance|perf)\b/i;
  const LABEL = /\b(total\s*)?(ctc|cost to (the )?company|total compensation|package)\b/i;
  function inrFigures(s) {
    const t = String(s).replace(/₹|\brs\.?|\binr\b/gi, " ");
    const out = [], re = /(\d{1,3}(?:,\d{2,3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s*(crores?|cr\b|lpa\b|lakhs?\b|lacs?\b|l\b|k\b)?/gi;
    for (const m of t.matchAll(re)) {
      const raw = m[1], n = parseFloat(raw.replace(/,/g, "")), u = (m[2] || "").toLowerCase();
      if (!isFinite(n) || n <= 0) continue;
      let lakhs = null, unit = !!u;
      if (/^cr/.test(u)) lakhs = n * 100; else if (u === "k") lakhs = n / 100; else if (u) lakhs = n; else if (/,/.test(raw) || n >= 1e4) {
        lakhs = n / 1e5;
        unit = true;
      }
      out.push({
        at: m.index,
        end: m.index + m[0].length,
        n: n,
        lakhs: lakhs,
        unit: unit,
        before: t.slice(Math.max(0, m.index - 28), m.index)
      });
    }
    for (let i = 0; i + 1 < out.length; i++) {
      const a = out[i], b = out[i + 1];
      if (/^\s*(-|–|to)\s*$/i.test(t.slice(a.end, b.at))) {
        if (!a.unit && b.unit && b.lakhs !== null) a.lakhs = a.n * (b.lakhs / b.n);
        a.rangeTo = b;
        b.inRange = true;
      }
    }
    const word = /\b(lpa|lakhs?|lacs?|l)\b/i.test(t) ? 1 : /\bcr(ore)?s?\b/i.test(t) ? 100 : 0;
    for (const f of out) if (f.lakhs === null) f.lakhs = word ? f.n * word : f.n <= 300 ? f.n : null;
    for (const f of out) if (f.rangeTo && f.rangeTo.lakhs === null) f.rangeTo.lakhs = f.lakhs;
    return out.filter(f => f.lakhs !== null);
  }
  function ctcInfo(raw, cur) {
    const s = String(raw || "").trim();
    if (!s || NA_RE.test(s)) return {
      label: "CTC: not disclosed",
      lakhs: null,
      approx: false,
      na: true,
      cur: cur || "",
      raw: s
    };
    const m = CUR_RE.exec(s), inText = m ? SYM[m[0]] || m[0].toUpperCase() : "";
    const c = (inText || cur || "INR").toUpperCase();
    const L = x => x >= 100 ? Math.round(x) / 100 + " Cr" : Math.round(x * 10) / 10 + " L";
    if (c === "INR") {
      const figs = inrFigures(s).filter(f => !f.inRange);
      if (!figs.length) return {
        label: "₹ " + clip24(s),
        lakhs: null,
        approx: false,
        na: false,
        cur: c,
        raw: s
      };
      const head = figs.find(f => LABEL.test(f.before)) || figs[0];
      const lo = head.lakhs, hi = head.rangeTo ? head.rangeTo.lakhs : null;
      if (lo > 500 || hi && hi > 500) return {
        label: "CTC: see portal",
        lakhs: null,
        approx: false,
        na: false,
        cur: c,
        raw: s
      };
      const part = !LABEL.test(head.before) && COMPONENT.test(head.before) && figs.length > 1;
      const label = hi && hi !== lo ? hi >= 100 ? `₹ ${L(lo)}–${L(hi)}` : `₹ ${Math.round(lo * 10) / 10}–${Math.round(hi * 10) / 10} L` : `₹ ${L(lo)}${part ? " +" : ""}`;
      return {
        label: label,
        lakhs: Math.round(Math.min(lo, hi || lo) * 10) / 10,
        hiLakhs: Math.round(Math.max(lo, hi || lo) * 10) / 10,
        approx: false,
        na: false,
        cur: c,
        raw: s
      };
    }
    const t = s.toLowerCase().replace(/,/g, "");
    const n = /(\d+(?:\.\d+)?)\s*(k|m|mn|million|lakh|l)?\b/.exec(t.replace(CUR_RE, " "));
    let amt = n ? parseFloat(n[1]) * ({
      k: 1e3,
      m: 1e6,
      mn: 1e6,
      million: 1e6,
      lakh: 1e5,
      l: 1e5
    }[n[2]] || 1) : null;
    const monthly = /per month|\/ ?month|\bpm\b|monthly|p\.m\./.test(t), yearly = amt !== null ? amt * (monthly ? 12 : 1) : null;
    const rate = FX_INR[c], lakhs = yearly && rate ? Math.round(yearly * rate / 1e5) : null;
    const fmtAmt = a => a >= 1e6 ? Math.round(a / 1e5) / 10 + " M" : a >= 1e3 ? Math.round(a / 100) / 10 + "k" : String(a);
    const shown = amt !== null ? fmtAmt(amt) + (monthly ? " / month" : "") : clip24(s.replace(CUR_RE, "").trim());
    return {
      label: `${c} ${shown}${lakhs ? ` · ≈ ₹ ${L(lakhs)}` : ""}`,
      lakhs: lakhs,
      approx: true,
      na: false,
      cur: c,
      raw: s
    };
  }
  function effectiveHidden(st) {
    const p = st && st.plus || {};
    return p.active ? p.hidden || {} : st && st.hiddenJobs || {};
  }
  const SUB_FRESH = 6 * 36e5, SUB_OPEN = 30 * 6e4, SUB_MAX = 25, SUB_JOBS = 10;
  function wlJobForm(x, id, company, role) {
    const t = (v, n) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, n);
    return {
      appId: id,
      subId: t(x && (x.id || x.submission_id), 60),
      company: t(company, 80),
      role: t(role, 120),
      label: t(x && x.submission_label, 60),
      deadline: t(x && x.submission_deadline, 20),
      status: t(x && x.submission_status, 20).toUpperCase(),
      src: "job"
    };
  }
  async function jobForms({call: call, pool: pool, apps: apps, jobs: jobs, subsKnown: subsKnown, calls: calls}) {
    const now = Date.now(), at = Object.assign({}, subsKnown && subsKnown.at || {}), prev = (subsKnown && subsKnown.tasks || []).filter(t => t && t.src === "job");
    const live = (apps || []).filter(a => [ 1, 6, 2, 7, 8, 999 ].includes(a.statusCode)), seen = new Set, cand = [];
    for (const a of live) if (!seen.has(a.id)) {
      seen.add(a.id);
      cand.push({
        id: a.id,
        company: a.company,
        role: a.role,
        rank: 0,
        due: a.deadline || "9"
      });
    }
    for (const j of jobs || []) if (!seen.has(j.id)) {
      seen.add(j.id);
      cand.push({
        id: j.id,
        company: j.company,
        role: j.role,
        rank: 1,
        due: j.deadline || "9"
      });
    }
    const openForm = id => prev.some(t => t.appId === id && !/SUBMITTED/.test(t.status));
    const due = cand.filter(c => !at[c.id] || now - at[c.id] > (openForm(c.id) ? SUB_OPEN : SUB_FRESH)).sort((x, y) => x.rank - y.rank || String(x.due).localeCompare(String(y.due))).filter((c, i, L) => c.rank === 0 || L.slice(0, i).filter(x => x.rank === 1).length < SUB_JOBS).slice(0, SUB_MAX);
    const got = {};
    await pool(due, async c => {
      try {
        const L = await call("GET", "sk-submissions/" + encodeURIComponent(c.id));
        calls.push("job-forms");
        got[c.id] = (Array.isArray(L) ? L : []).slice(0, 10).map(x => wlJobForm(x, c.id, c.company, c.role)).filter(t => t.label || t.deadline);
        at[c.id] = now;
      } catch (e) {
        if (String(e.message) === "auth") throw e;
      }
    });
    const tasks = [];
    for (const c of cand) tasks.push(...got[c.id] || prev.filter(t => t.appId === c.id));
    for (const k of Object.keys(at)) if (!seen.has(k)) delete at[k];
    return {
      tasks: tasks,
      at: at,
      read: Object.keys(got).length > 0
    };
  }
  function mergeTasks(pending, fromJobs) {
    const key = t => t.appId + "|" + t.subId, key2 = t => t.appId + "|" + String(t.label).toLowerCase() + "|" + t.deadline;
    const have = new Set((pending || []).map(key)), have2 = new Set((pending || []).map(key2));
    return (pending || []).concat((fromJobs || []).filter(t => !have.has(key(t)) && !have2.has(key2(t))));
  }
  function wlTask(t) {
    return {
      appId: t.applicationId,
      subId: t.submissionId,
      company: t.registeredCompanyName,
      role: t.jobTitle,
      label: t.submissionLabel,
      deadline: t.submissionDeadline || "",
      status: String(t.submissionStatus || "")
    };
  }
  const listFacts = a => [ a.role, a.deadline, a.shortlistBy, a.stage ].join("|");
  function detailQueue(apps, known) {
    return apps.filter(a => (a.statusCode === 1 || a.statusCode === 6) && !(known && known[a.id] === listFacts(a))).sort((x, y) => String(x.deadline || "9").localeCompare(String(y.deadline || "9")));
  }
  function jobDetailQueue(jobs, details, max) {
    const seen = new Set;
    return (jobs || []).filter(j => j && j.id && !(details && details[j.id]) && !seen.has(j.id) && seen.add(j.id)).map((j, i) => ({
      j: j,
      i: i
    })).sort((x, y) => (x.j.__rank || 0) - (y.j.__rank || 0) || String(x.j.deadline || "9").localeCompare(String(y.j.deadline || "9")) || x.i - y.i).map(x => x.j).slice(0, max || Infinity);
  }
  function releaseDate(shortlistBy) {
    if (!/^\d{4}-\d{2}-\d{2}/.test(shortlistBy)) return "";
    const d = new Date(shortlistBy.slice(0, 10) + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + 2);
    return d.toISOString().slice(0, 10);
  }
  function diff(prev, next) {
    const out = [];
    if (!prev) return out;
    const pa = Object.fromEntries((prev.apps || []).map(a => [ a.id, a ]));
    for (const a of next.apps) {
      const o = pa[a.id], name = a.company + " · " + a.role;
      if (!o) {
        out.push({
          kind: "new",
          co: a.company,
          text: name + ": application added"
        });
        continue;
      }
      if (o.statusCode !== a.statusCode) out.push({
        kind: "status",
        co: a.company,
        text: name + ": " + o.status + " → " + a.status
      });
      if (o.deadline !== a.deadline) out.push({
        kind: "date",
        co: a.company,
        text: name + ": deadline " + (o.deadline || "none") + " → " + (a.deadline || "none")
      });
      if (o.shortlistBy !== a.shortlistBy) out.push({
        kind: "date",
        co: a.company,
        text: name + ": shortlist date " + (o.shortlistBy || "none") + " → " + (a.shortlistBy || "none")
      });
      if (!o.counterReleased && a.counterReleased) out.push({
        kind: "counter",
        co: a.company,
        text: name + ": counter released"
      });
    }
    const pk = t => t.appId + "|" + t.subId, pt = Object.fromEntries((prev.tasks || []).map(t => [ pk(t), t ]));
    for (const t of next.tasks) {
      const o = pt[pk(t)];
      if (!o) {
        if (!(t.src === "job" && /SUBMITTED/.test(t.status))) out.push({
          kind: "task",
          co: t.company,
          text: t.company + ": new " + (t.src === "job" ? "form" : "task") + ' "' + t.label + '" due ' + t.deadline
        });
      } else if (o.deadline !== t.deadline) out.push({
        kind: "date",
        co: t.company,
        text: t.company + ': "' + t.label + '" moved to ' + t.deadline
      });
    }
    if (prev.jobs && next.jobs) {
      const pj = Object.fromEntries(prev.jobs.map(j => [ j.id, j ]));
      for (const j of next.jobs) {
        const o = pj[j.id];
        if (!o) out.push({
          kind: "job",
          co: j.company,
          job: j.id,
          text: j.company + " · " + j.role + ": new job, closes " + (j.deadline || "?")
        }); else if (o.deadline !== j.deadline) out.push({
          kind: "date",
          co: j.company,
          job: j.id,
          text: j.company + " · " + j.role + ": application deadline " + (o.deadline || "none") + " → " + (j.deadline || "none")
        });
      }
    }
    const pd = Object.fromEntries((prev.dash || []).map(r => [ r.key || r.pool, r ]));
    for (const r of next.dash) {
      const o = pd[r.key || r.pool];
      if (!o) continue;
      if (o.app.left !== r.app.left && r.app.left !== null) out.push({
        kind: "counter",
        text: r.pool + ": applications left " + o.app.left + " → " + r.app.left
      });
      if (o.isl.left !== r.isl.left && r.isl.left !== null) out.push({
        kind: "counter",
        text: r.pool + ": shortlists left " + o.isl.left + " → " + r.isl.left
      });
    }
    return out;
  }
  function poolKeyFor(app, dash) {
    const intl = /international/i.test(app.jobType || "");
    const row = dash.find(r => intl ? /international/i.test(r.key) : !/international/i.test(r.key) && app.cluster && (r.slot || "").toLowerCase().includes(app.cluster.toLowerCase()));
    return row ? row.key : null;
  }
  function slRecord(hist, apps, now) {
    const out = Object.assign({}, hist || {});
    let changed = false;
    for (const a of apps || []) {
      const n = a.shortlistCount, stg = String(a.stage || "").trim();
      if (!(n > 0) || !stg) continue;
      const key = stg + (a.statusCode === 3 ? "|at" : "|before");
      const h = out[a.id] ? {
        ap: out[a.id].ap,
        s: Object.assign({}, out[a.id].s)
      } : {
        ap: null,
        s: {}
      };
      const was = h.s[key], ap = a.appliedCount != null ? a.appliedCount : h.ap;
      if (was && was.n === n && h.ap === ap) continue;
      h.s[key] = {
        n: n,
        at: was && was.n === n ? was.at : now
      };
      h.ap = ap;
      out[a.id] = h;
      changed = true;
    }
    return changed ? out : null;
  }
  const wnFrom = v => /^(0|1)\./.test(String(v || "")) || /^2\.0\.[02](\.\d+)?$/.test(String(v || ""));
  function heldText(f, fmt) {
    if (!f || !f.count) return "";
    const back = f.next ? `next back ${fmt(f.next)} if no shortlist` : "";
    if (!f.overdue) return `${f.count} held by In Process · back ${f.count > 1 ? "from " : ""}${fmt(f.earliest)} if no shortlist`;
    const od = `${f.overdue === f.count ? f.count > 1 ? "all past" : "past" : f.overdue + " past"} their shortlist date, back once the portal releases them`;
    return `${f.count} held by In Process · ${od}${back ? " · " + back : ""}`;
  }
  const spentFirms = apps => new Set((apps || []).filter(a => (a.statusCode === 2 || a.statusCode === 7 || a.statusCode === 8) && /company/i.test(a.counterType || "")).map(a => String(a.company || "").trim().toLowerCase()));
  function releaseSchedule(apps, dash) {
    const spent = spentFirms(apps), units = {};
    for (const a of apps || []) {
      if (!(a.statusCode === 1 || a.statusCode === 6) || !a.shortlistBy) continue;
      const co = /company/i.test(a.counterType || "");
      if (co && spent.has(String(a.company || "").trim().toLowerCase())) continue;
      const k = poolKeyFor(a, dash || []);
      if (!k) continue;
      const id = k + "|" + (co ? "c:" + String(a.company || "").trim().toLowerCase() : "j:" + a.id), rel = releaseDate(a.shortlistBy);
      if (!rel) continue;
      if (!units[id] || rel > units[id].date) units[id] = {
        key: k,
        date: rel,
        firm: a.company || ""
      };
    }
    const today = new Date(Date.now() + 5.5 * 36e5).toISOString().slice(0, 10), by = {};
    for (const u of Object.values(units)) {
      const d = u.date < today ? "overdue" : u.date, g = by[d + "|" + u.key] || (by[d + "|" + u.key] = {
        date: d,
        key: u.key,
        firms: []
      });
      g.firms.push(u.firm);
    }
    return Object.values(by).sort((x, y) => (x.date === "overdue" ? "0" : x.date).localeCompare(y.date === "overdue" ? "0" : y.date) || x.key.localeCompare(y.key));
  }
  function statusCounts(apps, dash) {
    const out = {};
    for (const a of apps || []) {
      const k = poolKeyFor(a, dash || []);
      if (!k) continue;
      const c = out[k] || (out[k] = {
        all: 0,
        applied: 0,
        inProcess: 0,
        shortlisted: 0,
        waitlisted: 0,
        notShortlisted: 0,
        counterBack: 0,
        withdrawn: 0
      });
      const s = a.statusCode;
      c.all++;
      if (s !== 4) c.applied++;
      if (s === 1 || s === 6) c.inProcess++; else if (s === 2 || s === 8) c.shortlisted++; else if (s === 7) c.waitlisted++; else if (s === 3) c.notShortlisted++; else if (s === 999) c.counterBack++; else if (s === 4) c.withdrawn++;
    }
    return out;
  }
  function pendingRelease(apps, dash) {
    const out = {}, spent = spentFirms(apps);
    for (const a of apps) {
      if (!(a.statusCode === 1 || a.statusCode === 6) || !a.shortlistBy) continue;
      if (/company/i.test(a.counterType || "") && spent.has(String(a.company || "").trim().toLowerCase())) continue;
      const k = poolKeyFor(a, dash);
      if (!k) continue;
      const unit = /company/i.test(a.counterType) ? "c:" + a.company : "j:" + a.id;
      const p = out[k] || (out[k] = {
        units: {},
        earliest: ""
      });
      const rel = releaseDate(a.shortlistBy);
      if (!p.units[unit] || rel > p.units[unit]) p.units[unit] = rel;
    }
    for (const k of Object.keys(out)) {
      const dates = Object.values(out[k].units).sort(), today = new Date(Date.now() + 5.5 * 36e5).toISOString().slice(0, 10);
      const ahead = dates.filter(d => d && d >= today);
      out[k] = {
        count: dates.length,
        earliest: dates[0] || "",
        overdue: dates.length - ahead.length,
        next: ahead[0] || ""
      };
    }
    return out;
  }
  function releaseByDate(apps, dash) {
    const out = {}, spent = spentFirms(apps);
    for (const a of apps || []) {
      if (!(a.statusCode === 1 || a.statusCode === 6) || !a.shortlistBy) continue;
      if (/company/i.test(a.counterType || "") && spent.has(String(a.company || "").trim().toLowerCase())) continue;
      const k = poolKeyFor(a, dash || []);
      if (!k) continue;
      const unit = /company/i.test(a.counterType) ? "c:" + String(a.company || "").trim().toLowerCase() : "j:" + a.id;
      const m = out[k] || (out[k] = {}), rel = releaseDate(a.shortlistBy);
      if (rel && (!m[unit] || rel > m[unit])) m[unit] = rel;
    }
    for (const k of Object.keys(out)) {
      const by = {};
      Object.values(out[k]).forEach(d => {
        by[d] = (by[d] || 0) + 1;
      });
      out[k] = Object.keys(by).sort().map(date => ({
        date: date,
        n: by[date]
      }));
    }
    return out;
  }
  const sameFirm = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
  const BACK = a => a.statusCode === 999 || a.statusCode === 3 || !!a.counterReleased;
  function counterLine(job, snap, opts) {
    const o = opts || {}, dash = snap && snap.dash || [], apps = snap && snap.apps || [];
    if (!dash.length) return {
      pool: "",
      cost: "checking…",
      unknown: true
    };
    const p = poolFor(job, dash);
    if (!p) return /company|job/i.test(job.counterType || "") ? {
      pool: "Counter",
      cost: "see the portal",
      unknown: true
    } : {
      pool: "No counter needed",
      none: true
    };
    if (p.total === null) return {
      pool: "No counter needed",
      none: true
    };
    const firm = /company/i.test(job.counterType || ""), here = apps.filter(a => sameFirm(a.company, job.company) && poolKeyFor(a, dash) === p.key);
    const out = {
      pool: p.pool,
      left: p.left,
      total: p.total
    };
    if (o.closed) {
      const a = apps.find(x => x.id === job.id);
      if (!a) return null;
      if (BACK(a)) return Object.assign(out, {
        cost: "your counter came back",
        costCls: "g",
        backDate: a.shortlistBy ? releaseDate(a.shortlistBy) : "",
        left: null
      });
      if (a.statusCode === 1 || a.statusCode === 6) return Object.assign(out, {
        cost: "your application holds 1 counter",
        heldBack: a.shortlistBy && !(/company/i.test(a.counterType || "") && spentFirms(apps).has(String(a.company || "").trim().toLowerCase())) ? releaseDate(a.shortlistBy) : "",
        left: null
      });
      return Object.assign(out, {
        cost: "1 counter spent on your application",
        left: null
      });
    }
    const held = here.filter(a => !BACK(a)), came = here.filter(BACK);
    const n = Math.max(1, o.firmJobs || 1);
    if (firm && held.length) Object.assign(out, {
      cost: "✓ already used here",
      costCls: "g",
      used: true
    }); else if (firm && came.length) out.cost = "1 counter · yours came back"; else if (firm) out.cost = n > 1 ? `1 counter for all ${n} roles` : "1 counter"; else if (held.length) out.cost = `1 counter per role · ${held.length} used here`; else out.cost = n > 1 ? "1 counter per role" : "1 counter";
    if (!out.used && p.left === 1) out.state = "last"; else if (!out.used && p.left === 0) {
      out.state = "none";
      const r = (releaseByDate(apps, dash)[p.key] || [])[0];
      if (r) out.next = r;
    }
    return out;
  }
  function closedJobs(snap, now) {
    const t = now || Date.now(), applied = new Set((snap && snap.apps || []).map(a => a.id)), out = [];
    const seen = new Set((snap && snap.jobs || []).filter(j => j && j.id && (!j.deadline || (parseIST(j.deadline) || 0) > t)).map(j => j.id));
    for (const j of (snap && snap.closedJobs || []).concat((snap && snap.jobs || []).filter(j => j.deadline && (parseIST(j.deadline) || 0) <= t))) if (j && j.id && !applied.has(j.id) && !seen.has(j.id)) {
      seen.add(j.id);
      out.push(j);
    }
    return out.sort((x, y) => (parseIST(y.deadline) || 0) - (parseIST(x.deadline) || 0));
  }
  function openJobs(snap, now) {
    const t = now || Date.now(), applied = new Set((snap && snap.apps || []).map(a => a.id));
    return (snap && snap.jobs || []).filter(j => !applied.has(j.id) && (!j.deadline || (parseIST(j.deadline) || 0) > t)).sort((x, y) => (parseIST(x.deadline) || Infinity) - (parseIST(y.deadline) || Infinity));
  }
  function poolFor(job, dash) {
    const k = poolKeyFor(job, dash || []), r = (dash || []).find(d => d.key === k);
    return r ? {
      key: r.key,
      pool: r.pool,
      left: r.app.left,
      total: r.app.total
    } : null;
  }
  const CLOSED = c => c === 3 || c === 4 || c === 5;
  function nextDeadline(app, items, now) {
    const t = now || Date.now();
    const ds = items.filter(i => i.appId === app.id && !i.done).map(i => parseIST(i.due)).filter(d => d && d.getTime() > t);
    return ds.length ? Math.min(...ds.map(d => d.getTime())) : null;
  }
  function sortApps(apps, items, now) {
    const key = a => {
      const d = nextDeadline(a, items, now);
      return d !== null ? d : 1e15 + (parseIST(a.shortlistBy) || new Date(864e13 - 1)).getTime() / 1e3;
    };
    const live = apps.filter(a => !CLOSED(a.statusCode)).sort((x, y) => key(x) - key(y));
    const closed = apps.filter(a => CLOSED(a.statusCode));
    return {
      live: live,
      closed: closed
    };
  }
  function parseIST(s) {
    if (!s) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(s + "T23:59:00+05:30");
    if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(s) && !/(Z|[+-]\d{2}:?\d{2})$/.test(s)) return new Date(s.replace(" ", "T").slice(0, 16) + ":00+05:30");
    const d = new Date(s);
    return isNaN(d) ? null : d;
  }
  function isoIST(d) {
    const x = new Date(d.getTime() + 5.5 * 36e5);
    return x.toISOString().slice(0, 16) + ":00+05:30";
  }
  const hhmmIST = d => isoIST(d).slice(11, 16);
  const LIVE = c => c === 1 || c === 6 || c === 2 || c === 7 || c === 8 || c === 999;
  function calItems(snap, details, marks) {
    const out = [], det = details || {}, apps = snap && snap.apps || [], mk = marks || {};
    const byId = Object.fromEntries(apps.map(a => [ a.id, a ]));
    for (const a of apps) {
      const d = det[a.id];
      if (d && d.website && a.deadline) out.push({
        key: a.id + "|web",
        appId: a.id,
        company: a.company,
        role: a.role,
        label: "Website application",
        due: a.deadline,
        link: d.websiteLink || "",
        done: FEATURES.markDone && !!mk[a.id],
        mine: FEATURES.markDone
      });
    }
    for (const t of snap && snap.tasks || []) {
      const a = byId[t.appId] || {};
      out.push({
        key: t.appId + "|task|" + t.subId,
        appId: t.appId,
        company: t.company || a.company,
        role: t.role || a.role,
        label: t.label || "Task",
        due: t.deadline,
        link: "",
        done: /SUBMITTED/i.test(t.status)
      });
    }
    return out;
  }
  function calState(item, rec, app, now) {
    const due = parseIST(item.due), t = now || Date.now();
    const out = item.done || app && !LIVE(app.statusCode) || item.label === "Website application" && app && app.statusCode !== 1 && app.statusCode !== 6;
    if (out) return rec ? "gone" : "none";
    if (rec && rec.due !== item.due) return "moved";
    if (rec) return "added";
    if (!due || due.getTime() <= t) return "past";
    return "new";
  }
  const PORTAL_BASE = "https://placements.isb.edu/#/";
  const portalTaskUrl = id => portalJobUrl(id).replace("#/", "?ptTab=tasks#/");
  const SHARE = {
    float: "https://tinyurl.com/isb-tracker-share",
    popup: "https://tinyurl.com/isb-tracker-share-app"
  };
  const FEEDBACK_URL = "https://docs.google.com/forms/d/e/1FAIpQLSdwASC8H2fSrUETYNVMDSpdEdVZhoP7Ju0ZwoGpAWA5Y2OEqw/viewform";
  const shareText = where => "Placement Tracker for the ISB placement portal: every deadline, shortlist and counter in one place, a calendar of what's next, and saved answers for forms. Free Chrome extension.\nAdd it to Chrome: " + (SHARE[where] || SHARE.float);
  const portalWithdrawUrl = id => PORTAL_BASE.replace("#/", "?ptTab=withdraw&ptApp=" + encodeURIComponent(String(id || "").toLowerCase()) + "#/") + "student/my-applications";
  function portalJobUrl(id) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id || "")) ? PORTAL_BASE + "applications/application-details/" + String(id).toLowerCase() : PORTAL_BASE + "student/student-jobs";
  }
  const SHEET_ID = "1jYGom0VNH6-tZUqfWOhMgvWy1G6ZCSEby5FODONx7bI";
  const sheetUrl = tab => "https://docs.google.com/spreadsheets/d/" + SHEET_ID + "/gviz/tq?tqx=out:json&headers=1&sheet=" + encodeURIComponent(tab);
  const SHEET_COLS = [ "application_id", "jd_summary", "jd_sources" ];
  function parseGviz(text) {
    text = String(text || "");
    const j = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
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
  function wlSheetRow(r) {
    const o = {};
    for (const k of SHEET_COLS) if (r && r[k] != null && r[k] !== "") o[k] = String(r[k]).slice(0, 4e3);
    return o;
  }
  function sheetTime(v) {
    v = String(v || "").trim();
    if (!v) return null;
    const m = /^Date\((\d+),(\d+),(\d+)(?:,(\d+),(\d+)(?:,(\d+))?)?\)/.exec(v);
    if (m) return Date.UTC(+m[1], +m[2], +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)) - 5.5 * 36e5;
    const d = parseIST(v);
    return d && !isNaN(d) ? d.getTime() : null;
  }
  function sheetPulledAt(metaRows) {
    for (const r of metaRows || []) {
      const v = Object.values(r);
      if (String(r.key ?? v[0]).trim() === "jobs_pulled_at") return sheetTime(r.value ?? v[1]);
    }
    return null;
  }
  const sheetDay = s => {
    const d = parseIST(s);
    return d ? isoIST(d).slice(0, 16).replace("T", " ") : "";
  };
  function cardRow(j, s) {
    const r = Object.assign({}, s || {});
    r.application_id = j.id;
    r.company = r.company || j.company;
    r.role = r.role || j.role;
    if (!r.company_short) r.company_short = shortFirm(r.company);
    r.cluster = j.cluster || r.cluster || "";
    r.job_type = j.jobType || r.job_type || "";
    r.blue_tag = j.blueTag ? "Yes" : r.blue_tag || "No";
    r.deadline_ist = sheetDay(j.deadline) || r.deadline_ist || "";
    r.shortlist_expected = j.shortlistBy || r.shortlist_expected || "";
    r.exp_min = r.exp_min || j.expMin || "";
    r.exp_max = r.exp_max || j.expMax || "";
    r.counter = r.counter || j.counterType || "";
    r.listing_status = "open";
    r.__sheet = !!s;
    return r;
  }
  function cardRows(jobs, sheetJobs) {
    const by = {};
    (sheetJobs || []).forEach(r => {
      by[String(r.application_id || "").trim().toLowerCase()] = r;
    });
    return (jobs || []).map(j => cardRow(j, by[String(j.id || "").trim().toLowerCase()]));
  }
  const LIVE_APP = c => c === 1 || c === 6 || c === 2 || c === 7 || c === 8 || c === 999;
  const SHORTLISTED = c => c === 2 || c === 7 || c === 8;
  function wantedEvents(snap, details, hiddenJobs, now, marks) {
    const t = now || Date.now(), out = [], hid = hiddenJobs || {}, apps = snap && snap.apps || [], applied = new Set(apps.map(a => a.id));
    for (const j of openJobs(snap || {}, t)) {
      const due = parseIST(j.deadline);
      if (!hid[j.id] && !applied.has(j.id) && due && due.getTime() > t) out.push({
        key: "job|" + j.id,
        kind: "apply",
        appId: j.id,
        company: j.company,
        role: j.role,
        label: "Apply",
        due: j.deadline
      });
    }
    for (const a of apps) {
      if (!LIVE_APP(a.statusCode)) {
        if (FEATURES.keepPast && a.shortlistBy) out.push({
          key: "sl|" + a.id,
          kind: "ended",
          allDay: true,
          force: true,
          markOnly: true,
          appId: a.id,
          company: a.company,
          role: a.role,
          label: endedLabel(a),
          due: a.shortlistBy
        });
        continue;
      }
      if (a.deadline) out.push({
        key: "job|" + a.id,
        kind: "applied",
        appId: a.id,
        company: a.company,
        role: a.role,
        label: "Applied",
        due: a.deadline
      });
      if (a.shortlistBy) out.push({
        key: "sl|" + a.id,
        kind: SHORTLISTED(a.statusCode) ? "shortlisted" : "shortlist",
        allDay: true,
        force: SHORTLISTED(a.statusCode),
        appId: a.id,
        company: a.company,
        role: a.role,
        label: SHORTLISTED(a.statusCode) ? "Shortlisted" : "Shortlist expected",
        due: a.shortlistBy
      });
    }
    const byId = Object.fromEntries(apps.map(a => [ a.id, a ]));
    for (const it of calItems(snap, details, marks)) {
      if (calState(it, null, byId[it.appId], t) === "new") out.push(Object.assign({
        kind: "step"
      }, it)); else if (it.done && byId[it.appId] && LIVE_APP(byId[it.appId].statusCode)) out.push(Object.assign({
        kind: it.mine ? "done" : "submitted"
      }, it, it.mine ? {
        force: true
      } : {}));
    }
    return out.sort((a, b) => parseIST(a.due) - parseIST(b.due));
  }
  const EVENT_ICON = {
    apply: "⏰",
    applied: "✅",
    shortlist: "⏳",
    shortlisted: "🎉",
    step: "⏰",
    submitted: "✓",
    done: "✓",
    ended: "✕"
  };
  function endedLabel(a) {
    const s = String(a && a.status || "").trim();
    if (a && a.statusCode === 3) return "Not shortlisted";
    return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : "Ended";
  }
  function niApplied(snap, hidden) {
    const h = hidden || {};
    return (snap && snap.apps || []).map(a => a.id).filter(id => h[id]);
  }
  function calMustGo(snap) {
    const applied = new Set((snap && snap.apps || []).map(a => a.id));
    return key => /^job\|/.test(key) && !applied.has(key.slice(4));
  }
  const SUFFIX = /\b(private|pvt|limited|ltd|llp|inc|india services|consulting india|corporate advisory india|company)\b\.?|\(.*?\)|,/gi;
  function shortFirm(c) {
    const keep = [];
    let x = String(c || "").replace(/\(.*?\)/g, " ").replace(/(&|\band)\s+(company|co)\b\.?/gi, m => {
      keep.push(m.replace(/\s+/g, " "));
      return " " + (keep.length - 1) + " ";
    });
    x = x.replace(SUFFIX, " ").replace(/\u0001(\d+)\u0001/g, (_, i) => keep[+i]);
    x = x.replace(/\s+/g, " ").trim().replace(/\s*(&|\band|[-–,.·])$/i, "").trim();
    return x || String(c || "").trim();
  }
  function eventTitle(e) {
    const firm = shortFirm(e.company), due = parseIST(e.due);
    if (e.kind === "apply") return "⏰ Apply: " + firm + " · " + e.role + " (closes " + hhmmIST(due) + ")";
    if (e.kind === "applied") return "✅ Applied: " + firm + " · " + e.role;
    if (e.kind === "shortlist") return "⏳ " + firm + ": shortlist expected";
    if (e.kind === "shortlisted") return "🎉 Shortlisted: " + firm + " · " + e.role;
    if (e.kind === "submitted") return "✓ Submitted: " + firm + ": " + e.label;
    if (e.kind === "done") return "✓ Done: " + firm + ": " + e.label;
    if (e.kind === "ended") return "✕ " + e.label + ": " + firm + " · " + e.role;
    return "⏰ " + firm + ": " + e.label + " due " + hhmmIST(due);
  }
  const GOOGLE_CLIENT_ID = "YOUR_CLIENT_ID.apps.googleusercontent.com";
  const googleReady = () => /^[0-9]+-[0-9a-z]+\.apps\.googleusercontent\.com$/.test(GOOGLE_CLIENT_ID);
  const COLOR = {
    applied: "10",
    shortlist: "5",
    shortlisted: "9",
    step: "6",
    submitted: "10",
    done: "10",
    ended: "8"
  };
  function eventResource(e, opts) {
    const remind = opts && typeof opts.reminder_minutes === "number" ? opts.reminder_minutes : 120;
    const due = parseIST(e.due);
    if (!due) return null;
    const lines = [ e.kind === "step" || e.kind === "submitted" || e.kind === "done" ? (e.kind === "submitted" ? "Submitted: " : e.kind === "done" ? "Done (marked by you): " : "") + e.label + " for " + shortFirm(e.company) + (e.role ? " · " + e.role : "") : shortFirm(e.company) + " · " + e.role, e.allDay ? "" : "Due " + isoIST(due).slice(0, 10) + " " + hhmmIST(due) + " IST", e.link ? "Company site: " + e.link : "", e.appId ? "On the portal: " + portalJobUrl(e.appId) : "", "", "From Placement Tracker (unofficial). It keeps this calendar up to date on its own." ].filter((l, i) => l || i === 4);
    const r = {
      summary: eventTitle(e),
      description: lines.join("\n"),
      transparency: "transparent",
      extendedProperties: {
        private: {
          ptKey: e.key
        }
      }
    };
    if (e.allDay) {
      const d = isoIST(due).slice(0, 10), next = isoIST(new Date(due.getTime() + 864e5)).slice(0, 10);
      Object.assign(r, {
        start: {
          date: d
        },
        end: {
          date: next
        },
        reminders: {
          useDefault: false,
          overrides: []
        }
      });
    } else {
      Object.assign(r, {
        start: {
          dateTime: isoIST(new Date(due.getTime() - 30 * 6e4)),
          timeZone: "Asia/Kolkata"
        },
        end: {
          dateTime: isoIST(due),
          timeZone: "Asia/Kolkata"
        },
        reminders: {
          useDefault: false,
          overrides: e.kind === "applied" || e.kind === "submitted" || e.kind === "done" || !remind ? [] : [ {
            method: "popup",
            minutes: remind
          } ]
        }
      });
    }
    if (COLOR[e.kind]) r.colorId = COLOR[e.kind];
    return r;
  }
  const sigOf = r => JSON.stringify([ r.summary, r.description, r.start, r.end, r.colorId || "", r.reminders ]);
  function calPlan(wanted, synced, opts, ctx) {
    const have = Object.assign({}, synced || {}), plan = {
      create: [],
      update: [],
      remove: []
    };
    const t = ctx && (ctx.now || Date.now()), past = d => {
      const x = parseIST(d);
      return !!(ctx && x && x.getTime() <= t);
    };
    for (const e of wanted || []) {
      const r = eventResource(e, opts);
      if (!r) continue;
      const sig = sigOf(r), was = have[e.key];
      delete have[e.key];
      if (!was) {
        if (!e.markOnly) plan.create.push({
          key: e.key,
          resource: r,
          sig: sig,
          due: e.due
        });
      } else if (was.sig !== sig && (was.due !== e.due || !(past(was.due) && past(e.due) && !e.force))) plan.update.push({
        key: e.key,
        id: was.id,
        resource: r,
        sig: sig,
        due: e.due
      });
    }
    for (const [key, v] of Object.entries(have)) {
      if (past(v.due) && !(ctx.mustGo && ctx.mustGo(key))) continue;
      plan.remove.push({
        key: key,
        id: v.id
      });
    }
    return plan;
  }
  function calAdopt(items, synced) {
    const by = {}, out = {}, extra = [], was = synced || {}, ends = {};
    for (const it of items || []) {
      const k = it && it.extendedProperties && it.extendedProperties.private && it.extendedProperties.private.ptKey;
      if (k) (by[k] = by[k] || []).push(it.id);
      if (k && it.end) ends[it.id] = it.end.dateTime || (it.end.date ? it.end.date : "");
    }
    for (const [k, ids] of Object.entries(by)) {
      const keep = was[k] && ids.includes(was[k].id) ? was[k].id : ids[0];
      out[k] = was[k] && was[k].id === keep ? was[k] : {
        id: keep,
        sig: "",
        due: ends[keep] || ""
      };
      for (const id of ids) if (id !== keep) extra.push({
        key: k,
        id: id
      });
    }
    return {
      synced: out,
      extra: extra
    };
  }
  const jobFacts = j => [ j.role, j.deadline, j.shortlistBy, j.expMin, j.expMax, j.minFlexL, j.maxFlexL ].join("|");
  function changedJobs(prevJobs, nextJobs) {
    const was = Object.fromEntries((prevJobs || []).map(j => [ j.id, jobFacts(j) ]));
    return (nextJobs || []).filter(j => was[j.id] !== undefined && was[j.id] !== jobFacts(j)).map(j => j.id);
  }
  const H2 = 2 * 36e5, H12 = 12 * 36e5, D3 = 3 * 24 * 36e5;
  function staleDetails(details, snap, now, perCheck) {
    const t = now || Date.now(), out = [], det = details || {};
    const open = (snap && snap.jobs || []).filter(j => {
      const d = parseIST(j.deadline);
      return !d || d.getTime() > t;
    });
    const live = (snap && snap.apps || []).filter(a => LIVE(a.statusCode));
    const seen = new Set;
    for (const x of open.map(j => ({
      id: j.id,
      soon: (parseIST(j.deadline) || new Date(864e13)).getTime() - t < D3
    })).concat(live.map(a => ({
      id: a.id,
      soon: false
    })))) {
      if (seen.has(x.id)) continue;
      seen.add(x.id);
      const d = det[x.id];
      if (!d || (d.v || 1) < DETAIL_V) continue;
      const age = t - (d.at || 0);
      if (d.stale || age > (x.soon ? H2 : H12)) out.push({
        id: x.id,
        age: d.stale ? Infinity : age
      });
    }
    return out.sort((a, b) => b.age - a.age).slice(0, perCheck === undefined ? 3 : perCheck).map(x => x.id);
  }
  function wlProfile(pre, contact) {
    const J = x => x && x.model && x.model.jsonData || {}, P = J(pre), C = J(contact), out = [];
    const val = o => {
      if (o == null) return "";
      if (typeof o !== "object") return String(o).trim();
      if ("value" in o) return val(o.value);
      if (o.label || o.name) return String(o.label || o.name).trim();
      return "";
    };
    const g = (sec, f) => val((sec || {})[f]);
    const iso = s => {
      s = String(s || "");
      if (/T\d/.test(s)) {
        const d = new Date(s);
        if (!isNaN(d)) return d.toLocaleDateString("en-CA", {
          timeZone: "Asia/Kolkata"
        });
      }
      return s;
    };
    const ymd = s => {
      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso(s));
      return m ? `${m[3]}/${m[2]}/${m[1]}` : String(s || "");
    };
    const yr = s => (/^(\d{4})/.exec(iso(s)) || [])[1] || "";
    const add = (id, label, v) => {
      v = String(v == null ? "" : v).trim();
      if (v && !/^(null|undefined|na|n\/a|-|\.)$/i.test(v)) out.push({
        id: id,
        label: label,
        v: v.slice(0, 500)
      });
    };
    const pd = P.personal_details || {}, cp = C.personal_details || {}, ad = P.additional_details || {}, ad2 = C.permanent_communication_details || {};
    const first = g(pd, "first_name"), mid = g(pd, "middle_name"), last = g(pd, "last_name").replace(/^\.$/, "");
    add("name", "Full name", g(pd, "name").replace(/\s+\.$/, "") || [ first, mid, last ].filter(Boolean).join(" "));
    add("first", "First name", first);
    add("middle", "Middle name", mid);
    add("last", "Last name", last);
    add("title", "Title", g(pd, "title"));
    add("gender", "Gender", g(pd, "gender"));
    add("dob", "Date of birth", ymd(g(pd, "dob")));
    add("age", "Age", g(pd, "age"));
    add("pgid", "PGID", g(pd, "registration_id") || g(cp, "registration_id"));
    add("campus", "Campus", g(pd, "campus") || g(cp, "campus"));
    add("isbmail", "ISB email", g(pd, "email") || g(cp, "email"));
    add("mail", "Personal email", g(cp, "personal_email"));
    add("mobile", "Mobile", g(cp, "personal_mobile") || g(cp, "campus_mobile"));
    add("whatsapp", "WhatsApp number", g(cp, "whatsapp_number"));
    add("altmobile", "Alternate mobile", g(cp, "alternate_mobile"));
    add("linkedin", "LinkedIn", g(pd, "linkedin_url") || g(cp, "linkedin"));
    add("gmat", "GMAT", g(ad, "gmat_details"));
    add("gre", "GRE", g(ad, "gre_details"));
    add("cat", "CAT score", g(ad, "cat_score"));
    add("catp", "CAT percentile", g(ad, "cat_percentile"));
    for (const [k, sec, nm] of [ [ "x", P.ssc_details, "Class X" ], [ "xii", P.hsc_details, "Class XII" ] ]) {
      add(k + ".school", nm + " school", g(sec, "school_name"));
      add(k + ".place", nm + " location", g(sec, "other_location") || g(sec, "location"));
      add(k + ".score", nm + " percentage / CGPA", g(sec, "percentage"));
      add(k + ".year", nm + " year of passing", yr(g(sec, "end_date")));
    }
    const ug = ((P.higher_education || {}).values || [])[0] || {};
    add("ug.degree", "Graduation degree", g(ug, "degree") === "Others" ? g(ug, "other_degree") : g(ug, "degree") || g(ug, "other_degree"));
    add("ug.college", "Graduation college", g(ug, "institution"));
    add("ug.university", "Graduation university", g(ug, "university_name"));
    add("ug.spec", "Graduation specialisation", g(ug, "specialization"));
    add("ug.score", "Graduation percentage / CGPA", g(ug, "percentage"));
    add("ug.year", "Graduation year", yr(g(ug, "end_date")));
    add("ug.place", "Graduation location", g(ug, "other_location") || g(ug, "location"));
    const te = P.total_work_experience || {}, yrs = parseFloat(g(te, "years_of_experience"));
    if (!isNaN(yrs)) {
      add("exp.years", "Total work experience (years)", String(Math.round(yrs * 10) / 10));
      add("exp.months", "Total work experience (months)", String(Math.round(yrs * 12)));
    }
    const jobs = ((P.work_experience || {}).values || []).slice(0, 8);
    jobs.forEach((w, i) => {
      const n = "job" + (i + 1), N = i ? `Experience ${i + 1}` : "Experience 1 (latest)";
      add(n + ".company", N + " · company", g(w, "company"));
      add(n + ".role", N + " · designation", g(w, "designation"));
      add(n + ".function", N + " · function", g(w, "function"));
      add(n + ".industry", N + " · industry", g(w, "industry"));
      add(n + ".place", N + " · location", g(w, "other_location") || g(w, "location"));
      add(n + ".from", N + " · from", ymd(g(w, "start_date")));
      add(n + ".to", N + " · to", ymd(g(w, "end_date")));
      const a = Date.parse(g(w, "start_date")), b = Date.parse(g(w, "end_date")) || Date.now();
      if (a) add(n + ".months", N + " · months", String(Math.max(0, Math.round((b - a) / (30.44 * 864e5)))));
    });
    const lc = g(te, "last_ctc") || g(jobs[0], "last_ctc"), cur = g(te, "currency_type") || g(jobs[0], "currency_type");
    add("ctc", "Last CTC", lc ? lc + (cur && !/^inr$/i.test(cur) ? " " + cur : "") : "");
    add("addr", "Permanent address", [ g(ad2, "address_line_1"), g(ad2, "address_line_2"), g(ad2, "address_line_3"), g(ad2, "other_city") || g(ad2, "city"), g(ad2, "other_state") || g(ad2, "state"), g(ad2, "pincode") ].filter(Boolean).join(", "));
    add("addr.city", "Home city", g(ad2, "other_city") || g(ad2, "city"));
    add("addr.state", "Home state", g(ad2, "other_state") || g(ad2, "state"));
    add("addr.pin", "Pincode", g(ad2, "pincode"));
    add("addr.country", "Country", g(ad2, "other_country") || g(ad2, "country"));
    add("nationality", "Nationality", g(ad2, "nationality"));
    return out;
  }
  function profileField(q) {
    const t = " " + normQ(q).replace(/[^a-z0-9%#/ ]+/g, " ").replace(/\s+/g, " ") + " ";
    const has = re => re.test(t);
    if (has(/ (pg|post ?grad\w*|mba|pgp|isb|masters?|expected|desired|why|reason|describe|explain|backlogs?|gap) /) && !has(/ isb (email|mail|id) /) && !has(/ (pgid|pg id) /)) return null;
    if (has(/ (father\w*|mother\w*|parent\w*|spouse\w*|guardian\w*|emergency|reference\w*|referr\w*|manager\w*|team|reporting|relative\w*|sibling\w*|friend\w*|internships?|interns?|project|projects|applying|applied|rank|notice) /)) return null;
    if (/^ (have|has|had|do|does|did|is|are|was|were|will|would|can|could|should|which|why|how|what|when|where|whether) /.test(t) && !has(/ (what|which) (is|are) (your|the) (name|email|mobile|phone|gender|date of birth|dob|age|pgid|campus) /)) return null;
    if (has(/ (pgid|pg id|registration (no|number|id)|roll (no|number)|student id|enrol\w* (no|number|id)) /)) return has(/ (university|college|school|board|exam|cat|gmat|gre) /) ? null : "pgid";
    const field = (pre, map) => {
      for (const [re, f] of map) if (re.test(t)) return pre + "." + f;
      return null;
    };
    const SCORE = / (percentage|percent|%|marks?|cgpa|gpa|grade|score|aggregate) /, YEAR = / (year|passing|passed|completion|graduat\w* year|batch) /;
    if (has(/ (10th|10 th|class x|class 10|std x|ssc|secondary|matric\w*|high school) /) && !has(/ (12th|xii|hsc|higher secondary) /)) return field("x", [ [ SCORE, "score" ], [ YEAR, "year" ], [ / (city|location|place) /, "place" ], [ / (school|institut\w*|name) /, "school" ] ]);
    if (has(/ (12th|12 th|class xii|class 12|std xii|hsc|higher secondary|intermediate|senior secondary|pre university|puc) /)) return field("xii", [ [ SCORE, "score" ], [ YEAR, "year" ], [ / (city|location|place) /, "place" ], [ / (school|college|institut\w*|name) /, "school" ] ]);
    if (has(/ (ug|under ?grad\w*|graduation|graduate|bachelor\w*|btech|b tech|bcom|b com|bsc|b sc|bba|degree|college|university|branch|stream|major) /)) return field("ug", [ [ SCORE, "score" ], [ YEAR, "year" ], [ / (city|location) /, "place" ], [ / university /, "university" ], [ / (college|institut\w*) /, "college" ], [ / (specialisation|specialization|branch|stream|major|discipline) /, "spec" ], [ / (city|location) /, "place" ], [ / (degree|course|qualification|name) /, "degree" ] ]);
    if (has(/ (ctc|salary|compensation|package|remuneration|fixed pay|pay) /)) return has(/ (expect\w*|anticipat\w*|target|minimum|min|desired|offer\w*|fixed|variable|breakup|break up|components?|hike|negotiable) /) || !has(/ (current|last|present|previous|drawn|latest) /) ? null : "ctc";
    const ord = (/ (?:experience|employer|company|organi[sz]ation|organi[sz]ations|job|work ex|workex|role|stint) ?(?:#|no|number)? ?(\d) /.exec(t) || /(?:^| )(\d) ?(?:st|nd|rd|th)? (?:experience|employer|company|organi[sz]ation|job)/.exec(t) || [])[1];
    const word = has(/ (current|latest|most recent|present|last|recent) (company|employer|organi[sz]ation|job|role|designation|experience|workplace) /) ? 1 : has(/ (previous|prior) (company|employer|organi[sz]ation|job|role|designation) /) ? 2 : has(/ (first|1st) /) ? 1 : has(/ (second|2nd) /) ? 2 : has(/ (third|3rd) /) ? 3 : 0;
    const jobQ = has(/ (company|employer|organi[sz]ation|designation|work ex\w*|workex|experience|job title|position|role) /);
    if (has(/ (total|overall|full time|full-time|relevant)? ?(work )?(experience|work ex|workex) /) && !ord && !word && has(/ (month|months|year|years|yrs|duration|total|overall|how much|how many) /)) return has(/ (relevant|domain|industry|sector|function|functional|sales|marketing|finance|consulting|fmcg|it|tech|technical|managerial|leadership|people|current|present|this|same|similar|in [a-z]+ (role|domain|industry|sector|function)) /) || /experience in (?!months|years)[a-z]/.test(t) ? null : has(/ month/) ? "exp.months" : "exp.years";
    if (jobQ && (ord || word || has(/ (company|employer|organi[sz]ation|designation) /))) {
      if (has(/ (website|address|url|type|size|turnover|revenue|mnc|listed|sector of the company|contact) /)) return null;
      if (!ord && !word && !has(/ (name|employer|designation) /)) return null;
      const n = Math.max(1, +ord || word || 1);
      const f = has(/ (start|joining|joined|since|from date|date of joining) /) || has(/ from /) && !has(/ name /) ? "from" : has(/ (end date|to date|till date|until date|leaving|relieving|date of leaving|left on) /) || has(/ (to|till|until|end) /) && has(/ date /) ? "to" : has(/ (duration|months|tenure) /) ? "months" : has(/ (designation|title|position|role) /) ? "role" : has(/ function /) ? "function" : has(/ (industry|sector|domain) /) ? "industry" : has(/ (location|city) /) ? "place" : has(/ (company|employer|organi[sz]ation|name) /) ? "company" : null;
      return f ? "job" + n + "." + f : null;
    }
    if (has(/ (date of birth|dob|birth date|birthday) /)) return "dob";
    if (has(/ age /)) return "age";
    if (has(/ (gender|sex) /)) return "gender";
    if (has(/ (whatsapp) /)) return "whatsapp";
    if (has(/ (alternate|alternative|secondary|other) (mobile|phone|contact|number) /)) return "altmobile";
    if (has(/ (mobile|phone|contact no|contact number|cell) /)) return "mobile";
    if (has(/ (personal|alternate|alternative|gmail|non isb|other) (email|e mail|mail) /)) return "mail";
    if (has(/ (email|e mail|mail id) /)) return "isbmail";
    if (has(/ linkedin /)) return "linkedin";
    if (has(/ gmat /)) return "gmat";
    if (has(/ gre /)) return "gre";
    if (has(/ cat /)) return has(/ percentile /) ? "catp" : "cat";
    if (has(/ campus /)) return "campus";
    if (has(/ nationality /)) return "nationality";
    if (has(/ (pin ?code|postal code|zip) /)) return "addr.pin";
    if (has(/ (office|current|present|correspondence|communication|local|campus|hostel|work) address /)) return null;
    if (has(/ (permanent|home|residential|postal)? ?address /)) return "addr";
    if (has(/ (home town|hometown|home city|native|permanent city) /)) return "addr.city";
    if (has(/ (home state|native state|permanent state) /)) return "addr.state";
    if (has(/ first name /)) return "first";
    if (has(/ (middle name) /)) return "middle";
    if (has(/ (last name|surname|family name) /)) return "last";
    if (has(/ title /) && has(/ (mr|ms|salutation) /)) return "title";
    if (has(/ ((full |candidate s |student s |your |applicant s )?name|name of (the )?(candidate|student|applicant)) /) && !has(/ (company|school|college|father|mother|guardian|referr\w*|manager|spouse|university|institut\w*|project|team) /)) return "name";
    return null;
  }
  const normQ = q => String(q || "").replace(/^[\s*]*(q\s*\d+\s*[.):-]\s*)?/i, "").replace(/[\s*]+$/, "").replace(/\s+/g, " ").replace(/\s*([?.:])+$/, "").trim().toLowerCase();
  const CONFIG_DEFAULTS = {
    announcement: "",
    announcement_link: "",
    whatsapp_number: "918826520018",
    whatsapp_message: "Hi, I'm using your Placement Tracker extension (the unofficial one, not ISB's) and need help.",
    setup_intro: "Open jobs go in with their deadlines. When you apply, the entry turns into your application's timeline. Moved deadlines move; Not interested takes a job out. You see it all on your phone.",
    phone_help_iphone: "Settings → Calendar → Accounts → your Gmail account → turn on Calendars. “Placement Tracker” shows up in the Calendar app within minutes.",
    phone_help_android: "Open Google Calendar → ☰ → tick “Placement Tracker”.",
    check_portal_minutes: 15,
    check_background_minutes: 120,
    checks_paused: false,
    reminder_minutes: 120,
    ask_group_name: "Placement Doubts and Queries",
    call_gap_seconds: 0
  };
  const CONFIG_RULES = {
    announcement: v => v.length <= 280 ? v : null,
    announcement_link: v => v === "" || /^https:\/\/[^\s<>"]{3,300}$/.test(v) ? v : null,
    whatsapp_number: v => /^[0-9]{10,15}$/.test(v.replace(/[\s+-]/g, "")) ? v.replace(/[\s+-]/g, "") : null,
    whatsapp_message: v => v && v.length <= 300 ? v : null,
    setup_intro: v => v && v.length <= 400 ? v : null,
    phone_help_iphone: v => v && v.length <= 300 ? v : null,
    phone_help_android: v => v && v.length <= 300 ? v : null,
    check_portal_minutes: v => {
      const n = Math.round(Number(v));
      return n >= 15 && n <= 180 ? n : null;
    },
    check_background_minutes: v => {
      const n = Math.round(Number(v));
      return n >= 120 && n <= 360 ? n : null;
    },
    checks_paused: v => /^(yes|true|1)$/i.test(v) ? true : /^(no|false|0|)$/i.test(v) ? false : null,
    reminder_minutes: v => {
      const n = Math.round(Number(v));
      return v !== "" && n >= 0 && n <= 1440 ? n : null;
    },
    ask_group_name: v => v && v.length <= 80 && !/https?:|chat\.whatsapp|wa\.me/i.test(v) ? v : null,
    call_gap_seconds: v => {
      const n = Number(v);
      return v !== "" && n >= 0 && n <= 10 ? n : null;
    }
  };
  function readConfig(rows) {
    const c = Object.assign({}, CONFIG_DEFAULTS);
    for (const r of rows || []) {
      const vals = Object.values(r || {}), k = String(r.key ?? vals[0] ?? "").trim(), v = String(r.value ?? vals[1] ?? "").trim();
      if (!Object.prototype.hasOwnProperty.call(CONFIG_RULES, k)) continue;
      const ok = CONFIG_RULES[k](v);
      if (ok !== null) c[k] = ok;
    }
    return c;
  }
  const SHEET_GROUPS = [ [ "Job", [ "Company", "Role", "Industry", "Domestic / International", "Cluster", "Blue tag" ] ], [ "Where you stand", [ "Status" ] ], [ "Dates", [ "Apply by", "Applied on", "Shortlist expected", "Days left to apply" ] ], [ "Process", [ "Current stage", "Next step", "Next step due", "Hiring stages", "Elimination rounds" ] ], [ "Your to-dos", [ "Cover letter", "Company website application", "Pending tasks" ] ], [ "Job facts", [ "Work type", "City", "Experience (years)", "Experience flexible", "Interview mode", "CGPA asked" ] ], [ "Counters", [ "Counter type", "Counter pool", "Counter used by this application" ] ], [ "Links", [ "Portal link", "Company site", "JD summary" ] ] ];
  function sheetStatus(id, app, open, hid) {
    if (app) {
      const c = app.statusCode;
      return c === 2 || c === 8 ? "Shortlisted" : c === 7 ? "Waitlisted" : c === 999 || app.counterReleased && LIVE(c) && c !== 2 ? "Counter back" : c === 3 ? "Not shortlisted" : c === 4 ? "Withdrawn" : c === 5 ? "Removed" : "Applied";
    }
    return hid[id] ? "Not interested" : open ? "Open" : "Closed (not applied)";
  }
  function sheetTable(snap, details, o) {
    o = o || {};
    const t = o.now || Date.now(), det = details || {}, hid = o.hidden || {}, clDone = o.clDone || {}, web = o.webDone || {};
    const apps = snap && snap.apps || [], dash = snap && snap.dash || [], byApp = Object.fromEntries(apps.map(a => [ a.id, a ]));
    const jobs = {};
    for (const j of [].concat(snap && snap.closedJobs || [], snap && snap.jobs || [])) if (j && j.id) jobs[j.id] = Object.assign({}, jobs[j.id] || {}, j);
    const ids = [ ...new Set(Object.keys(jobs).concat(apps.map(a => a.id))) ];
    const items = calItems(snap, det, web), sheetBy = {};
    (o.sheetJobs || []).forEach(r => {
      sheetBy[String(r.application_id || "").trim().toLowerCase()] = r;
    });
    const day = s => {
      const d = parseIST(s);
      return d ? isoIST(d).slice(0, 10) + (/^\d{4}-\d{2}-\d{2}$/.test(String(s)) ? "" : " " + hhmmIST(d)) : "";
    };
    const rows = ids.map(id => {
      const j = jobs[id] || {}, a = byApp[id], d = det[id] || {}, x = Object.assign({}, j, a ? {
        company: a.company || j.company,
        role: a.role || j.role,
        cluster: a.cluster || j.cluster,
        jobType: a.jobType || j.jobType,
        counterType: a.counterType || j.counterType,
        deadline: a.deadline || j.deadline,
        shortlistBy: a.shortlistBy || j.shortlistBy
      } : {});
      const due = parseIST(x.deadline), open = !a && due && due.getTime() > t;
      const mine = items.filter(it => it.appId === id), live = a && LIVE(a.statusCode);
      const next = live ? mine.filter(it => !it.done && parseIST(it.due) && parseIST(it.due).getTime() > t).sort((p, q) => parseIST(p.due) - parseIST(q.due))[0] : null;
      const stages = (d.stages || []).slice().sort((p, q) => (p.seq || 0) - (q.seq || 0));
      const pool = (() => {
        const k = poolKeyFor(x, dash);
        const r = dash.find(z => z.key === k);
        return r ? r.pool : "";
      })();
      const exp = d.expMin != null || d.expMax != null ? [ d.expMin, d.expMax ].filter(v => v != null && v !== "").join("–") : [ x.expMin, x.expMax ].filter(Boolean).join("–");
      const row = [ shortFirm(x.company), x.role || "", x.industry || "", x.jobType || "", x.cluster ? x.cluster.replace(/Cluster\s*/i, "Cluster-") : "", x.blueTag ? "Yes" : "No", sheetStatus(id, a, open, hid), day(x.deadline), a && a.appliedAt ? isoIST(new Date(a.appliedAt)).slice(0, 10) : "", day(x.shortlistBy), open ? Math.max(0, Math.round((due.getTime() - t) / 864e5 * 10) / 10) : "", a ? a.stage || "" : "", next ? next.label : "", next ? day(next.due) : "", stages.map(z => z.name + (z.elim ? " (elimination)" : "")).join(" → "), stages.length ? stages.filter(z => z.elim).length : "", d.cl ? clDone[id] ? "Sent" : "Needed" : "", d.website ? web[id] ? "Done" : "Needed" : "", a ? mine.filter(it => !it.mine && !it.done).length : "", d.workType || "", d.locations || "", exp, d.minFlex || d.maxFlex ? "Yes" : d.stages ? "No" : "", d.interview || "", d.cgpa || "", x.counterType || "", pool, a ? a.statusCode === 999 || a.counterReleased ? "Released" : LIVE(a.statusCode) || a.statusCode === 3 ? "Yes" : "No" : "", portalJobUrl(id), d.website && d.websiteLink ? d.websiteLink : "", ((sheetBy[String(id).toLowerCase()] || {}).jd_summary || "").slice(0, 2e3) ];
      if (o.pay) row.splice(25, 0, d.ctc || x.ctc || "");
      if (o.eligible) row.splice(25, 0, d.eligible === true ? "Yes" : d.eligible === false ? "No" : "");
      return {
        sort: [ sheetStatus(id, a, open, hid), due ? due.getTime() : 0 ],
        row: row
      };
    });
    const order = [ "Open", "Applied", "Shortlisted", "Waitlisted", "Counter back", "Not interested", "Not shortlisted", "Withdrawn", "Removed", "Closed (not applied)" ];
    rows.sort((p, q) => order.indexOf(p.sort[0]) - order.indexOf(q.sort[0]) || (p.sort[0] === "Open" ? p.sort[1] - q.sort[1] : q.sort[1] - p.sort[1]));
    const groups = SHEET_GROUPS.map(([g, cols]) => [ g, cols.slice() ]);
    if (o.eligible) groups[5][1].push("Eligible");
    if (o.pay) groups[5][1].push("CTC (as listed)");
    const header = groups.flatMap(g => g[1]);
    const counters = dash.map(r => [ r.pool, r.app.total == null ? "" : r.app.total, r.app.used == null ? "" : r.app.used, r.app.left == null ? "" : r.app.left ]);
    return {
      groups: groups,
      header: header,
      rows: rows.map(r => r.row),
      counters: {
        header: [ "Counter pool", "Total", "Used", "Left" ],
        rows: counters
      }
    };
  }
  const QA_COLS = [ "id", "topic", "company", "company_short", "question", "answer", "source", "status", "asked_on", "answered_on", "changed_previous", "changed_on", "keywords", "ask_variants", "times_asked", "qa_ids" ];
  function wlQA(r) {
    const o = {};
    for (const k of QA_COLS) if (r && r[k] != null && String(r[k]).trim() !== "") o[k] = String(r[k]).trim().slice(0, k === "answer" ? 2e3 : 600);
    if (o.times_asked) {
      const n = Math.round(Number(o.times_asked));
      if (n >= 1 && n < 1e4) o.times_asked = n; else delete o.times_asked;
    }
    return o.id && o.question ? o : null;
  }
  const QA_NOISE = new Set([ "pvt", "private", "ltd", "limited", "inc", "llp", "llc", "co", "the", "and", "of" ]);
  const firmWords = s => String(s || "").toLowerCase().replace(/&/g, " and ").replace(/\(.*?\)/g, " ").replace(/[^a-z0-9]+/g, " ").split(" ").filter(w => w && !QA_NOISE.has(w));
  const firmKey = w => w[0] === "boston" && w[1] === "consulting" ? "bcg" : w[0] === "ernst" && w[1] === "young" ? "ey" : w[0] === "pricewaterhousecoopers" ? "pwc" : w[0];
  function qaSameFirm(a, b) {
    const x = firmKey(firmWords(a)), y = firmKey(firmWords(b));
    return !!(x && y && x === y);
  }
  const qaFirmOf = e => e.company_short || e.company || "";
  const qaKey = e => e.id + "|" + (e.status || "") + "|" + (e.answered_on || "") + "|" + (e.changed_on || "");
  function qaNew(rows, known) {
    if (!Array.isArray(known)) return [];
    const k = new Set(known);
    return (rows || []).filter(e => e.status !== "unanswered" && !k.has(qaKey(e)));
  }
  const qaWords = s => String(s || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(w => w.length > 1 && !QA_STOP.has(w));
  const QA_STOP = new Set([ "is", "the", "a", "an", "to", "for", "of", "in", "on", "do", "does", "i", "can", "we", "my", "be", "it", "what", "how", "if", "and", "or", "are", "there", "any", "will", "should", "with", "at", "this", "that", "you", "me" ]);
  function qaSearch(rows, q) {
    const ws = qaWords(q);
    if (!ws.length) return {
      hits: [],
      close: []
    };
    const res = ws.map(w => new RegExp("(^|[^a-z0-9])" + w.replace(/[^a-z0-9]/g, ""), "i"));
    const scored = (rows || []).map(e => {
      const hay = (e.question + " " + (e.answer || "") + " " + qaFirmOf(e) + " " + (e.keywords || "") + " " + (e.ask_variants || "") + " " + (e.topic || "")).toLowerCase(), qk = (e.question + " " + (e.keywords || "")).toLowerCase();
      const m = res.map(r => r.test(hay)), n = m.filter(Boolean).length, big = ws.filter((w, i) => m[i] && w.length > 2).length, inQ = res.filter((r, i) => ws[i].length > 2 && r.test(qk)).length;
      return {
        e: e,
        n: n,
        big: big,
        s: n * 3 + inQ
      };
    });
    const hits = scored.filter(x => x.n === ws.length).sort((a, b) => b.s - a.s).map(x => x.e);
    const close = hits.length ? [] : scored.filter(x => x.big && x.e.status !== "unanswered").sort((a, b) => b.big - a.big || b.s - a.s).slice(0, 2).map(x => x.e);
    return {
      hits: hits,
      close: close
    };
  }
  const askLink = q => "https://wa.me/?text=" + encodeURIComponent(String(q || "").trim().slice(0, 600));
  const GA = {
    mid: "G-XXXXXXXXXX",
    secret: "YOUR_MP_API_SECRET"
  };
  const WHERE = [ "float", "popup", "card", "process", "panel", "tab", "auto", "firstrun" ];
  const ONOFF = [ "on", "off" ];
  const PLACE = [ "card", "list_row", "list_rail" ];
  const USAGE = {
    pt_install: {},
    pt_update: {},
    pt_active: {},
    pt_popup_open: {},
    pt_upcoming_open: {},
    pt_qa_open: {
      where: WHERE
    },
    pt_qa_search: {},
    pt_qa_card: {
      where: WHERE
    },
    pt_qa_ask: {},
    pt_sheet_make: {},
    pt_sheet_open: {},
    pt_share: {
      where: WHERE
    },
    pt_feedback: {
      where: WHERE
    },
    pt_tour_start: {
      where: WHERE
    },
    pt_tour_done: {},
    pt_portal_day: {
      ui: [ "cool", "portal" ]
    },
    pt_page: {
      page: [ "home", "jobs", "apps", "dash", "pending", "apply", "other" ],
      ui: [ "cool", "portal" ]
    },
    pt_job: {
      action: [ "jd_open", "role_jd_open", "apply_portal", "company_site", "star", "unstar", "not_interested", "undo_ni", "filters_open", "filter", "closed_open", "applied_open", "cover_letter_sent", "withdraw_help", "search", "view_list", "view_cards", "list_row_open", "row_open", "row_close", "role_tile", "tiles_more", "applied_fold", "back_note_seen", "sort", "form_open" ],
      where: PLACE,
      feature: [ "pool", "where", "fit", "mine", "summary", "firm", "cluster", "pay", "closes" ]
    },
    pt_app: {
      action: [ "next_step", "steps_open", "mark_done", "resume_open", "jd_open", "jobcard_open", "withdraw_help", "open_portal", "sl_fold", "panel_close", "todo_fold", "rest_fold", "back_list", "back_month" ],
      where: PLACE
    },
    pt_upcoming: {
      action: [ "view_list", "view_month", "results_awaited", "chip_on", "chip_off", "line_open", "month_step" ],
      feature: [ "apply", "step", "web", "shortlist", "done", "ni", "wait" ]
    },
    pt_window: {
      action: [ "answers_manage", "check_now", "cal_connect", "cal_reconnect", "cal_off", "cal_remake", "outlook_guide", "phone_help", "answer_edit", "answer_delete", "answers_clear", "answers_undo", "formfill_on", "formfill_off", "cool_on", "cool_off", "open_portal", "help", "tbc" ]
    },
    pt_form: {
      action: [ "filled", "undo", "fill_again", "cgpa_mandatory", "cgpa_optional", "cl_copy", "web_site", "web_done" ],
      bucket: [ "1-5", "6-15", "16+" ]
    },
    pt_edge: {
      action: [ "cal_on", "cal_off" ]
    },
    pt_tour_end: {
      step: [ "welcome", "upcoming", "qa", "cards", "sheet", "share", "done" ]
    },
    pt_firstrun_done: {
      bucket: [ "<1m", "1-3m", "3-10m", "10m+" ]
    },
    pt_pill: {
      action: [ "portal_page", "back_cool", "cool_on", "boring_on" ],
      page: [ "home", "jobs", "apps", "other" ]
    },
    pt_nudge: {
      action: [ "shown", "used", "closed", "later", "never", "tips_off", "tips_on" ],
      feature: [ "urgent", "try_cool", "tip_list", "tip_search", "tip_upcoming", "tip_qa", "tip_sheet", "tip_form", "whats_new" ]
    },
    pt_health: {
      kind: [ "portal_check", "calendar_sync", "google_signin", "sheet_update", "sheet_read", "background_read" ],
      err: [ "timeout", "auth", "http_4xx", "http_5xx", "network", "paused", "refused", "offline", "logged_out", "other" ]
    }
  };
  const USAGE_EVENTS = Object.keys(USAGE);
  const USAGE_PARAMS = [ "where", "ui", "page", "action", "feature", "bucket", "step", "kind", "err" ];
  function usageEvent(name, params) {
    const spec = USAGE[name];
    if (!spec) return null;
    if (typeof params === "string") params = {
      where: params
    };
    const out = {};
    for (const [k, v] of Object.entries(params || {})) if (spec[k] && spec[k].includes(v)) out[k] = v;
    return {
      name: name,
      params: out
    };
  }
  function usageProps(st, now) {
    const s = st || {}, wk = s.installWeek || "";
    const p = {
      cool_ui: s.coolUI === false ? "off" : "on",
      calendar: (s.gcal || {}).connected ? "yes" : "no",
      sheet: (s.gsheet || {}).id ? "yes" : "no",
      form_fill: s.ffOn === false ? "off" : "on",
      jobs_view: s.listView === false ? "cards" : "list"
    };
    if (/^\d{4}-W\d{2}$/.test(wk)) p.install_week = wk;
    return Object.fromEntries(Object.entries(p).map(([k, v]) => [ k, {
      value: v
    } ]));
  }
  function isoWeek(d) {
    const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())), day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    const y = t.getUTCFullYear(), w = Math.ceil(((t - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7);
    return y + "-W" + String(w).padStart(2, "0");
  }
  function errClass(e) {
    const m = String(e && (e.message || e) || "").toLowerCase();
    if (/refused|reads only while/.test(m)) return "refused";
    if (/not logged in|login expired|logged out/.test(m)) return "logged_out";
    if (/^offline$/.test(m) || /failed to fetch|network|offline/.test(m) && typeof navigator !== "undefined" && navigator.onLine === false) return "offline";
    return /timeout|timed out/.test(m) ? "timeout" : /401|403|auth|sign in|token|consent|reconnect/.test(m) ? "auth" : /\b4\d\d\b/.test(m) ? "http_4xx" : /\b5\d\d\b/.test(m) ? "http_5xx" : /network|failed to fetch|offline/.test(m) ? "network" : /pause/.test(m) ? "paused" : "other";
  }
  const BYE_URL = v => "https://thebettercampus.netlify.app/tracker-bye/?v=" + encodeURIComponent(String(v || "").replace(/[^0-9.]/g, "").slice(0, 12));
  const waLink = cfg => "https://wa.me/" + cfg.whatsapp_number + "?text=" + encodeURIComponent(cfg.whatsapp_message);
  return {
    portalRead: portalRead,
    wlJobForm: wlJobForm,
    mergeTasks: mergeTasks,
    intlTip: intlTip,
    FEATURES: FEATURES,
    STATUS: STATUS,
    portalJobUrl: portalJobUrl,
    portalTaskUrl: portalTaskUrl,
    portalWithdrawUrl: portalWithdrawUrl,
    SHARE: SHARE,
    FEEDBACK_URL: FEEDBACK_URL,
    shareText: shareText,
    wlJob: wlJob,
    openJobs: openJobs,
    poolFor: poolFor,
    sortApps: sortApps,
    nextDeadline: nextDeadline,
    detailQueue: detailQueue,
    jobDetailQueue: jobDetailQueue,
    DETAIL_V: DETAIL_V,
    parseIST: parseIST,
    isoIST: isoIST,
    calItems: calItems,
    calState: calState,
    poolKeyFor: poolKeyFor,
    pendingRelease: pendingRelease,
    wlDashboard: wlDashboard,
    wlApplication: wlApplication,
    wlDetail: wlDetail,
    wlTask: wlTask,
    listFacts: listFacts,
    releaseDate: releaseDate,
    diff: diff,
    jdPay: jdPay,
    CAL_ID_RE: CAL_ID_RE,
    CAL_KEY: CAL_KEY,
    sheetUrl: sheetUrl,
    SHEET_COLS: SHEET_COLS,
    parseGviz: parseGviz,
    wlSheetRow: wlSheetRow,
    sheetTime: sheetTime,
    sheetPulledAt: sheetPulledAt,
    cardRow: cardRow,
    cardRows: cardRows,
    wantedEvents: wantedEvents,
    eventTitle: eventTitle,
    EVENT_ICON: EVENT_ICON,
    endedLabel: endedLabel,
    calMustGo: calMustGo,
    niApplied: niApplied,
    shortFirm: shortFirm,
    eventResource: eventResource,
    calPlan: calPlan,
    calAdopt: calAdopt,
    GOOGLE_CLIENT_ID: GOOGLE_CLIENT_ID,
    googleReady: googleReady,
    CONFIG_DEFAULTS: CONFIG_DEFAULTS,
    readConfig: readConfig,
    heldText: heldText,
    slRecord: slRecord,
    wnFrom: wnFrom,
    releaseSchedule: releaseSchedule,
    statusCounts: statusCounts,
    waLink: waLink,
    sheetTable: sheetTable,
    SHEET_GROUPS: SHEET_GROUPS,
    ctcLakhs: ctcLakhs,
    ctcInfo: ctcInfo,
    closedJobs: closedJobs,
    effectiveHidden: effectiveHidden,
    jobFacts: jobFacts,
    changedJobs: changedJobs,
    staleDetails: staleDetails,
    normQ: normQ,
    releaseByDate: releaseByDate,
    counterLine: counterLine,
    wlProfile: wlProfile,
    profileField: profileField,
    QA_COLS: QA_COLS,
    wlQA: wlQA,
    qaSameFirm: qaSameFirm,
    qaFirmOf: qaFirmOf,
    qaKey: qaKey,
    qaNew: qaNew,
    qaSearch: qaSearch,
    askLink: askLink,
    GA: GA,
    USAGE: USAGE,
    USAGE_EVENTS: USAGE_EVENTS,
    USAGE_PARAMS: USAGE_PARAMS,
    usageEvent: usageEvent,
    usageProps: usageProps,
    isoWeek: isoWeek,
    errClass: errClass,
    BYE_URL: BYE_URL
  };
}();

if (typeof module !== "undefined") module.exports = PT;

if (typeof document !== "undefined" && typeof location !== "undefined" && /(^|\.)placements\.isb\.edu$/.test(location.hostname)) {
  const alive = () => {
    try {
      return !!(chrome.runtime && chrome.runtime.id);
    } catch (e) {
      return false;
    }
  };
  const clean = () => {
    try {
      document.querySelectorAll('[id^="pt-"], .pt-ff-bar, .pt-ff-fab, .pt-ff-panel, .pt-ff-tip, .pt-ff-toast, .pt-ff-note').forEach(e => e.remove());
      document.querySelectorAll(".pt-ff-fill, .pt-ff-new, .ptglow, .pt-tourglow").forEach(e => e.classList.remove("pt-ff-fill", "pt-ff-new", "ptglow", "pt-tourglow"));
      document.documentElement.removeAttribute("data-pt-cool");
      document.documentElement.removeAttribute("data-pt-edge");
      document.documentElement.removeAttribute("data-pt-peek");
    } catch (e) {}
  };
  const iv = setInterval(() => {
    if (alive()) return;
    clearInterval(iv);
    PT.dead = true;
    clean();
    setTimeout(clean, 1500);
    setTimeout(clean, 4e3);
  }, 1e3);
}