export function enableRules(ruleIds) {
  return Object.fromEntries(ruleIds.map((ruleId) => [ ruleId, "error" ]))
}
