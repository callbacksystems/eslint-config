import rule from "#rules/no-typographic-clutter"
import { tester } from "#test/support"

tester.run("no-typographic-clutter", rule, {
  valid: [
    "const x = 'hyphen-here'",
    "const y = `template with hyphen`",
    "// regular ASCII comment",
    "/* block comment with -- and ... */",
    "const arrow = '->'",
    "// quoted: \"normal\" and 'normal'"
  ],
  invalid: [
    // Em-dash and en-dash.
    { code: "const x = 'em—dash'", errors: [ { messageId: "clutter" } ] },
    { code: "const x = 'en–dash'", errors: [ { messageId: "clutter" } ] },
    // Smart quotes.
    { code: "const x = 'curly’s'", errors: [ { messageId: "clutter" } ] },
    { code: "const x = '“smart”'", errors: [ { messageId: "clutter" } ] },
    // Ellipsis.
    { code: "// loading…", errors: [ { messageId: "clutter" } ] },
    // Arrows.
    { code: "// step 1 → step 2", errors: [ { messageId: "clutter" } ] },
    { code: "// implies ⇒", errors: [ { messageId: "clutter" } ] },
    // Bullets.
    { code: "// • item", errors: [ { messageId: "clutter" } ] },
    // Zero-width space (invisible).
    { code: "const x = 'invisible​space'", errors: [ { messageId: "clutter" } ] },
    // Non-breaking space (invisible).
    { code: "const x = 'no break'", errors: [ { messageId: "clutter" } ] },
    // Soft hyphen (invisible).
    { code: "const x = 'soft­hyphen'", errors: [ { messageId: "clutter" } ] },
    // Check / x marks.
    { code: "// done ✓", errors: [ { messageId: "clutter" } ] },
    // Template literals.
    { code: "const y = `tmpl—here`", errors: [ { messageId: "clutter" } ] },
    // Block comments.
    { code: "/* note—here */", errors: [ { messageId: "clutter" } ] }
  ]
})
