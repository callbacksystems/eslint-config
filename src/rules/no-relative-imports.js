import path from "node:path"
import { createTypeScriptImportResolver } from "eslint-import-resolver-typescript"

const resolver = createTypeScriptImportResolver()

const isRelative = (source) => source.startsWith("./") || source.startsWith("../")

const stripExtension = (filePath) => filePath.replace(/\.[cm]?[jt]sx?$/u, "")

const tryCandidate = (currentFile, directory, targetFile) => {
  const fromHere = path.relative(directory, targetFile)
  if (fromHere.startsWith("..") || path.isAbsolute(fromHere)) return null

  const candidate = stripExtension(fromHere).split(path.sep).join("/")
  const resolved = resolver.resolve(candidate, currentFile)
  return resolved?.found && resolved.path === targetFile ? candidate : null
}

const climbForCandidate = (currentFile, directory, targetFile) => {
  const candidate = tryCandidate(currentFile, directory, targetFile)
  if (candidate) return candidate

  const parent = path.dirname(directory)
  return parent === directory ? null : climbForCandidate(currentFile, parent, targetFile)
}

const findBareEquivalent = (currentFile, relativeSource) => {
  const original = resolver.resolve(relativeSource, currentFile)
  return original?.found && original.path
    ? climbForCandidate(currentFile, path.dirname(currentFile), original.path)
    : null
}

export default {
  meta: {
    type: "problem",
    fixable: "code",
    docs: {
      description: "Disallow relative imports when an equivalent bare import resolves"
    },
    schema: [],
    messages: {
      relativeImport: "Relative import \"{{path}}\". Use \"{{suggested}}\" instead."
    }
  },
  create(context) {
    const check = (node) => {
      const source = node.source?.value
      if (typeof source !== "string" || !isRelative(source)) return

      const suggested = findBareEquivalent(context.filename, source)
      if (!suggested) return

      context.report({
        node: node.source,
        messageId: "relativeImport",
        data: { path: source, suggested },
        fix: (fixer) => fixer.replaceText(node.source, `"${suggested}"`)
      })
    }

    return {
      ImportDeclaration: check,
      ExportAllDeclaration: check,
      ExportNamedDeclaration: check
    }
  }
}
