import assert from "node:assert/strict"
import { test } from "node:test"
import { canFallThrough, canFallThroughSequence, hasReachableReturn } from "#helpers/flow/function_completion"
import { ParsedCode } from "#support"

test("canFallThrough sees an implicit undefined return path", () => {
  assert.ok(canFallThrough(parsedFunction("function value(ready) { if (ready) return true }")))
  assert.ok(!canFallThrough(parsedFunction("function value(ready) { if (ready) return true; else return false }")))
  assert.ok(!canFallThrough(parsedFunction("function value(ready) { if (ready) return true; throw Error() }")))
})

test("canFallThrough follows switch entries and breaks", () => {
  assert.ok(!canFallThrough(parsedFunction(`
    function value(kind) {
      switch (kind) {
        case "yes": return true
        case "no": return false
        default: throw Error()
      }
    }
  `)))
  assert.ok(canFallThrough(parsedFunction("function value(kind) { switch (kind) { case 'yes': return true } }")))
  assert.ok(canFallThrough(parsedFunction(`
    function value(kind) {
      switch (kind) {
        case "yes": break
        default: return false
      }
    }
  `)))
})

test("canFallThrough follows a statically selected switch entry", () => {
  assert.ok(!canFallThrough(parsedFunction("function value() { switch (1) { case 1: return true; case 2: break } }")))
  assert.ok(canFallThrough(parsedFunction("function value() { switch (1) { case 1: break; case 2: return true } }")))
  assert.ok(!hasReachableReturn(parsedFunction("function value() { switch (1) { case 2: return true } }")))
})

test("switch completion checks only case tests evaluated before selection", () => {
  assert.ok(!canFallThrough(parsedFunction(`
    function value() {
      try { switch (1) { case 1: return true; case risky(): break } }
      catch {}
    }
  `)))
  assert.ok(canFallThrough(parsedFunction(`
    function value() {
      try { switch (1) { case risky(): break; case 1: return true } }
      catch {}
    }
  `)))
})

test("canFallThrough accounts for loops and finally overrides", () => {
  assert.ok(!canFallThrough(parsedFunction("function value() { while (true) { return true } }")))
  assert.ok(!canFallThrough(parsedFunction("function value() { while (1) {} }")))
  assert.ok(canFallThrough(parsedFunction("function value(items) { for (const item of items) return true }")))
  assert.ok(!canFallThrough(parsedFunction("function value() { try {} finally { return true } }")))
  assert.ok(canFallThrough(parsedFunction(
    "function value(items, object) { for (const item of items) {} for (const key in object) {} }")))
  assert.ok(!canFallThrough(parsedFunction("function value() { class Entry {}; return true }")))
  assert.ok(!canFallThrough(parsedFunction(
    "function value(object) { with (object) { return true } }", { sourceType: "script" })))
})

test("catch outcomes exist only on a reachable throw path", () => {
  assert.ok(!canFallThrough(parsedFunction("function value() { try { return true } catch {} }")))
  assert.ok(!canFallThrough(parsedFunction("function value() { try { const answer = 1; return true } catch {} }")))
  assert.ok(!hasReachableReturn(parsedFunction("function value() { try {} catch { return true } }")))
  assert.ok(canFallThrough(parsedFunction("function value() { try { throw Error() } catch {} }")))
  assert.ok(canFallThrough(parsedFunction("function value() { try { return risky() } catch {} }")))
  assert.ok(hasReachableReturn(parsedFunction(`
    function value(ready) {
      try {
        if (ready) return true
        throw Error()
      } catch {
        return false
      }
    }
  `)))
})

test("resource acquisition and disposal can reach a catch", () => {
  assert.ok(hasReachableReturn(parsedFunction(
    "function value() { try { using resource = {} } catch { return true } }")))
  assert.ok(hasReachableReturn(parsedFunction(
    "async function value(resource) { try { await using acquired = resource } catch { return true } }")))
  assert.ok(!hasReachableReturn(parsedFunction(
    "function value() { try { using resource = null } catch { return true } }")))
  assert.ok(!hasReachableReturn(parsedFunction(
    "function value() { try { using resource = void 0 } catch { return true } }")))
})

test("loop declarations contribute their expressions rather than throwing by themselves", () => {
  assert.ok(!hasReachableReturn(parsedFunction(`
    function value() {
      try { for (let index = 0; false;) {} } catch { return true }
    }
  `)))
  assert.ok(!hasReachableReturn(parsedFunction(`
    function value() {
      try { for (const key in {}) {} } catch { return true }
    }
  `)))
  assert.ok(hasReachableReturn(parsedFunction(`
    function value() {
      try { for (const item of []) {} } catch { return true }
    }
  `)))
})

test("a derived constructor's this can throw before super", () => {
  const parsed = new ParsedCode("class Child extends Parent { constructor() { try { return this } catch {} } }")
  assert.ok(canFallThrough(parsed.firstNodeOfType("FunctionExpression")))
})

test("a throwing catch binding remains visible to an outer catch", () => {
  assert.ok(canFallThrough(parsedFunction(`
    function value(error) {
      try {
        try { throw error } catch ({ detail }) { return true }
      } catch {}
    }
  `)))
})

test("finally preserves or overrides only reachable try and catch outcomes", () => {
  assert.ok(!canFallThrough(parsedFunction("function value() { try { return true } catch {} "
    + "finally { clean() } }")))
  assert.ok(!hasReachableReturn(parsedFunction(
    "function value() { try {} catch { return true } finally { clean() } }")))
  assert.ok(hasReachableReturn(parsedFunction(
    "function value() { try { throw Error() } catch { return true } finally {} }")))
  assert.ok(!hasReachableReturn(parsedFunction(`
    function value() {
      try { throw Error() } catch { return true } finally { throw Error() }
    }
  `)))
})

test("hasReachableReturn ignores returns behind abrupt completion", () => {
  assert.ok(hasReachableReturn(parsedFunction("function value(ready) { if (ready) return true; throw Error() }")))
  assert.ok(!hasReachableReturn(parsedFunction("function value() { throw Error(); return true }")))
  assert.ok(!hasReachableReturn(parsedFunction("function value() { try { return true } finally { throw Error() } }")))
  assert.ok(!hasReachableReturn(parsedFunction("function value() { try { while (true) {} } catch { return true } }")))
  assert.ok(hasReachableReturn(parsedFunction("function value() { try { throw Error() } catch { return true } }")))
})

test("fixed conditions exclude unreachable branches and loop bodies", () => {
  assert.ok(!hasReachableReturn(parsedFunction("function value() { if (false) return true; throw Error() }")))
  assert.ok(!hasReachableReturn(parsedFunction("function value() { if (true) throw Error(); else return true }")))
  assert.ok(!hasReachableReturn(parsedFunction("function value() { while (false) return true; throw Error() }")))
  assert.ok(!hasReachableReturn(parsedFunction("function value() { for (; false;) return true; throw Error() }")))
  assert.ok(hasReachableReturn(parsedFunction("function value() { do { return true } while (false) }")))
})

test("fixed template conditions use the cooked string's truthiness", () => {
  assert.ok(!hasReachableReturn(parsedFunction("function value() { if (``) return true; throw Error() }")))
  assert.ok(!hasReachableReturn(parsedFunction("function value() { if (`ready`) throw Error(); else return true }")))
})

test("an unreachable for update cannot throw into a catch", () => {
  assert.ok(!hasReachableReturn(parsedFunction(`
    function value() {
      try { for (; false; risky()) {} } catch { return true }
    }
  `)))
})

test("a reachable for update can throw into a catch", () => {
  assert.ok(hasReachableReturn(parsedFunction(`
    function value() {
      try { for (let index = 0; index < 1; risky()) {} } catch { return true }
    }
  `)))
})

test("a destructuring declaration can throw into a catch", () => {
  assert.ok(hasReachableReturn(parsedFunction(`
    function value() {
      try { const { value = risky() } = {} } catch { return true }
    }
  `)))
})

test("canFallThrough remains conservative around labeled control", () => {
  assert.ok(canFallThrough(parsedFunction("function value() { outer: { break outer; return true } }")))
})

test("labeled statements consume only breaks directed to their own label", () => {
  assert.ok(hasReachableReturn(parsedFunction("function value() { skip: { break skip } return true }")))
  assert.ok(!hasReachableReturn(parsedFunction(`
    function value() {
      outer: {
        inner: { break outer }
        return true
      }
    }
  `)))
  assert.ok(hasReachableReturn(parsedFunction(`
    function value() {
      outer: {
        inner: { break inner }
        return true
      }
    }
  `)))
})

test("labeled loops distinguish continuing from breaking the loop", () => {
  assert.ok(!hasReachableReturn(parsedFunction(`
    function value() {
      repeat: while (true) { continue repeat }
      return true
    }
  `)))
  assert.ok(hasReachableReturn(parsedFunction(`
    function value() {
      repeat: while (true) { break repeat }
      return true
    }
  `)))
  assert.ok(hasReachableReturn(parsedFunction(`
    function value() {
      repeat: do { continue repeat } while (false)
      return true
    }
  `)))
})

test("stacked labels still recognize their labeled loop", () => {
  const functionNode = parsedFunction(`
    function value() {
      outer: inner: while (true) { break outer }
      return true
    }
  `)

  assert.ok(!canFallThrough(functionNode))
  assert.ok(hasReachableReturn(functionNode))
})

test("a bare for loop is definitely infinite", () => {
  const functionNode = parsedFunction("function value() { for (;;) {} }")

  assert.ok(!canFallThrough(functionNode))
  assert.ok(!hasReachableReturn(functionNode))
})

test("canFallThroughSequence recognizes compound abrupt statements", () => {
  [ "{ return }", "label: { return }", "try { return } finally {}" ].forEach((code) => {
    assert.ok(!canFallThroughSequence([ parsedFunction(`function value() { ${code} }`).body.body[0] ]))
  })
})

test("canFallThrough does not consume the call stack on nested blocks", () => {
  let body = { type: "ReturnStatement" }
  for (let depth = 0; depth < 20_000; depth += 1) body = { type: "BlockStatement", body: [ body ] }
  const functionNode = { body: { type: "BlockStatement", body: [ body ] } }

  assert.ok(!canFallThrough(functionNode))
})

function parsedFunction(code, options) {
  assert.match(code, /function/u)
  return new ParsedCode(code, options).firstNodeOfType("FunctionDeclaration")
}
