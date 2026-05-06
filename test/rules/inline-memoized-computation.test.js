import rule from "#rules/inline-memoized-computation"
import { tester } from "#test/support"

tester.run("inline-memoized-computation", rule, {
  valid: [
    // Computation is inline, not delegated.
    "class C { #user; get user() { return this.#user ??= User.find(this.id) } }",
    // Delegated call takes arguments, so it genuinely parameterizes.
    "class C { #name; #format() {}; get name() { return this.#name ??= this.#format(this.a, this.b) } }",
    // Additional logic beyond a bare call.
    "class C { #x; #find() {}; #alt() {}; get x() { return this.#x ??= this.#find() || this.#alt() } }",
    // Delegates to a public method, which may be inherited.
    "class C { #user; find() {}; get user() { return this.#user ??= this.find() } }",
    // Plain assignment, not memoization.
    "class C { #x; #compute() {}; m() { this.#x = this.#compute() } }"
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
    }
  ]
})
