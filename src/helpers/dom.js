// Custom elements: recognising a class that extends a DOM element base.

const HTML_ELEMENT_SUPERCLASS = /^HTML[A-Z]?\w*Element$/u

export function isHtmlElementSubclass(classNode) {
  return classNode?.superClass?.type === "Identifier" && HTML_ELEMENT_SUPERCLASS.test(classNode.superClass.name)
}

// A custom element through an intermediate base whose name already carries the suffix.
export function extendsElementLikeClass(classNode) {
  return classNode?.superClass?.type === "Identifier" && classNode.superClass.name.endsWith("Element")
}
