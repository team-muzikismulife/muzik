# 의존성 감사와 적용 범위

2026-09-21, MUZIK-BETA-03. 기준 d9f7098. `npm audit --json`, `npm --prefix functions audit --json`, 각 `--omit=dev` 결과, `npm ls --all`, 두 lockfile의 실제 경로와 아래 공식 GH advisory를 대조했다. audit의 숫자는 상위 패키지로 전파된 경고도 포함하므로 서로 다른 취약점/공격 경로 수와 같지 않다.

## 수정 전후

| 대상 | 이전 전체 | 이후 전체 | 이후 omit=dev |
|---|---|---|---|
| 앱/빌드 도구 | 45 (high15/moderate30) | 28 (high6/moderate22) | 22 (high6/moderate16) |
| Functions | 13 (high1/moderate12) | 9 (high0/moderate9) | 9 (high0/moderate9) |

원본 감사 JSON은 로컬 `scratch/audit-before-{app,functions}.json`, `scratch/audit-after-{app,functions}.json`, `scratch/audit-production-{app,functions}.json`에 보관했다. 생성 진단 파일은 PR에서 제외한다. `omit=dev`도 Expo가 포함하는 빌드 도구를 포함하므로 웹 번들에 실제 포함되는 경로와 따로 판단했다. 정적 Vercel 사이트에 이 프로젝트의 npm CLI/Metro 서버가 실행되는 구조는 아니다.

## 적용한 변경

- Expo53, React Native0.79.2, Firebase Admin13, Functions6의 major는 유지. `audit fix --force`는 사용하지 않았다.
- 서버/클라이언트 qs 6.15.3→6.16.0, Express4.22.2→4.22.3, body-parser1.20.6→1.20.8. 부모의 고정 qs 의존성까지 올려 중복 취약 버전을 남기지 않았다. [qs 수정 기준 6.16.0](https://github.com/advisories/GHSA-4mjr-xmp4-gh2g). Functions callable은 JSON 입력을 받지만 프레임워크의 파서 의존성도 패치했다.
- Functions Admin→Storage→fast-xml-parser5.10.0→5.11.1. 현재 앱에서 Storage API 호출은 없지만 배포 의존성의 XML DoS를 제거했다. [수정 기준 5.10.1](https://github.com/advisories/GHSA-8r6m-32jq-jx6q).
- Expo metro-config가 고정하던 PostCSS8.4.49를 scoped override `^8.5.23`으로 갱신(잠금8.5.28). 같은 major 안에서 CSS/source-map 처리 취약점을 수정하고 실제 export를 검사했다. [수정 기준 8.5.23](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp).
- 기타 호환 패치: xmldom0.8.15/0.9.12, brace-expansion1.1.21/2.1.7, js-yaml3.15.2/4.3.2, nanoid3.3.19, tar7.5.22, fast-uri3.1.8, browserslist4.29.0, baseline-browser-mapping2.11.25, ip-address10.7.2, Hono4.13.8, Hono node-server1.19.17, morgan1.12.1, undici6.28.1. 부모가 허용한 범위만 업데이트했고 lockfile에 실제 버전/무결성이 기록됐다. [brace-expansion](https://github.com/advisories/GHSA-rgw5-rvv9-x895), [js-yaml](https://github.com/advisories/GHSA-2883-xcg3-v3hh), [nanoid](https://github.com/advisories/GHSA-2v37-7h3g-55p8), [tar](https://github.com/advisories/GHSA-r292-9mhp-454m).
- Firebase CLI→superstatic→re2 1.24.1→1.26.1. [수정 기준1.26.1](https://github.com/advisories/GHSA-j4r3-hg7j-8chg). 이 minor는 Node `^22.22.2 || ^24.15.0 || >=26` 요구사항이 있어 갱신/서버 회귀는 Node22.23.2로 실행했다. native 빌드 하위 도구 node-gyp13/nopt10 등은 re2의 새 의존성으로 따라온 변경이며 애플리케이션 프레임워크 major 변경은 아니다. 개발 환경도 지원 Node 버전을 써야 한다.
- React Navigation core7.22.1로 올리면 query-string 의존성이 없어지지만, Expo Router5.0.7이 그 패키지를 선언 없이 직접 참조하여 실제 export가 실패했다. 이 변경은 채택하지 않고 `@react-navigation/core: 7.21.5` override로 기존 호환 버전을 고정했다. 오류를 숨기려고 임의 shim/새 major query-string/가짜 성공 빌드를 넣지 않았다.

## 남은 실제 영향과 출시 조건

| 경로 | 노출/판단 | 조치 |
|---|---|---|
| Expo Router + Navigation→query-string7→decode-uri-component0.2.2 (moderate, 상위4개 경고) | 웹 의존성에 포함된다. React Navigation 기본 getStateFromPath는 queryString.parse를 호출하지만 현재 Expo Router는 자체 fork와 URL.searchParams를 사용한다. **BETA-04 정적 번들의 제한된 55개 링크 회귀에서 decoder 호출0, 정상/오류 복구 경로 통과**. 패키지 존재와 실제 도달 가능성을 구분한다 | 로컬 출시 차단 검토는 완료: [실행 근거와 한계](url-boundary-review.md). 현재 테스트 범위에서 decoder 노출이 재현되지 않아 강제 major/ESM override는 하지 않음. 취약점 경고는 남으며 Router/Navigation 변경 또는 새 링크 파서 도입 시 이 회귀/호출 검토를 다시 실행. [고친 버전0.5.0](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr) 호환 조합 갱신은 후속 유지보수 |
| RN→community-cli-plugin→Metro0.82.5→image-size1.2.1 (high6개 전파) | Node의 이미지 자산 빌드/개발서버 경로. 원격 YouTube 썸네일은 브라우저가 로딩하며 Metro에서 사용자 업로드를 파싱하지 않는다 | 신뢰된 저장소 자산만 빌드, Metro를 공용 인터넷에 노출하지 않음. [ICNS advisory](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr)와 JXL/HEIF 경고는 그대로 남음. 이미지 업로드 빌드/비신뢰 자산 처리 도입 전 SDK/Metro 호환 업데이트를 별도 검증 |
| Functions Admin→Firestore→google-gax / Storage→gaxios·teeny-request→uuid9.0.1 (moderate9개 전파) | 운영 서버 의존성이다. 설치된 google-gax util, gaxios multipart, teeny-request multipart 호출은 모두 **v4()**. [취약 API는 외부 버퍼를 받는 v3/v5/v6](https://github.com/advisories/GHSA-w5hq-g745-h8pq)이며 현재 사용 경로에서는 해당 호출을 찾지 못했다 | 잔여 경고를 면제하거나 없다고 표시하지 않음. Admin/Functions major 호환 업데이트는 후속. v3/v5/v6+외부 버퍼를 도입하면 재평가. 출시 리뷰에서 현재 도달 경로 판단을 승인 |
| Expo config-plugins→xcode→uuid7 (moderate 전파) | 네이티브 프로젝트 생성 도구. 코드상 uuid.v4()만 사용. 모바일 웹 번들 동작과 구분 | native 빌드 확대 전 SDK 업그레이드 검토. 같은 uuid advisory 근거 적용 |
| Firebase CLI→PubSub→OpenTelemetry core1.30.1 | 로컬/CI 도구. 이 Functions 코드에는 PubSub 트리거나 외부 baggage 수신 처리 없음 | [수정 버전2.8.0](https://github.com/advisories/GHSA-8988-4f7v-96qf)은 major 차이. 도구 접근 제한, 메시지 기반 에뮬레이터 기능 도입 전 검토 |
| Firebase CLI→csv-parse5 / stream-json1 | auth-import, database-import, Next 프레임워크 처리 등 CLI 경로. MUZIK 사용자에게 CSV/JSON 임포트 기능을 제공하지 않음 | 외부 불신 파일 임포트 금지. [csv7.0.2](https://github.com/advisories/GHSA-8cw4-87c7-c6xx), [stream-json3.5.0](https://github.com/advisories/GHSA-528h-pc64-c93x)로의 도구 호환 업데이트는 별도 |

URL 디코더는 웹 의존성이므로 단순 개발도구 경고로 묶지 않았으나, 패키지 존재와 취약 함수의 실제 도달 가능성은 구분했다. 근거는 Expo Router build/getLinkingConfig.js, link/linking.js, fork/getStateFromPath-forks.js의 parseQueryParams와 Navigation core의 getStateFromPath.tsx다. 나머지 경로 판단도 새 기능/라이브러리 호출이 추가되면 달라질 수 있다. 이번 감사는 전체 침투 테스트나 운영 안전성 보증이 아니다.

## 검증 범위

타입/Functions 빌드 PASS. Node22 로컬 에뮬레이터31개 + legacy6개 PASS. 호환성 복원 후 웹 export PASS, 그 정적 dist에 두 브라우저 가입/초대/등록/오류재시도/재방문/개인숨김/닉네임/신고/날짜 플리 회귀 PASS. CI에 export 및 legacy 검사를 추가했다. 최신 원격 HEAD 결과는 PR40 Checks와 launch-worker-report.md 최종 기록을 확인한다. 실제 YouTube/App Check/운영 DB/Safari·카카오/네이티브는 이 결과로 검증되지 않는다.

Vercel59.23.2의 기존 실패 deployment `63bCa7hT9rvYVdBCjEw8mWAHYfSK` inspect --logs는 자격증명이 없어 인증 안내로 전환되었고 즉시 취소했다. 로그인 승인/키 입력/배포/임시 프로젝트 생성 없음. 따라서 원격 빌드 실패의 근본 원인은 아직 로그로 확인되지 않았다. 로컬 export 성공과 원격 Preview 실패는 별개다.
