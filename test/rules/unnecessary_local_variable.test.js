import rule from "#rules/unnecessary_local_variable"
import { dedent, tester } from "#support"

tester.run("unnecessary-local-variable", rule, {
  valid: [
    "function f() { const user = find(); user.activate(); return user.id }",
    // Inlining into the callback would re-evaluate `compute()` per item.
    "function f() { const cached = compute(); return list.map((item) => use(cached, item)) }",
    "function f() { const total = 0; return total + 1 }",
    "const config = build(); export default config",
    // A read-write reference is state, not a disposable alias; replacing it would also create an invalid assignment.
    "function f() { const value = compute(); value += 1 }",
    "function f() { const value = object.member; value++ }",
    "function f() { let value = compute(); value = fallback; return use(value) }",
    // Resource declarations own a disposal lifetime that inlining would erase.
    "function f() { using resource = acquire(); use(resource) }",
    "async function f() { await using resource = acquire(); use(resource) }",
    // A snapshot restored in `finally` has to be taken before the `try`.
    "function f() { const previous = snapshot(); try { run() } finally { restore(previous) } }",
    "function f() { try { run() } catch { const previous = snapshot(); restore(previous) } }",
    // Direct eval can read a lexical binding without creating a static reference to it.
    'function f() { const value = compute(); return value + eval("value") }',
    'function f() { const value = compute(); use(value); return eval("value") }'
  ],
  invalid: [
    // Calling a detached property must stay detached; inlining would give the object to the function as `this`.
    {
      code: dedent`
        function f() {
          const action = { ready: 1 }[state]
          action()
        }
      `,
      output: null,
      errors: [ { messageId: "unnecessaryLocal", data: { name: "action" } } ]
    },
    // Below another statement, those parentheses would continue its line, so no fix.
    {
      code: dedent`
        function f() {
          work()
          const action = { ready: 1 }[state]
          action()
        }
      `,
      output: null,
      errors: [ { messageId: "unnecessaryLocal", data: { name: "action" } } ]
    },
    {
      code: "function f() { const directory = forbiddenDirectory(); return Boolean(directory) }",
      output: null,
      errors: [ { messageId: "unnecessaryLocal", data: { name: "directory" } } ]
    },
    {
      code: "function f() { const account = user.account; account.charge() }",
      output: "function f() { user.account.charge() }",
      errors: [ { messageId: "unnecessaryLocal", data: { name: "account" } } ]
    },
    {
      code: "function f() { const directory = forbiddenDirectory(); log(); return Boolean(directory) }",
      output: null,
      errors: [ { messageId: "unnecessaryLocal", data: { name: "directory" } } ]
    },
    {
      code: "function f() { const /* keep */ value = compute(); return use(value) }",
      output: null,
      errors: [ { messageId: "unnecessaryLocal", data: { name: "value" } } ]
    },
    {
      code: "function f() { work()\nconst value = compute();\n[value].forEach(use) }",
      output: null,
      errors: [ { messageId: "unnecessaryLocal", data: { name: "value" } } ]
    },
    {
      code: "function f() { const summary = expectedSummary(); return { summary } }",
      output: "function f() { return { summary: expectedSummary() } }",
      errors: [ { messageId: "unnecessaryLocal", data: { name: "summary" } } ]
    },
    {
      code: "function f() { const items = list.all; return { items, total: 1 } }",
      output: "function f() { return { items: list.all, total: 1 } }",
      errors: [ { messageId: "unnecessaryLocal", data: { name: "items" } } ]
    },
    {
      code: dedent`
        function f() {
          function use(value) { return value }
          const value = compute()
          // explains the call
          return use(value)
        }
      `,
      output: dedent`
        function f() {
          function use(value) { return value }
          // explains the call
          return use(compute())
        }
      `,
      errors: [ { messageId: "unnecessaryLocal", data: { name: "value" } } ]
    },
    // A declaration outside a block has no next statement to inline into, so no fix.
    {
      code: dedent`
        function f(state) {
          switch (state) {
            case "ready":
              const action = build()
              return run(action)
          }
        }
      `,
      output: null,
      errors: [ { messageId: "unnecessaryLocal", data: { name: "action" } } ]
    },
    {
      code: "function f() { const value = compute(); if (condition) consume(value) }",
      output: null,
      errors: [ { messageId: "unnecessaryLocal", data: { name: "value" } } ]
    },
    {
      code: "function f() { const value = compute(); for (const item of items) consume(value, item) }",
      output: null,
      errors: [ { messageId: "unnecessaryLocal", data: { name: "value" } } ]
    },
    {
      code: "function f() { const value = compute(); condition && consume(value) }",
      output: null,
      errors: [ { messageId: "unnecessaryLocal", data: { name: "value" } } ]
    },
    {
      code: "function f() { const method = object.method; method() }",
      output: null,
      errors: [ { messageId: "unnecessaryLocal", data: { name: "method" } } ]
    },
    {
      code: "function f() { const tag = object.tag; tag`value` }",
      output: null,
      errors: [ { messageId: "unnecessaryLocal", data: { name: "tag" } } ]
    },
    {
      code: "function f() { const value = compute(); consume(other(), value) }",
      output: null,
      errors: [ { messageId: "unnecessaryLocal", data: { name: "value" } } ]
    },
    {
      code: "function f() { const value = compute(); target ||= value }",
      output: null,
      errors: [ { messageId: "unnecessaryLocal", data: { name: "value" } } ]
    },
    {
      code: "function f() { const value = compute(); const { marker } = source, result = use(value) }",
      output: null,
      errors: [ { messageId: "unnecessaryLocal", data: { name: "value" } } ]
    },
    {
      code: "function f() { const value = compute(); target += value }",
      output: null,
      errors: [ { messageId: "unnecessaryLocal", data: { name: "value" } } ]
    },
    {
      code: "function f() { let consume = first; function compute() { consume = second; return 1 } "
        + "const value = compute(); consume(value) }",
      output: null,
      errors: [ { messageId: "unnecessaryLocal", data: { name: "value" } } ]
    },
    {
      code: "function f() { function consume(value) { return value } const value = compute(); return consume(value) }",
      output: "function f() { function consume(value) { return value } return consume(compute()) }",
      errors: [ { messageId: "unnecessaryLocal", data: { name: "value" } } ]
    },
    {
      code: "async function f() { const value = compute(); return await value }",
      output: "async function f() { return await compute() }",
      errors: [ { messageId: "unnecessaryLocal", data: { name: "value" } } ]
    },
    {
      code: "function f() { const value = compute(); return value + other() }",
      output: "function f() { return compute() + other() }",
      errors: [ { messageId: "unnecessaryLocal", data: { name: "value" } } ]
    },
    {
      code: "function f() { const value = compute(); return value ? yes : no }",
      output: "function f() { return compute() ? yes : no }",
      errors: [ { messageId: "unnecessaryLocal", data: { name: "value" } } ]
    },
    {
      code: "function f() { const value = compute(); return (value, other()) }",
      output: "function f() { return (compute(), other()) }",
      errors: [ { messageId: "unnecessaryLocal", data: { name: "value" } } ]
    },
    {
      code: "function f() { const value = compute(); return !value }",
      output: "function f() { return !compute() }",
      errors: [ { messageId: "unnecessaryLocal", data: { name: "value" } } ]
    },
    {
      code: [ "function f() { const value = compute(); return `", "$", "{value}` }" ].join(""),
      output: null,
      errors: [ { messageId: "unnecessaryLocal", data: { name: "value" } } ]
    },
    {
      code: "function f() { const value = compute(); if (value) run() }",
      output: "function f() { if (compute()) run() }",
      errors: [ { messageId: "unnecessaryLocal", data: { name: "value" } } ]
    },
    {
      code: "function f() { const value = compute(); while (value) run() }",
      output: null,
      errors: [ { messageId: "unnecessaryLocal", data: { name: "value" } } ]
    },
    {
      code: "function f() { const value = compute(); switch (value) { default: break } }",
      output: "function f() { switch (compute()) { default: break } }",
      errors: [ { messageId: "unnecessaryLocal", data: { name: "value" } } ]
    },
    {
      code: "function f() { const value = compute(); const result = value; return use(result, result) }",
      output: "function f() { const result = compute(); return use(result, result) }",
      errors: [ { messageId: "unnecessaryLocal", data: { name: "value" } } ]
    },
    {
      code: "function f() { const marker = stable; const value = compute(); return { marker, value } }",
      output: "function f() { const marker = stable; return { marker, value: compute() } }",
      errors: [ { messageId: "unnecessaryLocal", data: { name: "value" } } ]
    },
    {
      code: "function f() { const value = compute(); return [, this, value] }",
      output: "function f() { return [, this, compute()] }",
      errors: [ { messageId: "unnecessaryLocal", data: { name: "value" } } ]
    },
    {
      code: "class Child extends Parent { constructor() { const value = compute(); return [this, value] } }",
      output: null,
      errors: [ { messageId: "unnecessaryLocal", data: { name: "value" } } ]
    },
    {
      code: "function f() { const object = compute(); object.value = 1 }",
      output: "function f() { compute().value = 1 }",
      errors: [ { messageId: "unnecessaryLocal", data: { name: "object" } } ]
    },
    {
      code: "function f() { let target; const value = compute(); target = value; return target }",
      output: "function f() { let target; target = compute(); return target }",
      errors: [ { messageId: "unnecessaryLocal", data: { name: "value" } } ]
    },
    {
      code: "function f() { class Box {} const value = compute(); return new Box(value) }",
      output: "function f() { class Box {} return new Box(compute()) }",
      errors: [ { messageId: "unnecessaryLocal", data: { name: "value" } } ]
    },
    {
      code: "function f() { const Klass = makeClass(); return new Klass() }",
      output: "function f() { return new (makeClass())() }",
      errors: [ { messageId: "unnecessaryLocal", data: { name: "Klass" } } ]
    },
    {
      code: "function f() { const action = makeAction(); action() }",
      output: "function f() { makeAction()() }",
      errors: [ { messageId: "unnecessaryLocal", data: { name: "action" } } ]
    },
    {
      code: 'import { use } from "library"; function f() { const value = compute(); return use(value) }',
      output: null,
      errors: [ { messageId: "unnecessaryLocal", data: { name: "value" } } ]
    },
    {
      code: "function f() { function use(value) { return value } const value = compute(); "
        + "const marker = sideEffect(), result = use(value) }",
      output: null,
      errors: [ { messageId: "unnecessaryLocal", data: { name: "value" } } ]
    },
    {
      code: "function f() { function use(value) { return value } const value = compute(); "
        + "const { marker } = source, result = use(value) }",
      output: null,
      errors: [ { messageId: "unnecessaryLocal", data: { name: "value" } } ]
    },
    {
      code: "function f() { const value = compute(); const marker = 1, result = use(value) }",
      output: null,
      errors: [ { messageId: "unnecessaryLocal", data: { name: "value" } } ]
    },
    {
      code: "function f() { with (object) { const value = compute(); use(value) } }",
      output: null,
      languageOptions: { sourceType: "script" },
      errors: [ { messageId: "unnecessaryLocal", data: { name: "value" } } ]
    },
    {
      code: 'function consume() { return "first" } function compute() { eval("consume = () => \'second\'"); '
        + "return 1 } function f() { const value = compute(); return consume(value) }",
      output: null,
      errors: [ { messageId: "unnecessaryLocal", data: { name: "value" } } ]
    },
    {
      code: "const f = () => { const value = compute(); return [this, value] }",
      output: "const f = () => { return [this, compute()] }",
      errors: [ { messageId: "unnecessaryLocal", data: { name: "value" } } ]
    },
    // Moving the call after a read that throws in the TDZ would suppress the call's original effects.
    {
      code: "function f() { const value = compute(); return [later, value]; const later = 1 }",
      output: null,
      errors: [ { messageId: "unnecessaryLocal", data: { name: "value" } } ]
    },
    // A declaration in an earlier case is not initialized when control enters a later case directly.
    {
      code: dedent`
        function f(kind) {
          switch (kind) {
            case 0:
              const earlier = 1
              break
            case 1: {
              const value = compute()
              return [ earlier, value ]
            }
          }
        }
      `,
      output: null,
      errors: [ { messageId: "unnecessaryLocal", data: { name: "value" } } ]
    },
    // A function declared in one case can be called after control entered another and skipped a lexical initializer.
    {
      code: dedent`
        function outer(kind) {
          switch (kind) {
            case 0:
              const earlier = 1
              function f() {
                const value = compute()
                return [ earlier, value ]
              }
              break
            case 1:
              return f()
          }
        }
      `,
      output: null,
      errors: [ { messageId: "unnecessaryLocal", data: { name: "value" } } ]
    },
    // A hoisted function can run while a captured lexical binding is still in its initializer's TDZ.
    {
      code: "const later = f(); function f() { const value = compute(); return [ later, value ] }",
      output: null,
      errors: [ { messageId: "unnecessaryLocal", data: { name: "value" } } ]
    },
    // Removing the declaration would strand this same-line directive above the inlined expression.
    {
      code: dedent`
        function f() {
          const value = hiddenGlobal() // eslint-disable-line no-undef
          return value.x
        }
      `,
      output: null,
      errors: [ { messageId: "unnecessaryLocal", data: { name: "value" } } ]
    },
    // A directive attached above the declaration must not be retargeted to the use that remains.
    {
      code: dedent`
        function f() {
          /* istanbul ignore next */
          const value = compute()
          return value.x
        }
      `,
      output: null,
      errors: [ { messageId: "unnecessaryLocal", data: { name: "value" } } ]
    },
    { name: "indexes following statements across a wide body", code: aliasesWith(600), errors: 600 }
  ]
})

function aliasesWith(count) {
  return `function f() { ${Array.from({ length: count }, declarationAt).join(";")}; `
    + `use(${Array.from({ length: count }, valueAt).join(",")}) }`
}

function declarationAt(_, index) {
  return `const value${index} = compute()`
}

function valueAt(_, index) {
  return `value${index}`
}
