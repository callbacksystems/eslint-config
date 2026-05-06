// Only what every project has, whatever its stack. Anything a single stack generates is ignored by that stack's own
// preset, so a consumer never silently stops linting a directory belonging to a framework they do not use.
export const ignores = [ "coverage/**", "dist/**", "node_modules/**" ]
