import rule from "#rules/no-typographic-clutter"
import { tester } from "#test/support"

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
    // Inputs use Unicode escapes so the file stays ASCII (this rule lints it too);
    // the linted value is the real character, and invisible cases stay reviewable.
    //
    // Report-only: dashes, arrows, bullets and check marks have no single ASCII form.
    { code: "const x = 'em\u2014dash'", output: null, errors: [ { messageId: "clutter" } ] },
    { code: "const x = 'en\u2013dash'", output: null, errors: [ { messageId: "clutter" } ] },
    { code: "// step 1 \u2192 step 2", output: null, errors: [ { messageId: "clutter" } ] },
    { code: "// implies \u21D2", output: null, errors: [ { messageId: "clutter" } ] },
    { code: "// \u2022 item", output: null, errors: [ { messageId: "clutter" } ] },
    { code: "// done \u2713", output: null, errors: [ { messageId: "clutter" } ] },
    { code: "const y = `tmpl\u2014here`", output: null, errors: [ { messageId: "clutter" } ] },
    { code: "/* note\u2014here */", output: null, errors: [ { messageId: "clutter" } ] },
    // Fixed: smart quotes collapse to ASCII quotes, unless that would close the string.
    { code: "const x = 'curly\u2019s'", output: null, errors: [ { messageId: "clutter" } ] },
    { code: "const x = \"it\u2019s\"", output: "const x = \"it's\"", errors: [ { messageId: "clutter" } ] },
    {
      code: "const x = '\u201Csmart\u201D'",
      output: "const x = '\"smart\u201D'",
      errors: [ { messageId: "clutter" } ]
    },
    {
      code: "const y = `say \u201Chi\u201D`",
      output: "const y = `say \"hi\u201D`",
      errors: [ { messageId: "clutter" } ]
    },
    // Fixed: ellipsis, non-breaking space, zero-width and soft hyphen have one ASCII form.
    { code: "// loading\u2026", output: "// loading...", errors: [ { messageId: "clutter" } ] },
    { code: "const x = 'no\u00A0break'", output: "const x = 'no break'", errors: [ { messageId: "clutter" } ] },
    {
      code: "const x = 'invisible\u200Bspace'",
      output: "const x = 'invisiblespace'",
      errors: [ { messageId: "clutter" } ]
    },
    { code: "const x = 'soft\u00ADhyphen'", output: "const x = 'softhyphen'", errors: [ { messageId: "clutter" } ] },
    // Report-only: a double hyphen in comments needs human judgment (comma, colon, parens).
    { code: "// note -- here", output: null, errors: [ { messageId: "doubleHyphen" } ] },
    { code: "/* a -- b */", output: null, errors: [ { messageId: "doubleHyphen" } ] }
  ]
})
