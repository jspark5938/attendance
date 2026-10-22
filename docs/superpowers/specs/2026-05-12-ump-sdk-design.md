# UMP SDK 적용 설계

**날짜:** 2026-05-12
**범위:** Android AdMob 광고 동의 수집 (GDPR / UMP)

---

## 배경

Google AdMob 정책상 GDPR 적용 지역(EEA) 사용자에게 광고 개인화 동의를 수집해야 한다.
`@capacitor-community/admob` v8에 UMP API(`requestConsentInfo`, `showConsentForm`, `showPrivacyOptionsForm`)가 내장되어 있으므로 별도 네이티브 의존성 추가 없이 구현 가능하다.

---

## 변경 파일

| 파일 | 변경 내용 |
|------|-----------|
| `js/services/ads.js` | UMP 동의 흐름 추가, `showPrivacyOptions()` 메서드 추가 |
| `js/pages/settings.js` | 개인정보 설정 버튼 렌더링 및 이벤트 연결 |
| `js/locales/ko.js` | `settings.privacyOptions`, `settings.privacyOptionsDesc` 추가 |
| `js/locales/en.js` | 동일 키 영문 추가 |
| `js/locales/ja.js` | 동일 키 일문 추가 |

Android sync 파일(assets, build intermediates)은 `npm run sync` 시 자동 반영.

---

## `ads.js` 설계

### 추가 상수

```js
// 0 = 실제 지역 기반 (배포용)
// 1 = EEA 강제 (GDPR 테스트)
// 3 = 미국 규제 주 강제 (CCPA 테스트)
const DEBUG_GEOGRAPHY = 1;
```

### 공개 메서드 변경

```
init(isPremium)
  └─ isAndroid → _requestConsent() → canRequestAds? → _initAdMob()
```

`init()`이 `_initAdMob()`을 직접 호출하던 것을 `_requestConsent()`를 거쳐 호출하도록 변경.

### 추가 메서드

**`_requestConsent()`**
1. `AdMob.requestConsentInfo({ debugGeography: DEBUG_GEOGRAPHY })` 호출
   - `0` = DISABLED (실제 지역 기반, 배포용)
   - `1` = EEA 강제 (GDPR 테스트)
   - `3` = 미국 규제 주 강제 (CCPA 테스트)
2. `info.isConsentFormAvailable && info.status === 'REQUIRED'` 이면 `AdMob.showConsentForm()` 호출
3. 최종 `info.canRequestAds` 반환

**`showPrivacyOptions()`** (공개 메서드)
- `AdMob.showPrivacyOptionsForm()` 호출
- Android + 비프리미엄 환경에서만 Settings 페이지가 호출
- 오류는 `console.warn`으로 무시 (폼 미표시 시 별도 UX 불필요)

### 동의 결과에 따른 흐름

```
canRequestAds === true  → _initAdMob() 정상 진행
canRequestAds === false → 배너 표시 생략, _setOffset(0) 호출하지 않음
```

---

## Settings 페이지 설계

### 렌더링 조건

Settings 페이지 `render()` 시 `AdsService.getPrivacyOptionsStatus()`를 호출해
`privacyOptionsRequirementStatus === 'REQUIRED'` 이고 Android일 때만 버튼 행을 "앱 정보" 카드에 추가.

### `AdsService.getPrivacyOptionsStatus()`

- `requestConsentInfo()` 를 다시 호출하지 않고, 마지막 동의 정보를 `_lastConsentInfo` 필드에 캐시
- Settings 페이지는 캐시에서 읽기만 함

### 버튼 UI

"앱 정보" 카드 내 기존 버전/개발자 행 아래에 추가:

```
개인정보 설정      [변경]   ← 버튼 클릭 시 showPrivacyOptionsForm() 호출
```

---

## i18n 키

| 키 | ko | en | ja |
|----|----|----|-----|
| `settings.privacyOptions` | 개인정보 설정 | Privacy Options | プライバシー設定 |
| `settings.privacyOptionsDesc` | 광고 개인화 동의를 변경합니다 | Change ad personalization consent | 広告パーソナライズの同意を変更します |
| `settings.privacyOptionsBtn` | 변경 | Change | 変更 |

---

## 테스트 시나리오

1. `DEBUG_GEOGRAPHY = 1` (EEA) 상태에서 앱 실행 → GDPR 동의 폼 표시 확인
1-1. `DEBUG_GEOGRAPHY = 3` (US) 으로 변경 후 앱 실행 → CCPA 옵션 폼 표시 확인
2. 동의 후 재실행 → 폼 미표시, 배너 정상 로드 확인
3. Settings → 개인정보 설정 → Privacy Options 폼 표시 확인
4. 동의 거부 후 → 배너 미표시 확인
5. 프리미엄 사용자 → Settings에 버튼 미표시 확인 (광고 자체 없음)

---

## 배포 전 체크리스트

- [ ] `DEBUG_GEOGRAPHY` → `0`으로 변경
- [ ] AdMob 콘솔에서 GDPR 메시지 설정 확인
