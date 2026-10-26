import { useEffect, useRef } from 'react';
import { LAST_LEVEL, LEVELS, SPACES, STORY } from '../../../shared/src';
import { Icon } from '../art';
import { useT } from '../i18n';
import { openLevel } from '../levelFlow';
import { useStore } from '../store';
import { refreshStory } from '../story';
import { BricksGem, CoinsGem, LivesGem, MainNav, Stars, StoryIcon } from '../components/StoryUI';

/** The home screen: the levels of the current space as a winding path (level 1 at the bottom), the currencies on
 *  top, the next level and the restoration at the bottom. */
export default function MapScreen() {
  const t = useT();
  const story = useStore((s) => s.story);
  const online = useStore((s) => s.serverOnline);
  const cur = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (online) void refreshStory(); }, [online]);
  useEffect(() => { cur.current?.scrollIntoView({ block: 'center' }); }, []);
  const next = Math.min(story.level, LAST_LEVEL);
  const allDone = story.level > LAST_LEVEL;
  const space = SPACES[0];
  const sp = story.steps[space.id] ?? { done: 0, choices: {} };
  const stepCost = space.steps[sp.done]?.cost;
  const canRestore = stepCost !== undefined && story.bricks >= stepCost;
  return (
    <main className="screen mapscreen">
      <header className="maptop">
        <CoinsGem />
        {(story.unlocked || story.level > STORY.TUTORIAL_LEVELS) && <LivesGem />}
        <BricksGem />
        {!!story.pending && <span className="gem pending" title={t('lvl.pending')}><Icon id="hourglass" size={18} /><b className="num">{story.pending}</b></span>}
        <button className="iconbtn" onClick={() => useStore.setState({ showSettings: true })} aria-label={t('menu.settings')}><Icon id="settings" size={30} /></button>
      </header>
      <div className="mappath" role="list">
        {[...LEVELS].reverse().map((lv) => {
          const done = lv.id < story.level;
          const locked = lv.id > story.level;
          const isNext = lv.id === next && !allDone;
          const x = Math.sin(lv.id * 0.9) * 32;
          return (
            <div className="mapnode-row" key={lv.id} role="listitem" style={{ transform: `translateX(${x}%)` }}>
              <button
                ref={isNext ? cur : undefined}
                className={'mapnode' + (done ? ' done' : '') + (locked ? ' locked' : '') + (isNext ? ' next' : '') + (lv.hard ? ' hard' : '')}
                disabled={locked}
                onClick={() => openLevel(lv.id)}
                aria-label={t('lvl.title', { n: lv.id })}
              >
                {locked ? <Icon id="lock" size={26} /> : <b className="num">{lv.id}</b>}
                {done && <Stars n={story.results[lv.id]?.stars ?? 1} size={16} />}
              </button>
            </div>
          );
        })}
      </div>
      <footer className="mapbottom">
        <button className="btn restorebtn" onClick={() => useStore.setState({ screen: 'restore' })}>
          <StoryIcon id="brick" size={30} />
          <span>{t('story.restore')}</span>
          <b className={'badge num' + (canRestore ? ' glow' : '')}>{story.bricks}</b>
        </button>
        {allDone
          ? <div className="mapdone">{t('story.allDone')}</div>
          : <button className="btn primary big playnext" onClick={() => openLevel(next)}>{t('lvl.title', { n: next })}</button>}
      </footer>
      <MainNav />
    </main>
  );
}
