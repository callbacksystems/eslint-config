import rule from "#rules/inline_memoized_computation"
import { tester } from "#support"

tester.run("inline-memoized-computation", rule, {
  valid: [
    "class C { #user; get user() { return this.#user ??= User.find(this.id) } }",
    "class C { #name; #format() {}; get name() { return this.#name ??= this.#format(this.a, this.b) } }",
    "class C { #x; #find() {}; #alt() {}; get x() { return this.#x ??= this.#find() || this.#alt() } }",
    // A public method may be inherited.
    "class C { #user; find() {}; get user() { return this.#user ??= this.find() } }",
    "class C { #x; #compute() {}; m() { this.#x = this.#compute() } }",
    "class C { #x; #compute = callback; get x() { return this.#x ??= this.#compute() } }",
    "class C { #x; #compute(value = 1) {}; get x() { return this.#x ??= this.#compute() } }",
    "class C { #x; async #compute() {}; get x() { return this.#x ??= this.#compute() } }",
    "class C { #x; *#compute() {}; get x() { return this.#x ??= this.#compute() } }",
    "class C { #x; static #compute() {}; get x() { return this.#x ??= this.#compute() } }",
    "class C { #x; #compute() {}; get x() { return this.#x ??= this.#compute() } other() { return this.#compute() } }",
    "class C { #x; #compute() {}; get x() { function nested() { return this.#x ??= this.#compute() }; "
    + "return nested } }",
    {
      name: "counts a nested class computed key evaluated with the outer this",
      code: "class C { #cache; get value() { class Nested { [this.#compute()]() {} } "
        + "return this.#cache ??= this.#compute() } #compute() { return 1 } }"
    },
    {
      name: "counts a nested class superclass evaluated with the outer this",
      code: "class C { #cache; get value() { class Nested extends this.#compute() {} "
        + "return this.#cache ??= this.#compute() } #compute() { return class {} } }"
    },
    {
      name: "counts an outer private read from a nested class body",
      code: "class C { #cache; get value() { class Nested { field = this.#compute() } "
        + "return this.#cache ??= this.#compute() } #compute() { return 1 } }"
    }
  ],
  invalid: [
    {
      code: "class C { #positions; #compute() {}; get positions() { return this.#positions ??= this.#compute() } }",
      errors: [ { messageId: "inlineComputation", data: { target: "#compute" } } ]
    },
    {
      code: "class C { #user; #findUser() {}; get user() { return this.#user ||= this.#findUser() } }",
      errors: [ { messageId: "inlineComputation", data: { target: "#findUser" } } ]
    },
    {
      code: "class C { #data; #load() {}; ensure() { this.#data ??= this.#load() } }",
      errors: [ { messageId: "inlineComputation", data: { target: "#load" } } ]
    },
    {
      code: "class C { static #data; static #load() {}; static ensure() { this.#data ??= this.#load() } }",
      errors: [ { messageId: "inlineComputation", data: { target: "#load" } } ]
    },
    {
      code: "class C { #data; #load() {}; ensure() { this.#data ??= this.#load() } "
        + "nested() { return class { #load() {}; use() { return this.#load() } } } }",
      errors: [ { messageId: "inlineComputation", data: { target: "#load" } } ]
    },
    {
      name: "indexes a large class once instead of rescanning it for every memoization",
      code: memoizedClassWith(400),
      errors: 400
    },
    {
      name: "indexes lexically nested classes without rescanning their descendants",
      code: nestedMemoizedClasses(400),
      errors: 400
    }
  ]
})

function memoizedClassWith(count) {
  return `class Subject { ${Array.from({ length: count }, memoizedMemberAt).join("\n")} }`
}

function memoizedMemberAt(_, index) {
  return `#value${index}; get value${index}() { return this.#value${index} ??= this.#compute${index}() } `
    + `#compute${index}() { return ${index} }`
}

function nestedMemoizedClasses(count) {
  return Array.from({ length: count }, (_, index) => count - index - 1).reduce(nestedClassAround, "")
}

function nestedClassAround(inner, index) {
  return `class C${index} { #cache; get value() { ${inner} return this.#cache ??= this.#compute() } `
    + `#compute() { return ${index} } }`
}
