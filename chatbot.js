/**
 * chatbot.js
 * The Soochana Assistant: a floating chat window on every page.
 *
 * The answers come from chatbot-engine.js, which works from the portal's own
 * district tables (learn/data/districts.json, datasets/*.json) and its
 * article, report and dataset indexes (data/*.json). Everything runs in the
 * browser, so it works on GitHub Pages with no server. The engine and the
 * data load the first time someone opens the chat, not with the page.
 *
 * Answers arrive as data (paragraphs, tables, bars, links) and are built with
 * textContent only, so nothing a visitor types is ever parsed as HTML.
 */

(function () {
  if (document.getElementById("soochana-chatbot")) return;

  // Paths resolve against this script, so pages in sub-folders (learn/) work too.
  const SELF = document.currentScript && document.currentScript.src
    ? document.currentScript.src
    : new URL("chatbot.js", location.href).href;
  const VERSION = (SELF.split("?")[1] || "");
  const at = (path) => new URL(path, SELF).href;
  const AVATAR = at("icons/assistant-96.png");
  const AVATAR_LARGE = at("icons/assistant-192.png");

  const pageDistrict = /(^|\/)district\.html$/.test(location.pathname)
    ? new URLSearchParams(location.search).get("id") || "Bolangir"
    : null;

  /* ── engine and data, loaded once on first open ───────── */

  let enginePromise = null;
  function loadEngine() {
    if (enginePromise) return enginePromise;
    const json = (path, pick) => fetch(at(path))
      .then(r => (r.ok ? r.json() : null))
      .then(d => (d && pick ? pick(d) : d))
      .catch(() => null);
    const script = window.SoochanaChat ? Promise.resolve() : new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = at("chatbot-engine.js" + (VERSION ? "?" + VERSION : ""));
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
    enginePromise = Promise.all([
      script,
      json("learn/data/districts.json"),
      json("datasets/district_population_trends.json"),
      json("datasets/nfhs_district_rounds.json"),
      json("datasets/national_comparisons.json"),
      json("data/contents.json", d => d.recentContent),
      json("data/reports.json", d => d.reports),
      json("data/datasets.json", d => d.datasets),
      json("datasets/nfhs6_state_factsheet.json"),
      json("datasets/orgi_state_projection.json")
    ]).then(([, districts, population, nfhs, national, contents, reports, datasets, nfhsState, orgi]) => {
      if (!districts) throw new Error("district table did not load");
      return window.SoochanaChat.createEngine({ districts, population, nfhs, national, contents, reports, datasets, nfhsState, orgi });
    });
    enginePromise.catch(() => { enginePromise = null; });
    return enginePromise;
  }

  /* ── icons ────────────────────────────────────────────── */

  const ICON = {
    close: '<path d="M18 6 6 18M6 6l12 12"/>',
    expand: '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>',
    shrink: '<path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/>',
    reset: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
    send: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    compare: '<path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/>',
    rank: '<path d="M4 20h16"/><rect x="5" y="11" width="3" height="6" rx="1"/><rect x="10.5" y="6" width="3" height="11" rx="1"/><rect x="16" y="13" width="3" height="4" rx="1"/>',
    trend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    insight: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3z"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    arrow: '<path d="M7 17 17 7M9 7h8v8"/>'
  };
  function svg(name, cls) {
    return '<svg class="' + (cls || "cb-ico") + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON[name] + "</svg>";
  }

  /* ── styles ───────────────────────────────────────────── */

  // The home page look (home.css): warm paper, deep ink, Sambalpuri indigo,
  // turmeric highlighter, Anton capitals for headings, Merriweather for
  // reading and Hind for controls. The colours are the assistant's own, so it
  // reads the same on every page, including pages with a dark theme.
  // Pages that do not load the home fonts get them here.
  if (!document.querySelector('link[href*="family=Anton"]')) {
    const f = document.createElement("link");
    f.rel = "stylesheet";
    f.href = "https://fonts.googleapis.com/css2?family=Anton&family=Hind:wght@400;500;600;700&family=Merriweather:wght@300;400;700&display=swap";
    document.head.appendChild(f);
  }
  const style = document.createElement("style");
  style.textContent = `
    #soochana-chatbot {
      --cb-paper: #f6f3ec;
      --cb-surface: #ffffff;
      --cb-ink: #14202e;
      --cb-indigo: #1e2a78;
      --cb-indigo-deep: #141c57;
      --cb-muted: #555c68;
      --cb-line: rgba(20, 32, 46, 0.14);
      --cb-turmeric: #ffc629;
      --cb-orange: #f08a4b;
      --cb-link: #b3561c;
      --cb-bar: #1e2a78;
      --cb-bar-muted: #cfc9b8;
      --cb-bar-neg: #e0913a;
      --cb-display: Anton, Oswald, "Arial Narrow", Impact, sans-serif;
      --cb-read: Merriweather, Georgia, "Times New Roman", serif;
      --cb-ui: Hind, "Segoe UI", system-ui, -apple-system, sans-serif;
      --cb-scale: var(--type-scale, 1);
      --cb-ease: cubic-bezier(0.16, 1, 0.3, 1);
      color: var(--cb-ink);
      font-family: var(--cb-ui);
    }
    #soochana-chatbot *, #soochana-chatbot *::before, #soochana-chatbot *::after { box-sizing: border-box; }
    .cb-ico { width: 18px; height: 18px; flex-shrink: 0; }
    /* Some pages style every svg path for their maps; the icons keep their own lines. */
    #soochana-chatbot .cb-ico * { stroke: currentColor; stroke-width: 2px; fill: none; }

    /* launcher */
    #chatbot-trigger {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 64px;
      height: 64px;
      padding: 0;
      border-radius: 50%;
      border: 3px solid #ffffff;
      /* the small avatar sits under the large one, so the button is never blank */
      background: url("${AVATAR_LARGE}") center / cover no-repeat, url("${AVATAR}") center / cover no-repeat, var(--cb-indigo);
      box-shadow: 0 8px 22px rgba(20, 32, 46, 0.32), 0 0 0 1.6px var(--cb-ink);
      cursor: pointer;
      z-index: 10000;
      transition: transform 0.3s var(--cb-ease), box-shadow 0.3s;
    }
    #chatbot-trigger::after {
      content: "";
      position: absolute;
      inset: -7px;
      border-radius: 50%;
      border: 2px solid var(--cb-turmeric);
      animation: cbRing 2.8s var(--cb-ease) infinite;
      pointer-events: none;
    }
    #chatbot-trigger:hover { transform: translateY(-3px) scale(1.04); box-shadow: 0 12px 28px rgba(20, 32, 46, 0.4), 0 0 0 1.6px var(--cb-ink); }
    #chatbot-trigger:focus-visible { outline: 3px solid var(--cb-turmeric); outline-offset: 4px; }
    #chatbot-trigger[aria-expanded="true"]::after { animation: none; opacity: 0; }
    @keyframes cbRing {
      0% { transform: scale(0.9); opacity: 0.9; }
      70%, 100% { transform: scale(1.25); opacity: 0; }
    }

    .cb-peek {
      position: fixed;
      right: 100px;
      bottom: 38px;
      background: var(--cb-ink);
      color: #ffffff;
      font-family: var(--cb-ui);
      font-size: calc(14px * var(--cb-scale));
      font-weight: 600;
      padding: 8px 15px;
      border-radius: 999px;
      box-shadow: 0 6px 18px rgba(20, 32, 46, 0.28);
      white-space: nowrap;
      z-index: 10000;
      opacity: 0;
      transform: translateX(8px);
      transition: opacity 0.25s, transform 0.3s var(--cb-ease);
      pointer-events: none;
    }
    .cb-peek.show { opacity: 1; transform: none; }
    /* a nudge makes the bubble a real control: clicking it opens the chat */
    .cb-peek.cb-live { pointer-events: auto; cursor: pointer; }
    .cb-peek-dots { display: none; gap: 4px; align-items: center; height: 16px; }
    .cb-peek-dots i { width: 6px; height: 6px; border-radius: 50%; background: var(--cb-turmeric); opacity: 0.4; animation: cbDots 1s infinite; }
    .cb-peek-dots i:nth-child(2) { animation-delay: 0.15s; }
    .cb-peek-dots i:nth-child(3) { animation-delay: 0.3s; }
    .cb-peek.typing .cb-peek-dots { display: inline-flex; }
    .cb-peek.typing .cb-peek-text { display: none; }
    @keyframes cbDots { 0%, 100% { opacity: 0.3; transform: none; } 40% { opacity: 1; transform: translateY(-2px); } }

    /* unread badge: until the visitor opens the assistant for the first time */
    .cb-badge {
      position: absolute;
      top: -4px;
      right: -4px;
      min-width: 22px;
      height: 22px;
      padding: 0 6px;
      border-radius: 999px;
      background: var(--cb-turmeric);
      color: var(--cb-ink);
      border: 2px solid #ffffff;
      font-family: var(--cb-ui);
      font-weight: 700;
      font-size: 12px;
      line-height: 18px;
      text-align: center;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
      transform: scale(0);
      transition: transform 0.35s var(--cb-ease);
      pointer-events: none;
    }
    #chatbot-trigger.cb-unread .cb-badge { transform: scale(1); animation: cbBadge 2.4s ease-in-out 1s infinite; }
    @keyframes cbBadge { 0%, 70%, 100% { transform: scale(1); } 80% { transform: scale(1.22); } 90% { transform: scale(0.95); } }

    /* the nudge: a wiggle and a turmeric flicker round the button */
    #chatbot-trigger.cb-nudge { animation: cbWiggle 1.1s var(--cb-ease), cbFlicker 1.4s linear; }
    @keyframes cbWiggle {
      0%, 100% { transform: none; }
      12% { transform: translateY(-6px) rotate(-10deg); }
      26% { transform: translateY(-6px) rotate(9deg); }
      40% { transform: translateY(-4px) rotate(-6deg); }
      54% { transform: translateY(-2px) rotate(4deg); }
      70% { transform: rotate(-1deg); }
    }
    @keyframes cbFlicker {
      0%, 100% { box-shadow: 0 8px 22px rgba(20, 32, 46, 0.32), 0 0 0 1.6px var(--cb-ink); }
      10%, 30%, 55% { box-shadow: 0 8px 22px rgba(20, 32, 46, 0.32), 0 0 0 6px rgba(255, 198, 41, 0.85), 0 0 28px 8px rgba(255, 198, 41, 0.45); }
      20%, 42% { box-shadow: 0 8px 22px rgba(20, 32, 46, 0.32), 0 0 0 2px rgba(255, 198, 41, 0.3); }
      75% { box-shadow: 0 8px 22px rgba(20, 32, 46, 0.32), 0 0 0 12px rgba(255, 198, 41, 0), 0 0 30px 10px rgba(255, 198, 41, 0); }
    }

    /* window */
    #chatbot-drawer {
      position: fixed;
      bottom: 100px;
      right: 24px;
      width: 420px;
      height: 640px;
      max-height: calc(100vh - 124px);
      background: var(--cb-paper);
      border-radius: 20px;
      box-shadow: 0 24px 60px rgba(20, 32, 46, 0.26), 0 0 0 1.6px var(--cb-ink);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transform-origin: bottom right;
      transform: translateY(16px) scale(0.96);
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
      transition: transform 0.35s var(--cb-ease), opacity 0.25s, visibility 0s linear 0.35s, width 0.35s var(--cb-ease), height 0.35s var(--cb-ease);
      z-index: 10000;
    }
    #chatbot-drawer.open {
      transform: none;
      opacity: 1;
      visibility: visible;
      pointer-events: auto;
      transition: transform 0.35s var(--cb-ease), opacity 0.25s, visibility 0s, width 0.35s var(--cb-ease), height 0.35s var(--cb-ease);
    }
    #chatbot-drawer.wide { width: min(760px, calc(100vw - 48px)); height: calc(100vh - 124px); }

    .chatbot-header {
      position: relative;
      background: var(--cb-indigo);
      color: #ffffff;
      padding: 14px 12px 16px 16px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    /* a handloom border under the header: turmeric, madder orange, indigo */
    .chatbot-header::after {
      content: "";
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      height: 5px;
      background: linear-gradient(90deg, var(--cb-turmeric) 0 62%, var(--cb-orange) 62% 84%, var(--cb-indigo-deep) 84%);
    }
    .cb-avatar {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      flex-shrink: 0;
      background: var(--cb-indigo) url("${AVATAR}") center / cover no-repeat;
      box-shadow: 0 0 0 2px var(--cb-turmeric);
    }
    .cb-head-text { flex: 1; min-width: 0; }
    .chatbot-header-title {
      font-family: var(--cb-display);
      font-size: calc(19px * var(--cb-scale));
      font-weight: 400;
      text-transform: uppercase;
      letter-spacing: 0.02em;
      margin: 0;
      color: #ffffff;
      line-height: 1.1;
    }
    .chatbot-header-sub { display: flex; align-items: center; gap: 6px; font-family: var(--cb-ui); font-size: calc(12.5px * var(--cb-scale)); color: rgba(255, 255, 255, 0.85); margin-top: 3px; }
    .chatbot-header-sub::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--cb-turmeric); box-shadow: 0 0 0 3px rgba(255, 198, 41, 0.28); }
    .cb-head-btns { display: flex; gap: 2px; }
    .cb-icon-btn, .chatbot-close-btn {
      background: transparent;
      border: none;
      color: #ffffff;
      cursor: pointer;
      width: 36px;
      height: 36px;
      border-radius: 999px;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0.85;
      transition: background 0.2s, opacity 0.2s, color 0.2s;
    }
    .cb-icon-btn:hover, .cb-icon-btn:focus-visible, .chatbot-close-btn:hover, .chatbot-close-btn:focus-visible { opacity: 1; background: rgba(255, 255, 255, 0.14); color: var(--cb-turmeric); outline: none; }

    /* conversation */
    .chatbot-messages {
      flex: 1;
      padding: 18px 16px 10px;
      overflow-y: auto;
      background: var(--cb-paper);
      display: flex;
      flex-direction: column;
      gap: 14px;
      scroll-behavior: smooth;
    }
    .chatbot-messages::-webkit-scrollbar { width: 8px; }
    .chatbot-messages::-webkit-scrollbar-thumb { background: rgba(20, 32, 46, 0.2); border-radius: 8px; }

    .cb-row { display: flex; gap: 10px; align-items: flex-start; animation: cbIn 0.35s var(--cb-ease) both; }
    .cb-row.user { justify-content: flex-end; }
    .cb-row .cb-avatar { width: 30px; height: 30px; box-shadow: 0 0 0 2px #ffffff, 0 0 0 3.2px var(--cb-ink); margin-top: 2px; }
    @keyframes cbIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

    .chat-bubble {
      padding: 13px 15px;
      border-radius: 16px;
      font-size: calc(14px * var(--cb-scale));
      line-height: 1.6;
      overflow-wrap: anywhere;
      min-width: 0;
    }
    .chat-bubble.bot {
      flex: 1;
      background: var(--cb-surface);
      color: var(--cb-ink);
      border-top-left-radius: 4px;
      box-shadow: 0 0 0 1px var(--cb-line), 0 2px 6px rgba(20, 32, 46, 0.05);
    }
    /* answers read like the home page: Merriweather for sentences */
    .chat-bubble.bot p:not(.cb-note) { font-family: var(--cb-read); font-weight: 300; font-size: calc(13.5px * var(--cb-scale)); line-height: 1.7; }
    .chat-bubble.user {
      max-width: 82%;
      background: var(--cb-ink);
      color: #ffffff;
      font-weight: 500;
      border-top-right-radius: 4px;
    }
    .chat-bubble p { margin: 0 0 8px; }
    .chat-bubble p:last-child { margin-bottom: 0; }
    /* key figures get the home page's turmeric highlighter */
    .chat-bubble strong {
      font-family: var(--cb-ui);
      font-weight: 700;
      color: var(--cb-ink);
      background: linear-gradient(transparent 62%, rgba(255, 198, 41, 0.6) 62%);
      padding: 0 1px;
    }
    .chat-bubble.user strong { color: inherit; background: none; }
    .chat-bubble ul { margin: 4px 0 10px; padding-left: 18px; }
    .chat-bubble li { margin-bottom: 5px; font-family: var(--cb-read); font-weight: 300; font-size: calc(13px * var(--cb-scale)); }
    .chat-bubble li::marker { color: var(--cb-orange); }
    .chat-bubble .cb-note {
      display: flex;
      gap: 7px;
      font-family: var(--cb-ui);
      font-size: calc(12.5px * var(--cb-scale));
      color: var(--cb-muted);
      background: var(--cb-paper);
      border-left: 3px solid var(--cb-turmeric);
      border-radius: 4px 8px 8px 4px;
      padding: 7px 10px;
      margin-top: 4px;
      line-height: 1.45;
    }
    .chat-bubble .cb-note .cb-ico { width: 14px; height: 14px; margin-top: 2px; color: var(--cb-indigo); }
    .chat-bubble .cb-note.cb-src { background: none; border-left: none; padding: 6px 0 0; font-family: var(--cb-read); font-weight: 300; font-size: calc(11.5px * var(--cb-scale)); border-top: 1px solid var(--cb-line); border-radius: 0; margin-top: 8px; }
    .chat-bubble .cb-note.cb-src .cb-ico { color: var(--cb-muted); }

    .cb-table-wrap { overflow-x: auto; margin: 8px 0 12px; }
    .cb-table { border-collapse: collapse; width: 100%; font-size: calc(12.5px * var(--cb-scale)); }
    .cb-table th, .cb-table td { padding: 7px 8px; text-align: left; border-bottom: 1px solid var(--cb-line); vertical-align: top; }
    .cb-table th {
      color: var(--cb-indigo);
      font-weight: 700;
      font-size: calc(11px * var(--cb-scale));
      letter-spacing: 0.06em;
      text-transform: uppercase;
      white-space: nowrap;
      border-bottom: 1.6px solid var(--cb-ink);
    }
    .cb-table td:first-child { min-width: 150px; }
    .cb-table td:not(:first-child) { white-space: nowrap; font-variant-numeric: tabular-nums; font-weight: 600; }
    .cb-table tbody tr:hover td { background: var(--cb-paper); }
    .cb-table tr:last-child td { border-bottom: none; }

    .cb-bars { margin: 8px 0 12px; display: grid; grid-template-columns: minmax(80px, max-content) 1fr max-content; gap: 7px 10px; align-items: center; font-size: calc(12.5px * var(--cb-scale)); }
    .cb-bars.compact { max-height: 240px; overflow-y: auto; padding-right: 4px; gap: 4px 10px; }
    .cb-bars .cb-lab { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .cb-bars .cb-track { height: 12px; background: rgba(20, 32, 46, 0.06); border-radius: 999px; overflow: hidden; }
    .cb-bars .cb-fill { display: block; height: 100%; background: var(--cb-bar); border-radius: 999px; transform-origin: left; animation: cbGrow 0.6s var(--cb-ease) both; }
    .cb-bars .cb-fill.muted { background: var(--cb-bar-muted); }
    .cb-bars .cb-fill.neg { background: var(--cb-bar-neg); }
    .cb-bars .cb-lab.hl { font-weight: 700; }
    .cb-bars .cb-fill.hl { background: var(--cb-turmeric); box-shadow: inset 0 0 0 1.5px rgba(20, 32, 46, 0.35); }
    .cb-bars .cb-val { font-variant-numeric: tabular-nums; font-weight: 600; color: var(--cb-ink); white-space: nowrap; }
    @keyframes cbGrow { from { transform: scaleX(0); } to { transform: scaleX(1); } }

    .chatbot-link-section { margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--cb-line); display: grid; gap: 6px; }
    .chatbot-rec-title, .cb-follow-label {
      font-family: var(--cb-ui);
      font-size: calc(11.5px * var(--cb-scale));
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--cb-indigo);
    }
    .chatbot-item-link {
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 9px 12px;
      border-radius: 12px;
      background: var(--cb-paper);
      color: var(--cb-ink) !important;
      text-decoration: none;
      font-weight: 600;
      font-size: calc(13px * var(--cb-scale));
      line-height: 1.35;
      box-shadow: inset 0 0 0 1px transparent;
      transition: background 0.2s, box-shadow 0.2s, transform 0.2s var(--cb-ease);
    }
    .chatbot-item-link .cb-link-ico { font-size: 15px; line-height: 1; }
    .chatbot-item-link .cb-link-text { flex: 1; min-width: 0; }
    .chatbot-item-link .cb-ico { width: 15px; height: 15px; color: var(--cb-link); }
    .chatbot-item-link:hover, .chatbot-item-link:focus-visible { background: #ffffff; box-shadow: inset 0 0 0 1.6px var(--cb-ink); transform: translateX(2px); outline: none; }

    .cb-follow { padding-left: 40px; display: grid; gap: 7px; animation: cbIn 0.35s var(--cb-ease) 0.1s both; }
    .cb-chips { display: flex; flex-wrap: wrap; gap: 7px; }
    /* the home page's chapter pills: ink outline, filled on hover */
    .cb-chip {
      border: 1.6px solid var(--cb-ink);
      background: var(--cb-surface);
      color: var(--cb-ink);
      border-radius: 999px;
      padding: 6px 14px;
      font-family: var(--cb-ui);
      font-size: calc(13px * var(--cb-scale));
      font-weight: 600;
      line-height: 1.35;
      cursor: pointer;
      text-align: left;
      transition: background 0.2s, color 0.2s, transform 0.2s var(--cb-ease);
    }
    .cb-chip:hover, .cb-chip:focus-visible { background: var(--cb-ink); color: #ffffff; transform: translateY(-1px); outline: none; }

    /* welcome */
    .cb-hello { text-align: center; padding: 10px 8px 4px; animation: cbIn 0.4s var(--cb-ease) both; }
    .cb-hello .cb-avatar { width: 76px; height: 76px; margin: 0 auto 14px; background-image: url("${AVATAR_LARGE}"), url("${AVATAR}"); box-shadow: 0 0 0 4px #ffffff, 0 0 0 5.6px var(--cb-ink), 0 10px 24px rgba(20, 32, 46, 0.22); }
    .cb-hello h4 {
      margin: 0 0 8px;
      font-family: var(--cb-display);
      font-weight: 400;
      font-size: calc(26px * var(--cb-scale));
      line-height: 1.08;
      letter-spacing: 0.01em;
      text-transform: uppercase;
      color: var(--cb-ink);
    }
    .cb-hello h4 span { color: var(--cb-indigo); background: linear-gradient(transparent 64%, rgba(255, 198, 41, 0.75) 64%); padding: 0 2px; }
    .cb-hello p { margin: 0 auto; max-width: 330px; font-family: var(--cb-read); font-weight: 300; font-size: calc(13.5px * var(--cb-scale)); color: var(--cb-ink); line-height: 1.65; }
    .cb-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; animation: cbIn 0.4s var(--cb-ease) 0.08s both; }
    .cb-card {
      display: grid;
      gap: 5px;
      align-content: start;
      text-align: left;
      padding: 12px 13px;
      border-radius: 14px;
      border: 1.6px solid var(--cb-line);
      background: var(--cb-surface);
      font: inherit;
      color: var(--cb-ink);
      cursor: pointer;
      transition: transform 0.25s var(--cb-ease), box-shadow 0.25s, border-color 0.25s;
    }
    .cb-card:hover, .cb-card:focus-visible { transform: translateY(-2px); border-color: var(--cb-ink); box-shadow: 0 5px 0 var(--cb-ink); outline: none; }
    .cb-card-top { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: calc(13.5px * var(--cb-scale)); color: var(--cb-ink); }
    .cb-card-top .cb-ico { width: 28px; height: 28px; padding: 5px; border-radius: 999px; background: var(--cb-turmeric); color: var(--cb-ink); }
    .cb-card-q { font-family: var(--cb-read); font-weight: 300; font-size: calc(12.5px * var(--cb-scale)); color: var(--cb-muted); line-height: 1.5; }

    .typing-indicator { display: flex; gap: 4px; padding: 14px 16px; background: var(--cb-surface); border-radius: 16px; border-top-left-radius: 4px; box-shadow: 0 0 0 1px var(--cb-line); }
    .typing-dot { width: 7px; height: 7px; background: var(--cb-indigo); opacity: 0.7; border-radius: 50%; animation: typingBounce 1.4s infinite ease-in-out both; }
    .typing-dot:nth-child(1) { animation-delay: -0.32s; }
    .typing-dot:nth-child(2) { animation-delay: -0.16s; }
    @keyframes typingBounce { 0%, 80%, 100% { transform: scale(0.4); } 40% { transform: scale(1); } }

    /* composer */
    .chatbot-composer { padding: 12px 14px 10px; background: var(--cb-surface); border-top: 1px solid var(--cb-line); }
    .chatbot-input-bar {
      display: flex;
      gap: 8px;
      align-items: center;
      padding: 5px 5px 5px 18px;
      border-radius: 999px;
      background: var(--cb-paper);
      box-shadow: inset 0 0 0 1.6px var(--cb-line);
      transition: box-shadow 0.2s, background 0.2s;
    }
    .chatbot-input-bar:focus-within { background: #ffffff; box-shadow: inset 0 0 0 1.6px var(--cb-ink), 0 0 0 4px rgba(255, 198, 41, 0.45); }
    .chatbot-input { flex: 1; min-width: 0; border: none; background: transparent; padding: 8px 0; font-family: var(--cb-ui); font-size: calc(14.5px * var(--cb-scale)); color: var(--cb-ink); outline: none; }
    .chatbot-input::placeholder { color: #767c86; }
    .chatbot-send-btn {
      background: var(--cb-ink);
      color: #ffffff;
      border: none;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: background 0.2s, color 0.2s, transform 0.2s var(--cb-ease), opacity 0.2s;
    }
    .chatbot-send-btn:hover:not(:disabled), .chatbot-send-btn:focus-visible { background: var(--cb-turmeric); color: var(--cb-ink); transform: scale(1.05); outline: none; }
    .chatbot-send-btn:disabled { opacity: 0.3; cursor: default; }
    .cb-foot { margin-top: 7px; text-align: center; font-family: var(--cb-ui); font-size: calc(11.5px * var(--cb-scale)); color: var(--cb-muted); }

    @media (prefers-reduced-motion: reduce) {
      #chatbot-trigger::after { animation: none; }
      #soochana-chatbot *, #chatbot-drawer { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
    }

    @media (max-width: 520px) {
      #chatbot-drawer, #chatbot-drawer.wide { inset: 0; width: 100%; height: 100%; max-height: none; border-radius: 0; box-shadow: none; }
      #chatbot-trigger { bottom: 16px; right: 16px; width: 58px; height: 58px; }
      #chatbot-trigger[aria-expanded="true"] { opacity: 0; pointer-events: none; }
      .cb-peek { right: 84px; bottom: 28px; }
      .cb-expand { display: none !important; }
      .cb-follow { padding-left: 0; }
      .cb-cards { grid-template-columns: 1fr; }
      .chatbot-header-sub { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; }
      .chatbot-header-sub::before { display: inline-block; margin-right: 6px; vertical-align: 1px; }
      .chatbot-messages { padding: 14px 10px 8px; }
      .cb-row { gap: 8px; }
      .cb-row .cb-avatar { width: 26px; height: 26px; }
      .chat-bubble { padding: 12px 12px; }
      .cb-table th, .cb-table td { padding: 7px 5px; }
      .cb-table td:first-child { min-width: 0; }
    }
  `;
  document.head.appendChild(style);

  /* ── structure ────────────────────────────────────────── */

  const wrapper = document.createElement("div");
  wrapper.id = "soochana-chatbot";
  wrapper.innerHTML = `
    <button id="chatbot-trigger" type="button" aria-label="Open the Soochana Assistant" aria-controls="chatbot-drawer" aria-expanded="false"><span class="cb-badge" aria-hidden="true">1</span></button>
    <div class="cb-peek" aria-hidden="true"><span class="cb-peek-dots"><i></i><i></i><i></i></span><span class="cb-peek-text">Ask me about any district</span></div>
    <div id="chatbot-drawer" role="dialog" aria-label="Soochana Assistant">
      <div class="chatbot-header">
        <div class="cb-avatar" aria-hidden="true"></div>
        <div class="cb-head-text">
          <h3 class="chatbot-header-title">Soochana Assistant</h3>
          <div class="chatbot-header-sub">Answers from Odisha's district data</div>
        </div>
        <div class="cb-head-btns">
          <button class="cb-icon-btn" id="chatbot-reset" type="button" aria-label="New conversation" title="New conversation">${svg("reset")}</button>
          <button class="cb-icon-btn cb-expand" id="chatbot-expand" type="button" aria-label="Expand window" title="Expand">${svg("expand")}</button>
          <button class="chatbot-close-btn" id="chatbot-close" type="button" aria-label="Close assistant" title="Close">${svg("close")}</button>
        </div>
      </div>
      <div class="chatbot-messages" id="chatbot-msg-container" role="log" aria-live="polite"></div>
      <div class="chatbot-composer">
        <form class="chatbot-input-bar" id="chatbot-form">
          <input type="text" class="chatbot-input" id="chatbot-text-input" placeholder="Ask about a district, indicator or trend…" aria-label="Your question" autocomplete="off" maxlength="300">
          <button class="chatbot-send-btn" id="chatbot-send-btn" type="submit" aria-label="Send" disabled>${svg("send")}</button>
        </form>
        <div class="cb-foot">Figures from Census, NFHS, UDISE+ and projections on this portal</div>
      </div>
    </div>
  `;
  document.body.appendChild(wrapper);

  const triggerBtn = document.getElementById("chatbot-trigger");
  const peek = wrapper.querySelector(".cb-peek");
  const drawer = document.getElementById("chatbot-drawer");
  const closeBtn = document.getElementById("chatbot-close");
  const resetBtn = document.getElementById("chatbot-reset");
  const expandBtn = document.getElementById("chatbot-expand");
  const form = document.getElementById("chatbot-form");
  const input = document.getElementById("chatbot-text-input");
  const sendBtn = document.getElementById("chatbot-send-btn");
  const log = document.getElementById("chatbot-msg-container");

  let ctx = { last: null, pageDistrict };
  let welcomed = false;
  let busy = false;

  function openDrawer() {
    hidePeek();
    markOpened();
    drawer.classList.add("open");
    triggerBtn.setAttribute("aria-expanded", "true");
    triggerBtn.setAttribute("aria-label", "Close the Soochana Assistant");
    if (!welcomed) welcome();
    setTimeout(() => input.focus(), 50);
  }
  function closeDrawer() {
    drawer.classList.remove("open");
    triggerBtn.setAttribute("aria-expanded", "false");
    triggerBtn.setAttribute("aria-label", "Open the Soochana Assistant");
    triggerBtn.focus();
  }
  function hidePeek() { peek.classList.remove("show"); }

  triggerBtn.addEventListener("click", () => (drawer.classList.contains("open") ? closeDrawer() : openDrawer()));
  // Start fetching as soon as someone shows intent, so the first answer is quick.
  triggerBtn.addEventListener("pointerenter", () => {
    loadEngine().catch(() => {});
    if (!drawer.classList.contains("open")) peek.classList.add("show");
  });
  triggerBtn.addEventListener("pointerleave", hidePeek);
  triggerBtn.addEventListener("focus", () => loadEngine().catch(() => {}), { once: true });
  closeBtn.addEventListener("click", closeDrawer);
  resetBtn.addEventListener("click", () => {
    log.textContent = "";
    ctx = { last: null, pageDistrict };
    welcome();
    input.focus();
  });
  expandBtn.addEventListener("click", () => {
    const wide = drawer.classList.toggle("wide");
    expandBtn.innerHTML = svg(wide ? "shrink" : "expand");
    expandBtn.setAttribute("aria-label", wide ? "Shrink window" : "Expand window");
    expandBtn.title = wide ? "Shrink" : "Expand";
  });
  drawer.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDrawer(); });
  input.addEventListener("input", () => { sendBtn.disabled = !input.value.trim(); });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    ask(input.value);
  });

  // Until a visitor has opened the assistant once, it asks to be noticed:
  // an unread badge on the button, and every so often a wiggle, an orange
  // flicker and a "typing…" bubble that settles into a suggested question.
  // A few nudges per page at most; none once the chat has been opened.
  const OPENED_KEY = "soochana-assistant-opened";
  const PROMPTS = [
    "Hi! Ask me about any district",
    "Try: which district is ageing fastest?",
    "I can compare two districts for you",
    "Ask about health, schools or jobs",
  ];
  let opened = false;
  try { opened = localStorage.getItem(OPENED_KEY) === "1"; } catch (e) { opened = true; }
  let nudges = 0;
  let nudgeTimer = null;

  function markOpened() {
    if (opened) return;
    opened = true;
    clearTimeout(nudgeTimer);
    triggerBtn.classList.remove("cb-unread");
    peek.classList.remove("cb-live");
    try { localStorage.setItem(OPENED_KEY, "1"); } catch (e) {}
  }

  // Nothing competes with the home page's welcome screen.
  function screenClear() {
    const intro = document.querySelector(".intro");
    return !intro || intro.classList.contains("done") || getComputedStyle(intro).display === "none";
  }

  function nudge() {
    if (opened || nudges >= 4) return;
    if (document.hidden || drawer.classList.contains("open") || !screenClear()) {
      nudgeTimer = setTimeout(nudge, 3000);
      return;
    }
    const text = PROMPTS[nudges % PROMPTS.length];
    nudges += 1;
    triggerBtn.classList.remove("cb-nudge");
    void triggerBtn.offsetWidth;
    triggerBtn.classList.add("cb-nudge");
    peek.querySelector(".cb-peek-text").textContent = text;
    peek.classList.add("show", "typing", "cb-live");
    setTimeout(() => peek.classList.remove("typing"), 1100);
    setTimeout(() => { if (!peek.matches(":hover")) hidePeek(); peek.classList.remove("cb-live"); }, 6500);
    nudgeTimer = setTimeout(nudge, 28000);
  }

  if (!opened) {
    triggerBtn.classList.add("cb-unread");
    triggerBtn.setAttribute("aria-label", "Open the Soochana Assistant (1 new message)");
    nudgeTimer = setTimeout(nudge, 3500);
  }
  triggerBtn.addEventListener("animationend", (e) => {
    if (e.animationName === "cbWiggle") triggerBtn.classList.remove("cb-nudge");
  });
  peek.addEventListener("click", () => { if (peek.classList.contains("cb-live")) openDrawer(); });

  // Other parts of the portal (the "What's new" feed) can open the chat.
  window.SoochanaAssistant = { open: openDrawer };

  /* ── conversation ─────────────────────────────────────── */

  const DEFAULT_CARDS = [
    { icon: "compare", title: "Compare", q: "Compare Koraput and Ganjam" },
    { icon: "rank", title: "Rank", q: "Which district has the highest infant mortality?" },
    { icon: "trend", title: "Trends", q: "How has Cuttack’s population changed?" },
    { icon: "insight", title: "Insight", q: "What should Nabarangpur focus on?" }
  ];

  function welcome() {
    welcomed = true;
    const hello = el("div", "cb-hello");
    hello.appendChild(el("div", "cb-avatar"));
    const h = el("h4");
    h.appendChild(document.createTextNode("Namaskar! "));
    h.appendChild(el("span")).textContent = "How can I help?";
    hello.appendChild(h);
    hello.appendChild(para(pageDistrict
      ? "Ask about **" + pageDistrict + "** or any of Odisha’s 30 districts: figures, rankings, comparisons, trends and what the data suggests."
      : "Ask about any of Odisha’s 30 districts: figures, rankings, comparisons, trends and what the data suggests. Every answer shows its source."));
    log.appendChild(hello);

    const cards = el("div", "cb-cards");
    log.appendChild(cards);
    const fill = (list) => {
      cards.textContent = "";
      list.forEach(c => {
        const b = el("button", "cb-card");
        b.type = "button";
        b.innerHTML = '<span class="cb-card-top">' + svg(c.icon) + '<span></span></span><span class="cb-card-q"></span>';
        b.querySelector(".cb-card-top span").textContent = c.title;
        b.querySelector(".cb-card-q").textContent = c.q;
        b.addEventListener("click", () => ask(c.q));
        cards.appendChild(b);
      });
    };
    fill(DEFAULT_CARDS);
    if (pageDistrict) {
      // On a district page the cards are about that district.
      loadEngine().then(engine => {
        const s = engine.starters(ctx);
        if (!engine.pageDistrict(ctx)) return;
        fill([
          { icon: "insight", title: "Insight", q: s[0] },
          { icon: "compare", title: "Compare", q: s[1] },
          { icon: "trend", title: "Trends", q: s[2] },
          DEFAULT_CARDS[1]
        ]);
      }).catch(() => {});
    }
  }

  function ask(raw) {
    const text = String(raw || "").trim();
    if (!text || busy) return;
    busy = true;
    input.value = "";
    sendBtn.disabled = true;
    log.querySelectorAll(".cb-follow, .cb-cards").forEach(c => c.remove());
    const mineRow = el("div", "cb-row user");
    const mine = el("div", "chat-bubble user");
    mine.textContent = text;
    mineRow.appendChild(mine);
    log.appendChild(mineRow);
    const typing = showTyping();
    scrollDown();

    const started = Date.now();
    loadEngine()
      .then(engine => {
        const a = engine.answer(text, ctx);
        ctx = { last: a.memory, pageDistrict };
        // Step 3 plugs in here: when a.needsLLM is set and a language-model
        // endpoint is configured, the open-ended part goes to the server.
        return a;
      })
      .then(a => wait(Math.max(0, 450 - (Date.now() - started))).then(() => a))
      .then(a => {
        typing.remove();
        const row = render(a);
        // A long answer is read from its first line, not its last.
        if (row.offsetHeight > log.clientHeight * 0.7) {
          log.scrollTop = row.offsetTop - log.offsetTop - 12;
          return false;
        }
        return true;
      })
      .catch(err => {
        console.warn("Soochana Assistant could not answer", err);
        typing.remove();
        botRow().bubble.appendChild(para("Sorry, I couldn’t load the portal’s data just now. Please check your connection and try again."));
        return true;
      })
      .then(toBottom => {
        busy = false;
        if (toBottom) scrollDown();
      });
  }

  function botRow() {
    const row = el("div", "cb-row bot");
    row.appendChild(el("div", "cb-avatar"));
    const bubble = el("div", "chat-bubble bot");
    row.appendChild(bubble);
    log.appendChild(row);
    return { row, bubble };
  }

  function render(a) {
    const { row, bubble } = botRow();
    a.blocks.forEach(b => {
      if (b.type === "p") bubble.appendChild(para(b.text));
      else if (b.type === "note") bubble.appendChild(note(b.text));
      else if (b.type === "list") bubble.appendChild(list(b.items));
      else if (b.type === "table") bubble.appendChild(table(b));
      else if (b.type === "bars") bubble.appendChild(bars(b));
    });
    if (a.links && a.links.length) {
      const wrap = el("div", "chatbot-link-section");
      const title = el("div", "chatbot-rec-title");
      title.textContent = "Explore on the portal";
      wrap.appendChild(title);
      a.links.forEach(l => {
        const link = el("a", "chatbot-item-link");
        // The engine prefixes each title with an emoji; show it as the icon.
        const m = String(l.title).match(/^(\S+)\s+(.+)$/);
        const hasIcon = m && !/[A-Za-z0-9]/.test(m[1]);
        const ico = el("span", "cb-link-ico");
        ico.setAttribute("aria-hidden", "true");
        ico.textContent = hasIcon ? m[1] : "•";
        const label = el("span", "cb-link-text");
        label.textContent = hasIcon ? m[2] : l.title;
        link.append(ico, label);
        link.insertAdjacentHTML("beforeend", svg("arrow"));
        if (l.external) {
          link.href = l.url;
          link.target = "_blank";
          link.rel = "noopener";
        } else {
          link.href = at(l.url);
        }
        wrap.appendChild(link);
      });
      bubble.appendChild(wrap);
    }
    if (a.suggestions && a.suggestions.length) followUps(a.suggestions);
    return row;
  }

  function followUps(items) {
    const box = el("div", "cb-follow");
    const label = el("div", "cb-follow-label");
    label.textContent = "Follow up";
    box.appendChild(label);
    const chips = el("div", "cb-chips");
    items.forEach(s => {
      const b = el("button", "cb-chip");
      b.type = "button";
      b.textContent = s;
      b.addEventListener("click", () => ask(s));
      chips.appendChild(b);
    });
    box.appendChild(chips);
    log.appendChild(box);
  }

  /* ── building blocks (textContent only) ───────────────── */

  function el(tag, cls) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    return n;
  }
  // "**bold**" is the only markup the engine uses.
  function inline(node, text) {
    String(text).split(/\*\*(.+?)\*\*/).forEach((part, i) => {
      if (!part) return;
      if (i % 2) {
        const s = document.createElement("strong");
        s.textContent = part;
        node.appendChild(s);
      } else {
        node.appendChild(document.createTextNode(part));
      }
    });
    return node;
  }
  function para(text, cls) { return inline(el("p", cls), text); }
  function note(text) {
    // Source lines read as quiet captions, like the home page's; other notes
    // (how the question was read, caveats) keep the turmeric marker.
    const p = el("p", /^Sources? —/.test(text) ? "cb-note cb-src" : "cb-note");
    p.innerHTML = svg("info");
    p.appendChild(inline(el("span"), text));
    return p;
  }
  function list(items) {
    const ul = el("ul");
    items.forEach(t => ul.appendChild(inline(el("li"), t)));
    return ul;
  }
  function table(b) {
    const wrap = el("div", "cb-table-wrap");
    const t = el("table", "cb-table");
    const head = el("thead"), hr = el("tr");
    b.head.forEach(h => { const th = el("th"); th.scope = "col"; th.textContent = h; hr.appendChild(th); });
    head.appendChild(hr);
    t.appendChild(head);
    const body = el("tbody");
    b.rows.forEach(r => {
      const tr = el("tr");
      r.forEach(c => { const td = el("td"); td.textContent = c; tr.appendChild(td); });
      body.appendChild(tr);
    });
    t.appendChild(body);
    wrap.appendChild(t);
    return wrap;
  }
  function bars(b) {
    const box = el("div", "cb-bars" + (b.compact ? " compact" : ""));
    const items = b.items.filter(x => x.value != null && isFinite(x.value));
    const max = Math.max.apply(null, items.map(x => Math.abs(x.value)).concat([1e-9]));
    items.forEach((x, i) => {
      const lab = el("span", "cb-lab" + (x.hl ? " hl" : ""));
      lab.textContent = x.label;
      lab.title = x.label;
      const track = el("span", "cb-track");
      const fill = el("span", "cb-fill" + (x.muted ? " muted" : "") + (x.hl ? " hl" : "") + (b.signed && x.value < 0 ? " neg" : ""));
      fill.style.width = Math.max(2, (Math.abs(x.value) / max) * 100) + "%";
      fill.style.animationDelay = Math.min(i, 12) * 30 + "ms";
      track.appendChild(fill);
      const v = el("span", "cb-val");
      v.textContent = x.text;
      box.append(lab, track, v);
    });
    return box;
  }
  function showTyping() {
    const row = el("div", "cb-row bot");
    row.appendChild(el("div", "cb-avatar"));
    const ind = el("div", "typing-indicator");
    ind.setAttribute("aria-label", "Assistant is typing");
    for (let i = 0; i < 3; i++) ind.appendChild(el("div", "typing-dot"));
    row.appendChild(ind);
    log.appendChild(row);
    return row;
  }
  function scrollDown() { log.scrollTop = log.scrollHeight; }
  function wait(ms) { return new Promise(r => setTimeout(r, ms)); }
})();
