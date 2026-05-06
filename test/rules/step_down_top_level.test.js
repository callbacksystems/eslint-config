import rule from "#rules/step_down_top_level"
import { dedent, tester } from "#support"

tester.run("step-down-top-level", rule, {
  valid: [
    dedent`
      function high() {
        return low()
      }

      function low() {
        return 1
      }
    `,
    dedent`
      export function run() {
        return helper()
      }

      function helper() {
        return 1
      }
    `,
    dedent`
      function main() {
        first()
        second()
      }

      function first() {
        return 1
      }

      function second() {
        return 2
      }
    `,
    dedent`
      function alpha() {
        return 1
      }

      function beta() {
        return 2
      }
    `,
    dedent`
      function walk(node) {
        return node.children.map(walk)
      }
    `,
    // In a mutually-referential pair, whichever comes first in source leads.
    dedent`
      function ping(value) {
        return pong(value)
      }

      function pong(value) {
        return ping(value)
      }
    `,
    dedent`
      function register(list) {
        return list.filter(isReady)
      }

      function isReady(item) {
        return item.ready
      }
    `,
    // Exported API goes on top, even when a private function calls it.
    dedent`
      export function run() {
        return 1
      }

      function bootstrap() {
        return run()
      }
    `,
    dedent`
      class Widget {
        render() {
          return format(this.data)
        }
      }

      function format(data) {
        return data
      }
    `,
    dedent`
      test("greets", () => {
        expect(greeting()).toBe("hi")
      })

      function greeting() {
        return "hi"
      }
    `,
    // A class above a statement using it stays put, since classes do not hoist.
    dedent`
      class Widget {}

      register(new Widget())
    `
  ],
  invalid: [
    {
      code: dedent`
        function helper() {
          return 1
        }

        export function main() {
          return helper() + other()
        }
        function other() {
          return 2
        }
      `,
      output: dedent`
        export function main() {
          return helper() + other()
        }

        function helper() {
          return 1
        }

        function other() {
          return 2
        }
      `,
      errors: [ { messageId: "outOfOrder", data: { name: "main", before: "helper" } } ]
    },
    {
      code: dedent`
        function low() {
          return 1
        }

        function high() {
          return low()
        }
      `,
      output: dedent`
        function high() {
          return low()
        }

        function low() {
          return 1
        }
      `,
      errors: [ { messageId: "outOfOrder", data: { name: "high", before: "low" } } ]
    },
    {
      code: dedent`
        function main() {
          first()
          second()
        }

        function second() {
          return 2
        }

        function first() {
          return 1
        }
      `,
      output: dedent`
        function main() {
          first()
          second()
        }

        function first() {
          return 1
        }

        function second() {
          return 2
        }
      `,
      errors: [ { messageId: "outOfOrder", data: { name: "first", before: "second" } } ]
    },
    {
      code: dedent`
        function isReady(item) {
          return item.ready
        }

        function register(list) {
          return list.filter(isReady)
        }
      `,
      output: dedent`
        function register(list) {
          return list.filter(isReady)
        }

        function isReady(item) {
          return item.ready
        }
      `,
      errors: [ { messageId: "outOfOrder", data: { name: "register", before: "isReady" } } ]
    },
    {
      code: dedent`
        function helper() {
          return 1
        }

        export function run() {
          return 2
        }
      `,
      output: dedent`
        export function run() {
          return 2
        }

        function helper() {
          return 1
        }
      `,
      errors: [ { messageId: "outOfOrder", data: { name: "run", before: "helper" } } ]
    },
    {
      code: dedent`
        function bootstrap() {
          return run()
        }

        export function run() {
          return 1
        }
      `,
      output: dedent`
        export function run() {
          return 1
        }

        function bootstrap() {
          return run()
        }
      `,
      errors: [ { messageId: "outOfOrder", data: { name: "run", before: "bootstrap" } } ]
    },
    {
      code: dedent`
        function helper() {
          return 1
        }

        // Entry point.
        export function run() {
          return helper()
        }
      `,
      output: dedent`
        // Entry point.
        export function run() {
          return helper()
        }

        function helper() {
          return 1
        }
      `,
      errors: [ { messageId: "outOfOrder", data: { name: "run", before: "helper" } } ]
    },
    {
      code: dedent`
        function helper() { return 1 } // Depends on setup

        export function run() { return helper() }
      `,
      output: dedent`
        export function run() { return helper() }

        function helper() { return 1 } // Depends on setup
      `,
      errors: [ { messageId: "outOfOrder", data: { name: "run", before: "helper" } } ]
    },
    {
      code: dedent`
        function helper() { return 1 }

        // Helpers below.

        export function run() { return helper() }
      `,
      output: dedent`
        export function run() { return helper() }

        // Helpers below.

        function helper() { return 1 }
      `,
      errors: [ { messageId: "outOfOrder", data: { name: "run", before: "helper" } } ]
    },
    {
      code: dedent`
        // File header.

        function bbb() {}

        function aaa() {
          return bbb()
        }
      `,
      output: dedent`
        // File header.

        function aaa() {
          return bbb()
        }

        function bbb() {}
      `,
      errors: [ { messageId: "outOfOrder", data: { name: "aaa", before: "bbb" } } ]
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
      output: null,
      errors: [ { messageId: "outOfOrder", data: { name: "high", before: "low" } } ]
    },
    {
      code: dedent`
        function format(data) {
          return data
        }

        class Widget {
          render() {
            return format(this.data)
          }
        }
      `,
      output: dedent`
        class Widget {
          render() {
            return format(this.data)
          }
        }

        function format(data) {
          return data
        }
      `,
      errors: [ { messageId: "outOfOrder", data: { name: "Widget", before: "format" } } ]
    },
    {
      code: dedent`
        function greeting() {
          return "hi"
        }

        test("greets", () => greeting())
      `,
      output: dedent`
        test("greets", () => greeting())

        function greeting() {
          return "hi"
        }
      `,
      errors: [ { messageId: "helperAboveUse", data: { name: "greeting" } } ]
    },
    {
      code: dedent`
        beforeAll(() => reset())

        function arm(distance) {
          return { distance }
        }

        function approachTo(value) {
          return value
        }

        test("keeps order", () => {
          const value = arm(2)
          expect(approachTo(value)).toBe(2)
        })
      `,
      output: dedent`
        beforeAll(() => reset())

        test("keeps order", () => {
          const value = arm(2)
          expect(approachTo(value)).toBe(2)
        })

        function arm(distance) {
          return { distance }
        }

        function approachTo(value) {
          return value
        }
      `,
      errors: [ { messageId: "helperAboveUse", data: { name: "arm" } } ]
    },
    {
      code: dedent`
        function helper() {
          return 1
        }

        const setup = 1

        run(helper())
      `,
      output: null,
      errors: [ { messageId: "helperAboveUse", data: { name: "helper" } } ]
    },
    {
      code: dedent`
        test("a", () => greeting())

        function greeting() {
          return "hi"
        }

        test("b", () => {
          expect(true).toBe(true)
        })
      `,
      output: dedent`
        test("a", () => greeting())

        test("b", () => {
          expect(true).toBe(true)
        })

        function greeting() {
          return "hi"
        }
      `,
      errors: [ { messageId: "helperAboveUse", data: { name: "greeting" } } ]
    }
  ]
})
