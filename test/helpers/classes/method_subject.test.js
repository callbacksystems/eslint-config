import assert from "node:assert/strict"
import { test } from "node:test"
import { MethodSubject } from "#helpers/classes/method_subject"
import { ParsedCode } from "#support"

test("MethodSubject exposes a method definition's shared structural facts", () => {
  const parsed = new ParsedCode("class Example { async *#load(value) { return value } }")
  const definition = parsed.firstNodeOfType("MethodDefinition")
  const subject = new MethodSubject(definition)

  assert.deepEqual({
    name: subject.name,
    nameNode: subject.nameNode,
    params: subject.params,
    body: subject.body,
    functionNode: subject.functionNode,
    definitionNode: subject.definitionNode,
    kind: subject.kind,
    isPrivate: subject.isPrivate,
    isAsync: subject.isAsync,
    isGenerator: subject.isGenerator
  }, {
    name: "#load",
    nameNode: definition.key,
    params: definition.value.params,
    body: definition.value.body,
    functionNode: definition.value,
    definitionNode: definition,
    kind: "method",
    isPrivate: true,
    isAsync: true,
    isGenerator: true
  })
})
