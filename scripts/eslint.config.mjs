export default [
    {
        files: ['**/*.mjs'],
        rules: {
            'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
            'no-undef': 'error'
        },
        languageOptions: { globals: { console: 'readonly', URL: 'readonly' } }
    }
];
