const COLLECTION_METHODS = new Set([ "append", "set" ])

export function isHeaderCollectionMethod(name) {
  return COLLECTION_METHODS.has(name)
}

export function isXhrHeaderMethod(name) {
  return name === "setRequestHeader"
}
