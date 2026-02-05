const globals = require("globals");

module.exports = [
  {
    ignores: ["dist/**", "node_modules/**", ".obsidian/**", "assets/vendor/**"],
  },
  {
    files: ["**/*.{js,cjs,mjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.jest,
        bootstrap: "readonly",
      },
    },
    rules: {
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      "no-undef": "error",
    },
  },
  {
    files: ["**/*.mjs"],
    languageOptions: {
      sourceType: "module",
    },
  },
  {
    files: ["src/js/modules/**/*.js", "src/js/renderer.js"],
    languageOptions: {
      sourceType: "module",
    },
  },
];
