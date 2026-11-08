import React, { useEffect, useState } from 'react';
import type { Snapshot } from './types';
import { KpiStrip, StatusPanel, NarrativePanel, QuestPanel, StatsPanel, ChartPanel, LogPanel, TasksPanel, TitlesPanel, RulesPanel } from './components/panels';
import { fmt, ymd } from './components/ui';

type Tab = 'dashboard' | 'quest' | 'history' | 'rules';
const TABS: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' }, { id: 'quest', label: 'Quest' }, { id: 'history', label: 'History' }, { id: 'rules', label: 'Rules' }
];

function Clock() {
  const [t, setT] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setT(new Date()), 1000); return () => clearInterval(id); }, []);
  return <span className="tnum font-display text-[.8rem] text-muted">{t.toLocaleTimeString('ko-KR', { hour12: false })}</span>;
}

export default function App({ snapshot, onRefresh, busy }: { snapshot: Snapshot; onRefresh?: () => void; busy: boolean }) {
  const [tab, setTab] = useState<Tab>('dashboard');
  const s = snapshot;
  const when = new Date(s.generatedAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const i = parseInt(e.key, 10);
      if (i >= 1 && i <= TABS.length) setTab(TABS[i - 1].id);
      if ((e.key === 'r' || e.key === 'R') && onRefresh && !busy) onRefresh();
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [onRefresh, busy]);

  return (
    <div className="flex min-h-full flex-col">
      {/* 상단 바: 브랜드 · 숫자 탭 · 시계 */}
      <header className="sticky top-0 z-20 border-b border-glow/15 bg-bg/90 backdrop-blur" style={{ paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))', paddingRight: 'max(16px, env(safe-area-inset-right, 0px))' }}>
        <div className="mx-auto flex max-w-[1440px] items-center gap-4">
          <div className="glow-text whitespace-nowrap font-display text-[1rem] font-bold uppercase tracking-[.24em] text-glow">⟡ Life OS</div>
          <nav className="flex items-center" aria-label="섹션">
            {TABS.map((t, i) => <button key={t.id} type="button" className={`tab ${tab === t.id ? 'on' : ''}`} onClick={() => setTab(t.id)} aria-current={tab === t.id ? 'page' : undefined}><span className="n">{i + 1}</span>{t.label}</button>)}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            {window.__PREVIEW__ && <span className="border border-danger px-2 py-px font-display text-[.66rem] font-semibold uppercase tracking-[.12em] text-danger">Preview · 할 일은 예시 데이터</span>}
            {onRefresh && <button className="btn" type="button" disabled={busy} onClick={onRefresh}>{busy ? 'Syncing…' : 'Sync'}</button>}
            <Clock />
          </div>
        </div>
      </header>

      <main className="flex-1" style={{ paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))', paddingRight: 'max(16px, env(safe-area-inset-right, 0px))' }}>
        <div className="mx-auto grid max-w-[1440px] gap-3 py-3">
          {tab === 'dashboard' && (
            <>
              <section className="sys" style={{ ['--i' as string]: 0 }}>
                <header className="sys-head relative z-10 flex items-center px-3.5 py-2"><h2 className="m-0 font-display text-[.74rem] font-semibold uppercase tracking-[.2em] text-glow">Executive Summary</h2><span className="ml-auto text-[.72rem] text-muted">{s.today} · 동기화 {when}</span></header>
                <div className="relative z-10 p-3.5"><KpiStrip s={s} /></div>
              </section>
              <div className="grid grid-cols-12 items-start gap-3">
                <div className="col-span-4 grid min-w-0 gap-3"><StatusPanel s={s} index={1} /><StatsPanel s={s} index={4} /></div>
                <div className="col-span-5 grid min-w-0 gap-3"><QuestPanel s={s} index={2} /><ChartPanel s={s} index={5} /></div>
                <div className="col-span-3 grid min-w-0 gap-3"><NarrativePanel s={s} index={3} /><LogPanel s={s} index={6} /><TasksPanel s={s} index={7} limit={6} /></div>
              </div>
              <TitlesPanel s={s} index={8} />
            </>
          )}
          {tab === 'quest' && (
            <div className="grid grid-cols-12 items-start gap-3">
              <div className="col-span-7 grid min-w-0 gap-3"><QuestPanel s={s} index={0} /><LogPanel s={s} index={2} /></div>
              <div className="col-span-5 grid min-w-0 gap-3"><NarrativePanel s={s} index={1} /><StatsPanel s={s} index={3} /></div>
            </div>
          )}
          {tab === 'history' && (
            <div className="grid grid-cols-12 items-start gap-3">
              <div className="col-span-8 grid min-w-0 gap-3"><ChartPanel s={s} index={0} tall /><TitlesPanel s={s} index={2} cols="grid-cols-5" /></div>
              <div className="col-span-4 grid min-w-0 gap-3"><TasksPanel s={s} index={1} limit={12} /><StatusPanel s={s} index={3} /></div>
            </div>
          )}
          {tab === 'rules' && <RulesPanel s={s} index={0} />}
        </div>
      </main>

      {/* 하단 상태바 */}
      <footer className="statusbar sticky bottom-0 z-20" style={{ paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))', paddingRight: 'max(16px, env(safe-area-inset-right, 0px))' }}>
        <div className="mx-auto flex max-w-[1440px] items-center gap-5 py-1.5">
          <span><span className="dot" />life-os v0.3.0</span>
          <span>health_log <span className="text-fg">{s.day ? ymd(s.day.date) : '-'}</span></span>
          <span>tasks_log <span className="text-fg">{fmt(s.counters.tasks)}</span></span>
          <span>xp_log <span className="text-fg">{s.counters.daysLogged}일</span></span>
          <span>trigger <span className="text-fg">23:30 KST</span></span>
          <span className="ml-auto"><span className="kbd">1</span>–<span className="kbd">4</span> tabs · <span className="kbd">R</span> sync</span>
        </div>
      </footer>
    </div>
  );
}
