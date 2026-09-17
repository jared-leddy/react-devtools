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
    moduleFileExtensions: ['ts', 'js', 'json'],
    moduleNameMapper: {
        '^@devtools/kit$': '<rootDir>/../devtools-kit/src/index.ts',
        '^@devtools/shared$': '<rootDir>/../devtools-shared/src/index.ts',
        '^birpc$': '<rootDir>/../devtools-kit/tests/__mocks__/birpc.ts',
        '^hookable$': '<rootDir>/../devtools-kit/tests/__mocks__/hookable.ts',
        '^superjson$': '<rootDir>/../devtools-kit/tests/__mocks__/superjson.ts',
        '^(\\.{1,2}/.*)\\.js$': '$1'
    },
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
    }
};

export default config;
