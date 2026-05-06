import assert from "node:assert/strict"
import { test } from "node:test"
import { isBooleanName, isIdentifierName, leadingWordOf } from "#helpers/strings/naming"

test("leadingWordOf is the lowercase run a camelCase name opens with", () => {
  assert.equal(leadingWordOf("fetchPrices"), "fetch")
  assert.equal(leadingWordOf("fetch"), "fetch")
})

test("leadingWordOf is empty for a name that opens with anything else", () => {
  assert.equal(leadingWordOf("_render"), "")
  assert.equal(leadingWordOf("Render"), "")
})

test("isBooleanName recognizes open third-person verb forms", () => {
  assert.ok(isBooleanName("includesItem"))
  assert.ok(isBooleanName("crossesCurrentStreet"))
  assert.ok(isBooleanName("forwardsMessage"))
  assert.ok(isBooleanName("exists"))
  assert.ok(isBooleanName("assignsFinder"))
  assert.ok(isBooleanName("fallsThrough"))
  assert.ok(isBooleanName("carriesValue"))
  assert.ok(isBooleanName("watchesTarget"))
  assert.ok(isBooleanName("bringsValue"))
  assert.ok(isBooleanName("ringsBell"))
})

test("isBooleanName recognizes less regular third-person verbs", () => {
  assert.ok(isBooleanName("transmogrifiesInput"))
  assert.ok(isBooleanName("dominatesNode"))
  assert.ok(isBooleanName("hamstringsOpponent"))
  assert.ok(isBooleanName("restringsGuitar"))
  assert.ok(isBooleanName("unstringsBow"))
  assert.ok(isBooleanName("skisSlope"))
})

test("isBooleanName rejects uninflected noun endings", () => {
  assert.ok(!isBooleanName(null))
  assert.ok(!isBooleanName(1))
  assert.ok(!isBooleanName("status"))
  assert.ok(!isBooleanName("address"))
  assert.ok(!isBooleanName("analysisComplete"))
  assert.ok(isBooleanName("focusesInput"))
  assert.ok(isBooleanName("addressesIssue"))
})

test("isBooleanName does not guess whether a regular s form is a plural noun or a verb", () => {
  assert.ok(isBooleanName("bindings"))
  assert.ok(isBooleanName("settings"))
  assert.ok(isBooleanName("prices"))
  assert.ok(isBooleanName("items"))
})

test("isIdentifierName follows the ECMAScript identifier-name alphabet", () => {
  assert.deepEqual(
    [ "$", "_private", "π", "a\u{200C}b", "café" ].map(isIdentifierName),
    [ true, true, true, true, true ]
  )
  assert.deepEqual(
    [ "", "1st", "on-click", "two words", null ].map(isIdentifierName),
    [ false, false, false, false, false ]
  )
})
