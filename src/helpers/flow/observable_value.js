import { ArrayIndex } from "#helpers/arrays/array_index"
import { resolvedRuntimePropertyKeyOf } from "#helpers/classes/resolved_member_key"
import { FreshMemberValue } from "#helpers/flow/fresh_member_value"
import { MemberOverwrites } from "#helpers/flow/member_overwrites"
import { GlobalValueIdentity } from "#helpers/scope/global_value_identity"
import { isWithinTree } from "#helpers/syntax/ranges"

const EFFECT = "effect"
const FRESH_VALUE_TYPES = new Set([
  "ArrayExpression", "ArrowFunctionExpression", "ClassExpression", "FunctionExpression", "ObjectExpression"
])
const NONE = "none"
const UNKNOWN = "unknown"
const patternIndexes = new WeakMap()

export class ObservableValue {
  #accesses = []
  #bindings
  #current
  #functionNode
  #globals
  #status = null
  #target
  #visited = new Set()

  constructor(target, functionNode, bindings) {
    this.#current = target.object
    this.#functionNode = functionNode
    this.#bindings = bindings
    this.#globals = new GlobalValueIdentity(bindings)
    this.#target = target
  }

  get status() {
    while (this.#status === null) this.#advance()
    return this.#status
  }

  #advance() {
    if (this.#current?.type === "MemberExpression") this.#addMemberAccess()
    else this.#advanceNonMember()
  }

  #addMemberAccess() {
    if (this.#current.optional) {
      this.#status = UNKNOWN
    } else {
      this.#accesses.push(new ValueAccess({ node: this.#current, bindings: this.#bindings, globals: this.#globals }))
      this.#current = this.#current.object
    }
  }

  #advanceNonMember() {
    if (this.#current?.type === "Identifier") this.#followIdentifier()
    else this.#advanceValue()
  }

  #followIdentifier() {
    if (this.#bindings.isDynamicallyResolved(this.#current)) {
      this.#status = UNKNOWN
    } else {
      const variable = this.#bindings.variableFor(this.#current)
      if (variable) this.#followVariable(variable)
      else this.#status = EFFECT
    }
  }

  #followVariable(variable) {
    if (isWithinTree(variable.scope.block, this.#functionNode)) {
      this.#followLocalVariable(new LocalBinding(variable, {
        accesses: this.#accesses,
        bindings: this.#bindings,
        identifier: this.#current,
        target: this.#target,
        visited: this.#visited
      }))
    } else this.#status = EFFECT
  }

  #followLocalVariable(binding) {
    if (binding.isOverwritten) {
      this.#status = UNKNOWN
    } else {
      this.#followOriginalVariable(binding)
    }
  }

  #followOriginalVariable(binding) {
    if (binding.isArgumentContainer) {
      this.#status = this.#localArgumentContainerStatus
    } else if (binding.isAmbiguous) {
      this.#status = UNKNOWN
    } else {
      binding.visit()
      this.#followDefinition(binding.definition)
    }
  }

  get #localArgumentContainerStatus() {
    return this.#accesses.length === 0 ? NONE : EFFECT
  }

  #followDefinition(definition) {
    if (definition.type === "Parameter") this.#followParameter(definition)
    else if (definition.type === "Variable") this.#followVariableDefinition(definition)
    else this.#status = UNKNOWN
  }

  #followParameter(definition) {
    this.#status = isRestBinding(definition)
      ? this.#localArgumentContainerStatus
      : EFFECT
  }

  #followVariableDefinition(definition) {
    const path = new PatternPath(definition, { bindings: this.#bindings, globals: this.#globals })
    if (!definition.node.init || path.isUnknown) {
      this.#status = UNKNOWN
    } else if (path.isRestContainer) {
      this.#followRestOrigin(definition.node.init)
    } else {
      this.#accesses.push(...path.accesses)
      this.#current = definition.node.init
    }
  }

  #followRestOrigin(value) {
    if (this.#accesses.length === 0) {
      this.#status = NONE
    } else {
      this.#accesses.pop()
      this.#accesses.push(ValueAccess.unknown())
      this.#current = value
    }
  }

  #advanceValue() {
    if (this.#isInstanceValue) this.#status = EFFECT
    else if (FRESH_VALUE_TYPES.has(this.#current?.type)) this.#followFreshValue()
    else this.#status = UNKNOWN
  }

  get #isInstanceValue() {
    return this.#current?.type === "ThisExpression" || this.#current?.type === "Super"
  }

  #followFreshValue() {
    if (this.#accesses.length === 0) {
      this.#status = NONE
    } else {
      this.#followFreshMember()
    }
  }

  #followFreshMember() {
    const { value } = new FreshMemberValue(this.#current, { access: this.#accesses.pop(), bindings: this.#bindings })
    if (typeof value === "string") this.#status = value
    else this.#current = value
  }
}

class ValueAccess {
  #bindings
  #cachedName
  #explicitName
  #globals
  #node

  static at(index) {
    return new ValueAccess({ name: String(index) })
  }

  static unknown() {
    return new ValueAccess()
  }

  constructor({ node = null, bindings = null, globals = null, name = null } = {}) {
    this.#node = node
    this.#bindings = bindings
    this.#globals = globals
    this.#explicitName = name
  }

  get arrayIndex() {
    if (this.#explicitName !== null) return Number(this.#explicitName)
    if (this.name === null || !new ArrayIndex(this.#node).isPossible) return null
    return Number(this.name)
  }

  get name() {
    if (this.#node) {
      if (this.#cachedName === undefined) {
        this.#cachedName = resolvedRuntimePropertyKeyOf(this.#node, {
          bindings: this.#bindings, globals: this.#globals
        })
      }
      return this.#cachedName
    } else {
      return this.#explicitName
    }
  }
}

class LocalBinding {
  #accesses
  #bindings
  #identifier
  #target
  #variable
  #visited

  constructor(variable, { accesses, bindings, identifier, target, visited }) {
    this.#variable = variable
    this.#accesses = accesses
    this.#bindings = bindings
    this.#identifier = identifier
    this.#target = target
    this.#visited = visited
  }

  get definition() {
    return this.#variable.defs[0]
  }

  get isAmbiguous() {
    return this.#variable.defs.length !== 1
      || this.#visited.has(this.#variable)
      || !this.#bindings.isUnmodified(this.#identifier)
  }

  get isArgumentContainer() {
    return this.#identifier.name === "arguments" && this.#variable.defs.length === 0
  }

  get isOverwritten() {
    return new MemberOverwrites(this.#variable, {
      accesses: this.#accesses, bindings: this.#bindings, target: this.#target
    }).exists
  }

  visit() {
    this.#visited.add(this.#variable)
  }
}

function isRestBinding(definition) {
  return definition.name.parent?.type === "RestElement"
}

class PatternPath {
  accesses = []
  isRestContainer = false
  isUnknown = false

  #bindings
  #current
  #globals
  #root

  constructor(definition, { bindings, globals }) {
    this.#current = definition.name
    this.#root = definition.node.id
    this.#bindings = bindings
    this.#globals = globals
    this.#build()
  }

  #build() {
    while (!this.#isComplete) this.#addParent()
  }

  get #isComplete() {
    return this.isUnknown || this.isRestContainer || this.#current === this.#root
  }

  #addParent(parent = this.#current.parent) {
    switch (parent?.type) {
      case "Property":
        this.#addProperty(parent)
        break
      case "ArrayPattern":
        this.#addArrayElement(parent)
        break
      case "RestElement":
        this.isRestContainer = true
        break
      default: this.isUnknown = true
    }
  }

  #addProperty(property) {
    this.accesses.push(new ValueAccess({ node: property, bindings: this.#bindings, globals: this.#globals }))
    this.#current = property.parent
  }

  #addArrayElement(pattern) {
    this.accesses.push(ValueAccess.at(indexOfPatternElement(pattern, this.#current)))
    this.#current = pattern
  }
}

function indexOfPatternElement(pattern, element) {
  if (!patternIndexes.has(pattern)) {
    patternIndexes.set(pattern, new Map(pattern.elements.map((value, index) => [ value, index ])))
  }
  return patternIndexes.get(pattern).get(element)
}
