// Resolves a call's callee to the function node it names, within a single file: a bare identifier to a top-level
// function, `this.foo()` / `this.#foo` to the matching member of the call site's enclosing class. Shared by the naming
// rules that follow calls transitively (boolean returns, state mutation) to judge a member by what its helpers do, not
// just its own body. A cross-file (imported) callee is out of reach: its body is unknowable without type information.

import { unwrapExport } from "#helpers/ast"
import { calleeMemberName, enclosingClass, isThisMember, memberName } from "#helpers/classes"
import { isFunction } from "#helpers/functions"

export class CalleeResolver {
  #sourceCode
  #cachedTopLevel
  #membersByClass = new Map()

  constructor(sourceCode) {
    this.#sourceCode = sourceCode
  }

  functionFor(callee) {
    if (callee.type === "Identifier") return this.#topLevel.get(callee.name) ?? null
    if (isThisMember(callee)) return this.#memberFor(callee)

    return null
  }

  get #topLevel() {
    return this.#cachedTopLevel ??= topLevelFunctionsOf(this.#sourceCode.ast)
  }

  #memberFor(callee) {
    const classNode = enclosingClass(callee)
    return classNode ? this.#membersOf(classNode).get(calleeMemberName(callee)) ?? null : null
  }

  #membersOf(classNode) {
    if (!this.#membersByClass.has(classNode)) this.#membersByClass.set(classNode, memberFunctionsOf(classNode))

    return this.#membersByClass.get(classNode)
  }
}

// `export default function () {}` has no id, so no callee can name it.
function topLevelFunctionsOf(ast) {
  return new Map(ast.body
    .map(unwrapExport)
    .filter(isNamedFunctionDeclaration)
    .map((node) => [ node.id.name, node ]))
}

function isNamedFunctionDeclaration(node) {
  return node.type === "FunctionDeclaration" && Boolean(node.id)
}

function memberFunctionsOf(classNode) {
  return new Map(classNode.body.body.filter(isFunctionMember).map((member) => [ memberName(member), member.value ]))
}

function isFunctionMember(member) {
  return (member.type === "MethodDefinition" || member.type === "PropertyDefinition")
    && (member.key.type === "Identifier" || member.key.type === "PrivateIdentifier")
    && isFunction(member.value)
}
