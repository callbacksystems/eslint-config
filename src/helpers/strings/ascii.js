export function asciiLowercaseOf(value) {
  return value?.replaceAll(/[A-Z]/gu, (character) => character.toLowerCase()) ?? null
}
