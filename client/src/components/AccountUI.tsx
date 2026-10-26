import { useEffect, useRef, useState } from 'react';
import { levelFromXp } from '../../../shared/src';
import {
  canLinkGoogle, deleteAccount, linkGoogle, logout, startEmailLogin, unlinkEmail, unlinkGoogle, verifyEmailLogin,
} from '../account';
import { Icon } from '../art';
import { toLatinDigits } from '../digits';
import { useT } from '../i18n';
import { profileLevel } from '../profile';
import { needServer, pushToast, useStore } from '../store';

/** Account section of the settings: how the progress is saved, link / unlink sign-in methods, sign out, delete. */
export function AccountSection() {
  const t = useT();
  const account = useStore((s) => s.account);
  const [deleting, setDeleting] = useState(false);
  if (!account) return <div className="acctbox"><span className="muted small">{t('acct.needServer')}</span></div>;
  const l = account.logins;
  const any = !!l.email || l.google;
  const confirmUnlink = (fn: () => Promise<void>) => {
    const last = (l.email ? 1 : 0) + (l.google ? 1 : 0) === 1;
    if (!last || confirm(t('acct.unlinkLast'))) void fn();
  };
  return (
    <div className="acctbox">
      <div className="acct-status">
        <Icon id={any ? 'confirm' : 'lock'} size={26} />
        <span>{l.email ? t('acct.savedWith', { who: l.email }) : l.google ? t('acct.linkedGoogle') : t('acct.guestNote')}</span>
      </div>
      <div className="acctline"><span className="muted small">{t('fr.myCode')}</span><span className="num small" dir="ltr" data-latin>{account.friendCode}</span></div>
      {l.email
        ? <button className="btn small" onClick={() => confirmUnlink(unlinkEmail)}>{t('acct.unlinkEmail')}</button>
        : <button className="btn primary" onClick={() => needServer('off.what.account', () => useStore.setState({ emailLogin: 'save' }))}>{t('acct.saveEmail')}</button>}
      {l.google
        ? <button className="btn small" onClick={() => confirmUnlink(unlinkGoogle)}>{t('acct.unlinkGoogle')}</button>
        : canLinkGoogle() && <button className="btn" onClick={() => needServer('off.what.google', () => void linkGoogle())}>{t('acct.linkGoogle')}</button>}
      <div className="acct-danger">
        <button className="btn small" disabled={!any} title={any ? '' : t('acct.logoutNeeds')} onClick={async () => { if (confirm(t('acct.logoutAsk'))) { if (await logout()) pushToast(t('acct.loggedOut'), 'good'); } }}>{t('acct.logout')}</button>
        <button className="btn small danger" onClick={() => setDeleting(true)}>{t('acct.delete')}</button>
      </div>
      {deleting && <DeleteDialog onClose={() => setDeleting(false)} />}
    </div>
  );
}

/** Account deletion: confirmed by typing the word. */
function DeleteDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const [word, setWord] = useState('');
  const [busy, setBusy] = useState(false);
  const ok = word.trim() === t('acct.deleteWord');
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal small" onClick={(e) => e.stopPropagation()} role="alertdialog" aria-modal="true" aria-label={t('acct.delete')}>
        <h3>{t('acct.delete')}</h3>
        <button className="mclose" onClick={onClose} aria-label={t('settings.close')}>✕</button>
        <div className="mscroll">
          <p className="dlg-text">{t('acct.deleteText', { word: t('acct.deleteWord') })}</p>
          <input className="dlg-input" value={word} onChange={(e) => setWord(e.target.value)} aria-label={t('acct.deleteWord')} />
        </div>
        <div className="row">
          <button className="btn danger" disabled={!ok || busy} onClick={async () => { setBusy(true); if (await deleteAccount()) { pushToast(t('acct.deleted'), 'good'); onClose(); } setBusy(false); }}>{t('acct.delete')}</button>
          <button className="btn" onClick={onClose}>{t('acct.stay')}</button>
        </div>
      </div>
    </div>
  );
}

/** Email sign-in in two steps: the email, then the 6-digit code (with a resend countdown). Used both to save the
 *  current profile and to come back to a profile from another phone. */
export function EmailLoginDialog() {
  const t = useT();
  const mode = useStore((s) => s.emailLogin);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [wait, setWait] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const codeRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (wait <= 0) return; const tm = setTimeout(() => setWait(wait - 1), 1000); return () => clearTimeout(tm); }, [wait]);
  useEffect(() => { if (step === 'code') codeRef.current?.focus(); }, [step]);
  if (!mode) return null;
  const close = () => { useStore.setState({ emailLogin: null }); setStep('email'); setCode(''); setErr(''); };
  const send = async () => {
    setBusy(true); setErr('');
    const r = await startEmailLogin(email);
    setBusy(false);
    if (r.ok) { setStep('code'); setWait(r.resendIn); return; }
    setErr(t('acct.err.' + r.error));
    if (r.error === 'rate') { setStep('code'); setWait(60); }
  };
  const verify = async (c = code) => {
    setBusy(true); setErr('');
    const r = await verifyEmailLogin(email, c);
    setBusy(false);
    if (r.ok) { pushToast(t(r.switched ? 'acct.welcomeBack' : 'acct.saved'), 'good'); close(); return; }
    setErr(r.error === 'wrong' ? t('acct.err.wrong', { n: r.triesLeft ?? 0 }) : t('acct.err.' + r.error));
  };
  return (
    <div className="overlay" onClick={close}>
      <div className="modal small email-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={t('acct.emailTitle')}>
        <h3>{t(mode === 'signin' ? 'acct.signinTitle' : 'acct.emailTitle')}</h3>
        <button className="mclose" onClick={close} aria-label={t('settings.close')}>✕</button>
        <div className="mscroll">
          {step === 'email' ? (
            <>
              <p className="dlg-text">{t(mode === 'signin' ? 'acct.signinText' : 'acct.emailText')}</p>
              <input className="dlg-input" dir="ltr" type="email" inputMode="email" autoComplete="email" value={email} placeholder="name@example.com"
                onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && email && send()} />
            </>
          ) : (
            <>
              <p className="dlg-text">{t('acct.codeText', { email })}</p>
              <input ref={codeRef} className="dlg-input code" dir="ltr" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} placeholder="••••••"
                onChange={(e) => { const c = toLatinDigits(e.target.value).replace(/\D/g, '').slice(0, 6); setCode(c); if (c.length === 6) void verify(c); }} />
              <p className="muted small">{t('acct.spam')}</p>
              <button className="btn small" disabled={wait > 0 || busy} onClick={send}>{wait > 0 ? t('acct.resendIn', { n: wait }) : t('acct.resend')}</button>
            </>
          )}
          {err && <p className="dlg-err">{err}</p>}
        </div>
        <div className="row">
          {step === 'email'
            ? <button className="btn primary" disabled={!email.includes('@') || busy} onClick={send}>{t('acct.sendCode')}</button>
            : <button className="btn primary" disabled={code.length !== 6 || busy} onClick={() => verify()}>{t('acct.verify')}</button>}
          {step === 'code' && <button className="btn" onClick={() => { setStep('email'); setErr(''); }}>{t('acct.changeEmail')}</button>}
        </div>
      </div>
    </div>
  );
}

/** "This email / Google account belongs to another profile: go to it?" with both profiles' level and rating. */
export function AccountSwitchDialog() {
  const t = useT();
  const sw = useStore((s) => s.accountSwitch);
  const profile = useStore((s) => s.profile);
  const linkedHere = useStore((s) => !!s.account?.linked);
  if (!sw) return null;
  const answer = (yes: boolean) => { sw.resolve(yes); useStore.setState({ accountSwitch: null }); };
  const o = sw.other;
  return (
    <div className="overlay">
      <div className="modal small" role="alertdialog" aria-modal="true" aria-label={t('acct.switchTitle')}>
        <h3>{t('acct.switchTitle')}</h3>
        <div className="mscroll">
          <p className="dlg-text">{o ? (() => {
            const [before, after] = t('acct.switchTo', { name: '\u0001', level: o.level, rating: o.rating }).split('\u0001');
            return <>{before}<b>{o.name}</b>{after}</>;
          })() : t('acct.switchConfirm')}</p>
          <p className="dlg-text muted">{t(linkedHere ? 'acct.switchLeaveLinked' : 'acct.switchLose', { level: profileLevel(profile) })}</p>
        </div>
        <div className="row">
          <button className="btn primary" onClick={() => answer(true)}>{t('acct.switchGo')}</button>
          <button className="btn" onClick={() => answer(false)}>{t('acct.stay')}</button>
        </div>
      </div>
    </div>
  );
}

const REMIND_KEY = 'gridrush.saveReminder.v1';
/** Once, after 5 games or level 5, a gentle nudge for a guest to save the progress. */
export function SaveReminder() {
  const t = useT();
  const account = useStore((s) => s.account);
  const profile = useStore((s) => s.profile);
  const screen = useStore((s) => s.screen);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (screen !== 'menu' || !account || account.linked) return;
    if (profile.stats.games < 5 && levelFromXp(profile.xp) < 5) return;
    try { if (localStorage.getItem(REMIND_KEY)) return; localStorage.setItem(REMIND_KEY, '1'); } catch { return; }
    setOpen(true);
  }, [screen, account, profile]);
  if (!open) return null;
  return (
    <div className="overlay" onClick={() => setOpen(false)}>
      <div className="modal small" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={t('acct.remindTitle')}>
        <h3>{t('acct.remindTitle')}</h3>
        <div className="mscroll"><p className="dlg-text">{t('acct.remindText')}</p></div>
        <div className="row">
          <button className="btn primary" onClick={() => { setOpen(false); useStore.setState({ emailLogin: 'save' }); }}>{t('acct.saveEmail')}</button>
          <button className="btn" onClick={() => setOpen(false)}>{t('acct.later')}</button>
        </div>
      </div>
    </div>
  );
}
