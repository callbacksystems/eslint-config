const CONTRACTS = [
  { globalName: "Object", memberName: "assign", kind: "assign" },
  { globalName: "Object", memberName: "defineProperties", kind: "descriptors" },
  { globalName: "Object", memberName: "defineProperty", kind: "descriptor" },
  { globalName: "Object", memberName: "setPrototypeOf", kind: "prototype" },
  { globalName: "Reflect", memberName: "defineProperty", kind: "descriptor" },
  { globalName: "Reflect", memberName: "deleteProperty", kind: "key" },
  { globalName: "Reflect", memberName: "set", kind: "key" },
  { globalName: "Reflect", memberName: "setPrototypeOf", kind: "prototype" }
]

export function standardPropertyWriteContractMatching(predicate) {
  return CONTRACTS.find(predicate) ?? null
}
