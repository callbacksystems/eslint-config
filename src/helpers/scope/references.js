export function isReassignment(reference) {
  return reference.isWrite() && !reference.init
}
