import { BindingDefinition } from "#helpers/scope/binding_definition"

export function isMutableBinding(variable) {
  const [ definition ] = variable.defs
  return variable.defs.length !== 1 || !new BindingDefinition(definition).isImmutable
}
