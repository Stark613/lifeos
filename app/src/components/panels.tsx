import React, { useState } from 'react';
import type { Snapshot, HistoryDay } from '../types';
import { SystemWindow, Gauge, Tag, Kpi, useCountUp, fmt, ymd, round1 } from './ui';

const RANK_KO: Record<Snapshot['rank'], string> = { E: 'E급 헌터', D: 'D급 헌터', C: 'C급 헌터', B: 'B급 헌터', A: 'A급 헌터', S: 'S급 헌터' };
export const titleOf = (s: Snapshot) => { const d = s.achievements.filter(a => a.done); return d.length ? d[d.length - 1].name : '각성자'; };

// ───────── 상단 KPI 띄 ─────────
export function KpiStrip({ s }: { s: Snapshot }) {
  const d = s.day;
  const avg30 = Math.round(s.history.reduce((a, h) => a + h.xp, 0) / 30);
  const qc = d ? d.questCleared : 0, qn = d ? d.quests.length : 4;
  const firstMiss = d?.quests.find(q => !q.done);
  const todayXp = d && d.isToday ? d.xp : 0;
  return (
    <div className="grid grid-cols-5 gap-2.5">
      <Kpi k="Level" v={<>{s.level} <span className="text-[.95rem] text-muted">· {RANK_KO[s.rank]}</span></>} s={`다음 레벨까지 ${fmt(s.xpNeed - s.xpInLevel)} XP · ${Math.round(100 * s.xpInLevel / s.xpNeed)}%`} />
      <Kpi k="Today XP" v={d && d.isToday ? `+${fmt(todayXp)}` : '대기'} tone={d && d.isToday ? (todayXp >= avg30 ? 'ok' : '') : 'blue'} s={`30일 평균 ${fmt(avg30)} · 누적 ${fmt(s.totalXp)}`} />
      <Kpi k="Daily Quest" v={`${qc} / ${qn}`} tone={d?.questClear ? 'ok' : qc === 0 ? 'danger' : ''} s={d?.questClear ? `올클리어 +${s.config.questClearBonus} XP` : firstMiss ? `${firstMiss.name} ${firstMiss.key === 'sleep' ? round1(firstMiss.value) : fmt(firstMiss.value)} / ${fmt(firstMiss.target)} ${firstMiss.unit}` : '기록 없음'} />
      <Kpi k="Streak" v={`${s.streak}일`} tone={s.streak > 0 ? 'ok' : ''} s={`최고 ${s.bestStreak}일 · 올클리어 ${s.counters.questClears}회`} />
      <Kpi k="Sources" v={<span className="text-[1rem]"><span className="dot" />health_log <span className={`dot ${s.counters.tasks ? '' : 'off'}`} style={{ marginLeft: 10 }} />tasks</span>} tone="blue" s={`마지막 기록 ${d ? ymd(d.date) : '-'} · 할 일 ${fmt(s.counters.tasks)}개 누적`} />
    </div>
  );
}

// ───────── STATUS (정체성 + XP) ─────────
export function StatusPanel({ s, index }: { s: Snapshot; index: number }) {
  const lv = useCountUp(s.level, 800);
  const pct = Math.min(100, Math.round((100 * s.xpInLevel) / s.xpNeed));
  const first = new Date(s.today); first.setDate(first.getDate() - 1);
  return (
    <SystemWindow title="Status" index={index} sub={s.day?.isToday ? '오늘 기록 반영됨' : '오늘 기록 대기 중'}>
      <div className="grid grid-cols-[auto_1fr] items-center gap-4">
        <div className="border-r border-glow/15 pr-4 text-center">
          <div className="font-display text-[.66rem] font-semibold tracking-[.3em] text-muted">LEVEL</div>
          <div className="lv-num tnum font-display text-[3.4rem] font-bold leading-none text-white">{lv}</div>
          <div className="gold-text mt-1 inline-grid h-6 w-6 place-items-center border border-gold font-display text-[.85rem] font-bold text-gold">{s.rank}</div>
        </div>
        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[.8rem] text-muted">
          <dt className="font-display uppercase tracking-[.12em]">Designation</dt><dd className="m-0 font-ko text-[.95rem] text-gold">플레이어</dd>
          <dt className="font-display uppercase tracking-[.12em]">Title</dt><dd className="m-0 text-fg">{titleOf(s)}</dd>
          <dt className="font-display uppercase tracking-[.12em]">Rank</dt><dd className="m-0 text-fg">{RANK_KO[s.rank]}</dd>
          <dt className="font-display uppercase tracking-[.12em]">Conscious</dt><dd className="m-0 text-fg">{s.counters.daysLogged}일 기록</dd>
          <dt className="font-display uppercase tracking-[.12em]">Source</dt><dd className="m-0 text-fg">health_log · Google Tasks</dd>
        </dl>
      </div>
      <div className="mt-3 grid gap-1">
        <div className="tnum flex justify-between font-display text-[.72rem] font-semibold tracking-[.12em] text-muted"><span>XP</span><span>{fmt(s.xpInLevel)} / {fmt(s.xpNeed)}</span></div>
        <Gauge pct={pct} h={8} />
      </div>
    </SystemWindow>
  );
}

// ───────── 1인칭 서술 ─────────
export function narrate(s: Snapshot): string[] {
  const d = s.day; const out: string[] = [];
  out.push(`나는 ${s.counters.daysLogged}일을 기록했고 ${fmt(s.totalXp)} XP를 앓았다.`);
  if (d && d.isToday) {
    const m = d.metrics;
    if (m.steps !== undefined) out.push(`오늘 ${fmt(m.steps)}걸음을 걸었다${m.steps >= s.config.stepsBonusAt ? '. 1만 보를 넘겼다' : ''}.`);
    if (m.sleep !== undefined) out.push(m.sleep >= 7 ? `${round1(m.sleep)}시간 잤다. 회복했다.` : `${round1(m.sleep)}시간밖에 못 잤다. 기억해 둔다.`);
    if (d.tasks.length) out.push(`할 일 ${d.tasks.length}개를 끝냈다${d.tasks.some(t => t.onTime) ? '. 마감은 지켰다' : ''}.`);
    if (d.notes.length) out.push(d.notes.join(' · ') + '.');
    out.push(d.questClear ? `일일 퀘스트를 전부 완료했다. 연속 ${s.streak}일.` : `일일 퀘스트 ${d.questCleared}/${d.quests.length}. ${d.quests.filter(q => !q.done).map(q => q.name).join(', ')}이 남았다.`);
  } else out.push('오늘 기록은 아직 들어오지 않았다. 22:00에 health_log가 쓰인다.');
  out.push(`나는 아직 레벨 ${s.level}이다. 다음까지 ${fmt(s.xpNeed - s.xpInLevel)} XP.`);
  return out;
}

export function NarrativePanel({ s, index }: { s: Snapshot; index: number }) {
  const lines = narrate(s);
  return (
    <SystemWindow title="What I Remember" index={index} sub={`${s.counters.questClears}번 올클리어 · ${s.counters.steps10k}번 1만 보`}>
      <div className="say">{lines.map((l, i) => <div key={i} className={i === lines.length - 1 ? 'last' : ''}>{l}</div>)}</div>
    </SystemWindow>
  );
}

// ───────── DAILY QUEST ─────────
export function QuestPanel({ s, index }: { s: Snapshot; index: number }) {
  const d = s.day;
  if (!d) return <SystemWindow title="Daily Quest" index={index}><p className="m-0 text-muted">아직 기록이 없습니다.</p></SystemWindow>;
  const cfg = s.config;
  return (
    <SystemWindow title="Daily Quest" index={index} gold={d.questClear} sub={`${d.isToday ? '오늘' : ymd(d.date)} · ${d.questCleared}/${d.quests.length} 달성 · 항목당 +${cfg.questItemXp}`}>
      <h3 className="m-0 mb-3 font-ko text-[1.1rem] leading-tight tracking-wide text-fg">일일 퀘스트 : 준비는 되었는가?</h3>
      <div className="grid gap-2.5">
        {d.quests.map(q => {
          const pct = Math.min(100, Math.round((100 * q.value) / q.target));
          const v = q.key === 'sleep' ? round1(q.value) : fmt(q.value);
          return (
            <div key={q.key} className="grid grid-cols-[88px_1fr_auto] items-center gap-x-3">
              <span className="flex items-center gap-1.5 text-[.84rem] font-medium">{q.name}{q.done && <Tag tone="ok">완료</Tag>}</span>
              <Gauge pct={pct} tone={q.done ? 'ok' : pct < 34 ? 'danger' : ''} h={5} />
              <span className="tnum min-w-[150px] text-right font-display text-[.9rem] font-semibold text-muted"><b className="text-fg">{v}</b> / {fmt(q.target)} {q.unit}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 border-t border-dashed border-glow/20 pt-2 text-[.78rem] text-muted">
        {d.questClear ? <span className="gold-text font-ko text-[.95rem] text-gold">QUEST CLEAR — 보상 +{cfg.questClearBonus} XP</span>
          : <span><span className="text-danger">경고:</span> 미완료 시 연속 기록 초기화 · 전부 달성 시 +{cfg.questClearBonus} XP</span>}
      </div>
    </SystemWindow>
  );
}

// ───────── STATS ─────────
export function StatsPanel({ s, index }: { s: Snapshot; index: number }) {
  const max = Math.max(...s.stats.map(x => x.value));
  return (
    <SystemWindow title="Stats" index={index} sub={`${s.config.statXpPerPoint} XP = +1`}>
      <div className="grid gap-2">
        {s.stats.map(x => {
          const g = s.todayStatGain[x.key] || 0;
          return (
            <div key={x.key} className="grid grid-cols-[44px_1fr_auto] items-center gap-2.5">
              <span className="font-display text-[.84rem] font-bold tracking-[.1em] text-glow">{x.key}<small className="block font-body text-[.64rem] font-normal tracking-normal text-dim">{x.ko}</small></span>
              <Gauge pct={Math.round((100 * x.value) / max)} h={5} />
              <span className="flex items-baseline gap-1.5">
                <span className="tnum min-w-[2.2ch] text-right font-display text-[1.1rem] font-bold">{x.value}</span>
                <span className={`tnum min-w-[3.4ch] text-right font-display text-[.72rem] font-semibold ${g ? 'text-ok' : 'text-dim'}`}>{g ? `+${g}` : '—'}</span>
              </span>
            </div>
          );
        })}
      </div>
      <p className="m-0 mt-2.5 text-[.7rem] leading-relaxed text-dim">{s.stats.map(x => `${x.ko}←${x.src}`).join(' · ')}</p>
    </SystemWindow>
  );
}

// ───────── 30일 XP 차트 ─────────
export function ChartPanel({ s, index, tall = false }: { s: Snapshot; index: number; tall?: boolean }) {
  const H = s.history; const W = 720, Hh = tall ? 220 : 150, padL = 32, padR = 6, padT = 8, padB = 20;
  const innerW = W - padL - padR, innerH = Hh - padT - padB;
  const max = Math.max(50, ...H.map(h => h.xp));
  const step = max > 400 ? 200 : max > 200 ? 100 : 50;
  const top = Math.ceil(max / step) * step;
  const bw = innerW / H.length, gap = 2;
  const y = (v: number) => padT + innerH - (innerH * v) / top;
  const [hot, setHot] = useState<{ i: number; x: number } | null>(null);
  const ticks: number[] = []; for (let v = 0; v <= top; v += step) ticks.push(v);
  const total = H.reduce((a, h) => a + h.xp, 0);
  const avg = Math.round(total / H.length);
  const hotDay: HistoryDay | null = hot ? H[hot.i] : null;
  return (
    <SystemWindow title="XP · 30 Days" index={index} sub={`합계 ${fmt(total)} · 일평균 ${fmt(avg)} XP`}>
      <div className="relative" onMouseLeave={() => setHot(null)}>
        <svg className="chart block w-full" viewBox={`0 0 ${W} ${Hh}`} role="img" aria-label="최근 30일 일별 XP">
          <g className="grid">{ticks.map(v => <line key={v} x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} />)}</g>
          <line x1={padL} x2={W - padR} y1={y(avg)} y2={y(avg)} stroke="rgba(242,193,78,.45)" strokeDasharray="3 3" />
          <g>{ticks.map(v => <text key={v} x={padL - 5} y={y(v) + 4} textAnchor="end">{v}</text>)}</g>
          <g>
            {H.map((h, i) => {
              const x = padL + i * bw + gap / 2, w = Math.max(2, bw - gap);
              const hgt = Math.max(h.xp > 0 ? 3 : 2, (innerH * h.xp) / top);
              const cls = `bar${h.questClear ? ' clear' : ''}${!h.hasData ? ' empty' : ''}${hot?.i === i ? ' hot' : ''}`;
              return (
                <g key={h.date} onMouseEnter={() => setHot({ i, x: padL + i * bw + bw / 2 })}>
                  <rect x={padL + i * bw} y={padT} width={bw} height={innerH} fill="transparent" />
                  <rect className={cls} x={x} y={y(0) - hgt} width={w} height={hgt} rx={2} />
                  {(i % 7 === 0 || i === H.length - 1) && <text x={padL + i * bw + bw / 2} y={Hh - 5} textAnchor="middle">{ymd(h.date)}</text>}
                </g>
              );
            })}
          </g>
        </svg>
        {hot && hotDay && (
          <div className="pointer-events-none absolute top-0 -translate-x-1/2 whitespace-nowrap border border-line bg-bg-2 px-2 py-1 text-[.74rem]" style={{ left: `${(hot.x / W) * 100}%` }}>
            {ymd(hotDay.date)} · <b className="font-display text-[.95rem]">{fmt(hotDay.xp)}</b> XP{hotDay.questClear ? ' · ◆ 올클리어' : ''}{!hotDay.hasData ? ' · 기록 없음' : ''}
          </div>
        )}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-4 text-[.7rem] text-dim">
        <span><i className="mr-1.5 inline-block h-2 w-2 bg-line align-[-1px]" />일별 XP</span>
        <span><i className="mr-1.5 inline-block h-2 w-2 bg-gold align-[-1px]" />일일 퀘스트 올클리어</span>
        <span><i className="mr-1.5 inline-block h-0 w-3 border-t border-dashed border-gold align-[3px]" />30일 평균</span>
      </div>
    </SystemWindow>
  );
}

// ───────── SYSTEM LOG ─────────
export function LogPanel({ s, index }: { s: Snapshot; index: number }) {
  const d = s.day;
  if (!d) return <SystemWindow title="System Log" index={index}><p className="m-0 text-muted">기록 없음</p></SystemWindow>;
  const b = d.breakdown, m = d.metrics;
  const items: [string, number][] = [
    [`걸음 ${fmt(m.steps)}${b.stepsBonus ? ' · 1만 보 보너스' : ''}`, b.steps + b.stepsBonus],
    [`운동 ${m.exercise !== undefined ? m.exercise + '분' : '기록 없음'}`, b.exercise],
    [`수면 ${m.sleep !== undefined ? round1(m.sleep) + '시간' : '기록 없음'}`, b.sleep],
    [`HRV ${m.hrv !== undefined ? round1(m.hrv) : '-'}${b.hrv ? ' · 평균 초과' : ''}`, b.hrv],
    [`안정 심박 ${m.rhr ?? '-'}${b.rhr ? ' · 평균 이하' : ''}`, b.rhr],
    [`VO2 Max ${m.vo2 ?? '-'}${b.vo2 ? ' · 신기록' : ''}`, b.vo2],
    [`할 일 ${d.tasks.length}개 완료`, b.tasks],
    [`일일 퀘스트 ${d.questCleared}/${d.quests.length}`, b.quest + b.questClear],
  ];
  if (b.bodyComp) items.push(['체성분 새 측정', b.bodyComp]);
  return (
    <SystemWindow title="System Log" index={index} sub={`${d.isToday ? '오늘' : ymd(d.date)} 합계 +${fmt(d.xp)} XP`}>
      <ul className="m-0 grid list-none gap-1 p-0 text-[.8rem]">
        {items.map(([n, x]) => (
          <li key={n} className="flex justify-between gap-2 border-l-2 border-line pl-2">
            <span className="text-muted"><span className="mr-1.5 font-display text-[.66rem] font-semibold tracking-[.14em] text-glow">[시스템]</span>{n}</span>
            <span className={`tnum whitespace-nowrap font-display text-[.88rem] font-bold ${x ? 'text-ok' : 'text-dim'}`}>{x ? `+${x}` : '0'} XP</span>
          </li>
        ))}
      </ul>
    </SystemWindow>
  );
}

// ───────── TASKS ─────────
export function TasksPanel({ s, index, limit = 8 }: { s: Snapshot; index: number; limit?: number }) {
  const list = s.recentTasks.slice(0, limit);
  return (
    <SystemWindow title="Tasks" index={index} sub={`누적 ${fmt(s.counters.tasks)}개 · 1개 ${s.config.taskXp} XP`}>
      {list.length ? (
        <ul className="m-0 grid list-none gap-1 p-0 text-[.8rem]">
          {list.map(t => (
            <li key={t.id} className="grid min-w-0 grid-cols-[1fr_auto] items-baseline gap-2">
              <span className="truncate" title={t.title}><span className="mr-1.5 text-gold">◆</span>{t.title}</span>
              <span className={`whitespace-nowrap font-display text-[.7rem] font-medium tracking-[.04em] ${t.onTime ? 'text-ok' : 'text-dim'}`}>{ymd(t.completed)}{t.onTime ? ' · 마감 준수' : ''}</span>
            </li>
          ))}
        </ul>
      ) : <p className="m-0 text-[.8rem] text-muted">완료된 할 일이 아직 없습니다. Google Tasks 에서 완료하면 +{s.config.taskXp} XP.</p>}
    </SystemWindow>
  );
}

// ───────── TITLES ─────────
export function TitlesPanel({ s, index, cols = 'grid-cols-9' }: { s: Snapshot; index: number; cols?: string }) {
  const n = s.achievements.filter(a => a.done).length;
  return (
    <SystemWindow title="Titles" index={index} sub={`${n} / ${s.achievements.length} 획득`}>
      <div className={`grid gap-2 ${cols}`}>
        {s.achievements.map(a => (
          <div key={a.id} className={`grid min-w-0 gap-0.5 border px-2.5 py-2 ${a.done ? 'border-gold/70 bg-gold/5' : 'border-glow/15'}`}>
            <span className={`font-ko text-[.92rem] leading-tight ${a.done ? 'gold-text text-gold' : 'text-fg'}`}>{a.name}</span>
            <span className="text-[.68rem] text-dim">{a.desc}</span>
            <span className={`tnum font-display text-[.7rem] font-semibold ${a.done ? 'text-gold' : 'text-muted'}`}>{a.done ? '획득' : `${fmt(Math.min(a.cur, a.goal))} / ${fmt(a.goal)}`}</span>
          </div>
        ))}
      </div>
    </SystemWindow>
  );
}

// ───────── RULES (config) ─────────
const RULE_DESC: Record<string, string> = {
  stepsPerXp: '걸음 → XP (N걸음당 1)', stepsXpCap: '걸음 XP 하루 상한', stepsBonusAt: '걸음 보너스 기준', stepsBonus: '걸음 보너스 XP',
  exerciseXpPerMin: '운동 1분당 XP', exerciseXpCap: '운동 XP 하루 상한', sleepTiers: '수면 구간 [시간, XP]', hrvAboveAvgXp: 'HRV 30일 평균 초과',
  rhrBelowAvgXp: '안정 심박 평균 이하', vo2RecordXp: 'VO2 Max 신기록', bodyCompLogXp: '체성분 새 측정',
  taskXp: '할 일 1개 완료', taskOnTimeBonus: '마감 준수 보너스', taskXpCap: '할 일 XP 하루 상한',
  questSteps: '퀘스트: 걸음', questExerciseMin: '퀘스트: 운동(분)', questSleepHours: '퀘스트: 수면(시간)', questTasks: '퀘스트: 할 일 개수',
  questItemXp: '퀘스트 항목당 XP', questClearBonus: '올클리어 보너스', levelBase: '레벨업 base', levelStep: '레벨업 step', statXpPerPoint: '스탯 1당 XP', statBase: '스탯 기본치'
};
export function RulesPanel({ s, index }: { s: Snapshot; index: number }) {
  const keys = Object.keys(RULE_DESC).filter(k => k in s.config);
  return (
    <SystemWindow title="Rules" index={index} sub="config 시트에서 수정 → 다음 동기화에 반영">
      <div className="grid grid-cols-3 gap-x-6 gap-y-1 text-[.8rem]">
        {keys.map(k => <div key={k} className="flex justify-between gap-3 border-b border-glow/10 py-1"><span className="text-muted">{RULE_DESC[k]}<span className="ml-1.5 font-display text-[.66rem] text-dim">{k}</span></span><span className="tnum font-display font-semibold text-gold">{JSON.stringify(s.config[k])}</span></div>)}
      </div>
      <p className="m-0 mt-3 text-[.74rem] text-dim">레벨업 필요 XP = {s.config.levelBase} + {s.config.levelStep} × 레벨 · 랭크 E(1) D(10) C(20) B(30) A(45) S(60)</p>
    </SystemWindow>
  );
}
