/*
<MODULE_CONTRACT>
<purpose>The eslintconfig flat-config for werkstatt-shared — tseslint recommended over the src tree plus the local no-as-any rule.</purpose>
<non-goals>
  <item>Do not carry repo-wide rules — root and per-package configs own their own scope.</item>
</non-goals>
</MODULE_CONTRACT>
<KEY_DECISIONS>
  <item>no-as-any is a local rule — `as any` on workspace-internal APIs silently drops properties.</item>
</KEY_DECISIONS>
<CHANGE_SUMMARY>
  <item>RFC-1485: sweep compass headers — shared-tail</item>
</CHANGE_SUMMARY>
*/

import tseslint from "typescript-eslint";

function createNoAsAnyRule() {
  return {
    meta: {
      type: "problem",
      docs: { description: "Disallow `as any` type assertions" },
      schema: [],
      messages: {
        noAsAny:
          "Unexpected `as any`. Fix the call-site type or use `unknown`; `as any` on workspace-internal APIs silently drops properties and causes runtime bugs.",
      },
    },
    create(context) {
      return {
        TSAsExpression(node) {
          if (node.typeAnnotation && node.typeAnnotation.type === "TSAnyKeyword") {
            context.report({ node, messageId: "noAsAny" });
          }
        },
      };
    },
  };
}

export default tseslint.config(
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ["src/**/*.ts"],
    ignores: ["**/*.d.ts", "**/*.template.ts", "**/*.template.mjs"],
  })),
  {
    files: ["src/**/*.ts"],
    ignores: ["**/*.d.ts", "**/*.template.ts", "**/*.template.mjs"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        sourceType: "module",
        ecmaVersion: "latest",
      },
    },
    plugins: {
      "local-rules": {
        rules: {
          "no-as-any": createNoAsAnyRule(),
        },
      },
    },
    rules: {
      "local-rules/no-as-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
);
