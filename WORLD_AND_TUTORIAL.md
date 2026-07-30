# The Folded Weave — 세계관 설정과 정밀 튜토리얼 사양 (v3)

이 문서는 quantum-fold의 **세계관(픽션)** 과 **화면 단위로 정확한 튜토리얼 대본**을 정의한다.
목적은 하나다: 플레이어가 게임에 들어간 첫 60초 안에 "무엇을 하면 재미있는지"를 스스로 발견하게 만드는 것.

수학적 불변량(GAME_PRINCIPLES.md의 12원칙, 특히 P7 표현 불변성과 P12 결정론)은 이 문서의 어떤 항목으로도 훼손되지 않는다. 픽션은 수학의 **포장지**이지 대체물이 아니다. 이 문서의 모든 수치·라벨·트리거는 현재 코드(`src/game.js`, `src/trace-mechanics.js`)와 대조 검증되었다. **판정 수학(부호, preimage 수, 계보, 정수)은 변경하지 않는다** — 튜토리얼은 표시·문구·피드백·오버레이 상태만 추가한다.

---

## 1. 세계관 — 접힌 직조계 (The Folded Weave)

### 배경 설정

세계는 **직조판(the Weave)** — 동서남북 가장자리가 서로 맞붙은 한 장의 천이다.
동쪽 끝으로 걸어 나가면 서쪽에서 나온다. 북쪽 끝을 넘으면 남쪽에서 나온다. 이 세계에 벽은 없고, 오직 이음새(seam)만 있다.

하늘에는 **원장구(the Ledger Sphere)** 가 떠 있다. 직조판 위의 모든 움직임은 원장구 표면에 실시간으로 비친다. 지상의 운반자가 한 걸음을 걸으면, 하늘의 **그림자(흰 점)** 가 그 걸음을 구면 위에 받아 그린다. 지상에서 무슨 짓을 해도 하늘은 빠짐없이 기록한다.

플레이어는 **운반자(the Courier)** — 원장의 결산을 맞추는 하급 사서다. 운반자가 다루는 것은 두 종류다:

- **지상 화물(ground cargo)** — 직조판 위에 놓인 링. **몸으로 닿아서** 줍는다. 화물 자체에는 부호가 없다. **부호는 주운 순간 운반자가 밟고 선 땅이 정한다** — 바른 땅에서 주우면 `+1`, 뒤집힌 땅에서 주우면 `−1`로 기록된다. 같은 화물이라도 어느 쪽에서 접근했느냐에 따라 다르게 적립된다.
- **하늘 신호(sky signal)** — 하늘의 특정 지점에 떠 있는 잠금. 몸이 아니라 **그림자를 그 지점에 도킹시켜야** 잡힌다. 신호에는 요구 부호가 새겨져 있어서, **요구와 같은 부호의 땅 위에 서 있을 때만** 잠금이 풀린다. 발밑과 하늘을 동시에 읽어야 하는 화물이다.
- **출처 화물(provenance cargo)** — 하늘의 한 점을 **세 곳의 몸이 함께** 드리울 때 생기는 화물. 그림자를 그 지점에 도킹시키는 것만으로는 부족하다 — **올바른 몸으로 올바른 자리에 서 있어야** 잡힌다. 몸의 위치·그림자의 위치·발밑 부호, 3중이 동시에 맞아야 하는 유일한 화물이며, "네 그림자가 정말 너의 것인가"를 묻는다.

직조판 가운데에는 닫힌 호박색 곡선, **역류선(the Undertow)** 이 있다.
선 자체는 아무 해가 없다 — 밟아도, 넘어도, 아무것도 다치지 않는다. 그러나 선 **안쪽**은 세계가 뒤집혀 있다:

- 그곳에서 원장은 **거꾸로 쓰인다.** 운반자의 기여는 음수로 기록되고, 하늘의 그림자는 반대 방향으로 돈다.
- 그곳에서 세계는 **세 겹**이다. 하늘의 흰 점 하나를 만들어내는 지상의 자리가 세 군데 존재한다. 네가 보는 그림자가 정말 너의 것인지, 다른 두 자리의 것인지는 **출처(provenance)** 를 따져야만 안다.

역류선이 급하게 꺾이는 두 지점이 **첨점(the Cusp)** 이다. 세 겹의 세계가 한 점으로 눌려 있는 곳 — 가장 많은 정보와 가장 큰 위험이 함께 있다. 첨점 근처에서는 시트(층)가 **태어나고 죽는다.**

**원장의 법**: 원장은 경로를 기억하지 않는다. **정수만 기억한다.** 운반자가 판을 몇 바퀴 헤집고 이음새를 몇 번 감아 돌아도, +와 −가 상쇄되고 남은 정수 하나가 그 근무의 결산이다.

> 미학 한 줄: **"지저분한 손, 흔들리지 않는 정수."**
> (locally messy motion, globally robust integer — P6의 픽션 번역)

**정직성 조항**: 결산 근무의 화물 결산은 원장의 **근사 장부(proxy ledger)** 다. 진짜 원장은 직조판 전체를 적분해 쓰인다(SPEC 참조, README의 "authored sign-cancellation proxy"). 픽션도 이것을 숨기지 않는다 — 운반자는 견습 사서이고, 화물 결산은 진짜 적분의 **연습 장부**라는 설정을 유지한다. UI가 이 결산을 위상 불변량 그 자체로 서술하는 것을 금지한다.

### 세 모드의 픽션 프레임과 연결 서사

| 모드 | 픽션 | 플레이어의 동사 |
|---|---|---|
| Torus (`index.html`) | **결산 근무 (The Shift)** — 운반자의 일과. 화물을 걷어 목표 정수로 착지한다. | 부호를 주워서 상쇄시킨다 |
| A · Continuation Strike | **감사 (The Audit)** — 봉인된 근무 기록을 **재생하며** 감사한다. fold 사건에서 실제로 태어나고 죽은 시트의 계보를 증명하고, 가짜 계보를 기각한다. | 계보를 잇고, 거짓을 기각한다 |
| B · Sheet Runner | **호위 (The Escort)** — 살아있는 실 S₀를 첨점 곁으로 호위한다. 경로 선택이 곧 생사다. | 길을 골라 실을 살린다 |

**A 모드의 "시간"**: 감사는 과거 기록의 **재생(replay)** 이다. θ는 봉인된 기록의 재생 눈금이고, "시간이 전진한다"는 재생 헤드가 다음 프레임으로 넘어간다는 뜻이다. 과거를 바꾸는 것이 아니라 과거에 **무슨 일이 있었는지를 증명**하는 것이다.

**B 모드의 조작 은유 (중요)**: 호위에서 플레이어는 실을 직접 끌지 않는다. **하늘의 목표 신호(beacon, 좌표 (A,B))를 민다.** 직조판 위의 실(root)들은 그 신호에 응답해 스스로 움직이고, 태어나고, 죽는다. Torus의 "내가 걷는다"와 정반대 방향의 인과이며, 튜토리얼 문구는 이 차이를 반드시 명시한다 (§5 B-0).

**연결 서사**: 결산(정수를 맞춘다) → 감사(그 정수 뒤의 계보를 증명한다) → 호위(계보를 직접 설계한다). B-3 완료 receipt에서 세 모드의 서사가 합류함을 명시한다 (§5 B-3).

### 용어 대응표 (픽션 ↔ 수학 ↔ 화면)

| 픽션 | 수학 / 코드 | 화면 요소 |
|---|---|---|
| 직조판 | T² (Brillouin zone) | 좌측 도메인 캔버스 |
| 이음새 | 주기 경계 (wrap) | 도메인 가장자리 |
| 원장구 | S² (Bloch sphere) | 우측 구 |
| 운반자 | source point k | cyan 마커 |
| 그림자 | f(k) | white 마커 |
| 역류선 | λ̄=0 fold curve | amber 곡선 |
| 뒤집힌 영역 | orientation < 0 | coral 영역 |
| 세 겹 | 3 preimages | VISIBLE SOURCES 3× |
| 지상 화물 | `kind:"source"` gate (missions 01·05) — 도메인 거리 판정, 부호는 위치에서 계산 | 도메인 위 링 |
| 하늘 신호 | `kind:"state"` gate (missions 02·04) — Bloch 거리 + orientation 일치 판정 | 구면 잠금 + 도메인 마커 |
| 출처 화물 | `kind:"echo"` gate (mission 03) — Bloch 거리 + **도메인 `rootSource` 거리** + orientation, 3중 AND (`game.js` `gateHit`의 `rootSource` 분기) | 남극점을 만드는 세 preimage 링 |
| 첨점 | Whitney cusp | amber 꺾임점 |
| 실 / 시트 | solution sheet (런타임 ID `S0`/`S1`/`S2` + 부호 접미) | root 마커 |
| 하늘 신호(beacon) | target 좌표 (A,B) | B 모드 crosshair |
| 결산 | signed sum (proxy) | PACKET SUM / receipt |
| 감사 기록 | trace receipt (lineage) | evidence card |

---

## 2. 튜토리얼 총칙 — 비협상 규칙 7개

이 규칙들은 아래 모든 대본에 우선한다. 대본과 충돌하면 이 규칙이 이긴다.

1. **목표물은 항상 보인다.** 현재 목표물 알파 1.0, 이후·비활성 목표물 알파 ≥ **0.55** (이 값이 유일한 계약이다 — 다른 수치를 쓰는 곳이 있으면 이 조항이 이긴다). 알파 0 금지. 예외: **수집 완료된** 목표물은 흐리게(현행 0.2) 두는 것이 옳다 — 이 조항은 아직 잡지 않은 목표물에만 적용된다. 목표물이 화면 밖이거나 멀면 도메인 테두리에 **방향 화살표 + 거리**를 상시 표시한다. 하늘 신호는 구면 잠금과 도메인 쪽 대응 마커를 **둘 다** 표시한다.
2. **첫 입력까지 3초, 첫 지시는 목적이 있는 행동.** splash 이후 첫 화면의 HUD는 정확히 4개: 도메인 캔버스, 원장구, 목표 한 줄, ORIENTATION. 나머지 패널은 **해당 개념이 처음 발생하는 순간** 슬라이드-인하며 등장하고, 등장 시 한 줄 설명이 붙는다. 조작 확인만을 위한 무목적 스텝(예: "일정 거리 걸어라")은 금지 — 첫 지시부터 세계의 성질을 가르치는 행동이어야 한다.
3. **문구는 명사 정의가 아니라 동사 명령.** "Cross the periodic seam" ❌ → "WALK OFF THE EAST EDGE." ⭕. 명사(seam, relay, preimage)는 행동이 일어난 **뒤에** 이름 붙인다. 행동이 이미 보여준 것을 시적으로 반복하는 문구는 쓰지 않는다.
4. **모든 획득·전환은 punctuation.** 획득: 0.25초 링 버스트 + 화면 중앙 `+1`/`−1` 글리프 + 톤(+는 상승음, −는 하강음 — 사운드는 `sound.event`에 이미 있음, 시각 연출이 없다). 역류선 통과: trail 색 전환 + ORIENTATION 패널 플래시. 무음으로 숫자만 바뀌는 상태 변화 금지. **무입력 대기 상태도 금지** — 플레이어가 다음에 뭘 해야 하는지 화면이 항상 말한다.
5. **두 캔버스는 어떤 해상도에서도 동시에 보인다.** 좁은 폭에서 세로 스택 금지 — 둘을 함께 축소해 나란히 유지한다. (실측: 현행 `styles.css`의 940px 분기에서 구면 캔버스가 화면 밖 y≈923px로 밀려난다. **이 게임의 코어 루프를 죽이는 단일 최대 결함이며 최우선 수정이다.**)
6. **처음 실수는 벌하지 않는다 — 실제로 벌점이 있는 위험에 한해.** 정의: "grace"란 **1.5초 무적 + 직전 안전 위치로 원복 + 관련 실패 래치의 되감기**다 (완전한 시간 되감기 재시뮬레이션이 아니다 — 비용 문제로 채택하지 않는다). 적용 대상은 실제로 벌점·실패가 발생하는 위험뿐이다: **B 모드의 3-root 영역 진입** (integrity 차감 + `everTriple` 래치 — 래치도 반드시 함께 원복할 것, 아니면 grace가 무의미하다). **A 모드의 시간 초과**는 grace 대상이 아니라 **완화 대상**이다 — 첫 lock까지 무타이머(A-1)로 위험을 줄일 뿐, 발생한 timeout의 integrity 차감은 면제하지 않는다. A 모드의 오연결과 B-2의 오태그는 **현행 코드에서 감점이 없으므로** grace 대상이 아니다 — combo 초기화만 일어나며 그대로 둔다.
7. **표현 변경은 답을 바꾸지 않는다 — 자유 구간에서 시연시킨다.** mission 05 자유 결산 중 화면 구석에 `TRY C — ROTATE THE SKY. YOUR GROUND DOES NOT MOVE.`를 띄우고, 회전 중 k·λ̄ 수치 옆에 `INVARIANT` 뱃지를 표시한다. **학습 부하가 높은 미션(03) 한가운데 끼워 넣지 않는다.** 데스크톱 한정 — 모바일(620px 미만)에서는 camera 버튼이 숨겨져 있으므로 이 시연을 생략하거나 버튼을 노출한 뒤에만 적용한다.

**구현 원칙**: 튜토리얼 진행 게이트(아래 대본의 `[완료]`)는 미션 판정과 **분리된 오버레이 상태**로 구현한다. 미션 판정 함수(`gateHit`, `updateCompletion` 등)는 건드리지 않는다. 오버레이 상태는 결정론 시뮬레이션 레이어에 두고 테스트를 추가한다 (P12).

---

## 3. Torus 튜토리얼 — 「결산 근무」

기존 mission 01~05의 **판정 로직은 그대로 두고**, 표시·문구·피드백을 아래 대본으로 교체한다.
표기: `[트리거]` 시작 조건 / `[화면]` 보이는 것 / `[문구]` 리터럴 UI 텍스트 / `[행동]` 플레이어 행동 / `[완료]` 오버레이 진행 판정 / `[피드백]` 완료 연출 / `[방치]` 8초 이상 무입력 시.

### STEP 0 — Splash

- `[화면]` 현행 splash 유지 (이미 깨끗하다 — 수식·논문 인용 없음). 두 줄:
  - `MOVE THE CYAN COURIER. THE WHITE SHADOW ANSWERS.`
  - `PRESS ENTER TO START YOUR SHIFT.`
- `SPEC` 링크는 topbar 아이콘 유지.

### STEP 1 — 이음새 (첫 지시, mission 01 시작과 동시)

- `[트리거]` ENTER. (총칙 2 — 걷기 검사 스텝은 두지 않는다. 조작 안내는 이 스텝의 문구에 겸한다.)
- `[화면]` HUD 4개. 운반자는 mission 01 시작점(동쪽 가장자리 근처, u=0.86)에 있다. 동쪽 가장자리가 1회 하이라이트 펄스.
- `[문구]` `WALK OFF THE EAST EDGE — WASD / ARROWS`
- `[행동]` 동쪽 경계를 넘는다.
- `[완료]` wrap 이벤트 발생 (오버레이 상태로 감지 — 미션 판정에는 wrap이 관여하지 않으며 그대로 둔다).
- `[피드백]` 서쪽 재진입 지점에 링 버스트 + `WRAPS EAST/WEST` 라벨이 도메인에 부착된다 (행동 후 명명). 추가 문구 없음 — 플레이어는 이미 봤다.
- `[구현 주의]` 시작점(u=0.86)에서 wrap 직후 곧바로 `seam-1`(u=0.04) 사정거리에 들어갈 수 있다. 오버레이 상태 머신은 같은 프레임에서 **wrap 처리·STEP 2 라벨 표시를 획득 처리보다 먼저** 수행해, 1번 화물이 라벨 없이 수집되는 일을 막는다.
- `[방치]` 동쪽 가장자리 화살표 상시 표시.

### STEP 2 — 첫 화물 4개 (mission 01 본편)

- `[트리거]` STEP 1 완료.
- `[화면]` 지상 화물 4개(`seam-1`~`seam-4`)에 **숫자 1·2·3·4가 링 안에 직접** 그려진다. 현재 목표 알파 1.0 + 맥동, 나머지 0.55. 테두리 화살표 + 거리.
- `[문구]` `PICK UP CARGO 1 / 4` (획득마다 갱신)
- `[행동]` 순서대로 링에 몸을 댄다 (mission 01은 지상 화물 — 도메인 거리 판정이 맞다).
- `[완료]` 4개 획득 (기존 판정 그대로).
- `[피드백]` 획득마다 총칙 4의 punctuation. **글리프는 실제 적립 부호를 표시한다** — `seam-4`는 뒤집힌 땅에 있어 `−1`이 뜨고, `seam-3`은 역류선에 근접해 접근 방향에 따라 부호가 달라질 수 있다. 이것은 버그가 아니라 **이 게임의 진실**이며 숨기지 않는다. 4개째에서 **PACKET SUM 패널 슬라이드-인**: `PACKET SUM <실제 합> — YOUR PRACTICE LEDGER.` (합계는 하드코딩 금지 — 부호가 경로 의존이므로 반드시 실제 적립값을 표시한다. 이를 위해 적립 부호를 상태에 보관해야 한다 — §8 체크리스트 #4.)
- `[발견 — 이 게임의 첫 번째 진실]` 화물의 저작 힌트 부호와 실제 적립 부호가 불일치하는 순간 (실측상 이 조건이 발화 가능한 gate는 **`seam-3`이 유일**하다 — 역류선까지 0.004, 반경 0.047): 화면 중앙 글리프를 크게 띄우고 1회 문구: `THE GROUND DECIDES THE SIGN — NOT THE CARGO. WHERE YOU STAND IS WHAT YOU WRITE.` 이 발견은 반드시 여기(mission 01)에 있어야 한다 — **mission 05의 화물 5개는 전부 반전 불가로 실측 확정**되었으므로 그곳으로 옮기면 영원히 발화하지 않는다.
- `[방치]` 화살표 + 거리 강조.

### STEP 3 — 역류선 (mission 02)

- `[트리거]` mission 02 시작.
- `[화면]` amber 역류선 1.5초 강조 맥동. 안쪽 영역에 옅은 coral tint (이후 상시).
- `[문구]` `CROSS THE AMBER LINE. NOTHING ON IT HURTS YOU.`
- `[행동]` 역류선을 넘는다.
- `[완료]` orientation 반전 이벤트 (이벤트는 코드에 이미 발화됨 — 렌더만 붙인다).
- `[피드백]` 이 게임 최고의 순간 — 전력 연출: 운반자·trail pink 전환, 그림자 역회전 강조, ORIENTATION 패널 플래시 `+ → −`, 문구 교체: `INSIDE, THE LEDGER WRITES BACKWARD.` **λ̄ 패널 슬라이드-인**: `AREA DENSITY λ̄ — ORIENTATION IS THE SIGN OF THIS NUMBER.` (ORIENTATION과 λ̄는 같은 사실의 두 표현임을 여기서 명시적으로 잇는다 — 별개 개념처럼 두 번 소개하지 않는다.)
- 이어지는 mission 02 본편 — **이 미션의 화물은 하늘 신호다** (`kind:"state"` 3개: Positive/Negative/Positive lock). 문구는 도킹을 가르친다:
  - `LOCK 1 / 3 — PARK YOUR SHADOW ON THE MARKED SKY. STAND ON + GROUND TO UNLOCK.`
  - 2번째 잠금에서: `THIS LOCK NEEDS − GROUND. CROSS THE LINE, THEN PARK THE SHADOW.`
  - 각 잠금 해제 시 화면 중앙 부호 글리프.
- `[방치]` 활성 잠금의 구면 위치 + 대응 도메인 마커 강조.

### STEP 4 — 세 겹 (mission 03, 출처 화물)

- `[트리거]` mission 03 시작.
- `[문구]` `ONE SHADOW, THREE SOURCES. PRESS SPACE — SEE WHO ELSE CASTS IT.`
- `[행동]` Space를 누른다.
- `[화면·Space의 역할 재정의]` Space는 "안 보이던 것을 보이게" 하는 키가 아니라 **provenance 판별** 키다: 누르는 동안 운반자에서 나머지 두 preimage로 **방위선(bearing line)** 이 그려지고, 각 preimage에 λ̄ 크기·부호 태그가 붙는다. echo 링 자체는 이 미션 동안 상시 가시(총칙 1) — Space가 주는 것은 가시성이 아니라 **판별 정보**다. (현행 코드에는 방위선이 없다 — 신규 렌더 기능, §8 #6.)
- `[획득 조건 교육 — 이 미션은 제3의 화물이다]` 이 미션의 화물은 지상형도 하늘형도 아닌 **출처 화물**이다. 실제 판정은 3중 AND다: ① 그림자가 남극점 근처에 도킹 ② **몸이 해당 preimage 자리(`rootSource` 반경) 안** ③ 발밑 orientation 일치. 첫 preimage에 접근했는데 ②만 만족하고 ①이 부족할 때 (또는 그 반대) 1회 안내: `YOUR BODY IS HERE — BUT YOUR SHADOW ISN'T PARKED. BOTH MUST AGREE.` 픽션 문구는 "그림자를 맞추고, **올바른 몸으로 가라**"로 통일한다 — "도킹만 하면 잡힌다"는 서술 금지 (수학적으로 틀린 서술이 된다).
- `[완료]` 3개 preimage **전부** 획득 (기존 판정 `allCollected` 그대로 — 3개다, 1개가 아니다).
- `[피드백]` 각 획득마다 VISIBLE SOURCES 패널 강조 (`3× — THREE PLACES MAKE THIS ONE WHITE POINT`, 최초 1회 슬라이드-인). 완료 시 mission 클리어 연출.

### STEP 5 — 상쇄 (mission 04)

- `[트리거]` mission 04 시작.
- `[화면]` 하늘 신호 5개 전부 상시 가시 (**현행 `kind:"state"` 알파 0 금지** — 총칙 1). 각 신호에 **요구 부호** `+`/`−` 표시 (이 미션의 부호는 저작값으로 고정 — `gateHit`이 orientation 일치를 강제하므로 뒤집을 수 없다. 문구도 그렇게 가르친다).
- `[문구]` `FIVE LOCKS: + − + − +. THE SUM LANDS ON +1. UNLOCK THEM IN ORDER.`
- `[행동]` 각 잠금의 요구 부호 땅으로 이동해 그림자를 도킹. PACKET SUM 실시간 갱신 (`+1 → 0 → +1 → 0 → +1`).
- `[완료]` 5개 해제 (기존 판정).
- `[피드백]` 합이 감소하는 해제(2·4번째)에서: `OPPOSITE SIGNS CANCEL. THE LEDGER KEEPS ONLY THE INTEGER.` CANCEL meter 슬라이드-인. **이 미션의 발견은 상쇄다** — 부호 반전의 발견은 다음 미션의 것이다.

### STEP 6 — 자유 결산 (mission 05, 이 게임의 본편)

- `[트리거]` mission 05 시작.
- `[문구]` `FREE SHIFT: ALL FIVE CARGO, ANY ORDER, ANY ROUTE. CLOSE YOUR PATH AT HOME. LAND ON +1.`
- `[화면]` `HOME` 링 + 지상 화물 5개 상시 가시. **여기의 화물은 지상형이다 — 부호는 밟은 땅이 정한다.** 단, 실측상 이 미션의 5개 화물은 전부 반전 불가 위치에 있어 합은 +1로 고정된다. **이 미션의 도전은 부호 조작이 아니라 경로 설계다**: 제한 시간 105초 안에 5개를 어떤 순서·어떤 경로로 돌고 HOME으로 폐합하는가. (부호 반전의 발견은 STEP 2에서 이미 끝났다 — 여기로 옮기지 말 것.)
- `[완료]` 기존 판정 (전체 수집 + 경로 폐합 + 합 +1).
- `[실패]` 시간 초과 등으로 미완이면: 감점 없이 축약 evidence card — **경로 위에 실제 적립 부호를 순서대로 다시 그려서** 어디까지 갔는지 보여준다 (적립 부호 보관 필요 — §8 #4). 문구: `TIME RAN OUT AT <수집 수> / 5. YOUR ROUTE IS DRAWN — TIGHTEN IT AND RUN AGAIN.`
- `[피드백]` 완료 시 기존 evidence card 유지 (완성형). 최상단 캡션 한 줄: `THE LEDGER REMEMBERS ONLY THIS:` + 최종 정수. 총칙 7의 `TRY C` 시연은 이 미션의 대기 구간에 띄운다.

---

## 4. A 모드 튜토리얼 — 「감사 (The Audit)」

### A-0 — 모드 선택 화면

- 모드 카드의 수식(`3tanθ·t²−2t+tanθ=0`, `B⁺+C⁻→0` 등 — `shooter.html`의 카드 영역)을 **제거하고 SPEC/receipt 화면으로 이동.** 특히 `B⁺`/`C⁻`는 런타임에 존재하지 않는 유령 라벨이므로 (실제 ID는 `S0+`/`S2−`) 카드에서 반드시 삭제.
- 카드 문구:
  - `A · THE AUDIT — SHEETS ARE BORN AND KILLED AT FOLDS. PROVE WHICH.` (A3는 birth가 먼저 온다 — "죽음"만으로 프레이밍하지 않는다)
  - `B · THE ESCORT — CARRY A LIVING THREAD PAST THE CUSP.`

### A-1 — 첫 연결 (타이머 없음)

- `[트리거]` A1 진입.
- `[화면]` 좌 `t−1` / 우 `t` 패널. **타이머는 해당 transition의 첫 lock 성공까지 돌지 않는다.** (구현: `timeLeft` 감소를 `solvedEdges.length > 0` 조건으로 게이트 — transition마다 `solvedEdges`가 비워지므로 재장전 시 자동 적용. `pairSolved`로 게이트하지 말 것 — pair 없는 transition에서는 시작부터 true라 영원히 지연된다.)
- `[헤더]` (상시, 큰 글씨, 값은 시나리오 데이터에서 동적 생성) `TRANSITION 1 / 5 · θ 20° → 25° · FOLD AT 30°` (A1의 실제 프레임은 20°→35°다. 하드코딩 금지.)
- `[문구]` `CLICK S0+ ON THE LEFT. THEN CLICK THE SAME SHEET ON THE RIGHT.` (좌측 S0+ 맥동)
- `[행동]` 좌 S0+ → 우 S0+.
- `[완료]` trace lock.
- `[피드백]` 기존 lock 연출(beam + score + combo) 유지. 첫 lock 직후 1회: `A SHEET KEEPS ITS IDENTITY ACROSS TIME. THAT IS WHAT YOU AUDIT.`
- `[오류]` 잘못된 연결: 기존 교육적 오류 문구 유지. 현행 코드는 오연결에 감점이 없다(combo만 초기화) — 그대로 둔다.

### A-2 — 재생의 전진 (게임의 숨은 루프를 명시)

- `[트리거]` **해당 transition의 과제 완료** — 공유 edge 전부 lock **그리고** (pair가 있는 transition이면) pair lock까지 (= 기존 `continuationTaskComplete` 판정을 그대로 트리거로 쓴다. "edge 3개"로 하드코딩 금지 — 필요 edge 수는 transition마다 3/3/3/1/1처럼 다르며, birth/death transition은 edge 1개 + pair다).
- `[피드백]` 헤더 갱신 + **프레임 전환 연출**: 좌 패널이 우 패널 내용을 이어받는 슬라이드. 최초 1회 문구: `ALL LINKS CLOSED — THE RECORD ADVANCES.` fold까지 남은 transition 수를 헤더가 상시 보여준다.
- 이 연출이 없으면 플레이어는 자신이 전진하고 있음을 모른다. **진행도가 보이지 않는 진행은 진행이 아니다.**

### A-3 — fold 사건 (클라이맥스)

- `[트리거]` θ가 30°를 지나는 transition (A1의 4번째, `29.9° → 30.1°`).
- `[화면]` 죽는 pair — **`S0+`와 `S2−`** (런타임 ID를 그대로 표시; 생존자는 `S1+`) — 가 접근하며 인력선 표시. 헤더: `FOLD EVENT — A PAIR IS ABOUT TO ANNIHILATE. LOCK IT.`
- `[행동]` 한 레이어에서 두 root 클릭 → fold pair lock.
- `[피드백]` 소멸 연출(수렴 → 섬광 → 링) + `S0+ AND S2− ANNIHILATED. SIGNED MULTIPLICITY UNCHANGED.` + `AUDITED ✓` 도장.
- `[실패]` 시간 초과: 기존 리로드 유지, 문구는 메커닉을 정직하게: `THE PAIR DIED UNRECORDED. INTEGRITY −1. RELOADING THE RECORD.` (integrity는 영구 차감된다 — "되돌아간다"는 인상을 주는 문구 금지.)

### A-4 — 시나리오 A2·A3

- A2 (seam wrap): 헤더 서브라인 `A SHEET'S COORDINATE WRAPS — ITS IDENTITY DOES NOT.`
- A3 (cusp): birth가 먼저 온다 (T2에서 pair 탄생, T5에서 소멸). 헤더 서브라인: `THE SURVIVOR IS NOT WHO YOU THINK. PROVE IT.` 완료 receipt에 계보 다이어그램을 **런타임 ID로** 그림 표시 (`S0 → {S0, S1, S2} → 생존자`), 기각된 가짜 계보(원래 시트 생존설)에 붉은 취소선.

### A-5 — 정리

- 실패 화면: 사람 문장 2줄 (무엇이 / 다음에 뭘) + JSON receipt는 `SHOW RECEIPT` 토글 뒤로.
- steer pad는 A 모드에서 이미 숨겨져 있다 (작업 불필요). 대신 **pad 홀드 상태가 모드 전환 후 `document.body.dataset`에 잔존하는 버그**를 수정한다 (§8 #8).
- 배너 겹침: 두 표면을 각각 고친다 — `eventMessage`는 큐로 순차 표시(한 프레임에 다발 이벤트 소실 금지), `floater`는 동시 표시 시 y-오프셋 스태거. 모드 전환 시 두 표면 모두 클리어.

---

## 5. B 모드 튜토리얼 — 「호위 (The Escort)」

### B-0 — 판 읽기 (조작 전 3초)

- `[화면]`
  - **3-root 영역을 붉은 해칭으로 채운다.** 구현 주의: 현행 코드는 열린 호(critical curve) 하나만 stroke하며 닫힌 영역이 없다. (A,B) 평면을 격자 샘플링해 root 개수 3인 영역을 **사전 계산·캐시**해서 채운다 (`rawRootsForTarget`은 무거우므로 실시간 계산 금지 — §8 #9).
  - 라벨: `3 SHEETS OVERLAP — DO NOT ENTER`.
  - 축 라벨 상시: 세로 `A ↕ (W/S)`, 가로 `B ↔ (A/D)`.
  - GOAL 링의 반경은 실제 포획 반경(`stage.goalRadius`)을 화면 좌표로 반영한다 (현행 고정 16px 금지).
- `[문구]` (조작 은유를 명시 — §1) `YOU STEER THE BEACON — THE THREADS ON THE WEAVE ANSWER IT. CARRY S₀'S THREAD TO THE GATE. STAY OUT OF THE RED.`
- 진입 후 1.5초 입력 잠금 상태로 붉은 영역과 GOAL 카메라 강조.

### B-1 — 첫 호위 (Preserve)

- `[행동]` WASD로 beacon 조종. 우회가 필요하다는 것은 판정이 보장한다 (직진 경로는 3-root 영역을 지나 실패 — 테스트로 고정됨).
- `[힌트 경로]` **사전 계산된 3-root 영역에서 도출**한다 — 영역 경계 바깥을 지나는 실제 안전 경로를 점선으로 1회 표시. (문서가 경로 형상을 단정하지 않는다: "어느 쪽으로 도는가"는 계산된 영역이 정한다. 검증 없이 U자 힌트를 그리지 말 것.)
- `[grace]` **최초 붉은 영역 진입 시**: integrity 차감 없이 1.5초 무적 + 직전 안전 위치 원복 + **`everTriple` 래치 원복** (이걸 되감지 않으면 스테이지가 이미 실패 확정 상태로 계속되어 grace가 기만이 된다). 문구: `THREE SHEETS LIVE THERE. ROUTE AROUND THE RED.` 두 번째 진입부터 기존 감점.
- `[피드백]` 붉은 영역 경계 근접에 비례해 경고음이 조여든다 (P5 telegraph). 게이트 도달: `S₀ DELIVERED. THE THREAD LIVES.` + 호위 완료 연출.

### B-2 — 출생 기록 (Forge)

- `[문구]` `NOW ENTER THE RED — ON PURPOSE. TWO SHEETS ARE BORN THERE. TAG THE PAIR.`
- B-0의 금지를 **의도적으로 해제**시키는 반전이 이 모드의 설계 축이다. 진입 순간 해칭이 걷히고 세 시트가 분리되어 보이는 연출. root 2개 클릭으로 pair 태그 → `BIRTH RECORDED: +/− PAIR.`
- `[무반응 방지]` 태그하지 않은 채 GOAL 위에 서 있으면 (현행 코드는 이 상태에서 timeout까지 아무 일도 없다): 3초 후 프롬프트 `THE PAIR IS STILL UNRECORDED — TAG TWO NEWBORN ROOTS FIRST.` (총칙 4의 "무입력 대기 상태 금지").
- `[오류]` 오태그: `THAT PAIR WAS NOT BORN TOGETHER. WATCH WHO APPEARED TOGETHER.` (현행 코드상 감점 없음 — 그대로.)

### B-3 — 교대 (Exchange)

- `[문구]` `CROSS THE RED SO THE NEWBORN + SHEET IS THE ONE THAT SURVIVES.`
- 완료 receipt에 A-4와 동일 형식의 계보 다이어그램 (런타임 ID). 캡션: `SHIFT COUNTS IT. AUDIT PROVES IT. ESCORT CHOOSES IT.` — 세 모드 서사의 합류점.
- `[실패]` GOAL 도달 시 조건 미달로 실패하는 현행 판정 유지하되, 실패 문구가 **무엇이 미달인지** 말한다: `THE SURVIVOR IS <실제 생존자 ID> — NOT THE NEWBORN. CROSS THE RED BEFORE THE GATE.`

---

## 6. 완료·실패 화면 공통 규칙

1. Torus evidence card는 현행 유지 (완성형). 상단 픽션 캡션 한 줄만 추가.
2. 모든 실패 화면 형식: **1줄 — 무엇이 일어났나** / **1줄 — 다음에 뭘 하나** (남은 시간·필요 시간 같은 실행 가능한 수치 포함) / JSON 원문은 `SHOW RECEIPT` 토글 뒤.
3. `THE FINAL NUMBER WAS NOT ENOUGH.` 같은 판결문은 유지하되 반드시 위 2줄 뒤에 온다.

---

## 7. 숙달 축 — 두 번째 플레이가 첫 번째보다 나은 이유

튜토리얼은 첫 60초를 살리지만, 게임은 재도전에서 산다. 이미 코드에 있는 것을 먼저 쓴다:

1. **combo/score를 전면에** — A/B 모드에는 이미 combo 배수와 점수가 있다 (edge +100+combo×25, pair +220+combo×35). 현재 HUD 구석에 있다면 lock 순간의 punctuation에 combo 배수를 함께 태운다 (`×3` 글리프). 무연결 lock 성공 연쇄가 눈에 보이는 실력 표현이 되게 한다.
2. **evidence card에 시간과 랭크** — torus 각 미션과 A/B 각 스테이지에 클리어 시간을 기록하고, 저작된 par 시간 대비 랭크(예: AUDITED / CLEAN / FLAWLESS)를 카드에 찍는다. 판정 수학과 무관한 표시 계층이다.
3. **원클릭 재도전** — 모든 완료·실패 화면에 `RUN IT AGAIN` 버튼 (기존 R 키의 버튼화). 실패 화면에서 메뉴로 돌아가게 하지 않는다.
4. **[채택 보류] 목표 정수 변형** — `targetCharge`를 −1·0·+2로 바꾸는 안은 **현행 gate 배치에서 전부 도달 불가로 실측 확정**되었다 (획득당 ±1·gate 5개 → 합은 항상 홀수, 그리고 5개 전부 부호 반전 불가 → 합 +1 고정). 채택하려면 새 gate 집합(개수·좌표)을 저작하고 각 변형의 도달 가능성을 시뮬레이션으로 검증해야 한다 — 별도 저작 작업이며 이 브리프의 범위 밖. **숙달 축은 #1~#3만으로 착수한다** (전부 코드에 이미 있는 것을 쓰므로 즉시 가능).

---

## 8. 구현 체크리스트 (우선순위 순, 코드 앵커)

| # | 항목 | 위치 | 내용 |
|---|---|---|---|
| 1 | **두 캔버스 동시 가시** | `styles.css` (≈:1230, 940px 분기) | 세로 스택 제거, 나란히 축소. 코어 루프 생존 조건 — 최우선 |
| 2 | 목표물 가시성 | `src/main.js` `gateVisibility()` (:349-355) | ordered 미래 목표 `0.12 → 0.55`; `kind:"state"`의 pulse-gated 알파 0 제거 → 상시 ≥ 0.55; `drawDomainGate`의 alpha 0 early-return 경로 소멸 확인 |
| 3 | 획득 punctuation | `src/main.js` | 링 버스트 + 중앙 ±글리프 (실제 적립 부호) + combo 배수. 사운드는 기존 `sound.event` 재사용 |
| 4 | **적립 부호 보관** | `src/game.js` `collectGate()` (≈:558) | 계산된 `sign`을 이벤트로만 흘리지 말고 상태(`bankedSigns`)에 보관; 렌더는 `requiredOrientation`(저작값)이 아니라 적립값으로 표시. STEP 2·6의 동적 합계·실패 리플레이의 전제 |
| 5 | HUD 점진 공개 | `index.html` + `src/main.js` | 초기 4패널; 개념 최초 발생 시 슬라이드-인; ORIENTATION-λ̄ 연결 캡션 |
| 6 | Space = provenance 방위선 | `src/main.js` | 운반자→나머지 preimage 방위선 + λ̄ 태그 (신규 렌더) |
| 7 | A 진행 헤더 + 첫 lock까지 무타이머 | `src/trace-game.js`, `src/trace-mechanics.js` (타이머 감소 ≈:432) | 헤더 값은 시나리오 데이터에서 동적 생성; `solvedEdges.length > 0` 게이트 |
| 8 | 배너 2계층 수정 + pad 홀드 잔존 버그 | `src/trace-game.js` (eventMessage :145-148, floater :141-143) | eventMessage 큐, floater y-스태거, 모드 전환 시 클리어; `document.body.dataset` pad 상태 클리어 |
| 9 | B 3-root 영역 채움 + 축 라벨 + GOAL 실반경 | `src/trace-game.js`, `src/trace-mechanics.js` | (A,B) 격자 root-count 사전 계산·캐시 → 채움; `A ↕ / B ↔`; goalRadius 반영 |
| 10 | grace (무적+원복+래치 되감기) | `src/trace-mechanics.js` (everTriple ≈:653) | B 모드 첫 진입 한정; **everTriple 원복 필수**; A는 무타이머로 대체 |
| 11 | 실패 화면 인간화 | `src/trace-game.js` | 2줄 + `SHOW RECEIPT` 토글 + `RUN IT AGAIN` |
| 12 | 모드 카드 수식 이동 | `shooter.html` (카드 영역) | 수식·유령 라벨(`B⁺`/`C⁻`)을 SPEC/receipt로; 카드 문구는 A-0 |
| 13 | 검증 | `test/` | 기존 **37개** 테스트 전부 유지 통과; 튜토리얼 오버레이 상태·grace 래치 원복·적립 부호 보관은 결정론 레이어에 테스트 추가 |

**금지 사항**: 판정 수학(부호, preimage 수, 계보, 정수, `gateHit`/`updateCompletion`/`RUNNER_STAGES` 술어) 변경 금지. P7(표현 불변) 위반 금지. 픽션·UI 텍스트가 수학적으로 틀린 서술을 하는 것 금지 — 특히 (a) 화물에 부호가 내재한다는 서술 (지상 화물의 부호는 위치가 정한다), (b) 화물 결산을 위상 불변량 그 자체로 서술 (proxy임을 유지), (c) "역류선을 밟으면 데미지" 류 (P3 위반). UI에 표시하는 모든 수치·라벨은 하드코딩하지 말고 시뮬레이션 상태에서 읽는다.
