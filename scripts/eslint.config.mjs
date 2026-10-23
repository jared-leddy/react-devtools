export default [
    {
        files: ['scripts/model-smoke.mjs', 'docs/recovery/r05/*.mjs'],
        languageOptions: {
            globals: {
                process: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly'
            }
        }
    },
    {
        files: ['scripts/session-integration.test.mjs'],
        languageOptions: { globals: { structuredClone: 'readonly' } }
    },
    {
        files: ['scripts/native-session-*.mjs'],
        languageOptions: {
            globals: {
                process: 'readonly',
                Buffer: 'readonly',
                WebSocket: 'readonly',
                fetch: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                window: 'readonly',
                document: 'readonly'
            }
        }
    },
    {
        files: ['**/*.mjs'],
        rules: {
            'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
            'no-undef': 'error'
        },
        languageOptions: { globals: { console: 'readonly', URL: 'readonly' } }
    }
];
