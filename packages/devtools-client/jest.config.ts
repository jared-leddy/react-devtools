import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
    collectCoverageFrom: [
        'src/**/*.{ts,tsx}',
        '!src/**/*.d.ts',
        '!src/main.tsx',
        '!src/pages/**',
        '!src/components/state/**'
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
        '^@devtools/kit$': '<rootDir>/tests/kitMock.ts',
        '^@devtools/ui$': '<rootDir>/tests/uiMock.tsx',
        '^@devtools/ui/style.css$': 'identity-obj-proxy',
        '\\.(css)$': 'identity-obj-proxy'
    },
    rootDir: '.',
    setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
    testEnvironment: 'jsdom',
    testRegex: 'tests/.*\\.test\\.tsx?$',
    transform: {
        '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }]
    }
};

export default config;
