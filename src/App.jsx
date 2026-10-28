import { useCallback, useEffect, useRef, useState } from 'react';
import { BETS, INITIAL_BALANCE, PAYTABLE, cardInfo, newGame, transition } from './engine.mjs';
import { loadGame, loadSettings, saveGame, saveSettings } from './storage.mjs';
import { playSound, setMusic } from './audio.mjs';

const asset = file => `./assets/${file}`;
const money = amount => new Intl.NumberFormat('en-US', { minimumFractionDigits: amount % 100 ? 2 : 0, maximumFractionDigits: 2 }).format(amount / 100);
const getStorage = () => { try { return window.localStorage; } catch { return null; } };
function Card({ id, held, highlight, onClick, index, back = false, className = '', style }) {
  const card = id == null ? null : cardInfo(id);
  const picture = <img draggable="false" src={asset(back || !card ? 'cards/Card_Back.png' : `deck/${card.image}.png`)} alt={back || !card ? 'Face-down card' : card.name} />;
  if (!onClick) return <div className={`playing-card ${className}`} style={style}>{picture}{highlight && <span className="card-outline" aria-hidden="true" />}</div>;
  return <button className={`playing-card hold-card ${held ? 'is-held' : ''} ${highlight ? 'is-winning' : ''} ${className}`} onClick={onClick}
    aria-label={`${held ? 'Release' : 'Hold'} ${card.name}`} aria-pressed={held} data-card-index={index}>
    {picture}{highlight && <span className="card-outline" aria-hidden="true" />}
    <span className="hold-ribbon" aria-hidden="true">{held ? 'HOLD' : ''}</span>
  </button>;
}
function GameButton({ skin = 'gold', icon, children, className = '', ...props }) {
  return <button className={`game-button ${skin} ${className}`} {...props}>
    {icon && <img src={asset(icon)} alt="" draggable="false" />}<span>{children}</span>
  </button>;
}
function Dialog({ title, children, close, className = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const root = ref.current;
    root.querySelector('button,select,input,[tabindex="0"]')?.focus();
    const handle = event => {
      if (event.key === 'Escape') { event.preventDefault(); close(); }
      if (event.key === 'Tab') {
        const items = [...root.querySelectorAll('button,select,input,[tabindex="0"]')].filter(el => !el.disabled);
        const first = items[0], last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', handle);
    return () => { document.removeEventListener('keydown', handle); previous?.focus?.(); };
  }, [close]);
  return <div className="modal-shade" onClick={close}>
    <section className={`dialog ${className}`} role="dialog" aria-modal="true" aria-labelledby="dialog-title" ref={ref} onClick={e => e.stopPropagation()}>
      <header><h2 id="dialog-title">{title}</h2><button className="close-button" onClick={close}>Close</button></header>
      <div className="dialog-body">{children}</div>
    </section>
  </div>;
}
export function App() {
  const [game, setGame] = useState(() => loadGame(getStorage()));
  const [settings, setSettings] = useState(() => loadSettings(getStorage()));
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [auto, setAuto] = useState(null);
  const [autoRounds, setAutoRounds] = useState(10);
  const [stopOnWin, setStopOnWin] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const gameRef = useRef(game), busyRef = useRef(false), timer = useRef(null), stageRef = useRef(null), autoRef = useRef(auto);
  const close = useCallback(() => setModal(null), []);
  useEffect(() => { autoRef.current = auto; }, [auto]);
  useEffect(() => { setMusic(settings.music); return () => setMusic(false); }, [settings.music]);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    const handle = () => { if (document.hidden) { setAuto(null); setMusic(false); } else setMusic(settings.music); };
    document.addEventListener('visibilitychange', handle);
    return () => document.removeEventListener('visibilitychange', handle);
  }, [settings.music]);
  const changeSetting = (key, value) => setSettings(before => {
    const next = { ...before, [key]: value };
    if (!saveSettings(getStorage(), next)) setSaveFailed(true);
    return next;
  });
  const dispatch = useCallback(action => {
    const next = transition(gameRef.current, action);
    if (next !== gameRef.current) {
      gameRef.current = next; setGame(next);
      setSaveFailed(!saveGame(getStorage(), next));
    }
    return next;
  }, []);
  const animate = useCallback((action, sound = 'click') => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true);
    const next = dispatch(action);
    playSound(sound, settings.sound);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { busyRef.current = false; setBusy(false); }, settings.fast ? 100 : action.type === 'DEAL' || action.type === 'DRAW' ? 650 : 450);
    return next;
  }, [dispatch, settings.sound, settings.fast]);
  const primary = useCallback(() => {
    if (busyRef.current || modal) return;
    const state = gameRef.current;
    if (state.phase === 'hold') {
      const next = animate({ type: 'DRAW' }, 'flip');
      if (next?.pending) playSound('win', settings.sound);
    } else if (state.pending) animate({ type: 'COLLECT' }, 'cashout');
    else {
      const next = animate({ type: 'DEAL' }, 'deal');
      if (next?.phase === 'hold' && !settings.autoHold) dispatch({ type: 'HOLD-NONE' });
    }
  }, [animate, modal, settings.sound, settings.autoHold, dispatch]);
  useEffect(() => {
    const handler = event => {
      if (modal || autoRef.current || event.repeat || event.altKey || event.ctrlKey || event.metaKey || /INPUT|SELECT|TEXTAREA/.test(event.target.tagName)) return;
      if (/^[1-5]$/.test(event.key) && !busyRef.current) { event.preventDefault(); dispatch({ type: 'HOLD', index: Number(event.key) - 1 }); playSound('hold', settings.sound); }
      if (event.code === 'Space' && !event.target.closest('button')) { event.preventDefault(); if (!['double', 'double-result'].includes(gameRef.current.phase)) primary(); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [dispatch, primary, modal, settings.sound]);
  useEffect(() => {
    if (!auto || busy || modal) return;
    const { phase, balance, bet } = game;
    if (phase === 'double' || phase === 'double-result') { setAuto(null); return; }
    if (['ready', 'lose', 'collected'].includes(phase) && (auto.remaining <= 0 || balance < bet)) { setAuto(null); return; }
    const timeout = setTimeout(() => {
      if (phase === 'hold') animate({ type: 'DRAW' }, 'flip');
      else if (phase === 'win') {
        animate({ type: 'COLLECT' }, 'cashout');
        setAuto(previous => previous && (previous.stopOnWin ? null : { ...previous, remaining: previous.remaining - 1, inFlight: false }));
      } else {
        if (phase === 'lose' && auto.inFlight) {
          if (auto.remaining <= 1) { setAuto(null); return; }
          setAuto(previous => previous && { ...previous, remaining: previous.remaining - 1, inFlight: true });
        } else setAuto(previous => previous && { ...previous, inFlight: true });
        const next = animate({ type: 'DEAL' }, 'deal');
        if (next && !settings.autoHold) dispatch({ type: 'HOLD-NONE' });
      }
    }, settings.fast ? 140 : phase === 'hold' ? 850 : 650);
    return () => clearTimeout(timeout);
  }, [auto, busy, modal, game, animate, settings.fast, settings.autoHold, dispatch]);
  const open = name => { playSound('click', settings.sound); if (auto) setAuto(null); setModal(name); };
  const toggleHold = index => { if (busyRef.current || auto) return; dispatch({ type: 'HOLD', index }); playSound('hold', settings.sound); };
  const mainAction = () => {
    if (!settings.autoHold && ['ready', 'lose', 'collected'].includes(gameRef.current.phase)) {
      const next = animate({ type: 'DEAL' }, 'deal');
      if (next?.phase === 'hold') dispatch({ type: 'HOLD-NONE' });
    } else primary();
  };
  const beginDouble = half => animate({ type: 'DOUBLE', half }, 'double-deal');
  const guess = choice => {
    const next = animate({ type: 'GUESS', choice }, 'flip');
    if (next?.double?.outcome === 'win') playSound('double', settings.sound);
    else if (next?.double?.outcome === 'lose') playSound('lose', settings.sound);
  };
  const isDouble = ['double', 'double-result'].includes(game.phase);
  const canBet = ['ready', 'lose', 'collected'].includes(game.phase) && !auto && !busy;
  const isHolding = game.phase === 'hold';
  const title = busy ? isHolding ? 'Dealing…' : 'Revealing…' : isHolding ? <>Press <strong>HOLD</strong> or <strong>Change Card</strong></>
    : game.phase === 'win' ? game.result.name : game.phase === 'collected' ? `WIN ${money(game.collected)}`
    : game.phase === 'lose' ? 'Try your next hand' : 'Place your bet';
  return <main className="game-shell">
    <div className={`game-stage ${busy ? 'is-animating' : ''}`} ref={stageRef} data-phase={game.phase} aria-label="Video Poker game">
      <img className="game-logo" src={asset('logo.png')} alt="Video Poker" />
      <button className="menu-toggle" aria-label="Open game menu" onClick={() => open('menu')}><img src={asset('ui/265.png')} alt="" /></button>
      {!isDouble && <>
        <section className="paytable" aria-label="Paytable">
          {PAYTABLE.map((row, index) => <div key={row.key} className={`pay-row ${index === 0 ? 'royal' : index < 3 ? 'premium' : ''} ${game.result?.key === row.key ? 'pay-winner' : ''}`}>
            <span>{row.name}</span><span>{row.multiplier}x</span>
          </div>)}
        </section>
        <p className={`round-message ${['win', 'collected'].includes(game.phase) ? 'won' : ''}`} role="status" aria-live="polite">{title}</p>
        <section className={`hand ${isHolding ? 'can-hold' : ''}`} aria-label="Your five cards">
          {Array.from({ length: 5 }, (_, index) => {
            const id = game.hand[index], highlight = !isHolding && game.result?.winning.includes(index);
            return <div className={`hand-slot ${isHolding && game.held[index] ? 'selected' : ''} ${highlight ? 'highlight' : ''}`} key={index} style={{ '--card-index': index }}>
              {isHolding ? <Card id={id} index={index} held={game.held[index]} onClick={() => toggleHold(index)} />
                : <Card id={id} back={id == null} highlight={highlight} />}
            </div>;
          })}
        </section>
        {game.phase === 'win' && <div className="double-actions">
          <GameButton skin="blue" disabled={busy || !!auto || game.pending < 2} onClick={() => beginDouble(true)}>1/2 Double</GameButton>
          <GameButton skin="green" disabled={busy || !!auto} onClick={() => beginDouble(false)}>Double</GameButton>
        </div>}
        {game.phase === 'ready' && game.balance >= game.bet && <p className="table-note">54 cards · 2 wild Jokers</p>}
        {['ready', 'lose', 'collected'].includes(game.phase) && game.balance < game.bet && <button className="insufficient" onClick={() => open(game.balance < BETS[0] ? 'reset' : 'bet')}>
          {game.balance < BETS[0] ? 'Start a new session' : 'Choose a lower bet to continue'}
        </button>}
      </>}
      {isDouble && <>
        <div className="double-history"><span>History:</span><div>{game.double.history.slice(-5).map((id, i) => <Card key={i} id={id} />)}</div></div>
        <section className="double-board" aria-label="Double Up">
          <p className="double-prompt" role="status">{game.double.complete ? 'Clear poker! 32x' : game.double.outcome === 'lose' ? 'Better luck next time' : game.double.outcome === 'push' ? '7 — Push. Try again!' : game.double.outcome === 'win' ? 'You win!' : <>Guess <strong>7</strong> Big or Small</>}</p>
          <div className="double-stack">
            {game.phase === 'double' ? Array.from({ length: Math.max(1, 5 - game.double.wins) }, (_, i) => <Card key={i} back className="stack-card" style={{ '--stack-index': i }} />)
              : <Card id={game.double.last} className="revealed-card" />}
          </div>
          <div className="guess-buttons">
            <button aria-label="Guess Big, 8 through King" className="guess-big" onClick={() => guess('big')} disabled={busy || game.phase !== 'double'}>Big</button>
            <img src={asset('ui/361.png')} alt="7" />
            <button aria-label="Guess Small, Ace through 6" className="guess-small" onClick={() => guess('small')} disabled={busy || game.phase !== 'double'}>Small</button>
          </div>
          <p className="coefficient">COEFFICIENT: <strong>{2 ** game.double.wins}x</strong></p>
          {game.phase === 'double-result' && <GameButton skin={game.pending ? 'green' : 'blue'} className="continue-double" disabled={busy}
            onClick={() => animate({ type: 'CONTINUE' }, game.double.complete ? 'cashout' : 'click')}>
            {game.double.complete ? 'Collect win' : game.pending ? 'Continue' : 'Back to game'}
          </GameButton>}
        </section>
      </>}
      <div className="balance-bar">
        <span className="balance-label">Balance :</span><img src={asset('ui/341.png')} alt="" /><output aria-label="Balance">{money(game.balance)}</output>
        <span className="win-label">WIN : <output aria-label="Win">{money(game.pending)}</output></span>
      </div>
      {!isDouble ? <div className="controls">
        <GameButton skin="gray" className="bet-button" onClick={() => open('bet')} disabled={!canBet}>Bet<br /><b>{money(game.bet)}</b></GameButton>
        <GameButton skin={isHolding ? 'purple' : 'gold'} className="primary-button" onClick={mainAction}
          icon={isHolding ? 'ui/240.png' : undefined} disabled={busy || !!auto || !isHolding && !game.pending && game.balance < game.bet}>
          {isHolding ? 'Change' : game.pending ? 'Cash Out' : 'Deal'}
        </GameButton>
        <GameButton skin="gray" className="auto-button" icon="ui/252.png" onClick={() => auto ? setAuto(null) : open('auto')} disabled={busy && !auto || isHolding && !auto || !!game.pending && !auto}>
          {auto ? `Stop ${auto.remaining}` : 'Auto'}
        </GameButton>
      </div> : <div className="cashout-controls"><GameButton disabled={busy || !game.pending} onClick={() => animate({ type: 'COLLECT' }, 'cashout')}>Cash Out</GameButton></div>}
      <footer className="game-footer"><span>FUN PLAY</span><span>EN · #{String(game.round).padStart(6, '0')}</span></footer>
      <span className="sr-only" role="status">{announcement}</span>
      {modal && <Dialog title={{ menu: 'Game Menu', settings: 'Settings', rules: 'How to Play', history: 'Game History', bet: 'Select Bet', auto: 'Auto Play', reset: 'New Session' }[modal]} close={close}>
        {modal === 'menu' && <nav className="menu-list" aria-label="Game options">
          <button onClick={() => setModal('settings')}><img src={asset('ui/390.png')} alt="" />Settings</button>
          <button onClick={() => setModal('rules')}><img src={asset('ui/183.png')} alt="" />How to Play</button>
          <button onClick={() => setModal('history')}><img src={asset('ui/314.png')} alt="" />Game History</button>
          <button onClick={() => setModal('reset')}><img src={asset('ui/252.png')} alt="" />New Session</button>
        </nav>}
        {modal === 'bet' && <><p className="dialog-intro">Choose your bet per hand</p><div className="bet-options">{BETS.map(amount => <button key={amount} className={game.bet === amount ? 'active' : ''} disabled={game.balance < amount || !canBet}
          onClick={() => { dispatch({ type: 'BET', amount }); close(); playSound('click', settings.sound); }}>{money(amount)}</button>)}</div><p className="dialog-note">Balance: {money(game.balance)} coins</p></>}
        {modal === 'settings' && <div className="settings-list">
          <label>Language <select aria-label="Language" value="en" onChange={() => {}}><option value="en">English</option></select></label>
          {[['sound', 'Sound effects'], ['music', 'Background music'], ['autoHold', 'Suggested holds'], ['fast', 'Fast play']].map(([key, text]) => <label key={key}>{text}<input type="checkbox" checked={settings[key]} onChange={e => changeSetting(key, e.target.checked)} /></label>)}
          <p className="dialog-note">Your progress is saved on this device.{saveFailed && ' Saving is unavailable in this browser.'}</p>
        </div>}
        {modal === 'rules' && <div className="rules-copy">
          <h3>Make your best five-card hand</h3><p>Choose a bet and press Deal. Keep cards by pressing HOLD, then press Change to replace every unheld card once. The deck contains 52 playing cards and two wild Jokers.</p>
          <p>Jokers complete the highest paying hand. A single pair does not pay. Aces can be low (A–2–3–4–5) or high (10–J–Q–K–A).</p>
          <table><thead><tr><th>Hand</th><th>Payout</th></tr></thead><tbody>{PAYTABLE.map(p => <tr key={p.key}><td>{p.name}</td><td>{p.multiplier}x bet</td></tr>)}</tbody></table>
          <h3>Double Up</h3><p>Cash Out a win, or play Double. With 1/2 Double, half your win goes straight to your balance and the other half is at stake.</p>
          <p>Guess Big for 8 through King, or Small for Ace through 6. A correct guess doubles the amount at stake. A 7 is a push: keep your stake and guess again. An incorrect guess loses the amount at stake.</p>
          <p>Cash Out at any time between guesses. Five correct guesses clear the stack for 32x the starting stake. Double Up uses a separate 52-card deck.</p>
          <h3>Auto Play & controls</h3><p>Auto Play deals, holds suggested cards, changes, and collects wins. Set a round count and optionally stop after a winning hand. Press Stop to take control; finish any hand already dealt.</p>
          <p>Keyboard: 1–5 to hold cards; Space to deal, change or collect. Music and suggested holds can be changed in Settings.</p>
          <p className="dialog-note">Fun play with virtual coins. Coins have no cash value.</p>
        </div>}
        {modal === 'history' && <><div className="session-stats"><span>Hands <b>{game.stats.played}</b></span><span>Best win <b>{money(game.stats.bestWin)}</b></span><span>Returned <b>{money(game.stats.returned)}</b></span></div>
          {!game.history.length ? <p className="empty-history">Your completed hands will appear here.</p> : <ol className="history-list">{game.history.map(row => <li key={row.id}>
            <div className="history-summary"><span>#{String(row.id).padStart(6, '0')} · {PAYTABLE.find(p => p.key === row.key)?.name || 'No win'}</span><b>{money(row.returned)}</b></div>
            <div className="history-cards">{row.hand.map((id, i) => <Card key={i} id={id} />)}</div><span className="history-bet">Bet {money(row.bet)} · {new Date(row.at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
          </li>)}</ol>}</>}
        {modal === 'auto' && <div className="auto-settings"><p className="dialog-intro">Number of hands</p><div className="auto-counts">{[10, 25, 50, 100].map(n => <button key={n} className={autoRounds === n ? 'active' : ''} onClick={() => setAutoRounds(n)}>{n}</button>)}</div>
          <label>Stop after a winning hand<input type="checkbox" checked={stopOnWin} onChange={e => setStopOnWin(e.target.checked)} /></label>
          <p className="dialog-note">Uses the current bet of {money(game.bet)} coins. Auto Play stops if your balance is too low or you leave the tab.</p>
          <GameButton skin="green" disabled={!canBet || game.balance < game.bet} onClick={() => { setAuto({ remaining: autoRounds, stopOnWin, inFlight: false }); close(); }}>Start Auto Play</GameButton>
        </div>}
        {modal === 'reset' && <div className="reset-copy"><p>Start again with {money(INITIAL_BALANCE)} virtual coins?</p><p>Your current hand, balance and game history will be cleared.</p><GameButton skin="blue" onClick={close}>Keep playing</GameButton><GameButton onClick={() => { setAuto(null); dispatch({ type: 'RESET' }); close(); setAnnouncement('New session started.'); }}>Start new session</GameButton></div>}
      </Dialog>}
    </div>
  </main>;
}
