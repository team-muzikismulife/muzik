# MUZIK 프로젝트 가이드

## 언어
- 모든 응답, 설명, 계획, 요약, 도구 실행 설명(description)은 **한국어**로 작성한다.
- 코드 주석과 커밋 메시지도 한국어로 작성한다. (커밋은 commitlint로 한글 + conventional type 강제됨)

## 기술 스택
- 순수 네이티브 Swift (SwiftUI) + App Clips + Firebase.

## 작업 흐름 (반드시 준수)
1. 이슈 생성 (`[FEAT]`/`[BUG]` 접두어)
2. `dev`에서 `feature/이슈번호-기능명` 브랜치 생성
3. 커밋 (commitlint: 한글 필수 + conventional type)
4. PR로 `dev`에 병합 (템플릿 체크리스트 4개 `[x]` + `Close #N`)
- `main`/`dev`는 브랜치 보호 (PR 필수, status checks: `SwiftLint 검사`·`check-template`).

## Figma → SwiftUI
- Figma Dev Mode MCP 서버(`figma-dev-mode`, `http://127.0.0.1:3845/mcp`)로 선택된 프레임을 읽어 SwiftUI로 변환한다.
- 디자인 토큰(색상/폰트/간격)을 별도로 정의하고, 프레임을 재사용 가능한 컴포넌트 단위로 구성한다.
- 자동 변환보다 시맨틱한 SwiftUI 코드(HStack/VStack/spacing) 재구성을 우선한다.
