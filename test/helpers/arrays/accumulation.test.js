import assert from "node:assert/strict"
import { test } from "node:test"
import { Accumulation } from "#helpers/arrays/accumulation"
import { dedent, ParsedCode } from "#support"

test("kind names what an empty declaration above the loop collects", () => {
  assert.equal(accumulationIn(dedent`
    const names = []
    for (const item of items) names.push(item.name)
  `, "ForOfStatement").kind, "array")
  assert.equal(accumulationIn(dedent`
    const byId = {}
    for (const item of items) byId[item.id] = item
  `, "ForOfStatement").kind, "object")
  assert.equal(accumulationIn(dedent`
    const byId = new Map()
    items.forEach((item) => byId.set(item.id, item))
  `, "ExpressionStatement").kind, "map")
})

test("kind is null for a declaration that starts with content", () => {
  assert.equal(accumulationIn(dedent`
    const names = [ "root" ]
    for (const item of items) names.push(item.name)
  `, "ForOfStatement").kind, null)
})

test("kind is null for a forEach whose callback is not written inline", () => {
  assert.equal(accumulationIn(dedent`
    const names = []
    items.forEach(collect)
  `, "ExpressionStatement").kind, null)
})

test("kind reads the first forEach argument as its callback", () => {
  assert.equal(accumulationIn(dedent`
    const names = []
    items.forEach((item) => names.push(item.name), receiver)
  `, "ExpressionStatement").kind, "array")
  assert.equal(accumulationIn(dedent`
    const names = []
    items.forEach(collect, (item) => names.push(item.name))
  `, "ExpressionStatement").kind, null)
})

test("kind recognizes statically computed accumulation methods", () => {
  assert.equal(accumulationIn('const names = []; items["forEach"]((item) => names[`push`](item.name))',
    "ExpressionStatement").kind, "array")
  assert.equal(accumulationIn(dedent`
    const byId = new Map()
    for (const item of items) byId["set"](item.id, item)
  `, "ForOfStatement").kind, "map")
})

test("kind considers every identifier in a declaration", () => {
  assert.equal(accumulationIn(dedent`
    const other = 1, names = []
    for (const item of items) names.push(item.name)
  `, "ForOfStatement").kind, "array")
})

test("kind can resolve earlier candidates without a source-code index", () => {
  const parsed = new ParsedCode(dedent`
    const unrelated = []
    const names = []
    for (const item of items) names.push(item.name)
  `)
  assert.equal(new Accumulation(parsed.firstNodeOfType("ForOfStatement")).kind, "array")
})

test("kind finds an accumulator declared in the same switch case", () => {
  assert.equal(accumulationIn(dedent`
    switch (kind) {
      case "people":
        const names = []
        for (const item of items) names.push(item.name)
        break
    }
  `, "ForOfStatement").kind, "array")
})

test("kind is null for an unrelated statement shape", () => {
  const parsed = new ParsedCode("const names = []")
  assert.equal(new Accumulation(parsed.firstNodeOfType("VariableDeclaration"), parsed.sourceCode).kind, null)
})

test("kind follows bindings rather than shadowed names", () => {
  assert.equal(accumulationIn(dedent`
    const names = []
    for (const names of groups) names.push("member")
  `, "ForOfStatement").kind, null)
})

test("kind rejects an accumulator changed before the loop", () => {
  assert.equal(accumulationIn(dedent`
    const names = []
    names.push("root")
    for (const item of items) names.push(item.name)
  `, "ForOfStatement").kind, null)
  assert.equal(accumulationIn(dedent`
    const names = []
    names = replacement
    for (const item of items) names.push(item.name)
  `, "ForOfStatement").kind, null)
  assert.equal(accumulationIn(dedent`
    var names = []
    var names = [ "root" ]
    for (const item of items) names.push(item.name)
  `, "ForOfStatement").kind, null)
  assert.equal(accumulationIn(dedent`
    var names = [ "root" ]
    var names = []
    for (const item of items) names.push(item.name)
  `, "ForOfStatement").kind, "array")
})

test("kind rejects accumulator uses inside the loop other than the recognized mutation target", () => {
  assert.equal(accumulationIn(dedent`
    const names = []
    for (; names.pop(); ) names.push(item)
  `, "ForStatement").kind, null)
  assert.equal(accumulationIn(dedent`
    const names = []
    for (const item of names) names.push(item)
  `, "ForOfStatement").kind, null)
  assert.equal(accumulationIn(dedent`
    const names = []
    for (const item of items) names.push(names.length)
  `, "ForOfStatement").kind, null)
})

test("kind rejects a shadowed Map constructor", () => {
  assert.equal(accumulationIn(dedent`
    function build(Map) {
      const byId = new Map()
      for (const item of items) byId.set(item.id, item)
    }
  `, "ForOfStatement").kind, null)
  assert.equal(accumulationIn(dedent`
    Map = WeakMap
    const byId = new Map()
    for (const item of items) byId.set(item.id, item)
  `, "ForOfStatement").kind, null)
})

test("kind rejects optional forEach calls that might not execute", () => {
  assert.equal(accumulationIn("const names = []; items.forEach?.((item) => names.push(item))",
    "ExpressionStatement").kind, null)
})

test("kind only treats real array indexes as static computed accumulation", () => {
  assert.equal(accumulationIn("const names = []; for (const item of items) names[+0] = item",
    "ForOfStatement").kind, "array")
  assert.equal(accumulationIn("const names = []; for (const item of items) names[\"0\"] = item",
    "ForOfStatement").kind, "array")
  const invalidKeys = [ '"length"', '"01"', "-1", "null" ]
  invalidKeys.forEach((key) => {
    assert.equal(accumulationIn(`const names = []; for (const item of items) names[${key}] = item`,
      "ForOfStatement").kind, null)
  })
})

test("kind does not mistake the object prototype setter for an own entry", () => {
  assert.equal(accumulationIn("const entries = {}; for (const item of items) entries.__proto__ = item",
    "ForOfStatement").kind, null)
})

test("kind handles deeply nested accumulation branches without consuming the call stack", () => {
  const depth = 1_000
  const body = `${"if (ready) { ".repeat(depth)}names.push(item)${" }".repeat(depth)}`
  assert.equal(accumulationIn(`const names = []; for (const item of items) { ${body} }`, "ForOfStatement").kind,
    "array")
})

test("kind ignores flow exits inside nested functions", () => {
  assert.equal(accumulationIn(dedent`
    const names = []
    for (const item of items) names.push(run(() => { return item.name }))
  `, "ForOfStatement").kind, "array")
})

test("kind only treats a break below the candidate body as a switch-case break", () => {
  assert.equal(accumulationIn(dedent`
    const names = []
    for (const item of items) switch (item.kind) {
      case "person": names.push(item.name); break
    }
  `, "ForOfStatement").kind, null)
  assert.equal(accumulationIn(dedent`
    const names = []
    for (const item of items) {
      switch (item.kind) {
        case "person": names.push(item.name); break
      }
    }
  `, "ForOfStatement").kind, "array")
})

test("flow is indexed once across deeply nested accumulation candidates", () => {
  const parsed = new ParsedCode(nestedAccumulations(400))
  const kinds = parsed.nodesOfType("ForOfStatement")
    .map((loop) => new Accumulation(loop, parsed.sourceCode).kind)
  assert.equal(kinds.filter(Boolean).length, 1)
  assert.equal(kinds.at(-1), "array")
})

test("kind skips a destructuring declaration above the loop", () => {
  assert.equal(accumulationIn(dedent`
    const { items } = options
    const names = []
    for (const item of items) names.push(item.name)
  `, "ForOfStatement").kind, "array")
})

test("kind is null for a loop with no statement list of its own", () => {
  assert.equal(accumulationIn(dedent`
    const names = []
    if (ready) for (const item of items) names.push(item.name)
  `, "ForOfStatement").kind, null)
})

test("kind is null when the body leaves the loop or does something else", () => {
  assert.equal(accumulationIn(dedent`
    const names = []
    for (const item of items) {
      if (item.hidden) continue
      names.push(item.name)
    }
  `, "ForOfStatement").kind, null)
  assert.equal(accumulationIn(dedent`
    const names = []
    items.forEach((item) => { log(item); names.push(item.name) })
  `, "ExpressionStatement").kind, null)
})

test("isPresent says whether there is a kind", () => {
  assert.equal(accumulationIn(dedent`
    const names = []
    for (const item of items) names.push(item.name)
  `, "ForOfStatement").isPresent, true)
  assert.equal(accumulationIn("for (const item of items) log(item)", "ForOfStatement").isPresent, false)
})

// The first statement of the type, which for `forEach` is the call rather than a statement inside its callback.
function accumulationIn(code, type) {
  const parsed = new ParsedCode(code)
  return new Accumulation(parsed.firstNodeOfType(type), parsed.sourceCode)
}

function nestedAccumulations(count) {
  return Array.from({ length: count }, (_, index) => index).reduceRight((inner, index) =>
    `const acc${index} = []; for (const x${index} of [ ${index} ]) { ${inner} acc${index}.push(x${index}) }`, "")
}
