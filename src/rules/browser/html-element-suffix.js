// Classes extending an HTML element (HTMLElement, HTMLDivElement, ...) must
// end in `Element`. Convention from House (`EditorElement`) and Lexxy
// (`LexicalEditorElement`); makes the runtime role obvious from the type.

import { onTypes } from "#helpers/ast"

const HTML_ELEMENT_SUPERCLASS = /^HTML[A-Z]?\w*Element$/u

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Require classes extending HTMLElement to end in `Element`" },
    schema: [],
    messages: { missingSuffix: "Class `{{name}}` extends `{{superClass}}`; must end in `Element`." }
  },
  create(context) {
    function check(node) {
      if (needsElementSuffix(node)) {
        context.report({
          node: node.id,
          messageId: "missingSuffix",
          data: { name: node.id.name, superClass: node.superClass.name }
        })
      }
    }

    return onTypes([ "ClassDeclaration", "ClassExpression" ], check)
  }
}

function needsElementSuffix(node) {
  return Boolean(node.id) && isHtmlElementSubclass(node) && !node.id.name.endsWith("Element")
}

function isHtmlElementSubclass(classNode) {
  return classNode.superClass?.type === "Identifier"
    && HTML_ELEMENT_SUPERCLASS.test(classNode.superClass.name)
}
