// The bridge between a rule's analysis object and ESLint's reporter, shared so
// every rule's `create` reports the same way: the analysis class delivers the
// problem descriptor (`{ node, messageId, data }`) or null, and reporting stays
// out of it, mirroring how a RuboCop cop's inner class yields the offense while
// the cop calls `add_offense`.

export function reportProblem(context, analysis) {
  if (analysis.problem) context.report(analysis.problem)
}

export function reportProblems(context, analysis) {
  analysis.problems.forEach((problem) => context.report(problem))
}
