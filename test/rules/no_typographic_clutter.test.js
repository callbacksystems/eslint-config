import rule from "#rules/no_typographic_clutter"
import { tester } from "#support"

tester.run("no-typographic-clutter", rule, {
  valid: [
    "const x = 'hyphen-here'",
    "const y = `template with hyphen`",
    "// regular ASCII comment",
    "/* block comment with ... ellipsis */",
    "const arrow = '->'",
    "// quoted: \"normal\" and 'normal'",
    // ESLint spells a justification with the two hyphens this rule bans, so a directive is not prose.
    "// eslint-disable-next-line no-unused-vars -- the guard reads worse\nconst a = 1",
    "/* global __DEV__ -- provided by Metro */\nconst a = __DEV__",
    "// step 1 \u{2192} step 2",
    "// implies \u{21D2}",
    "// \u{2022} item",
    "// done \u{2713}",
    "const x = '\u{AB}quoted\u{BB}'",
    // A string can be text on screen, where the typographic form is the one the reader should see.
    "const x = 'curly\u{2019}s'",
    "const x = 'loading\u{2026}'",
    "const x = 'em\u{2014}dash'",
    "const y = `tmpl\u{2014}here`"
  ],
  invalid: [
    // Unicode escapes keep this file ASCII, since this rule lints it too.
    { code: "// note\u{2014}here", output: null, errors: [ { messageId: "clutter" } ] },
    { code: "// range\u{2013}here", output: null, errors: [ { messageId: "clutter" } ] },
    { code: "/* note\u{2014}here */", output: null, errors: [ { messageId: "clutter" } ] },
    { code: "// minus \u{2212}1", output: null, errors: [ { messageId: "clutter" } ] },
    { code: "// curly\u{2019}s", output: "// curly's", errors: [ { messageId: "clutter" } ] },
    { code: "// say \u{201C}hi\u{201D}", output: "// say \"hi\u{201D}", errors: [ { messageId: "clutter" } ] },
    { code: "// loading\u{2026}", output: "// loading...", errors: [ { messageId: "clutter" } ] },
    { code: "// zero\u{200B}width", output: "// zerowidth", errors: [ { messageId: "clutter" } ] },
    // Invisible marks are a bug in a string too.
    { code: "const x = 'no\u{A0}break'", output: "const x = 'no break'", errors: [ { messageId: "clutter" } ] },
    { code: "const x = 'soft\u{AD}hyphen'", output: "const x = 'softhyphen'", errors: [ { messageId: "clutter" } ] },
    { code: "const y = `join\u{2060}er`", output: "const y = `joiner`", errors: [ { messageId: "clutter" } ] },
    { code: "const x = 'mark\u{FEFF}here'", output: "const x = 'markhere'", errors: [ { messageId: "clutter" } ] },
    { code: "// note -- here", output: null, errors: [ { messageId: "doubleHyphen" } ] },
    { code: "/* a -- b */", output: null, errors: [ { messageId: "doubleHyphen" } ] }
  ]
})
