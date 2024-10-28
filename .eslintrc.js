module.exports = {
  env: {
    browser: true,
    es2021: true,
  },
  settings: {
    react: {
      version: "detect",
    },
  },
  extends: [
    "eslint:recommended",
    "plugin:react-hooks/recommended",
    "plugin:react/recommended",
    "prettier",
  ],
  overrides: [
    {
      env: {
        node: true,
      },
      files: [".eslintrc.{js,cjs}"],
      parserOptions: {
        sourceType: "script",
      },
    },
  ],
  parser: "@babel/eslint-parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  plugins: ["react", "react-hooks", "jsx-a11y", "prettier"],
  rules: {
    "prettier/prettier": [
      "warn",
      {
        singleQuote: false,
        semi: true,
        "max-len": { code: 120, ignoreUrls: true },
        "tab-width": 2,
      },
    ],
    "lines-between-class-members": ["error", "always"],
    "jsx-a11y/anchor-is-valid": "warn",
    "prefer-arrow-callback": [
      "error",
      { allowNamedFunctions: false, allowUnboundThis: false },
    ],
    "no-empty-function": ["warn"],
    "no-prototype-builtins": ["warn"],
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",
    "react/self-closing-comp": ["error", { component: true, html: true }],
    "react/jsx-curly-brace-presence": [
      "warn",
      { props: "never", children: "never" },
    ],
    "no-extra-boolean-cast": "off",
    "react/jsx-key": "error",
    "no-useless-computed-key": "error",
    "object-shorthand": "error",
    "require-await": "warn",
    eqeqeq: "warn",
    "no-useless-escape": "warn",
    "react/no-children-prop": "off",
    "react/prop-types": "off",
  },
};
