import assert from "node:assert/strict"
import { test } from "node:test"
import { FunctionEffectGraph } from "#helpers/flow/function_effect_graph"
import { ParsedCode } from "#support"

test("binding mutations stop at their owner even across cycles and shared callers", () => {
  const graph = new FunctionEffectGraph()
  const [ owner, middle, leaf, , side ] = cyclicFunctionsIn(graph)
  leaf.addBindingMutation({ boundary: owner.normal.functionNode })

  assert.deepEqual(graph.mutatingFunctions, new Set([
    middle.normal.functionNode, leaf.normal.functionNode, side.normal.functionNode
  ]))
  assert.equal(graph.unknownFunctions.size, 0)
})

test("shared paths propagate each binding mutation up to its own owner", () => {
  const graph = new FunctionEffectGraph()
  const [ owner, middle, leaf, caller, side ] = cyclicFunctionsIn(graph)
  owner.normal.addFunction(leaf.normal)
  leaf.addBindingMutation({ boundary: owner.normal.functionNode })
  leaf.addBindingMutation({ boundary: middle.normal.functionNode })

  assert.deepEqual(graph.mutatingFunctions, new Set([
    owner, middle, leaf, caller, side
  ].map((effects) => effects.normal.functionNode)))
})

test("fresh receivers preserve separate effects and binding owners stop both receiver states", () => {
  const graph = new FunctionEffectGraph()
  const [ caller, target ] = functionsIn(graph)
  caller.normal.addFunction(target.fresh)
  target.normal.mutatesDirectly = true
  target.addBindingMutation({ boundary: target.normal.functionNode })
  target.fresh.isDirectlyUnknown = true

  assert.deepEqual(graph.mutatingFunctions, new Set([ target.normal.functionNode ]))
  assert.deepEqual(graph.unknownFunctions, new Set([ caller.normal.functionNode ]))
})

function cyclicFunctionsIn(graph) {
  const [ owner, middle, leaf, caller, side ] = functionsIn(graph)
  owner.normal.addFunction(middle.normal)
  middle.normal.addFunction(leaf.normal)
  leaf.normal.addFunction(owner.normal)
  caller.normal.addFunction(owner.normal)
  side.normal.addFunction(leaf.normal)
  return [ owner, middle, leaf, caller, side ]
}

function functionsIn(graph) {
  const parsed = new ParsedCode("function owner() {} function middle() {} function leaf() {} "
    + "function caller() {} function side() {}")
  return parsed.nodesOfType("FunctionDeclaration").map((node) => graph.effectsOf(node))
}
