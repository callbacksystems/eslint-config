// `sort()` with no comparator comes with one built in: it compares elements as text. That is right for names and wrong
// for numbers (`[5, 10, 2]` sorts to `[10, 2, 5]`), so the intent gets written down rather than left to the default.
// The order is the default one, not `localeCompare`, which mixes upper and lower case and would reshuffle every
// snapshot listing globals.

export function alphabetically(first, second) {
  if (first === second) return 0

  return first < second ? -1 : 1
}
