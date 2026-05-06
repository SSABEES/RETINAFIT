import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import svelte from 'eslint-plugin-svelte'
import globals from 'globals'

export default [
  {
    // public/ 의 ort/mediapipe wasm 어댑터는 벤더 번들이라 lint 대상에서 제외.
    // dist/.vite/node_modules 는 빌드 산출물 / 외부 패키지.
    ignores: ['dist/**', 'node_modules/**', '.vite/**', 'public/**'],
  },
  js.configs.recommended,
  ...svelte.configs.recommended,
  prettier,
  ...svelte.configs.prettier,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2024,
      },
    },
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      // `_` 또는 `_*` 프리픽스 변수는 의도된 throwaway 로 간주 (예: each 블록의 index 만 필요한 경우).
      'no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    // 빌드 보조 스크립트 (public 동기화 등) 는 Node 환경에서 돌고 console 사용이 정상이라
    // no-console 규칙을 풀어둔다.
    files: ['scripts/**/*.{js,mjs}'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-console': 'off',
    },
  },
  {
    files: ['*.config.js', 'eslint.config.js', 'svelte.config.js', 'vite.config.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
]
