module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 2019, ecmaFeatures: {} },
  plugins: ['prettier', '@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
    'prettier',
    'prettier/standard',
    'prettier/@typescript-eslint'
  ],
  rules: {
    '@typescript-eslint/ban-ts-comment': 'warn',
    '@typescript-eslint/no-explicit-any': 'warn',
    'prefer-spread': 'warn',
    '@typescript-eslint/no-var-requires': 'warn',
    'no-prototype-builtins': 'warn',
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        vars: 'all',
        args: 'after-used',
        varsIgnorePattern: '^dummy',
        argsIgnorePattern: '^dummy',
        ignoreRestSiblings: true
      }
    ]
  }
};
