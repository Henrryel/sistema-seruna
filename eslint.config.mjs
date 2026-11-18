import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  {
    ignores: ['.next/**', 'node_modules/**', 'storage/**', 'public/sw.js', 'src/server/db/tipos.ts', 'next-env.d.ts'],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Kysely/SQL solo en repositorios: los componentes cliente no pueden importar del servidor.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['pg', 'kysely'], message: 'Usa los repositorios en src/server/repositories.' },
          ],
        },
      ],
    },
  },
  {
    files: ['src/server/**', 'tests/**', 'scripts/**'],
    rules: { 'no-restricted-imports': 'off' },
  },
];

export default config;
