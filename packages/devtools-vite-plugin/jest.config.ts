import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
    moduleFileExtensions: ['ts', 'js', 'json'],
    rootDir: '.',
    testEnvironment: 'node',
    testRegex: 'tests/.*\\.test\\.ts$',
    transform: {
        '^.+\\.ts$': [
            'ts-jest',
            {
                diagnostics: { ignoreCodes: [151002] },
                tsconfig: 'tsconfig.test.json'
            }
        ]
    },
    collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts'],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'html', 'lcov'],
    coverageThreshold: {
        global: {
            branches: 80,
            functions: 80,
            lines: 80,
            statements: 80
        }
    }
};

export default config;
