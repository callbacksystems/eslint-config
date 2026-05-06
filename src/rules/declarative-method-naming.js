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

import { walk } from "#helpers/ast"
import { returnsAValue } from "#helpers/functions"
import { CalleeResolver } from "#helpers/callee-resolver"
import { MemberSubject } from "#helpers/member-subject"
import { carriesConnector, leadingWordOf, leadsWithConnector } from "#helpers/naming"
import producerVerbs from "#helpers/producer-verbs"
import { reportProblem } from "#helpers/report"

const PRODUCER_VERBS = new Set(producerVerbs)
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
    return this.#subject.isEligible && this.#isImperativeProducer && this.#deliversOnly
  }

  // The bare verb (`fetch`) is allowed: there is no noun to rename it to.
  get #isImperativeProducer() {
    return PRODUCER_VERBS.has(this.#verb) && this.#subject.name !== this.#verb
  }

  get #verb() {
    return leadingWordOf(this.#subject.name)
  }

  // A method that does something earns its verb.
  get #deliversOnly() {
    const { functionNode } = this.#subject
    return returnsAValue(functionNode) && !new MutationCheck(this.#resolver).mutatesFrom(functionNode)
  }

  get #messageId() {
    return this.#noun ? this.#valueMessageId : "imperativeNameBare"
  }

  // Null for a prepositional phrase that names nothing on its own ("findInBlock").
  get #noun() {
    const rest = this.#subject.name.slice(this.#verb.length)
    const noun = rest ? rest[0].toLowerCase() + rest.slice(1) : ""
    return noun && !leadsWithConnector(noun) ? noun : null
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

// Calls are followed, so a producer delegating its work to a helper still counts as doing something.
class MutationCheck {
  #resolver
  #visited

  constructor(resolver, visited = new Set()) {
    this.#resolver = resolver
    this.#visited = visited
  }

  mutatesFrom(functionNode) {
    return Array.from(walk(functionNode.body)).some((node) => this.#isMutation(node))
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
