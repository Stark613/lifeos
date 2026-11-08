# ⚔️ Life OS — 나 혼자만 레벨업 스타일 경험치 시스템

`health_log`(Google Sheets) 와 **Google Tasks** 를 매일 읽어 XP·레벨·스탯·일일 퀘스트로 바꿔 주는 Apps Script 프로젝트.
모든 것이 내 Google 계정 안에서만 돌아간다 (서버·API 키 없음).

```
health_log ──┐
             ├─▶ Engine.gs (XP 계산) ─▶ xp_log 시트 ─▶ Dashboard (웹앱, 시스템 창 UI)
Google Tasks ┘        ▲
                 config 시트 (규칙 수치)
```

## 파일
| 파일 | 역할 |
|---|---|
| `Engine.gs` | 순수 계산 엔진. Node 에서도 그대로 실행됨 (`tools/test_engine.js`) |
| `Code.gs` | Sheets/Tasks 읽기, `xp_log`·`tasks_log`·`config` 시트 쓰기, 메뉴, 트리거, 웹앱 |
| `Dashboard.html` | 대시보드 **빌드 결과물** (app/ 에서 생성, 직접 수정하지 말 것) |
| `app/` | 대시보드 소스 — Vite + React + TypeScript + Tailwind. 데스크톱 운영 콘솔 레이아웃 (탭 4개, 키보드 1~4 · R) |
| `appsscript.json` | 매니페스트 (Asia/Seoul, Tasks 고급 서비스, 웹앱 설정) |

## 설치 (5분)
1. `health_log` 스프레드시트 열기 → **확장 프로그램 ▸ Apps Script**
2. 편집기 왼쪽 ⚙️ 프로젝트 설정 → **"appsscript.json" 매니페스트 파일 표시** 체크
3. 파일 4개를 그대로 붙여넣기: `Engine.gs`, `Code.gs`, `Dashboard.html`(HTML 파일로 추가), `appsscript.json`
   - 매니페스트를 붙여넣으면 Tasks 고급 서비스가 자동 활성화됨
4. `syncLifeOS` 함수 선택 → ▶ 실행 → 권한 승인 (Sheets, Tasks 읽기)
   → `xp_log`, `tasks_log`, `config` 시트가 생기고 첫 계산 완료
5. **배포 ▸ 새 배포 ▸ 웹 앱** (실행: 나, 액세스: 나만) → URL 을 북마크
6. 시트 메뉴 **⚔️ Life OS ▸ 매일 23:30 자동 동기화 설치** (health_log 가 22:00 에 기록되므로 그 뒤 실행)

## 규칙 (config 시트에서 숫자만 바꾸면 됨)
| 출처 | 스탯 | XP |
|---|---|---|
| 걸음 | 체력 VIT | 100걸음 = 1 XP (최대 150) · 1만 보 +30 |
| 운동 시간 | 민첩 AGI | 1분 = 2 XP (최대 120) |
| 수면 | 회복 REC | 7h+ 60 · 6h+ 40 · 5h+ 20 |
| HRV | 회복 REC | 30일 평균 초과 +15 |
| 안정 심박 | 심폐 CAR | 30일 평균 이하 +10 |
| VO2 Max | 심폐 CAR | 개인 최고 갱신 +50 |
| 체중/체지방 | — | 새 측정값 기록 +20 |
| Google Tasks | 지능 INT | 완료 1개 20 XP · 마감 준수 +10 (최대 200/일) |

**일일 퀘스트**: 걸음 8,000 · 운동 20분 · 수면 7시간 · 할 일 3개 → 항목당 +15, 올클리어 +100, 연속 기록(streak) 증가.
**레벨**: 다음 레벨까지 `50 + 50 × 레벨` XP. **랭크**: E(1) D(10) C(20) B(30) A(45) S(60).
**스탯**: 100 XP 마다 +1 (기본 10). **칭호** 9종 (각성, 만보객, 깊은 잠, 집행자, 강철 심장, 불굴, 그림자 군주, D급/C급 헌터).

## 대시보드 수정 (TypeScript)
```bash
cd app && npm install
npm run dev                 # 개발 서버
npm run build               # → ../Dashboard.html 생성 (React 는 CDN 로드, 본문 약 48KB)
node scripts/make-preview.mjs ../health_log.csv 2026-11-08 preview.html   # 실제 데이터 미리보기 (예시 Tasks 포함)
```
빌드 후 `Dashboard.html` 내용을 Apps Script 의 Dashboard.html 에 덮어쓰면 끝.
현재 레이아웃은 데스크톱(1280px+) 기준. 상단 KPI 띄 · 탭 4개(Dashboard / Quest / History / Rules) · 3열 그리드 · 하단 상태바. 모바일 레이아웃은 추후.

## 로컬 테스트
```bash
TZ=Asia/Seoul node tools/test_engine.js health_log.csv 2026-11-08   # health_log 시트를 CSV 로 내보낸 파일 (저장소에는 커밋하지 않음)
```

## 참고
- health_log 의 `Exercise time` 값이 1·3·5 처럼 작게 기록되고 있어 단위를 '분'으로 가정했다. 실제 단위가 다르면 `config` 의 `exerciseXpPerMin`, `questExerciseMin` 을 조정.
- 완료된 Tasks 는 `tasks_log` 에 누적 저장되므로 Google Tasks 에서 지워도 XP 는 유지된다.
- `xp_log` 는 매 동기화마다 전체 재계산된다 (규칙을 바꾸면 과거도 새 규칙으로 다시 계산됨).
