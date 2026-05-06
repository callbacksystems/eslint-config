import rule from "#rules/no-typographic-clutter"
import { tester } from "#support"

tester.run("no-typographic-clutter", rule, {
  valid: [
    "const x = 'hyphen-here'",
    "const y = `template with hyphen`",
    "// regular ASCII comment",
    "/* block comment with ... ellipsis */",
    "const arrow = '->'",
    "// quoted: \"normal\" and 'normal'"
  ],
  invalid: [
    // Inputs use Unicode escapes so the file stays ASCII (this rule lints it too); the linted value is the real
    // character, and invisible cases stay reviewable.
    //
    // Report-only: dashes, arrows, bullets and check marks have no single ASCII form.
    { code: "const x = 'em\u{2014}dash'", output: null, errors: [ { messageId: "clutter" } ] },
    { code: "const x = 'en\u{2013}dash'", output: null, errors: [ { messageId: "clutter" } ] },
    { code: "// step 1 \u{2192} step 2", output: null, errors: [ { messageId: "clutter" } ] },
    { code: "// implies \u{21D2}", output: null, errors: [ { messageId: "clutter" } ] },
    { code: "// \u{2022} item", output: null, errors: [ { messageId: "clutter" } ] },
    { code: "// done \u{2713}", output: null, errors: [ { messageId: "clutter" } ] },
    { code: "const y = `tmpl\u{2014}here`", output: null, errors: [ { messageId: "clutter" } ] },
    { code: "/* note\u{2014}here */", output: null, errors: [ { messageId: "clutter" } ] },
    // Fixed: smart quotes collapse to ASCII quotes, unless that would close the string.
    { code: "const x = 'curly\u{2019}s'", output: null, errors: [ { messageId: "clutter" } ] },
    { code: "const x = \"it\u{2019}s\"", output: "const x = \"it's\"", errors: [ { messageId: "clutter" } ] },
    {
      code: "const x = '\u{201C}smart\u{201D}'",
      output: "const x = '\"smart\u{201D}'",
      errors: [ { messageId: "clutter" } ]
    },
    {
      code: "const y = `say \u{201C}hi\u{201D}`",
      output: "const y = `say \"hi\u{201D}`",
      errors: [ { messageId: "clutter" } ]
    },
    // Fixed: ellipsis, non-breaking space, zero-width and soft hyphen have one ASCII form.
    { code: "// loading\u{2026}", output: "// loading...", errors: [ { messageId: "clutter" } ] },
    { code: "const x = 'no\u{A0}break'", output: "const x = 'no break'", errors: [ { messageId: "clutter" } ] },
    {
      code: "const x = 'invisible\u{200B}space'",
      output: "const x = 'invisiblespace'",
      errors: [ { messageId: "clutter" } ]
    },
    { code: "const x = 'soft\u{AD}hyphen'", output: "const x = 'softhyphen'", errors: [ { messageId: "clutter" } ] },
    // Report-only: a double hyphen in comments needs human judgment (comma, colon, parens).
    { code: "// note -- here", output: null, errors: [ { messageId: "doubleHyphen" } ] },
    { code: "/* a -- b */", output: null, errors: [ { messageId: "doubleHyphen" } ] }
  ]
})
