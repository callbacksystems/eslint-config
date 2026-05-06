// A method, getter, or function-valued field that returns a value should be named for that value ("total",
// "userFor(id)"), not the imperative action ("computeTotal"). Standalone functions are left alone: a named function
// reads as a unit of behavior and may legitimately do something. We flag a name that leads with a producer verb yet
// only *delivers*: returns a value and changes no state. One that *does* something (assigns state, calls a mutator,
// iterates for effect) earns its verb, even named "createUser"; construction is delivery, so a pure `new X(args)`
// factory is flagged. The bare verb alone (`fetch`, `get`) is left alone: with no noun there is nothing to rename it
// to, so only compounds (`fetchData`) and phrases (`findInScope`) are flagged. No-arg names suggest the bare noun; with
// args we only flag, since the relator is too contextual to pick.
//
// The verb list (`#helpers/strings/producer_verbs`) is curated, not lexical: taggers over-flag (`count`, `name` read as
// verbs), verb/noun lexicons under-flag (`get`, `find`, `build` are also nouns).
//
// A `get` is the plainest case: the author already declared the member is a value and then named it for an action.
// `prefer-getter` asks the same of a parameterless method, so the two line up.

import { enclosingClass } from "#helpers/syntax/classes"
import { isFunction, returnsAValue } from "#helpers/syntax/functions"
import { MemberSubject } from "#helpers/classes/member_subject"
import { resolvedMemberKeyOf } from "#helpers/classes/resolved_member_key"
import { FunctionMutations } from "#helpers/flow/function_mutations"
import { StandardPureCall } from "#helpers/flow/standard_pure_call"
import { carriesConnector, leadingWordOf, leadsWithConnector, uncapitalize } from "#helpers/strings/naming"
import { isProducerVerb } from "#helpers/strings/producer_verbs"
import { reportProblem } from "#helpers/eslint/report"
import { BindingResolver } from "#helpers/scope/binding_resolver"
import { NearestAncestor } from "#helpers/syntax/nearest_ancestor"

const FACT_OWNERS = new NearestAncestor((node) => isFunction(node)
  && !(node.parent?.type === "CallExpression" && node.parent.callee === node))

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Name value-returning methods declaratively, not for the imperative action" },
    schema: [],
    messages: {
      imperativeName: "Rename `{{name}}` to `{{suggestion}}`: name it for the value, not the action `{{verb}}`.",
      imperativeNameRelate: "Rename `{{name}}` for the value, related to its argument, not the action `{{verb}}`.",
      imperativeNameBare: "Rename `{{name}}`: it names the imperative `{{verb}}` action, not the value it returns."
    }
  },
  create(context) {
    const mutations = new FunctionIndex(context.sourceCode)
    const facts = new NamingFacts(mutations, new BindingResolver(context.sourceCode))
    return {
      MethodDefinition: (node) => reportProblem(context, new Producer(node, { facts, mutations })),
      PropertyDefinition: (node) => reportProblem(context, new Producer(node, { facts, mutations }))
    }
  }
}

class FunctionIndex {
  #bindings
  #cachedMutations
  #facts = new WeakMap()
  #sourceCode

  constructor(sourceCode) {
    this.#bindings = new BindingResolver(sourceCode)
    this.#sourceCode = sourceCode
  }

  isPureFrom(functionNode) {
    return this.#mutations.isPureFrom(functionNode)
  }

  hasBuiltCollaboratorIn(functionNode) {
    return this.#factsOf(functionNode).hasBuiltCollaborator
  }

  hasCallWithIn(verb, functionNode) {
    return this.#factsOf(functionNode).hasCallWith(verb)
  }

  get #mutations() {
    return this.#cachedMutations ??= new FunctionMutations(this.#sourceCode, {
      inspectContext: (context) => this.#addSourceFact(context)
    })
  }

  #addSourceFact({ node, functionNode }) {
    if (functionNode) this.#factsFor(FACT_OWNERS.of(functionNode) ?? functionNode).add(node)
  }

  #factsFor(functionNode) {
    if (!this.#facts.has(functionNode)) {
      this.#facts.set(functionNode, new FunctionSourceFacts(this.#bindings))
    }
    return this.#facts.get(functionNode)
  }

  #factsOf(functionNode) {
    return this.#facts.get(functionNode) ?? FunctionSourceFacts.empty
  }
}

class FunctionSourceFacts {
  static empty = new FunctionSourceFacts(null)

  hasBuiltCollaborator = false

  #bindings
  #callsByVerb = new Set()

  constructor(bindings) {
    this.#bindings = bindings
  }

  add(node) {
    if (readsABuiltCollaborator(node)) this.hasBuiltCollaborator = true

    const name = node.type === "CallExpression" && !new StandardPureCall(node, this.#bindings).isPure
      ? calledNameOf(node.callee, this.#bindings)
      : null
    if (name) this.#callsByVerb.add(leadingWordOf(name))
  }

  hasCallWith(verb) {
    return this.#callsByVerb.has(verb)
  }
}

function readsABuiltCollaborator(node) {
  return node.type === "MemberExpression" && node.object.type === "NewExpression"
}

// `JSON.parse` shares a word with `parseConfig` and says nothing about it, so only what the file owns counts.
function calledNameOf(callee, bindings) {
  if (callee.type === "Identifier") return callee.name

  return isOwnCallee(callee) ? resolvedMemberKeyOf(callee, bindings)?.name ?? null : null
}

function isOwnCallee(callee) {
  return callee.type === "MemberExpression" && callee.object.type === "ThisExpression"
}

class NamingFacts {
  #classes = new WeakMap()
  #functions = new WeakMap()
  #index
  #bindings

  constructor(index, bindings) {
    this.#index = index
    this.#bindings = bindings
  }

  subjectOf(node) {
    return new MemberSubject(node, this.#bindings)
  }

  forFunction(functionNode) {
    if (!this.#functions.has(functionNode)) {
      this.#functions.set(functionNode, new FunctionFacts(functionNode, this.#index))
    }

    return this.#functions.get(functionNode)
  }

  hasSiblingNamed(name, member) {
    const classNode = enclosingClass(member)
    if (!this.#classes.has(classNode)) {
      this.#classes.set(classNode, new ClassMemberNames(classNode, this.#bindings))
    }

    return this.#classes.get(classNode).includes(name, member)
  }
}

class FunctionFacts {
  #functionNode
  #index

  constructor(functionNode, index) {
    this.#functionNode = functionNode
    this.#index = index
  }

  get hasBuiltCollaborator() {
    return this.#index.hasBuiltCollaboratorIn(this.#functionNode)
  }

  hasCallWith(verb) {
    return this.#index.hasCallWithIn(verb, this.#functionNode)
  }
}

class ClassMemberNames {
  #bindings
  #instance = new VisibilityMemberNames()
  #static = new VisibilityMemberNames()

  constructor(classNode, bindings) {
    this.#bindings = bindings
    classNode.body.body.forEach((member) => this.#add(member))
  }

  includes(name, member) {
    const key = resolvedMemberKeyOf(member, this.#bindings)
    return Boolean(key) && this.#namesFor(member.static).has(name, { isPrivate: isPrivateKey(key) })
  }

  #add(member) {
    const key = resolvedMemberKeyOf(member, this.#bindings)
    if (typeof key?.name === "string") this.#namesFor(member.static).add(key.name, { isPrivate: isPrivateKey(key) })
  }

  #namesFor(isStatic) {
    return isStatic ? this.#static : this.#instance
  }
}

class VisibilityMemberNames {
  #private = new Set()
  #public = new Set()

  add(name, { isPrivate }) {
    this.#namesFor(isPrivate).add(name)
  }

  has(name, { isPrivate }) {
    return this.#namesFor(isPrivate).has(name)
  }

  #namesFor(isPrivate) {
    return isPrivate ? this.#private : this.#public
  }
}

function isPrivateKey(key) {
  return key.node.type === "PrivateIdentifier"
}

class Producer {
  #facts
  #mutations
  #subject

  constructor(node, { facts, mutations }) {
    this.#facts = facts
    this.#mutations = mutations
    this.#subject = facts.subjectOf(node)
  }

  get problem() {
    return this.#isOffense
      ? { node: this.#subject.nameNode, messageId: this.#messageId, data: this.#data }
      : null
  }

  get #isOffense() {
    return this.#subject.isEligible && this.#isImperativeProducer && this.#deliversOnly && !this.#isExempt
  }

  // The bare verb (`fetch`) is allowed, since there is no noun to rename it to.
  get #isImperativeProducer() {
    return isProducerVerb(this.#verb) && this.#subject.name !== this.#verb
  }

  get #verb() {
    return leadingWordOf(this.#subject.name)
  }

  get #deliversOnly() {
    const { functionNode } = this.#subject
    return returnsAValue(functionNode) && this.#mutations.isPureFrom(functionNode)
  }

  get #isExempt() {
    return this.#asksABuiltCollaborator || this.#delegatesWithinVerbFamily || this.#sharesNounWithSibling
  }

  // `new Commenter(card).comment` gives no view of what happens inside.
  get #asksABuiltCollaborator() {
    return this.#functionFacts.hasBuiltCollaborator
  }

  get #functionFacts() {
    return this.#facts.forFunction(this.#subject.functionNode)
  }

  // `formatMoney` calling `formatShort` mirrors a real operation of that name, and renaming it breaks the family.
  get #delegatesWithinVerbFamily() {
    return this.#functionFacts.hasCallWith(this.#verb)
  }

  // `buildPrices` beside a `get prices()` is that value's builder, so the suggestion is already taken.
  get #sharesNounWithSibling() {
    return Boolean(this.#noun) && this.#facts.hasSiblingNamed(this.#noun, this.#subject.nameNode.parent)
  }

  // Null for a prepositional phrase that names nothing on its own ("findInBlock").
  get #noun() {
    const noun = uncapitalize(this.#subject.name.slice(this.#verb.length))
    return leadsWithConnector(noun) ? null : noun
  }

  get #messageId() {
    return this.#noun ? this.#valueMessageId : "imperativeNameBare"
  }

  get #valueMessageId() {
    return this.#needsRelator ? "imperativeNameRelate" : "imperativeName"
  }

  // A bare noun ("user(id)") does not relate to its argument, unless the name carries a connector ("userById").
  get #needsRelator() {
    return Boolean(this.#noun) && this.#hasArguments && !carriesConnector(this.#noun)
  }

  get #hasArguments() {
    return this.#subject.functionNode.params.length > 0
  }

  get #data() {
    return { verb: this.#verb, name: this.#subject.name, suggestion: this.#suggestion ?? "" }
  }

  get #suggestion() {
    return this.#needsRelator ? null : this.#noun
  }
}
