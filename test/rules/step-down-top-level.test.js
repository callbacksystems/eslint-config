import rule from "#rules/step-down-top-level"
import { dedent, tester } from "#support"

tester.run("step-down-top-level", rule, {
  valid: [
    // Caller before callee (top-down).
    dedent`
      function high() {
        return low()
      }

      function low() {
        return 1
      }
    `,
    // Exported entry point first, helpers below.
    dedent`
      export function run() {
        return helper()
      }

      function helper() {
        return 1
      }
    `,
    // A caller's callees in the order it first invokes them.
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
    // Independent functions fall back to source order.
    dedent`
      function alpha() {
        return 1
      }

      function beta() {
        return 2
      }
    `,
    // Recursion is allowed.
    dedent`
      function walk(node) {
        return node.children.map(walk)
      }
    `,
    // Mutually-referential pair: whichever comes first in source leads.
    dedent`
      function ping(value) {
        return pong(value)
      }

      function pong(value) {
        return ping(value)
      }
    `,
    // A function referenced as a value (callback) still counts as caller-first.
    dedent`
      function register(list) {
        return list.filter(isReady)
      }

      function isReady(item) {
        return item.ready
      }
    `,
    // Exported API on top, a private caller of it below.
    dedent`
      export function run() {
        return 1
      }

      function bootstrap() {
        return run()
      }
    `,
    // A class is ordered alongside functions: a class leads the helper it calls.
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
    // Helpers already below the top-level statements that use them.
    dedent`
      test("greets", () => {
        expect(greeting()).toBe("hi")
      })

      function greeting() {
        return "hi"
      }
    `,
    // A private class above a using statement stays put: classes don't hoist.
    dedent`
      class Widget {}

      register(new Widget())
    `
  ],
  invalid: [
    // Callee defined before its caller; autofix reorders.
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
    // A caller invokes `first` before `second`, but they are defined reversed.
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
    // Helper used as a callback value, defined before its caller.
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
    // A private helper sitting above an exported function.
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
    // A private caller of an exported function still goes below it.
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
    // A function's leading comment travels with it when reordered.
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
    // The file header belongs to no function and stays put.
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
    // A non-function statement interrupting the run blocks the autofix.
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
    // A class defined below the helper it calls; autofix lifts the class above it.
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
    // A helper above the test that uses it floats to the bottom.
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
    // Several helpers between setup and tests all float below, in use order.
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
    // A const interrupting the span keeps the report but blocks the autofix.
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
    // A helper floats below every top-level statement, even a later one that never uses it.
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
