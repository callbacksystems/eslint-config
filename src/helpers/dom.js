const HTML_ELEMENT_SUPERCLASS = /^HTML[A-Z]?\w*Element$/u

export function isHtmlElementSubclass(classNode) {
  return classNode?.superClass?.type === "Identifier" && HTML_ELEMENT_SUPERCLASS.test(classNode.superClass.name)
}

export function extendsElementNamedBase(classNode) {
  return classNode?.superClass?.type === "Identifier" && classNode.superClass.name.endsWith("Element")
}
