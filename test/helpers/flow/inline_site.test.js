import assert from "node:assert/strict"
import { test } from "node:test"
import { BindingResolver } from "#helpers/scope/binding_resolver"
import { InlineSite } from "#helpers/flow/inline_site"
import { ParsedCode } from "#support"

test("a preceding binding is available inside its own top-level switch case", () => {
  const parsed = new ParsedCode(`
    function use() {}
    switch (kind) {
      case "ready": {
        const earlier = 1
        const value = compute()
        use(earlier, earlier, value)
      }
    }
  `)
  const declarator = parsed.nodesOfType("VariableDeclarator").at(-1)
  const read = parsed.nodesOfType("Identifier").find((node) => node.name === "value" && node !== declarator.id)

  assert.equal(new InlineSite({
    read,
    statement: read.parent.parent,
    value: declarator.init,
    bindings: BindingResolver.for(parsed.sourceCode)
  }).isSafe, true)
})
