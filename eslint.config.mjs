import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // The new React rule flags the common pattern of loading data in an effect; the code works, so it is a warning for now.
    rules: { 'react-hooks/set-state-in-effect': 'warn' },
  },
  globalIgnores(['.next/**', 'node_modules/**', 'next-env.d.ts', 'public/**', 'scripts/**']),
]);
