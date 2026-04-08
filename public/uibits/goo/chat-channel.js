/* ═══════════════════════════════════════════════════════════════════════════
   Chat Channel Widget — chat-channel.js
   Multiplayer-style team chat with channel tabs.
   Same widget pattern as quest-log.js: draggable hub + slide-out panel,
   registered with the goo/WebGPU effect layer via addGooWidget().
   Reads globals from index.html: makeDraggable, positionContextMenu
═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ─── Seed data ────────────────────────────────────────────────────────── */
  const CHANNELS = [
    { id: 'general',  label: '#general' },
    { id: 'design',   label: '#design' },
    { id: 'eng',      label: '#eng' },
    { id: 'random',   label: '#random' },
  ];

  const USERS = [
    { id: 'u1', name: 'Alex',   img: 1  },
    { id: 'u2', name: 'Jordan', img: 2  },
    { id: 'u3', name: 'Sam',    img: 3  },
    { id: 'u4', name: 'Kim',    img: 4  },
    { id: 'u5', name: 'Riley',  img: 5  },
    { id: 'self', name: 'You',  img: 12 },
  ];

  const SEED_MESSAGES = {
    general: [
      { user: 'u1', text: 'Standup in 5 — anyone have blockers?', ts: '9:55 AM' },
      { user: 'u3', text: 'All clear here.', ts: '9:56 AM' },
      { user: 'u2', text: 'Good to go 👍', ts: '9:56 AM' },
      { user: 'u5', text: 'Yep, shipping the token export today.', ts: '9:57 AM' },
      { user: 'u4', text: 'I might be a few min late, wrapping up a deploy.', ts: '9:58 AM' },
    ],
    design: [
      { user: 'u5', text: 'New nav component variants are up in Figma — feedback welcome.', ts: '10:12 AM' },
      { user: 'u1', text: 'Looking now. The spacing on mobile feels tight.', ts: '10:15 AM' },
      { user: 'u5', text: 'Yeah, I\'ll bump the vertical padding. Good catch.', ts: '10:16 AM' },
    ],
    eng: [
      { user: 'u3', text: 'CI is green after the auth mock fix.', ts: '10:30 AM' },
      { user: 'u2', text: 'Nice. The flaky E2E test was driving me nuts.', ts: '10:31 AM' },
      { user: 'u1', text: 'Can someone review the middleware PR? I rebased it.', ts: '10:33 AM' },
      { user: 'u4', text: 'On it — give me 15.', ts: '10:34 AM' },
    ],
    random: [
      { user: 'u4', text: 'Anyone want coffee? Heading to the kitchen.', ts: '11:00 AM' },
      { user: 'u2', text: 'Large oat flat white please 🙏', ts: '11:01 AM' },
      { user: 'u3', text: 'Espresso. Double.', ts: '11:01 AM' },
    ],
  };

  const messages = {};
  CHANNELS.forEach(ch => { messages[ch.id] = [...(SEED_MESSAGES[ch.id] || [])]; });

  /* ─── State ────────────────────────────────────────────────────────────── */
  let panelOpen     = false;
  let activeChannel = 'general';

  /* ─── DOM refs ─────────────────────────────────────────────────────────── */
  let rootWidget, hubBtn, panel, tabBar, chatBody, chatInput;

  /* ─── Helpers ──────────────────────────────────────────────────────────── */
  function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function userById(id) { return USERS.find(u => u.id === id) || USERS[0]; }
  function nowStamp() {
    const d = new Date();
    let h = d.getHours(), m = d.getMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${String(m).padStart(2,'0')} ${ampm}`;
  }

  /* ─── Build DOM ────────────────────────────────────────────────────────── */
  function buildDOM() {
    rootWidget = document.createElement('div');
    rootWidget.className = 'widget chat-root';
    rootWidget.id = 'chat-root';

    const tabsHtml = CHANNELS.map(ch =>
      `<button class="chat-tab" data-channel="${ch.id}" aria-pressed="${ch.id === activeChannel}">${escHtml(ch.label)}</button>`
    ).join('');

    rootWidget.innerHTML = `
      <div class="chat-hub" id="chat-hub" data-goo
           role="button" tabindex="0"
           aria-label="Team Chat" aria-pressed="false">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="icon" aria-hidden="true">
          <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
          <path d="M3 20l1.3 -3.9c-2.324 -3.437 -1.426 -7.872 2.1 -10.374c3.526 -2.501 8.59 -2.296 11.845 .48c3.255 2.777 3.695 7.266 1.029 10.501c-2.666 3.235 -7.615 4.215 -11.574 2.293l-4.7 1" />
        </svg>
      </div>

      <div class="chat-panel" id="chat-panel" aria-hidden="true">
        <div class="chat-panel-header" id="chat-panel-header">
          <div class="chat-panel-header__left">
            <span class="chat-panel-title">Team Chat</span>
          </div>
          <div class="chat-panel-header__right">
            <button class="chat-icon-btn" id="chat-close-btn" title="Close" aria-label="Close">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
                <line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        <div class="chat-tabs" id="chat-tabs">${tabsHtml}</div>

        <div class="chat-body" id="chat-body"></div>

        <div class="chat-compose">
          <input class="chat-input" id="chat-input" type="text"
                 placeholder="Message #general…" maxlength="280" autocomplete="off">
          <button class="chat-send-btn" id="chat-send-btn" aria-label="Send">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M10 14l11 -11" /><path d="M21 3l-6.5 18a.55 .55 0 0 1 -1 0l-3.5 -7l-7 -3.5a.55 .55 0 0 1 0 -1l18 -6.5" /></svg>
          </button>
        </div>
      </div>
    `;
    document.getElementById('widget-layer').appendChild(rootWidget);

    hubBtn    = document.getElementById('chat-hub');
    panel     = document.getElementById('chat-panel');
    tabBar    = document.getElementById('chat-tabs');
    chatBody  = document.getElementById('chat-body');
    chatInput = document.getElementById('chat-input');
  }

  /* ─── Panel open / close ───────────────────────────────────────────────── */
  function openPanel() {
    panelOpen = true;
    hubBtn.setAttribute('aria-pressed', 'true');
    panel.setAttribute('aria-hidden', 'false');
    positionPanel();
    panel.classList.add('chat-panel--open');
    renderMessages();
  }

  function closePanel() {
    panelOpen = false;
    hubBtn.setAttribute('aria-pressed', 'false');
    panel.setAttribute('aria-hidden', 'true');
    panel.classList.remove('chat-panel--open');
  }

  function togglePanel() {
    if (panelOpen) closePanel(); else openPanel();
  }

  /* ─── Panel position ───────────────────────────────────────────────────── */
  function positionPanel() {
    const hubRect = hubBtn.getBoundingClientRect();
    const PANEL_W = 340;
    const GAP = 10;
    const rightSpace = window.innerWidth - hubRect.right;
    if (rightSpace >= PANEL_W + GAP) {
      panel.style.left = (hubBtn.offsetWidth + GAP) + 'px';
    } else {
      panel.style.left = -(PANEL_W + GAP) + 'px';
    }
    panel.style.right = '';

    const PANEL_H = 420;
    const bottomSpace = window.innerHeight - hubRect.top;
    if (bottomSpace < PANEL_H + 20) {
      panel.style.top  = '';
      panel.style.bottom = '0';
    } else {
      panel.style.top  = '0';
      panel.style.bottom = '';
    }
  }

  /* ─── Render messages ──────────────────────────────────────────────────── */
  function renderMessages() {
    const msgs = messages[activeChannel] || [];
    chatBody.innerHTML = '';

    if (msgs.length === 0) {
      chatBody.innerHTML = '<div class="chat-empty">No messages yet</div>';
      scrollToBottom();
      return;
    }

    msgs.forEach(msg => {
      const user = userById(msg.user);
      const isSelf = msg.user === 'self';
      const el = document.createElement('div');
      el.className = 'chat-msg' + (isSelf ? ' chat-msg--self' : '');
      el.innerHTML = `
        <div class="chat-msg__avatar">
          <img src="https://i.pravatar.cc/60?img=${user.img}" alt="${escHtml(user.name)}" loading="lazy">
        </div>
        <div class="chat-msg__body">
          <div class="chat-msg__meta">
            <span class="chat-msg__name">${escHtml(user.name)}</span>
            <span class="chat-msg__time">${escHtml(msg.ts)}</span>
          </div>
          <div class="chat-msg__text">${escHtml(msg.text)}</div>
        </div>
      `;
      chatBody.appendChild(el);
    });

    scrollToBottom();
  }

  function scrollToBottom() {
    requestAnimationFrame(() => { chatBody.scrollTop = chatBody.scrollHeight; });
  }

  /* ─── Send message ─────────────────────────────────────────────────────── */
  function sendMessage() {
    const text = chatInput.value.trim();
    if (!text) return;
    messages[activeChannel].push({ user: 'self', text, ts: nowStamp() });
    chatInput.value = '';
    renderMessages();
  }

  /* ─── Switch channel ───────────────────────────────────────────────────── */
  function switchChannel(channelId) {
    activeChannel = channelId;
    tabBar.querySelectorAll('.chat-tab').forEach(t =>
      t.setAttribute('aria-pressed', t.dataset.channel === channelId ? 'true' : 'false')
    );
    chatInput.placeholder = `Message #${channelId}…`;
    renderMessages();
  }

  /* ─── Wire events ──────────────────────────────────────────────────────── */
  function wireEvents() {
    hubBtn.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePanel(); }
    });
    makeDraggable(rootWidget, hubBtn, {
      onClick: togglePanel,
      afterDrag() { if (panelOpen) positionPanel(); },
    });

    document.getElementById('chat-close-btn').addEventListener('click', closePanel);

    tabBar.addEventListener('click', e => {
      const tab = e.target.closest('.chat-tab');
      if (tab) switchChannel(tab.dataset.channel);
    });

    document.getElementById('chat-send-btn').addEventListener('click', sendMessage);

    chatInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') sendMessage();
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && panelOpen) closePanel();
    });
  }

  /* ─── Boot ─────────────────────────────────────────────────────────────── */
  function init() {
    buildDOM();

    rootWidget.style.right = '0';
    rootWidget.style.left  = '';
    rootWidget.style.bottom = '20px';
    rootWidget.style.top = '';

    if (typeof window.addGooWidget === 'function') {
      window.addGooWidget(document.getElementById('chat-hub'));
    }

    wireEvents();
    openPanel();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
