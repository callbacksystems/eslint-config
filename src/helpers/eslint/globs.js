export function globsIn(files) {
  return files.map((combination) => (Array.isArray(combination) ? combination.join(" + ") : combination)).join(", ")
}
