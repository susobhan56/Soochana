/**
 * chatbot.js
 * Fully client-side Chatbot Assistant for Soochana.
 * Searches contents.json, datasets.json, and reports.json locally and responds dynamically.
 */

(function () {
  // Check if chatbot container already exists
  if (document.getElementById("soochana-chatbot")) return;

  // Global variables to hold search index data
  let siteContents = [];
  let siteDatasets = [];
  let siteReports = [];

  // Load JSON resources
  fetch("data/contents.json")
    .then(r => r.ok ? r.json() : { recentContent: [] })
    .then(data => siteContents = data.recentContent || [])
    .catch(e => console.warn("Failed to load contents.json for chatbot index", e));

  fetch("data/datasets.json")
    .then(r => r.ok ? r.json() : { datasets: [] })
    .then(data => siteDatasets = data.datasets || [])
    .catch(e => console.warn("Failed to load datasets.json for chatbot index", e));

  fetch("data/reports.json")
    .then(r => r.ok ? r.json() : { reports: [] })
    .then(data => siteReports = data.reports || [])
    .catch(e => console.warn("Failed to load reports.json for chatbot index", e));

  // CSS Injection
  const style = document.createElement("style");
  style.textContent = `
    /* Floating button trigger */
    #chatbot-trigger {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: linear-gradient(135deg, #2a7582 0%, var(--teal, #1a535c) 100%);
      color: #ffffff !important;
      box-shadow: 0 4px 16px rgba(26, 83, 92, 0.3);
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      z-index: 10000;
      animation: chatbotPulse 3s infinite ease-in-out;
    }
    #chatbot-trigger:hover {
      transform: scale(1.1);
      background: linear-gradient(135deg, #358d9c 0%, #1f646f 100%);
      box-shadow: 0 6px 20px rgba(26, 83, 92, 0.5);
    }
    #chatbot-trigger svg {
      width: 28px;
      height: 28px;
      fill: none;
      stroke: #ffffff !important;
      stroke-width: 2.2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    @keyframes chatbotPulse {
      0% { box-shadow: 0 4px 16px rgba(26, 83, 92, 0.3); }
      50% { box-shadow: 0 4px 28px rgba(26, 83, 92, 0.6); }
      100% { box-shadow: 0 4px 16px rgba(26, 83, 92, 0.3); }
    }

    /* Main chat drawer panel */
    #chatbot-drawer {
      position: fixed;
      bottom: 96px;
      right: 24px;
      width: 380px;
      height: 550px;
      max-height: calc(100vh - 120px);
      background: var(--surface, #ffffff);
      border: 1px solid var(--border, rgba(0, 0, 0, 0.08));
      border-radius: 20px;
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.12);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transform: translateY(20px) scale(0.95);
      opacity: 0;
      pointer-events: none;
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      z-index: 10000;
    }
    #chatbot-drawer.open {
      transform: translateY(0) scale(1);
      opacity: 1;
      pointer-events: auto;
    }

    /* Chat header */
    .chatbot-header {
      background: var(--blue, #1f385c);
      color: #ffffff;
      padding: 16px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    .chatbot-header-title {
      font-family: var(--serif, serif);
      font-size: 1.15rem;
      font-weight: 700;
      margin: 0;
    }
    .chatbot-header-sub {
      font-size: var(--fs-micro);
      font-family: var(--mono, monospace);
      text-transform: uppercase;
      opacity: 0.8;
      letter-spacing: 0.1em;
      margin-top: 2px;
    }
    .chatbot-close-btn {
      background: transparent;
      border: none;
      color: #ffffff;
      cursor: pointer;
      opacity: 0.8;
      transition: opacity 0.2s;
      padding: 4px;
      display: flex;
      align-items: center;
    }
    .chatbot-close-btn:hover {
      opacity: 1;
    }
    .chatbot-close-btn svg {
      width: 20px;
      height: 20px;
    }

    /* Messages container */
    .chatbot-messages {
      flex: 1;
      padding: 20px;
      overflow-y: auto;
      background: var(--bg, #f8f9fa);
      display: flex;
      flex-direction: column;
      gap: 16px;
      scroll-behavior: smooth;
    }

    /* Chat bubbles */
    .chat-bubble {
      max-width: 85%;
      padding: 12px 16px;
      border-radius: 16px;
      font-size: var(--fs-small);
      line-height: 1.5;
      font-family: var(--sans, sans-serif);
      word-wrap: break-word;
    }
    .chat-bubble.bot {
      background: var(--surface, #ffffff);
      color: var(--text, #1e2530);
      align-self: flex-start;
      border: 1px solid var(--border, rgba(0, 0, 0, 0.08));
      border-top-left-radius: 4px;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
    }
    .chat-bubble.user {
      background: var(--teal, #1a535c);
      color: #ffffff;
      align-self: flex-end;
      border-top-right-radius: 4px;
      box-shadow: 0 2px 6px rgba(26, 83, 92, 0.15);
    }

    /* Helper styles in responses */
    .chatbot-link-section {
      margin-top: 10px;
      border-top: 1px solid var(--border, rgba(0, 0, 0, 0.08));
      padding-top: 8px;
    }
    .chatbot-rec-title {
      font-size: var(--fs-caption);
      font-family: var(--mono, monospace);
      text-transform: uppercase;
      color: var(--muted, #4f5664);
      margin-bottom: 6px;
      letter-spacing: 0.05em;
    }
    .chatbot-item-link {
      display: flex;
      align-items: center;
      gap: 6px;
      color: var(--orange, #d35400) !important;
      text-decoration: none;
      font-weight: 600;
      font-size: var(--fs-small);
      margin-bottom: 4px;
      transition: color 0.2s;
    }
    .chatbot-item-link:hover {
      color: var(--blue, #1f385c) !important;
    }
    .chatbot-item-link svg {
      width: 12px;
      height: 12px;
    }

    /* Typing indicator */
    .typing-indicator {
      display: flex;
      gap: 4px;
      padding: 12px 16px;
      background: var(--surface, #ffffff);
      border: 1px solid var(--border, rgba(0, 0, 0, 0.08));
      border-radius: 16px;
      border-top-left-radius: 4px;
      align-self: flex-start;
      width: fit-content;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
    }
    .typing-dot {
      width: 6px;
      height: 6px;
      background: var(--muted, #4f5664);
      border-radius: 50%;
      animation: typingBounce 1.4s infinite ease-in-out both;
    }
    .typing-dot:nth-child(1) { animation-delay: -0.32s; }
    .typing-dot:nth-child(2) { animation-delay: -0.16s; }

    @keyframes typingBounce {
      0%, 80%, 100% { transform: scale(0); }
      40% { transform: scale(1); }
    }

    /* Input area */
    .chatbot-input-bar {
      padding: 12px 16px;
      background: var(--surface, #ffffff);
      border-top: 1px solid var(--border, rgba(0, 0, 0, 0.08));
      display: flex;
      gap: 10px;
      align-items: center;
    }
    .chatbot-input {
      flex: 1;
      border: 1px solid var(--border, rgba(0, 0, 0, 0.15));
      border-radius: 24px;
      padding: 10px 16px;
      font-size: var(--fs-small);
      font-family: var(--sans, sans-serif);
      outline: none;
      background: var(--bg, #f8f9fa);
      transition: all 0.2s;
    }
    .chatbot-input:focus {
      border-color: var(--teal, #1a535c);
      background: #ffffff;
      box-shadow: 0 0 0 3px rgba(26, 83, 92, 0.1);
    }
    .chatbot-send-btn {
      background: var(--blue, #1f385c);
      color: #ffffff;
      border: none;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s, transform 0.1s;
      flex-shrink: 0;
    }
    .chatbot-send-btn:hover {
      background: var(--teal, #1a535c);
    }
    .chatbot-send-btn:active {
      transform: scale(0.95);
    }
    .chatbot-send-btn svg {
      width: 16px;
      height: 16px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    /* Responsive adjustments */
    @media (max-width: 480px) {
      #chatbot-drawer {
        width: calc(100vw - 32px);
        right: 16px;
        bottom: 84px;
        height: 480px;
      }
      #chatbot-trigger {
        bottom: 16px;
        right: 16px;
      }
    }
  `;
  document.head.appendChild(style);

  // Injected HTML structure
  const chatbotWrapper = document.createElement("div");
  chatbotWrapper.id = "soochana-chatbot";
  chatbotWrapper.innerHTML = `
    <button id="chatbot-trigger" aria-label="Open demographic assistant">
      <svg viewBox="0 0 24 24"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>
    </button>
    <div id="chatbot-drawer">
      <div class="chatbot-header">
        <div>
          <h3 class="chatbot-header-title">Soochana Assistant</h3>
          <div class="chatbot-header-sub">Odisha Demographic Advisor</div>
        </div>
        <button class="chatbot-close-btn" id="chatbot-close" aria-label="Close assistant">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
      <div class="chatbot-messages" id="chatbot-msg-container">
        <div class="chat-bubble bot">
          Hello! I am your client-side demographic advisor. I can help guide you through Odisha's census figures, analytical report files, and research datasets.<br><br>
          Try asking:
          <ul style="margin: 8px 0 0 0; padding-left: 20px; font-size: var(--fs-small);">
            <li>"Tell me about migration patterns"</li>
            <li>"Where is the fertility data?"</li>
            <li>"Find educational datasets"</li>
          </ul>
        </div>
      </div>
      <div class="chatbot-input-bar">
        <input type="text" class="chatbot-input" id="chatbot-text-input" placeholder="Type a message...">
        <button class="chatbot-send-btn" id="chatbot-send-btn">
          <svg viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(chatbotWrapper);

  // Selector Cache
  const triggerBtn = document.getElementById("chatbot-trigger");
  const drawerPanel = document.getElementById("chatbot-drawer");
  const closeBtn = document.getElementById("chatbot-close");
  const sendBtn = document.getElementById("chatbot-send-btn");
  const textInput = document.getElementById("chatbot-text-input");
  const messagesContainer = document.getElementById("chatbot-msg-container");

  // Toggle Drawer Open/Close
  triggerBtn.addEventListener("click", () => {
    drawerPanel.classList.add("open");
    textInput.focus();
  });

  closeBtn.addEventListener("click", () => {
    drawerPanel.classList.remove("open");
  });

  // Send message on click
  sendBtn.addEventListener("click", handleUserMessage);

  // Send message on Enter keypress
  textInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleUserMessage();
  });

  function handleUserMessage() {
    const text = textInput.value.trim();
    if (!text) return;

    // Add user bubble
    appendMessage(text, "user");
    textInput.value = "";

    // Scroll down
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Add typing indicator
    const indicator = showTypingIndicator();
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Generate response after a short delay (simulating processing)
    setTimeout(() => {
      indicator.remove();
      const responseObj = generateLocalAIResponse(text);
      appendBotResponse(responseObj);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }, 900);
  }

  function appendMessage(text, sender) {
    const bubble = document.createElement("div");
    bubble.className = `chat-bubble ${sender}`;
    bubble.textContent = text;
    messagesContainer.appendChild(bubble);
  }

  function showTypingIndicator() {
    const ind = document.createElement("div");
    ind.className = "typing-indicator";
    ind.innerHTML = `
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    `;
    messagesContainer.appendChild(ind);
    return ind;
  }

  function appendBotResponse(responseObj) {
    const bubble = document.createElement("div");
    bubble.className = "chat-bubble bot";
    bubble.innerHTML = `<div>${responseObj.text}</div>`;

    // Append links if found
    if (responseObj.links && responseObj.links.length > 0) {
      const linkWrap = document.createElement("div");
      linkWrap.className = "chatbot-link-section";
      linkWrap.innerHTML = `<div class="chatbot-rec-title">Recommended Pages:</div>`;
      responseObj.links.forEach(l => {
        linkWrap.innerHTML += `
          <a href="${l.url}" class="chatbot-item-link">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
            ${l.title}
          </a>
        `;
      });
      bubble.appendChild(linkWrap);
    }
    
    messagesContainer.appendChild(bubble);
  }

  /**
   * Search matching local JSON registry data
   */
  function generateLocalAIResponse(query) {
    const q = query.toLowerCase();
    const recommendedLinks = [];

    // 1. Check datasets
    let matchedDatasets = siteDatasets.filter(d => {
      const name = (d.name || "").toLowerCase();
      const desc = (d.description || "").toLowerCase();
      return name.includes(q) || desc.includes(q);
    });

    // 2. Check reports
    let matchedReports = siteReports.filter(r => {
      const name = (r.name || "").toLowerCase();
      const desc = (r.description || "").toLowerCase();
      const theme = (r.theme || "").toLowerCase();
      return name.includes(q) || desc.includes(q) || theme.includes(q);
    });

    // 3. Check articles
    let matchedArticles = siteContents.filter(a => {
      const title = (a.title || "").toLowerCase();
      const abstract = (a.abstract || "").toLowerCase();
      const article = (a.article || "").toLowerCase();
      return title.includes(q) || abstract.includes(q) || article.includes(q);
    });

    // Filter down matching lists for recommendation links
    matchedArticles.slice(0, 3).forEach(a => {
      recommendedLinks.push({
        title: `📖 Article: ${a.title} (${a.abstract})`,
        url: `article.html?id=${a.id}`
      });
    });

    matchedDatasets.slice(0, 2).forEach(d => {
      recommendedLinks.push({
        title: `📊 Dataset: ${d.name}`,
        url: `repository.html`
      });
    });

    matchedReports.slice(0, 2).forEach(r => {
      recommendedLinks.push({
        title: `📄 Report: ${r.name || "Survey Report"}`,
        url: `repository.html`
      });
    });

    // Match static topics for customized greetings
    if (q.includes("hi") || q.includes("hello") || q.includes("hey")) {
      return {
        text: "Hello! How can I assist you with Odisha's demographics today?",
        links: []
      };
    }
    if (q.includes("map") || q.includes("geojson") || q.includes("district")) {
      return {
        text: "You can explore district-level indicators dynamically on the interactive map of Odisha or perform a comparison duel between districts.",
        links: [
          { title: "🗺️ Odisha Regional Explorer Map", url: "index.html" },
          { title: "⚔️ District duel comparison & pyramids", url: "odisha_compare.html" }
        ]
      };
    }
    if (q.includes("compare") || q.includes("duel") || q.includes("versus") || q.includes("vs")) {
      return {
        text: "You can compare demographics using the District Duel for detailed district-wise age cohort pyramids.",
        links: [
          { title: "⚔️ District Duel (Odisha Districts)", url: "odisha_compare.html" }
        ]
      };
    }
    if (q.includes("policy") || q.includes("scheme") || q.includes("welfare") || q.includes("bsky") || q.includes("mamata")) {
      return {
        text: "Odisha has rolled out major welfare milestones like the Mamata Scheme (maternity cash benefits) and Biju Swasthya Kalyan Yojana (BSKY cashless health care). Read more on the timeline.",
        links: [
          { title: "⌛ Policy Milestones Timeline", url: "index.html#policyTimeline" }
        ]
      };
    }

    // Default responses based on search results count
    if (recommendedLinks.length > 0) {
      return {
        text: `I searched the local index for "${query}" and found some relevant publications, datasets, and visualizations:`,
        links: recommendedLinks
      };
    }

    // Generic Fallback
    return {
      text: `I couldn't find any direct matches in our databases for "${query}". Try searching for keywords like "fertility", "migration", "ageing", "malnutrition", "reports", or "datasets".`,
      links: [
        { title: "📊 View All Thematic Sectors", url: "themes.html" },
        { title: "📁 Open Data Repository Hub", url: "repository.html" }
      ]
    };
  }

})();
