import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
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
    },
    moduleNameMapper: {
        '^@devtools/api$': '<rootDir>/tests/apiMock.ts',
        '^@devtools/kit$': '<rootDir>/../devtools-kit/src/index.ts',
        '^@devtools/shared$': '<rootDir>/../devtools-shared/src/index.ts',
        '^hookable$': '<rootDir>/../devtools-kit/tests/__mocks__/hookable.ts',
        '^(\\.{1,2}/.*)\\.js$': '$1'
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
