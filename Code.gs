/**
 * Code.gs — Life OS Google 연동 (Sheets · Google Tasks · 웹앱 대시보드)
 *
 * 시트 구성 (자동 생성):
 *   health_log : 기존 건강 기록 (읽기 전용)
 *   tasks_log  : 완료된 Google Tasks 누적 (API에서 사라져도 보존)
 *   xp_log     : 일별 XP 내역 (매 동기화 때 전체 재계산)
 *   config     : 규칙 수치 (여기서 숫자를 바꾸면 다음 동기화부터 반영)
 */

// 스프레드시트 ID — 컨테이너 바인딩(시트의 확장 프로그램 > Apps Script)이면 비워도 됨
var SPREADSHEET_ID = '1DQ4Z6p4kzdIWz_rrVM_kWd_83_P6q5Zw-g8iOExidq0';

var SHEET_HEALTH = 'health_log';
var SHEET_TASKS = 'tasks_log';
var SHEET_XP = 'xp_log';
var SHEET_CONFIG = 'config';
var TASKS_LOOKBACK_DAYS = 60;   // Tasks API 에서 가져올 완료 범위

function getSS_() {
  var ss = SpreadsheetApp.getActive();
  if (ss) return ss;
  if (!SPREADSHEET_ID) throw new Error('SPREADSHEET_ID 를 설정하세요.');
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

// ───────────────────────── 메뉴 ─────────────────────────
function onOpen() {
  SpreadsheetApp.getUi().createMenu('⚔️ Life OS')
    .addItem('지금 동기화', 'syncLifeOS')
    .addItem('매일 23:30 자동 동기화 설치', 'installDailyTrigger')
    .addItem('대시보드 URL 보기', 'showDashboardUrl')
    .addToUi();
}

// ───────────────────────── 동기화 ─────────────────────────
function syncLifeOS() {
  var ss = getSS_();
  ensureConfigSheet_(ss);
  syncTasksLog_(ss);
  var result = compute_(ss);
  writeXpLog_(ss, result);
  var snap = LifeOS.toSnapshot(result);
  CacheService.getScriptCache().put('snapshot', JSON.stringify(snap), 21600);
  Logger.log('Lv.' + snap.level + ' (' + snap.rank + ') · 총 ' + snap.totalXp + ' XP · 연속 ' + snap.streak + '일');
  return snap;
}

function installDailyTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'syncLifeOS') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('syncLifeOS').timeBased().atHour(23).nearMinute(30).everyDays(1).create();
  toast_('매일 23:30 (Asia/Seoul) 자동 동기화가 설치되었습니다.');
}

function showDashboardUrl() {
  var url = ScriptApp.getService().getUrl();
  var ui = SpreadsheetApp.getUi();
  if (!url) { ui.alert('먼저 배포 > 새 배포 > 웹 앱 으로 배포하세요.'); return; }
  ui.alert('대시보드 URL', url, ui.ButtonSet.OK);
}

function toast_(msg) { try { getSS_().toast(msg, 'Life OS'); } catch (e) { Logger.log(msg); } }

// ───────────────────────── 계산 ─────────────────────────
function compute_(ss) {
  var hs = ss.getSheetByName(SHEET_HEALTH);
  if (!hs) throw new Error(SHEET_HEALTH + ' 시트를 찾을 수 없습니다.');
  var values = hs.getDataRange().getValues();
  var header = values.shift();
  var tasks = readTasksLog_(ss);
  var cfg = readConfig_(ss);
  return LifeOS.computeAll(values, header, tasks, cfg, new Date());
}

/** 대시보드(HTML)에서 google.script.run.getSnapshot() 으로 호출 */
function getSnapshot() {
  var cached = CacheService.getScriptCache().get('snapshot');
  if (cached) return JSON.parse(cached);
  return syncLifeOS();
}

/** 대시보드의 "동기화" 버튼 */
function refreshSnapshot() { return syncLifeOS(); }

// ───────────────────────── Google Tasks → tasks_log ─────────────────────────
function syncTasksLog_(ss) {
  var sh = ss.getSheetByName(SHEET_TASKS) || ss.insertSheet(SHEET_TASKS);
  if (sh.getLastRow() === 0) sh.appendRow(['id', 'title', 'list', 'completed', 'due', 'updated']);
  var existing = {};
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) existing[data[i][0]] = i + 1;  // id → 행 번호

  var since = new Date(Date.now() - TASKS_LOOKBACK_DAYS * 86400000).toISOString();
  var lists = (Tasks.Tasklists.list({ maxResults: 100 }).items) || [];
  var appended = [];
  lists.forEach(function (list) {
    var pageToken = null;
    do {
      var resp = Tasks.Tasks.list(list.id, {
        showCompleted: true, showHidden: true, completedMin: since, maxResults: 100, pageToken: pageToken
      });
      (resp.items || []).forEach(function (t) {
        if (t.status !== 'completed' || !t.completed) return;
        var row = [t.id, t.title || '', list.title || '', t.completed, t.due || '', t.updated || ''];
        if (existing[t.id]) sh.getRange(existing[t.id], 1, 1, row.length).setValues([row]);
        else appended.push(row);
      });
      pageToken = resp.nextPageToken;
    } while (pageToken);
  });
  if (appended.length) sh.getRange(sh.getLastRow() + 1, 1, appended.length, appended[0].length).setValues(appended);
}

function readTasksLog_(ss) {
  var sh = ss.getSheetByName(SHEET_TASKS);
  if (!sh || sh.getLastRow() < 2) return [];
  var data = sh.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    if (!r[0]) continue;
    out.push({ id: r[0], title: r[1], list: r[2], completed: r[3] instanceof Date ? r[3] : String(r[3]), due: r[4] ? (r[4] instanceof Date ? r[4].toISOString() : String(r[4])) : null });
  }
  return out;
}

// ───────────────────────── config 시트 ─────────────────────────
var CONFIG_DESC = {
  stepsPerXp: '걸음 → XP 환산 (N걸음당 1 XP)', stepsXpCap: '걸음 XP 하루 상한', stepsBonusAt: '걸음 보너스 기준', stepsBonus: '걸음 보너스 XP',
  exerciseXpPerMin: '운동 1분당 XP', exerciseXpCap: '운동 XP 하루 상한',
  sleepTiers: '수면 구간 [[시간, XP], ...] (JSON)', hrvAboveAvgXp: 'HRV 30일 평균 초과 시 XP',
  rhrBelowAvgXp: '안정 심박 평균 이하 시 XP', vo2RecordXp: 'VO2 Max 신기록 XP', bodyCompLogXp: '체성분 새 측정 XP',
  taskXp: '할 일 1개 완료 XP', taskOnTimeBonus: '마감 준수 보너스', taskXpCap: '할 일 XP 하루 상한',
  questSteps: '일일 퀘스트: 걸음', questExerciseMin: '일일 퀘스트: 운동(분)', questSleepHours: '일일 퀘스트: 수면(시간)', questTasks: '일일 퀘스트: 할 일 개수',
  questItemXp: '퀘스트 항목당 XP', questClearBonus: '퀘스트 올클리어 보너스',
  levelBase: '레벨업 필요 XP = base + step × 레벨', levelStep: '레벨업 step', statXpPerPoint: '스탯 1 당 XP', statBase: '스탯 기본치'
};

function ensureConfigSheet_(ss) {
  var sh = ss.getSheetByName(SHEET_CONFIG);
  if (sh) return sh;
  sh = ss.insertSheet(SHEET_CONFIG);
  var rows = [['key', 'value', 'description']];
  Object.keys(LifeOS.DEFAULT_CONFIG).forEach(function (k) {
    var v = LifeOS.DEFAULT_CONFIG[k];
    rows.push([k, typeof v === 'object' ? JSON.stringify(v) : v, CONFIG_DESC[k] || '']);
  });
  sh.getRange(1, 1, rows.length, 3).setValues(rows);
  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, 3);
  return sh;
}

function readConfig_(ss) {
  var sh = ss.getSheetByName(SHEET_CONFIG);
  if (!sh) return {};
  var data = sh.getDataRange().getValues();
  var cfg = {};
  for (var i = 1; i < data.length; i++) if (data[i][0]) cfg[data[i][0]] = data[i][1];
  return cfg;
}

// ───────────────────────── xp_log 쓰기 ─────────────────────────
function writeXpLog_(ss, result) {
  var rows = LifeOS.toXpRows(result);
  var sh = ss.getSheetByName(SHEET_XP) || ss.insertSheet(SHEET_XP);
  sh.clearContents();
  sh.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  sh.setFrozenRows(1);
}

// ───────────────────────── 웹앱 ─────────────────────────
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Dashboard')
    .setTitle('Life OS')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
