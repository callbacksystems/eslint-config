import rule from "#rules/top_level_constants_first"
import { dedent, tester } from "#support"

// Interpolated because `no-template-curly-in-string` would flag a literal `${` in this file.
const SUBSTITUTION = "${"

tester.run("top-level-constants-first", rule, {
  valid: [
    dedent`
      const A = 1
      const B = 2

      function run() {
        return A + B
      }
    `,
    dedent`
      export const MAX = 10

      class Widget {}
    `,
    dedent`
      import x from "y"

      const A = x

      function run() {
        return A
      }
    `,
    dedent`
      function high() {
        return low()
      }

      function low() {
        return 1
      }
    `,
    // The const already leads the functions, and moving it above `setup()` would reorder side effects.
    dedent`
      setup()

      const A = 1

      function run() {
        return A
      }
    `
  ],
  invalid: [
    // The blank line the author left between two blocks travels with them, and their own spacing stays.
    {
      code: dedent`
        function run() {
          return A + B
        }

        const A = 1
        const B = 2
      `,
      output: dedent`
        const A = 1
        const B = 2

        function run() {
          return A + B
        }
      `,
      errors: [ { messageId: "constAfterCode" } ]
    },
    {
      code: dedent`
        // The widget.
        class Widget {}

        const DEFAULTS = { a: 1 }
      `,
      output: dedent`
        const DEFAULTS = { a: 1 }

        // The widget.
        class Widget {}
      `,
      errors: [ { messageId: "constAfterCode" } ]
    },
    {
      // A class does not hoist, so lifting `new Client()` above it would throw on load.
      code: dedent`
        class Client {}

        const defaultClient = new Client()

        export function go() {
          return defaultClient
        }
      `,
      output: null,
      errors: [ { messageId: "constAfterCode", data: { name: "defaultClient" } } ]
    },
    {
      code: dedent`
        class Widget {}

        const thing = make()

        function make() {
          return new Widget()
        }
      `,
      output: null,
      errors: [ { messageId: "constAfterCode", data: { name: "thing" } } ]
    },
    {
      code: dedent`
        class Widget {}

        const DEFAULTS = { a: 1 }

        function other() {
          return DEFAULTS
        }
      `,
      output: dedent`
        const DEFAULTS = { a: 1 }

        class Widget {}

        function other() {
          return DEFAULTS
        }
      `,
      errors: [ { messageId: "constAfterCode", data: { name: "DEFAULTS" } } ]
    },
    // Initializers that run nothing on load cross the class safely, and one reading it does not.
    {
      code: 'class Widget {}\n\nconst LABEL = `widget`\nconst OFFSET = -1\nconst SIZES = [ 1, "two" ]\n'
        + "const build = function () { return new Widget() }",
      output: 'const LABEL = `widget`\nconst OFFSET = -1\nconst SIZES = [ 1, "two" ]\n'
        + "const build = function () { return new Widget() }\n\nclass Widget {}",
      errors: [ { messageId: "constAfterCode", data: { name: "LABEL" } } ]
    },
    {
      code: `class Widget {}\n\nconst LABEL = \`${SUBSTITUTION}Widget.name}\``,
      output: null,
      errors: [ { messageId: "constAfterCode", data: { name: "LABEL" } } ]
    },
    {
      code: dedent`
        function run() {
          return a
        }

        const { a, b } = config
      `,
      output: dedent`
        const { a, b } = config

        function run() {
          return a
        }
      `,
      errors: [ { messageId: "constAfterCode", data: { name: "{ a, b }" } } ]
    },
    {
      // The arrow's body does not run on load, so it crosses the class safely.
      code: dedent`
        class Widget {}

        const make = () => new Widget()

        function other() {
          return make()
        }
      `,
      output: dedent`
        const make = () => new Widget()

        class Widget {}

        function other() {
          return make()
        }
      `,
      errors: [ { messageId: "constAfterCode", data: { name: "make" } } ]
    },
    {
      code: dedent`
        function low() {
          return 1
        }

        const VERSION = 1

        function high() {
          return low()
        }
      `,
      output: dedent`
        const VERSION = 1

        function low() {
          return 1
        }

        function high() {
          return low()
        }
      `,
      errors: [ { messageId: "constAfterCode", data: { name: "VERSION" } } ]
    },
    {
      code: dedent`
        function f() {
          return 1
        }

        const Z = 1

        const A = 2
      `,
      output: dedent`
        const Z = 1

        const A = 2

        function f() {
          return 1
        }
      `,
      errors: [ { messageId: "constAfterCode", data: { name: "Z" } } ]
    },
    {
      code: dedent`
        class Widget {}

        export const MAX = 10
      `,
      output: dedent`
        export const MAX = 10

        class Widget {}
      `,
      errors: [ { messageId: "constAfterCode", data: { name: "MAX" } } ]
    },
    {
      code: dedent`
        function helper() {
          return 1
        }

        // The cap.
        const LIMIT = 5
      `,
      output: dedent`
        // The cap.
        const LIMIT = 5

        function helper() {
          return 1
        }
      `,
      errors: [ { messageId: "constAfterCode", data: { name: "LIMIT" } } ]
    },
    {
      // Reordering past `init()` could change behavior, so no fix.
      code: dedent`
        function f() {
          return 1
        }

        init()

        const A = 1
      `,
      output: null,
      errors: [ { messageId: "constAfterCode", data: { name: "A" } } ]
    }
  ]
})
