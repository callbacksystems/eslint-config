// Stimulus targets/classes/values/outlets keys are camelCase, not snake_case or kebab-case (which are reserved for HTML
// attributes).

import { isStringLiteral } from "#helpers/ast"
import { isStimulusController, STIMULUS_CONFIG_KEYS } from "#helpers/stimulus"

const CAMEL_CASE = /^[a-z][a-zA-Z0-9]*$/u

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

function isStimulusConfigBlock(member) {
  return member.type === "PropertyDefinition"
    && member.static
    && member.key.type === "Identifier"
    && STIMULUS_CONFIG_KEYS.has(member.key.name)
    && Boolean(member.value)
}

function checkConfigBlock(context, configValue, ownerName) {
  stringValuesIn(configValue).filter(isInvalidKey).forEach((item) => {
    context.report({ node: item, messageId: "notCamelCase", data: { name: nameOf(item), owner: ownerName } })
  })
}

function stringValuesIn(expression) {
  if (expression.type === "ArrayExpression") return arrayStringElementsIn(expression)
  if (expression.type === "ObjectExpression") return objectKeyIdentifiersIn(expression)
  return []
}

function arrayStringElementsIn(expression) {
  return expression.elements.filter(isStringLiteral)
}

function objectKeyIdentifiersIn(expression) {
  return expression.properties
    .filter((property) => property.type === "Property" && property.key.type === "Identifier")
    .map((property) => property.key)
}

function isInvalidKey(item) {
  return !CAMEL_CASE.test(nameOf(item))
}

function nameOf(item) {
  return item.type === "Identifier" ? item.name : item.value
}
