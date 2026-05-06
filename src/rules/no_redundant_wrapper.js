// A private method, getter or module function that only forwards to another call adds indirection without value. One
// that passes its own parameters or fields straight through (`return other(x)`, `return FolderTree.from(x)`) should be
// inlined. A getter that forwards the class's own fields to a module-local function (`return build(this.#a, this.#b)`)
// means that function is really a method of this class, so move the logic in. Handing back a constant of the same name
// (`get #message() { return MESSAGE }`) is the same indirection, since the constant already carries the name.
//
// Public methods and exported functions are API and are left alone, and so is a method predicate (`isValid`), which is
// a semantic facade on its object. A free predicate function is just callback plumbing, so it counts.

import { countMatching } from "#helpers/ast"
import { calleeMemberName, enclosingClass, isThisMember, memberName } from "#helpers/classes"
import { identifierParameterNames, soleStatementOf } from "#helpers/functions"
import { isBooleanName, isPascalCase, screamingSnakeOf } from "#helpers/naming"
import { reportProblem } from "#helpers/report"

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Disallow private methods, getters or module functions that only forward a call or constant" },
    schema: [],
    messages: {
      redundantWrapper: "`{{name}}` only forwards to another call. Inline it instead of wrapping.",
      redundantConstant: "`{{name}}` only hands back `{{constant}}`. Read the constant where it is needed."
    }
  },
  create(context) {
    const localFunctions = moduleLocalFunctionsIn(context.sourceCode.ast)
    return {
      MethodDefinition: (node) => reportProblem(context, new Wrapper(new MethodSubject(node), localFunctions)),
      FunctionDeclaration: (node) => reportProblem(context, new Wrapper(new FunctionSubject(node), localFunctions))
    }
  }
}

function moduleLocalFunctionsIn(program) {
  return new Set(program.body.filter((node) => node.type === "FunctionDeclaration").map((node) => node.id.name))
}

class Wrapper {
  #subject
  #localFunctions
  #cachedParameterNames

  constructor(subject, localFunctions) {
    this.#subject = subject
    this.#localFunctions = localFunctions
  }

  get problem() {
    if (this.#isRedundantForward) return this.#problemFor("redundantWrapper")
    if (this.#isRedundantConstant) return this.#problemFor("redundantConstant")

    return null
  }

  get #isRedundantForward() {
    return this.#subject.isEligible && this.#isPureForward
  }

  get #isPureForward() {
    const call = this.#forwardedCall
    return Boolean(call) && this.#countsAsForward(call.callee) && this.#passesEveryArgument(call.arguments)
  }

  get #forwardedCall() {
    return isReturnCall(this.#soleStatement) ? this.#soleStatement.argument : null
  }

  get #soleStatement() {
    return soleStatementOf(this.#subject.body)
  }

  #countsAsForward(callee) {
    return this.#subject.countsAsForward(callee) || this.#isLocalFunction(callee)
  }

  #isLocalFunction(callee) {
    return callee.type === "Identifier" && this.#localFunctions.has(callee.name)
  }

  #passesEveryArgument(callArguments) {
    return callArguments.every((argument) => this.#passesParameter(argument) || isThisMember(argument))
  }

  #passesParameter(argument) {
    return argument.type === "Identifier" && this.#parameterNames.has(argument.name)
  }

  get #parameterNames() {
    return this.#cachedParameterNames ??= identifierParameterNames(this.#subject.params)
  }

  #problemFor(messageId) {
    const data = { name: this.#subject.name, constant: this.#returnedConstant }
    return { node: this.#subject.nameNode, messageId, data }
  }

  get #returnedConstant() {
    const statement = this.#soleStatement
    return isReturnConstant(statement) ? statement.argument.name : null
  }

  get #isRedundantConstant() {
    return this.#subject.isEligible && this.#isSameNamedConstant
  }

  // A member named for something else is a template method, since two subclasses each returning their own constant from
  // `get markerTag()` is polymorphism.
  get #isSameNamedConstant() {
    const returned = this.#returnedConstant
    return Boolean(returned) && returned === screamingSnakeOf(this.#subject.name.replace("#", ""))
  }
}

function isReturnCall(statement) {
  return statement?.type === "ReturnStatement" && statement.argument?.type === "CallExpression"
}

function isReturnConstant(statement) {
  return statement?.type === "ReturnStatement" && statement.argument?.type === "Identifier"
}

class MethodSubject {
  #node

  constructor(node) {
    this.#node = node
  }

  get name() {
    return memberName(this.#node)
  }

  get nameNode() {
    return this.#node.key
  }

  get params() {
    return this.#node.value.params
  }

  get body() {
    return this.#node.value.body
  }

  get isEligible() {
    return this.#isPrivateNonPredicate && !this.#isReusedGetter
  }

  // A method may forward to anything of its own; a getter only counts when it hands the class's state to a local
  // function, which is a method of this class in disguise.
  countsAsForward(callee) {
    return this.#node.kind === "method" && isOwnCallee(callee)
  }

  get #isPrivateNonPredicate() {
    const { key, kind } = this.#node
    return (kind === "method" || kind === "get") && key.type === "PrivateIdentifier" && !isBooleanName(key.name)
  }

  // A getter read from several places is the single spelling of a value, not indirection: inlining it would repeat the
  // call at every reader. A method is not the same, since calling the wrapper costs what calling the original does.
  get #isReusedGetter() {
    return this.#node.kind === "get" && this.#readCount > 1
  }

  get #readCount() {
    return countMatching(enclosingClass(this.#node), (node) => this.#isOwnRead(node))
  }

  #isOwnRead(node) {
    return isThisMember(node) && calleeMemberName(node) === this.name
  }
}

function isOwnCallee(callee) {
  return callee.type === "Identifier" || (callee.type === "MemberExpression" && callee.object.type === "ThisExpression")
}

class FunctionSubject {
  #node

  constructor(node) {
    this.#node = node
  }

  get nameNode() {
    return this.#node.id
  }

  get name() {
    return this.#node.id.name
  }

  get params() {
    return this.#node.params
  }

  get body() {
    return this.#node.body
  }

  get isEligible() {
    return this.#node.parent?.type !== "ExportNamedDeclaration"
  }

  // A named constructor or a namespace call (`FolderTree.from`, `Object.keys`) is the same alias as a bare call. A
  // member of a parameter is not: there the name is the whole point (`alphabetically(left, right)`).
  countsAsForward(callee) {
    return isPascalCaseMember(callee)
  }
}

function isPascalCaseMember(callee) {
  return callee.type === "MemberExpression" && isPascalCase(callee.object.name)
}
