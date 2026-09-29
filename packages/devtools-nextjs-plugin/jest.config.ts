import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
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
    },
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
    moduleNameMapper: {
        '^@devtools/api$': '<rootDir>/tests/apiMock.ts',
        '^next/navigation$': '<rootDir>/tests/nextNavigationMock.ts',
        '^next/router$': '<rootDir>/tests/nextRouterMock.ts',
        '^(\\.{1,2}/.*)\\.js$': '$1'
    },
    rootDir: '.',
    testEnvironment: 'jsdom',
    testRegex: 'tests/.*\\.test\\.ts$',
    transform: {
        '^.+\\.(ts|tsx)$': [
            'ts-jest',
            {
                diagnostics: { ignoreCodes: [151002] },
                tsconfig: 'tsconfig.test.json'
            }
        ]
    }
};

export default config;
