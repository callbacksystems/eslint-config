export function reportProblem(context, analysis) {
  const { problem } = analysis
  if (problem) context.report(problem)
}

export function reportProblems(context, analysis) {
  analysis.problems.forEach((problem) => context.report(problem))
}
