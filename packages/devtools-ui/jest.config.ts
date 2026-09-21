import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
    collectCoverageFrom: [
        'src/**/*.{ts,tsx}',
        '!src/**/*.d.ts',
        '!src/demo.tsx',
        '!src/demo/**'
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
        '^shiki$': '<rootDir>/tests/shikiMock.ts',
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
