/**
 * Engine.gs — Life OS 순수 계산 엔진
 * Apps Script 와 Node 양쪽에서 동일하게 동작한다. (Google 서비스 호출 없음)
 *
 * 입력: health_log 행(헤더 포함) + 완료된 Google Tasks 목록 + 설정
 * 출력: 일별 XP 내역, 레벨/랭크/스탯, 일일 퀘스트, 연속 기록, 칭호
 */
var LifeOS = (function () {
  'use strict';

  // ───────────────────────── 설정 기본값 (config 시트에서 덮어씀) ─────────────────────────
  var DEFAULT_CONFIG = {
    // 체력 — 걸음
    stepsPerXp: 100,          // 100걸음 = 1 XP
    stepsXpCap: 150,          // 하루 최대 150 XP (15,000걸음)
    stepsBonusAt: 10000,      // 이 이상이면 보너스
    stepsBonus: 30,
    // 민첩 — 운동 시간(분)
    exerciseXpPerMin: 2,
    exerciseXpCap: 120,
    // 회복 — 수면(시간), HRV
    sleepTiers: [[7, 60], [6, 40], [5, 20]],   // [최소 시간, XP] 위에서부터 첫 매치
    hrvAboveAvgXp: 15,        // 최근 30일 평균 초과 시
    // 심폐 — 안정 심박, VO2 Max
    rhrBelowAvgXp: 10,        // 최근 30일 평균 이하 시
    vo2RecordXp: 50,          // 개인 최고 기록 갱신 시
    bodyCompLogXp: 20,        // 체중/체지방 새 측정값 기록 시
    // 지능 — Google Tasks
    taskXp: 20,
    taskOnTimeBonus: 10,      // 마감일 이전/당일 완료 시
    taskXpCap: 200,
    // 일일 퀘스트
    questSteps: 8000,
    questExerciseMin: 20,
    questSleepHours: 7,
    questTasks: 3,
    questItemXp: 15,          // 항목 하나 달성마다
    questClearBonus: 100,     // 전부 달성 시
    // 레벨: 다음 레벨까지 필요 XP = levelBase + levelStep * 현재레벨
    levelBase: 50,
    levelStep: 50,
    // 스탯: statXpPerPoint XP 마다 스탯 +1 (기본치 10)
    statXpPerPoint: 100,
    statBase: 10
  };

  var RANKS = [
    [60, 'S'], [45, 'A'], [30, 'B'], [20, 'C'], [10, 'D'], [1, 'E']
  ];

  var STAT_DEFS = [
    { key: 'VIT', ko: '체력', src: '걸음 수' },
    { key: 'AGI', ko: '민첩', src: '운동 시간' },
    { key: 'REC', ko: '회복', src: '수면 · HRV' },
    { key: 'CAR', ko: '심폐', src: '안정 심박 · VO2 Max' },
    { key: 'INT', ko: '지능', src: 'Google Tasks 완료' }
  ];

  // ───────────────────────── 유틸 ─────────────────────────
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function dateKey(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function keyToDate(k) { var p = k.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function addDays(k, n) { var d = keyToDate(k); d.setDate(d.getDate() + n); return dateKey(d); }
  function num(v) {
    if (v === null || v === undefined || v === '') return null;
    var n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
    return isNaN(n) ? null : n;
  }
  function round1(n) { return Math.round(n * 10) / 10; }

  /** "2026. 6. 7 오후 2:27:08", Date, 시트 일련번호, ISO 문자열 모두 처리 */
  function parseTimestamp(v) {
    if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
    if (typeof v === 'number') {
      var u = new Date(Math.round((v - 25569) * 86400000));
      return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate(), u.getUTCHours(), u.getUTCMinutes(), u.getUTCSeconds());
    }
    var s = String(v || '').trim();
    if (!s) return null;
    var m = s.match(/^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.?(?:\s+(오전|오후|AM|PM)?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?)?/i);
    if (m) {
      var h = m[5] ? parseInt(m[5], 10) : 0;
      if (m[4]) {
        if (/오후|PM/i.test(m[4]) && h < 12) h += 12;
        if (/오전|AM/i.test(m[4]) && h === 12) h = 0;
      }
      return new Date(+m[1], +m[2] - 1, +m[3], h, m[6] ? +m[6] : 0, m[7] ? +m[7] : 0);
    }
    var d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  /** health_log 헤더 → 내부 키 */
  function mapHeader(header) {
    var map = {};
    header.forEach(function (h, i) {
      var s = String(h || '').toLowerCase();
      var k = null;
      if (s.indexOf('timestamp') >= 0 || s.indexOf('date') >= 0 || s.indexOf('시간') >= 0) k = 'ts';
      else if (s.indexOf('systolic') >= 0) k = 'sbp';
      else if (s.indexOf('diastolic') >= 0) k = 'dbp';
      else if (s.indexOf('weight') >= 0) k = 'weight';
      else if (s.indexOf('fat') >= 0) k = 'bodyFat';
      else if (s.indexOf('resting') >= 0) k = 'rhr';
      else if (s.indexOf('vo2') >= 0) k = 'vo2';
      else if (s.indexOf('sleep') >= 0) k = 'sleep';
      else if (s.indexOf('oxygen') >= 0) k = 'spo2';
      else if (s.indexOf('step') >= 0) k = 'steps';
      else if (s.indexOf('variability') >= 0 || s === 'hrv') k = 'hrv';
      else if (s.indexOf('exercise') >= 0) k = 'exercise';
      if (k && map[k] === undefined) map[k] = i;
    });
    return map;
  }

  var MAX_METRICS = { steps: 1, exercise: 1, sleep: 1 };   // 하루 누적형 → 최대값
  var ALL_METRICS = ['sbp', 'dbp', 'weight', 'bodyFat', 'rhr', 'vo2', 'sleep', 'spo2', 'steps', 'hrv', 'exercise'];

  /** 행 배열 → { 'YYYY-MM-DD': {steps, sleep, ...} } (하루 여러 행이면 병합) */
  function dailyHealth(rows, header) {
    var idx = mapHeader(header);
    if (idx.ts === undefined) idx.ts = 0;
    var days = {};
    rows.forEach(function (r) {
      var d = parseTimestamp(r[idx.ts]);
      if (!d) return;
      var k = dateKey(d);
      var day = days[k] || (days[k] = { date: k });
      ALL_METRICS.forEach(function (m) {
        if (idx[m] === undefined) return;
        var v = num(r[idx[m]]);
        if (v === null) return;
        if (MAX_METRICS[m]) day[m] = day[m] === undefined ? v : Math.max(day[m], v);
        else day[m] = v;
      });
    });
    return days;
  }

  /** Tasks → { 'YYYY-MM-DD': [task, ...] } */
  function dailyTasks(tasks) {
    var out = {};
    (tasks || []).forEach(function (t) {
      if (!t || !t.completed) return;
      var d = parseTimestamp(t.completed instanceof Date ? t.completed : String(t.completed));
      if (!d) return;
      var k = dateKey(d);
      var due = t.due ? parseTimestamp(String(t.due)) : null;
      var dueKey = due ? dateKey(new Date(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate())) : null; // Tasks due 는 UTC 자정
      (out[k] || (out[k] = [])).push({
        id: t.id, title: t.title || '(제목 없음)', list: t.list || '', completed: k,
        due: dueKey, onTime: dueKey ? k <= dueKey : false
      });
    });
    return out;
  }

  function sleepXp(hours, cfg) {
    if (hours === null || hours === undefined) return 0;
    for (var i = 0; i < cfg.sleepTiers.length; i++) if (hours >= cfg.sleepTiers[i][0]) return cfg.sleepTiers[i][1];
    return 0;
  }

  function avgOf(arr) { if (!arr.length) return null; var s = 0; arr.forEach(function (v) { s += v; }); return s / arr.length; }

  function levelFromXp(total, cfg) {
    var level = 1, remain = total;
    for (;;) {
      var need = cfg.levelBase + cfg.levelStep * level;
      if (remain < need) return { level: level, xpInLevel: remain, xpNeed: need };
      remain -= need; level++;
      if (level > 999) return { level: level, xpInLevel: 0, xpNeed: need };
    }
  }

  function rankOf(level) {
    for (var i = 0; i < RANKS.length; i++) if (level >= RANKS[i][0]) return RANKS[i][1];
    return 'E';
  }

  function mergeConfig(overrides) {
    var cfg = {};
    Object.keys(DEFAULT_CONFIG).forEach(function (k) { cfg[k] = DEFAULT_CONFIG[k]; });
    if (overrides) Object.keys(overrides).forEach(function (k) {
      if (overrides[k] === null || overrides[k] === undefined || overrides[k] === '') return;
      if (k === 'sleepTiers' && typeof overrides[k] === 'string') {
        try { cfg[k] = JSON.parse(overrides[k]); } catch (e) { /* 기본값 유지 */ }
      } else cfg[k] = typeof DEFAULT_CONFIG[k] === 'number' ? (num(overrides[k]) !== null ? num(overrides[k]) : DEFAULT_CONFIG[k]) : overrides[k];
    });
    return cfg;
  }

  // ───────────────────────── 핵심: 전체 계산 ─────────────────────────
  /**
   * @param {Array[]} healthRows  health_log 데이터 행 (헤더 제외)
   * @param {Array}   header      health_log 헤더 행
   * @param {Array}   tasks       [{id,title,list,completed,due}]
   * @param {Object}  cfgOverride config 시트 값
   * @param {Date}    now         기준 시각 (기본 현재)
   */
  function computeAll(healthRows, header, tasks, cfgOverride, now) {
    var cfg = mergeConfig(cfgOverride);
    now = now || new Date();
    var todayKey = dateKey(now);
    var H = dailyHealth(healthRows, header);
    var T = dailyTasks(tasks);

    var keys = {};
    Object.keys(H).forEach(function (k) { if (k <= todayKey) keys[k] = 1; });
    Object.keys(T).forEach(function (k) { if (k <= todayKey) keys[k] = 1; });
    var days = Object.keys(keys).sort();

    var hrvHist = [], rhrHist = [], vo2Best = null, lastWeight = null, lastFat = null;
    var statXp = { VIT: 0, AGI: 0, REC: 0, CAR: 0, INT: 0 };
    var totalXp = 0, prevKey = null, prevStreak = 0;
    var log = [];
    var counters = { steps10k: 0, sleep7: 0, tasks: 0, vo2Records: 0, questClears: 0, bestStreak: 0, daysLogged: 0 };

    days.forEach(function (k) {
      var h = H[k] || {};
      var tl = T[k] || [];
      var b = { steps: 0, stepsBonus: 0, exercise: 0, sleep: 0, hrv: 0, rhr: 0, vo2: 0, bodyComp: 0, tasks: 0, quest: 0, questClear: 0 };
      var notes = [];

      // 체력 — 걸음
      if (h.steps !== undefined) {
        b.steps = Math.min(cfg.stepsXpCap, Math.floor(h.steps / cfg.stepsPerXp));
        if (h.steps >= cfg.stepsBonusAt) { b.stepsBonus = cfg.stepsBonus; counters.steps10k++; }
      }
      // 민첩 — 운동
      if (h.exercise !== undefined) b.exercise = Math.min(cfg.exerciseXpCap, Math.round(h.exercise * cfg.exerciseXpPerMin));
      // 회복 — 수면, HRV
      if (h.sleep !== undefined) { b.sleep = sleepXp(h.sleep, cfg); if (h.sleep >= 7) counters.sleep7++; }
      var hrvAvg = avgOf(hrvHist.slice(-30));
      if (h.hrv !== undefined && hrvAvg !== null && h.hrv > hrvAvg) { b.hrv = cfg.hrvAboveAvgXp; notes.push('HRV ' + round1(h.hrv) + ' > 30일 평균 ' + round1(hrvAvg)); }
      // 심폐 — RHR, VO2
      var rhrAvg = avgOf(rhrHist.slice(-30));
      if (h.rhr !== undefined && rhrAvg !== null && h.rhr <= rhrAvg) { b.rhr = cfg.rhrBelowAvgXp; notes.push('안정 심박 ' + h.rhr + ' ≤ 평균 ' + round1(rhrAvg)); }
      if (h.vo2 !== undefined && vo2Best !== null && h.vo2 > vo2Best) { b.vo2 = cfg.vo2RecordXp; counters.vo2Records++; notes.push('VO2 Max 신기록 ' + h.vo2); }
      // 체성분 새 측정
      if ((h.weight !== undefined && h.weight !== lastWeight) || (h.bodyFat !== undefined && h.bodyFat !== lastFat)) {
        if (lastWeight !== null || lastFat !== null) { b.bodyComp = cfg.bodyCompLogXp; notes.push('체성분 새 측정'); }
      }
      // 지능 — Tasks
      var tXp = 0;
      tl.forEach(function (t) { tXp += cfg.taskXp + (t.onTime ? cfg.taskOnTimeBonus : 0); });
      b.tasks = Math.min(cfg.taskXpCap, tXp);
      counters.tasks += tl.length;

      // 일일 퀘스트
      var quests = [
        { key: 'steps', name: '걸음', value: h.steps !== undefined ? h.steps : 0, target: cfg.questSteps, unit: '걸음' },
        { key: 'exercise', name: '운동', value: h.exercise !== undefined ? h.exercise : 0, target: cfg.questExerciseMin, unit: '분' },
        { key: 'sleep', name: '수면', value: h.sleep !== undefined ? h.sleep : 0, target: cfg.questSleepHours, unit: '시간' },
        { key: 'tasks', name: '할 일 완료', value: tl.length, target: cfg.questTasks, unit: '개' }
      ];
      var cleared = 0;
      quests.forEach(function (q) { q.done = q.value >= q.target; if (q.done) cleared++; });
      b.quest = cleared * cfg.questItemXp;
      var questClear = cleared === quests.length;
      if (questClear) { b.questClear = cfg.questClearBonus; counters.questClears++; }

      var dayXp = 0;
      Object.keys(b).forEach(function (x) { dayXp += b[x]; });
      totalXp += dayXp;
      statXp.VIT += b.steps + b.stepsBonus;
      statXp.AGI += b.exercise;
      statXp.REC += b.sleep + b.hrv;
      statXp.CAR += b.rhr + b.vo2;
      statXp.INT += b.tasks;

      var streak = questClear ? ((prevKey === addDays(k, -1)) ? prevStreak + 1 : 1) : 0;
      if (streak > counters.bestStreak) counters.bestStreak = streak;
      if (H[k]) counters.daysLogged++;

      log.push({
        date: k, hasHealth: !!H[k], metrics: h, tasks: tl, breakdown: b, xp: dayXp,
        quests: quests, questClear: questClear, questCleared: cleared, streak: streak, notes: notes,
        totalXpAfter: totalXp
      });

      // 이력 갱신
      if (h.hrv !== undefined) hrvHist.push(h.hrv);
      if (h.rhr !== undefined) rhrHist.push(h.rhr);
      if (h.vo2 !== undefined) vo2Best = vo2Best === null ? h.vo2 : Math.max(vo2Best, h.vo2);
      if (h.weight !== undefined) lastWeight = h.weight;
      if (h.bodyFat !== undefined) lastFat = h.bodyFat;
      prevKey = k; prevStreak = streak;
    });

    // 현재 연속 기록: 오늘 데이터가 아직 없으면 어제 기준
    var last = log.length ? log[log.length - 1] : null;
    var currentStreak = 0;
    if (last) {
      if (last.date === todayKey) currentStreak = last.streak || (log.length > 1 && log[log.length - 2].date === addDays(todayKey, -1) ? log[log.length - 2].streak : 0);
      else if (last.date === addDays(todayKey, -1)) currentStreak = last.streak;
    }

    var lv = levelFromXp(totalXp, cfg);
    var stats = STAT_DEFS.map(function (s) {
      return { key: s.key, ko: s.ko, src: s.src, xp: statXp[s.key], value: cfg.statBase + Math.floor(statXp[s.key] / cfg.statXpPerPoint) };
    });

    // 오늘 (또는 가장 최근 날)
    var today = last && last.date === todayKey ? last : null;
    var todayStatGain = { VIT: 0, AGI: 0, REC: 0, CAR: 0, INT: 0 };
    if (today) {
      var tb = today.breakdown;
      todayStatGain = { VIT: tb.steps + tb.stepsBonus, AGI: tb.exercise, REC: tb.sleep + tb.hrv, CAR: tb.rhr + tb.vo2, INT: tb.tasks };
    }

    // 최근 30일 히스토리 (빈 날 포함)
    var byKey = {}; log.forEach(function (d) { byKey[d.date] = d; });
    var history = [];
    for (var i = 29; i >= 0; i--) {
      var k2 = addDays(todayKey, -i);
      var d2 = byKey[k2];
      history.push({ date: k2, xp: d2 ? d2.xp : 0, questClear: d2 ? d2.questClear : false, hasData: !!d2 });
    }

    var achievements = buildAchievements(counters, lv.level);

    return {
      generatedAt: now.toISOString(),
      today: todayKey,
      config: cfg,
      totalXp: totalXp,
      level: lv.level, xpInLevel: lv.xpInLevel, xpNeed: lv.xpNeed,
      rank: rankOf(lv.level),
      stats: stats,
      todayStatGain: todayStatGain,
      streak: currentStreak,
      bestStreak: counters.bestStreak,
      todayLog: today,
      latestLog: last,
      history: history,
      achievements: achievements,
      counters: counters,
      log: log
    };
  }

  function buildAchievements(c, level) {
    var defs = [
      { id: 'awaken', name: '각성', desc: '첫 기록', cur: c.daysLogged, goal: 1 },
      { id: 'walker', name: '만보객', desc: '하루 1만 걸음 ×10', cur: c.steps10k, goal: 10 },
      { id: 'sleeper', name: '깊은 잠', desc: '7시간 수면 ×10', cur: c.sleep7, goal: 10 },
      { id: 'tasker', name: '집행자', desc: '할 일 100개 완료', cur: c.tasks, goal: 100 },
      { id: 'lungs', name: '강철 심장', desc: 'VO2 Max 신기록 ×3', cur: c.vo2Records, goal: 3 },
      { id: 'streak7', name: '불굴', desc: '일일 퀘스트 7일 연속', cur: c.bestStreak, goal: 7 },
      { id: 'streak30', name: '그림자 군주', desc: '일일 퀘스트 30일 연속', cur: c.bestStreak, goal: 30 },
      { id: 'lv10', name: 'D급 헌터', desc: '레벨 10 도달', cur: level, goal: 10 },
      { id: 'lv20', name: 'C급 헌터', desc: '레벨 20 도달', cur: level, goal: 20 }
    ];
    defs.forEach(function (d) { d.done = d.cur >= d.goal; });
    return defs;
  }

  /** xp_log 시트용 2차원 배열 */
  function toXpRows(result) {
    var head = ['date', 'steps', 'exercise_min', 'sleep_h', 'hrv', 'rhr', 'vo2', 'tasks_done',
      'xp_steps', 'xp_steps_bonus', 'xp_exercise', 'xp_sleep', 'xp_hrv', 'xp_rhr', 'xp_vo2', 'xp_bodycomp', 'xp_tasks', 'xp_quest', 'xp_quest_clear',
      'xp_day', 'xp_total', 'quest_clear', 'streak', 'notes'];
    var rows = [head];
    result.log.forEach(function (d) {
      var m = d.metrics, b = d.breakdown;
      rows.push([d.date, m.steps, m.exercise, m.sleep, m.hrv, m.rhr, m.vo2, d.tasks.length,
        b.steps, b.stepsBonus, b.exercise, b.sleep, b.hrv, b.rhr, b.vo2, b.bodyComp, b.tasks, b.quest, b.questClear,
        d.xp, d.totalXpAfter, d.questClear ? 'Y' : '', d.streak, d.notes.join(' / ')].map(function (v) { return v === undefined ? '' : v; }));
    });
    return rows;
  }

  /** 대시보드로 보낼 가벼운 스냅샷 (전체 log 제외) */
  function toSnapshot(result) {
    var recentTasks = [];
    for (var i = result.log.length - 1; i >= 0 && recentTasks.length < 8; i--) {
      var d = result.log[i];
      for (var j = d.tasks.length - 1; j >= 0 && recentTasks.length < 8; j--) recentTasks.push(d.tasks[j]);
    }
    var tl = result.todayLog || result.latestLog;
    return {
      generatedAt: result.generatedAt, today: result.today,
      totalXp: result.totalXp, level: result.level, xpInLevel: result.xpInLevel, xpNeed: result.xpNeed, rank: result.rank,
      stats: result.stats, todayStatGain: result.todayStatGain,
      streak: result.streak, bestStreak: result.bestStreak,
      day: tl ? { date: tl.date, isToday: tl.date === result.today, xp: tl.xp, breakdown: tl.breakdown, metrics: tl.metrics, quests: tl.quests, questClear: tl.questClear, questCleared: tl.questCleared, notes: tl.notes, tasks: tl.tasks } : null,
      history: result.history, achievements: result.achievements, counters: result.counters,
      recentTasks: recentTasks, config: result.config
    };
  }

  return {
    DEFAULT_CONFIG: DEFAULT_CONFIG, STAT_DEFS: STAT_DEFS,
    parseTimestamp: parseTimestamp, dateKey: dateKey, mapHeader: mapHeader,
    dailyHealth: dailyHealth, dailyTasks: dailyTasks, mergeConfig: mergeConfig,
    computeAll: computeAll, toXpRows: toXpRows, toSnapshot: toSnapshot, levelFromXp: levelFromXp, rankOf: rankOf
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = LifeOS;
