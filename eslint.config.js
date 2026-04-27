import globals from "globals";
import prettier from "eslint-config-prettier";

export default [
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        chrome: "readonly",
      },
    },
    rules: {
      "no-unused-vars": "warn",
      "no-undef": "error",
      eqeqeq: "error",
      "no-var": "error",
      "prefer-const": "warn",
    },
  },
  {
    files: ["eslint.config.js"],
    languageOptions: {
      globals: globals.node,
    },
  },
  prettier,
];
