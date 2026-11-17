/**
 * Task complete notice: a top-right notice plus a chime in the Web GUI whenever
 * a top-level Session's agent stops running, or starts waiting for the user to
 * answer a question, review a plan, or approve an action.
 *
 * The browser half owns everything: the Session UI status snapshot already
 * carries the live Host running state and the pending interaction of every
 * listed Session, so no Host round trip, polling, or session-log scan is
 * involved. Notices live in the `shell.overlay` seat (the frame-wide floating
 * layer) and portal to the body so a narrow-window drawer mask cannot cover
 * them; the chime is synthesised with Web Audio, so the bundle ships no audio
 * asset.
 *
 * A stop is reported as the run having finished, not as success: the status
 * snapshot records a stop, and a stop covers a completed run, a failure, and the
 * user pressing Stop alike.
 *
 * Cards never close themselves. The user dismisses one with its cross, or by
 * opening the Session it names; a waiting card also clears itself once that
 * interaction is answered, because the thing it waits for is gone.
 */

window.__ModuleLoader__.load({
  id: '@local/task-complete-toast',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    // A body portal is the documented escape from the in-frame overlay layer,
    // which a narrow-window drawer mask covers; without react-dom the notice
    // still renders in its slot.
    let createPortal = null
    try {
      const reactDom = require('react-dom')
      if (reactDom !== null && typeof reactDom.createPortal === 'function') createPortal = reactDom.createPortal
    } catch {
      createPortal = null
    }

    /** Locale namespace of this plugin's copy. */
    const NS = 'task-complete-toast'
    /** Newest notices kept on screen; the oldest completion card drops off. */
    const MAX_NOTICES = 3
    /** Exit animation length; the notice leaves the stack after it. */
    const EXIT_MS = 200
    /** Peak gain of the chime: loud enough to carry across a room. */
    const CHIME_GAIN = 0.32

    const DICT_EN = {
      title: 'Run finished',
      pendingQuestion: 'Waiting for your answer',
      pendingPlan: 'Waiting for your review',
      pendingApproval: 'Waiting for approval',
      pendingOther: 'Waiting for you',
      open: 'Open session',
      dismiss: 'Dismiss notification',
    }
    const DICT_ZH = {
      title: '运行已结束',
      pendingQuestion: '等你回答',
      pendingPlan: '等你确认方案',
      pendingApproval: '等你授权',
      pendingOther: '等你处理',
      open: '打开会话',
      dismiss: '关闭提醒',
    }
    /** Headline key of each notice kind; unknown interaction kinds share one. */
    const TITLE_KEY = {
      finished: 'title',
      question: 'pendingQuestion',
      'plan-review': 'pendingPlan',
      approval: 'pendingApproval',
    }
    const titleKeyOf = (kind) => TITLE_KEY[kind] ?? 'pendingOther'

    const CSS = `
.tct-layer{position:fixed;top:var(--dsh-frame-overlay-top,16px);right:16px;z-index:90;display:flex;flex-direction:column;align-items:flex-end;gap:8px;max-width:calc(100vw - 32px);pointer-events:none}
.tct-card{position:relative;overflow:hidden;box-sizing:border-box;pointer-events:auto;display:flex;align-items:flex-start;gap:8px;width:320px;max-width:100%;padding:11px 10px 12px 12px;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-lg,12px);background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);box-shadow:var(--dsw-shadow-lv3,0 8px 24px rgba(0,0,0,.18));animation:tct-in 180ms cubic-bezier(.2,.8,.3,1) both}
.tct-card[data-leaving]{animation:tct-out 160ms ease-in both}
.tct-card:hover{border-color:var(--dsw-alias-border-l2)}
.tct-main{flex:1;min-width:0;display:flex;align-items:flex-start;gap:10px;margin:0;padding:0;border:0;border-radius:8px;background:none;color:inherit;font:inherit;text-align:start;cursor:pointer;outline:none}
.tct-main:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.tct-icon{flex:none;display:grid;place-items:center;width:20px;height:20px;margin-top:1px;color:var(--dsw-alias-brand-primary)}
.tct-icon[data-pending]{color:var(--dsw-alias-state-warn-primary)}
.tct-body{flex:1;min-width:0}
.tct-title{display:block;font-size:13px;font-weight:600;line-height:1.35;color:var(--dsw-alias-label-primary)}
.tct-session{display:block;margin-top:2px;overflow:hidden;font-size:12px;line-height:1.35;color:var(--dsw-alias-label-secondary);text-overflow:ellipsis;white-space:nowrap}
.tct-main:hover .tct-session{color:var(--dsw-alias-label-primary)}
.tct-close{flex:none;display:grid;place-items:center;width:20px;height:20px;margin:-1px -1px 0 0;padding:0;border:0;border-radius:6px;background:none;color:var(--dsw-alias-label-secondary);cursor:pointer}
.tct-close:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.tct-close:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.tct-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;border:0;clip-path:inset(50%);white-space:nowrap}
@keyframes tct-in{from{opacity:0;transform:translateX(18px) scale(.98)}to{opacity:1;transform:none}}
@keyframes tct-out{from{opacity:1;transform:none}to{opacity:0;transform:translateX(14px) scale(.98)}}
@media (prefers-reduced-motion: reduce){.tct-card,.tct-card[data-leaving]{animation-duration:1ms}}
`

    /** Check mark inside a translucent brand disc. */
    function CheckIcon() {
      return h('svg', { viewBox: '0 0 20 20', width: 18, height: 18, 'aria-hidden': 'true' },
        h('circle', { cx: 10, cy: 10, r: 9, fill: 'currentColor', opacity: 0.16 }),
        h('path', {
          d: 'M6.2 10.4 8.6 12.8 13.9 7.4',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.8,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }))
    }

    /** Question mark inside a translucent attention disc. */
    function QuestionIcon() {
      return h('svg', { viewBox: '0 0 20 20', width: 18, height: 18, 'aria-hidden': 'true' },
        h('circle', { cx: 10, cy: 10, r: 9, fill: 'currentColor', opacity: 0.16 }),
        h('path', {
          d: 'M7.1 7.6c0-2 1.4-3.3 3-3.3s2.9 1.2 2.9 2.8c0 1.6-1.1 2.1-2 2.8-.8.6-1 1.1-1 1.9v.5',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.7,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }),
        h('circle', { cx: 10.2, cy: 15.4, r: 1.1, fill: 'currentColor' }))
    }

    /** Small cross of the dismiss control. */
    function CloseIcon() {
      return h('svg', { viewBox: '0 0 16 16', width: 12, height: 12, 'aria-hidden': 'true' },
        h('path', {
          d: 'M4 4 12 12M12 4 4 12',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinecap: 'round',
        }))
    }

    /**
     * Lazily built Web Audio chime. Construction and playback stay optional: a
     * browser without Web Audio, or one that keeps the context suspended, gives
     * no sound instead of an error.
     * @returns unlock, play, and dispose handles.
     */
    function createChime() {
      let context = null
      let unavailable = false

      const ensure = () => {
        if (context !== null || unavailable) return context
        const Ctor = window.AudioContext || window.webkitAudioContext
        if (typeof Ctor !== 'function') {
          unavailable = true
          return null
        }
        try {
          context = new Ctor()
        } catch {
          unavailable = true
          return null
        }
        return context
      }

      /**
       * Note patterns by notice kind. The pending one runs longer and climbs a
       * major triad, so "the agent needs you" cannot be mistaken for "done".
       */
      const PATTERNS = {
        finished: [[880, 0, 0.28], [1174.66, 0.11, 0.42]],
        pending: [[783.99, 0, 0.24], [1046.5, 0.14, 0.3], [1318.51, 0.28, 0.55]],
      }

      const ring = (ac, kind) => {
        const start = ac.currentTime + 0.02
        const notes = PATTERNS[kind] ?? PATTERNS.finished
        for (const [frequency, delay, duration] of notes) {
          try {
            const oscillator = ac.createOscillator()
            const gain = ac.createGain()
            oscillator.type = 'sine'
            oscillator.frequency.setValueAtTime(frequency, start + delay)
            gain.gain.setValueAtTime(0.0001, start + delay)
            gain.gain.exponentialRampToValueAtTime(CHIME_GAIN, start + delay + 0.015)
            gain.gain.exponentialRampToValueAtTime(0.0001, start + delay + duration)
            oscillator.connect(gain)
            gain.connect(ac.destination)
            oscillator.start(start + delay)
            oscillator.stop(start + delay + duration + 0.03)
          } catch {
            // One unusable node must not block the other note.
          }
        }
      }

      return {
        /** Resume the context from a user gesture, so a later notice can be heard. */
        unlock() {
          const ac = ensure()
          if (ac !== null && ac.state === 'suspended') void ac.resume().catch(() => {})
        },
        /** Play the chime now; resumes first when the context is still suspended. */
        play(kind) {
          const ac = ensure()
          if (ac === null) return
          if (ac.state === 'suspended') {
            ac.resume().then(() => { ring(ac, kind) }).catch(() => {})
            return
          }
          ring(ac, kind)
        },
        /** Release the audio device with the plugin. */
        dispose() {
          const ac = context
          context = null
          if (ac !== null) void ac.close().catch(() => {})
        },
      }
    }

    /**
     * One notice card: a status icon, the localized headline, the Session title,
     * and a dismiss control. The headline region opens the Session; the card
     * stays until the user closes it.
     * @param props - notice, copy, and the open and dismiss callbacks.
     * @returns the card element.
     */
    function NoticeCard(props) {
      const { notice, t, onOpen, onDismiss } = props
      const pending = notice.kind !== 'finished'
      return h('div', {
        className: 'tct-card',
        'data-kind': notice.kind,
        'data-leaving': notice.leaving ? '' : undefined,
      },
      h('button', {
        type: 'button',
        className: 'tct-main',
        title: t('open'),
        onClick: () => { onOpen(notice.sessionId) },
      },
      h('span', { className: 'tct-icon', 'data-pending': pending ? '' : undefined },
        pending ? h(QuestionIcon) : h(CheckIcon)),
      h('span', { className: 'tct-body' },
        h('span', { className: 'tct-title' }, t(titleKeyOf(notice.kind))),
        notice.sessionTitle === undefined
          ? null
          : h('span', { className: 'tct-session' }, notice.sessionTitle),
        // The visible text stays the accessible name, with the action named
        // after it for screen readers.
        h('span', { className: 'tct-sr' }, ` ${t('open')}`))),
      h('button', {
        type: 'button',
        className: 'tct-close',
        'aria-label': t('dismiss'),
        title: t('dismiss'),
        onClick: () => { onDismiss(notice.id) },
      }, h(CloseIcon)))
    }

    /**
     * Overlay entry: watches every listed Session's running state and announces
     * each stop, newest last.
     * @param props - the framework Session hooks, localized copy, and the injected actions.
     * @returns the notice layer with its live region, empty while no notice shows.
     */
    function TaskCompleteNotice(props) {
      const { useSessionStatus, useSessions, t, openSession, playChime } = props
      const hooksReady = typeof useSessionStatus === 'function' && typeof useSessions === 'function'
      // The hooks are framework seats of this slot; their presence never changes
      // for a mounted entry, so the early return keeps the hook order stable.
      if (!hooksReady) return null

      const statuses = useSessionStatus((snapshot) => snapshot)
      const sessionsById = useSessions((state) => state.byId)
      // A locale chain with no dictionary for the active language falls back to
      // the key itself; show the English copy instead of an internal key.
      const copy = (key) => {
        const value = typeof t === 'function' ? t(key) : key
        return typeof value === 'string' && value !== key ? value : DICT_EN[key] ?? key
      }

      const sessionsRef = React.useRef(sessionsById)
      sessionsRef.current = sessionsById
      const runningRef = React.useRef(null)
      const seqRef = React.useRef(0)
      const dismissingRef = React.useRef(new Set())
      const exitTimersRef = React.useRef(new Map())
      /** Per Session waiting on the user: the interaction key, kind, and its notice. */
      const pendingRef = React.useRef(new Map())
      const [notices, setNotices] = React.useState([])
      const noticesRef = React.useRef(notices)
      noticesRef.current = notices

      const dismiss = React.useCallback((id) => {
        if (dismissingRef.current.has(id)) return
        dismissingRef.current.add(id)
        setNotices((list) => list.map((notice) => (notice.id === id ? { ...notice, leaving: true } : notice)))
        exitTimersRef.current.set(`exit:${id}`, window.setTimeout(() => {
          exitTimersRef.current.delete(`exit:${id}`)
          dismissingRef.current.delete(id)
          setNotices((list) => list.filter((notice) => notice.id !== id))
        }, EXIT_MS))
      }, [])

      const open = React.useCallback((sessionId) => {
        if (typeof openSession === 'function') openSession(sessionId)
        for (const notice of noticesRef.current) {
          if (notice.sessionId === sessionId) dismiss(notice.id)
        }
      }, [openSession, dismiss])

      // Every Session runs on its own; a live snapshot has one row per Session
      // with the Host running state and the interaction the Host is waiting on.
      // A stop shows a passing notice; a waiting interaction shows one that
      // stays until it is answered or dismissed.
      React.useEffect(() => {
        const previous = runningRef.current
        const nextRunning = new Map()
        const nextPending = new Map()
        const finished = []
        statuses.forEach((status, sessionId) => {
          const running = status.running === true
          nextRunning.set(sessionId, running)
          if (previous !== null && previous.get(sessionId) === true && !running) finished.push(sessionId)
          const interaction = status.pendingInteraction
          if (interaction !== undefined) nextPending.set(sessionId, { key: interaction.key, kind: interaction.kind })
        })
        runningRef.current = nextRunning

        // The first snapshot is a baseline: a Session that is already idle, or a
        // question that already waited there, did not just arrive in front of the
        // user.
        const baseline = previous === null
        const started = []
        const resolved = []
        if (!baseline) {
          for (const [sessionId, interaction] of nextPending) {
            const known = pendingRef.current.get(sessionId)
            if (known === undefined || known.key !== interaction.key) {
              started.push({ sessionId, kind: interaction.kind })
            }
          }
          for (const [sessionId, entry] of pendingRef.current) {
            const interaction = nextPending.get(sessionId)
            if (interaction === undefined || interaction.key !== entry.key) resolved.push(entry.noticeId)
          }
        }
        const carried = new Map()
        for (const [sessionId, interaction] of nextPending) {
          const known = pendingRef.current.get(sessionId)
          const keepsNotice = known !== undefined && known.key === interaction.key
          carried.set(sessionId, {
            key: interaction.key,
            kind: interaction.kind,
            noticeId: keepsNotice ? known.noticeId : null,
          })
        }
        pendingRef.current = carried

        const created = []
        // A Session that both stopped and started waiting is one event for the
        // user; the actionable card wins over the completion card.
        const waiting = new Set(started.map((entry) => entry.sessionId))
        const candidates = finished
          .filter((sessionId) => !waiting.has(sessionId))
          .map((sessionId) => ({ sessionId, kind: 'finished' }))
          .concat(started)
        for (const candidate of candidates) {
          const row = sessionsRef.current[candidate.sessionId]
          // Subagent rows are background machinery of a run the top-level
          // Session already announces; only the Session the user drives notifies.
          if (row === undefined || row.origin === 'subagent') continue
          seqRef.current += 1
          created.push({
            id: `notice-${String(seqRef.current)}`,
            sessionId: candidate.sessionId,
            sessionTitle: row.displayTitle,
            kind: candidate.kind,
          })
        }

        if (created.length > 0) {
          // One chime per batch: a waiting interaction owns the longer pattern.
          const kind = created.some((notice) => notice.kind !== 'finished') ? 'pending' : 'finished'
          if (typeof playChime === 'function') playChime(kind)
          setNotices((list) => {
            const next = [...list, ...created]
            const overflow = next.length - MAX_NOTICES
            if (overflow <= 0) return next
            // A waiting card is actionable, so a completion yields first; only
            // then does the oldest waiting card leave the stack.
            const dropped = new Set()
            const drop = (accept) => {
              for (const notice of next) {
                if (dropped.size >= overflow) return
                if (dropped.has(notice.id) || !accept(notice)) continue
                dropped.add(notice.id)
              }
            }
            drop((notice) => notice.kind === 'finished')
            drop(() => true)
            return next.filter((notice) => !dropped.has(notice.id))
          })
          for (const notice of created) {
            if (notice.kind === 'finished') continue
            const entry = carried.get(notice.sessionId)
            if (entry !== undefined) entry.noticeId = notice.id
          }
        }
        for (const noticeId of resolved) {
          if (noticeId !== null) dismiss(noticeId)
        }
      }, [statuses, dismiss, playChime])

      // Exit timers must not outlive the entry.
      React.useEffect(() => () => {
        for (const timer of exitTimersRef.current.values()) window.clearTimeout(timer)
        exitTimersRef.current.clear()
      }, [])

      // The layer and its live region stay mounted while the plugin is live, so
      // a screen reader is already listening when the first notice arrives.
      const newest = notices.length === 0 ? undefined : notices[notices.length - 1]
      const announcement = newest === undefined
        ? ''
        : `${copy(titleKeyOf(newest.kind))}${newest.sessionTitle === undefined ? '' : ` · ${newest.sessionTitle}`}`
      const layer = h('div', { className: 'tct-layer', style: { pointerEvents: 'none' } },
        h('span', { className: 'tct-sr', role: 'status', 'aria-live': 'polite' }, announcement),
        notices.map((notice) => h(NoticeCard, {
          key: notice.id,
          notice,
          t: copy,
          onOpen: open,
          onDismiss: dismiss,
        })))
      const host = typeof document === 'undefined' ? null : document.body
      return createPortal !== null && host !== null ? createPortal(layer, host) : layer
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => {
          const style = document.createElement('style')
          style.dataset.dsh = NS
          style.textContent = CSS
          document.head.append(style)
          return () => { style.remove() }
        }, 'task-complete-toast: styles')

        ctx.effect(() => ctx.locale.register(NS, 'en', DICT_EN), 'task-complete-toast: en dictionary')
        ctx.effect(() => ctx.locale.register(NS, 'zh', DICT_ZH), 'task-complete-toast: zh dictionary')

        const chime = createChime()
        ctx.effect(() => () => { chime.dispose() }, 'task-complete-toast: audio device')
        // Browsers only start audio after a gesture; arm the context on the
        // first pointer or key event so a completion can always be heard.
        ctx.effect(() => {
          const unlock = () => { chime.unlock() }
          document.addEventListener('pointerdown', unlock, { capture: true, passive: true })
          document.addEventListener('keydown', unlock, { capture: true })
          return () => {
            document.removeEventListener('pointerdown', unlock, { capture: true })
            document.removeEventListener('keydown', unlock, { capture: true })
          }
        }, 'task-complete-toast: audio unlock')

        const openSession = (sessionId) => {
          const workspace = ctx.get('uiWorkspace')
          if (workspace === undefined || typeof workspace.openSession !== 'function') return
          workspace.openSession(sessionId)
        }

        ctx.slots.inject('shell.overlay', () => ctx.slots.register({
          name: 'shell.overlay',
          id: 'task-complete-toast',
          locale: NS,
          inject: () => ({ openSession, playChime: (kind) => { chime.play(kind) } }),
        }, TaskCompleteNotice))
      },
    }
  },
})
