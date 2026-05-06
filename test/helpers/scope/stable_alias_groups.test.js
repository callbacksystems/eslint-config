import assert from "node:assert/strict"
import { test } from "node:test"
import { BindingResolver } from "#helpers/scope/binding_resolver"
import { StableAliasGroups } from "#helpers/scope/stable_alias_groups"
import { ParsedCode } from "#support"

const CALL_POLICY = {}
const CURRENT_REFERENCE_POLICY = {}

test("groups stable aliases and caches confinement across many uses", () => {
  const fixture = new AliasFixture(new WideAliasProgram(1_000).code)
  let inspections = 0

  assert.equal(fixture.groups.size, 1)
  assert.ok(fixture.group.isConfinedFor(CALL_POLICY, (reference) => {
    inspections += 1
    return isDirectMemberCall(reference)
  }))
  assert.ok(fixture.group.isConfinedFor(CALL_POLICY, () => false))
  assert.equal(inspections, 1_000)
})

test("rejects exported, eval-exposed, and script-global alias groups", () => {
  [
    new AliasFixture("export const root = []; root.some(predicate)"),
    new AliasFixture("function run() { const root = []; eval(code); root.some(predicate) }", { sourceType: "script" }),
    new AliasFixture("const root = []; root.some(predicate)", { sourceType: "script" })
  ].forEach((fixture) => assert.ok(!fixture.group.isConfinedFor(CALL_POLICY, isDirectMemberCall)))
})

test("keeps module locals and bindings hidden from a shadowed eval", () => {
  [
    new AliasFixture("const root = []; root.some(predicate)"),
    new AliasFixture(
      "function run(eval) { const root = []; eval(code); root.some(predicate) }", { sourceType: "script" })
  ].forEach((fixture) => assert.ok(fixture.group.isConfinedFor(CALL_POLICY, isDirectMemberCall)))
})

test("lets each consumer reject reads, writes, and escapes through its policy", () => {
  [
    "const root = []; consume(root)",
    "const root = []; root.some = replacement",
    "const root = []; const method = root.some"
  ].forEach((code) => {
    const fixture = new AliasFixture(code)
    assert.ok(!fixture.group.isConfinedFor(CALL_POLICY, isDirectMemberCall))
  })
})

test("validates provenance at each use rather than only at the declaration", () => {
  const before = new AliasFixture("root.some(predicate); const root = []")
  const dynamic = new AliasFixture(
    "const root = []; with ({ root: other }) root.some(predicate)", { sourceType: "script" })

  assert.equal(before.group, null)
  assert.equal(dynamic.group, null)
})

test("confines stable aliases at the lookup point", () => {
  [
    "function run() { const root = []; root.some(predicate); consume(root) }",
    "function run() { const root = []; root.some(predicate); return; consume(root) }",
    "function run() { const root = []; root.some((consume(root), predicate)) }"
  ].forEach((code) => assert.ok(new AliasFixture(code).isConfinedAtCall))
})

test("rejects references that can precede a lookup through control flow", () => {
  [
    "function run() { const root = []; consume(root); root.some(predicate) }",
    "function run() { const root = []; while (condition) { root.some(predicate); consume(root) } }",
    "function run() { const root = []; for (; condition; consume(root)) root.some(predicate) }",
    "function run() { const root = []; for (const item of items) { root.some(item); consume(root) } }",
    "function run() { const root = []; root.some(predicate); function leak() { consume(root) } }"
  ].forEach((code) => assert.ok(!new AliasFixture(code).isConfinedAtCall))
})

test("can exclude only the current lookup from an unsafe-reference policy", () => {
  const confined = [
    "function run() { const root = []; root.some(predicate); consume(root) }",
    "function run() { const root = []; return root.some(predicate) }"
  ]
  confined.forEach((code) => assert.ok(new AliasFixture(code).isConfinedIgnoringCurrentCall))

  const exposed = [
    "function run() { const root = []; root.other(); root.some(predicate) }",
    "function run() { const root = []; root[(consume(root), 'some')](predicate) }",
    "function run() { const root = []; while (condition) { root.some(predicate); consume(root) } }",
    "function run() { const root = []; root.some(predicate); function leak() { consume(root) } }"
  ]
  exposed.forEach((code) => assert.ok(!new AliasFixture(code).isConfinedIgnoringCurrentCall))
})

class AliasFixture {
  #parsed

  constructor(code, options) {
    this.#parsed = new ParsedCode(code, options)
  }

  get group() {
    return this.#aliases.groupFor(this.#identifiers.findLast((identifier) => identifier.name === "root"))
  }

  get groups() {
    return new Set(this.#identifiers
      .filter((identifier) => identifier.name === "root" || identifier.name.startsWith("alias"))
      .map((identifier) => this.#aliases.groupFor(identifier)).filter(Boolean))
  }

  get isConfinedAtCall() {
    const reference = this.#references.findLast((candidate) => isDirectMemberCall(candidate))
    return this.#aliases.groupFor(reference.identifier)?.isConfinedAt({
      reference,
      isSafeReference: isDirectMemberCall,
      policy: CALL_POLICY,
      target: reference.identifier.parent
    }) === true
  }

  get isConfinedIgnoringCurrentCall() {
    const reference = this.#references.findLast((candidate) => isDirectMemberCall(candidate))
    return this.#aliases.groupFor(reference.identifier)?.isConfinedAt({
      isSafeReference: () => false,
      target: reference.identifier.parent,
      ignoredReference: reference,
      policy: CURRENT_REFERENCE_POLICY,
      reference
    }) === true
  }

  get #aliases() {
    return StableAliasGroups.for(this.#parsed.sourceCode, BindingResolver.for(this.#parsed.sourceCode))
  }

  get #identifiers() {
    return this.#references
      .filter((reference) => reference.isRead())
      .map((reference) => reference.identifier)
  }

  get #references() {
    return this.#parsed.sourceCode.scopeManager.scopes.flatMap((scope) => scope.references)
  }
}

function isDirectMemberCall(reference) {
  const member = reference.identifier.parent
  return member?.type === "MemberExpression" && member.object === reference.identifier
    && member.parent?.type === "CallExpression" && member.parent.callee === member
}

class WideAliasProgram {
  #count

  constructor(count) {
    this.#count = count
  }

  get code() {
    return `const root = []; ${this.#declarations};${this.#calls}`
  }

  get #declarations() {
    return this.#linesFor((index) => `const alias${index} = root`)
  }

  #linesFor(lineAt) {
    return Array.from({ length: this.#count }, (_value, index) => lineAt(index)).join(";")
  }

  get #calls() {
    return this.#linesFor((index) => `alias${index}.some(predicate)`)
  }
}
