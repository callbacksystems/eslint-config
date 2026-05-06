import rule from "#rules/no_boolean_handler_chain"
import { dedent, tester } from "#support"

const longHandlerChain = Array.from({ length: 2_000 }, (_, index) => `tryHandler${index}()`).join(" || ")

tester.run("no-boolean-handler-chain", rule, {
  valid: [
    "function f() { return tryA() }",
    "function f() { return tryA() || tryB() }",
    "function f() { return tryA() && tryB() && tryC() }",
    "function value() { return cached() || load() || fallback() }",
    "function dispatch() { return tryA() || tryB() || tryC() }",
    "function dispatch() { "
    + "return applyToggleRead(req) || applyToggleFlag(req) || dispatchPermanentDelete(req) || dispatchMove(req) }",
    "function test() { return isReady() || hasValue() || canLoad() }",
    "function isReady() { return true } function hasValue() { return false } "
    + "function canLoad() { return !blocked } function test() { return isReady() || hasValue() || canLoad() }",
    "function checkA() { return a > 0 } function checkB() { return b > 0 } "
    + "function checkC() { return c > 0 } function test() { return checkA() || checkB() || checkC() }",
    "function acceptA() { return true } function acceptB() { return false } "
    + "function acceptC() { return !blocked } function dispatch() { return acceptA() || acceptB() || acceptC() }",
    "class Dispatcher { acceptA() { return true } acceptB() { return false } "
    + "acceptC() { return !this.blocked } run() { return this.acceptA() || this.acceptB() || this.acceptC() } }",
    "function tryA() { return result } function tryB() { return result } function tryC() { return result } "
    + "function f() { return tryA() || tryB() || tryC() }",
    "function tryA() { return true } function tryB() { return false } function tryC() { return !done } "
    + "function f() { return tryA() || tryB() || tryC() }",
    "function tryA(value) { if (value) return true; else return false } "
    + "function tryB() { return Boolean(value) } function tryC() { return !done } "
    + "function f() { return tryA() || tryB() || tryC() }",
    "async function tryA() { return true } async function tryB() { return true } "
    + "async function tryC() { return true } function f() { return tryA() || tryB() || tryC() }",
    "function* tryA() { return true } function* tryB() { return true } "
    + "function* tryC() { return true } function f() { return tryA() || tryB() || tryC() }",
    "function tryA(Boolean) { return Boolean(1) } function tryB(Boolean) { return Boolean(1) } "
    + "function tryC(Boolean) { return Boolean(1) } function f() { return tryA() || tryB() || tryC() }",
    "/* global Boolean:writable */ Boolean = String; function tryA() { return Boolean(1) } "
    + "function tryB() { return Boolean(1) } function tryC() { return Boolean(1) } "
    + "function f() { return tryA() || tryB() || tryC() }",
    "function tryA(value) { if (value) return true } function tryB() { return true } "
    + "function tryC() { return false } function f() { return tryA() || tryB() || tryC() }",
    "function tryA() { throw Error(); return true } function tryB() { return true } "
    + "function tryC() { return false } function f() { return tryA() || tryB() || tryC() }",
    "function tryWork() { return result } function first() { return tryWork() || tryWork() || tryWork() } "
    + "function second() { return tryWork() || tryWork() || tryWork() }",
    "let handled = 0; function a() { return true; handled++ } function b() { return false; handled++ } "
    + "function c() { return !done; handled++ } function dispatch() { return a() || b() || c() }",
    "let handled = 0; function a() { false && handled++; return true } "
    + "function b() { false && handled++; return false } function c() { false && handled++; return !done } "
    + "function dispatch() { return a() || b() || c() }",
    "function a() { const local = {}; local.value = 1; return true } "
    + "function b() { const local = {}; local.value = 1; return false } "
    + "function c() { const local = {}; local.value = 1; return !done } "
    + "function dispatch() { return a() || b() || c() }",
    "function a() { let n = 0; function record() { n++ }; record(); return true } "
    + "function b() { let n = 0; function record() { n++ }; record(); return false } "
    + "function c() { let n = 0; function record() { n++ }; record(); return !done } "
    + "function dispatch() { return a() || b() || c() }",
    "let handled = 0; function a() { return Boolean(transform(() => handled++)) } "
    + "function b() { return Boolean(transform(() => handled++)) } "
    + "function c() { return Boolean(transform(() => handled++)) } "
    + "function dispatch() { return a() || b() || c() }",
    "function pure() { return value } function a() { pure(); return true } "
    + "function b() { pure(); return false } function c() { pure(); return !done } "
    + "function dispatch() { return a() || b() || c() }",
    "function a() { const later = () => save(); return true } "
    + "function b() { const later = () => notify(); return false } "
    + "function c() { const later = () => publish(); return !done } "
    + "function dispatch() { return a() || b() || c() }",
    "function a() { return true; save() } function b() { return false; notify() } "
    + "function c() { return !done; publish() } function dispatch() { return a() || b() || c() }",
    "function a() { if (false) save(); return true } function b() { if (false) notify(); return false } "
    + "function c() { if (false) publish(); return !done } function dispatch() { return a() || b() || c() }",
    {
      name: "does not retain provenance replaced inside local containers",
      code: "function a(input) { const box = { input }; box.input = {}; box.input.used = true; return true } "
        + "function b(input) { const box = [ input ]; box[0] = {}; box[0].used = true; return false } "
        + "function c(...values) { values[0] = {}; values[0].used = true; return !done } "
        + "function dispatch(input) { return a(input) || b(input) || c(input) }"
    },
    {
      name: "does not trust escaped local handler objects",
      code: "let handled = 0; const handlers = { "
        + "acceptA() { handled++; return true }, acceptB() { handled++; return false }, "
        + "acceptC() { handled++; return !done } }; consume(handlers); "
        + "function dispatch() { return handlers.acceptA() || handlers.acceptB() || handlers.acceptC() }"
    },
    { name: "handles a wide unknown chain without consuming the call stack",
      code: `function dispatch() { return ${longHandlerChain} }` },
    { code: "function f() { return tryA() || tryB() }", options: [ { min: 2 } ] },
    { code: "function f() { return tryA() || tryB() || tryC() }", options: [ { min: 4 } ] }
  ],
  invalid: [
    {
      name: "recognizes discarded unresolved calls as actions",
      code: "function a() { save(); return true } function b() { notify(); return false } "
        + "function c() { publish(); return !done } function dispatch() { return a() || b() || c() }",
      errors: [ { messageId: "booleanHandlerChain" } ]
    },
    {
      code: "let handled = 0; function acceptA() { handled++; return true } "
        + "function acceptB() { handled++; return false } function acceptC() { handled++; return !done } "
        + "function dispatch() { return acceptA() || acceptB() || acceptC() }",
      errors: [ { messageId: "booleanHandlerChain" } ]
    },
    {
      code: dedent`
        class Dispatcher {
          routeA() { this.handled++; return true }
          routeB() { this.handled++; return false }
          routeC() { this.handled++; return !this.done }
          dispatch() { return this.routeA() || this.routeB() || this.routeC() }
        }
      `,
      errors: [ { messageId: "booleanHandlerChain" } ]
    },
    {
      name: "follows confined local static handlers",
      code: "let handled = 0; class Handlers { "
        + "static acceptA() { handled++; return true } "
        + "static acceptB() { handled++; return false } "
        + "static acceptC() { handled++; return !done } } "
        + "function dispatch() { return Handlers.acceptA() || Handlers.acceptB() || Handlers.acceptC() }",
      errors: [ { messageId: "booleanHandlerChain" } ]
    },
    {
      code: "let handled = 0; function record() { handled++ } function first() { record(); return true } "
        + "function second() { record(); return false } function third() { record(); return !done } "
        + "function dispatch() { return first() || second() || third() }",
      errors: [ { messageId: "booleanHandlerChain" } ]
    },
    {
      name: "follows a hoisted local function declared after return",
      code: "let handled = 0; function a() { later(); return true; function later() { handled++ } } "
        + "function b() { later(); return false; function later() { handled++ } } "
        + "function c() { later(); return !done; function later() { handled++ } } "
        + "function dispatch() { return a() || b() || c() }",
      errors: [ { messageId: "booleanHandlerChain" } ]
    },
    {
      name: "follows directly invoked functions but not callback arguments",
      code: "let handled = 0; function a() { (() => handled++)(); return true } "
        + "function b() { (() => handled++)(); return false } function c() { (() => handled++)(); return !done } "
        + "function dispatch() { return a() || b() || c() }",
      errors: [ { messageId: "booleanHandlerChain" } ]
    },
    {
      name: "recognizes writes through stable aliases of parameters",
      code: "function a(target) { const state = target; state.value = 1; return true } "
        + "function b(target) { const state = target; state.value = 1; return false } "
        + "function c(target) { const state = target; state.value = 1; return !done } "
        + "function dispatch(target) { return a(target) || b(target) || c(target) }",
      errors: [ { messageId: "booleanHandlerChain" } ]
    },
    {
      name: "follows caller values through fresh object, array, arguments, and rest containers",
      code: dedent`
        function a(input) { const box = { input }; box.input.used = true; return true }
        function b(input) { const box = [ input ]; box[0].used = true; return false }
        function c() { arguments[0].used = true; return true }
        function d(...values) { values[0].used = true; return !done }
        function dispatch(input) { return a(input) || b(input) || c(input) || d(input) }
      `,
      errors: [ { messageId: "booleanHandlerChain" } ]
    },
    { name: "analyzes one shared handler body only once", code: sharedHandlerProgramWith(400), errors: 400 }
  ]
})

function sharedHandlerProgramWith(count) {
  return `${effectfulHandlerWith(count)}\n${handlerCallersFor(count)}`
}

function effectfulHandlerWith(count) {
  return `let handled = 0\nfunction tryWork() { handled++; ${handlerBranchesFor(count)}\nreturn false }`
}

function handlerBranchesFor(count) {
  return Array.from({ length: count }, (_, index) => `if (condition${index}) return true`).join("\n")
}

function handlerCallersFor(count) {
  return Array.from({ length: count }, (_, index) =>
    `function caller${index}() { return tryWork() || tryWork() || tryWork() }`).join("\n")
}
