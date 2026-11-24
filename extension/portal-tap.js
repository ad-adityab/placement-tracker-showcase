(() => {
  if (window.__ptTap) return;
  window.__ptTap = true;
  const READS = /^\/ssms\/api\/(sk-student-application-statuses\/(allApplications|dashboard)|sk-submissions\/(pending|[0-9a-f-]{36})|sk-applications\/student\/(active|closed)|sk-applications\/[0-9a-f-]{36})$/i;
  const API = /^\/ssms\/api\//;
  const pathOf = u => {
    try {
      return new URL(u, location.href).pathname;
    } catch (e) {
      return "";
    }
  };
  let ready = false;
  const held = new Map;
  const out = msg => {
    try {
      window.postMessage(Object.assign({
        __ptTap: 1
      }, msg), location.origin);
    } catch (e) {}
  };
  const post = msg => {
    if (ready) out(msg); else {
      held.delete(msg.path);
      held.set(msg.path, msg);
      if (held.size > 20) held.delete(held.keys().next().value);
    }
  };
  window.addEventListener("message", e => {
    if (e.source === window && e.data && e.data.__ptTapReady === 1 && !ready) {
      ready = true;
      for (const m of held.values()) out(m);
      held.clear();
    }
  });
  const unfiltered = b => {
    if (b == null || b === "") return true;
    try {
      const o = typeof b === "string" ? JSON.parse(b) : b;
      return !!o && typeof o === "object" && Object.values(o).every(v => v === "0" || v === "" || v === 0 || v == null);
    } catch (e) {
      return false;
    }
  };
  function seen(method, url, status, text, body) {
    const p = pathOf(url), m = String(method || "GET").toUpperCase();
    if (!API.test(p) || status < 200 || status >= 300) return;
    if (READS.test(p)) {
      if (/student\/(active|closed)$/i.test(p) && !unfiltered(body)) return;
      if (typeof text === "string" && text.length < 5e6) post({
        kind: "reply",
        path: p,
        method: m,
        text: text
      });
    } else if (m !== "GET") post({
      kind: "write",
      path: p.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, "<id>"),
      method: m
    });
  }
  const X = XMLHttpRequest.prototype, open = X.open, send = X.send;
  X.open = function(method, url) {
    try {
      this.__pt = {
        method: method,
        url: String(url)
      };
    } catch (e) {}
    return open.apply(this, arguments);
  };
  X.send = function(body) {
    try {
      const x = this;
      if (x.__pt) x.__pt.body = typeof body === "string" && body.length < 4e3 ? body : body == null ? null : "?";
      x.addEventListener("loadend", () => {
        try {
          if (!x.__pt) return;
          let text = null;
          if (x.responseType === "" || x.responseType === "text") text = x.responseText; else if (x.responseType === "json" && x.response != null) text = JSON.stringify(x.response);
          seen(x.__pt.method, x.__pt.url, x.status, text, x.__pt.body);
        } catch (e) {}
      });
    } catch (e) {}
    return send.apply(this, arguments);
  };
  const f = window.fetch;
  if (f) window.fetch = function(input, init) {
    const method = init && init.method || input && input.method || "GET", url = typeof input === "string" ? input : input && input.url || String(input);
    if (/^\s*about:/i.test(url)) return Promise.reject(new TypeError("Failed to fetch"));
    let p0 = "";
    try {
      p0 = pathOf(url);
    } catch (e) {}
    if (!API.test(p0)) return f.apply(this, arguments);
    const body = init && typeof init.body === "string" ? init.body : init && init.body != null ? "?" : null;
    return f.apply(this, arguments).then(r => {
      try {
        const p = pathOf(url);
        if (API.test(p)) {
          if (READS.test(p)) r.clone().text().then(t => seen(method, url, r.status, t, body)).catch(() => {}); else seen(method, url, r.status, null, body);
        }
      } catch (e) {}
      return r;
    });
  };
})();