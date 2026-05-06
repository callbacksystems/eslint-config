import { pushReversed } from "#helpers/syntax/ast"
import { evaluatedChildNodesOf } from "#helpers/flow/evaluated_child_nodes"

export class EvaluatedExpressions {
  #roots

  constructor(roots) {
    this.#roots = roots.filter(Boolean)
  }

  includes(predicate) {
    const pending = this.#roots.toReversed()
    while (pending.length > 0) {
      const node = pending.pop()
      if (predicate(node)) return true

      pushReversed(pending, evaluatedChildNodesOf(node))
    }
    return false
  }
}
