/* ═══════════════════════════════════════════════════════════════════════════
   Quest Log / Todo Panel — quest-log.js
   Self-contained floating widget with its own draggable hub.
   Reads globals from index.html: makeDraggable, positionContextMenu
═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ─── Data ──────────────────────────────────────────────────────────────── */
  const TEAM_MEMBERS = [
    { id: 'm1', name: 'Alex L.',   img: 1,  presence: 'available' },
    { id: 'm2', name: 'Jordan O.', img: 2,  presence: 'available' },
    { id: 'm3', name: 'Sam M.',    img: 3,  presence: 'busy'      },
    { id: 'm4', name: 'Kim P.',    img: 4,  presence: 'offline'   },
    { id: 'm5', name: 'Riley V.',  img: 5,  presence: 'available' },
  ];

  const questItems = [
    {
      id: 'q1',
      title: 'Review PR: auth middleware refactor',
      description: 'Needs sign-off before merging to main. Blocks the v2 deploy scheduled for Friday.',
      priority: 'high',
      source: 'github',
      dueLabel: 'Due tomorrow',
      team: 'Platform Engineering',
      status: 'active',
      assignee: null,
    },
    {
      id: 'q2',
      title: 'Fix flaky E2E test in CI pipeline',
      description: 'Tests fail intermittently on parallel runners. Likely a race condition in the auth mock.',
      priority: 'epic',
      source: 'jira',
      dueLabel: 'Overdue · P1',
      team: 'Platform Engineering',
      status: 'active',
      assignee: 'm3',
    },
    {
      id: 'q3',
      title: 'Reply: design review feedback thread',
      description: 'Sara sent detailed notes on the onboarding flow redesign. Needs a response before stand-up.',
      priority: 'medium',
      source: 'email',
      dueLabel: '2h ago · unread',
      team: 'Platform Engineering',
      status: 'active',
      assignee: null,
    },
    {
      id: 'q4',
      title: 'Unblock: schema migration discussion',
      description: 'Data team is waiting on a decision about the users table foreign key strategy.',
      priority: 'high',
      source: 'slack',
      dueLabel: 'Blocking team',
      team: 'Platform Engineering',
      status: 'active',
      assignee: 'm2',
    },
    {
      id: 'q5',
      title: 'Design System 3.0 — token export',
      description: 'Export updated color and spacing tokens from Figma into the shared token JSON file.',
      priority: 'medium',
      source: 'linear',
      dueLabel: 'Sprint 12',
      team: 'Design Systems',
      status: 'active',
      assignee: null,
    },
    {
      id: 'q6',
      title: 'Update color palette documentation',
      description: 'Add the new semantic token names and usage guidelines to the Notion design wiki.',
      priority: 'low',
      source: 'notion',
      dueLabel: 'No due date',
      team: 'Design Systems',
      status: 'active',
      assignee: null,
    },
    {
      id: 'q7',
      title: 'Figma component audit — navigation',
      description: 'Identify inconsistent nav components across the library and consolidate into one master variant.',
      priority: 'medium',
      source: 'figma',
      dueLabel: 'This week',
      team: 'Design Systems',
      status: 'active',
      assignee: 'm5',
    },
  ];

  /* ─── State ─────────────────────────────────────────────────────────────── */
  let panelOpen      = false;
  let displayMode    = 'full'; // full | minimal | frameless
  let currentFilter  = 'active';
  let currentCtxId   = null;
  let addRowVisible  = false;
  let uidCounter     = 100;

  /* ─── DOM refs (set in buildDOM) ────────────────────────────────────────── */
  let rootWidget, hubBtn, panelHeader, panel, questBody, ctxMenu, assignPanel, addRow, addInput, hubCtxMenu;
  let transparent = true; // transparent by default

  /* ─── DOM injection ─────────────────────────────────────────────────────── */
  function buildDOM() {
    // ── Root draggable widget: hub + panel ────────────────────────────────
    rootWidget = document.createElement('div');
    rootWidget.className = 'widget quest-root';
    rootWidget.id = 'quest-root';
    rootWidget.innerHTML = `
      <!-- Hub button — this is the drag handle and [data-goo] target -->
      <div class="quest-hub" id="quest-hub" data-goo
           role="button" tabindex="0"
           aria-label="Quest Log" aria-pressed="false">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-list-check" aria-hidden="true">
          <path stroke="none" d="M0 0h24v24H0z" fill="none" />
          <path d="M3.5 5.5l1.5 1.5l2.5 -2.5" />
          <path d="M3.5 11.5l1.5 1.5l2.5 -2.5" />
          <path d="M3.5 17.5l1.5 1.5l2.5 -2.5" />
          <path d="M11 6l9 0" />
          <path d="M11 12l9 0" />
          <path d="M11 18l9 0" />
        </svg>
      </div>

      <!-- Panel — slides out from hub -->
      <div class="quest-panel" id="quest-panel" aria-hidden="true">
        <!-- Header is the drag handle -->
        <div class="quest-panel-header" id="quest-panel-header">
          <div class="quest-panel-header__left">
            <span class="quest-panel-title">Quest Log</span>
            <span class="quest-panel-count" id="quest-panel-count"></span>
          </div>
          <div class="quest-panel-header__right">
            <button class="quest-icon-btn" id="quest-transparent-btn" title="Toggle transparent" aria-label="Toggle transparent background" aria-pressed="true">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.3"/>
                <path d="M6 1.5v9M1.5 6h9" stroke="currentColor" stroke-width="1" stroke-opacity="0.5" stroke-linecap="round"/>
              </svg>
            </button>
            <button class="quest-icon-btn" id="quest-minimize-btn" title="Minimize" aria-label="Minimize to compact view" aria-pressed="false">
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <line x1="2" y1="5.5" x2="9" y2="5.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                <polyline points="6,3 8.5,5.5 6,8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" fill="none" class="quest-minimize-chevron"/>
              </svg>
            </button>
            <button class="quest-icon-btn" id="quest-add-btn" title="Add task" aria-label="Add task">
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <line x1="5.5" y1="1" x2="5.5" y2="10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                <line x1="1" y1="5.5" x2="10" y2="5.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </button>
            <button class="quest-icon-btn" id="quest-close-btn" title="Close" aria-label="Close">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
                <line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        <div class="quest-filters" id="quest-filters">
          <button class="quest-filter" aria-pressed="true"  data-filter="active">Active</button>
          <button class="quest-filter" aria-pressed="false" data-filter="all">All</button>
          <button class="quest-filter" aria-pressed="false" data-filter="done">Done</button>
        </div>

        <div class="quest-body" id="quest-body"></div>

        <div class="quest-add-row" id="quest-add-row" style="display:none">
          <input class="quest-add-input" id="quest-add-input" type="text"
                 placeholder="New task…" maxlength="120" autocomplete="off">
          <button class="quest-add-confirm" id="quest-add-confirm">Add</button>
        </div>
      </div>
    `;
    document.getElementById('widget-layer').appendChild(rootWidget);

    // Cache refs
    hubBtn     = document.getElementById('quest-hub');
    panel      = document.getElementById('quest-panel');
    questBody  = document.getElementById('quest-body');
    addRow     = document.getElementById('quest-add-row');
    addInput   = document.getElementById('quest-add-input');

    // ── Quest item context menu ────────────────────────────────────────────
    ctxMenu = document.createElement('div');
    ctxMenu.id = 'quest-ctx-menu';
    ctxMenu.className = 'context-menu';
    ctxMenu.hidden = true;
    ctxMenu.setAttribute('role', 'menu');
    ctxMenu.setAttribute('aria-hidden', 'true');
    ctxMenu.innerHTML = `
      <div class="ctx-heading">Actions</div>
      <button class="ctx-item" data-quest-action="complete">✓&nbsp; Mark complete</button>
      <button class="ctx-item" data-quest-action="assign">↗&nbsp; Assign to…</button>
      <button class="ctx-item" data-quest-action="share">⇥&nbsp; Share with team</button>
      <div class="ctx-sep" role="separator"></div>
      <div class="ctx-heading">Priority</div>
      <button class="ctx-item" data-quest-action="priority" data-priority="epic"  ><span class="ctx-priority-dot">◆</span>&nbsp; Epic</button>
      <button class="ctx-item" data-quest-action="priority" data-priority="high"  ><span class="ctx-priority-dot">◆</span>&nbsp; High</button>
      <button class="ctx-item" data-quest-action="priority" data-priority="medium"><span class="ctx-priority-dot">◆</span>&nbsp; Medium</button>
      <button class="ctx-item" data-quest-action="priority" data-priority="low"   ><span class="ctx-priority-dot">◆</span>&nbsp; Low</button>
      <div class="ctx-sep" role="separator"></div>
      <button class="ctx-item ctx-item--danger" data-quest-action="delete">✕&nbsp; Delete</button>
    `;
    document.body.appendChild(ctxMenu);

    // ── Assign sub-panel ───────────────────────────────────────────────────
    assignPanel = document.createElement('div');
    assignPanel.id = 'quest-assign-panel';
    assignPanel.className = 'context-menu';
    assignPanel.hidden = true;
    assignPanel.setAttribute('role', 'menu');
    assignPanel.setAttribute('aria-hidden', 'true');
    assignPanel.innerHTML = '<div class="ctx-heading">Assign to</div>';
    TEAM_MEMBERS.forEach(m => {
      const btn = document.createElement('button');
      btn.className = 'quest-assign-member';
      btn.dataset.memberId = m.id;
      btn.innerHTML = `
        <div class="quest-assign-avatar" data-presence="${m.presence}">
          <img src="https://i.pravatar.cc/60?img=${m.img}" alt="" loading="lazy">
        </div>
        <span class="quest-assign-name">${m.name}</span>
        <span class="quest-assign-check">✓</span>
      `;
      assignPanel.appendChild(btn);
    });
    document.body.appendChild(assignPanel);

    // ── Hub context menu (display mode) ────────────────────────────────────
    hubCtxMenu = document.createElement('div');
    hubCtxMenu.id = 'quest-hub-context-menu';
    hubCtxMenu.className = 'context-menu';
    hubCtxMenu.hidden = true;
    hubCtxMenu.setAttribute('role', 'menu');
    hubCtxMenu.setAttribute('aria-hidden', 'true');
    hubCtxMenu.innerHTML = `
      <div class="ctx-heading">Mode</div>
      <button type="button" class="ctx-item ctx-item--quest-mode" role="menuitemradio" data-quest-mode="full" aria-checked="false">Full</button>
      <button type="button" class="ctx-item ctx-item--quest-mode" role="menuitemradio" data-quest-mode="minimal" aria-checked="false">Minimal</button>
      <button type="button" class="ctx-item ctx-item--quest-mode" role="menuitemradio" data-quest-mode="frameless" aria-checked="false">Frameless</button>
    `;
    document.body.appendChild(hubCtxMenu);
  }

  /* ─── Panel open / close ────────────────────────────────────────────────── */
  function openPanel() {
    panelOpen = true;
    hubBtn.setAttribute('aria-pressed', 'true');
    panel.setAttribute('aria-hidden', 'false');
    panel.classList.toggle('quest-panel--transparent', transparent);
    positionPanel();
    panel.classList.add('quest-panel--open');
    renderQuestPanel();
  }

  function closePanel() {
    panelOpen = false;
    hubBtn.setAttribute('aria-pressed', 'false');
    panel.setAttribute('aria-hidden', 'true');
    panel.classList.remove('quest-panel--open');
    closeCtxMenus();
  }

  function togglePanel() {
    if (panelOpen) closePanel(); else openPanel();
  }

  function syncHubContextMenuChecks() {
    if (!hubCtxMenu) return;
    hubCtxMenu.querySelectorAll('.ctx-item--quest-mode').forEach((btn) => {
      btn.setAttribute('aria-checked', btn.dataset.questMode === displayMode ? 'true' : 'false');
    });
  }

  function setDisplayMode(nextMode) {
    if (nextMode !== 'full' && nextMode !== 'minimal' && nextMode !== 'frameless') return;
    displayMode = nextMode;
    const isCompact = displayMode !== 'full';
    panel.classList.toggle('quest-panel--minimized', isCompact);
    panel.classList.toggle('quest-panel--frameless', displayMode === 'frameless');
    const minimizeBtn = document.getElementById('quest-minimize-btn');
    if (minimizeBtn) minimizeBtn.setAttribute('aria-pressed', String(displayMode === 'minimal'));
    if (isCompact) {
      addRowVisible = false;
      addRow.style.display = 'none';
    }
    syncHubContextMenuChecks();
    renderQuestPanel();
  }

  /* ─── Panel position relative to hub ────────────────────────────────────── */
  function positionPanel() {
    // Panel appears to the right of the hub by default;
    // flips left if there isn't enough room.
    // Always use `left` (positive = right side, negative = left side)
    // because `right` on an absolutely-positioned child inside a flex
    // container with no fixed width gives unpredictable results.
    const hubRect = hubBtn.getBoundingClientRect();
    const PANEL_W = 320;
    const GAP     = 10;
    const rightSpace = window.innerWidth - hubRect.right;
    if (rightSpace >= PANEL_W + GAP) {
      panel.style.left = (hubBtn.offsetWidth + GAP) + 'px';
    } else {
      panel.style.left = -(PANEL_W + GAP) + 'px';
    }
    panel.style.right = '';
    panel.style.top = '0';
  }

  /* ─── Badge count update ────────────────────────────────────────────────── */
  function updateBadge() {
    const active = questItems.filter(i => i.status === 'active').length;
    const badge  = document.getElementById('quest-hub-badge');
    if (badge) badge.style.display = active > 0 ? '' : 'none';
    const countEl = document.getElementById('quest-panel-count');
    if (countEl) countEl.textContent = active > 0 ? `(${active})` : '';
  }

  /* ─── Rendering ─────────────────────────────────────────────────────────── */
  function getFilteredItems() {
    if (currentFilter === 'active') return questItems.filter(i => i.status === 'active');
    if (currentFilter === 'done')   return questItems.filter(i => i.status === 'done');
    return questItems;
  }

  const PRIORITY_ORDER = { epic: 0, high: 1, medium: 2, low: 3 };

  function renderQuestPanel() {
    updateBadge();

    if (displayMode === 'minimal' || displayMode === 'frameless') {
      renderMiniPanel(displayMode === 'frameless');
      return;
    }

    const items = getFilteredItems();

    if (items.length === 0) {
      questBody.innerHTML = `<div class="quest-empty">${
        currentFilter === 'done' ? 'No completed tasks yet' : 'All clear — no active tasks'
      }</div>`;
      return;
    }

    // Group by team
    const groups = {};
    items.forEach(item => {
      if (!groups[item.team]) groups[item.team] = [];
      groups[item.team].push(item);
    });

    questBody.innerHTML = '';
    Object.entries(groups).forEach(([teamName, groupItems]) => {
      const group = document.createElement('div');
      group.className = 'quest-group';
      group.innerHTML = `
        <div class="quest-group__header">
          <span class="quest-group__name">${teamName}</span>
          <div class="quest-group__divider"></div>
          <span class="quest-group__tally">${groupItems.length}</span>
        </div>
      `;
      groupItems.forEach(item => group.appendChild(buildItemEl(item)));
      questBody.appendChild(group);
    });
  }

  function renderMiniPanel(isFrameless) {
    // Show top 3 active items sorted by priority — no groups, no expand
    const top = questItems
      .filter(i => i.status === 'active')
      .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9))
      .slice(0, 3);

    questBody.innerHTML = '';

    if (top.length === 0) {
      questBody.innerHTML = '<div class="quest-empty">All clear</div>';
      return;
    }

    const label = document.createElement('div');
    label.className = 'quest-mini-label';
    label.textContent = 'Next Up';
    questBody.appendChild(label);

    top.forEach(item => {
      const row = document.createElement('div');
      row.className = 'quest-mini-item';
      row.dataset.priority = item.priority;
      const assignee = item.assignee ? TEAM_MEMBERS.find(m => m.id === item.assignee) : null;
      row.innerHTML = `
        <span class="quest-gem" aria-hidden="true">◆</span>
        <span class="quest-mini-title">${escHtml(item.title)}</span>
        ${isFrameless ? '' : (assignee ? `<div class="quest-assignee-avatar" title="${assignee.name}"><img src="https://i.pravatar.cc/60?img=${assignee.img}" alt="${assignee.name}" loading="lazy"></div>` : '')}
        ${isFrameless ? '' : `<span class="quest-badge quest-badge--${item.source}">${item.source.toUpperCase()}</span>`}
      `;
      questBody.appendChild(row);
    });
  }

  function buildItemEl(item) {
    const assignee = item.assignee ? TEAM_MEMBERS.find(m => m.id === item.assignee) : null;
    const el = document.createElement('div');
    el.className = 'quest-item' + (item.status === 'done' ? ' quest-item--completing' : '');
    el.dataset.id       = item.id;
    el.dataset.priority = item.priority;
    el.dataset.open     = 'false';

    el.innerHTML = `
      <div class="quest-item__row">
        <span class="quest-gem" aria-hidden="true">◆</span>
        <span class="quest-item__title">${escHtml(item.title)}</span>
        ${assignee ? `
          <div class="quest-assignee-avatar" title="Assigned: ${assignee.name}">
            <img src="https://i.pravatar.cc/60?img=${assignee.img}" alt="${assignee.name}" loading="lazy">
          </div>` : ''}
        <span class="quest-badge quest-badge--${item.source}">${item.source.toUpperCase()}</span>
      </div>
      <div class="quest-item__details">
        <div class="quest-item__details-inner">
          <p class="quest-item__description">${escHtml(item.description)}</p>
          <div class="quest-item__meta-row">
            <span class="quest-badge quest-badge--${item.source}">${item.source.toUpperCase()}</span>
            <span class="quest-item__due">${escHtml(item.dueLabel)}</span>
          </div>
          <div class="quest-item__actions">
            <button class="quest-detail-btn quest-detail-btn--done"   data-action="complete">✓ Done</button>
            <button class="quest-detail-btn"                           data-action="assign">↗ Assign</button>
            <button class="quest-detail-btn quest-detail-btn--delete" data-action="delete">✕ Delete</button>
          </div>
        </div>
      </div>
    `;
    return el;
  }

  /* ─── Confetti ──────────────────────────────────────────────────────────── */
  const CONFETTI_COLORS = ['#58C2FF','#c084fc','#22c55e','#fbbf24','#f87171','#e0e8ff','#a5f3fc'];

  function spawnConfetti(itemEl) {
    const burst = document.createElement('div');
    burst.className = 'confetti-burst';
    itemEl.appendChild(burst);
    const N = 24;
    for (let i = 0; i < N; i++) {
      const p     = document.createElement('div');
      p.className = 'confetti-particle' + (Math.random() > 0.5 ? ' round' : '');
      const angle = (i / N) * 360 + (Math.random() - 0.5) * (360 / N);
      const dist  = 28 + Math.random() * 62;
      const tx    = (Math.cos(angle * Math.PI / 180) * dist).toFixed(1);
      const ty    = (Math.sin(angle * Math.PI / 180) * dist - 10).toFixed(1);
      p.style.cssText =
        `--tx:${tx}px;--ty:${ty}px;` +
        `--rot:${(Math.random()*720-360).toFixed(0)}deg;` +
        `--delay:${(Math.random()*90).toFixed(0)}ms;` +
        `--c:${CONFETTI_COLORS[i % CONFETTI_COLORS.length]};`;
      burst.appendChild(p);
    }
    setTimeout(() => burst.remove(), 1050);
  }

  /* ─── Complete / undo / collapse ────────────────────────────────────────── */
  function completeItem(itemEl) {
    const data = questItems.find(i => i.id === itemEl.dataset.id);
    if (!data || data.status === 'done') return;

    spawnConfetti(itemEl);

    setTimeout(() => {
      itemEl.dataset.open = 'false';
      itemEl.classList.add('quest-item--completing');

      // Build undo/share strip
      const strip = document.createElement('div');
      strip.className = 'quest-item__complete-strip';
      strip.innerHTML = `
        <button class="quest-strip-btn" data-strip-action="undo">↩ Undo</button>
        <button class="quest-strip-btn" data-strip-action="share">⇥ Share</button>
        <div class="quest-strip-countdown"><div class="quest-strip-countdown__bar"></div></div>
      `;
      itemEl.appendChild(strip);

      // Animate strip visible
      requestAnimationFrame(() => requestAnimationFrame(() => strip.classList.add('visible')));

      // Countdown bar
      const bar = strip.querySelector('.quest-strip-countdown__bar');
      bar.style.width = '100%';
      requestAnimationFrame(() => requestAnimationFrame(() => {
        bar.style.transition = 'width 3s linear';
        bar.style.width = '0%';
      }));

      const timer = setTimeout(() => finalizeComplete(itemEl), 3000);
      itemEl._completeTimer = timer;

      strip.addEventListener('click', e => {
        const action = e.target.closest('[data-strip-action]')?.dataset.stripAction;
        if (action === 'undo')  undoComplete(itemEl);
        if (action === 'share') { shareItem(data); }
      });
    }, 80);
  }

  function undoComplete(itemEl) {
    clearTimeout(itemEl._completeTimer);
    itemEl.classList.remove('quest-item--completing');
    itemEl.querySelector('.quest-item__complete-strip')?.remove();
  }

  function finalizeComplete(itemEl) {
    const data = questItems.find(i => i.id === itemEl.dataset.id);
    if (data) data.status = 'done';
    itemEl.classList.add('quest-item--collapsing');
    itemEl.addEventListener('transitionend', () => {
      itemEl.remove();
      renderQuestPanel();
    }, { once: true });
  }

  function shareItem(data) {
    console.log('[QuestLog] Share:', data.title);
  }

  /* ─── Priority / delete / assign ────────────────────────────────────────── */
  function changePriority(id, priority) {
    const data = questItems.find(i => i.id === id);
    if (!data) return;
    data.priority = priority;
    const el = questBody.querySelector(`.quest-item[data-id="${id}"]`);
    if (el) el.dataset.priority = priority;
  }

  function deleteItem(id) {
    const idx = questItems.findIndex(i => i.id === id);
    if (idx > -1) questItems.splice(idx, 1);
    renderQuestPanel();
  }

  function showAssignPanel(itemEl, anchorX, anchorY) {
    const data = questItems.find(i => i.id === itemEl.dataset.id);
    assignPanel.querySelectorAll('.quest-assign-member').forEach(btn => {
      btn.dataset.selected = String(btn.dataset.memberId === (data && data.assignee));
    });
    assignPanel.hidden = false;
    assignPanel.setAttribute('aria-hidden', 'false');
    positionContextMenu(assignPanel, anchorX, anchorY);
    assignPanel.querySelectorAll('.quest-assign-member').forEach(btn => {
      btn.onclick = () => {
        if (data) data.assignee = btn.dataset.memberId;
        assignPanel.hidden = true;
        assignPanel.setAttribute('aria-hidden', 'true');
        renderQuestPanel();
      };
    });
  }

  /* ─── Add task ──────────────────────────────────────────────────────────── */
  function addTask(title) {
    if (!title.trim()) return;
    questItems.unshift({
      id:          'q' + (++uidCounter),
      title:       title.trim(),
      description: '',
      priority:    'medium',
      source:      'manual',
      dueLabel:    'No due date',
      team:        'Platform Engineering',
      status:      'active',
      assignee:    null,
    });
    renderQuestPanel();
  }

  /* ─── Close menus ───────────────────────────────────────────────────────── */
  function closeCtxMenus() {
    ctxMenu.hidden = true;   ctxMenu.setAttribute('aria-hidden', 'true');
    assignPanel.hidden = true; assignPanel.setAttribute('aria-hidden', 'true');
    if (hubCtxMenu) {
      hubCtxMenu.hidden = true;
      hubCtxMenu.setAttribute('aria-hidden', 'true');
    }
    currentCtxId = null;
  }

  /* ─── Escape helper ─────────────────────────────────────────────────────── */
  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ─── Wire events ───────────────────────────────────────────────────────── */
  function wireEvents() {
    // Use the hub as the drag handle — same pattern as the TeamHUD widget.
    // makeDraggable calls e.preventDefault() on pointerdown which kills the
    // native click event, so we use the cbs.onClick callback instead.
    hubBtn.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePanel(); }
    });
    makeDraggable(rootWidget, hubBtn, {
      onClick:   togglePanel,
      afterDrag() { if (panelOpen) positionPanel(); },
    });

    // Panel header buttons — live inside the panel (not the drag handle),
    // so their click events fire normally.
    panelHeader = document.getElementById('quest-panel-header');

    document.getElementById('quest-close-btn').addEventListener('click', closePanel);

    document.getElementById('quest-transparent-btn').addEventListener('click', () => {
      transparent = !transparent;
      panel.classList.toggle('quest-panel--transparent', transparent);
      document.getElementById('quest-transparent-btn').setAttribute('aria-pressed', String(transparent));
    });

    document.getElementById('quest-minimize-btn').addEventListener('click', () => {
      setDisplayMode(displayMode === 'minimal' ? 'full' : 'minimal');
    });

    // Filter buttons
    document.getElementById('quest-filters').addEventListener('click', e => {
      const btn = e.target.closest('.quest-filter');
      if (!btn) return;
      document.querySelectorAll('.quest-filter').forEach(b => b.setAttribute('aria-pressed', 'false'));
      btn.setAttribute('aria-pressed', 'true');
      currentFilter = btn.dataset.filter;
      renderQuestPanel();
    });

    // Add task button (already stopPropagation'd on pointerdown above; click fires normally)
    document.getElementById('quest-add-btn').addEventListener('click', () => {
      addRowVisible = !addRowVisible;
      addRow.style.display = addRowVisible ? '' : 'none';
      if (addRowVisible) addInput.focus();
    });

    document.getElementById('quest-add-confirm').addEventListener('click', () => {
      addTask(addInput.value);
      addInput.value = '';
      addRowVisible = false;
      addRow.style.display = 'none';
    });

    addInput.addEventListener('keydown', e => {
      if (e.key === 'Enter')  { document.getElementById('quest-add-confirm').click(); }
      if (e.key === 'Escape') { addRowVisible = false; addRow.style.display = 'none'; }
    });

    // Item body: click to expand, detail buttons, right-click context menu
    questBody.addEventListener('click', e => {
      // Detail action buttons
      const detailBtn = e.target.closest('.quest-detail-btn');
      if (detailBtn) {
        const itemEl = detailBtn.closest('.quest-item');
        const action = detailBtn.dataset.action;
        if (action === 'complete') { completeItem(itemEl); return; }
        if (action === 'delete')   { deleteItem(itemEl.dataset.id); return; }
        if (action === 'assign')   {
          const r = detailBtn.getBoundingClientRect();
          showAssignPanel(itemEl, r.left, r.bottom + 6);
          return;
        }
      }
      // Row click → toggle expand
      const row = e.target.closest('.quest-item__row');
      if (row) {
        const item = row.closest('.quest-item');
        if (!item) return;
        const isOpen = item.dataset.open === 'true';
        questBody.querySelectorAll('.quest-item[data-open="true"]').forEach(el => {
          if (el !== item) el.dataset.open = 'false';
        });
        item.dataset.open = isOpen ? 'false' : 'true';
      }
    });

    // Right-click context menu
    questBody.addEventListener('contextmenu', e => {
      const itemEl = e.target.closest('.quest-item');
      if (!itemEl) return;
      e.preventDefault();
      currentCtxId = itemEl.dataset.id;
      closeCtxMenus();
      ctxMenu.hidden = false;
      ctxMenu.setAttribute('aria-hidden', 'false');
      positionContextMenu(ctxMenu, e.clientX, e.clientY);
    });

    rootWidget.addEventListener('contextmenu', (e) => {
      if (!hubBtn.contains(e.target)) return;
      e.preventDefault();
      closeCtxMenus();
      syncHubContextMenuChecks();
      hubCtxMenu.hidden = false;
      hubCtxMenu.setAttribute('aria-hidden', 'false');
      positionContextMenu(hubCtxMenu, e.clientX, e.clientY);
    });

    ctxMenu.addEventListener('click', e => {
      const btn = e.target.closest('[data-quest-action]');
      if (!btn || !currentCtxId) return;
      const action   = btn.dataset.questAction;
      const itemEl   = questBody.querySelector(`.quest-item[data-id="${currentCtxId}"]`);
      const mRect    = ctxMenu.getBoundingClientRect();
      ctxMenu.hidden = true;
      ctxMenu.setAttribute('aria-hidden', 'true');
      if (action === 'complete' && itemEl) completeItem(itemEl);
      if (action === 'delete')             deleteItem(currentCtxId);
      if (action === 'assign' && itemEl)   showAssignPanel(itemEl, mRect.right + 4, mRect.top);
      if (action === 'share')              { const d = questItems.find(i => i.id === currentCtxId); if (d) shareItem(d); }
      if (action === 'priority' && itemEl) changePriority(currentCtxId, btn.dataset.priority);
      currentCtxId = null;
    });

    hubCtxMenu.addEventListener('click', (e) => {
      const modeBtn = e.target.closest('.ctx-item--quest-mode');
      if (!modeBtn) return;
      e.preventDefault();
      e.stopPropagation();
      setDisplayMode(modeBtn.dataset.questMode);
      closeCtxMenus();
    });

    // Close menus on outside click
    document.addEventListener('pointerdown', e => {
      if (!ctxMenu.hidden    && !ctxMenu.contains(e.target)    && !panel.contains(e.target)) closeCtxMenus();
      if (hubCtxMenu && !hubCtxMenu.hidden && !hubCtxMenu.contains(e.target)) closeCtxMenus();
      if (!assignPanel.hidden && !assignPanel.contains(e.target)) {
        assignPanel.hidden = true;
        assignPanel.setAttribute('aria-hidden', 'true');
      }
    }, { capture: true });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        if (!ctxMenu.hidden || !assignPanel.hidden || (hubCtxMenu && !hubCtxMenu.hidden)) closeCtxMenus();
        else if (panelOpen) closePanel();
      }
    });
  }

  /* ─── Boot ──────────────────────────────────────────────────────────────── */
  function init() {
    buildDOM();

    // Position BEFORE wireEvents so makeDraggable reads the correct bounding rect.
    // Snap to right edge at the same Y as the team hub (top: 80px).
    rootWidget.style.right  = '0';
    rootWidget.style.left   = '';
    rootWidget.style.top    = '80px';

    // Register quest hub with goo shader (it's added dynamically, after main()'s
    // initial querySelectorAll('[data-goo]') scan).
    if (typeof window.addGooWidget === 'function') {
      window.addGooWidget(document.getElementById('quest-hub'));
    }

    wireEvents();
    updateBadge();
    setDisplayMode('full');
    openPanel(); // default open
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
