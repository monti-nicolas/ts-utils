module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
  ],
  parserOptions: {
    project: './tsconfig.json',
  },
  rules: {
    // Enforce explicit return types on exported functions — important for a library
    '@typescript-eslint/explicit-module-boundary-types': 'warn',
    // Disallow `any` — if you find yourself reaching for it, rethink the types
    '@typescript-eslint/no-explicit-any': 'error',
    // Unused variables are almost always a bug
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  },
  env: {
    node: true,
    browser: true,
  },
}
