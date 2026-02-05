const globals = require("globals");

module.exports = [
  {
    ignores: ["dist/**", "node_modules/**", ".obsidian/**"],
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
      },
    },
    rules: {
      "no-unused-vars": "warn",
      "no-undef": "warn",
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
