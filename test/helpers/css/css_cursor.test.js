import assert from "node:assert/strict"
import { test } from "node:test"
import { CssCursor } from "#helpers/css/css_cursor"

test("CSS identifiers accept every dashed start form", () => {
  [
    [ "--token", "--token" ],
    [ "-token", "-token" ],
    [ String.raw`-\74 oken`, "-token" ]
  ].forEach(([ source, expected ]) => {
    const cursor = new CssCursor(source)
    assert.equal(cursor.identifier({ maxLength: 20 }), expected)
    assert.ok(cursor.isDone)
  })
})

test("a hexadecimal escape consumes one following CRLF as whitespace", () => {
  const cursor = new CssCursor("\\61\r\nb")

  assert.equal(cursor.identifier({ maxLength: 20 }), "ab")
  assert.ok(cursor.isDone)
})

test("invalid escaped Unicode values become the replacement character", () => {
  [ String.raw`\0`, String.raw`\D800`, String.raw`\110000` ].forEach((source) => {
    const cursor = new CssCursor(source)
    assert.equal(cursor.identifier({ maxLength: 20 }), "�")
  })

  const boundary = new CssCursor(String.raw`\10FFFF`)
  assert.equal(boundary.identifier({ maxLength: 20 }), "􏿿")
})

test("escaped newlines are removed from CSS strings", () => {
  [ "\n", "\r\n", "\f" ].forEach((newline) => {
    const cursor = new CssCursor(`'line\\${newline}wrap'`)
    assert.equal(cursor.quotedValue({ maxLength: 20 }), "linewrap")
    assert.ok(cursor.isDone)
  })
})

test("an escaped literal NUL stays distinct from an escaped code point and end of input", () => {
  const literal = new CssCursor("\\\0")
  assert.equal(literal.identifier({ maxLength: 1 }), "\0")
  assert.ok(literal.isDone)

  const trailing = new CssCursor("token\\")
  assert.equal(trailing.identifier({ maxLength: 5 }), "token")
  assert.equal(trailing.character, "\\")
})

test("bounded values consume the entire token even after exceeding the limit", () => {
  const identifier = new CssCursor(String.raw`${"x".repeat(10_000)}\61 ]`)
  assert.equal(identifier.identifier({ maxLength: 4 }), null)
  assert.equal(identifier.character, "]")

  const quoted = new CssCursor(`'${"x".repeat(10_000)}\\\r\nend']`)
  assert.equal(quoted.quotedValue({ maxLength: 4 }), null)
  assert.equal(quoted.character, "]")
})

test("identifier limits count UTF-16 units for literal and escaped supplementary characters", () => {
  [ "😀", String.raw`\1F600` ].forEach((source) => {
    assert.equal(new CssCursor(source).identifier({ maxLength: 1 }), null)
    assert.equal(new CssCursor(source).identifier({ maxLength: 2 }), "😀")
  })
})
