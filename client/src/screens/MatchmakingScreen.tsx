import { useEffect, useState } from 'react';
import { BOT_TIER_NAMES } from '../../../shared/src';
import { cancelSearch, startSearch } from '../net';
import { profileLevel } from '../profile';
import { useStore } from '../store';
import { PlayerGlyph } from '../components/TileShape';

export default function MatchmakingScreen() {
  const m = useStore((s) => s.match);
  const game = useStore((s) => s.game);
  const mySeat = useStore((s) => s.mySeat);
  const profile = useStore((s) => s.profile);
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 250); return () => clearInterval(t); }, []);
  const left = Math.max(0, Math.ceil((m.waitMs - (Date.now() - m.startedAt)) / 1000));

  if (m.status === 'error') {
    return (
      <main className="screen center">
        <h2>Connection problem</h2>
        <p className="muted">{m.error}</p>
        <div className="row"><button className="btn primary" onClick={() => startSearch(m.solo)}>Try again</button><button className="btn ghost" onClick={cancelSearch}>Back</button></div>
      </main>
    );
  }
  if (m.status === 'found' && game) {
    const me = game.players[mySeat], opp = game.players[1 - mySeat];
    return (
      <main className="screen center found">
        <div className="vs">
          <div className="vcard me"><PlayerGlyph seat={mySeat} size={28} /><h3>{me.name}</h3><div className="muted num">Lv {profileLevel(profile)} · {me.rating}</div></div>
          <div className="vsmark">VS</div>
          <div className="vcard opp"><PlayerGlyph seat={(1 - mySeat) as 0 | 1} size={28} /><h3>{opp.name}</h3>
            <div className="muted num">Lv {opp.level} · {opp.rating}</div>
            {opp.isBot && <div className="tag bot">Bot · {m.botTierName ?? BOT_TIER_NAMES[opp.botTier - 1]}</div>}
          </div>
        </div>
        <p className="muted">{game.players[game.current].seat === mySeat ? 'You start.' : `${opp.name} starts.`} Get ready…</p>
      </main>
    );
  }
  return (
    <main className="screen center">
      <div className="radar" aria-hidden="true">{Array.from({ length: 9 }, (_, i) => <i key={i} style={{ animationDelay: `${i * 0.12}s` }} />)}</div>
      <h2>{m.status === 'connecting' ? 'Connecting…' : m.solo ? 'Preparing your bot…' : 'Finding an opponent…'}</h2>
      {m.status === 'searching' && !m.solo && <p className="muted">If nobody joins in <b className="num">{left}s</b>, a bot opponent matched to your level and rating will take the seat.</p>}
      <button className="btn ghost" onClick={cancelSearch}>Cancel</button>
    </main>
  );
}
