// ============================================================
//  src/lib/tracker.js  — NEW FILE (visitor + website log tracker)
//  Sends data to your Google Apps Script web app → Google Sheet.
//  It only *listens* to your existing app; it changes nothing in it.
// ============================================================
import { useAppStore } from "../store/Appstore";

// 1) Paste your Apps Script Web App URL here (ends with /exec)
const TRACKER_URL = "https://script.google.com/macros/s/AKfycbzWjiiu8W8zKkNIt5TQs2dLXTOeJHMfnBOBiIZ4EYFlZUkIlsZLNmzf41ID3lMtJ8TnHA/exec";
// 2) Must be EXACTLY the same as TOKEN in Code.gs
const TRACKER_TOKEN = "yr-31aug2009-advanced-portfolio";

const FLUSH_MS = 5000;        // send queued logs every 5 seconds
const MAX_ERRORS = 10;        // max JS errors logged per session
const TRACK_LOCALHOST = false; // true = also log while you test locally

const isLocal = ["localhost", "127.0.0.1"].includes(location.hostname);
const ENABLED =
  TRACKER_URL.startsWith("https://script.google.com/") &&
  (TRACK_LOCALHOST || !isLocal);

// ---------- helpers ----------
const uid = () =>
  (crypto.randomUUID && crypto.randomUUID()) ||
  Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

function safeStorage(store, key, make) {
  try {
    let v = store.getItem(key);
    if (!v) {
      v = make();
      store.setItem(key, v);
    }
    return v;
  } catch {
    return make();
  }
}

const visitorId = safeStorage(localStorage, "vt_visitor_id", uid); // same browser = same visitor
const sessionId = safeStorage(sessionStorage, "vt_session_id", uid); // new per tab session

function parseUA(ua) {
  const browser =
    /edg\//i.test(ua) ? "Edge" :
    /opr\/|opera/i.test(ua) ? "Opera" :
    /chrome|crios/i.test(ua) ? "Chrome" :
    /firefox|fxios/i.test(ua) ? "Firefox" :
    /safari/i.test(ua) ? "Safari" : "Other";
  const os =
    /windows/i.test(ua) ? "Windows" :
    /android/i.test(ua) ? "Android" :
    /iphone|ipad|ipod/i.test(ua) ? "iOS" :
    /mac os/i.test(ua) ? "macOS" :
    /linux/i.test(ua) ? "Linux" : "Other";
  const device = /mobile|android|iphone|ipod/i.test(ua)
    ? "Mobile"
    : /ipad|tablet/i.test(ua) ? "Tablet" : "Desktop";
  return { browser, os, device };
}

// ---------- queue + sending ----------
let queue = [];
let profile = null; // sent only once, with the first "visit" event
let errorCount = 0;

function log(type, detail = "", extra = "") {
  if (!ENABLED) return;
  queue.push({
    t: new Date().toISOString(),
    type,
    detail: String(detail).slice(0, 300),
    extra: String(extra).slice(0, 300),
    page: location.pathname + location.hash,
  });
}

function flush() {
  if (!ENABLED || (queue.length === 0 && !profile)) return;
  const payload = {
    token: TRACKER_TOKEN,
    visitorId,
    sessionId,
    profile,
    events: queue,
  };
  queue = [];
  profile = null;
  try {
    // text/plain avoids a CORS preflight, which Apps Script can't answer
    fetch(TRACKER_URL, {
      method: "POST",
      mode: "no-cors",
      keepalive: true,
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    }).catch(() => {});
  } catch {
    /* never break the portfolio because of tracking */
  }
}

// ---------- 1) visit (once per session) ----------
async function trackVisit() {
  if (!ENABLED) return;
  if (sessionStorage.getItem("vt_visit_logged")) return;
  sessionStorage.setItem("vt_visit_logged", "1");

  const ua = navigator.userAgent;
  const { browser, os, device } = parseUA(ua);
  let geo = {};
  try {
    // optional approximate location lookup (free, no key). Delete this
    // block if you don't want country/city/IP in your sheet.
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3000);
    const r = await fetch("https://ipwho.is/", { signal: ctrl.signal });
    clearTimeout(timer);
    const j = await r.json();
    if (j && j.success !== false) {
      geo = { ip: j.ip, country: j.country, region: j.region, city: j.city };
    }
  } catch {
    /* geo is optional */
  }

  profile = {
    ...geo,
    browser,
    os,
    device,
    screen: `${screen.width}x${screen.height}`,
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    referrer: document.referrer || "direct",
    userAgent: ua,
  };
  log("visit", document.referrer || "direct", location.href);
  flush();
}

// ---------- 2) listen to your existing store (no edits to it) ----------
function watchStore() {
  useAppStore.subscribe((state, prev) => {
    // apps opened / closed
    const prevIds = new Set(prev.windows.map((w) => w.id));
    const curIds = new Set(state.windows.map((w) => w.id));
    state.windows.forEach((w) => {
      if (!prevIds.has(w.id)) log("app_open", w.appId);
    });
    prev.windows.forEach((w) => {
      if (!curIds.has(w.id)) log("app_close", w.appId);
    });

    if (state.isLocked !== prev.isLocked) {
      log(state.isLocked ? "screen_lock" : "screen_unlock");
    }
    if (state.isDarkMode !== prev.isDarkMode) {
      log("dark_mode", state.isDarkMode ? "on" : "off");
    }
    if (state.currentTrack !== prev.currentTrack && state.currentTrack) {
      log("track_change", state.currentTrack.title || "");
    }
    if (state.isAudioPlaying !== prev.isAudioPlaying) {
      log(state.isAudioPlaying ? "music_play" : "music_pause");
    }
  });
}

// ---------- 3) outbound link clicks ----------
function watchLinks() {
  document.addEventListener(
    "click",
    (e) => {
      const a = e.target.closest && e.target.closest("a[href]");
      if (!a) return;
      try {
        const u = new URL(a.href, location.href);
        if (u.origin !== location.origin) log("link_click", u.href);
      } catch {
        /* ignore bad URLs */
      }
    },
    true
  );
}

// ---------- 4) JS errors ----------
function watchErrors() {
  window.addEventListener("error", (e) => {
    if (errorCount++ < MAX_ERRORS) {
      log("js_error", e.message, `${e.filename || ""}:${e.lineno || ""}`);
    }
  });
  window.addEventListener("unhandledrejection", (e) => {
    if (errorCount++ < MAX_ERRORS) {
      log("js_error", "unhandledrejection", String(e.reason).slice(0, 250));
    }
  });
}

// ---------- 5) time spent ----------
const startedAt = Date.now();
function watchLeave() {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      log("tab_hidden", "", `${Math.round((Date.now() - startedAt) / 1000)}s on site`);
      flush();
    }
  });
  window.addEventListener("pagehide", flush);
}

// ---------- start ----------
if (ENABLED) {
  try {
    trackVisit();
    watchStore();
    watchLinks();
    watchErrors();
    watchLeave();
    setInterval(flush, FLUSH_MS);
  } catch {
    /* tracking must never break the site */
  }
}
