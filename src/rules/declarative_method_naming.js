// A method, getter, or function-valued field that returns a value should be named for that value ("total",
// "userFor(id)"), not the imperative action ("computeTotal"). Standalone functions are left alone: a named function
// reads as a unit of behavior and may legitimately do something. We flag a name that leads with a producer verb yet
// only *delivers*: returns a value and changes no state. One that *does* something (assigns state, calls a mutator,
// iterates for effect) earns its verb, even named "createUser"; construction is delivery, so a pure `new X(args)`
// factory is flagged. The bare verb alone (`fetch`, `get`) is left alone: with no noun there is nothing to rename it
// to, so only compounds (`fetchData`) and phrases (`findInScope`) are flagged. No-arg names suggest the bare noun; with
// args we only flag, since the relator is too contextual to pick.
//
// The verb list (`#helpers/producer-verbs`) is curated, not lexical: taggers over-flag (`count`, `name` read as verbs),
// verb/noun lexicons under-flag (`get`, `find`, `build` are also nouns).
//
// A `get` is the plainest case: the author already declared the member is a value and then named it for an action.
// `prefer-getter` asks the same of a parameterless method, so the two line up.

import { nodesIn } from "#helpers/ast"
import { enclosingClass, memberName, propertyNameOf } from "#helpers/classes"
import { returnsAValue } from "#helpers/functions"
import { CalleeResolver } from "#helpers/callee_resolver"
import { MemberSubject } from "#helpers/member_subject"
import { carriesConnector, leadingWordOf, leadsWithConnector, uncapitalize } from "#helpers/naming"
import { isProducerVerb } from "#helpers/producer_verbs"
import { reportProblem } from "#helpers/report"

// A producer-verb method calling one is doing something, not delivering a value.
const MUTATORS = new Set([
  "push", "pop", "shift", "unshift", "splice", "sort", "reverse", "fill", "copyWithin",
  "set", "add", "delete", "clear", "forEach", "append", "remove", "save", "update", "create", "destroy", "write"
])

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
    const resolver = new CalleeResolver(context.sourceCode)
    return {
      MethodDefinition: (node) => reportProblem(context, new Producer(node, resolver)),
      PropertyDefinition: (node) => reportProblem(context, new Producer(node, resolver))
    }
  }
}

class Producer {
  #subject
  #resolver

  constructor(node, resolver) {
    this.#subject = new MemberSubject(node)
    this.#resolver = resolver
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
    return returnsAValue(functionNode) && !new MutationCheck(this.#resolver).mutatesFrom(functionNode)
  }

  get #isExempt() {
    return this.#asksABuiltCollaborator || this.#delegatesWithinVerbFamily || this.#sharesNounWithSibling
  }

  // `new Commenter(card).comment` gives no view of what happens inside.
  get #asksABuiltCollaborator() {
    return nodesIn(this.#subject.functionNode.body).some(readsABuiltCollaborator)
  }

  // `formatMoney` calling `formatShort` mirrors a real operation of that name, and renaming it breaks the family.
  get #delegatesWithinVerbFamily() {
    return this.#calledNames.some((name) => leadingWordOf(name) === this.#verb)
  }

  get #calledNames() {
    return nodesIn(this.#subject.functionNode.body)
      .filter((node) => node.type === "CallExpression")
      .map((node) => calledNameOf(node.callee))
      .filter(Boolean)
      .toArray()
  }

  // `buildPrices` beside a `get prices()` is that value's builder, so the suggestion is already taken.
  get #sharesNounWithSibling() {
    return Boolean(this.#noun) && this.#siblingNames.includes(this.#noun)
  }

  // Null for a prepositional phrase that names nothing on its own ("findInBlock").
  get #noun() {
    const noun = uncapitalize(this.#subject.name.slice(this.#verb.length))
    return leadsWithConnector(noun) ? null : noun
  }

  get #siblingNames() {
    const node = this.#subject.nameNode.parent
    return enclosingClass(node).body.body.filter((member) => member !== node).map(memberName)
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

class MutationCheck {
  #resolver
  #visited

  constructor(resolver, visited = new Set()) {
    this.#resolver = resolver
    this.#visited = visited
  }

  mutatesFrom(functionNode) {
    return nodesIn(functionNode.body).some((node) => this.#isMutation(node))
  }

  #isMutation(node) {
    return isDirectMutation(node) || this.#resolvesToMutatingCall(node)
  }

  #resolvesToMutatingCall(node) {
    if (node.type !== "CallExpression") return false

    const functionNode = this.#resolver.functionFor(node.callee)
    return Boolean(functionNode) && !this.#visited.has(functionNode)
      && this.#afterVisiting(functionNode).mutatesFrom(functionNode)
  }

  #afterVisiting(functionNode) {
    return new MutationCheck(this.#resolver, new Set([ ...this.#visited, functionNode ]))
  }
}

function isDirectMutation(node) {
  return isMemberAssignment(node) || isMutatorCall(node)
}

function isMemberAssignment(node) {
  return (node.type === "AssignmentExpression" && node.left.type === "MemberExpression")
    || (node.type === "UpdateExpression" && node.argument.type === "MemberExpression")
}

function isMutatorCall(node) {
  return node.type === "CallExpression"
    && node.callee.type === "MemberExpression"
    && MUTATORS.has(node.callee.property?.name)
}

function readsABuiltCollaborator(node) {
  return node.type === "MemberExpression" && node.object.type === "NewExpression"
}

// `JSON.parse` shares a word with `parseConfig` and says nothing about it, so only what the file owns counts.
function calledNameOf(callee) {
  if (callee.type === "Identifier") return callee.name

  return isOwnCallee(callee) ? propertyNameOf(callee) : null
}

function isOwnCallee(callee) {
  return callee.type === "MemberExpression" && callee.object.type === "ThisExpression"
}
