// A private method, getter or module function that only forwards to another call adds indirection without value. One
// that passes its own parameters or fields straight through (`return other(x)`, `return FolderTree.from(x)`) should be
// inlined. A getter that forwards the class's own fields to a module-local function (`return build(this.#a, this.#b)`)
// means that function is really a method of this class, so move the logic in. Handing back a constant of the same name
// (`get #message() { return MESSAGE }`) is the same indirection, since the constant already carries the name.
//
// Public methods and exported functions are API and are left alone, and so is a method predicate (`isValid`), which is
// a semantic facade on its object. A free predicate function is just callback plumbing, so it counts.

import { CalleeResolver } from "#helpers/scope/callee_resolver"
import { BindingResolver } from "#helpers/scope/binding_resolver"
import { enclosingClass, isThisMember, staticMemberKeyOf } from "#helpers/syntax/classes"
import { FunctionSubject } from "#helpers/functions/function_subject"
import { soleStatementOf } from "#helpers/syntax/functions"
import { MethodSubject } from "#helpers/classes/method_subject"
import { isPascalCase, screamingSnakeOf } from "#helpers/strings/naming"
import { ModuleView } from "#helpers/flow/module_view"
import { PrivateMemberReads } from "#helpers/classes/private_member_reads"
import { reportProblem } from "#helpers/eslint/report"
import { PredicateFunctions } from "#helpers/flow/predicate_functions"

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
    const analysis = new WrapperAnalysis(context.sourceCode)
    const reads = new ClassMemberReads(context.sourceCode.ast)
    const view = new ModuleView(context.sourceCode)
    return {
      MethodDefinition: (node) => reportProblem(context,
        new Wrapper(new WrapperMethodSubject(node, { analysis, reads }), analysis)),
      FunctionDeclaration: (node) => reportProblem(context,
        new Wrapper(new ForwardingFunctionSubject(node, view), analysis))
    }
  }
}

class WrapperAnalysis {
  #callees
  #bindings
  #predicates

  constructor(sourceCode) {
    this.#callees = new CalleeResolver(sourceCode)
    this.#bindings = BindingResolver.for(sourceCode)
    this.#predicates = new PredicateFunctions(sourceCode)
  }

  functionFor(callee) {
    return this.#callees.functionFor(callee)
  }

  constantInitializerFor(identifier) {
    return this.#bindings.constantInitializerFor(identifier)
  }

  isPredicate(functionNode, name) {
    return this.#predicates.includes(functionNode, name)
  }
}

class ClassMemberReads {
  #reads

  constructor(root) {
    this.#reads = new PrivateMemberReads(root)
  }

  countOf(member, name) {
    return this.#reads.countOf(enclosingClass(member), name.slice(1))
  }
}

class Wrapper {
  #subject
  #analysis

  constructor(subject, analysis) {
    this.#subject = subject
    this.#analysis = analysis
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
    return Boolean(call) && this.#isForwardedCallee(call.callee) && this.#areAllArgumentsPassed(call.arguments)
  }

  get #forwardedCall() {
    return isReturnCall(this.#soleStatement) ? this.#soleStatement.argument : null
  }

  get #soleStatement() {
    return soleStatementOf(this.#subject.body)
  }

  #isForwardedCallee(callee) {
    const target = this.#analysis.functionFor(callee)
    return target !== this.#subject.functionNode
      && (this.#subject.isForwardedCallee(callee) || (callee.type === "Identifier" && Boolean(target)))
  }

  #areAllArgumentsPassed(callArguments) {
    return new ForwardedArguments(this.#subject.params, callArguments).areComplete
  }

  #problemFor(messageId) {
    const data = { name: this.#subject.name, constant: this.#returnedConstant }
    return { node: this.#subject.nameNode, messageId, data }
  }

  get #returnedConstant() {
    return this.#returnedConstantIdentifier?.name ?? null
  }

  get #returnedConstantIdentifier() {
    const statement = this.#soleStatement
    return isReturnConstant(statement) ? statement.argument : null
  }

  get #isRedundantConstant() {
    return this.#subject.isEligible && this.#isSameNamedConstant
  }

  // A member returning a constant named for something else is a template method a subclass may override.
  get #isSameNamedConstant() {
    return Boolean(this.#analysis.constantInitializerFor(this.#returnedConstantIdentifier))
      && this.#returnedConstant === screamingSnakeOf(this.#subject.name.replace("#", ""))
  }
}

function isReturnCall(statement) {
  return statement?.type === "ReturnStatement" && statement.argument?.type === "CallExpression"
}

class ForwardedArguments {
  #parameters
  #arguments
  #cachedParameterNames
  #cachedPassedNames

  constructor(parameters, callArguments) {
    this.#parameters = parameters
    this.#arguments = callArguments
  }

  get areComplete() {
    return this.#hasSimpleDistinctParameters && this.#hasOnlyDirectArguments && this.#isEachParameterPassedInOrder
  }

  get #hasSimpleDistinctParameters() {
    return this.#parameters.every(isIdentifier) && new Set(this.#parameterNames).size === this.#parameterNames.length
  }

  get #parameterNames() {
    return this.#cachedParameterNames ??= this.#parameters.map((parameter) => parameter.name)
  }

  get #hasOnlyDirectArguments() {
    const parameters = new Set(this.#parameterNames)
    return this.#arguments.every((argument) => new ForwardedArgument(argument, parameters).isDirect)
  }

  get #isEachParameterPassedInOrder() {
    return this.#passedNames.length === this.#parameterNames.length
      && this.#passedNames.every((name, index) => name === this.#parameterNames[index])
  }

  get #passedNames() {
    return this.#cachedPassedNames ??= this.#arguments.filter(isIdentifier).map((argument) => argument.name)
  }
}

function isIdentifier(node) {
  return node.type === "Identifier"
}

class ForwardedArgument {
  #node
  #parameters

  constructor(node, parameters) {
    this.#node = node
    this.#parameters = parameters
  }

  get isDirect() {
    return this.#isDirectMember || this.#isParameter
  }

  get #isDirectMember() {
    return isThisMember(this.#node) && Boolean(staticMemberKeyOf(this.#node))
  }

  get #isParameter() {
    return isIdentifier(this.#node) && this.#parameters.has(this.#node.name)
  }
}

function isReturnConstant(statement) {
  return statement?.type === "ReturnStatement" && statement.argument?.type === "Identifier"
}

class WrapperMethodSubject extends MethodSubject {
  #analysis
  #reads

  constructor(node, { analysis, reads }) {
    super(node)
    this.#analysis = analysis
    this.#reads = reads
  }

  get isEligible() {
    return this.#isPrivateNonPredicate && !this.#isReusedGetter
  }

  // A getter forwarding to a member of its own names a value, so only a method counts as forwarding to one.
  isForwardedCallee(callee) {
    return this.kind === "method" && isOwnCallee(callee)
  }

  get #isPrivateNonPredicate() {
    return (this.kind === "method" || this.kind === "get") && this.isPrivate
      && !this.isAsync && !this.isGenerator
      && !this.#analysis.isPredicate(this.functionNode, this.nameNode.name)
  }

  // A getter read from several places is the single spelling of a value, and inlining it would repeat the call at every
  // reader.
  get #isReusedGetter() {
    return this.kind === "get" && this.#readCount > 1
  }

  get #readCount() {
    return this.#reads.countOf(this.definitionNode, this.name)
  }
}

function isOwnCallee(callee) {
  return callee.type === "Identifier" || (callee.type === "MemberExpression" && callee.object.type === "ThisExpression")
}

class ForwardingFunctionSubject extends FunctionSubject {
  // A namespace call (`FolderTree.from`, `Object.keys`) is the same alias as a bare call, while a member of a parameter
  // is the whole point of the function.
  isForwardedCallee(callee) {
    return isPascalCaseMember(callee)
  }
}

function isPascalCaseMember(callee) {
  return callee.type === "MemberExpression" && isPascalCase(callee.object.name)
}
