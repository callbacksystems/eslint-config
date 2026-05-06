import rule from "#rules/reflow_comments"
import { dedent, tester } from "#support"

const OPTIONS = [ { maxLength: 50 } ]

tester.run("reflow-comments", rule, {
  valid: [
    { code: "// One line only\nconst a = 1", options: OPTIONS },
    // A directive is addressed to ESLint, so it is not prose to fill from the line below.
    {
      code: dedent`
        // eslint-disable-next-line no-unused-vars
        // A short line
        const a = 1
      `,
      options: OPTIONS
    },
    // The break lands on a sentence boundary, which may be deliberate.
    {
      code: dedent`
        // First idea ends here.
        // Second idea starts here.
        const a = 1
      `,
      options: OPTIONS
    },
    // A numbered list keeps its shape.
    {
      code: dedent`
        // Order:
        //   1. first
        //   2. second
        const a = 1
      `,
      options: OPTIONS
    },
    {
      code: dedent`
        // Takes
        // - one
        // - two
        const a = 1
      `,
      options: OPTIONS
    },
    // An unbreakable word would overflow whatever the wrap does.
    {
      code: dedent`
        // See
        // https://example.com/a/path/long/enough/to/never/fit
        const a = 1
      `,
      options: OPTIONS
    },
    // Trailing comments are not a block: each belongs to its own line of code.
    {
      code: dedent`
        const a = 1 // first
        const b = 2 // second
      `,
      options: OPTIONS
    },
    // The next word does not fit.
    {
      code: dedent`
        // A line already close to the limit here
        // continuation
        const a = 1
      `,
      options: OPTIONS
    }
  ],
  invalid: [
    {
      code: dedent`
        // A comment that stops
        // mid-sentence.
        const a = 1
      `,
      output: dedent`
        // A comment that stops mid-sentence.
        const a = 1
      `,
      options: OPTIONS,
      errors: [ { messageId: "narrowWrap" } ]
    },
    // Indentation is kept, and the width is measured from the comment's own column.
    {
      code: dedent`
        class A {
          // A method comment that stops
          // mid-sentence.
          foo() {}
        }
      `,
      output: dedent`
        class A {
          // A method comment that stops mid-sentence.
          foo() {}
        }
      `,
      options: OPTIONS,
      errors: [ { messageId: "narrowWrap" } ]
    },
    // Each paragraph is filled on its own, and the blank line between them stays.
    {
      code: dedent`
        // One idea that keeps
        // going.
        //
        // Another idea that also
        // wraps early.
        const a = 1
      `,
      output: dedent`
        // One idea that keeps going.
        //
        // Another idea that also wraps early.
        const a = 1
      `,
      options: OPTIONS,
      errors: [ { messageId: "narrowWrap" } ]
    },
    // A sentence boundary inside the block still closes its paragraph.
    {
      code: dedent`
        // First idea ends here.
        // Second idea that keeps
        // going on.
        const a = 1
      `,
      output: dedent`
        // First idea ends here.
        // Second idea that keeps going on.
        const a = 1
      `,
      options: OPTIONS,
      errors: [ { messageId: "narrowWrap" } ]
    }
  ]
})
