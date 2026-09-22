/** Checks README claims against the source package and built exports. */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { styleProps } from '../src/core/getStyle'

type Level = 'pass' | 'error' | 'unverifiable'

interface Finding {
  level: Level
  claim: string
  detail: string
}

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const readme = readFileSync(join(root, 'README.md'), 'utf8')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
  name: string
  engines?: { node?: string }
  peerDependencies?: Record<string, string>
  exports?: Record<string, unknown>
}

const verdict = (ok: boolean, claim: string, passed: string, failed: string): Finding => ({
  level: ok ? 'pass' : 'error',
  claim,
  detail: ok ? passed : failed,
})

const documentedProperties = (): string[] => readme
  .split('\n')
  .map((line) => /^\|\s*`([^`]+)`\s*\|/.exec(line)?.[1])
  .filter((value): value is string => Boolean(value))

const propertyChecks = (): Finding[] => {
  const documented = documentedProperties()
  const implemented = [...styleProps]
  const undocumented = implemented.filter((prop) => !documented.includes(prop))
  const invented = documented.filter((prop) => !implemented.includes(prop as typeof styleProps[number]))

  return [
    verdict(
      undocumented.length === 0,
      'every supported style property is documented',
      `${implemented.length} properties, all documented`,
      `missing from README: ${undocumented.join(', ')}`,
    ),
    verdict(
      invented.length === 0,
      'every property in the README table is implemented',
      'no invented properties',
      `documented but unsupported: ${invented.join(', ')}`,
    ),
    verdict(
      documented.length === new Set(documented).size,
      'the property table contains no duplicates',
      `${documented.length} unique rows`,
      'one or more property rows are duplicated',
    ),
  ]
}

const packageChecks = (): Finding[] => {
  const integrations = [
    ['root directive', "from 'vue-uno-style'"],
    ['UnoCSS preset', "from 'vue-uno-style/preset'"],
    ['ESLint plugin', "from 'vue-uno-style/eslint'"],
    ['Nuxt module', "'vue-uno-style/nuxt'"],
  ] as const
  const nodeFloor = /Requires Node (\d+) or newer/.exec(readme)?.[1]
  const declaredNodeFloor = /(\d+)/.exec(pkg.engines?.node ?? '')?.[1]

  return [
    verdict(
      readme.includes(`npm install ${pkg.name}`),
      'the install command names the published package',
      pkg.name,
      `README does not install ${pkg.name}`,
    ),
    verdict(
      Boolean(nodeFloor) && nodeFloor === declaredNodeFloor,
      'the documented Node floor matches package.json',
      `both say ${declaredNodeFloor}`,
      `README says ${nodeFloor ?? '(nothing)'}, package.json says ${pkg.engines?.node ?? '(nothing)'}`,
    ),
    ...integrations.map(([name, needle]) => verdict(
      readme.includes(needle),
      `the README documents the ${name} entry`,
      needle,
      `missing example containing ${needle}`,
    )),
    verdict(
      readme.includes('`baseBreakpoint` is required')
      && readme.includes('0`, `"0"`, `"0px"`, or `""`')
      && /explicit `baseBreakpoint` always wins/i.test(readme),
      'the base-breakpoint contract is stated explicitly',
      'automatic zero base, required fallback, and explicit precedence are documented',
      'README is missing part of the base-breakpoint contract',
    ),
    verdict(
      readme.includes('source scanning cannot find') && readme.includes('Always install `presetVUnoStyle()`'),
      'the README explains why the preset is required',
      'runtime-generated classes and safelisting are connected',
      'README does not explain that runtime classes require the preset',
    ),
    verdict(
      readme.includes('vue-uno-style/no-multiple-v-style'),
      'the shipped ESLint rule is documented',
      'vue-uno-style/no-multiple-v-style',
      'the rule name is missing',
    ),
  ]
}

const buildChecks = (): Finding[] => {
  const files = Object.values(pkg.exports ?? {})
    .flatMap((entry) => typeof entry === 'string'
      ? [entry]
      : Object.values(entry as Record<string, string>))
    .filter((file) => file.startsWith('./dist/'))

  if (!existsSync(join(root, 'dist'))) {
    return [{
      level: 'unverifiable',
      claim: 'every package export exists in the build',
      detail: 'dist/ is missing; run `pnpm build` first',
    }]
  }

  const missing = files.filter((file) => !existsSync(join(root, file)))
  return [verdict(
    missing.length === 0,
    'every package export exists in the build',
    `${files.length} export files, all present`,
    `missing: ${missing.join(', ')}`,
  )]
}

const findings = [...propertyChecks(), ...packageChecks(), ...buildChecks()]
const symbol: Record<Level, string> = { pass: 'PASS ', error: 'FAIL ', unverifiable: '?????' }

console.log('\nREADME claims, checked against the package')
console.log('-'.repeat(42))
for (const finding of findings) {
  console.log(`${symbol[finding.level]} ${finding.claim}`)
  console.log(`      ${finding.detail}`)
}

const errors = findings.filter((finding) => finding.level === 'error').length
const unverifiable = findings.filter((finding) => finding.level === 'unverifiable').length
console.log(`\n${findings.length} claims - ${errors} failed - ${unverifiable} unverifiable\n`)
process.exit(errors === 0 ? 0 : 1)
