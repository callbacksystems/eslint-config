import assert from "node:assert/strict"
import { test } from "node:test"
import { GlobalPath } from "#helpers/scope/global_path"
import { BindingResolver } from "#helpers/scope/binding_resolver"
import { ParsedCode } from "#support"

test("global paths resolve iterator prototypes and reject unknown properties", () => {
  [
    [ "[][Symbol.iterator]().__proto__", "%ArrayIteratorPrototype%" ],
    [ "`text`[Symbol.iterator]().__proto__", "%StringIteratorPrototype%" ],
    [ "Object.getPrototypeOf([][Symbol.iterator]())", "%ArrayIteratorPrototype%" ],
    [ "Object.getPrototypeOf(Object.getPrototypeOf([][Symbol.iterator]()))", "%IteratorPrototype%" ],
    [ "Object.getPrototypeOf(custom)", null ],
    [ "Object[dynamic]", null ],
    [ "Array.__proto__", "Array" ]
  ].forEach(([ expression, expected ]) => {
    const parsed = new ParsedCode(expression)
    assert.equal(GlobalPath.from(parsed.sourceCode.ast.body[0].expression,
      new BindingResolver(parsed.sourceCode))?.globalName ?? null, expected, expression)
  })
})

test("global write paths deduplicate aliases and keep prototype writes indeterminate", () => {
  const parsed = new ParsedCode("Object.__proto__; Object?.value")
  const [ member, optional ] = parsed.nodesOfType("MemberExpression")
  const paths = GlobalPath.writePathsFor(member, new BindingResolver(parsed.sourceCode),
    [ member.object, member.object ])

  assert.equal(paths.length, 1)
  assert.ok(paths[0].equals("Object", [ null ]))
  assert.deepEqual(GlobalPath.writePathsFor(optional, new BindingResolver(parsed.sourceCode)), [])
})

test("global paths honor an existing binding traversal when resolving aliases", () => {
  const parsed = new ParsedCode("const alias = Object; alias")
  const bindings = new BindingResolver(parsed.sourceCode)

  assert.ok(GlobalPath.from(parsed.sourceCode.ast.body.at(-1).expression, bindings, new Set()).equals("Object", []))
})
