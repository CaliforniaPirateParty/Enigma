module.exports = {
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  testMatch: ['**/__tests__/**/*.test.ts?(x)', '**/?(*.)+(spec|test).ts?(x)'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        jsx: 'react',
      },
    }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(expo-constants|react-native|@react-native|@react-native-community|@testing-library/react-native|@walletconnect|@xmtp)/)'
  ],
  moduleNameMapper: {
    '^expo-constants$': '<rootDir>/__mocks__/expo-constants.js',
    // Stub native modules not available in Node test env
    '^react-native-svg$': '<rootDir>/__mocks__/react-native-svg.js',
    '^react-native-qrcode-svg$': '<rootDir>/__mocks__/react-native-qrcode-svg.js',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    'src/**/*.tsx',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**'
  ]
};
