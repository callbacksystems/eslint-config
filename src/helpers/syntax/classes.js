import { getStringIfConstant } from "@eslint-community/eslint-utils"
import { isStaticTemplateLiteral } from "#helpers/syntax/ast"
import { NearestAncestor } from "#helpers/syntax/nearest_ancestor"
import { contains } from "#helpers/syntax/ranges"

const CLASS_NODE_TYPES = new Set([ "ClassDeclaration", "ClassExpression" ])
const CLASS_MEMBER_TYPES = new Set([ "MethodDefinition", "PropertyDefinition" ])
const ACCESSOR_KINDS = new Set([ "get", "set" ])
const INSTANCE_CONTEXT_TYPES = new Set([ "PrivateIdentifier", "Super", "ThisExpression" ])
const MEMOIZATION_OPERATORS = new Set([ "??=", "||=" ])
const THIS_FUNCTION_BOUNDARY_TYPES = new Set([ "FunctionDeclaration", "FunctionExpression" ])
const PRIVATE_NAMES_BY_CLASS = new WeakMap()
const enclosingClasses = new NearestAncestor(isClassNode)

export function isClassNode(node) {
  return Boolean(node) && CLASS_NODE_TYPES.has(node.type)
}

export function superclassOf(classNode, bindings) {
  const { superClass } = classNode
  if (isClassNode(superClass)) return superClass
  return superClass?.type === "Identifier" ? bindings.classFor(superClass) : null
}

export function isClassMember(node) {
  return Boolean(node) && CLASS_MEMBER_TYPES.has(node.type)
}

export function isAccessor(member) {
  return Boolean(member) && ACCESSOR_KINDS.has(member.kind)
}

export function isInstanceContext(node) {
  return Boolean(node) && INSTANCE_CONTEXT_TYPES.has(node.type)
}

export function enclosingClass(node) {
  return enclosingClasses.above(node)
}

export function classElementHolding(node, classNode = enclosingClass(node)) {
  if (classNode) {
    for (let current = node; current && current !== classNode; current = current.parent) {
      if (current.parent === classNode.body) return current
    }
  }
  return null
}

export function classDeclaringPrivate(identifier) {
  if (identifier?.type !== "PrivateIdentifier") return null

  for (let current = identifier.parent; current; current = current.parent) {
    if (isClassNode(current) && privateNamesIn(current).has(identifier.name)) return current
  }
  return null
}

export function privateNamesIn(classNode) {
  if (!PRIVATE_NAMES_BY_CLASS.has(classNode)) {
    PRIVATE_NAMES_BY_CLASS.set(classNode, new Set(classNode.body.body
      .map((member) => member.key)
      .filter((key) => key?.type === "PrivateIdentifier")
      .map((key) => key.name)))
  }
  return PRIVATE_NAMES_BY_CLASS.get(classNode)
}

export function isThisMember(node) {
  return Boolean(node) && node.type === "MemberExpression" && node.object.type === "ThisExpression"
}

export function directMemberOf(node) {
  const { parent } = node
  return parent?.type === "MemberExpression" && parent.object === node ? parent : null
}

export function isMemoization(node) {
  return Boolean(node) && node.type === "AssignmentExpression"
    && MEMOIZATION_OPERATORS.has(node.operator) && isThisMember(node.left)
}

export function isLexicalThisOf(node, functionNode) {
  return new LexicalThis(node, functionNode).belongsToFunction
}

export function staticMemberKeyOf(member) {
  return new StaticMemberKey(member).value
}

export function staticAccessKeyOf(member) {
  return member?.type === "MemberExpression" ? staticMemberKeyOf(member) : null
}

export function memberName(member) {
  const key = staticMemberKeyOf(member)
  return key ? displayNameOf(key) : null
}

export function calleeMemberName(callee) {
  return memberName(callee)
}

export function propertyNameOf(node) {
  return staticMemberKeyOf(node)?.name ?? ""
}

export function thisMemberKeyOf(member) {
  return new ThisMember(member).key
}

export function boundThisMemberKeyOf(call) {
  return new ThisBindCall(call).memberKey
}

class LexicalThis {
  #node
  #functionNode

  constructor(node, functionNode) {
    this.#node = node
    this.#functionNode = functionNode
  }

  get belongsToFunction() {
    for (let current = this.#node.parent; current; current = current.parent) {
      const { relation } = new ThisBoundary(current, this.#node, this.#functionNode)
      if (relation !== null) return relation
    }
    return false
  }
}

class ThisBoundary {
  #current
  #node
  #functionNode

  constructor(current, node, functionNode) {
    this.#current = current
    this.#node = node
    this.#functionNode = functionNode
  }

  get relation() {
    return this.#current === this.#functionNode || (this.#isRebindingThis ? false : null)
  }

  get #isRebindingThis() {
    return THIS_FUNCTION_BOUNDARY_TYPES.has(this.#current.type) || this.#current.type === "StaticBlock"
      || this.#isFieldValue || this.#isClassBody
  }

  get #isFieldValue() {
    return this.#current.type === "PropertyDefinition" && !contains(this.#current.key, this.#node)
  }

  get #isClassBody() {
    return isClassNode(this.#current) && !this.#isEvaluatedOutsideClass
  }

  // A class's heritage and computed keys use the surrounding `this`; member bodies and field values bind the class's.
  get #isEvaluatedOutsideClass() {
    return contains(this.#current.superClass, this.#node)
      || this.#isInsideComputedKey
  }

  get #isInsideComputedKey() {
    const member = classElementHolding(this.#node, this.#current)
    return Boolean(member?.computed) && contains(member.key, this.#node)
  }
}

class StaticMemberKey {
  #member

  constructor(member) {
    this.#member = member
  }

  get value() {
    const name = this.#name
    return name === null ? null : { name, node: this.#node }
  }

  get #name() {
    if (!this.#member.computed && isNamedKey(this.#node)) return this.#node.name
    if (this.#node?.type === "Literal") return this.#node.regex ? null : getStringIfConstant(this.#node)
    return isStaticTemplateLiteral(this.#node) ? getStringIfConstant(this.#node) : null
  }

  get #node() {
    return this.#member.key ?? this.#member.property
  }
}

function isNamedKey(key) {
  return key?.type === "Identifier" || key?.type === "PrivateIdentifier"
}

function displayNameOf(key) {
  return key.node.type === "PrivateIdentifier" ? `#${key.name}` : key.name
}

class ThisMember {
  #member

  constructor(member) {
    this.#member = member
  }

  get key() {
    return this.#isDirect ? staticMemberKeyOf(this.#member) : null
  }

  get #isDirect() {
    return isThisMember(this.#member) && !this.#member.optional
  }
}

class ThisBindCall {
  #call

  constructor(call) {
    this.#call = call
  }

  get memberKey() {
    return this.#isExact ? thisMemberKeyOf(this.#call.callee.object) : null
  }

  get #isExact() {
    return this.#isCall && this.#hasUnchainedShape
  }

  get #isCall() {
    return this.#call?.type === "CallExpression"
  }

  get #hasUnchainedShape() {
    return !this.#call.optional && this.#hasBindShape
  }

  get #hasBindShape() {
    return this.#hasSingleThisArgument && this.#isBindOnThisMember
  }

  get #hasSingleThisArgument() {
    return this.#call.arguments.length === 1 && this.#call.arguments[0].type === "ThisExpression"
  }

  get #isBindOnThisMember() {
    return this.#call.callee.type === "MemberExpression" && this.#isPlainBindMember
  }

  get #isPlainBindMember() {
    return !this.#call.callee.optional && this.#hasBindNameAndReceiver
  }

  get #hasBindNameAndReceiver() {
    return calleeMemberName(this.#call.callee) === "bind"
      && Boolean(thisMemberKeyOf(this.#call.callee.object))
  }
}
