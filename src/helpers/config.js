export const enableRules = (ruleIds) =>
  Object.fromEntries(ruleIds.map((ruleId) => [ ruleId, "error" ]))

export const mergeConfigRules = (...configs) =>
  Object.assign(
    {},
    ...configs.flatMap((config) => (Array.isArray(config) ? config : [ config ]).map((item) => item?.rules ?? {}))
  )
