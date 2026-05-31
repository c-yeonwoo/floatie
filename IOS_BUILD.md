# 결 — iOS 앱 빌드 가이드

결을 App Store에 올리기 위한 단계별 가이드입니다. **Mac + Xcode + Apple Developer 계정($99/년)** 이 필요합니다.

---

## 1. 사전 준비

- macOS (최신)
- [Xcode](https://apps.apple.com/us/app/xcode/id497799835) 최신 버전
- [Apple Developer Program](https://developer.apple.com/programs/) 가입
- [Bun](https://bun.sh) 또는 Node.js 20+
- CocoaPods: `sudo gem install cocoapods`

---

## 2. 프로젝트 가져오기

Lovable에서 GitHub로 export → 로컬 클론:

```bash
git clone <your-repo-url> gyeol
cd gyeol
bun install
```

---

## 3. iOS 플랫폼 추가 (최초 1회)

```bash
bun run build           # dist/ 생성
npx cap add ios         # ios/ 폴더 생성
npx cap sync ios        # 웹 자산 + 플러그인 동기화
```

`ios/App/App/Info.plist` 에서 권한 문구를 추가하세요 (사진/카메라 사용 시 필수):

```xml
<key>NSCameraUsageDescription</key>
<string>질문에 사진으로 답하기 위해 카메라를 사용합니다.</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>질문에 답할 사진을 선택하기 위해 사진 라이브러리에 접근합니다.</string>
<key>NSPhotoLibraryAddUsageDescription</key>
<string>저장된 결을 사진 앱에 보관하기 위해 사용합니다.</string>
```

---

## 4. Xcode 열기 & 빌드

```bash
npx cap open ios
```

Xcode에서:
1. 좌측 트리에서 **App** 프로젝트 선택
2. **Signing & Capabilities** 탭 → Team 본인 Apple Developer 팀 지정
3. **Bundle Identifier**: `app.gyeol.client` (또는 본인 도메인)
4. 시뮬레이터 / 실기기 선택 후 ▶️ Run

---

## 5. 변경사항 반영 흐름

웹 코드를 수정할 때마다:

```bash
bun run build
npx cap sync ios
```

라이브 리로드로 개발하려면 `capacitor.config.ts` 의 `server.url` 주석을 풀고 Lovable 프리뷰 URL을 넣은 뒤 `npx cap sync ios` 다시 실행.

---

## 6. App Store 제출

1. Xcode 메뉴: **Product → Archive**
2. Organizer 창에서 **Distribute App → App Store Connect → Upload**
3. [App Store Connect](https://appstoreconnect.apple.com) 에서 메타데이터/스크린샷/심사 정보 입력
4. 심사 제출 (보통 24~48시간)

### 심사 시 주의
- 이메일 인증 / 구글 로그인 둘 다 동작해야 함
- 신고/차단 기능 필수 (이미 구현됨 ✅)
- 사진 권한 문구 명확히
- 4.0 인치, 6.5 인치, 6.7 인치 스크린샷 준비

---

## 7. 추천 추가 플러그인 (선택)

```bash
bun add @capacitor/camera @capacitor/share @capacitor/haptics @capacitor/status-bar @capacitor/splash-screen
npx cap sync ios
```

- **Camera**: 네이티브 카메라/사진 선택
- **Share**: 답변 공유
- **Haptics**: 좋아요/탭 반응
- **StatusBar / SplashScreen**: 첫 인상 튜닝

---

## 트러블슈팅

| 증상 | 해결 |
|---|---|
| `pod install` 실패 | `sudo gem install cocoapods`, `cd ios/App && pod repo update && pod install` |
| 흰 화면만 보임 | `bun run build` → `dist/index.html` 있는지 확인, `npx cap sync ios` 재실행 |
| 인증 콜백이 안 옴 | Supabase Auth → Redirect URLs에 `app.gyeol.client://` 추가 |
| 사진 업로드 안 됨 | Info.plist 권한 문구 확인 |
