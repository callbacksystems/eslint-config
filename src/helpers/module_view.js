// Anything the file does not show is taken as leaving, so an instance is kept only where the code proves it.

import { readReferences } from "#helpers/ast"
import { isClassNode, isThisMember } from "#helpers/classes"
import { exportedBindingsIn } from "#helpers/exports"
import { isFunction } from "#helpers/functions"

const MEMBER_TYPES = new Set([ "MethodDefinition", "PropertyDefinition" ])
const CARRIED_THROUGH = new Set([
  "ConditionalExpression", "LogicalExpression", "ChainExpression", "AwaitExpression",
  "ArrayExpression", "ObjectExpression", "Property", "SpreadElement"
])
const STRUCTURAL_LANDINGS = new Set([
  "ExpressionStatement", "PropertyDefinition", "MemberExpression", "AssignmentExpression", "NewExpression"
])
const MAPPING_METHODS = new Set([ "map", "flatMap", "reduce" ])
const CONSUMING_METHODS = new Set([ "every", "filter", "find", "findLast", "forEach", "some", "toSorted" ])

export class ModuleView {
  #cachedExportedNames
  #cachedClassNames
  #cachedFunctionNames

  constructor(sourceCode) {
    this.sourceCode = sourceCode
  }

  keepsInstancesOf(classNode) {
    return this.#referencesTo(classNode).every((identifier) => new ClassUse(identifier, this).staysHere)
  }

  exports(name) {
    return this.#exportedNames.has(name)
  }

  declaresClass(name) {
    return this.#classNames.has(name)
  }

  declaresFunction(name) {
    return this.#functionNames.has(name)
  }

  #referencesTo(node) {
    return this.sourceCode.getDeclaredVariables(node)
      .flatMap((variable) => variable.references)
      .map((reference) => reference.identifier)
  }

  get #exportedNames() {
    return this.#cachedExportedNames ??= new Set(exportedBindingsIn(this.sourceCode).map((binding) => binding.name))
  }

  get #classNames() {
    return this.#cachedClassNames ??= this.#declaredNamesOf("ClassDeclaration")
  }

  #declaredNamesOf(type) {
    return new Set(this.sourceCode.ast.body.filter((statement) => statement.type === type).map(nameOf))
  }

  get #functionNames() {
    return this.#cachedFunctionNames ??= this.#declaredNamesOf("FunctionDeclaration")
  }
}

// A class passed around as a value could be built anywhere, while one extended here has its subclass in this file.
class ClassUse {
  #identifier
  #view

  constructor(identifier, view) {
    this.#identifier = identifier
    this.#view = view
  }

  get staysHere() {
    return this.#isConstruction ? new Landing(this.#identifier.parent, this.#view).staysHere : this.#isSuperclass
  }

  get #isConstruction() {
    const { parent } = this.#identifier
    return parent.type === "NewExpression" && parent.callee === this.#identifier
  }

  get #isSuperclass() {
    const { parent } = this.#identifier
    return isClassNode(parent) && parent.superClass === this.#identifier
  }
}

class Landing {
  #node
  #view
  #visited

  constructor(node, view, visited = new Set()) {
    this.#node = node
    this.#view = view
    this.#visited = visited
  }

  get staysHere() {
    return this.#visited.has(this.#node) || this.#landsHere
  }

  get #landsHere() {
    const { parent } = this.#node
    this.#visited.add(this.#node)
    return CARRIED_THROUGH.has(parent.type) ? this.#carriedBy(parent) : this.#landsIn(parent)
  }

  #carriedBy(parent) {
    return new Landing(parent, this.#view, this.#visited).staysHere
  }

  #landsIn(parent) {
    return STRUCTURAL_LANDINGS.has(parent.type) ? this.#staysInStructure(parent) : this.#staysThroughFlow(parent)
  }

  #staysInStructure(parent) {
    switch (parent.type) {
      case "ExpressionStatement": return true
      case "PropertyDefinition": return true
      case "MemberExpression": return parent.object === this.#node
      case "AssignmentExpression": return parent.right === this.#node && isThisMember(parent.left)
      default: return parent.callee !== this.#node && this.#view.declaresClass(nameOf(parent.callee))
    }
  }

  #staysThroughFlow(parent) {
    switch (parent.type) {
      case "VariableDeclarator": return this.#staysThroughVariable(parent)
      case "CallExpression": return this.#staysAsArgumentOf(parent)
      case "ReturnStatement": return this.#staysReturnedFrom(enclosingFunctionOf(parent))
      case "ArrowFunctionExpression": return parent.body === this.#node && this.#staysReturnedFrom(parent)
      default: return false
    }
  }

  #staysThroughVariable(declarator) {
    return declarator.id.type === "Identifier" && readReferences(this.#view.sourceCode, declarator)
      .every((reference) => new Landing(reference.identifier, this.#view, this.#visited).staysHere)
  }

  #staysAsArgumentOf(call) {
    return call.callee !== this.#node && call.callee.type === "Identifier"
      && this.#view.declaresFunction(call.callee.name)
  }

  #staysReturnedFrom(functionNode) {
    return new Producer(functionNode, this.#view).keepsReturns
      || (isCallbackOf(functionNode, MAPPING_METHODS) && this.#carriedBy(functionNode.parent))
  }
}

function nameOf(node) {
  if (node?.type === "Identifier") return node.name

  return node?.id?.type === "Identifier" ? node.id.name : null
}

function enclosingFunctionOf(node) {
  return isFunction(node) ? node : enclosingFunctionOf(node.parent)
}

class Producer {
  #node
  #view

  constructor(node, view) {
    this.#node = node
    this.#view = view
  }

  get keepsReturns() {
    return this.#isLocalDeclaration || this.#isLocalMember || isCallbackOf(this.#node, CONSUMING_METHODS)
  }

  get #isLocalDeclaration() {
    return this.#node.type === "FunctionDeclaration" && !this.#view.exports(nameOf(this.#node))
  }

  get #isLocalMember() {
    const { parent } = this.#node
    return MEMBER_TYPES.has(parent.type) && !this.#view.exports(nameOf(parent.parent.parent))
  }
}

function isCallbackOf(functionNode, methods) {
  const { parent } = functionNode
  return parent.type === "CallExpression" && parent.arguments.includes(functionNode)
    && parent.callee.type === "MemberExpression" && methods.has(nameOf(parent.callee.property))
}
