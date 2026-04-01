module.exports = {
  root: true,
  env: {
    es2022: true,
    node: true,
  },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "prettier",
  ],
  rules: {
    // discourage the old JSON round-trip deep clone pattern; use deepClone helper
    "no-restricted-syntax": [
      "error",
      {
        selector: "CallExpression[callee.object.name=\"JSON\"][callee.property.name=\"parse\"][arguments.0.type=\"CallExpression\"][arguments.0.callee.object.name=\"JSON\"][arguments.0.callee.property.name=\"stringify\"]",
        message: "Use deepClone(obj) instead of JSON.parse(JSON.stringify(obj)) for deep cloning",
      },
    ],
  },
};
