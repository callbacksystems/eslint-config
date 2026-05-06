import { staticMemberKeyOf } from "#helpers/syntax/classes"
import { staticStringValueOf } from "#helpers/syntax/literals"

export function resolvedStringKeyOf(member, bindings) {
  const key = staticMemberKeyOf(member)
  if (key) return key

  const node = member.key ?? member.property
  const name = member.computed && node?.type === "Identifier"
    ? staticStringValueOf(bindings.stableValueFor(node))
    : null
  return name === null ? null : { name, node }
}
