import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import perfectionist from 'eslint-plugin-perfectionist'
import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig([
  globalIgnores(['dist/']),
  js.configs.recommended,
  tseslint.configs.recommended,
  perfectionist.configs['recommended-natural'],
  {
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'perfectionist/sort-imports': [
        'error',
        {
          groups: [['builtin', 'external'], 'internal', ['parent', 'sibling', 'index'], 'unknown'],
          newlinesBetween: 1,
        },
      ],
      'perfectionist/sort-modules': 'off',
      'perfectionist/sort-union-types': ['error', { groups: ['unknown', 'nullish'] }],
    },
  },
  prettier,
])
