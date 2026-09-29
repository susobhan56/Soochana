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
      json("datasets/district_fertility_trends.json"),
      json("datasets/national_comparisons.json"),
      json("data/contents.json", d => d.recentContent),
      json("data/reports.json", d => d.reports),
      json("data/datasets.json", d => d.datasets)
    ]).then(([, districts, population, fertility, national, contents, reports, datasets]) => {
      if (!districts) throw new Error("district table did not load");
      return window.SoochanaChat.createEngine({ districts, population, fertility, national, contents, reports, datasets });
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

  // Colours are the assistant's own, so it reads the same on every page,
  // including pages with a dark theme or their own palette. The navy is the
  // assistant icon's own background.
  const style = document.createElement("style");
  style.textContent = `
    #soochana-chatbot {
      --cb-navy: #07253f;
      --cb-navy-2: #0f3b5f;
      --cb-surface: #ffffff;
      --cb-bg: #f3f5f8;
      --cb-ink: #1b2430;
      --cb-muted: #56606e;
      --cb-border: rgba(7, 37, 63, 0.12);
      --cb-teal: #1a535c;
      --cb-accent: #d9822b;
      --cb-link: #a84300;
      --cb-bar: #2a7582;
      --cb-bar-muted: #b7c2c6;
      --cb-bar-neg: #b5473a;
      --cb-scale: var(--type-scale, 1);
      --cb-ease: cubic-bezier(0.16, 1, 0.3, 1);
      color: var(--cb-ink);
      font-family: var(--sans, system-ui, -apple-system, "Segoe UI", sans-serif);
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
      background: var(--cb-navy) url("${AVATAR_LARGE}") center / cover no-repeat;
      box-shadow: 0 8px 24px rgba(7, 37, 63, 0.35), 0 0 0 1px rgba(7, 37, 63, 0.08);
      cursor: pointer;
      z-index: 10000;
      transition: transform 0.3s var(--cb-ease), box-shadow 0.3s;
    }
    #chatbot-trigger::after {
      content: "";
      position: absolute;
      inset: -7px;
      border-radius: 50%;
      border: 2px solid rgba(15, 59, 95, 0.45);
      animation: cbRing 2.8s var(--cb-ease) infinite;
      pointer-events: none;
    }
    #chatbot-trigger:hover { transform: translateY(-3px) scale(1.04); box-shadow: 0 12px 30px rgba(7, 37, 63, 0.45); }
    #chatbot-trigger:focus-visible { outline: 3px solid var(--cb-accent); outline-offset: 4px; }
    #chatbot-trigger[aria-expanded="true"]::after { animation: none; opacity: 0; }
    @keyframes cbRing {
      0% { transform: scale(0.9); opacity: 0.9; }
      70%, 100% { transform: scale(1.25); opacity: 0; }
    }

    .cb-peek {
      position: fixed;
      right: 100px;
      bottom: 38px;
      background: var(--cb-navy);
      color: #ffffff;
      font-size: calc(13px * var(--cb-scale));
      font-weight: 600;
      padding: 8px 14px;
      border-radius: 999px;
      box-shadow: 0 6px 18px rgba(7, 37, 63, 0.3);
      white-space: nowrap;
      z-index: 10000;
      opacity: 0;
      transform: translateX(8px);
      transition: opacity 0.25s, transform 0.3s var(--cb-ease);
      pointer-events: none;
    }
    .cb-peek.show { opacity: 1; transform: none; }

    /* window */
    #chatbot-drawer {
      position: fixed;
      bottom: 100px;
      right: 24px;
      width: 420px;
      height: 640px;
      max-height: calc(100vh - 124px);
      background: var(--cb-surface);
      border-radius: 22px;
      box-shadow: 0 24px 60px rgba(7, 37, 63, 0.28), 0 0 0 1px rgba(7, 37, 63, 0.08);
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
      background: linear-gradient(135deg, var(--cb-navy) 0%, var(--cb-navy-2) 100%);
      color: #ffffff;
      padding: 14px 12px 14px 16px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .cb-avatar {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      flex-shrink: 0;
      background: var(--cb-navy) url("${AVATAR}") center / cover no-repeat;
      box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.85);
    }
    .cb-head-text { flex: 1; min-width: 0; }
    .chatbot-header-title { font-family: var(--serif, Georgia, serif); font-size: calc(17px * var(--cb-scale)); font-weight: 700; margin: 0; color: #ffffff; line-height: 1.2; }
    .chatbot-header-sub { display: flex; align-items: center; gap: 6px; font-size: calc(12px * var(--cb-scale)); color: rgba(255, 255, 255, 0.82); margin-top: 3px; }
    .chatbot-header-sub::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: #5fd3a5; box-shadow: 0 0 0 3px rgba(95, 211, 165, 0.25); }
    .cb-head-btns { display: flex; gap: 2px; }
    .cb-icon-btn, .chatbot-close-btn {
      background: transparent;
      border: none;
      color: #ffffff;
      cursor: pointer;
      width: 36px;
      height: 36px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0.85;
      transition: background 0.2s, opacity 0.2s;
    }
    .cb-icon-btn:hover, .cb-icon-btn:focus-visible, .chatbot-close-btn:hover, .chatbot-close-btn:focus-visible { opacity: 1; background: rgba(255, 255, 255, 0.14); outline: none; }

    /* conversation */
    .chatbot-messages {
      flex: 1;
      padding: 18px 16px 8px;
      overflow-y: auto;
      background: var(--cb-bg);
      display: flex;
      flex-direction: column;
      gap: 14px;
      scroll-behavior: smooth;
    }
    .chatbot-messages::-webkit-scrollbar { width: 8px; }
    .chatbot-messages::-webkit-scrollbar-thumb { background: rgba(7, 37, 63, 0.18); border-radius: 8px; }

    .cb-row { display: flex; gap: 10px; align-items: flex-start; animation: cbIn 0.35s var(--cb-ease) both; }
    .cb-row.user { justify-content: flex-end; }
    .cb-row .cb-avatar { width: 30px; height: 30px; box-shadow: 0 0 0 2px #ffffff, 0 2px 6px rgba(7, 37, 63, 0.2); margin-top: 2px; }
    @keyframes cbIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

    .chat-bubble {
      padding: 12px 14px;
      border-radius: 16px;
      font-size: calc(14px * var(--cb-scale));
      line-height: 1.55;
      overflow-wrap: anywhere;
      min-width: 0;
    }
    .chat-bubble.bot {
      flex: 1;
      background: var(--cb-surface);
      color: var(--cb-ink);
      border-top-left-radius: 6px;
      box-shadow: 0 1px 2px rgba(7, 37, 63, 0.06), 0 0 0 1px rgba(7, 37, 63, 0.06);
    }
    .chat-bubble.user {
      max-width: 82%;
      background: linear-gradient(135deg, var(--cb-navy-2), var(--cb-navy));
      color: #ffffff;
      border-top-right-radius: 6px;
      box-shadow: 0 2px 8px rgba(7, 37, 63, 0.2);
    }
    .chat-bubble p { margin: 0 0 8px; }
    .chat-bubble p:last-child { margin-bottom: 0; }
    .chat-bubble strong { font-weight: 700; color: var(--cb-navy); }
    .chat-bubble ul { margin: 4px 0 10px; padding-left: 18px; }
    .chat-bubble li { margin-bottom: 5px; }
    .chat-bubble li::marker { color: var(--cb-accent); }
    .chat-bubble .cb-note {
      display: flex;
      gap: 6px;
      font-size: calc(12px * var(--cb-scale));
      color: var(--cb-muted);
      background: var(--cb-bg);
      border-radius: 8px;
      padding: 7px 9px;
      margin-top: 4px;
      line-height: 1.45;
    }
    .chat-bubble .cb-note .cb-ico { width: 14px; height: 14px; margin-top: 1px; color: var(--cb-navy-2); }

    .cb-table-wrap { overflow-x: auto; margin: 6px 0 10px; border-radius: 10px; box-shadow: 0 0 0 1px var(--cb-border); }
    .cb-table { border-collapse: collapse; width: 100%; font-size: calc(12.5px * var(--cb-scale)); }
    .cb-table th, .cb-table td { padding: 7px 9px; text-align: left; border-bottom: 1px solid var(--cb-border); vertical-align: top; }
    .cb-table th { background: var(--cb-navy); color: #ffffff; font-weight: 600; white-space: nowrap; }
    .cb-table tbody tr:nth-child(even) td { background: #f8f9fb; }
    .cb-table td:first-child { min-width: 150px; }
    .cb-table td:not(:first-child) { white-space: nowrap; font-variant-numeric: tabular-nums; }
    .cb-table tr:last-child td { border-bottom: none; }

    .cb-bars { margin: 6px 0 10px; display: grid; grid-template-columns: minmax(80px, max-content) 1fr max-content; gap: 6px 10px; align-items: center; font-size: calc(12.5px * var(--cb-scale)); }
    .cb-bars.compact { max-height: 240px; overflow-y: auto; padding-right: 4px; gap: 4px 10px; }
    .cb-bars .cb-lab { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .cb-bars .cb-track { height: 10px; background: rgba(7, 37, 63, 0.07); border-radius: 5px; overflow: hidden; }
    .cb-bars .cb-fill { display: block; height: 100%; background: linear-gradient(90deg, var(--cb-bar), #3c93a1); border-radius: 5px; transform-origin: left; animation: cbGrow 0.6s var(--cb-ease) both; }
    .cb-bars .cb-fill.muted { background: var(--cb-bar-muted); }
    .cb-bars .cb-fill.neg { background: var(--cb-bar-neg); }
    .cb-bars .cb-lab.hl { font-weight: 700; }
    .cb-bars .cb-fill.hl { background: var(--cb-accent); }
    .cb-bars .cb-val { font-variant-numeric: tabular-nums; color: var(--cb-muted); white-space: nowrap; }
    @keyframes cbGrow { from { transform: scaleX(0); } to { transform: scaleX(1); } }

    .chatbot-link-section { margin-top: 12px; padding-top: 10px; border-top: 1px dashed var(--cb-border); display: grid; gap: 6px; }
    .chatbot-rec-title { font-size: calc(11.5px * var(--cb-scale)); font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--cb-muted); }
    .chatbot-item-link {
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 8px 10px;
      border-radius: 10px;
      background: var(--cb-bg);
      color: var(--cb-ink) !important;
      text-decoration: none;
      font-weight: 600;
      font-size: calc(12.5px * var(--cb-scale));
      line-height: 1.35;
      transition: background 0.2s, transform 0.2s var(--cb-ease);
    }
    .chatbot-item-link .cb-link-ico { font-size: 15px; line-height: 1; }
    .chatbot-item-link .cb-link-text { flex: 1; min-width: 0; }
    .chatbot-item-link .cb-ico { width: 14px; height: 14px; color: var(--cb-link); }
    .chatbot-item-link:hover, .chatbot-item-link:focus-visible { background: #e6ebf1; transform: translateX(2px); outline: none; }

    .cb-follow { padding-left: 40px; display: grid; gap: 6px; animation: cbIn 0.35s var(--cb-ease) 0.1s both; }
    .cb-follow-label { font-size: calc(11.5px * var(--cb-scale)); font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--cb-muted); }
    .cb-chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .cb-chip {
      border: 1px solid rgba(15, 59, 95, 0.28);
      background: var(--cb-surface);
      color: var(--cb-navy-2);
      border-radius: 999px;
      padding: 7px 13px;
      font: inherit;
      font-size: calc(12.5px * var(--cb-scale));
      font-weight: 500;
      cursor: pointer;
      text-align: left;
      transition: background 0.2s, color 0.2s, border-color 0.2s;
    }
    .cb-chip:hover, .cb-chip:focus-visible { background: var(--cb-navy); border-color: var(--cb-navy); color: #ffffff; outline: none; }

    /* welcome */
    .cb-hello { text-align: center; padding: 8px 8px 2px; animation: cbIn 0.4s var(--cb-ease) both; }
    .cb-hello .cb-avatar { width: 72px; height: 72px; margin: 0 auto 12px; background-image: url("${AVATAR_LARGE}"); box-shadow: 0 0 0 4px #ffffff, 0 8px 22px rgba(7, 37, 63, 0.25); }
    .cb-hello h4 { margin: 0 0 6px; font-family: var(--serif, Georgia, serif); font-size: calc(19px * var(--cb-scale)); color: var(--cb-navy); }
    .cb-hello p { margin: 0 auto; max-width: 320px; font-size: calc(13.5px * var(--cb-scale)); color: var(--cb-muted); line-height: 1.5; }
    .cb-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; animation: cbIn 0.4s var(--cb-ease) 0.08s both; }
    .cb-card {
      display: grid;
      gap: 4px;
      align-content: start;
      text-align: left;
      padding: 12px;
      border-radius: 14px;
      border: 1px solid var(--cb-border);
      background: var(--cb-surface);
      font: inherit;
      color: var(--cb-ink);
      cursor: pointer;
      transition: transform 0.25s var(--cb-ease), box-shadow 0.25s, border-color 0.25s;
    }
    .cb-card:hover, .cb-card:focus-visible { transform: translateY(-2px); border-color: rgba(15, 59, 95, 0.35); box-shadow: 0 8px 18px rgba(7, 37, 63, 0.12); outline: none; }
    .cb-card-top { display: flex; align-items: center; gap: 7px; font-weight: 700; font-size: calc(13px * var(--cb-scale)); color: var(--cb-navy); }
    .cb-card-top .cb-ico { width: 26px; height: 26px; padding: 5px; border-radius: 8px; background: rgba(217, 130, 43, 0.14); color: #b3651b; }
    .cb-card-q { font-size: calc(12.5px * var(--cb-scale)); color: var(--cb-muted); line-height: 1.4; }

    .typing-indicator { display: flex; gap: 4px; padding: 14px 16px; background: var(--cb-surface); border-radius: 16px; border-top-left-radius: 6px; box-shadow: 0 0 0 1px rgba(7, 37, 63, 0.06); }
    .typing-dot { width: 7px; height: 7px; background: var(--cb-navy-2); opacity: 0.6; border-radius: 50%; animation: typingBounce 1.4s infinite ease-in-out both; }
    .typing-dot:nth-child(1) { animation-delay: -0.32s; }
    .typing-dot:nth-child(2) { animation-delay: -0.16s; }
    @keyframes typingBounce { 0%, 80%, 100% { transform: scale(0.4); } 40% { transform: scale(1); } }

    /* composer */
    .chatbot-composer { padding: 10px 14px 10px; background: var(--cb-surface); border-top: 1px solid var(--cb-border); }
    .chatbot-input-bar {
      display: flex;
      gap: 8px;
      align-items: center;
      padding: 5px 5px 5px 16px;
      border-radius: 999px;
      background: var(--cb-bg);
      box-shadow: inset 0 0 0 1px rgba(7, 37, 63, 0.14);
      transition: box-shadow 0.2s, background 0.2s;
    }
    .chatbot-input-bar:focus-within { background: #ffffff; box-shadow: inset 0 0 0 1.5px var(--cb-navy-2), 0 0 0 4px rgba(15, 59, 95, 0.1); }
    .chatbot-input { flex: 1; min-width: 0; border: none; background: transparent; padding: 8px 0; font: inherit; font-size: calc(14px * var(--cb-scale)); color: var(--cb-ink); outline: none; }
    .chatbot-input::placeholder { color: #7a8391; }
    .chatbot-send-btn {
      background: var(--cb-navy);
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
      transition: background 0.2s, transform 0.2s var(--cb-ease), opacity 0.2s;
    }
    .chatbot-send-btn:hover:not(:disabled), .chatbot-send-btn:focus-visible { background: var(--cb-accent); transform: scale(1.05); outline: none; }
    .chatbot-send-btn:disabled { opacity: 0.35; cursor: default; }
    .cb-foot { margin-top: 7px; text-align: center; font-size: calc(11px * var(--cb-scale)); color: #6b7482; }

    @media (prefers-reduced-motion: reduce) {
      #chatbot-trigger::after { animation: none; }
      #soochana-chatbot *, #chatbot-drawer { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
    }

    @media (max-width: 520px) {
      #chatbot-drawer, #chatbot-drawer.wide { inset: 0; width: 100%; height: 100%; max-height: none; border-radius: 0; }
      #chatbot-trigger { bottom: 16px; right: 16px; width: 58px; height: 58px; }
      #chatbot-trigger[aria-expanded="true"] { opacity: 0; pointer-events: none; }
      .cb-peek { right: 84px; bottom: 28px; }
      .cb-expand { display: none !important; }
      .cb-follow { padding-left: 0; }
    }
  `;
  document.head.appendChild(style);

  /* ── structure ────────────────────────────────────────── */

  const wrapper = document.createElement("div");
  wrapper.id = "soochana-chatbot";
  wrapper.innerHTML = `
    <button id="chatbot-trigger" type="button" aria-label="Open the Soochana Assistant" aria-controls="chatbot-drawer" aria-expanded="false"></button>
    <div class="cb-peek" aria-hidden="true">Ask me about any district</div>
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

  // A one-time hint beside the button on a visitor's first page.
  try {
    if (!localStorage.getItem("soochana-assistant-seen")) {
      setTimeout(() => {
        if (drawer.classList.contains("open")) return;
        peek.classList.add("show");
        setTimeout(hidePeek, 4500);
      }, 2500);
      localStorage.setItem("soochana-assistant-seen", "1");
    }
  } catch (e) { /* storage blocked: skip the hint */ }

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
    h.textContent = "Namaskar! How can I help?";
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
    const p = el("p", "cb-note");
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
