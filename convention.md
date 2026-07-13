# MUZIK IS MY LIFE — 협업 라이프사이클 및 컨벤션 가이드

안녕하세요! 팀 프로젝트 협업을 위해 반드시 알아야 할 규칙을 모았습니다.
처음 협업 규칙을 접하는 분들을 위해 **왜 이런 규칙이 필요한지** 상세히 설명해 두었으니, 개발을 시작하기 전 꼭 한 번 정독해주세요.

> 스택: iOS 네이티브(Swift/SwiftUI) · App Clips · Firebase

---

## 1. 커밋(Commit) 컨벤션 규칙

수많은 커밋이 쌓였을 때 "이 코드가 왜, 무엇을 위해 바뀌었는지"를 쉽게 파악하려면 규칙이 필요합니다. 우리는 널리 쓰이는 `Conventional Commits` 방식을 사용합니다.

### ✅ 커밋 메시지 규칙

첫 줄 형식: `[타입]: [작업 내용 요약(한글 포함)]`
예) `feat: 초대 링크로 App Clip 입장 기능 추가`

| 타입 | 언제 사용 | 예시 |
|---|---|---|
| **feat** | 새 기능 추가 | `feat: 하루 한 곡 등록 제한 로직 구현` |
| **fix** | 버그 수정 | `fix: 유튜브 링크 파싱 실패 오류 해결` |
| **design** | UI 디자인 변경 | `design: 재생 화면 카세트 테마 적용` |
| **refactor** | 기능 변경 없이 구조 개선 | `refactor: Firestore 접근 로직 Service로 분리` |
| **docs** | 문서/주석 수정 | `docs: 요구명세서 인수기준 보강` |
| **chore** | 설정·패키지 등 잡일 | `chore: Firebase SDK 의존성 추가` |
| **test** | 테스트 코드 | `test: 곡 등록 트랜잭션 테스트 추가` |

> 🚨 **시스템 강제**: 커밋 검사 봇(Husky + Commitlint)이 심어져 있습니다.
> - 규칙에 맞지 않는 타입이거나
> - **커밋 메시지에 한글이 하나도 없으면(순수 영어 커밋)**
>
> `git commit`이 **거부**됩니다. 최초 1회 `npm install`로 훅을 설치하세요.

---

## 2. 브랜치(Branch) 전략 규칙

모두가 `main`에 직접 쓰면 충돌이 나고 빌드가 깨집니다. 각자 브랜치에서 작업 후 병합하는 **Git Flow(단순화)**를 씁니다.

1. **`main`**: 스토어 배포용. 항상 빌드 성공 상태 유지, 직접 커밋 금지.
2. **`dev`**: 개발 통합 브랜치. 완성된 기능이 우선 합쳐지는 곳.
3. **`feature/이슈번호-기능명`**: 내 작업 브랜치. 예) `feature/12-applip-entry`, `feature/15-daily-theme`

### 👉 작업 순서 (매우 중요)
1. **Issue 생성** → 이슈 번호(예: #12) 발급
2. `git checkout dev` → `git pull origin dev`
3. `git checkout -b feature/12-내작업명`
4. 코딩 후 규칙에 맞게 커밋 & 푸시
5. GitHub에서 `feature/12-...` → `dev`로 **Pull Request** (템플릿 준수 필수)

---

## 3. Issue(이슈) 템플릿 — "작업 시작 전 반드시 이슈부터"

이슈는 **"나 이 작업 한다!"**를 알리는 작업 지시서입니다. 이슈 없이 바로 코딩하면 나중에 누가 왜 짰는지 추적이 안 됩니다.

- **중복 방지**, **진행 상황 추적**, **코드 연결**(PR에 `Close #12` → merge 시 이슈 자동 닫힘)
- 템플릿 2종: 기능 추가 `[FEAT]`, 버그 리포트 `[BUG]`
- **제목은 반드시 `[FEAT]` 또는 `[BUG]`로 시작**, 본문의 빈 `- ` 항목을 남기지 마세요.

> 🚨 **시스템 강제**: 제목 접두어가 없거나 본문이 비면 GitHub Action 봇이 이슈를 차단합니다.

---

## 4. Pull Request(PR) 템플릿 및 통합 검증(CI)

내 코드를 합치기 전 **"합쳐도 돼요?"**를 묻는 과정입니다. 코드 리뷰 + 자동 검증 + 기록의 목적이 있습니다.

- PR 생성 시 템플릿이 자동으로 채워집니다. **양식을 지우지 마세요.**
- **체크리스트 4개를 모두 `[x]`** 로 체크하고, `Close #이슈번호`를 반드시 기입하세요.

### 🤖 CI 봇이 실행하는 검사

| 검사 | 하는 일 | 실패하면? |
|---|---|---|
| **SwiftLint** | Swift 코드 스타일·크래시 위험(강제 언래핑 등) 검출 | ❌ 코드 고쳐서 다시 push |
| **Xcode 빌드 & 테스트** | 프로젝트가 에러 없이 빌드/테스트 통과하는지 (프로젝트 생성 후 활성화) | ❌ 빌드/테스트 수정 후 push |
| **PR 템플릿 검사** | 체크리스트 완료·본문 길이 검증 | ❌ PR 설명 보강 후 Edit |
| **CodeRabbit 리뷰** | AI 시니어 리뷰어가 한국어로 코드 검토 | 지적사항 반영 권장 |
| **팀원 승인(Approve)** | 최소 1명이 코드를 읽고 ✅ Approve | Merge 불가 유지 |

모든 조건이 충족되어야 Merge할 수 있습니다. (특히 팀원 Approve는 필수)

---

## 5. 시크릿(Secret) 관리 — 절대 커밋 금지

API 키·인증서 등 비밀 정보는 소스코드/GitHub에 올리면 안 됩니다.

- **`GoogleService-Info.plist`** (Firebase 설정): `.gitignore` 처리됨. 팀원끼리 **별도 채널(메신저 등)로 공유**하세요.
- **`Secrets.xcconfig`**: 로컬 시크릿용. `Secrets.example.xcconfig`를 복사해 만들고, 실제 값은 커밋하지 않습니다. 새 키를 추가하면 example에도 껍데기를 추가해 팀원에게 알리세요.
- **YouTube Data API 키는 앱에 넣지 않습니다** — Cloud Functions(서버)에만 보관합니다. (요구명세서 NFR-04)
- 인증서/프로비저닝(`*.p8`, `*.p12`, `*.mobileprovision`)도 커밋 금지.

---

## 6. 최초 세팅 (팀원 온보딩)

```bash
# 1. 저장소 클론
git clone https://github.com/team-muzikismulife/muzik.git
cd muzik

# 2. 커밋 훅 설치 (Node 필요 — 커밋 규칙 검사용)
npm install

# 3. SwiftLint 설치 (커밋 시 자동 린트)
brew install swiftlint

# 4. GoogleService-Info.plist 를 팀에게 받아 Xcode 프로젝트에 추가
# 5. Secrets.example.xcconfig 를 복사해 Secrets.xcconfig 작성
```
