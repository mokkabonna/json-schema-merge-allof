module.exports = {
  env: {
    es2020: true,
    node: true,
  },
  extends: 'eslint:recommended',
  rules: {
    'space-before-function-paren': [
      'error',
      {
        anonymous: 'ignore',
        named: 'ignore',
        asyncArrow: 'ignore',
      },
    ],
  },
};
