import assert from "node:assert/strict"
import { test } from "node:test"
import { LocalArgumentValues } from "#helpers/functions/local_argument_values"
import { BindingResolver } from "#helpers/scope/binding_resolver"
import { ParsedCode } from "#support"

test("local argument values follow inline calls and preserve reassignment boundaries", () => {
  [
    [ "((value) => consume(value))(1)", [ 1 ] ],
    [ "function forward(value) { consume(value); value = 2 }; forward(1)", [ 1 ] ],
    [ "function forward(value) { value = 2; consume(value) }; forward(1)", [ 2 ] ],
    [ "function forward(value) { function read() { consume(value) }; value = 2; read() }; forward(1)", [ "value" ] ],
    [ "function forward(value) { consume(value) }; forward(1); forward(2)", [ 1, 2 ] ],
    [ "function forward(value) { forward(value); consume(value) }; forward(1)", [ 1 ] ]
  ].forEach(([ code, expected ]) => {
    assert.deepEqual(new Set(new ArgumentValuesIn(code).values), new Set(expected), code)
  })
})

test("a parameter declaration is not a read before its reassignment", () => {
  const parsed = new ParsedCode("function forward(value) { value = 2 }; forward(1)")
  const values = new LocalArgumentValues(parsed.sourceCode, BindingResolver.for(parsed.sourceCode))

  assert.ok(!values.isOriginalParameterAt(parsed.firstNodeOfType("FunctionDeclaration").params[0]))
})

class ArgumentValuesIn {
  #parsed
  #values

  constructor(code) {
    this.#parsed = new ParsedCode(code)
    this.#values = new LocalArgumentValues(this.#parsed.sourceCode, BindingResolver.for(this.#parsed.sourceCode))
  }

  get values() {
    return this.#values.valuesOf(this.#argument).map((node) => node.type === "Literal" ? node.value : node.name)
  }

  get #argument() {
    return this.#parsed.nodesOfType("CallExpression").find((node) => node.callee.name === "consume").arguments[0]
  }
}
