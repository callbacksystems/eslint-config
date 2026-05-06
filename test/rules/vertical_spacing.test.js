import rule from "#rules/vertical_spacing"
import { dedent, tester } from "#support"

tester.run("vertical-spacing", rule, {
  valid: [
    dedent`
      const A = 1
      const B = 2
    `,
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
    dedent`
      class C {
        count = 0

        #total = 0
      }
    `,
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
    dedent`
      const A = 1

      // Does the thing.
      function run() {
        return A
      }
    `,
    // Exported consts may sit tight or take a blank between them, the author's call.
    dedent`
      export const A = 1
      export const B = 2
    `,
    dedent`
      export const A = 1

      export const B = 2
    `,
    dedent`
      const A = 1

      export const B = 2
    `,
    // After a multi-line const, both a blank line and none are allowed.
    dedent`
      const A = {
        x: 1
      }

      const B = 2
    `,
    dedent`
      const A = {
        x: 1
      }
      const B = 2
    `
  ],
  invalid: [
    {
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
      code: dedent`
        class C {
          value = 1
          static {
            this.value = 2
          }
        }
      `,
      output: dedent`
        class C {
          value = 1

          static {
            this.value = 2
          }
        }
      `,
      errors: [ { messageId: "missingBlank" } ]
    },
    {
      code: dedent`
        const value = 1
        export default () => value
      `,
      output: dedent`
        const value = 1

        export default () => value
      `,
      errors: [ { messageId: "missingBlank" } ]
    },
    {
      code: dedent`
        const value = 1
        export default (function () { return value })
      `,
      output: dedent`
        const value = 1

        export default (function () { return value })
      `,
      errors: [ { messageId: "missingBlank" } ]
    },
    {
      code: dedent`
        const value = 1
        export default (class {})
      `,
      output: dedent`
        const value = 1

        export default (class {})
      `,
      errors: [ { messageId: "missingBlank" } ]
    },
    {
      code: dedent`
        const Widget = class {}
        const value = 1
      `,
      output: dedent`
        const Widget = class {}

        const value = 1
      `,
      errors: [ { messageId: "missingBlank" } ]
    },
    {
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
      code: dedent`
        const A = 1
        export const B = 2
      `,
      output: dedent`
        const A = 1

        export const B = 2
      `,
      errors: [ { messageId: "mixedCategories" } ]
    },
    {
      code: dedent`
        class C {
          count = 0
          #total = 0
        }
      `,
      output: dedent`
        class C {
          count = 0

          #total = 0
        }
      `,
      errors: [ { messageId: "mixedCategories" } ]
    },
    {
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
    },
    // A trailing comment belongs to the first declaration; the blank goes after it.
    {
      code: "function first() {} // first\nfunction second() {}",
      output: "function first() {} // first\n\nfunction second() {}",
      errors: [ { messageId: "missingBlank" } ]
    },
    // Inserting a blank after a next-line directive disables its effect on the following declaration.
    {
      code: "function first() {} // eslint-disable-next-line no-undef\nfunction second() { hiddenGlobal() }",
      output: null,
      errors: [ { messageId: "missingBlank" } ]
    }
  ]
})
