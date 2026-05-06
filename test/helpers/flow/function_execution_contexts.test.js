import assert from "node:assert/strict"
import { test } from "node:test"
import { FunctionExecutionContexts } from "#helpers/flow/function_execution_contexts"
import { ParsedCode } from "#support"

test("execution contexts rooted at a switch case include its test and stop after a break", () => {
  assert.deepEqual(new ExecutionNamesIn("switch (value) { case key: consume(); break; unreachable(); "
    + "default: fallback() }").values, [ "key", "consume" ])
})

test("execution contexts rooted at a default case need no test expression", () => {
  assert.deepEqual(new ExecutionNamesIn("switch (value) { default: fallback() }").values, [ "fallback" ])
})

class ExecutionNamesIn {
  #names = []

  constructor(code) {
    const parsed = new ParsedCode(code)
    new FunctionExecutionContexts(parsed.firstNodeOfType("SwitchCase")).forEach(({ node }) => this.#include(node))
  }

  get values() {
    return this.#names
  }

  #include(node) {
    if (node.type === "Identifier") this.#names.push(node.name)
  }
}
