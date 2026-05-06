import rule from "#rules/vertical-spacing"
import { dedent, tester } from "#support"

tester.run("vertical-spacing", rule, {
  valid: [
    dedent`
      const A = 1
      const B = 2
    `,
    // Same-category fields group tight: statics together, privates together.
    dedent`
      class C {
        static targets = []
        static values = {}
      }
    `,
    dedent`
      class C {
        #a = 1
        #b = 2
      }
    `,
    // Different categories (public vs private) may keep a blank line...
    dedent`
      class C {
        count = 0

        #total = 0
      }
    `,
    // ...or not. Both are allowed.
    dedent`
      class C {
        count = 0
        #total = 0
      }
    `,
    // Code is surrounded by blank lines: method, arrow-field, exported class.
    dedent`
      class C {
        a = 1

        run() {}
      }
    `,
    dedent`
      class C {
        a = 1

        total = () => 1
      }
    `,
    dedent`
      const A = 1

      export class Widget {}
    `,
    // A header comment stays attached, with the blank line above it.
    dedent`
      const A = 1

      // Does the thing.
      function run() {
        return A
      }
    `,
    // Exported consts are the author's call: a run of related ones may sit tight...
    dedent`
      export const A = 1
      export const B = 2
    `,
    // ...or take a blank between them.
    dedent`
      export const A = 1

      export const B = 2
    `,
    // An exported const next to an internal one may keep a blank or not.
    dedent`
      const A = 1

      export const B = 2
    `,
    dedent`
      const A = 1
      export const B = 2
    `,
    // A multi-line const may keep a blank before the next const...
    dedent`
      const A = {
        x: 1
      }

      const B = 2
    `,
    // ...or sit tight against it. Both are allowed once one is multi-line.
    dedent`
      const A = {
        x: 1
      }
      const B = 2
    `
  ],
  invalid: [
    {
      // Two exported classes need a blank line between them.
      code: dedent`
        export class A {}
        export class B {}
      `,
      output: dedent`
        export class A {}

        export class B {}
      `,
      errors: [ { messageId: "missingBlank" } ]
    },
    {
      // An arrow-field is code, not data: separate it from the fields above.
      code: dedent`
        class C {
          a = 1
          total = () => 1
        }
      `,
      output: dedent`
        class C {
          a = 1

          total = () => 1
        }
      `,
      errors: [ { messageId: "missingBlank" } ]
    },
    {
      // Same-category fields with a blank between them are pulled tight.
      code: dedent`
        class C {
          a = 1

          b = 2
        }
      `,
      output: dedent`
        class C {
          a = 1
          b = 2
        }
      `,
      errors: [ { messageId: "unexpectedBlank" } ]
    },
    {
      // Code is surrounded even when the neighbor is a plain statement.
      code: dedent`
        function f() {
          return 1
        }
        doThing()
      `,
      output: dedent`
        function f() {
          return 1
        }

        doThing()
      `,
      errors: [ { messageId: "missingBlank" } ]
    },
    {
      // Internal single-line consts still group tight: the blank is pulled out.
      code: dedent`
        const A = 1

        const B = 2
      `,
      output: dedent`
        const A = 1
        const B = 2
      `,
      errors: [ { messageId: "unexpectedBlank" } ]
    },
    {
      // The blank line belongs above the header comment, not below it.
      code: dedent`
        const A = 1
        // Does the thing.
        function run() {
          return A
        }
      `,
      output: dedent`
        const A = 1

        // Does the thing.
        function run() {
          return A
        }
      `,
      errors: [ { messageId: "missingBlank" } ]
    }
  ]
})
