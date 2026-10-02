import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import perfectionist from 'eslint-plugin-perfectionist'
import reactHooks from 'eslint-plugin-react-hooks'
import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig([
  globalIgnores(['.claude/', '.output/', '.wxt/', 'coverage/', 'web-ext-artifacts/']),
  js.configs.recommended,
  tseslint.configs.recommended,
  jsxA11y.flatConfigs.recommended,
  perfectionist.configs['recommended-natural'],
  {
    rules: {
      // Imports go external, then `@/`, then relative, with type imports alongside the rest.
      'perfectionist/sort-imports': [
        'error',
        {
          groups: [['builtin', 'external'], 'internal', ['parent', 'sibling', 'index'], 'unknown'],
          newlinesBetween: 1,
        },
      ],
      // Modules read top-down, from what they export to the helpers it leans on.
      'perfectionist/sort-modules': 'off',
      // `string | null`, not `null | string`.
      'perfectionist/sort-union-types': ['error', { groups: ['unknown', 'nullish'] }],
    },
  },
  {
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/rules-of-hooks': 'error',
    },
  },
  {
    languageOptions: {
      globals: { ...globals.browser },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  prettier,
])
