// Not `localeCompare`, which mixes upper and lower case and would reshuffle every snapshot listing globals.

export function alphabetically(first, second) {
  if (first === second) return 0

  return first < second ? -1 : 1
}
