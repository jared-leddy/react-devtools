export default [
    {
        files: [
            'scripts/model-smoke.mjs',
            'scripts/identity-smoke.mjs',
            'scripts/values-smoke.mjs',
            'scripts/lifecycle-smoke.mjs',
            'scripts/picker-smoke.mjs',
            'docs/recovery/r05/*.mjs',
            'docs/recovery/r06/*.mjs',
            'docs/recovery/r07/*.mjs',
            'docs/recovery/r08/*.mjs',
            'docs/recovery/r09/*.mjs'
        ],
        languageOptions: {
            globals: {
                process: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                scrollY: 'readonly',
                window: 'readonly',
                document: 'readonly'
            }
        }
    },
    {
        files: ['scripts/session-integration.test.mjs'],
        languageOptions: { globals: { structuredClone: 'readonly' } }
    },
    {
        files: [
            'scripts/native-session-*.mjs',
            'scripts/native-identity.mjs',
            'scripts/native-values.mjs',
            'scripts/firefox-values.mjs',
            'scripts/native-lifecycles.mjs',
            'scripts/firefox-lifecycles.mjs',
            'scripts/native-picker.mjs',
            'scripts/firefox-picker.mjs'
        ],
        languageOptions: {
            globals: {
                process: 'readonly',
                Buffer: 'readonly',
                WebSocket: 'readonly',
                fetch: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                scrollY: 'readonly',
                window: 'readonly',
                document: 'readonly',
                HTMLInputElement: 'readonly',
                Event: 'readonly'
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
