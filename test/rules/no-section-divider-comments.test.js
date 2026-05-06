import rule from "#rules/no-section-divider-comments"
import { dedent, tester } from "#test/support"

tester.run("no-section-divider-comments", rule, {
  valid: [
    "// regular comment",
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
    { code: "// ===== Section ======", output: "// Section", errors: [ { messageId: "wrappedDivider" } ] },
    { code: "/* === Title === */", output: "/* Title */", errors: [ { messageId: "wrappedDivider" } ] },
    // Dividers pressed against the label, with no surrounding spaces.
    { code: "// ==Section==", output: "// Section", errors: [ { messageId: "wrappedDivider" } ] },
    // A single-character label between dividers.
    { code: "// === A ===", output: "// A", errors: [ { messageId: "wrappedDivider" } ] },
    // Unicode box-drawing characters (the AI agent's favorite).
    { code: "// ─────────────", output: "", errors: [ { messageId: "pureDivider" } ] },
    { code: "// ─── Getters ─────────", output: "// Getters", errors: [ { messageId: "wrappedDivider" } ] },
    { code: "// ━━━ Section ━━━", output: "// Section", errors: [ { messageId: "wrappedDivider" } ] },
    { code: "// ═══ Setup ═══", output: "// Setup", errors: [ { messageId: "wrappedDivider" } ] }
  ]
})
