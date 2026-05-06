export function isDeclarativeGlobalDefinition(definition) {
  return definition.type === "ClassName"
    || (definition.type === "Variable" && definition.parent.kind !== "var")
}
