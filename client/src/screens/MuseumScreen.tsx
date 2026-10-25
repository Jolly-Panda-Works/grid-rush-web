import { useCallback, useEffect, useState } from 'react';
import { BoardArt } from '../components/BoardArt';
import { Popup } from '../components/Popup';
import { useT } from '../i18n';
import {
  CollectionItem, Exhibit, XP_PER_VOTE, claimVotes, fetchExplore, fetchMine, loadCollection, publishBoard, removeExhibit, voteExhibit,
} from '../museum';
import { pushToast, useStore } from '../store';

type Tab = 'mine' | 'explore';

/** Museum: show your tile-work boards, walk through other players' boards and vote for the ones you like. */
export default function MuseumScreen() {
  const t = useT();
  const [tab, setTab] = useState<Tab>('mine');
  const [sort, setSort] = useState<'top' | 'new'>('top');
  const [mine, setMine] = useState<{ exhibits: Exhibit[]; points: number; max: number } | null | undefined>(undefined);
  const [explore, setExplore] = useState<Exhibit[] | null | undefined>(undefined);
  const [collection, setCollection] = useState<CollectionItem[]>(loadCollection);
  const [busy, setBusy] = useState<string | null>(null);

  const loadMine = useCallback(async () => {
    const m = await fetchMine();
    setMine(m);
    if (m) claimVotes(m.points);
  }, []);
  const loadExplore = useCallback(async () => { setExplore(undefined); setExplore(await fetchExplore(sort)); }, [sort]);
  useEffect(() => { loadMine(); }, [loadMine]);
  useEffect(() => { if (tab === 'explore') loadExplore(); }, [tab, loadExplore]);

  const offline = (tab === 'mine' ? mine : explore) === null;
  const full = !!mine && mine.exhibits.length >= mine.max;

  const exhibit = async (c: CollectionItem) => {
    setBusy(c.id);
    const ok = await publishBoard(c.tiles, c.score);
    setBusy(null);
    pushToast(t(ok ? 'museum.published' : full ? 'museum.full' : 'museum.offline'), ok ? 'good' : 'warn');
    if (ok) loadMine();
  };
  const remove = async (e: Exhibit) => { setBusy(e.id); await removeExhibit(e.id); setBusy(null); loadMine(); };
  const vote = async (e: Exhibit) => {
    setBusy(e.id);
    const r = await voteExhibit(e.id);
    setBusy(null);
    if (r) setExplore((xs) => xs?.map((x) => (x.id === e.id ? { ...x, votes: r.votes, voted: r.voted } : x)));
  };

  return (
    <main className="screen museum">
      <header className="mhead">
        <button className="btn small" onClick={() => useStore.setState({ screen: 'menu' })}>{t('mm.back')}</button>
        <h2>🏛 {t('museum.title')}</h2>
        <span className="mpoints num" title={t('museum.pointsHint', { xp: XP_PER_VOTE })}>❤ {mine?.points ?? 0}</span>
      </header>
      <div className="mtabs" role="tablist">
        <button role="tab" aria-selected={tab === 'mine'} className={tab === 'mine' ? 'on' : ''} onClick={() => setTab('mine')}>{t('museum.mine')}</button>
        <button role="tab" aria-selected={tab === 'explore'} className={tab === 'explore' ? 'on' : ''} onClick={() => setTab('explore')}>{t('museum.explore')}</button>
      </div>
      <p className="mintro muted small">{tab === 'mine' ? t('museum.introMine', { n: mine?.max ?? 6, xp: XP_PER_VOTE }) : t('museum.introExplore')}</p>
      {offline && <div className="offnote small">{t('museum.offline')}</div>}

      <section className="mbody">
        {tab === 'mine' && (
          <>
            {mine && (
              <>
                <h3 className="msec">{t('museum.onShow', { n: mine.exhibits.length, max: mine.max })}</h3>
                {mine.exhibits.length === 0 && <p className="muted small">{t('museum.emptyShow')}</p>}
                <div className="mgrid">
                  {mine.exhibits.map((e) => (
                    <figure key={e.id} className="mcard">
                      <BoardArt tiles={e.tiles} size={140} showEmpty />
                      <figcaption><span className="mvotes num">❤ {e.votes}</span><span className="muted small num">{t('museum.score', { n: e.score })}</span></figcaption>
                      <button className="btn ghost small" disabled={busy === e.id} onClick={() => remove(e)}>{t('museum.remove')}</button>
                    </figure>
                  ))}
                </div>
              </>
            )}
            <h3 className="msec">{t('museum.collection')}</h3>
            {collection.length === 0 && <p className="muted small">{t('museum.emptyCollection')}</p>}
            <div className="mgrid">
              {collection.map((c) => (
                <figure key={c.id} className="mcard">
                  <BoardArt tiles={c.tiles} size={140} />
                  <figcaption>
                    <span className={'tag ' + (c.won ? 'good' : '')}>{c.won ? t('res.win') : t('res.lose')}</span>
                    <span className="muted small num">{t('museum.score', { n: c.score })}</span>
                  </figcaption>
                  <button className="btn small" disabled={!mine || full || busy === c.id} onClick={() => exhibit(c)}>🏛 {t('museum.exhibit')}</button>
                </figure>
              ))}
            </div>
            {collection.length > 0 && <button className="btn small mclear" onClick={() => { try { localStorage.removeItem('gridrush.collection.v1'); } catch { /* ignore */ } setCollection([]); }}>{t('museum.clear')}</button>}
          </>
        )}

        {tab === 'explore' && (
          <>
            <div className="msort">
              <button className={sort === 'top' ? 'on' : ''} onClick={() => setSort('top')}>{t('museum.top')}</button>
              <button className={sort === 'new' ? 'on' : ''} onClick={() => setSort('new')}>{t('museum.new')}</button>
            </div>
            {explore === undefined && <p className="muted small">{t('museum.loading')}</p>}
            {explore && explore.length === 0 && <p className="muted small">{t('museum.emptyExplore')}</p>}
            <div className="mgrid">
              {explore?.map((e) => (
                <figure key={e.id} className="mcard">
                  <BoardArt tiles={e.tiles} size={140} />
                  <figcaption><b className="mowner">{e.ownerName}</b><span className="muted small num">{t('museum.score', { n: e.score })}</span></figcaption>
                  <button className={'btn small vote' + (e.voted ? ' on' : '')} disabled={e.mine || busy === e.id} onClick={() => vote(e)}>
                    <span key={String(e.voted)} className="heart">{e.voted ? '❤' : '♡'}</span> <span className="num">{e.votes}</span>{e.mine ? ` · ${t('museum.yours')}` : ''}
                  </button>
                </figure>
              ))}
            </div>
          </>
        )}
      </section>
      <Popup />
    </main>
  );
}
