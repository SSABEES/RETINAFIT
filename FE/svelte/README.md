## 기술 스택

- Svelte 5
- Vite
- Tailwind CSS 4
- @maks11060/svelte5-router
- JavaScript

## 시작하기

### 의존성 설치

```bash
npm install
```

### 개발 서버 실행

```bash
npm run dev
```

### 프로덕션 빌드

```bash
npm run build
```

### 빌드 결과 미리보기

```bash
npm run preview
```

## 폴더 구조

```text
FE/
├─ public/
│  ├─ favicon.svg
│  └─ icons.svg
├─ src/
│  ├─ components/
│  │  ├─ button/
│  │  ├─ camera/
│  │  ├─ card/
│  │  ├─ form/
│  │  ├─ input/
│  │  ├─ layout/
│  │  ├─ loading/
│  │  ├─ modal/
│  │  └─ toast/
│  ├─ config/
│  │  ├─ config.js
│  │  ├─ path.js
│  │  └─ routes.js
│  ├─ lib/
│  │  ├─ api/
│  │  ├─ flutter/
│  │  └─ index.js
│  ├─ router/
│  │  ├─ analysis/
│  │  ├─ auth/
│  │  ├─ dashboard/
│  │  ├─ users/
│  │  └─ HomePage.svelte
│  ├─ app.css
│  ├─ App.svelte
│  └─ main.js
├─ index.html
├─ package.json
├─ svelte.config.js
└─ vite.config.js
```

## 주요 디렉터리 역할

### `src/components`

여러 화면에서 재사용하는 공용 컴포넌트를 둡니다. 현재는 역할별로 `button`, `input`, `modal`, `layout`처럼 하위 폴더를 나누어 관리합니다.

### `src/router`

실제 화면 단위의 Svelte 파일을 둡니다. URL 단위로 접근되는 페이지는 이 폴더 아래에 배치합니다.

예시:

- `/auth/login` → `src/router/auth/login.svelte`
- `/analysis/result` → `src/router/analysis/result.svelte`
- `/users/:id` → `src/router/users/[id].svelte`

### `src/config`

라우팅, 경로 상수, 앱 설정처럼 전역에서 공유하는 설정 파일을 둡니다.

- `path.js`: 화면 이동에 사용할 URL 상수와 동적 경로 함수
- `routes.js`: 라우터에 등록할 페이지 목록
- `config.js`: 프로젝트 공통 설정 확장용 파일

### `src/lib`

외부 API 클라이언트, Flutter 연동 브리지, 공용 export처럼 화면이나 UI 컴포넌트에 직접 종속되지 않는 코드를 둡니다.

### `src/app.css`

Tailwind CSS import와 전역 기본 스타일을 관리합니다. 페이지별 세부 스타일은 가능하면 컴포넌트 내부 또는 Tailwind 유틸리티 클래스로 처리합니다.

## 라우팅 규칙

새 페이지를 추가할 때는 다음 순서를 따릅니다.

1. `src/router` 아래에 페이지 컴포넌트를 생성합니다.
2. `src/config/path.js`에 경로 상수를 추가합니다.
3. `src/config/routes.js`에 페이지 컴포넌트를 import하고 `routes` 배열에 등록합니다.
4. 화면 이동이 필요한 곳에서는 문자열 URL을 직접 쓰기보다 `PATH` 값을 사용합니다.

정적 경로는 `PATH`에 문자열로 정의합니다.

```js
export const PATH = {
  login: '/auth/login',
}
```

동적 경로는 이동용 함수와 라우터 매칭용 패턴을 분리합니다.

```js
export const PATH = {
  userDetail: (id) => `/users/${String(id)}`,
}

export const ROUTE_PATH = {
  userDetail: '/users/:id',
}
```

## 컴포넌트 작성 규칙

### 파일명

- 컴포넌트 파일명은 현재 구조에 맞춰 `snake_case.svelte`를 사용합니다.
- 페이지 파일은 기존 라우터 구조에 맞춰 소문자 파일명을 사용합니다.
- 동적 라우트 파일은 `[id].svelte`처럼 파라미터 이름을 대괄호로 표현합니다.

예시:
   
- `primary_button.svelte`
- `password_input.svelte`
- `base_modal.svelte`
- `users/[id].svelte`
 
### 배치 기준

- 여러 페이지에서 재사용하면 `src/components`에 둡니다.
- 특정 페이지에서만 쓰는 화면 조합 컴포넌트는 해당 `src/router` 하위 폴더에 두는 것을 우선합니다.
- API, 브리지, 순수 유틸리티는 `src/lib`에 둡니다.
- 단순 경로, 라우트, 환경 설정은 `src/config`에 둡니다.

### 스타일 규칙

- 기본 스타일은 Tailwind 유틸리티 클래스를 우선 사용합니다.
- 전역에 영향을 주는 스타일만 `src/app.css`에 추가합니다.
- 반복되는 UI 패턴은 공용 컴포넌트로 분리합니다.
- 버튼, 입력창, 모달처럼 상태가 있는 컴포넌트는 `disabled`, `loading`, `error`, `open` 등 필요한 상태 표현을 함께 고려합니다.

### Import 규칙

- 같은 기능 안의 짧은 상대 경로는 상대 import를 사용해도 됩니다.
- 여러 위치에서 공유되는 경로 상수와 라우트 정보는 `src/lib/index.js`에서 export하므로 필요에 따라 한 곳에서 가져올 수 있습니다.
- 깊은 상대 경로가 반복되면 export 지점을 추가하거나 구조를 조정합니다.

## 새 기능 추가 체크리스트

1. 화면이 필요한 기능인지, 공용 컴포넌트만 필요한 기능인지 먼저 구분합니다.
2. 페이지가 필요하면 `src/router`에 페이지를 추가합니다.
3. URL이 필요하면 `src/config/path.js`와 `src/config/routes.js`를 함께 수정합니다.
4. 재사용 UI는 `src/components/{역할}/`에 추가합니다.
5. API 호출은 `src/lib/api`에 추가하거나 기존 클라이언트를 확장합니다.
6. Flutter 연동이 필요하면 `src/lib/flutter` 아래에 책임을 분리합니다.
7. 실행 후 `npm run build`로 빌드 오류를 확인합니다.
