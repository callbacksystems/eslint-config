import assert from "node:assert/strict"
import { test } from "node:test"
import { CssSelector } from "#helpers/css/css_selector"
import { ParsedCode } from "#support"

test("CSS attributes are decoded in one forward scan", () => {
  const selector = new CssSelector(String.raw`[data-ready][svg|cl\61 ss][class|=token]`)
  assert.deepEqual(selector.attributeNames, [ "data-ready", "class", "class" ])
})

test("attribute matching stops at its first match", () => {
  const selector = new CssSelector("[data-ready][class][data-late]")
  let visits = 0
  assert.equal(selector.attributeMatching((name) => {
    visits += 1
    return name === "class"
  }), "class")
  assert.equal(visits, 2)
})

test("dynamic selector prefixes expose only attributes closed before interpolation", () => {
  const closed = new ParsedCode([ "`[data-ready]$", "{value}[data-late]`" ].join(""))
  const open = new ParsedCode([ "`[data-$", "{name}-ready]`" ].join(""))
  assert.deepEqual(
    CssSelector.fromStaticPrefix(closed.firstNodeOfType("TemplateLiteral")).attributeNames,
    [ "data-ready" ]
  )
  assert.deepEqual(CssSelector.fromStaticPrefix(open.firstNodeOfType("TemplateLiteral")).attributeNames, [])
})

test("from rejects absent and dynamic selector values", () => {
  const parsed = new ParsedCode("selector")

  assert.equal(CssSelector.from(null), null)
  assert.equal(CssSelector.from(parsed.firstNodeOfType("Identifier")), null)
})

test("tagged templates retain raw CSS when JavaScript cannot cook an escape", () => {
  const parsed = new ParsedCode("css`.item\\unicode`")

  assert.ok(CssSelector.from(parsed.firstNodeOfType("TemplateLiteral")).hasClass)
})

test("a trailing CSS escape is consumed without inventing syntax", () => {
  const selector = new CssSelector("\\")

  assert.ok(!selector.hasClass)
  assert.deepEqual(selector.attributeNames, [])
})
