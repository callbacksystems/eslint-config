import rule from "#rules/no_section_divider_comments"
import { dedent, tester } from "#support"

tester.run("no-section-divider-comments", rule, {
  valid: [
    "//",
    "// regular comment",
    // A run on one side only decorates nothing.
    "// ===== Section",
    "/* block comment */",
    "// TODO: fix this",
    dedent`
      function f() {
        // helper
        return 1
      }
    `
  ],
  invalid: [
    { code: "// =============", output: "", errors: [ { messageId: "pureDivider" } ] },
    { code: "// -------", output: "", errors: [ { messageId: "pureDivider" } ] },
    { code: "// =====\nconst a = 1", output: "const a = 1", errors: [ { messageId: "pureDivider" } ] },
    { code: "// =====\r\nconst a = 1", output: "const a = 1", errors: [ { messageId: "pureDivider" } ] },
    { code: "const a = 1 // =====", output: "const a = 1", errors: [ { messageId: "pureDivider" } ] },
    {
      code: "const value = typeof/* ===== */input",
      output: "const value = typeof input",
      errors: [ { messageId: "pureDivider" } ]
    },
    { code: "// ===== Section ======", output: "// Section", errors: [ { messageId: "wrappedDivider" } ] },
    { code: "/* === Title === */", output: "/* Title */", errors: [ { messageId: "wrappedDivider" } ] },
    { code: "// ==Section==", output: "// Section", errors: [ { messageId: "wrappedDivider" } ] },
    { code: "// === A ===", output: "// A", errors: [ { messageId: "wrappedDivider" } ] },
    {
      name: "does not activate a decorated tool directive",
      code: "// === eslint-disable-next-line no-undef ===\nhiddenGlobal()",
      output: null,
      errors: [ { messageId: "wrappedDivider" } ]
    },
    { code: "// ─────────────", output: "", errors: [ { messageId: "pureDivider" } ] },
    { code: "// ─── Getters ─────────", output: "// Getters", errors: [ { messageId: "wrappedDivider" } ] },
    { code: "// ━━━ Section ━━━", output: "// Section", errors: [ { messageId: "wrappedDivider" } ] },
    { code: "// ═══ Setup ═══", output: "// Setup", errors: [ { messageId: "wrappedDivider" } ] }
  ]
})
