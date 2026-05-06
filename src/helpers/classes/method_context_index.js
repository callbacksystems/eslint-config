import { nodesIn } from "#helpers/syntax/ast"
import { ClassThisBindings } from "#helpers/classes/class_this_bindings"
import { isInstanceContext, isThisMember } from "#helpers/syntax/classes"
import { memberWriteTargetsIn } from "#helpers/classes/member_write_targets"

const INDEXES_BY_ROOT = new WeakMap()

export class MethodContextIndex {
  #assignmentCounts = new WeakMap()
  #bindings
  #methodsWithInstanceContext = new WeakSet()

  static for(root) {
    if (!INDEXES_BY_ROOT.has(root)) INDEXES_BY_ROOT.set(root, new MethodContextIndex(root))
    return INDEXES_BY_ROOT.get(root)
  }

  constructor(root) {
    this.#bindings = new ClassThisBindings(root)
    for (const node of nodesIn(root)) this.#index(node)
  }

  hasInstanceReferenceIn(methodFunction) {
    return this.#methodsWithInstanceContext.has(methodFunction)
  }

  fieldAssignmentCountIn(methodFunction) {
    return this.#assignmentCounts.get(methodFunction) ?? 0
  }

  #index(node) {
    if (isInstanceContext(node)) this.#indexInstanceReference(node)
    if (isPlainAssignment(node)) this.#indexAssignment(node)
  }

  #indexInstanceReference(node) {
    const methodFunction = this.#bindings.methodFunctionOf(node)
    if (methodFunction) this.#methodsWithInstanceContext.add(methodFunction)
  }

  #indexAssignment(assignment) {
    for (const target of memberWriteTargetsIn(assignment.left)) this.#indexAssignmentTarget(target)
  }

  #indexAssignmentTarget(target) {
    if (isThisMember(target)) {
      const methodFunction = this.#bindings.methodFunctionOf(target.object)
      if (this.#bindings.isExecutedBy(target.object, methodFunction)) {
        const count = this.#assignmentCounts.get(methodFunction) ?? 0
        this.#assignmentCounts.set(methodFunction, count + 1)
      }
    }
  }
}

function isPlainAssignment(node) {
  return node.type === "AssignmentExpression" && node.operator === "="
}
