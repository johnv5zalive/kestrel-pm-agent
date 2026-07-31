// Coach-mark walkthrough — pure DOM, no framework.
//
// Pattern: bubble + arrow + cutout, positioned next to (and pointing at) the
// highlighted target. Cross-page navigation via ?tour=N URL param. Same-page
// transitions shift the bubble; cross-page transitions navigate.
//
// Required pieces (per demo-template.md §3 "coach-marks, not panels"):
//   - whenStable() RAF-poll waits for layout to settle before placing bubble
//   - Four-way placement (right → bottom → left → top), clamped to viewport
//   - In-bubble Back / Skip / Next controls (not URL nav alone)
//   - body.tour-active disables stagger animations on cards while tour runs
//   - Mobile fallback (≤720px) pins bubble to bottom, hides arrow
//   - Bubble fades in only after rect stabilizes — no flicker into stale position

(function () {
  // Step copy rules: one idea per step, no internal vocabulary, no forward
  // references to things that are not on screen, plain declarative sentences.
  // {{jobCount}} is substituted from the inbox's data-job-count attribute so
  // the tour can never disagree with the data (it used to say "15" against 16).
  const STEPS = [
    {
      n: 1,
      url: '/today',
      anchor: '[data-tour-highlight="lane-today"]',
      side: 'top',
      title: 'Step 1 of 9 · Your morning',
      body: 'Everything the agent is working on, in one list, hardest first. Scheduled visits, owner approvals and vendor insurance all land here together, because that is how the day arrives.',
    },
    {
      n: 2,
      url: '/inbox',
      anchor: '[data-tour-highlight="lane-awaiting"]',
      side: 'top',
      title: 'Step 2 of 9 · The queue',
      body: 'These are the {{jobCount}} maintenance visits coming up. The agent is chasing a date for each one. The ones at the top are waiting on you.',
    },
    {
      n: 3,
      url: '/inbox/SMV-BEACON-2026-05',
      anchor: '[data-tour-highlight="conversation-thread"]',
      side: 'right',
      title: 'Step 3 of 9 · One property, several contacts',
      body: 'Beacon Ridge has three people on file. The agent emailed the facilities director first because he is the best person to ask. He came back with a date, so the other two were never contacted.',
    },
    {
      n: 4,
      url: '/inbox/SMV-BEACON-2026-05',
      anchor: '[data-tour-highlight="reply-extraction"]',
      side: 'left',
      title: 'Step 4 of 9 · Reading the reply',
      body: 'The agent reads the reply and pulls out the date and time window. When it is not confident enough, it does not guess. It puts the job in front of you instead.',
    },
    {
      n: 5,
      url: '/inbox/SMV-BEACON-2026-05',
      anchor: '[data-tour-highlight="cta-book"]',
      side: 'bottom',
      title: 'Step 5 of 9 · You confirm',
      body: 'One click marks it booked. The agent stops short of booking it in AppFolio for you, so a wrong date never reaches a calendar without a person seeing it first.',
    },
    {
      n: 6,
      url: '/inbox',
      anchor: '[data-tour-highlight="time-travel"]',
      side: 'bottom',
      title: 'Step 6 of 9 · Watch it run',
      body: 'Drag this to move the date forward. Reminders go out, replies come back, and jobs move between the groups above. Try it after this step.',
    },
    {
      n: 7,
      url: '/admin',
      anchor: '[data-tour-highlight="adapter-section"]',
      side: 'right',
      title: 'Step 7 of 9 · Getting your schedule in',
      body: 'Four ways in, depending on what your AppFolio plan allows. Only the first needs an API. Whichever you pick, the rest of the agent works the same.',
    },
    {
      n: 8,
      url: '/admin',
      anchor: '[data-tour-highlight="connect-real"]',
      side: 'top',
      title: 'Step 8 of 9 · Going live',
      body: 'This is what setup looks like on your own accounts. The fields are switched off here because this is sample data.',
    },
    {
      n: 9,
      url: '/inbox',
      anchor: null, // no highlight on final step
      side: 'center',
      title: 'Step 9 of 9 · That is the whole thing',
      body: 'Click Finish to go back to the queue and click around. You can replay this walkthrough any time from the link in the header.',
    },
  ]

  // Fill {{jobCount}} from the page rather than hardcoding it.
  function renderBody(text) {
    return text.replace(/\{\{jobCount\}\}/g, function () {
      const host = document.querySelector('[data-job-count]')
      return host ? host.getAttribute('data-job-count') : 'the'
    })
  }

  function getQuery(name) {
    return new URLSearchParams(location.search).get(name)
  }

  function urlMatches(stepUrl, currentPath) {
    // Exact match only. /inbox should NOT match /inbox/SMV-… — those are
    // different pages and step transitions between them must navigate, not
    // shift in place. Cross-page transitions go through location.href.
    return currentPath === stepUrl
  }

  function injectStyles() {
    if (document.getElementById('mi-tour-style')) return
    const s = document.createElement('style')
    s.id = 'mi-tour-style'
    s.textContent = `
      body.mi-tour-active .stagger-in > * { animation: none !important; opacity: 1; transform: none; }
      body.mi-tour-active { overflow-x: hidden; }
      .mi-tour-overlay {
        position: fixed; inset: 0; background: rgba(15,23,42,0.45); z-index: 9000;
        pointer-events: none;
      }
      .mi-tour-cutout {
        position: fixed; border-radius: 12px;
        box-shadow: 0 0 0 9999px rgba(15,23,42,0.45), 0 0 0 3px rgba(123,193,235,0.85);
        pointer-events: none; z-index: 9000; opacity: 0;
        transition: top .25s ease, left .25s ease, width .25s ease, height .25s ease, opacity .15s;
      }
      .mi-tour-card {
        position: fixed; z-index: 9001; max-width: 360px; width: calc(100vw - 24px);
        background: #fff; border-radius: 14px;
        box-shadow: 0 24px 60px rgba(15,23,42,0.32);
        padding: 18px 20px;
        font-family: Lato, system-ui, sans-serif;
        opacity: 0; transition: opacity .15s ease, top .2s ease, left .2s ease;
      }
      .mi-tour-card.shown { opacity: 1; }
      .mi-tour-card h3 {
        font-size: 11px; font-weight: 700; text-transform: uppercase;
        letter-spacing: 0.10em; color: #14584A; margin: 0 0 8px;
      }
      .mi-tour-card p { font-size: 14px; color: #0F172A; margin: 0 0 16px; line-height: 1.55; }
      .mi-tour-card .mi-tour-actions {
        display: flex; align-items: center; justify-content: space-between; gap: 8px;
      }
      .mi-tour-card button {
        font-family: inherit; font-size: 13px; cursor: pointer;
      }
      .mi-tour-card .mi-tour-skip {
        background: none; border: 0; color: #64748B; padding: 6px 8px; font-weight: 500;
      }
      .mi-tour-card .mi-tour-skip:hover { color: #0F172A; }
      .mi-tour-card .mi-tour-back {
        background: transparent; color: #0F172A; border: 1px solid #CBD5E1;
        padding: 7px 14px; border-radius: 8px; font-weight: 600;
      }
      .mi-tour-card .mi-tour-back:hover { background: #F1F5F9; }
      .mi-tour-card .mi-tour-next {
        background: #5FBFA6; color: #14584A; border: 0;
        padding: 9px 16px; border-radius: 8px; font-weight: 700;
        box-shadow: 0 4px 10px -2px rgba(123,193,235,.55);
      }
      .mi-tour-card .mi-tour-next:hover { background: #45AE93; }
      .mi-tour-progress {
        margin-top: 14px; height: 3px; background: #E2E8F0; border-radius: 999px; overflow: hidden;
      }
      .mi-tour-progress div { height: 100%; background: #5FBFA6; transition: width .25s ease; }
      .mi-tour-arrow {
        position: fixed; z-index: 9001; width: 16px; height: 16px;
        background: #fff; transform: rotate(45deg);
        box-shadow: 0 24px 60px rgba(15,23,42,0.16);
        opacity: 0; transition: opacity .15s ease, top .2s ease, left .2s ease;
      }
      .mi-tour-arrow.shown { opacity: 1; }
      @media (max-width: 720px) {
        .mi-tour-card {
          left: 12px !important; right: 12px !important; max-width: none;
          bottom: 16px !important; top: auto !important;
        }
        .mi-tour-arrow { display: none; }
      }
    `
    document.head.appendChild(s)
  }

  function findVisible(selector) {
    const all = document.querySelectorAll(selector)
    for (const el of all) {
      if (el.offsetParent !== null && el.getBoundingClientRect().width > 0) return el
    }
    return all[0] || null
  }

  function whenStable(target, cb) {
    let last = target.getBoundingClientRect()
    let stable = 0
    const start = performance.now()
    function tick() {
      const now = performance.now()
      const r = target.getBoundingClientRect()
      const moved = Math.abs(r.top - last.top) > 0.5 || Math.abs(r.left - last.left) > 0.5
      if (moved) stable = 0
      else stable++
      last = r
      if (stable >= 3 || now - start > 1500) {
        cb(r)
        return
      }
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }

  function ensureNode(cls) {
    let n = document.querySelector('.' + cls)
    if (!n) {
      n = document.createElement('div')
      n.className = cls
      document.body.appendChild(n)
    }
    return n
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v))
  }

  function position(rect, side, card, arrow, cutout) {
    const vw = window.innerWidth
    const vh = window.innerHeight
    const cardW = card.offsetWidth || 360
    const cardH = card.offsetHeight || 200
    const margin = 14

    cutout.style.top = rect.top - 6 + 'px'
    cutout.style.left = rect.left - 6 + 'px'
    cutout.style.width = rect.width + 12 + 'px'
    cutout.style.height = rect.height + 12 + 'px'

    let cardLeft, cardTop, arrowLeft, arrowTop

    // Try sides in user-preferred order, fall through to next that fits.
    function placeRight() {
      cardLeft = rect.right + margin
      cardTop = clamp(rect.top + rect.height / 2 - cardH / 2, 80, vh - cardH - 12)
      arrowLeft = cardLeft - 8
      arrowTop = clamp(rect.top + rect.height / 2 - 8, cardTop + 14, cardTop + cardH - 22)
    }
    function placeLeft() {
      cardLeft = rect.left - margin - cardW
      cardTop = clamp(rect.top + rect.height / 2 - cardH / 2, 80, vh - cardH - 12)
      arrowLeft = cardLeft + cardW - 8
      arrowTop = clamp(rect.top + rect.height / 2 - 8, cardTop + 14, cardTop + cardH - 22)
    }
    function placeTop() {
      cardLeft = clamp(rect.left + rect.width / 2 - cardW / 2, 12, vw - cardW - 12)
      cardTop = clamp(rect.top - margin - cardH, 12, vh - cardH - 12)
      arrowLeft = clamp(rect.left + rect.width / 2 - 8, cardLeft + 14, cardLeft + cardW - 22)
      arrowTop = cardTop + cardH - 8
    }
    function placeBottom() {
      cardLeft = clamp(rect.left + rect.width / 2 - cardW / 2, 12, vw - cardW - 12)
      cardTop = clamp(rect.bottom + margin, 80, vh - cardH - 12)
      arrowLeft = clamp(rect.left + rect.width / 2 - 8, cardLeft + 14, cardLeft + cardW - 22)
      arrowTop = cardTop - 8
    }

    const fits = {
      right: rect.right + margin + cardW + 12 < vw,
      left: rect.left - margin - cardW > 12,
      top: rect.top - margin - cardH > 12,
      bottom: rect.bottom + margin + cardH + 12 < vh,
    }

    // Try preferred side, then a sensible fallback chain.
    const order = preferredOrder(side, fits)
    let chosen = null
    for (const s of order) {
      if (fits[s]) {
        chosen = s
        break
      }
    }
    if (!chosen) chosen = side || 'bottom'

    if (chosen === 'right') placeRight()
    else if (chosen === 'left') placeLeft()
    else if (chosen === 'top') placeTop()
    else placeBottom()

    card.style.left = cardLeft + 'px'
    card.style.top = cardTop + 'px'
    arrow.style.left = arrowLeft + 'px'
    arrow.style.top = arrowTop + 'px'

    requestAnimationFrame(() => {
      card.classList.add('shown')
      arrow.classList.add('shown')
      cutout.style.opacity = '1'
    })
  }

  function preferredOrder(side, _fits) {
    const fallback = ['right', 'bottom', 'left', 'top']
    if (!side) return fallback
    return [side].concat(fallback.filter((s) => s !== side))
  }

  function gotoStep(stepIdx) {
    const step = STEPS[stepIdx]
    if (!step) return finish()
    if (urlMatches(step.url, location.pathname)) {
      // Update URL without reload so ?tour stays in sync.
      const url = new URL(location.href)
      url.searchParams.set('tour', String(step.n))
      history.replaceState({}, '', url.toString())
      show(stepIdx)
    } else {
      const u = new URL(step.url, location.origin)
      u.searchParams.set('tour', String(step.n))
      location.href = u.toString()
    }
  }

  function show(stepIdx) {
    const step = STEPS[stepIdx]
    if (!step) return finish()

    injectStyles()
    document.body.classList.add('mi-tour-active')
    const overlay = ensureNode('mi-tour-overlay')
    const cutout = ensureNode('mi-tour-cutout')
    const card = ensureNode('mi-tour-card')
    const arrow = ensureNode('mi-tour-arrow')

    const pct = Math.round(((stepIdx + 1) / STEPS.length) * 100)
    card.innerHTML =
      '<h3>' + step.title + '</h3>' +
      '<p>' + renderBody(step.body) + '</p>' +
      '<div class="mi-tour-actions">' +
        '<button class="mi-tour-skip">' + (stepIdx === STEPS.length - 1 ? 'Close' : 'Skip tour') + '</button>' +
        '<div style="display:flex; gap:8px;">' +
          (stepIdx > 0 ? '<button class="mi-tour-back">Back</button>' : '') +
          '<button class="mi-tour-next">' + (stepIdx === STEPS.length - 1 ? 'Finish' : 'Next') + '</button>' +
        '</div>' +
      '</div>' +
      '<div class="mi-tour-progress"><div style="width:' + pct + '%"></div></div>'

    card.querySelector('.mi-tour-skip').onclick = function () {
      // Skip = early exit. Drop the user into the live inbox.
      finish({ redirectTo: '/inbox' })
    }
    card.querySelector('.mi-tour-next').onclick = function () {
      // Last step's Next button reads "Finish" — also drop into the inbox.
      if (stepIdx === STEPS.length - 1) {
        finish({ redirectTo: '/inbox' })
        return
      }
      gotoStep(stepIdx + 1)
    }
    const back = card.querySelector('.mi-tour-back')
    if (back) back.onclick = function () { gotoStep(stepIdx - 1) }

    if (!step.anchor) {
      // Final/center step — no target. Center the card.
      cutout.style.display = 'none'
      arrow.classList.remove('shown')
      card.classList.remove('shown')
      const cardW = 360
      const cardH = 200
      card.style.left = Math.max(12, (window.innerWidth - cardW) / 2) + 'px'
      card.style.top = Math.max(80, (window.innerHeight - cardH) / 2) + 'px'
      requestAnimationFrame(function () { card.classList.add('shown') })
      return
    }

    const target = findVisible(step.anchor)
    if (!target) {
      // Anchor missing — degrade gracefully: center, no cutout.
      cutout.style.display = 'none'
      arrow.classList.remove('shown')
      card.classList.remove('shown')
      card.style.left = Math.max(12, (window.innerWidth - 360) / 2) + 'px'
      card.style.top = Math.max(80, (window.innerHeight - 220) / 2) + 'px'
      requestAnimationFrame(function () { card.classList.add('shown') })
      return
    }

    cutout.style.display = 'block'
    cutout.style.opacity = '0'
    card.classList.remove('shown')
    arrow.classList.remove('shown')
    target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
    whenStable(target, function (rect) { position(rect, step.side || 'right', card, arrow, cutout) })
  }

  function finish(opts) {
    opts = opts || {}
    document.body.classList.remove('mi-tour-active')
    const els = document.querySelectorAll('.mi-tour-overlay, .mi-tour-cutout, .mi-tour-card, .mi-tour-arrow')
    els.forEach(function (el) { el.remove() })
    if (opts.redirectTo) {
      location.href = opts.redirectTo
      return
    }
    if (getQuery('tour')) {
      const url = new URL(location.href)
      url.searchParams.delete('tour')
      history.replaceState({}, '', url.toString())
    }
  }

  // Re-position on resize so the bubble stays attached.
  window.addEventListener('resize', function () {
    const card = document.querySelector('.mi-tour-card')
    if (!card) return
    const t = card.querySelector('h3')
    const title = t ? t.textContent : ''
    const idx = STEPS.findIndex(function (s) { return s.title === title })
    if (idx >= 0) show(idx)
  })

  function init() {
    // Tour only activates from explicit ?tour=N — no auto-start, no cookies.
    // Two equal-access CTAs on landing let the user pick guided vs free.
    const tourQ = getQuery('tour')
    if (!tourQ) return
    const n = parseInt(tourQ, 10)
    const idx = STEPS.findIndex(function (s) { return s.n === n })
    if (idx < 0) return
    if (!urlMatches(STEPS[idx].url, location.pathname)) return
    setTimeout(function () { show(idx) }, 200)
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
