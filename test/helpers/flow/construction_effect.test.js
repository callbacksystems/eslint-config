import assert from "node:assert/strict"
import { test } from "node:test"
import { FunctionMutations } from "#helpers/flow/function_mutations"
import { ParsedCode } from "#support"

test("local construction executes explicit constructors and instance fields", () => {
  assert.equal(effectOf("class Local { constructor() { outer++ } } function subject() { return new Local() }"),
    "effect")
  assert.equal(effectOf("class Local { value = outer++ } function subject() { return new Local() }"), "effect")
  assert.equal(effectOf("class Local {} function subject() { return new Local() }"), "none")
})

test("fresh base instances keep direct initialization local", () => {
  assert.equal(effectOf("class Local { constructor() { this.value = 1 } } "
    + "function subject() { return new Local() }"), "none")
  assert.equal(effectOf("class Local { value = 1 } function subject() { return new Local() }"), "none")
  assert.equal(effectOf("class Local { value = (this.other = 1) } "
    + "function subject() { return new Local() }"), "none")
  assert.equal(effectOf("class Base {} class Local extends Base { constructor() { super(); this.value = 1 } } "
    + "function subject() { return new Local() }"), "none")
  assert.equal(effectOf("class Root { constructor() { return } } class Base extends Root {} "
    + "class Local extends Base { constructor() { super(); this.value = 1 } } "
    + "function subject() { return new Local() }"), "none")
  assert.equal(effectOf("class Base { constructor() { return replacement } } "
    + "class Local extends Base { constructor() { super(); this.value = 1 } } "
    + "function subject() { return new Local() }"), "effect")
  assert.equal(effectOf("class Local extends External { constructor() { super(); this.value = 1 } } "
    + "function subject() { return new Local() }"), "effect")
})

test("fresh receivers flow through constructor helpers without making the helpers pure", () => {
  const publicHelper = "class Local { constructor() { this.initialize() } "
    + "initialize() { this.value = 1 } } function subject() { return new Local() }"
  const privateHelper = "class Local { constructor() { this.#initialize() } "
    + "#initialize() { this.value = 1 } } function subject() { return new Local() }"

  assert.equal(effectOf(publicHelper), "none")
  assert.equal(effectOf(privateHelper), "none")
  assert.equal(methodEffectOf(publicHelper, "initialize"), "effect")
  assert.equal(effectOf("class Local { constructor() { this.initialize() } initialize() { outer++ } } "
    + "function subject() { return new Local() }"), "effect")
})

test("only construction gives a constructible function a fresh receiver", () => {
  assert.equal(effectOf("function Local() { this.value = 1 } function subject() { return new Local() }"), "unknown")
  assert.equal(effectOf("function Local() { this.value = 1 } function subject() { return Local() }"), "effect")
  assert.equal(effectOf("let outer = 0; function Local() { this.value = 1 } "
    + "Local.prototype = { set value(value) { outer++ } }; function subject() { return new Local() }"), "unknown")
})

test("fresh writes execute known own and inherited setters", () => {
  assert.equal(effectOf("class Local { constructor() { this.value = 1 } set value(value) { outer++ } } "
    + "function subject() { return new Local() }"), "effect")
  assert.equal(effectOf("class Base { set value(value) { outer++ } } "
    + "class Local extends Base { constructor() { super(); this.value = 1 } } "
    + "function subject() { return new Local() }"), "effect")
  assert.equal(effectOf("class Local { constructor() { this.value = 1 } "
    + "set value(value) { this.saved = value } } function subject() { return new Local() }"), "none")
})

test("compound fresh writes execute both accessors", () => {
  assert.equal(effectOf("class Local { constructor() { this.value += 1 } "
    + "get value() { outer++; return 1 } set value(value) { this.saved = value } } "
    + "function subject() { return new Local() }"), "effect")
})

test("public dispatch from a superclass remains conservative", () => {
  assert.equal(effectOf("class Base { constructor() { this.initialize() } initialize() {} } "
    + "class Local extends Base { initialize() { outer++ } } "
    + "function subject() { return new Local() }"), "unknown")
})

test("fresh dispatch observes preceding own callable writes", () => {
  assert.equal(effectOf("class Local { constructor(input) { this.run = input; this.run() } run() {} } "
    + "function subject(input) { return new Local(input) }"), "unknown")
  assert.equal(effectOf("class Local { constructor(input) { this.value = input; this.run() } run() {} } "
    + "function subject(input) { return new Local(input) }"), "none")
  assert.equal(effectOf("class Local { constructor(input) { this.run(); this.run = input } run() {} } "
    + "function subject(input) { return new Local(input) }"), "none")
  assert.equal(effectOf("class Local { constructor() { this.run = this.run() } run() { return () => 1 } } "
    + "function subject() { return new Local() }"), "none")
})

test("local construction follows stable aliases and inline classes", () => {
  assert.equal(effectOf("class Local { constructor() { outer++ } } const Alias = Local; "
    + "function subject() { return new Alias() }"), "effect")
  assert.equal(effectOf("function subject() { return new (class { constructor() { outer++ } })() }"), "effect")
  assert.equal(effectOf("function Local() { outer++ } const Alias = Local; "
    + "function subject() { return new Alias() }"), "effect")
})

test("local construction follows local inheritance and keeps opaque heritage unknown", () => {
  assert.equal(effectOf("class Base { constructor() { outer++ } } class Local extends Base {} "
    + "function subject() { return new Local() }"), "effect")
  assert.equal(effectOf("class Base { value = outer++ } class Local extends Base {} "
    + "function subject() { return new Local() }"), "effect")
  assert.equal(effectOf("class Base {} class Local extends Base { value = outer++ } "
    + "function subject() { return new Local() }"), "effect")
  assert.equal(effectOf("class Local extends External {} function subject() { return new Local() }"), "unknown")
})

test("explicit derived constructors execute fields only after super", () => {
  assert.equal(effectOf("class Base { constructor() { outer++ } } "
    + "class Local extends Base { constructor() { super() } } "
    + "function subject() { return new Local() }"), "effect")
  assert.equal(effectOf("class Base {} class Local extends Base { value = outer++; constructor() { super() } } "
    + "function subject() { return new Local() }"), "effect")
  assert.equal(effectOf("class Local extends External { value = outer++; constructor() { return {} } } "
    + "function subject() { return new Local() }"), "none")
})

test("known non-constructible functions do not execute their bodies", () => {
  assert.equal(effectOf("const Local = () => outer++; function subject() { return new Local() }"), "none")
  assert.equal(effectOf("async function Local() { outer++ } function subject() { return new Local() }"), "none")
  assert.equal(effectOf("function* Local() { outer++ } function subject() { return new Local() }"), "none")
})

test("opaque construction keeps the existing delivery semantics", () => {
  assert.equal(effectOf("function subject() { return new Scope() }"), "none")
  assert.equal(effectOf("function subject() { return new Scope(outer++) }"), "effect")
})

test("many construction sites reuse one wide local class plan", () => {
  assert.equal(effectOf(repeatedLocalConstructions({ fieldCount: 400, siteCount: 400 })), "none")
})

test("derived initialization preserves function heritage only without replacement returns", () => {
  assert.equal(effectOf("function Base() {} class Local extends Base { value = (this.other = 1) } "
    + "function subject() { return new Local() }"), "unknown")
  assert.equal(effectOf("function Base() { return external } "
    + "class Local extends Base { value = (this.other = 1) } function subject() { return new Local() }"), "effect")
  assert.equal(effectOf("class Base {} class First extends Base { field = (this.value = 1) } "
    + "class Second extends Base { field = (this.value = 2) } "
    + "function subject() { new First(); return new Second() }"), "none")
  assert.equal(effectOf("class First extends Second { field = (this.value = 1) } "
    + "class Second extends First {} function subject() { return new First() }"), "effect")
})

function effectOf(code) {
  const parsed = new ParsedCode(code)
  const functionNode = parsed.nodesOfType("FunctionDeclaration").find((node) => node.id.name === "subject")
  const mutations = new FunctionMutations(parsed.sourceCode)
  if (mutations.mutatesFrom(functionNode)) return "effect"

  return mutations.hasUnknownFrom(functionNode) ? "unknown" : "none"
}

function methodEffectOf(code, name) {
  const parsed = new ParsedCode(code)
  const functionNode = parsed.nodesOfType("MethodDefinition").find((node) => node.key.name === name).value
  const mutations = new FunctionMutations(parsed.sourceCode)
  if (mutations.mutatesFrom(functionNode)) return "effect"

  return mutations.hasUnknownFrom(functionNode) ? "unknown" : "none"
}

function repeatedLocalConstructions({ fieldCount, siteCount }) {
  return `class Local {
    ${Array.from({ length: fieldCount }, (_, index) => `field${index} = ${index}`).join("\n")}
  }
  function subject() {
    ${Array.from({ length: siteCount }, () => "new Local()").join("\n")}
    return true
  }`
}
