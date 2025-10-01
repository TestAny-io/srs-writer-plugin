// Mock for markdownlint to avoid ESM import issues in tests
export const lintSync = jest.fn(() => []);
export const readConfigSync = jest.fn(() => ({}));
export const lint = jest.fn();
export const readConfig = jest.fn();

export default {
  lintSync,
  readConfigSync,
  lint,
  readConfig
};