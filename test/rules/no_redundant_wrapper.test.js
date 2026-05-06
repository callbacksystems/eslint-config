import rule from "#rules/no_redundant_wrapper"
import { dedent, tester } from "#support"

tester.run("no-redundant-wrapper", rule, {
  valid: [
    "class C { async #findAll(body) { return findAll(body) } }",
    "class C { *#findAll(body) { return findAll(body) } }",
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
    "class C { #includes(body) { return this.hasValue(body) } hasValue(body) { return new Set(body).has(value) } }",
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
    "function folderTree(folders) { return FolderTree.from(folders) } export { folderTree as treeOf }",
    "export default function (folders) { return FolderTree.from(folders) }",
    "function alphabetically(left, right) { return left.localeCompare(right) }",
    "function local(value) { return value } function wrapper(local) { return local() }",
    "function recurse(value) { return recurse(value) }",
    "const again = recurse; function recurse(value) { return again(value) }",
    "class C { #recurse(value) { return this.#recurse(value) } }",
    "class C { #message(MESSAGE) { return MESSAGE } run(value) { return this.#message(value) } }",
    "function target(a, b) { return a + b } function swap(a, b) { return target(b, a) }",
    "function target(a) { return a } function drop(a, b) { return target(a) }",
    "class C { #adapt(a, b) { return process(a, a) } }",
    "class C { #adapt(value) { return process(this.node) } }",
    "class C { #adapt() { return process(this[field]) } }",
    "class C { #adapt() { return process(this[compute()]) } }",
    "function adapt(value = fallback) { return Target.from(value) }",
    "function adapt({ value }) { return Target.from(value) }",
    "function adapt(...values) { return Target.from(values) }",
    "function folderTree(folders) { return new FolderTree(folders) }",
    "function folderTree(folders) { return FolderTree.from(folders, { deep: true }) }",
    "function helper() {} class C { get #value() { return helper() } "
    + "compare(other) { return this.#value + other.#value } }",
    "function helper() {} class C { get #value() { return helper() } run(other) { class Nested { "
    + "read() { return other.#value } } return this.#value } }",
    { name: "indexes private reads once across nested classes", code: nestedPrivateGetters(500) }
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
      code: "class C { #users() { return this.users() } users() { return this.repository.users() } }",
      errors: [ { messageId: "redundantWrapper", data: { name: "#users" } } ]
    },
    {
      name: "does not infer a native predicate chain after its method is replaced",
      code: "Set.prototype.has = replacement; class C { #includes(body) { return this.hasValue(body) } "
        + "hasValue(body) { return new Set(body).has(value) } }",
      errors: [ { messageId: "redundantWrapper", data: { name: "#includes" } } ]
    },
    {
      code: "class C { #helper(left, right) { return process(this.before, left, this.between, right) } }",
      errors: [ { messageId: "redundantWrapper", data: { name: "#helper" } } ]
    },
    {
      code: "class C { #helper() { return process(this[\"value\"]) } }",
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
    },
    {
      code: "const inner = (value) => value\nfunction outer(value) { return inner(value) }",
      errors: [ { messageId: "redundantWrapper", data: { name: "outer" } } ]
    },
    {
      code: "function helper() {} class C { get #value() { return helper() } run() { class Nested { "
        + "#value; read() { return this.#value } } return this.#value } }",
      errors: [ { messageId: "redundantWrapper", data: { name: "#value" } } ]
    }
  ]
})

function nestedPrivateGetters(count) {
  return Array.from({ length: count }, (_, index) => count - index - 1).reduce(privateGetterAround, "")
}

function privateGetterAround(inner, index) {
  return `class C${index} { get #value${index}() { return helper() } `
    + `use${index}() { ${inner} return this.#value${index} } }`
}
