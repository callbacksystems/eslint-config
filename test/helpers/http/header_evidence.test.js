import assert from "node:assert/strict"
import { test } from "node:test"
import { HeaderEvidence } from "#helpers/http/header_evidence"
import { BindingResolver } from "#helpers/scope/binding_resolver"
import { ParsedCode } from "#support"

test("header spreads preserve named entries only after the last uncertain source", () => {
  [
    [ "{ Trace: token, ...null }", 1 ],
    [ "{ Trace: token, ...1 }", 1 ],
    [ "{ Trace: token, ...'text' }", 1 ],
    [ "{ Trace: token, ...`text` }", 1 ],
    [ "{ Trace: token, ...void value }", 1 ],
    [ "{ Trace: token, ...[] }", 1 ],
    [ "{ Trace: token, .../x/ }", 1 ],
    [ "{ Trace: token, ...unknown }", 0 ],
    [ "{ Trace: token, ...{ [key]: value } }", 0 ],
    [ "{ ...{ [key]: value }, Trace: token }", 1 ],
    [ "{ __proto__: null, Trace: token }", 1 ],
    [ "{ Trace: token, ...{ __proto__: null } }", 1 ]
  ].forEach(([ initializer, expected ]) => {
    assert.equal(initializerCountOf(`new Headers(${initializer})`), expected, initializer)
  })
})

test("header initializers follow inline and private helpers and terminal consumers", () => {
  [
    "((options) => fetch(url, options))({ headers: { Trace: token } })",
    "function send(options) { new Request(url, options) }; send({ headers: { Trace: token } })",
    "function send(headers) { new Headers(headers) }; send({ Trace: token })",
    "class Client { #send(options) { fetch(url, options) } "
    + "send() { this.#send({ headers: { Trace: token } }) } }",
    "function send(options) { const alias = options; const other = alias; fetch(url, other) }; "
    + "send({ headers: { Trace: token } })"
  ].forEach((code) => assert.equal(initializerCountOf(code), 1, code))
})

test("header evidence rejects escapes and invalidates overwritten initializers", () => {
  [
    "const options = { headers: { Trace: token } }; options.headers++; fetch(url, options)",
    "const options = { headers: { Trace: token } }; delete options.headers; fetch(url, options)",
    "function send(options) { new External(url, options) }; send({ headers: { Trace: token } })",
    "function send(headers) { new External(headers) }; send({ Trace: token })",
    "function send(headers) { new Headers(extra, headers) }; send({ Trace: token })",
    "function send(headers) { new Request(headers) }; send({ Trace: token })",
    "function send(options) { ignore(options); fetch(url, options) }; "
    + "function forward(options) { send(options) }; forward({ headers: { Trace: token } })",
    "function send(options) { const alias = options; const other = alias; consume(other); fetch(url, options) }; "
    + "send({ headers: { Trace: token } })",
    "function send(headers) { const options = {}; options.headers += headers; fetch(url, options) }; "
    + "send({ Trace: token })",
    "function send(...options) { fetch(url, options) }; send({ headers: { Trace: token } })",
    "function send() {}; function forward(options) { send(options); fetch(url, options) }; "
    + "forward({ headers: { Trace: token } })"
  ].forEach((code) => assert.equal(initializerCountOf(code), 0, code))
})

function initializerCountOf(code) {
  const parsed = new ParsedCode(code)
  const evidence = new HeaderEvidence(parsed.sourceCode, BindingResolver.for(parsed.sourceCode))
  return parsed.nodesOfType("Property")
    .filter((node) => node.key.name === "Trace" && evidence.includesInitializer(node)).length
}
