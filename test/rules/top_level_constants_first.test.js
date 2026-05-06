import rule from "#rules/top_level_constants_first"
import { dedent, tester } from "#support"

// Interpolated because `no-template-curly-in-string` would flag a literal `${` in this file.
const SUBSTITUTION = "${"

tester.run("top-level-constants-first", rule, {
  valid: [
    "const A = 1",
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
    {
      code: "class Widget { render() {} }\nconst FLAG = !false\nconst SIZES = [, 1]",
      output: "const FLAG = !false\nconst SIZES = [, 1]\nclass Widget { render() {} }",
      errors: [ { messageId: "constAfterCode", data: { name: "FLAG" } } ]
    },
    {
      code: "class Widget {}\nconst DEFAULTS = { ...source }",
      output: null,
      errors: [ { messageId: "constAfterCode", data: { name: "DEFAULTS" } } ]
    },
    {
      code: "function run() {} const A = 1",
      output: "const A = 1\nfunction run() {}",
      errors: [ { messageId: "constAfterCode" } ]
    },
    {
      code: "function run() {} /* belongs to run */ const A = 1",
      output: "const A = 1\nfunction run() {} /* belongs to run */",
      errors: [ { messageId: "constAfterCode" } ]
    },
    // File directives remain at the physical head instead of travelling with the first declaration.
    ...[ "@flow", "@ts-check", "SPDX-License-Identifier: MIT", "eslint-env node" ].map((directive) => ({
      code: `// ${directive}\nfunction run() {}\nconst A = 1`,
      output: `// ${directive}\nconst A = 1\nfunction run() {}`,
      errors: [ { messageId: "constAfterCode" } ]
    })),
    ...[ "@jest-environment jsdom", "@flow", "SPDX-License-Identifier: MIT" ].map((directive) => ({
      code: `/**\n * ${directive}\n */\nfunction run() {}\nconst A = 1`,
      output: `/**\n * ${directive}\n */\nconst A = 1\nfunction run() {}`,
      errors: [ { messageId: "constAfterCode" } ]
    })),
    ...[ "\r", "\u{2028}", "\u{2029}" ].map((lineEnding) => ({
      code: `/**${lineEnding} * @jest-environment jsdom${lineEnding} */${lineEnding}`
        + `function run() {}${lineEnding}const A = 1`,
      output: `/**${lineEnding} * @jest-environment jsdom${lineEnding} */${lineEnding}`
        + `const A = 1${lineEnding}function run() {}`,
      errors: [ { messageId: "constAfterCode" } ]
    })),
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
        class Widget {
          [observe()]() {}
        }

        const DEFAULTS = {}
      `,
      output: null,
      errors: [ { messageId: "constAfterCode", data: { name: "DEFAULTS" } } ]
    },
    // Destructuring evaluates defaults, getters, and iteration after the initializer itself is created.
    {
      code: dedent`
        class Widget {}
        const { missing = Widget } = {}
      `,
      output: null,
      errors: [ { messageId: "constAfterCode", data: { name: "{ missing = Widget }" } } ]
    },
    {
      code: dedent`
        class Widget {}
        const { value } = { get value() { return Widget } }
      `,
      output: null,
      errors: [ { messageId: "constAfterCode", data: { name: "{ value }" } } ]
    },
    {
      code: "class Widget {}\nconst X = +{ valueOf() { return Widget } }",
      output: null,
      errors: [ { messageId: "constAfterCode", data: { name: "X" } } ]
    },
    // Unary plus on a BigInt throws during class definition, so moving the const would expose it before that throw.
    ...[ "+1n", "+-1n", "-+1n" ].map((initializer) => ({
      code: `class Widget { static value = ${initializer} }\nconst X = 1`,
      output: null,
      errors: [ { messageId: "constAfterCode", data: { name: "X" } } ]
    })),
    {
      code: "class Widget { static value = -1n }\nconst X = 1",
      output: "const X = 1\nclass Widget { static value = -1n }",
      errors: [ { messageId: "constAfterCode", data: { name: "X" } } ]
    },
    {
      code: dedent`
        class Widget {
          static { observe() }
        }

        const DEFAULTS = {}
      `,
      output: null,
      errors: [ { messageId: "constAfterCode", data: { name: "DEFAULTS" } } ]
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
