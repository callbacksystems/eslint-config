import rule from "#rules/prefer_getter"
import { tester } from "#support"

tester.run("prefer-getter", rule, {
  valid: [
    "class C { scaled(factor) { return factor * 2 } }",
    "class C { total() { const base = 1; return base } }",
    "class C { async data() { return 1 } }",
    "class C { toggle() { return this.open = true } }",
    "class C { reset() { return this } }",
    "class C { handler() { return () => this.run() } }",
    "class C { next() { return this.items.pop() } }",
    "class C { resetAll() { return this.items.splice(0) } }",
    "class C { next() { return this.items[\"pop\"]() } }",
    "class C { resetAll() { return this.items[`splice`](0) } }",
    "class C { count() { return this.total++ } }",
    "class C { type() { return class Value {} } }",
    "class C { buildUser() { return new User() } }",
    "class C { user() { return ready ? new User() : cached } }",
    "function build() { return new User() } class C { user() { return build() } }",
    "class C { persist() { return this.saved = true } save() { return this.persist() } }",
    "class C { save() { return this.prepare() } prepare() { return this.persist() } "
    + "persist() { return delete this.saved } }",
    "let saved = false; function persist() { return saved = true } class C { save() { return persist() } }",
    "class C { save() { return (() => { this.saved = true; return this.saved })() } }",
    "class C { save() { return transform(this.repository, () => { this.saved = true }) } }",
    "let reads = 0; class C { get source() { reads++; return 1 } value() { return this.source + 1 } }",
    "let reads = 0; class C { get source() { return record(++reads) } value() { return this.source } }",
    "class C { total() { return this.service.total(this.items) } }",
    "class C { fullName() { return this.user.fullName() } }",
    "class C { save() { return this.repository.save() } }",
    "class C { #names() { return this.list.map((item) => item.name) } }",
    "class C { #pop() {} item() { return this.items.#pop() } }",
    "class Values { static double(value) { return value * 2 } }; consume(Values); "
    + "class C { value() { return Values.double(2) } }",
    "function transform(callback) { return callback() } class C { value() { return transform(() => state++) } }",
    "const Object = { is(left, right) { state++; return left === right } }; "
    + "class C { matches() { return Object.is(this.left, this.right) } }",
    "Object.is = replacement; class C { matches() { return Object.is(this.left, this.right) } }",
    "class C { matches() { return Object.is(...this.values) } }",
    "class C { [methodName]() { return this.items.length } }",
    "class C { toString() { return this.label } }",
    "class C { get size() { return this.items.length } }",
    // Computed keys, static fields and static blocks run while the returned class is created.
    "class C { value() { return { Nested: class { [state.count += 1]() {} } } } }",
    "class C { value() { return { Nested: class { static field = state.count += 1 } } } }",
    "class C { value() { return { Nested: class { static { state.count += 1 } } } } }"
  ],
  invalid: [
    {
      code: "const key = 'size'; class C { [key]() { return this.items.length } }",
      errors: [ { messageId: "preferGetter", data: { name: "size" } } ]
    },
    {
      code: "class C { size() { return this.items.length } }",
      errors: [ { messageId: "preferGetter", data: { name: "size" } } ]
    },
    {
      name: "recognizes a coercion-free standard call",
      code: "class C { matches() { return Object.is(this.left, this.right) } }",
      errors: [ { messageId: "preferGetter", data: { name: "matches" } } ]
    },
    {
      name: "recognizes a stable alias of a coercion-free standard call",
      code: "const same = Object.is; class C { matches() { return same(this.left, this.right) } }",
      errors: [ { messageId: "preferGetter", data: { name: "matches" } } ]
    },
    {
      name: "follows a confined local static method",
      code: "class Values { static double(value) { return value * 2 } } "
        + "class C { value() { return Values.double(2) } }",
      errors: [ { messageId: "preferGetter", data: { name: "value" } } ]
    },
    {
      code: "class C { add() { return 1 } value() { return this.add() } }",
      errors: [ { messageId: "preferGetter", data: { name: "value" } } ]
    },
    {
      code: "class C { pop(unused) { return this.last } value() { return this.pop() } }",
      errors: [ { messageId: "preferGetter", data: { name: "value" } } ]
    },
    {
      name: "ignores unreachable mutations inside an IIFE",
      code: "class C { value() { return (() => { return this.current; this.current++ })() } }",
      errors: [ { messageId: "preferGetter", data: { name: "value" } } ]
    },
    {
      name: "does not assume a callback argument is invoked",
      code: "function transform(callback) { return value } "
        + "class C { value() { return transform(() => state++) } }",
      errors: [ { messageId: "preferGetter", data: { name: "value" } } ]
    },
    {
      code: "class C { ['size']() { return this.items.length } }",
      errors: [ { messageId: "preferGetter", data: { name: "size" } } ]
    },
    {
      code: "class C { static [`size`]() { return this.items.length } }",
      errors: [ { messageId: "preferGetter", data: { name: "size" } } ]
    },
    {
      name: "ignores mutations in a returned class's deferred method body",
      code: "class C { value() { return { Nested: class { mutate() { state.count += 1 } } } } }",
      errors: [ { messageId: "preferGetter", data: { name: "value" } } ]
    },
    {
      name: "ignores mutations in a static block's deferred function declaration",
      code: `class C {
        value() {
          return { Nested: class { static { function mutate() { state.count += 1 } } } }
        }
      }`,
      errors: [ { messageId: "preferGetter", data: { name: "value" } } ]
    },
    {
      name: "ignores deferred instance field initializers",
      code: "class C { value() { return { Nested: class { field = state.count += 1 } } } }",
      errors: [ { messageId: "preferGetter", data: { name: "value" } } ]
    },
    { name: "does not rescan deeply nested deferred class bodies", code: nestedComputedClasses(200), errors: 199 }
  ]
})

function nestedComputedClasses(count) {
  return Array.from({ length: count }, (_, index) => count - index - 1).reduce(nestedComputedClassAround, "")
}

function nestedComputedClassAround(inner, index) {
  return `class C${index} { #value${index}() { return { nested: ${inner || "null"} } } }`
}
