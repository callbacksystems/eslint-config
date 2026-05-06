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
