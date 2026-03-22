# 출석부 앱

학생 출결을 쉽고 빠르게 관리하는 PWA 웹앱 + Android 앱.

## 실행 방법

### 웹 브라우저 (개발)

```bash
# Python으로 로컬 서버 실행 (HTTPS 없이도 대부분 동작)
python -m http.server 8080
# 또는
npx serve .
```

브라우저에서 `http://localhost:8080/attendance-app/` 접속.

> **참고**: 서비스 워커는 HTTPS 또는 localhost에서만 동작합니다.

### 배포 (무료)

| 서비스 | 방법 |
|---|---|
| GitHub Pages | 레포지터리 → Settings → Pages → 루트 폴더 |
| Netlify | `attendance-app` 폴더를 드래그 앤 드롭 |
| Cloudflare Pages | GitHub 연결 후 빌드 커맨드 없이 배포 |

### Android APK (Capacitor)

```bash
# 1. Node.js 필요 (nodejs.org에서 설치)
npm install -g @capacitor/cli

# 2. attendance-app 폴더에서 실행
cd attendance-app
npx cap init "출석부" "com.yourname.attendanceapp" --web-dir "."
npx cap add android
npx cap sync android
npx cap open android  # Android Studio가 열림
```

Android Studio에서 Build → Generate Signed APK로 배포용 APK 생성.

## 기능

- **그룹 관리**: 반/클래스 그룹 생성, 수정, 삭제
- **학생 관리**: 학생 추가, 번호/메모 관리
- **출석 체크**: 출석/결석/지각/조퇴 원터치 마킹
- **달력 뷰**: 월별 출석 현황 달력
- **통계**: 학생별/일별 출석 통계 (차트는 프리미엄)
- **내보내기**: CSV/PDF 내보내기 (프리미엄)
- **오프라인 동작**: 인터넷 없이도 완전 동작
- **PWA**: 홈화면 설치 지원

## 수익화

### 무료 티어
- 그룹 1개, 학생 20명
- 기본 출석 체크, 달력, 기본 통계
- 광고 표시

### 프리미엄 (`PREMIUM2024` 테스트 코드)
- 무제한 그룹/학생
- 고급 통계 차트
- CSV/PDF 내보내기
- 광고 없음

## 기술 스택

| 항목 | 기술 |
|---|---|
| 언어 | HTML5, CSS3, Vanilla JS (ES Modules) |
| 데이터 | IndexedDB (오프라인 퍼스트) |
| 달력 | Flatpickr |
| 차트 | Chart.js |
| PDF | jsPDF + autoTable |
| PWA | Web App Manifest + Service Worker |
| Android | Capacitor.js |
| 광고(웹) | Google AdSense |
| 광고(앱) | AdMob via Capacitor |
