import parser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import prettier from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';

export default [
    {
        ignores: ['coverage/**', 'dist/**', 'node_modules/**']
    },
    {
        files: ['**/*.ts'],
        languageOptions: {
            parser,
            parserOptions: {
                ecmaVersion: 'latest',
                sourceType: 'module'
            }
        },
        plugins: {
            '@typescript-eslint': tsPlugin,
            prettier
        },
        rules: {
            ...prettierConfig.rules,
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_'
                }
            ],
            'prettier/prettier': 'error'
        }
    }
];
