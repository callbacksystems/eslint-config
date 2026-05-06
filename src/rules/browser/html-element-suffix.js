// Classes extending an HTML element (HTMLElement, HTMLDivElement, ...) must
// end in `Element`. Convention from House (`EditorElement`) and Lexxy
// (`LexicalEditorElement`); makes the runtime role obvious from the type.

const HTML_ELEMENT_SUPERCLASS = /^HTML[A-Z]?\w*Element$/u

const isHtmlElementSubclass = (classNode) =>
  classNode.superClass?.type === "Identifier"
  && HTML_ELEMENT_SUPERCLASS.test(classNode.superClass.name)

const needsElementSuffix = (node) =>
  Boolean(node.id) && isHtmlElementSubclass(node) && !node.id.name.endsWith("Element")

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Require classes extending HTMLElement to end in `Element`" },
    schema: [],
    messages: { missingSuffix: "Class `{{name}}` extends `{{superClass}}`; must end in `Element`." }
  },
  create(context) {
    const check = (node) => {
      if (!needsElementSuffix(node)) return

      context.report({
        node: node.id,
        messageId: "missingSuffix",
        data: { name: node.id.name, superClass: node.superClass.name }
      })
    }

    return { ClassDeclaration: check, ClassExpression: check }
  }
}
