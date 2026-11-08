// Engine.gs 의 toSnapshot() 결과와 1:1 대응
export type StatKey = 'VIT' | 'AGI' | 'REC' | 'CAR' | 'INT';

export interface Stat { key: StatKey; ko: string; src: string; xp: number; value: number }
export interface Quest { key: 'steps' | 'exercise' | 'sleep' | 'tasks'; name: string; value: number; target: number; unit: string; done: boolean }
export interface Task { id: string; title: string; list: string; completed: string; due: string | null; onTime: boolean }
export interface Breakdown { steps: number; stepsBonus: number; exercise: number; sleep: number; hrv: number; rhr: number; vo2: number; bodyComp: number; tasks: number; quest: number; questClear: number }
export interface Metrics { steps?: number; exercise?: number; sleep?: number; hrv?: number; rhr?: number; vo2?: number; weight?: number; bodyFat?: number; spo2?: number }
export interface Day { date: string; isToday: boolean; xp: number; breakdown: Breakdown; metrics: Metrics; quests: Quest[]; questClear: boolean; questCleared: number; notes: string[]; tasks: Task[] }
export interface HistoryDay { date: string; xp: number; questClear: boolean; hasData: boolean }
export interface Achievement { id: string; name: string; desc: string; cur: number; goal: number; done: boolean }
export interface Counters { steps10k: number; sleep7: number; tasks: number; vo2Records: number; questClears: number; bestStreak: number; daysLogged: number }
export interface Config { questClearBonus: number; questItemXp: number; statXpPerPoint: number; taskXp: number; stepsBonusAt: number; levelBase: number; levelStep: number; [k: string]: number | number[][] }

export interface Snapshot {
  generatedAt: string; today: string;
  totalXp: number; level: number; xpInLevel: number; xpNeed: number; rank: 'E' | 'D' | 'C' | 'B' | 'A' | 'S';
  stats: Stat[]; todayStatGain: Record<StatKey, number>;
  streak: number; bestStreak: number;
  day: Day | null; history: HistoryDay[]; achievements: Achievement[]; counters: Counters;
  recentTasks: Task[]; config: Config;
}

declare global {
  interface Window {
    __SNAPSHOT__?: Snapshot; __PREVIEW__?: boolean;
    google?: { script: { run: GoogleScriptRun } };
  }
}
export interface GoogleScriptRun {
  withSuccessHandler(fn: (s: Snapshot) => void): GoogleScriptRun;
  withFailureHandler(fn: (e: Error) => void): GoogleScriptRun;
  getSnapshot(): void; refreshSnapshot(): void;
}
