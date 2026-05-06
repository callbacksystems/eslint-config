import assert from "node:assert/strict"
import { test } from "node:test"
import { nodesIn } from "#helpers/syntax/ast"
import { propertyNameOf } from "#helpers/syntax/classes"
import { BindingResolver } from "#helpers/scope/binding_resolver"
import { isControllerInstanceContext, stimulusControllerConfigOf } from "#helpers/classes/stimulus"
import { ParsedCode } from "#support"

test("controller instance context follows lexical this through computed keys of nested classes", () => {
  const parsed = new ParsedCode(`
    class ExampleController extends Controller {
      connect() {
        class Nested { [this.element.addEventListener("ready", callback)]() {} }
      }
    }
  `)

  assert.ok(isControllerInstanceContext(callNamed(parsed, "addEventListener")))
})

test("controller instance context stops at a nested class member body", () => {
  const parsed = new ParsedCode(`
    class ExampleController extends Controller {
      connect() {
        class Nested { method() { this.element.addEventListener("ready", callback) } }
      }
    }
  `)

  assert.ok(!isControllerInstanceContext(callNamed(parsed, "addEventListener")))
})

test("controller config exposes every entry while semantic lookup keeps the last declaration", () => {
  const config = configIn(`
    class ExampleController extends Controller {
      static targets
      static targets = [ "later" ]
      static values = { open: Boolean, "": String, 1: Number, [dynamic]: String, [\`ready\`]: Boolean }
    }
  `)

  assert.deepEqual(config.entries.map((entry) => entry.name), [ "targets", "targets", "values" ])
  assert.deepEqual(config.namesIn("targets"), [ "later" ])
  assert.deepEqual(config.objectNamesIn("values"), [ "open", "1", "ready" ])
  assert.deepEqual(config.arrayNamesIn("values"), [])
})

test("controller config declarations retain only literal strings and uncomputed identifier keys", () => {
  assert.deepEqual(configIn(`
    class ExampleController extends Controller {
      static targets = [ "line_item", dynamic, \`panel-name\`, 1 ]
      static values = { snake_case: String, "kebab-case": String, 1: Number, [dynamic]: String, [\`also-bad\`]: String }
    }
  `).entries.map((entry) => entry.declarations.map(({ name }) => name)), [
    [ "line_item", "panel-name" ],
    [ "snake_case", "kebab-case", "also-bad" ]
  ])
})

test("controller config recognizes a key held by a stable local string constant", () => {
  assert.deepEqual(configIn(`
    const config = "values"
    const value = "open"
    class ExampleController extends Controller {
      static [config] = { [value]: Boolean }
    }
  `).namesIn("values"), [ "open" ])
})

test("controller config uses the last declaration when computed aliases duplicate a static", () => {
  assert.deepEqual(configIn(`
    const config = "targets"
    class ExampleController extends Controller {
      static [config] = [ "old" ]
      static targets = [ "current" ]
    }
  `).namesIn("targets"), [ "current" ])
})

function callNamed(parsed, name) {
  return nodesIn(parsed.sourceCode.ast).find((node) =>
    node.type === "CallExpression" && propertyNameOf(node.callee) === name)
}

function configIn(code) {
  const parsed = new ParsedCode(code)
  return stimulusControllerConfigOf(parsed.firstNodeOfType("ClassBody"), BindingResolver.for(parsed.sourceCode))
}
