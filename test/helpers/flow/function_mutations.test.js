import assert from "node:assert/strict"
import { test } from "node:test"
import { FunctionMutations } from "#helpers/flow/function_mutations"
import { ParsedCode } from "#support"

const OBSERVABLE = { memberWrites: "observable" }

test("function mutations follow reachable control flow", () => {
  assert.equal(effectOf("function subject() { return true; outer++ }"), "none")
  assert.equal(effectOf("function subject(flag) { if (flag) return true; outer++; return false }"), "effect")
  assert.equal(effectOf("function subject() { false && outer++; return true }"), "none")
  assert.equal(effectOf("function subject() { if (!true) outer++; return true }"), "none")
  assert.equal(effectOf("function subject() { if (true) return true; else outer++ }"), "none")
  assert.equal(effectOf("function subject(flag) { flag && outer++; return true }"), "effect")
  assert.equal(effectOf("function subject() { try { return true } finally { outer++ } }"), "effect")
  assert.equal(effectOf("function subject() { try { return true } catch { outer++ } }"), "none")
  assert.equal(effectOf("function subject() { try { return value.x } catch { outer++ } }"), "effect")
})

test("function mutations follow loop execution", () => {
  assert.equal(effectOf("function subject() { while (false) outer++; return true }"), "none")
  assert.equal(effectOf("function subject(flag) { while (flag) { outer++; break }; return true }"), "effect")
  assert.equal(effectOf("function subject() { for (; false; outer++) outer++; return true }"), "none")
  assert.equal(effectOf("function subject(flag) { for (; flag; outer++) break; return true }"), "none")
  assert.equal(effectOf("function subject(flag) { for (; flag; outer++) return true }"), "none")
  assert.equal(effectOf("function subject(flag) { for (; flag; outer++) continue; return true }"), "effect")
  assert.equal(effectOf("function subject(flag) { loop: for (; flag; outer++) continue loop; return true }"), "effect")
  assert.equal(effectOf("function subject() { do { break } while (outer++); return true }"), "none")
  assert.equal(effectOf("function subject() { do { continue } while (outer++); return true }"), "effect")
})

test("function mutations follow statically selected switch cases", () => {
  assert.equal(effectOf("function subject() { switch (1) { case 2: outer++ }; return true }"), "none")
  assert.equal(effectOf("function subject() { switch (1) { case (outer++, 2): break }; return true }"), "effect")
  assert.equal(effectOf("function subject() { switch (1) { case 1: break; case outer++: break }; return true }"),
    "none")
  assert.equal(effectOf("function subject() { switch (`yes`) { case 'yes': outer++ }; return true }"), "effect")
})

test("function mutations follow switch defaults and fallthrough", () => {
  assert.equal(effectOf("function subject() { switch (1) { default: outer++; break; case 1: break } }"), "none")
  assert.equal(effectOf("function subject() { switch (1) { default: outer++; break; case 2: break } }"), "effect")
  assert.equal(effectOf("function subject() { switch (1) { case 1: break; default: outer++ } }"), "none")
  assert.equal(effectOf("function subject() { switch (1) { case 1: ; default: outer++ } }"), "effect")
})

test("function mutations stop switch fallthrough after abrupt completion", () => {
  assert.equal(effectOf("function subject() { switch (1) { case 1: return true; case 2: outer++ } }"), "none")
  assert.equal(effectOf("function subject() { switch (1) { case 1: throw 1; case 2: outer++ } }"), "none")
  assert.equal(effectOf("function subject() { switch (1) { case 1: break; case 2: outer++ } }"), "none")
  assert.equal(effectOf("function subject() { switch (1) { case 1: return true; case 2: break }; outer++ }"), "none")
  assert.equal(effectOf("function subject() { switch (1) { case 1: break; case 2: return true }; outer++ }"), "effect")
})

test("function mutations retain functions hoisted from unselected switch cases", () => {
  assert.equal(effectOf(`function subject() {
    switch (1) {
      case 1: later(); break
      case 2: function later() { outer++ }
    }
    return true
  }`), "effect")
})

test("function mutations preserve hoisting without inheriting deferred bodies", () => {
  assert.equal(effectOf("function subject() { later(); return true; function later() { outer++ } }"), "effect")
  assert.equal(effectOf("function subject() { function later() { outer++ }; return true }"), "none")
  assert.equal(effectOf("function subject() { let value = 0; later(); return value; function later() { value++ } }"),
    "none")
  assert.equal(effectOf("function outer() { let value = 0; function subject() { value++; return value } }"), "effect")
})

test("function mutations distinguish IIFEs, callbacks, and unresolved calls", () => {
  assert.equal(effectOf("function subject() { return (() => { outer++; return true })() }"), "effect")
  assert.equal(effectOf("function subject() { return ((_callback) => true)(() => outer++) }"), "none")
  assert.equal(effectOf("function subject() { return transform(() => outer++) }"), "unknown")
  assert.equal(effectOf("function subject() { consume(outer++); return true }"), "effect")
  assert.equal(effectOf("const act = () => outer++; function subject() { act(); return true }"), "effect")
  assert.equal(effectOf("function subject() { return () => outer++ }"), "none")
})

test("function mutations recognize coercion-free standard calls at their exact identities", () => {
  assert.equal(effectOf("function subject(left, right) { return Object.is(left, right) }"), "none")
  assert.equal(effectOf("function subject(value) { return Boolean(value) }"), "none")
  assert.equal(effectOf("function subject(value) { return Array.isArray(value) }"), "none")
  assert.equal(effectOf("function subject(value) { return Number.isFinite(value) }"), "none")
  assert.equal(effectOf("function subject(value) { return Number.isInteger(value) }"), "none")
  assert.equal(effectOf("function subject(value) { return Number.isNaN(value) }"), "none")
  assert.equal(effectOf("function subject(value) { return Number.isSafeInteger(value) }"), "none")
  assert.equal(effectOf("const same = Object.is; function subject(left, right) { return same(left, right) }"), "none")
  assert.equal(effectOf("const { is: same } = Object; "
    + "function subject(left, right) { return same(left, right) }"), "none")
})

test("function mutations keep replaced or user-dispatching standard-looking calls unknown", () => {
  assert.equal(effectOf("function subject(Object, left, right) { return Object.is(left, right) }"), "unknown")
  assert.equal(effectOf("Object.is = replacement; "
    + "function subject(left, right) { return Object.is(left, right) }"), "unknown")
  assert.equal(effectOf("function subject(values) { return Object.is(...values) }"), "unknown")
  assert.equal(effectOf("function subject(value) { return Object.hasOwn(value, key) }"), "unknown")
  assert.equal(effectOf("function subject(value) { return Math.abs(value) }"), "unknown")
  assert.equal(effectOf("function subject(value) { return Object.is(read(), value) }"), "unknown")
})

test("function mutations do not execute generator bodies when creating iterators", () => {
  assert.equal(effectOf("function* deferred() { outer++ } function subject() { deferred(); return true }"), "none")
  assert.equal(effectOf("function subject() { (function* () { outer++ })(); return true }"), "none")
  assert.equal(effectOf("function subject() { (function* () { outer++ })(outer++); return true }"), "effect")
})

test("function mutations include calls made by iteration protocols", () => {
  assert.equal(effectOf("function subject(iterable) { for (const value of iterable) void value; return true }"),
    "unknown")
  assert.equal(effectOf("function subject(iterable) { const [ value ] = iterable; return value === 1 }"), "unknown")
  assert.equal(effectOf("function subject(iterable) { return [ ...iterable ].length === 1 }"), "unknown")
  assert.equal(effectOf("function* subject(iterable) { yield* iterable; return true }"), "unknown")
  assert.equal(effectOf("function subject(iterable) { return local(...iterable) } function local() { return true }"),
    "unknown")
  assert.equal(effectOf("async function subject(iterable) { for await (const value of iterable) void value; "
    + "return true }"), "unknown")
})

test("function mutations retain exact intrinsic iteration", () => {
  assert.equal(effectOf("function subject() { for (const value of [ 1 ]) void value; return true }"), "none")
  assert.equal(effectOf("function subject() { for (const value of [ , 1 ]) void value; return true }"), "none")
  assert.equal(effectOf("function subject() { const [ value ] = [ 1 ]; return value === 1 }"), "none")
  assert.equal(effectOf("function subject() { return [ ...[ 1 ] ].length === 1 }"), "none")
  assert.equal(effectOf("function subject() { for (const value of 'one') void value; return true }"), "none")
  assert.equal(effectOf("Array.prototype[Symbol.iterator] = replacement; "
    + "function subject() { for (const value of [ 1 ]) void value; return true }"), "unknown")
  assert.equal(effectOf("Object.getPrototypeOf([][Symbol.iterator]()).next = replacement; "
    + "function subject() { for (const value of [ 1 ]) void value; return true }"), "unknown")
  assert.equal(effectOf("Object.getPrototypeOf(''[Symbol.iterator]()).next = replacement; "
    + "function subject() { for (const value of 'one') void value; return true }"), "unknown")
  assert.equal(effectOf("function subject() { const values = [ 1 ]; values[Symbol.iterator] = replacement; "
    + "for (const value of values) void value; return true }"), "unknown")
})

test("function mutations recognize iterator prototypes reached through named iterator methods", () => {
  assert.equal(effectOf("Object.getPrototypeOf([].values()).next = replacement; "
    + "function subject() { for (const value of [ 1 ]) void value; return true }"), "unknown")
  assert.equal(effectOf("Object.getPrototypeOf(new Set().keys()).next = replacement; "
    + "function subject() { for (const value of new Set([ 1 ])) void value; return true }"), "unknown")
})

test("function mutations include iterator-close calls added to intrinsic prototypes", () => {
  assert.equal(effectOf("Object.getPrototypeOf([][Symbol.iterator]()).return = cleanup; "
    + "function subject() { for (const value of [ 1 ]) consume(value); return true }"), "unknown")
  assert.equal(effectOf("Object.getPrototypeOf(Object.getPrototypeOf([][Symbol.iterator]())).return = cleanup; "
    + "function subject() { for (const value of [ 1 ]) consume(value); return true }"), "unknown")
})

test("function mutations include tagged-template calls", () => {
  assert.equal(effectOf("function tag() { outer++ } function subject() { tag`value`; return true }"), "effect")
  assert.equal(effectOf("function tag() { return true } function subject() { tag`value`; return true }"), "none")
  assert.equal(effectOf("function subject(tag) { tag`value`; return true }"), "unknown")
  assert.equal(effectOf("function* tag() { outer++ } function subject() { tag`value`; return true }"), "none")
})

test("function mutations include object-copy and resource protocols", () => {
  assert.equal(effectOf("function subject(source) { return { ...source } }"), "unknown")
  assert.equal(effectOf("function subject() { return { ...{ value: 1 } } }"), "none")
  assert.equal(effectOf("function subject() { return { ...[ 1 ] } }"), "none")
  assert.equal(effectOf("function subject() { return { ...null, ...undefined, ...void source } }"), "none")
  assert.equal(effectOf("function subject() { return { ...{ get value() { return source } } } }"), "unknown")
  assert.equal(effectOf("function subject(resource) { using value = resource; return true }"), "unknown")
  assert.equal(effectOf("function subject() { using value = null; return true }"), "none")
  assert.equal(effectOf("function subject() { using value = undefined; return true }"), "none")
  assert.equal(effectOf("function subject() { using value = void acquire; return true }"), "none")
})

test("function mutations follow exact reads of getters declared on the same class", () => {
  assert.equal(methodEffectOf("class Subject { get source() { outer++; return 1 } "
    + "value() { return this.source + 1 } }", "value"), "effect")
  assert.equal(methodEffectOf("class Subject { get source() { return 1 } "
    + "value() { return this.source + 1 } }", "value"), "none")
})

test("function mutations keep public this dispatch conservative across subclasses", () => {
  assert.equal(methodEffectOf("class Base { computeValue() { return this.read() } read() { return 1 } } "
    + "class Child extends Base { read() { outer++; return 1 } }", "computeValue"), "unknown")
  assert.equal(methodEffectOf("class Base { value() { return this.source } get source() { return 1 } } "
    + "class Child extends Base { get source() { outer++; return 1 } }", "value"), "unknown")
  assert.equal(methodEffectOf("class Base { value() { return this.#read() } #read() { return 1 } } "
    + "class Child extends Base { read() { outer++; return 1 } }", "value"), "none")
})

test("function mutations keep externally extensible this dispatch conservative", () => {
  assert.equal(methodEffectOf(
    "export class Base { computeValue() { return this.read() } read() { return 1 } }", "computeValue"), "unknown")
  assert.equal(methodEffectOf(
    "export class Base { value() { return this.source } get source() { return 1 } }", "value"), "unknown")
  assert.equal(methodEffectOf(
    "class Base { computeValue() { return this.read() } read() { return 1 } }; consume(Base)",
    "computeValue"), "unknown")
  assert.equal(methodEffectOf(
    "class Local { computeValue() { return this.read() } read() { return 1 } }; new Local().computeValue()",
    "computeValue"), "none")
  assert.equal(methodEffectOf(
    "export class Base { value() { return this.#read() } #read() { return 1 } }", "value"), "none")
})

test("function mutations keep rewritten class dispatch conservative", () => {
  const rewrites = [
    "class C { read() { return 1 } subject() { return this.read() } } C.prototype.read = replacement",
    "class C { read() { return 1 } subject() { return this.read() } } "
    + "const prototype = C.prototype; prototype.read = replacement",
    "class C { read() { return 1 } subject() { return this.read() } } "
    + "Object.defineProperty(C.prototype, 'read', { value: replacement })",
    "class C { read() { return 1 } subject() { return this.read() } } "
    + "Object.assign(C.prototype, { read: replacement })",
    "class C { read() { return 1 } subject() { return this.read() } } "
    + "Reflect.set(C.prototype, 'read', replacement)",
    "class C { static read() { return 1 } static subject() { return this.read() } } C.read = replacement",
    "class Base { read() { return 1 } } class C extends Base { subject() { return this.read() } } "
    + "Base.prototype.read = replacement"
  ]

  rewrites.forEach((code) => assert.equal(methodEffectOf(code, "subject"), "unknown", code))
})

test("function mutations retain exact class dispatch across unrelated or non-replacing edits", () => {
  assert.equal(methodEffectOf(
    "class C { read() { return 1 } subject() { return this.read() } } C.prototype.other = replacement",
    "subject"), "none")
  assert.equal(methodEffectOf(
    "class C { read() { return 1 } subject() { return this.read() } } "
    + "Object.defineProperty(C.prototype, 'read', { enumerable: true })",
    "subject"), "none")
  assert.equal(methodEffectOf(
    "class C { read() { return 1 } subject() { return this.read() } } C.read = replacement",
    "subject"), "none")
  assert.equal(methodEffectOf(
    "class C { #read() { return 1 } subject() { return this.#read() } } C.prototype['#read'] = replacement",
    "subject"), "none")
  assert.equal(methodEffectOf(
    "class C { read() { return 1 } subject() { return this.read() } } "
    + "function unused() { C.prototype.read = replacement }",
    "subject"), "none")
})

test("observable writes distinguish local values from caller-visible state", () => {
  assert.equal(effectOf("function subject() { let value = 0; value++; return true }"), "none")
  assert.equal(effectOf("let value = 0; function subject() { value++; return true }"), "effect")
  assert.equal(effectOf("function subject(value) { value = 1; return true }"), "none")
  assert.equal(effectOf("function subject(value) { value.current = 1; return true }"), "effect")
  assert.equal(effectOf("function subject() { const value = {}; value.current = 1; return true }"), "none")
  assert.equal(effectOf("function subject(input) { const value = input; value.current = 1; return true }"), "effect")
  assert.equal(effectOf("function subject(input) { const value = input.state; value.current = 1; return true }"),
    "effect")
  assert.equal(effectOf("function subject() { const value = this.state; value.current = 1; return true }"), "effect")
  assert.equal(effectOf("function subject() { const value = make(); value.current = 1; return true }"), "unknown")
  assert.equal(effectOf("function subject() { subject = replacement; return true }"), "effect")
})

test("observable writes preserve provenance through fresh containers", () => {
  assert.equal(effectOf("function subject(input) { const box = { input }; box.input = {}; return true }"), "none")
  assert.equal(effectOf("function subject(input) { const box = { input }; box.input.used = true; return true }"),
    "effect")
  assert.equal(effectOf("function subject(input) { const box = [ input ]; box[0] = {}; return true }"), "none")
  assert.equal(effectOf("function subject(input) { const box = [ input ]; box[0].used = true; return true }"), "effect")
  assert.equal(effectOf("function subject() { const box = { input: {} }; box.input.used = true; return true }"), "none")
  assert.equal(effectOf("function subject() { const box = [ {} ]; box[0].used = true; return true }"), "none")
})

test("observable writes do not reuse provenance replaced by an earlier write", () => {
  assert.equal(effectOf("function subject(input) { const box = { input }; box.input = {}; "
    + "box.input.used = true; return true }"), "unknown")
  assert.equal(effectOf("function subject(input) { const box = [ input ]; box[0] = {}; "
    + "box[0].used = true; return true }"), "unknown")
  assert.equal(effectOf("function subject(input) { const box = { input }; box.other = {}; "
    + "box.input.used = true; return true }"), "effect")
  assert.equal(effectOf("function subject() { arguments[0] = {}; arguments[0].used = true; return true }"), "unknown")
  assert.equal(effectOf("function subject(...values) { values[0] = {}; values[0].used = true; return true }"),
    "unknown")
})

test("observable writes only discard provenance after a dominating write", () => {
  assert.equal(effectOf("function subject(input) { const box = { input }; if (false) box.input = {}; "
    + "box.input.used = true; return true }"), "effect")
  assert.equal(effectOf("function subject(input) { const box = { input }; "
    + "function never() { box.input = {} }; box.input.used = true; return true }"), "effect")
  assert.equal(effectOf("function subject(input, flag) { const box = { input }; if (flag) box.input = {}; "
    + "box.input.used = true; return true }"), "effect")
  assert.equal(effectOf("function subject(input, flag) { const box = { input }; box.input ||= {}; "
    + "box.input.used = true; return true }"), "effect")
  assert.equal(effectOf("function subject(input, flag) { const box = { input }; "
    + "if (flag) { box.input = {}; box.input.used = true }; return true }"), "unknown")
  assert.equal(effectOf("function subject(input) { const box = { input }; if (true) box.input = {}; "
    + "box.input.used = true; return true }"), "unknown")
  assert.equal(effectOf("function subject(input) { const box = { input }; { box.input = {} }; "
    + "box.input.used = true; return true }"), "unknown")
  assert.equal(effectOf("function subject(input) { const box = { input }; box.input = {}; "
    + "{ box.input.used = true }; return true }"), "unknown")
})

test("observable writes recognize dominating sequence and for-init writes", () => {
  assert.equal(effectOf("function subject(input) { const box = { input }; "
    + "(box.input = {}, box.input.used = true); return true }"), "unknown")
  assert.equal(effectOf("function subject(input) { const box = { input: {} }; "
    + "(box.input = input, box.input.used = true); return true }"), "unknown")
  assert.equal(effectOf("function subject(input) { const box = { input }; "
    + "for (box.input = {}; false;); box.input.used = true; return true }"), "unknown")
  assert.equal(effectOf("function subject(input) { const box = { input: {} }; "
    + "for (box.input = input; false;); box.input.used = true; return true }"), "unknown")
  assert.equal(effectOf("function subject(input, flag) { const box = { input }; "
    + "for (box.input = {}; flag;) { box.input.used = true; break }; return true }"), "unknown")
  assert.equal(effectOf("function subject(input, flag) { const box = { input: {} }; "
    + "for (box.input = input; flag;) { box.input.used = true; break }; return true }"), "unknown")
  assert.equal(effectOf("function subject(input, flag) { const box = { input }; "
    + "for (; flag; box.input = {}) box.input.used = true; return true }"), "effect")
  assert.equal(effectOf("function subject(input, flag) { const box = { input }; "
    + "(flag && (box.input = {}), box.input.used = true); return true }"), "effect")
})

test("observable writes discard provenance invalidated by delete", () => {
  assert.equal(effectOf("function subject(input) { const box = { input }; delete box.input; "
    + "box.input.used = true; return true }"), "unknown")
  assert.equal(effectOf("function subject(input) { const box = { __proto__: input, current: {} }; "
    + "delete box.current; box.current.used = true; return true }"), "unknown")
  assert.equal(effectOf("function subject(input, flag) { const box = { input }; "
    + "if (flag) delete box.input; box.input.used = true; return true }"), "effect")
})

test("observable writes preserve provenance through stable aliases", () => {
  assert.equal(effectOf("function subject(input) { const box = { input }; const alias = box; "
    + "alias.input.used = true; return true }"), "effect")
  assert.equal(effectOf("function subject(input) { const box = { input }; const alias = box.input; "
    + "alias.used = true; return true }"), "effect")
  assert.equal(effectOf("function subject(input) { const box = [ input ]; const alias = box; "
    + "alias[0].used = true; return true }"), "effect")
})

test("observable writes distinguish local argument containers from their values", () => {
  assert.equal(effectOf("function subject() { arguments[0] = {}; return true }"), "none")
  assert.equal(effectOf("function subject() { arguments[0].used = true; return true }"), "effect")
  assert.equal(effectOf("function subject() { const values = arguments; values[0].used = true; return true }"),
    "effect")
  assert.equal(effectOf("function subject(...values) { values[0] = {}; return true }"), "none")
  assert.equal(effectOf("function subject(...values) { values[0].used = true; return true }"), "effect")
  assert.equal(effectOf("function subject(...values) { const rest = values; rest[0] = {}; return true }"), "none")
  assert.equal(effectOf("function subject(...values) { const rest = values; rest[0].used = true; return true }"),
    "effect")
})

test("rest copies preserve observable nested mutations and iteration uncertainty", () => {
  assert.equal(effectOf("function subject(input) { const { ...box } = input; box.used = true; return true }"), "none")
  assert.equal(effectOf("function subject(input) { const { ...box } = input; box.first.used = true; return true }"),
    "effect")
  assert.equal(effectOf("function subject(input) { const [...box] = input; box.used = true; return true }"), "unknown")
  assert.equal(effectOf("function subject(input) { const [...box] = input; box[0].used = true; return true }"),
    "effect")
})

test("observable writes preserve the selected destructured value", () => {
  assert.equal(effectOf("function subject(input) { const { external } = { external: input }; "
    + "external.used = true; return true }"), "effect")
  assert.equal(effectOf("function subject() { const { local } = { local: {} }; "
    + "local.used = true; return true }"), "none")
  assert.equal(effectOf("function subject(input) { const { value: external } = { value: input }; "
    + "external.used = true; return true }"), "effect")
  assert.equal(effectOf("function subject(input) { const [ external ] = [ input ]; "
    + "external.used = true; return true }"), "effect")
  assert.equal(effectOf("function subject() { const [ local ] = [ {} ]; "
    + "local.used = true; return true }"), "none")
})

test("observable writes require an unambiguous local root", () => {
  assert.equal(effectOf("function subject(input) { var value = {}; var value = input; value.current = 1 }"), "unknown")
  assert.equal(effectOf("function subject(input) { var value = input; var value = {}; value.current = 1 }"), "unknown")
  assert.equal(effectOf("function subject() { arguments[0] = 1; return true }"), "none")
  assert.equal(effectOf("function subject(arguments) { arguments[0] = 1; return true }",
    { sourceType: "script" }), "effect")
})

test("dynamic lookup remains unknown without hiding independent writes", () => {
  assert.equal(effectOf("const act = () => outer++; function subject(scope) { with (scope) { return act() } }",
    { sourceType: "script" }), "unknown")
  assert.equal(effectOf("function subject(scope) { with (scope) { this.current++ }; return true }",
    { sourceType: "script" }), "effect")
})

function effectOf(code, parserOptions = {}, mutationOptions = OBSERVABLE) {
  const parsed = new ParsedCode(code, parserOptions)
  return effectFrom(
    parsed,
    parsed.nodesOfType("FunctionDeclaration").find((node) => node.id.name === "subject"),
    mutationOptions
  )
}

function effectFrom(parsed, functionNode, mutationOptions) {
  const mutations = new FunctionMutations(parsed.sourceCode, mutationOptions)
  if (mutations.mutatesFrom(functionNode)) return "effect"

  return mutations.hasUnknownFrom(functionNode) ? "unknown" : "none"
}

function methodEffectOf(code, name, mutationOptions = OBSERVABLE) {
  const parsed = new ParsedCode(code)
  return effectFrom(
    parsed,
    parsed.nodesOfType("MethodDefinition").find((node) => node.key.name === name).value,
    mutationOptions
  )
}
