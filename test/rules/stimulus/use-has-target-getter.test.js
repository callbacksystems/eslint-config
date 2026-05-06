import rule from "#rules/stimulus/use-has-target-getter"
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
    `
  ],
  invalid: [
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
    }
  ]
})
