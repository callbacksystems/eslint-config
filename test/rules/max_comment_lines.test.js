import rule from "#rules/max_comment_lines"
import { dedent, tester } from "#support"

const BACKTICK = "`"

tester.run("max-comment-lines", rule, {
  valid: [
    // The directive above the block is not one of its lines.
    dedent`
      const x = 1

      // eslint-disable-next-line no-unused-vars
      // A cache miss means the nightly job never ran, so we raise
      // to surface the broken schedule.
      const a = 1
    `,
    dedent`
      class Widget {
        // A cache miss means the nightly job never ran, so we raise
        // to surface the broken schedule instead of recomputing.
        get price() { return 1 }
      }
    `,
    // The block opening the file gets four lines.
    dedent`
      // The importer keeps the raw payload because support reads it
      // when a row is disputed.
      // Rows are matched by external id, so a rename upstream never
      // duplicates a record here.
      export const importer = 1
    `,
    // A shebang belongs to the tooling, so the block after it still opens the file.
    dedent`
      #!/usr/bin/env node
      // One line of prose.
      // Two lines of prose.
      // Three lines of prose.
      // Four lines of prose.
      const value = 1
    `,
    dedent`
      const first = 1 // first
      const second = 2 // second
      const third = 3 // third
    `,
    dedent`
      // One line of prose.
      // Two lines of prose.
      const first = 1
      // Three lines of prose.
      // Four lines of prose.
      const second = 2
    `,
    {
      code: dedent`
        class Widget {
          // One line of prose.
          // Two lines of prose.
          // Three lines of prose.
          get price() { return 1 }
        }
      `,
      options: [ { max: 3 } ]
    },
    // A test narrates its scenario, so its comments have no limit.
    dedent`
      test("price starts empty", () => {
        // The widget starts without a price.
        // The nightly job then sets one.
        // A second run must not touch it.
        // We run the job twice here.
        // Then we read the price back.
        assert.equal(widget.price, 1)
      })
    `,
    dedent`
      it("starts empty", () => {
        // The widget starts without a price.
        // The nightly job then sets one.
        // A second run must not touch it.
        // We run the job twice here.
        // Then we read the price back.
        assert.equal(widget.price, 1)
      })
    `,
    dedent`
      test.only("price starts empty", async function () {
        // The widget starts without a price.
        // The nightly job then sets one.
        // A second run must not touch it.
        // We run the job twice here.
        // Then we read the price back.
        assert.equal(widget.price, 1)
      })
    `,
    dedent`
      test["only"]("price starts empty", () => {
        // The widget starts without a price.
        // The nightly job then sets one.
        // A second run must not touch it.
        // We run the job twice here.
        // Then we read the price back.
        assert.equal(widget.price, 1)
      })
    `,
    dedent`
      it[${BACKTICK}skip${BACKTICK}]("starts empty", () => {
        // The widget starts without a price.
        // The nightly job then sets one.
        // A second run must not touch it.
        // We run the job twice here.
        // Then we read the price back.
        assert.equal(widget.price, 1)
      })
    `,
    // JSDoc belongs to `no-jsdoc`, which asks for the whole thing to go.
    dedent`
      /**
       * @param {number} price
       * @returns {number}
       */
      export function doubled(price) { return price * 2 }
    `
  ],
  invalid: [
    {
      code: dedent`
        const value = 1 /* One line of prose.
          Two lines of prose.
          Three lines of prose. */
      `,
      errors: [ { messageId: "tooLong", data: { count: "3", limit: "2" } } ]
    },
    {
      code: dedent`
        class Suite {
          #only() {}
          run() {
            test.#only("private", () => {
              // One line of prose.
              // Two lines of prose.
              // Three lines of prose.
              assert.ok(true)
            })
          }
        }
      `,
      errors: [ { messageId: "tooLong", data: { count: "3", limit: "2" } } ]
    },
    {
      code: dedent`
        class Widget {
          // The cache is warmed by the nightly job, and a miss here
          // means the job never ran, so we raise instead of recomputing
          // to surface the broken schedule.
          get price() { return 1 }
        }
      `,
      errors: [ { messageId: "tooLong", data: { count: "3", limit: "2" } } ]
    },
    {
      code: dedent`
        // One line of prose.
        // Two lines of prose.
        // Three lines of prose.
        // Four lines of prose.
        // Five lines of prose.
        const value = 1
      `,
      errors: [ { messageId: "tooLong", data: { count: "5", limit: "4" } } ]
    },
    {
      code: dedent`
        // One line of prose.
        // Two lines of prose.
        // Three lines of prose.
        // Four lines of prose.
        // Five lines of prose.

        const value = 1
      `,
      errors: [ { messageId: "tooLong", data: { count: "5", limit: "4" } } ]
    },
    {
      code: dedent`
        const first = 1
        /* One line of prose.
           Two lines of prose.
           Three lines of prose. */
        const second = 2
      `,
      errors: [ { messageId: "tooLong", data: { count: "3", limit: "2" } } ]
    },
    {
      code: dedent`
        beforeEach(() => {
          // The widget starts without a price.
          // The nightly job then sets one.
          // A second run must not touch it.
          // We run the job twice here.
          // Then we read the price back.
          widget = new Widget()
        })
      `,
      errors: [ { messageId: "tooLong", data: { count: "5", limit: "2" } } ]
    },
    {
      code: dedent`
        describe("widget", () => {
          // The widget starts without a price.
          // The nightly job then sets one.
          // A second run must not touch it.
          // We run the job twice here.
          // Then we read the price back.
          it("starts empty", () => {
            assert.equal(widget.price, 1)
          })
        })
      `,
      errors: [ { messageId: "tooLong", data: { count: "5", limit: "2" } } ]
    },
    {
      code: dedent`
        function widget() {
          // The widget starts without a price.
          // The nightly job then sets one.
          // A second run must not touch it.
          // We run the job twice here.
          // Then we read the price back.
          return new Widget()
        }
      `,
      errors: [ { messageId: "tooLong", data: { count: "5", limit: "2" } } ]
    },
    {
      code: dedent`
        class Widget {
          // One line of prose.
          // Two lines of prose.
          get price() { return 1 }
        }
      `,
      options: [ { max: 1 } ],
      errors: [ { messageId: "tooLong", data: { count: "2", limit: "1" } } ]
    },
    {
      code: dedent`
        // One line of prose.
        // Two lines of prose.
        // Three lines of prose.
        const value = 1
      `,
      options: [ { headerMax: 2 } ],
      errors: [ { messageId: "tooLong", data: { count: "3", limit: "2" } } ]
    }
  ]
})
