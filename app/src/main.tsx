import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import App from './App';
import type { Snapshot } from './types';

function Root() {
  const [snap, setSnap] = useState<Snapshot | null>(window.__SNAPSHOT__ ?? null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const gas = typeof window.google !== 'undefined' ? window.google.script.run : null;

  useEffect(() => {
    if (snap) return;
    if (!gas) { setErr('데이터 소스가 없습니다.'); return; }
    gas.withSuccessHandler(setSnap).withFailureHandler(e => setErr(`불러오기 실패: ${e.message}`)).getSnapshot();
  }, []);

  const refresh = gas ? () => { setBusy(true); gas.withSuccessHandler(s => { setSnap(s); setBusy(false); }).withFailureHandler(e => { setErr(e.message); setBusy(false); }).refreshSnapshot(); } : undefined;

  if (!snap) return <div className="glow-text py-20 text-center font-display text-base font-semibold tracking-[.22em] text-glow">{err ?? 'SYSTEM LOADING…'}</div>;
  return <App snapshot={snap} onRefresh={refresh} busy={busy} />;
}

createRoot(document.getElementById('root')!).render(<Root />);
