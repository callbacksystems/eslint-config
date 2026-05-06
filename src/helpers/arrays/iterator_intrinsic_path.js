import { isDirectString } from "#helpers/syntax/ast"
import { resolvedMemberKeyOf } from "#helpers/classes/resolved_member_key"
import { stableExpressionFor } from "#helpers/flow/stable_expression"

const INSTANCE_NAMES = new Map([
  [ "Array", "%ArrayIteratorInstance%" ],
  [ "Set", "%SetIteratorInstance%" ],
  [ "String", "%StringIteratorInstance%" ]
])

const PROTOTYPE_NAMES = new Map([
  [ "Array", "%ArrayIteratorPrototype%" ],
  [ "Set", "%SetIteratorPrototype%" ],
  [ "String", "%StringIteratorPrototype%" ]
])

const ITERATOR_PROTOTYPE_NAME = "%IteratorPrototype%"
const PARENT_PROTOTYPES = new Map([
  ...Array.from(INSTANCE_NAMES, ([ globalName, instanceName ]) =>
    [ instanceName, PROTOTYPE_NAMES.get(globalName) ]),
  ...Array.from(PROTOTYPE_NAMES.values(), (prototypeName) => [ prototypeName, ITERATOR_PROTOTYPE_NAME ])
])

export function iteratorResultIntrinsicNameOf(node, bindings) {
  return node ? new IteratorResult(node, bindings).globalName : null
}

export function iteratorPrototypeIntrinsicNameFor(globalName) {
  return PROTOTYPE_NAMES.get(globalName) ?? null
}

export function iteratorPrototypeIntrinsicNameFrom(path) {
  return path?.members.length === 0 ? PARENT_PROTOTYPES.get(path.globalName) ?? null : null
}

export function iteratorPrototypeChainNamesFor(globalName) {
  return [ PROTOTYPE_NAMES.get(globalName), ITERATOR_PROTOTYPE_NAME ].filter(Boolean)
}

class IteratorResult {
  #bindings
  #node

  constructor(node, bindings) {
    this.#bindings = bindings
    this.#node = stableExpressionFor(node, bindings)
  }

  get globalName() {
    if (this.#isPlainMemberCall) {
      const kind = this.#receiverKind
      return kind && this.#isIteratorMethodFor(kind) ? INSTANCE_NAMES.get(kind) : null
    } else {
      return null
    }
  }

  get #isPlainMemberCall() {
    return this.#node?.type === "CallExpression" && !this.#node.optional
      && this.#node.callee.type === "MemberExpression" && !this.#node.callee.optional
  }

  get #receiverKind() {
    const receiver = stableExpressionFor(this.#node.callee.object, this.#bindings)
    if (receiver?.type === "ArrayExpression") return "Array"
    if (isDirectString(receiver)) return "String"
    return this.#isNativeSetConstruction(receiver) ? "Set" : null
  }

  #isNativeSetConstruction(node) {
    return node?.type === "NewExpression" && node.callee.type === "Identifier"
      && this.#bindings.globalNameFor(node.callee) === "Set"
  }

  #isIteratorMethodFor(kind) {
    const key = resolvedMemberKeyOf(this.#node.callee, this.#bindings)
    const property = key?.pathMember ?? key?.name
    if (property === Symbol.iterator) return true
    return kind === "Array" || kind === "Set"
      ? [ "entries", "keys", "values" ].includes(property)
      : false
  }
}
