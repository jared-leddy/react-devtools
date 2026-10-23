import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
    rootDir: '.',
    testEnvironment: 'jsdom',
    testRegex: 'tests/.*\\.test\\.tsx?$',
    transform: {
        '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: 'tsconfig.json' }]
    },
    moduleNameMapper: {
        '^@devtools/core/page-backend$':
            '<rootDir>/../devtools-core/src/pageBackend.ts',
        '^@devtools/core/browser$': '<rootDir>/../devtools-core/src/browser.ts',
        '^@devtools/kit$': '<rootDir>/../devtools-kit/src/index.ts',
        '^@devtools/shared$': '<rootDir>/../devtools-shared/src/index.ts',
        '^birpc$': '<rootDir>/../devtools-kit/tests/__mocks__/birpc.ts',
        '^hookable$': '<rootDir>/../devtools-kit/tests/__mocks__/hookable.ts',
        '^superjson$': '<rootDir>/../devtools-kit/tests/__mocks__/superjson.ts',
        '^(\\.{1,2}/.*)\\.js$': '$1',
        '\\.(css)$': 'identity-obj-proxy'
    },
    setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
    collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts'],
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
