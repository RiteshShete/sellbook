import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'

export default tseslint.config(
  { ignores: ['dist', 'node_modules', '.agents', '.claude', 'src/types/database.ts', 'supabase', 'public/sw.js'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}', 'vite.config.ts'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
    },
  },
  { files: ['scripts/**/*.mjs'], languageOptions: { globals: globals.node } },
  {
    // The storefront is its own small bundle: it may use src/lib, src/components/ui and the shared sign-in code in
    // features/auth, never the owner features (STOREFRONT_PLAN 4.1).
    files: ['src/features/storefront/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'activity', 'admin', 'analytics', 'billing', 'catalog', 'delivery', 'orders', 'payments', 'plan',
                'productImport', 'settings', 'trash',
              ].flatMap((f) => [`**/${f}`, `**/${f}/**`]),
              message: 'The storefront must not import owner features (keeps its bundle small and separate).',
            },
          ],
        },
      ],
    },
  },
)
