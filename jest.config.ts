import type { Config } from 'jest';

const baseConfig: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/test/jest.setup.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.json',
      },
    ],
  },
};

const config: Config = {
  projects: [
    {
      ...baseConfig,
      displayName: 'unit',
      testMatch: ['<rootDir>/test/unit/**/*.spec.ts'],
    },
    {
      ...baseConfig,
      displayName: 'integration',
      testMatch: ['<rootDir>/test/integration/**/*.spec.ts'],
    },
    {
      ...baseConfig,
      displayName: 'e2e',
      testMatch: ['<rootDir>/test/e2e/**/*.spec.ts'],
    },
  ],
};

export default config;

