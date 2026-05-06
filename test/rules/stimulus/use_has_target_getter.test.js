import rule from "#rules/stimulus/use_has_target_getter"
import { dedent, tester } from "#support"

tester.run("stimulus/use-has-target-getter", rule, {
  valid: [
    dedent`
      class Foo extends Controller {
        static targets = [ "row" ]
        log() {
          console.log(this.rowTargets.length)
        }
      }
    `,
    dedent`
      class Foo extends Controller {
        static targets = [ "row" ]
        eachIndex() {
          for (let i = 0; i < this.rowTargets.length; i++) handle(i)
        }
      }
    `,
    dedent`
      class Foo {
        guard() {
          return this.rowTargets.length > 0
        }
      }
    `,
    dedent`
      class Foo extends Controller {
        static targets = [ "row" ]
        present() {
          return this.hasRowTarget
        }
      }
    `,
    dedent`
      class Foo extends Controller {
        exact() {
          return this.rowTargets.length === 1
        }
      }
    `,
    dedent`
      class Foo extends Controller {
        many() {
          return this.rowTargets.length > 1
        }
      }
    `,
    dedent`
      class Foo extends Controller {
        arithmetic() {
          return this.rowTargets.length + 1
        }
      }
    `,
    dedent`
      class Foo extends Controller {
        static present() {
          return this.rowTargets.length > 0
        }
      }
    `,
    dedent`
      class Foo extends Controller {
        present() {
          return function () { return this.rowTargets.length > 0 }
        }
      }
    `,
    dedent`
      class Foo extends Controller {
        #rowTargets = []
        present() {
          return this.#rowTargets.length > 0
        }
      }
    `
  ],
  invalid: [
    {
      code: dedent`
        const targets = "rowTargets"
        const length = "length"
        class Foo extends Controller {
          present() {
            return this[targets][length] > 0
          }
        }
      `,
      errors: [ { messageId: "useHasTarget", data: { name: "row", Name: "Row" } } ]
    },
    {
      code: dedent`
        class Foo extends Controller {
          static targets = [ "row" ]
          present() {
            return this.rowTargets.length > 0
          }
        }
      `,
      errors: [ { messageId: "useHasTarget", data: { name: "row", Name: "Row" } } ]
    },
    {
      code: dedent`
        class Foo extends Controller {
          static targets = [ "row" ]
          empty() {
            return this.rowTargets.length === 0
          }
        }
      `,
      errors: [ { messageId: "useHasTarget", data: { name: "row", Name: "Row" } } ]
    },
    {
      code: dedent`
        class Foo extends Controller {
          static targets = [ "row" ]
          missing() {
            return this.rowTargets.length !== 0
          }
        }
      `,
      errors: [ { messageId: "useHasTarget", data: { name: "row", Name: "Row" } } ]
    },
    {
      code: dedent`
        class Foo extends Controller {
          static targets = [ "primaryRow" ]
          present() {
            return this.primaryRowTargets.length >= 1
          }
        }
      `,
      errors: [ { messageId: "useHasTarget", data: { name: "primaryRow", Name: "PrimaryRow" } } ]
    },
    {
      code: dedent`
        class Foo extends Controller {
          present() {
            return 0 < this.rowTargets.length
          }
        }
      `,
      errors: [ { messageId: "useHasTarget" } ]
    },
    {
      code: dedent`
        class Foo extends Controller {
          absent() {
            return 1 > this.rowTargets.length
          }
        }
      `,
      errors: [ { messageId: "useHasTarget" } ]
    },
    {
      code: dedent`
        class Foo extends Controller {
          hasRows() {
            return this["rowTargets"]["length"] > 0
          }
        }
      `,
      errors: [ { messageId: "useHasTarget", data: { name: "row", Name: "Row" } } ]
    }
  ]
})
