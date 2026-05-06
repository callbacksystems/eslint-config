// Stimulus controllers follow a strict member order:
//   1. static targets/classes/values/outlets
//   2. private fields (#x)
//   3. lifecycle (initialize, connect, disconnect, connectedCallback, ...)
//   4. callbacks (*TargetConnected, *ValueChanged, *OutletConnected, ...)
//   5. public actions (verbs without prefix)
//   6. getters
//   7. private # methods

const STIMULUS_CONFIG_KEYS = new Set([ "targets", "classes", "values", "outlets" ])
const LIFECYCLE_NAMES = new Set([
  "initialize", "connect", "disconnect",
  "connectedCallback", "disconnectedCallback", "attributeChangedCallback"
])
const CALLBACK_SUFFIXES = [
  "TargetConnected",
  "TargetDisconnected",
  "ValueChanged",
  "OutletConnected",
  "OutletDisconnected"
]

const isStimulusController = (classNode) =>
  classNode.superClass?.type === "Identifier" && classNode.superClass.name === "Controller"

const memberName = (member) =>
  member.key.type === "Identifier" || member.key.type === "PrivateIdentifier"
    ? member.key.name
    : null

const isStaticConfig = (member) =>
  member.type === "PropertyDefinition" && member.static && STIMULUS_CONFIG_KEYS.has(memberName(member))

const isPrivateField = (member) =>
  member.type === "PropertyDefinition" && member.key.type === "PrivateIdentifier"

const isLifecycle = (member) =>
  member.type === "MethodDefinition" && LIFECYCLE_NAMES.has(memberName(member))

const isCallback = (member) => {
  if (member.type !== "MethodDefinition") return false

  const name = memberName(member)
  return Boolean(name) && CALLBACK_SUFFIXES.some((suffix) => name.endsWith(suffix) && name !== suffix)
}

const isGetter = (member) => member.type === "MethodDefinition" && member.kind === "get"
const isPrivateMethod = (member) =>
  member.type === "MethodDefinition" && member.key.type === "PrivateIdentifier"

const GROUP_LABEL = {
  1: "static config",
  2: "private field",
  3: "lifecycle method",
  4: "Stimulus callback",
  5: "public action",
  6: "getter",
  7: "private method"
}

const PROPERTY_GROUPERS = [
  [ isStaticConfig, 1 ],
  [ isPrivateField, 2 ],
  [ isLifecycle, 3 ],
  [ isCallback, 4 ],
  [ isPrivateMethod, 7 ],
  [ isGetter, 6 ]
]

const fallbackGroup = (member) => member.type === "MethodDefinition" ? 5 : 0

const groupOf = (member) => {
  const matched = PROPERTY_GROUPERS.find(([ predicate ]) => predicate(member))
  return matched ? matched[1] : fallbackGroup(member)
}

const annotate = (member) => ({ member, group: groupOf(member) })

const reportOutOfOrder = (context, entry, previousLabel) => {
  context.report({
    node: entry.member,
    messageId: "outOfOrder",
    data: { thisLabel: GROUP_LABEL[entry.group], prevLabel: previousLabel }
  })
}

const checkOrder = (context, members) => {
  let previousGroup = 0
  let previousLabel = ""
  members.map(annotate).filter((entry) => entry.group !== 0).forEach((entry) => {
    if (entry.group < previousGroup) reportOutOfOrder(context, entry, previousLabel)
    previousGroup = entry.group
    previousLabel = GROUP_LABEL[entry.group]
  })
}

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Enforce Stimulus controller member order" },
    schema: [],
    messages: { outOfOrder: "Stimulus member out of order: {{thisLabel}} should come before {{prevLabel}}." }
  },
  create(context) {
    return {
      ClassBody(node) {
        if (isStimulusController(node.parent)) {
          checkOrder(context, node.body)
        }
      }
    }
  }
}
