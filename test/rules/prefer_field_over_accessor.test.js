import rule from "#rules/prefer_field_over_accessor"
import { dedent, tester } from "#support"

tester.run("prefer-field-over-accessor", rule, {
  valid: [
    dedent`
      class Counter {
        #total
        get total() { return this.#total ?? 0 }
      }
    `,
    dedent`
      class Range {
        #startsOn
        get start() { return this.#startsOn }
      }
    `,
    dedent`
      class Widget {
        #size = 1
        get area() { return this.#size * this.#size }
      }
    `,
    dedent`
      class Counter {
        #count = 0
        get count() { return this.#count }
        set count(value) { this.#count = Math.max(value, 0) }
      }
    `,
    dedent`
      class Counter {
        #count = 0
        get count() { return this.#count }
        set count(value) {
          this.#count = value
          this.notify()
        }
      }
    `,
    dedent`
      class Counter {
        #count = 0
        set count(value) { this.#count = value }
      }
    `,
    dedent`
      class Registry {
        static #instance
        static get instance() { return this.#instance }
      }
    `,
    dedent`
      class Counter {
        #count = 0
        get #current() { return this.#count }
      }
    `
  ],
  invalid: [
    {
      code: dedent`
        class Range {
          #startsOn
          #endsOn

          constructor(day) {
            this.#startsOn = day
            this.#endsOn = null
          }

          get startsOn() {
            return this.#startsOn
          }

          get endsOn() {
            return this.#endsOn
          }

          get isComplete() {
            return this.#startsOn && this.#endsOn
          }

          choose(day) {
            this.#endsOn = day
          }
        }
      `,
      // One fix per pass, since each relay's fix spans the class.
      output: dedent`
        class Range {
          #endsOn

          constructor(day) {
            this.startsOn = day
            this.#endsOn = null
          }

          get endsOn() {
            return this.#endsOn
          }

          get isComplete() {
            return this.startsOn && this.#endsOn
          }

          choose(day) {
            this.#endsOn = day
          }
        }
      `,
      errors: [
        { messageId: "preferField", data: { name: "startsOn" } },
        { messageId: "preferField", data: { name: "endsOn" } }
      ]
    },
    {
      code: dedent`
        class Counter {
          #count = 0

          get count() {
            return this.#count
          }

          increment() {
            this.#count += 1
          }
        }
      `,
      output: dedent`
        class Counter {
          count = 0

          increment() {
            this.count += 1
          }
        }
      `,
      errors: [ { messageId: "preferField", data: { name: "count" } } ]
    },
    {
      code: dedent`
        class Counter {
          #count = 0

          get count() {
            return this.#count
          }

          set count(value) {
            this.#count = value
          }
        }
      `,
      output: dedent`
        class Counter {
          count = 0
        }
      `,
      errors: [ { messageId: "preferField", data: { name: "count" } } ]
    },
    {
      code: dedent`
        class Counter {
          #count = 0
          // The running total.
          get count() { return this.#count } // read by the view
          reset() { this.#count = 0 }
        }
      `,
      output: dedent`
        class Counter {
          // The running total.
          // read by the view
          count = 0
          reset() { this.count = 0 }
        }
      `,
      errors: [ { messageId: "preferField", data: { name: "count" } } ]
    },
    {
      code: dedent`
        class Range {
          #startsOn

          constructor(day) {
            this.#startsOn = day
          }

          // The day the range opens.
          get startsOn() {
            return this.#startsOn
          }
        }
      `,
      output: dedent`
        class Range {
          constructor(day) {
            // The day the range opens.
            this.startsOn = day
          }
        }
      `,
      errors: [ { messageId: "preferField", data: { name: "startsOn" } } ]
    },
    {
      code: dedent`
        class Range {
          #startsOn

          // Set by the calendar.
          get startsOn() {
            return this.#startsOn
          }
        }
      `,
      output: dedent`
        class Range {
          // Set by the calendar.
        }
      `,
      errors: [ { messageId: "preferField", data: { name: "startsOn" } } ]
    },
    {
      code: dedent`
        class Money {
          #amount = 0
          get amount() { return this.#amount }
          equals(other) { return #amount in other && other.#amount === this.#amount }
        }
      `,
      output: null,
      errors: [ { messageId: "preferField", data: { name: "amount" } } ]
    },
    {
      code: dedent`
        class Outer {
          #size = 1
          get size() { return this.#size }
          get inner() {
            return class {
              #size = 2
              double() { return this.#size * 2 }
            }
          }
        }
      `,
      output: null,
      errors: [ { messageId: "preferField", data: { name: "size" } } ]
    }
  ]
})
