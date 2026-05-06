import rule from "#rules/no_redundant_wrapper"
import { dedent, tester } from "#support"

tester.run("no-redundant-wrapper", rule, {
  valid: [
    // Named for something else, so it is the seam a subclass overrides rather than a second spelling.
    dedent`
      const DEFAULT_MARKER_TAG = "x"

      class C {
        get #markerTag() {
          return DEFAULT_MARKER_TAG
        }

        report() {
          return this.#markerTag
        }
      }
    `,
    // Read from several places: the getter is the single spelling of the value.
    dedent`
      const MESSAGE = "x"

      class C {
        get #message() {
          return MESSAGE
        }

        report() {
          return this.#message
        }

        log() {
          return this.#message
        }
      }
    `,
    // Public method may be API.
    "class C { findAll() { return find(this.node) } }",
    // Predicate may be a semantic alias.
    "class C { #hasItems() { return check(this.node) } }",
    // Transforms the result, not a bare forward.
    "class C { #names() { return collect(this.node).map((item) => item.name) } }",
    // Argument is computed, not passed through.
    "class C { #wrap() { return other(compute()) } }",
    // Getter forwarding to a non-local function is a thin accessor of a shared util.
    "class C { get #thing() { return build(this.a, this.b) } }",
    // Public getter is part of the interface.
    "function build(a, b) { return a } class C { get thing() { return build(this.a, this.b) } }",
    // Read from several places, the getter is the one spelling of the value rather than indirection.
    dedent`
      function normalize(text) { return text }

      class C {
        #text = ""

        get title() {
          return this.#trimmed
        }

        get slug() {
          return this.#trimmed
        }

        get #trimmed() {
          return normalize(this.#text)
        }
      }
    `,
    // An exported function is API.
    "export function folderTree(folders) { return FolderTree.from(folders) }",
    // The name is the whole value when the call hangs off a parameter.
    "function alphabetically(left, right) { return left.localeCompare(right) }",
    // A factory naming the construction is not a forward.
    "function folderTree(folders) { return new FolderTree(folders) }",
    // Not every argument is a parameter of its own.
    "function folderTree(folders) { return FolderTree.from(folders, { deep: true }) }"
  ],
  invalid: [
    // A member that only spells a constant again is the same indirection with a value in place of the call.
    {
      code: dedent`
        const MESSAGE = "x"

        class C {
          get #message() {
            return MESSAGE
          }

          report() {
            return this.#message
          }
        }
      `,
      errors: [ { messageId: "redundantConstant", data: { name: "#message", constant: "MESSAGE" } } ]
    },
    {
      code: "class C { #findAll() { return find(this.node) } }",
      errors: [ { messageId: "redundantWrapper", data: { name: "#findAll" } } ]
    },
    {
      code: "class C { #helper(value) { return process(value) } }",
      errors: [ { messageId: "redundantWrapper", data: { name: "#helper" } } ]
    },
    {
      // Getter forwarding the class's own fields to a module-local function: that function should be a method of this
      // class, not a free function.
      code: "function build(a, b) { return a } class C { get #thing() { return build(this.a, this.b) } }",
      errors: [ { messageId: "redundantWrapper", data: { name: "#thing" } } ]
    },
    // A named constructor aliased behind a function of the same name in lower case.
    {
      code: "function folderTree(folders) { return FolderTree.from(folders) }",
      errors: [ { messageId: "redundantWrapper", data: { name: "folderTree" } } ]
    },
    {
      code: "function keyList(object) { return Object.keys(object) }",
      errors: [ { messageId: "redundantWrapper", data: { name: "keyList" } } ]
    },
    {
      code: "function outer(value) { return inner(value) }\nfunction inner(value) { return value }",
      errors: [ { messageId: "redundantWrapper", data: { name: "outer" } } ]
    }
  ]
})
