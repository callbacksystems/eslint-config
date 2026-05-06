// Stimulus targets/classes/values/outlets keys are camelCase, not snake_case
// or kebab-case (which are reserved for HTML attributes).

const STIMULUS_CONFIG_KEYS = new Set([ "targets", "classes", "values", "outlets" ])
const CAMEL_CASE = /^[a-z][a-zA-Z0-9]*$/u

const isStimulusController = (classNode) =>
  classNode.superClass?.type === "Identifier" && classNode.superClass.name === "Controller"

const arrayStringElements = (expression) =>
  expression.elements
    .filter((element) => element?.type === "Literal" && typeof element.value === "string")

const objectKeyIdentifiers = (expression) =>
  expression.properties
    .filter((property) => property.type === "Property" && property.key.type === "Identifier")
    .map((property) => property.key)

const stringValuesIn = (expression) => {
  if (expression.type === "ArrayExpression") return arrayStringElements(expression)
  if (expression.type === "ObjectExpression") return objectKeyIdentifiers(expression)
  return []
}

const nameOf = (item) => item.type === "Identifier" ? item.name : item.value

const isInvalidKey = (item) => !CAMEL_CASE.test(nameOf(item))

const checkConfigBlock = (context, configValue, ownerName) => {
  stringValuesIn(configValue).filter(isInvalidKey).forEach((item) => {
    context.report({ node: item, messageId: "notCamelCase", data: { name: nameOf(item), owner: ownerName } })
  })
}

const isStimulusConfigBlock = (member) =>
  member.type === "PropertyDefinition"
  && member.static
  && member.key.type === "Identifier"
  && STIMULUS_CONFIG_KEYS.has(member.key.name)
  && Boolean(member.value)

export default {
  meta: {
    type: "problem",
    docs: { description: "Enforce camelCase keys in Stimulus static targets/classes/values/outlets" },
    schema: [],
    messages: { notCamelCase: "Stimulus `{{owner}}` key `{{name}}` must be camelCase." }
  },
  create(context) {
    return {
      ClassBody(node) {
        if (isStimulusController(node.parent)) {
          node.body
            .filter(isStimulusConfigBlock)
            .forEach((member) => checkConfigBlock(context, member.value, member.key.name))
        }
      }
    }
  }
}
