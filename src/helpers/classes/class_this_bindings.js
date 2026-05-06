import { childNodesOf, pushReversed } from "#helpers/syntax/ast"
import { isClassNode, isInstanceContext } from "#helpers/syntax/classes"
import { isInlineFunction } from "#helpers/syntax/functions"

const FUNCTION_TYPES = new Set([ "FunctionDeclaration", "FunctionExpression" ])
const BINDING_STORES = new WeakMap()

export class ClassThisBindings {
  #byClass
  #byExpression

  constructor(root) {
    const cached = BINDING_STORES.get(root)
    const store = cached ?? new ClassThisBindingStore()
    this.#byClass = store.byClass
    this.#byExpression = store.byExpression
    if (!cached) {
      new ClassThisIndexer(root, this).index()
      BINDING_STORES.set(root, store)
    }
  }

  expressionsOf(classNode) {
    return this.#byClass.get(classNode) ?? []
  }

  isInstanceOf(expression, classNode) {
    const binding = this.#byExpression.get(expression)
    return binding?.classNode === classNode && binding.isInstance
  }

  classOf(expression) {
    return this.#byExpression.get(expression)?.classNode ?? null
  }

  instanceClassOf(expression) {
    const binding = this.#byExpression.get(expression)
    return binding?.isInstance ? binding.classNode : null
  }

  methodFunctionOf(expression) {
    return this.#byExpression.get(expression)?.methodFunction ?? null
  }

  isExecutedBy(expression, methodFunction) {
    return Boolean(methodFunction)
      && this.#byExpression.get(expression)?.executionFunction === methodFunction
  }

  add(expression, binding) {
    if (binding) {
      if (expression.type === "ThisExpression") {
        if (!this.#byClass.has(binding.classNode)) this.#byClass.set(binding.classNode, [])
        this.#byClass.get(binding.classNode).push(expression)
      }
      this.#byExpression.set(expression, binding)
    }
  }
}

class ClassThisBindingStore {
  byClass = new WeakMap()
  byExpression = new WeakMap()
}

class ClassThisIndexer {
  #bindings
  #pending

  constructor(root, bindings) {
    this.#bindings = bindings
    this.#pending = [ new ThisContext(root) ]
  }

  index() {
    while (this.#pending.length > 0) this.#indexNext()
  }

  #indexNext() {
    const context = this.#pending.pop()
    if (isInstanceContext(context.node)) this.#bindings.add(context.node, context.binding)
    pushReversed(this.#pending, context.children)
  }
}

class ThisContext {
  constructor(node, { classNode = null, binding = null, isClassFunction = false } = {}) {
    this.node = node
    this.classNode = classNode
    this.binding = binding
    this.isClassFunction = isClassFunction
  }

  get children() {
    return childNodesOf(this.node).map((child) => new ChildThisContext({ child, parent: this }).value)
  }
}

class ChildThisContext {
  #child
  #parent

  constructor({ child, parent }) {
    this.#child = child
    this.#parent = parent
  }

  get value() {
    if (isClassNode(this.#parent.node)) return this.#classChild
    if (this.#parent.node.type === "MethodDefinition") return this.#methodChild
    if (this.#parent.node.type === "PropertyDefinition") return this.#fieldChild
    if (this.#parent.node.type === "StaticBlock") return this.#classBindingFor(false)
    if (this.#isRegularFunctionBoundary) return new ThisContext(this.#child)
    if (this.#isDeferredArrow) return this.#withoutExecution
    return this.#inherited
  }

  get #classChild() {
    return this.#child === this.#parent.node.body
      ? new ThisContext(this.#child, { classNode: this.#parent.node, binding: this.#parent.binding })
      : this.#inherited
  }

  get #inherited() {
    return new ThisContext(this.#child, { classNode: this.#parent.classNode, binding: this.#parent.binding })
  }

  get #methodChild() {
    if (this.#child === this.#parent.node.value) {
      return this.#classBindingFor(!this.#parent.node.static, {
        isClassFunction: true,
        methodFunction: this.#child,
        executionFunction: this.#child
      })
    }
    return this.#isUnevaluatedKey ? this.#withoutBinding : this.#inherited
  }

  #classBindingFor(isInstance, { isClassFunction = false, methodFunction = null, executionFunction = null } = {}) {
    return new ThisContext(this.#child, {
      classNode: this.#parent.classNode,
      binding: { classNode: this.#parent.classNode, executionFunction, isInstance, methodFunction },
      isClassFunction
    })
  }

  get #isUnevaluatedKey() {
    return this.#child === this.#parent.node.key && !this.#parent.node.computed
  }

  get #withoutBinding() {
    return new ThisContext(this.#child, { classNode: this.#parent.classNode })
  }

  get #fieldChild() {
    if (this.#child === this.#parent.node.value) return this.#classBindingFor(!this.#parent.node.static)
    return this.#isUnevaluatedKey ? this.#withoutBinding : this.#inherited
  }

  get #isRegularFunctionBoundary() {
    return FUNCTION_TYPES.has(this.#parent.node.type) && !this.#parent.isClassFunction
  }

  get #isDeferredArrow() {
    return this.#parent.node.type === "ArrowFunctionExpression" && !isInlineFunction(this.#parent.node)
  }

  get #withoutExecution() {
    return new ThisContext(this.#child, {
      classNode: this.#parent.classNode,
      binding: this.#parent.binding ? { ...this.#parent.binding, executionFunction: null } : null
    })
  }
}
