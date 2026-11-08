import React, { useEffect, useRef, useState } from 'react';

export const fmt = (n: number | undefined | null) => (n === undefined || n === null ? '-' : Number(n).toLocaleString('ko-KR'));
export const ymd = (k: string) => { const p = k.split('-'); return `${+p[1]}/${+p[2]}`; };
export const round1 = (n: number) => Math.round(n * 10) / 10;

const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** 0 → value 카운트업 */
export function useCountUp(value: number, ms = 900): number {
  const [v, setV] = useState(reduced() ? value : 0);
  const raf = useRef(0);
  useEffect(() => {
    if (reduced()) { setV(value); return; }
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms); const e = 1 - Math.pow(1 - p, 3);
      setV(Math.round(value * e));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [value, ms]);
  return v;
}

/** 마운트 후 너비가 차오르는 게이지 */
export function Gauge({ pct, tone = '', h = 6 }: { pct: number; tone?: '' | 'ok' | 'gold' | 'danger'; h?: number }) {
  const [w, setW] = useState(reduced() ? pct : 0);
  useEffect(() => { const id = setTimeout(() => setW(pct), 60); return () => clearTimeout(id); }, [pct]);
  return <div className="track" style={{ height: h }}><div className={`fill ${tone}`} style={{ width: `${Math.max(0, Math.min(100, w))}%` }} /></div>;
}

export function SystemWindow({ title, sub, gold = false, index = 0, children, className = '', dense = true }:
  { title: string; sub?: React.ReactNode; gold?: boolean; index?: number; children: React.ReactNode; className?: string; dense?: boolean }) {
  return (
    <section className={`sys ${gold ? 'gold' : ''} ${className}`} style={{ ['--i' as string]: index }}>
      <header className="sys-head relative z-10 flex items-center gap-2.5 px-3.5 py-2">
        <h2 className={`m-0 whitespace-nowrap font-display text-[.74rem] font-semibold uppercase tracking-[.2em] ${gold ? 'text-gold' : 'text-glow'}`}>{title}</h2>
        {sub && <span className="ml-auto min-w-0 truncate text-right text-[.72rem] text-muted">{sub}</span>}
      </header>
      <div className={`relative z-10 ${dense ? 'p-3.5' : 'p-4'}`}>{children}</div>
    </section>
  );
}

export function Tag({ children, tone = 'glow' }: { children: React.ReactNode; tone?: 'glow' | 'gold' | 'ok' | 'danger' }) {
  const c = { glow: 'border-line text-glow', gold: 'border-gold text-gold', ok: 'border-ok text-ok', danger: 'border-danger text-danger' }[tone];
  return <span className={`inline-block rounded-[1px] border px-1.5 py-px font-display text-[.66rem] font-semibold uppercase tracking-[.14em] ${c}`}>{children}</span>;
}

export function Kpi({ k, v, s, tone = '' }: { k: string; v: React.ReactNode; s?: React.ReactNode; tone?: '' | 'blue' | 'ok' | 'danger' }) {
  return <div className="kpi"><div className="k">{k}</div><div className={`v tnum ${tone}`}>{v}</div>{s && <div className="s">{s}</div>}</div>;
}
