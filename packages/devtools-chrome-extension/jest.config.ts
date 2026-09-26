import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
    collectCoverageFrom: [
        'src/**/*.{ts,tsx}',
        '!src/**/*.d.ts',
        '!src/main.tsx'
    ],
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
        '^@devtools/client$': '<rootDir>/../devtools-client/src/index.ts',
        '^@devtools/client/style.css$': 'identity-obj-proxy',
        '^@devtools/core$': '<rootDir>/../devtools-core/src/index.ts',
        '^@devtools/kit$': '<rootDir>/../devtools-kit/src/index.ts',
        '^@devtools/shared$': '<rootDir>/../devtools-shared/src/index.ts',
        '^@devtools/ui$': '<rootDir>/tests/uiMock.tsx',
        '^@devtools/ui/style.css$': 'identity-obj-proxy',
        '^birpc$': '<rootDir>/../devtools-kit/tests/__mocks__/birpc.ts',
        '^hookable$': '<rootDir>/../devtools-kit/tests/__mocks__/hookable.ts',
        '^superjson$': '<rootDir>/../devtools-kit/tests/__mocks__/superjson.ts',
        '^(\\.{1,2}/.*)\\.js$': '$1',
        '\\.(css)$': 'identity-obj-proxy'
    },
    rootDir: '.',
    setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
    testEnvironment: 'jsdom',
    testRegex: 'tests/.*\\.test\\.tsx?$',
    transform: {
        '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: 'tsconfig.json' }]
    }
};

export default config;
