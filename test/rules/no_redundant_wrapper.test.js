import rule from "#rules/no_redundant_wrapper"
import { dedent, tester } from "#support"

tester.run("no-redundant-wrapper", rule, {
  valid: [
    // Named differently from the constant, so it is a seam rather than a second spelling.
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
    // Read from several places, the getter is the single spelling of the value.
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
    "class C { findAll() { return find(this.node) } }",
    // A predicate may be a semantic alias.
    "class C { #hasItems() { return check(this.node) } }",
    "class C { #names() { return collect(this.node).map((item) => item.name) } }",
    "class C { #wrap() { return other(compute()) } }",
    // `build` is not local, so the getter is a thin accessor of a shared util.
    "class C { get #thing() { return build(this.a, this.b) } }",
    "function build(a, b) { return a } class C { get thing() { return build(this.a, this.b) } }",
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
    "export function folderTree(folders) { return FolderTree.from(folders) }",
    "function alphabetically(left, right) { return left.localeCompare(right) }",
    "function folderTree(folders) { return new FolderTree(folders) }",
    "function folderTree(folders) { return FolderTree.from(folders, { deep: true }) }"
  ],
  invalid: [
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
      code: "class C { #findAll() { return this.find(this.node) } }",
      errors: [ { messageId: "redundantWrapper", data: { name: "#findAll" } } ]
    },
    {
      code: "class C { #helper(value) { return process(value) } }",
      errors: [ { messageId: "redundantWrapper", data: { name: "#helper" } } ]
    },
    {
      // `build` is module-local and takes the class's own fields, so it should be a method of the class.
      code: "function build(a, b) { return a } class C { get #thing() { return build(this.a, this.b) } }",
      errors: [ { messageId: "redundantWrapper", data: { name: "#thing" } } ]
    },
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
