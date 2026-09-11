// Shared Modules
import { baseConfig } from '@devtools/eslint-config/base';

export default [
    {
        ignores: ['apps/**', 'packages/**', 'dist/**', 'node_modules/**']
    },
    ...baseConfig
];
