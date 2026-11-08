// 실제 health_log CSV + 예시 Tasks 로 엔진 실행
const fs = require('fs');
const path = require('path');
const LifeOS = require(path.join(__dirname, '..', 'Engine.gs'));

function readCsv(file) {
  const txt = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
  return txt.split(/\r?\n/).filter(l => l.trim()).map(l => l.split(','));
}
// 예시 Tasks (Google Tasks 연결 전 미리보기용)
function mockTasks(todayKey, days) {
  const titles = ['주간 보고 작성', '책 30쪽 읽기', '영어 단어 50개', '이메일 정리', '운동 계획 세우기', '가계부 입력', '블로그 초안', '프로젝트 회의 준비', '정리정돈 15분', '명상 10분'];
  const out = [];
  let seed = 7;
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const base = new Date(todayKey + 'T12:00:00');
  for (let i = 0; i < days; i++) {
    const d = new Date(base); d.setDate(d.getDate() - i);
    const n = Math.floor(rnd() * 5); // 0~4개
    for (let j = 0; j < n; j++) {
      const c = new Date(d); c.setHours(9 + Math.floor(rnd() * 12), Math.floor(rnd() * 60));
      const due = rnd() < 0.5 ? new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate() + (rnd() < 0.8 ? 0 : -1))) : null;
      out.push({ id: `mock-${i}-${j}`, title: titles[(i + j * 3) % titles.length] + ' (예시)', list: '내 할 일', completed: c.toISOString(), due: due ? due.toISOString() : null });
    }
  }
  return out;
}

const csv = process.argv[2];
const todayArg = process.argv[3];
const now = todayArg ? new Date(todayArg + 'T23:00:00') : new Date();
const rows = readCsv(csv);
const header = rows.shift();
const tasks = mockTasks(LifeOS.dateKey(now), 45);
const result = LifeOS.computeAll(rows, header, tasks, {}, now);
const snap = LifeOS.toSnapshot(result);
if (process.argv.includes('--json')) { process.stdout.write(JSON.stringify(snap)); }
else {
  console.log(`Lv.${snap.level} [${snap.rank}]  ${snap.xpInLevel}/${snap.xpNeed}  총 ${snap.totalXp} XP  연속 ${snap.streak}일 (최고 ${snap.bestStreak})`);
  console.log('stats:', snap.stats.map(s => `${s.ko}${s.value}(${s.xp})`).join(' '));
  console.log('days logged:', snap.counters.daysLogged, 'quest clears:', snap.counters.questClears, 'tasks:', snap.counters.tasks);
  console.log('today:', snap.day && snap.day.date, snap.day && snap.day.xp, JSON.stringify(snap.day && snap.day.breakdown));
  console.log('quests:', snap.day && snap.day.quests.map(q => `${q.name} ${q.value}/${q.target} ${q.done ? '✓' : '✗'}`).join(' | '));
  console.log('achievements:', snap.achievements.filter(a => a.done).map(a => a.name).join(', '));
  console.log('history xp:', snap.history.map(h => h.xp).join(','));
  const xr = LifeOS.toXpRows(result); console.log('xp rows:', xr.length, '\n', xr[1].join(' | '), '\n', xr[xr.length - 1].join(' | '));
}
