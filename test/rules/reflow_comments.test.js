import rule from "#rules/reflow_comments"
import { dedent, tester } from "#support"

const OPTIONS = [ { maxLength: 50 } ]

tester.run("reflow-comments", rule, {
  valid: [
    // A line opening with a label is an item of its own, not the tail of the line above.
    dedent`
      // Slot 1: 11:00-11:30, next start: 11:45
      // Slot 2: 11:45-12:15, next start: 12:30
      const x = 1
    `,
    // A line that reads as code is commented-out code, not prose.
    dedent`
      // Retry jobs that hit a deadlock
      // retryOn(Deadlocked)
      const x = 1
    `,
    dedent`
      // Optional: run the system tests
      // step "Tests: System", "bin/rails test:system"
      const x = 1
    `,
    dedent`
      // Week+1: Bruno has 3 on Monday and 1 on Thursday
      // Step 1/2: Diego has 1 on Monday
      // Layer 3 (inferred): the office hours
      const x = 1
    `,
    dedent`
      // Layer 1: Account: 09:00-18:00
      // Layer 3: Office location: 09:00-13:00
      const x = 1
    `,
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
    {
      code: dedent`
        // See
        // https://example.com/a/path/long/enough/to/never/fit
        const a = 1
      `,
      options: OPTIONS
    },
    {
      code: dedent`
        const a = 1 // first
        const b = 2 // second
      `,
      options: OPTIONS
    },
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
