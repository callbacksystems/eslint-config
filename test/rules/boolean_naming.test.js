import rule from "#rules/boolean_naming"
import { dedent, tester } from "#support"

tester.run("boolean-naming", rule, {
  valid: [
    // A bare return next to `return true` marks a command, not a predicate.
    dedent`
      class C {
        commit(event) {
          event?.preventDefault()
          if (!this.combobox.commit()) return

          this.dispatch("commit", {})
          return true
        }
      }
    `,
    "class C { get isValid() { return this.x === 1 } }",
    "function isReady() { return state === \"ready\" }",
    "class C { forwardsAll() { return this.items.every(Boolean) } }",
    "class C { has(key) { return this.set.has(key) } }",
    "class C { get name() { return this.value } }",
    "class C { count() { return this.items.length } }",
    "class C { isValid = () => this.x === 1 }",
    "class FooElement extends HTMLElement { get disabled() { return this.hasAttribute(\"disabled\") } }",
    "class FooElement extends HTMLElement { get expanded() { return this.getAttribute(\"x\") === \"y\" } }",
    "class FooElement extends BaseElement { get open() { return this.hasAttribute(\"open\") } }",
    "class C { get total() { return this.sum() } sum() { return this.a + this.b } }",
    "class C { get label() { return this.title || this.name } }",
    "class C { get label() { return this.x ? true : this.name } }",
    // A curried call has no name to read, so what it returns is unknown.
    "function ready() { return compose(a)(b) }",
    dedent`
      function size() { return list.length }
      class C { get count() { return size() } }
    `,
    // An anonymous default export has no name to index, and resolving past it must not crash.
    dedent`
      export default function () { return 1 }
      function size() { return list.length }
      function count() { return size() }
    `
  ],
  invalid: [
    {
      code: "class C { get redundant() { return this.a === this.b } }",
      errors: [ { messageId: "booleanName", data: { name: "redundant", pascal: "Redundant" } } ]
    },
    {
      code: "class C { empty() { return this.items.length === 0 } }",
      errors: [ { messageId: "booleanName", data: { name: "empty", pascal: "Empty" } } ]
    },
    {
      code: "function ready() { return Boolean(value) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "class C { get enabled() { return true } }",
      errors: [ { messageId: "booleanName", data: { name: "enabled", pascal: "Enabled" } } ]
    },
    {
      code: "class C { get ready() { return this.loaded && this.isVisible } }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "class C { get open() { return this.locked ? false : this.isVisible } }",
      errors: [ { messageId: "booleanName", data: { name: "open", pascal: "Open" } } ]
    },
    {
      code: "function ready() { return isConnected }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "class C { closed() { return !this.open } }",
      errors: [ { messageId: "booleanName", data: { name: "closed", pascal: "Closed" } } ]
    },
    {
      code: "class C { valid = () => this.a === this.b }",
      errors: [ { messageId: "booleanName", data: { name: "valid", pascal: "Valid" } } ]
    },
    {
      code: "class C extends Controller { get expanded() { return this.getAttribute(\"x\") === \"y\" } }",
      errors: [ { messageId: "booleanName", data: { name: "expanded", pascal: "Expanded" } } ]
    },
    {
      code: "class FooElement extends HTMLElement { disabled() { return this.hasAttribute(\"disabled\") } }",
      errors: [ { messageId: "booleanName", data: { name: "disabled", pascal: "Disabled" } } ]
    },
    {
      code: "class FooElement extends HTMLElement { get empty() { return this.children.length === 0 } }",
      errors: [ { messageId: "booleanName", data: { name: "empty", pascal: "Empty" } } ]
    },
    {
      code: "class C { get ready() { return this.matchesInput() } matchesInput() { return this.x === 1 } }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: dedent`
        function matchesState() { return state === "on" }
        class C { get active() { return matchesState() } }
      `,
      errors: [ { messageId: "booleanName", data: { name: "active", pascal: "Active" } } ]
    }
  ]
})
