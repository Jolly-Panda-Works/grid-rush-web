import { useEffect, useState } from 'react';
import {
  STORY, TOOL_IDS, TOOL_INTRO, continuePrice, goalProgress, goalsDone, levelById, soloScore, trackLen,
} from '../../../shared/src';
import type { Goal, GoalProgress, ToolId } from '../../../shared/src';
import { Icon } from '../art';
import { sfx } from '../audio';
import { useT } from '../i18n';
import { beginLevel, continueLevel, leaveLevel, retryLevel, settleWin } from '../levelFlow';
import { backToMap, send, startSearch } from '../net';
import { needServer, pushToast, useStore } from '../store';
import { livesNow, shop } from '../story';
import { dragApi } from '../three/dragApi';
import { CoinIcon } from './TileShape';
import { CoinDelta } from './Seats';

const BASE = `${import.meta.env.BASE_URL}story/`;

/* ---------- icons: the story art when it is there, a simple drawing until then ---------- */
export type StoryIconId = ToolId | 'brick' | 'coinbag' | 'star' | 'star-empty' | 'life' | Goal['type'];
const FALLBACK: Record<StoryIconId, JSX.Element> = {
  brick: <g><rect x="3" y="7" width="18" height="10" rx="1.5" fill="#C2693A" stroke="#6b3015" strokeWidth="1.4" /><path d="M3 12h18M9 7v5M15 12v5" stroke="#6b3015" strokeWidth="1.2" /></g>,
  chisel: <g><rect x="10.5" y="2" width="3" height="10" rx="1" fill="#9a6a3a" stroke="#4a2a10" /><path d="M9.5 12h5l-1 8-1.5 2-1.5-2z" fill="#c9d3dc" stroke="#4a5560" /></g>,
  wheel: <g><circle cx="12" cy="12" r="8.5" fill="#1BA3B8" stroke="#0b5f6e" strokeWidth="1.4" /><circle cx="12" cy="12" r="3" fill="#F2C744" stroke="#7a5200" /><path d="M12 3.5v5M12 15.5v5M3.5 12h5M15.5 12h5" stroke="#0b5f6e" strokeWidth="1.4" /></g>,
  brush: <g><path d="M14 3l4 4-7 7-4-4z" fill="#9a6a3a" stroke="#4a2a10" /><path d="M7 10l4 4c-1 3-4 6-8 6 0-4 2-8 4-10z" fill="#1BA3B8" stroke="#0b5f6e" /></g>,
  coinbag: <g><path d="M8 6h8l-2 3c4 2 6 5 6 8 0 3-3 4-8 4s-8-1-8-4c0-3 2-6 6-8z" fill="#C79A4A" stroke="#6b4a10" strokeWidth="1.3" /><circle cx="12" cy="15" r="3" fill="#F2C744" stroke="#7a5200" /></g>,
  star: <path d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5L2.5 9.3l6.6-.8z" fill="#F5C531" stroke="#8a5a00" strokeWidth="1.3" />,
  'star-empty': <path d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5L2.5 9.3l6.6-.8z" fill="rgba(0,0,0,.25)" stroke="#8a7a5a" strokeWidth="1.3" />,
  life: <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" fill="#D8322E" stroke="#7a1a14" strokeWidth="1.3" />,
  fill_board: <g><rect x="3" y="3" width="18" height="18" rx="2" fill="#2F6DB5" stroke="#12345e" /><path d="M9 3v18M15 3v18M3 9h18M3 15h18" stroke="#9cc4f0" /></g>,
  fill_count: <g><rect x="3" y="3" width="8" height="8" fill="#2F6DB5" stroke="#12345e" /><rect x="13" y="3" width="8" height="8" fill="#2F6DB5" stroke="#12345e" /><rect x="3" y="13" width="8" height="8" fill="#2F6DB5" stroke="#12345e" /><rect x="13" y="13" width="8" height="8" fill="none" stroke="#12345e" strokeDasharray="2 2" /></g>,
  fill_region: <g><rect x="3" y="3" width="18" height="18" rx="2" fill="rgba(245,197,49,.3)" stroke="#D9A21A" strokeWidth="2.5" /><rect x="8" y="8" width="8" height="8" fill="#2F6DB5" /></g>,
  cover_cracks: <g><rect x="3" y="3" width="18" height="18" rx="2" fill="#D9C9A6" stroke="#6b5030" /><path d="M7 4l4 6-2 4 5 6M11 10l7-2" stroke="#4A3424" strokeWidth="1.8" fill="none" /></g>,
  bonus7: <g><rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="#F5C531" strokeWidth="2" strokeDasharray="3 2" /><text x="12" y="16" fontSize="9" textAnchor="middle" fill="#F5C531" fontWeight="800">7×7</text></g>,
  max_empty: <g><rect x="3" y="3" width="18" height="18" rx="2" fill="#2F6DB5" stroke="#12345e" /><rect x="9" y="9" width="6" height="6" fill="#F6EBCB" stroke="#C0503F" strokeWidth="1.5" /></g>,
  min_score: <path d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5L2.5 9.3l6.6-.8z" fill="#1BA3B8" stroke="#0b5f6e" strokeWidth="1.3" />,
  min_coins: <g><circle cx="12" cy="12" r="8.5" fill="#F2C744" stroke="#7a5200" strokeWidth="1.5" /><circle cx="12" cy="12" r="5" fill="none" stroke="#7a5200" /></g>,
};
export function StoryIcon({ id, size = 24 }: { id: StoryIconId; size?: number }) {
  const [art, setArt] = useState(true);
  if (art) return <img className="aicon" src={`${BASE}icons/${id}.webp`} width={size} height={size} alt="" draggable={false} onError={() => setArt(false)} />;
  return <svg className="aicon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">{FALLBACK[id]}</svg>;
}

export function Stars({ n, size = 22 }: { n: number; size?: number }) {
  return <span className="stars">{[0, 1, 2].map((i) => <StoryIcon key={i} id={i < n ? 'star' : 'star-empty'} size={size} />)}</span>;
}

/** "Fill the gold frame", "Cover all 8 cracks"… */
export function goalText(t: ReturnType<typeof useT>, g: Goal, need: number) {
  return t('goal.' + g.type, { n: need });
}
/** The live counter of a goal: "3/8", or for the empty-cell limit "5 (max 2)". */
function goalCount(t: ReturnType<typeof useT>, p: GoalProgress) {
  if (p.goal.type === 'bonus7') return p.done ? '✓' : '';
  if (p.goal.type === 'max_empty') return t('goal.emptyNow', { n: p.have, m: p.need });
  return `${Math.min(p.have, p.need)}/${p.need}`;
}

/* ---------- dialog ---------- */
const PORTRAIT: Record<'master' | 'grandchild', string> = {
  master: `${import.meta.env.BASE_URL}art/avatars/hero-10.webp`,
  grandchild: `${import.meta.env.BASE_URL}art/avatars/hero-2.webp`,
};
/** A bust of the speaker at the bottom with a speech bubble; tap for the next line, or skip. */
export function StoryDialog() {
  const t = useT();
  const d = useStore((s) => s.dialog);
  const [missing, setMissing] = useState<Record<string, boolean>>({});
  if (!d) return null;
  const line = d.lines[d.i];
  const end = () => { useStore.setState({ dialog: null }); d.then?.(); };
  const next = () => { sfx.click(); if (d.i + 1 < d.lines.length) useStore.setState({ dialog: { ...d, i: d.i + 1 } }); else end(); };
  const src = `${BASE}chars/${line.who}-${line.mood ?? 'normal'}.webp`;
  const art = missing[src] ? PORTRAIT[line.who] : src;
  return (
    <div className="sdialog" onClick={next} role="dialog" aria-label={t('story.' + line.who)}>
      <div className={'sd-bust ' + line.who} key={line.who}>
        <img src={art} alt="" draggable={false} onError={() => setMissing((m) => ({ ...m, [src]: true }))} />
      </div>
      <div className={'sd-bubble ' + line.who} key={d.i}>
        <b className="sd-name">{t('story.' + line.who)}</b>
        <p>{t(line.key)}</p>
        <span className="sd-next">{d.i + 1 < d.lines.length ? '›' : '✓'}</span>
      </div>
      <button className="btn small sd-skip" onClick={(e) => { e.stopPropagation(); end(); }}>{t('story.skip')}</button>
    </div>
  );
}

/* ---------- currencies ---------- */
export function LivesGem() {
  const t = useT();
  const story = useStore((s) => s.story);
  const at = useStore((s) => s.storyAt);
  const [, tick] = useState(0);
  useEffect(() => { const i = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(i); }, []);
  const { lives, nextIn } = livesNow(story, at);
  const mm = Math.floor(nextIn / 60000), ss = Math.floor((nextIn % 60000) / 1000);
  return (
    <span className="gem lives" title={t('lvl.lives')}>
      <StoryIcon id="life" size={20} /><b className="num">{lives}</b>
      {lives < STORY.LIVES_MAX && <small className="num" dir="ltr">{mm}:{String(ss).padStart(2, '0')}</small>}
    </span>
  );
}
export function CoinsGem() {
  const coins = useStore((s) => s.story.coins);
  return <span className="gem coin"><Icon id="coins" size={20} /><b className="num">{coins}</b><CoinDelta value={coins} /></span>;
}
export function BricksGem() {
  const t = useT();
  const bricks = useStore((s) => s.story.bricks);
  return <span className="gem bricks" title={t('story.bricks')}><StoryIcon id="brick" size={20} /><b className="num">{bricks}</b></span>;
}

/* ---------- level start ---------- */
export function LevelStart() {
  const t = useT();
  const id = useStore((s) => s.levelPrep);
  const story = useStore((s) => s.story);
  const [bag, setBag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { setBag(false); setErr(''); }, [id]);
  const def = id ? levelById(id) : undefined;
  if (!id || !def) return null;
  const close = () => useStore.setState({ levelPrep: null });
  const best = story.results[id]?.stars ?? 0;
  const afterTut = id > STORY.TUTORIAL_LEVELS;
  const start = async () => {
    setBusy(true); setErr('');
    const r = await beginLevel(id, bag);
    setBusy(false);
    if (r === 'no_lives' || r === 'coins' || r === 'error' || r === 'locked') setErr(t('lvl.err.' + r));
  };
  const refill = async () => {
    const r = await shop('lives');
    if (r === true) { setErr(''); pushToast(t('lvl.refilled'), 'good'); } else setErr(t(r === 'offline' ? 'lvl.err.offline' : 'lvl.err.coins'));
  };
  return (
    <div className="overlay" onClick={close}>
      <div className={'modal small lvstart' + (def.hard ? ' hard' : '')} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <h3>{t('lvl.title', { n: id })}{def.hard && <span className="tag hard">{t(def.hard === 2 ? 'lvl.veryHard' : 'lvl.hard')}</span>}</h3>
        <button className="mclose" onClick={close} aria-label={t('settings.close')}>✕</button>
        <div className="mscroll">
          <Stars n={best} size={28} />
          <p className="muted small">{t('lvl.goals')}</p>
          <ul className="goallist">
            {def.goals.map((g, i) => {
              const need = g.type === 'cover_cracks' ? def.cells?.crack?.length ?? 0 : g.type === 'max_empty' ? g.max : 'n' in g ? g.n : 0;
              return <li key={i}><StoryIcon id={g.type} size={30} /><span>{goalText(t, g, need)}</span></li>;
            })}
          </ul>
          {afterTut && (
            <button className={'boostbtn' + (bag ? ' on' : '')} onClick={() => setBag((b) => !b)} disabled={story.coins < STORY.COIN_BAG_PRICE && !bag}>
              <StoryIcon id="coinbag" size={34} />
              <span><b>{t('lvl.coinBag')}</b><small>{t('lvl.coinBagSub', { n: STORY.COIN_BAG_COINS })}</small></span>
              <span className="price num"><Icon id="coins" size={16} />{STORY.COIN_BAG_PRICE}</span>
            </button>
          )}
          {afterTut && <div className="lvmeta"><LivesGem /><CoinsGem /></div>}
          {err && <p className="dlg-err">{err}</p>}
          {err === t('lvl.err.no_lives') && (
            <button className="btn small" onClick={refill}><StoryIcon id="life" size={18} /> {t('lvl.refill', { n: STORY.REFILL_LIVES_PRICE })}</button>
          )}
        </div>
        <div className="row"><button className="btn primary big" disabled={busy} onClick={start}>{t('lvl.start')}</button></div>
      </div>
    </div>
  );
}

/* ---------- in the level ---------- */
/** In place of the opponent's board: the level, its goals with live counters, my coins, and "finish" once done. */
export function GoalsPanel() {
  const t = useT();
  useStore((s) => s.layoutTick);
  const g = useStore((s) => s.game)!;
  const coach = useStore((s) => s.coach);
  const r = dragApi.infoRect?.();
  if (!r || r.width < 60 || !g.solo) return null;
  const prog = goalProgress(g);
  const done = goalsDone(g) && g.phase !== 'finished';
  const left = trackLen(g) - g.players[0].pos;
  const me = g.players[0];
  return (
    <div className={'goalspanel' + (coach?.focus === 'goals' ? ' coach-focus' : '')} style={{ left: Math.max(6, r.left), top: r.top, width: r.width, height: r.height }}>
      <div className="gp-head">
        <b>{t('lvl.title', { n: g.solo.level })}</b>
        <ToolBar />
        <span className="gem coin"><CoinIcon size={16} /><b key={me.coins} className="num bump">{me.coins}</b><CoinDelta value={me.coins} /></span>
        <span className="gem score" title={t('lvl.score')}><StoryIcon id="star" size={16} /><b className="num">{soloScore(g).total}</b></span>
      </div>
      <ul className="gp-goals">
        {prog.map((p, i) => (
          <li key={i} className={p.done ? 'done' : ''}>
            <StoryIcon id={p.goal.type} size={22} />
            <span className="gp-t">{goalText(t, p.goal, p.need)}</span>
            <b className="num">{goalCount(t, p)}</b>
            {p.done && <span className="gp-ok"><Icon id="confirm" size={18} /></span>}
          </li>
        ))}
      </ul>
      {done && (
        <button className="btn primary finishbtn" onClick={() => { sfx.click(); send.solo({ t: 'finish' }); }}>
          {t('lvl.finish')}{left > 0 && <small className="num"> +{left * STORY.EARLY_CELL_COINS} <Icon id="coins" size={14} /></small>}
        </button>
      )}
    </div>
  );
}

/** The tools of this level (in the goals panel); a tool that needs a cell waits for a tap on the board. */
function ToolBar() {
  const t = useT();
  const g = useStore((s) => s.game);
  const mode = useStore((s) => s.toolMode);
  const coach = useStore((s) => s.coach);
  if (!g?.solo) return null;
  const tools = TOOL_IDS.filter((id) => g.solo!.level >= TOOL_INTRO[id]);
  if (!tools.length) return null;
  const myTurn = g.current === 0 && g.phase === 'playing';
  const use = (id: ToolId) => {
    const n = g.solo!.tools[id] ?? 0;
    if (!n || !myTurn) { sfx.bad(); pushToast(t(n ? 'tool.notNow' : 'tool.none'), 'warn'); return; }
    sfx.select();
    if (id === 'wheel') { send.solo({ t: 'wheel' }); return; }
    useStore.setState({ toolMode: mode === id ? null : id });
    if (mode !== id) pushToast(t('tool.pick.' + id), 'info');
  };
  return (
    <div className={'toolbar' + (coach?.focus === 'tools' ? ' coach-focus' : '')} role="toolbar" aria-label={t('tool.title')}>
      {tools.map((id) => (
        <button key={id} className={'toolbtn' + (mode === id ? ' on' : '')} onClick={() => use(id)} title={t('tool.' + id)} aria-pressed={mode === id}>
          <StoryIcon id={id} size={26} />
          <b className="num">{g.solo!.tools[id] ?? 0}</b>
        </button>
      ))}
    </div>
  );
}

/** Win / lose card over the level. */
export function LevelEnd() {
  const t = useT();
  const lp = useStore((s) => s.levelPlay);
  const g = useStore((s) => s.game);
  const coins = useStore((s) => s.story.coins);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const end = lp?.end;
  useEffect(() => {
    if (!end) return;
    if (end.outcome === 'won' && !end.result && !end.busy) void settleWin();
    if (end.outcome === 'lost' && end.quit) void leaveLevel();
    if (end.outcome === 'lost' && !end.quit) sfx.lose();
    setErr('');
  }, [end]);
  if (!lp || !end || !g?.solo || end.quit) return null;
  const def = levelById(lp.id)!;
  if (end.outcome === 'won') {
    const r = end.result;
    return (
      <div className="overlay soft">
        <div className="modal small lvend won" role="dialog" aria-modal="true">
          <h3 className="ribbon-title">{t('lvl.won')}</h3>
          <div className="mscroll">
            {!r ? <p className="muted">{t('lvl.sending')}</p> : (
              <>
                <Stars n={r.stars} size={44} />
                <div className="lvscore"><span>{t('lvl.score')}</span><b className="num">{r.score}</b></div>
                <div className="lvgains">
                  {r.coins > 0 && <span className="gain"><Icon id="coins" size={26} /><b className="num">+{r.coins}</b></span>}
                  {r.bricks > 0 && <span className="gain brickfly"><StoryIcon id="brick" size={30} /><b className="num">+{r.bricks}</b></span>}
                </div>
                {r.offline && <p className="muted small">{t('lvl.pending')}</p>}
              </>
            )}
          </div>
          <div className="row"><button className="btn primary big" disabled={!r} onClick={() => void leaveLevel()}>{t('lvl.next')}</button></div>
        </div>
      </div>
    );
  }
  const left = goalProgress(g).filter((p) => !p.done);
  const price = continuePrice(lp.id, g.solo.continues);
  const canContinue = g.solo.continues < STORY.CONTINUE_MULT.length;
  const cont = async () => {
    if (price > coins) { setErr(t('lvl.err.coins')); return; }
    setBusy(true);
    const r = await continueLevel();
    setBusy(false);
    if (r === 'offline') needServer('off.what.level');
    else if (r !== 'ok') setErr(t('lvl.err.' + r));
  };
  return (
    <div className="overlay soft">
      <div className="modal small lvend lost" role="dialog" aria-modal="true">
        <h3 className="ribbon-title">{t('lvl.lost')}</h3>
        <div className="mscroll">
          <p className="dlg-text">{t('lvl.left')}</p>
          <ul className="goallist">
            {left.map((p, i) => <li key={i}><StoryIcon id={p.goal.type} size={26} /><span>{t('lvl.leftGoal.' + p.goal.type, { n: Math.abs(p.need - p.have), m: p.need })}</span></li>)}
          </ul>
          {err && <p className="dlg-err">{err}</p>}
        </div>
        <div className="row col">
          {canContinue && (
            <button className="btn primary" disabled={busy} onClick={cont}>
              {t('lvl.continue', { c: STORY.CONTINUE_CELLS, k: STORY.CONTINUE_COINS })}
              <small className="num"> {price ? <><Icon id="coins" size={14} /> {price}</> : t('lvl.free')}</small>
            </button>
          )}
          <div className="row">
            <button className="btn" disabled={busy} onClick={() => void retryLevel()}>{t('lvl.retry')}</button>
            <button className="btn" disabled={busy} onClick={() => void leaveLevel()}>{t('lvl.map')}</button>
          </div>
        </div>
        {def.id > STORY.TUTORIAL_LEVELS && <p className="muted small center">{t('lvl.lifeNote')}</p>}
      </div>
    </div>
  );
}

/* ---------- coach: what this level teaches, the first time ---------- */
const SEEN_KEY = 'gridrush.coach.v1';
const seen = (): Record<string, 1> => { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}'); } catch { return {}; } };
const markSeen = (k: string) => { try { localStorage.setItem(SEEN_KEY, JSON.stringify({ ...seen(), [k]: 1 })); } catch { /* ignore */ } };
const FOCUS: Record<string, string> = {
  place1: 'dock', place2: 'board', goals: 'goals', pacer: 'track', filled: 'board', region: 'region', advance: 'advance', crack: 'board',
  treasure: 'track', stone: 'board', reward: 'track', gold: 'board', bonus7: 'board', chisel: 'tools', wheel: 'tools', brush: 'tools',
};

/** Steps of the coach for a level: level 1 walks through the first tile; the others show one note. */
function coachSteps(teach: string): string[] {
  if (teach === 'place') return ['place1', 'place2', 'goals', 'pacer'];
  return [teach];
}

export function LevelCoach() {
  const t = useT();
  const g = useStore((s) => s.game);
  const sel = useStore((s) => s.sel.offer);
  const lp = useStore((s) => s.levelPlay);
  const dialog = useStore((s) => s.dialog);
  const [done, setDone] = useState<Record<string, 1>>(seen);
  const def = lp ? levelById(lp.id) : undefined;
  const teach = def?.teach;
  let key: string | null = null;
  if (g?.solo && teach && !lp?.end && !dialog) {
    const steps = coachSteps(teach).filter((k) => !done[k]);
    const placed = g.players[0].tiles.some((x) => x.uid < 100000);
    for (const k of steps) {
      if (k === 'place1' && !placed && sel === null) { key = k; break; }
      if (k === 'place2' && !placed && sel !== null) { key = k; break; }
      if (k === 'place1' || k === 'place2') continue; // (done by placing the first tile)
      if (k === 'pacer' && g.players[0].pos === 0) continue; // after the first move
      key = k; break;
    }
  }
  const focus = key ? FOCUS[key] : undefined;
  useEffect(() => {
    const cur = useStore.getState().coach;
    if ((cur?.key ?? null) !== key) useStore.setState({ coach: key ? { key, focus } : null });
  }, [key, focus]);
  // the first tile placed ends the two placing steps
  useEffect(() => {
    if (g?.solo && teach === 'place' && g.players[0].tiles.some((x) => x.uid < 100000) && !done.place2) { markSeen('place1'); markSeen('place2'); setDone(seen()); }
  }, [g, teach, done.place2]);
  useEffect(() => () => { useStore.setState({ coach: null }); }, []);
  if (!key) return null;
  const tap = key !== 'place1' && key !== 'place2';
  return (
    <div className={'lcoach at-' + (focus ?? 'mid')} onClick={tap ? () => { markSeen(key!); setDone(seen()); sfx.click(); } : undefined} role="note">
      <b>{t('coach.' + key + '.t')}</b>
      <p>{t('coach.' + key + '.d')}</p>
      {tap && <span className="lc-ok">{t('tut.next')}</span>}
    </div>
  );
}

/* ---------- the bottom bar (after the tutorial) ---------- */
export function MainNav() {
  const t = useT();
  const screen = useStore((s) => s.screen);
  const unlocked = useStore((s) => s.story.unlocked);
  const online = useStore((s) => s.serverOnline);
  const tour = useStore((s) => s.unlockTour);
  if (!unlocked) return null;
  const go = (screen: 'map' | 'menu' | 'museum') => { sfx.click(); useStore.setState({ screen, unlockTour: tour === 'battle' && screen === 'menu' ? 'museum' : tour === 'museum' && screen === 'museum' ? null : tour }); };
  return (
    <nav className="mainnav">
      <button className={screen === 'map' ? 'on' : ''} onClick={() => go('map')}><StoryIcon id="brick" size={28} /><span>{t('nav.story')}</span></button>
      <button className={(screen === 'menu' ? 'on' : '') + (tour === 'battle' ? ' tour' : '')} onClick={() => go('menu')}><Icon id="match" size={28} /><span>{t('nav.battle')}</span></button>
      <button className={(screen === 'museum' ? 'on' : '') + (tour === 'museum' ? ' tour' : '')} onClick={() => go('museum')}><Icon id="museum" size={28} /><span>{t('museum.title')}</span></button>
      <button className={online ? '' : 'needsrv'} onClick={() => needServer('off.what.lb', () => useStore.setState({ screen: 'leaderboard' }))}><Icon id="trophy" size={28} /><span>{t('lb.short')}</span></button>
      <button className={online ? '' : 'needsrv'} onClick={() => needServer('off.what.fr', () => useStore.setState({ screen: 'friends' }))}><Icon id="friends" size={28} /><span>{t('fr.title')}</span></button>
      {tour && <UnlockTourBubble which={tour} />}
    </nav>
  );
}

/** After level 10: the new buttons are introduced one by one (battle, then the museum). */
function UnlockTourBubble({ which }: { which: 'battle' | 'museum' }) {
  const t = useT();
  return (
    <div className={'tourbubble at-' + which} role="note">
      <b>{t('tour.' + which + '.t')}</b>
      <p>{t('tour.' + which + '.d')}</p>
      <div className="row">
        {which === 'battle' && <button className="btn small primary" onClick={() => { useStore.setState({ unlockTour: 'museum' }); void startSearch(true); }}>{t('tour.battle.go')}</button>}
        <button className="btn small" onClick={() => useStore.setState({ unlockTour: which === 'battle' ? 'museum' : null })}>{t('tut.next')}</button>
      </div>
    </div>
  );
}

export { backToMap };
