/** Checks README claims against the source package and built exports. */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import type { KnownRulePrefix } from '../src/knownRules'
import { defaultProperties } from '../src/core/properties'
import { knownRuleSource, knownRules } from '../src/knownRules'
import { builtIn } from '../test/fixtures/customRules'
import { basePresets } from '../test/fixtures/presets'

type Level = 'pass' | 'error' | 'unverifiable'

interface Finding {
  level: Level
  claim: string
  detail: string
}

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const readme = readFileSync(join(root, 'README.md'), 'utf8')
const readmeLines = readme.split('\n')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
  name: string
  engines?: { node?: string }
  peerDependencies?: Record<string, string>
  exports?: Record<string, unknown>
}

const verdict = (ok: boolean, claim: string, passed: string, failed: string): Finding => ({
  level: ok ? 'pass' : 'error',
  claim,
  detail: ok ? passed : failed
})

const packageChecks = (): Finding[] => {
  const integrations = [
    ['root directive', "from 'vue-uno-style'"],
    ['UnoCSS preset', "from 'vue-uno-style/preset'"],
    ['ESLint plugin', "from 'vue-uno-style/eslint'"],
    ['Nuxt module', "'vue-uno-style/nuxt'"]
  ] as const
  const nodeFloor = /Requires Node (\d+) or newer/.exec(readme)?.[1]
  const declaredNodeFloor = /(\d+)/.exec(pkg.engines?.node ?? '')?.[1]

  return [
    verdict(
      readme.includes(`npm install ${pkg.name}`),
      'the install command names the published package',
      pkg.name,
      `README does not install ${pkg.name}`
    ),
    verdict(
      Boolean(nodeFloor) && nodeFloor === declaredNodeFloor,
      'the documented Node floor matches package.json',
      `both say ${declaredNodeFloor}`,
      `README says ${nodeFloor ?? '(nothing)'}, package.json says ${pkg.engines?.node ?? '(nothing)'}`
    ),
    ...integrations.map(([name, needle]) => verdict(
      readme.includes(needle),
      `the README documents the ${name} entry`,
      needle,
      `missing example containing ${needle}`
    )),
    verdict(
      readme.includes('`baseBreakpoint` is required')
      && readme.includes('0`, `"0"`, `"0px"`, or `""`')
      && /explicit `baseBreakpoint` always wins/i.test(readme),
      'the base-breakpoint contract is stated explicitly',
      'automatic zero base, required fallback, and explicit precedence are documented',
      'README is missing part of the base-breakpoint contract'
    ),
    verdict(
      readme.includes('own scanning cannot') && readme.includes('Always install `presetVUnoStyle()`'),
      'the README explains why the preset is required',
      'runtime-generated classes and safelisting are connected',
      'README does not explain that runtime classes require the preset'
    ),
    verdict(
      readme.includes('### Default properties')
      && readme.includes('### Configured properties')
      && readme.includes('`defaultProperties: false` turns the defaults off')
      && readme.includes('`properties` is\nrequired'),
      'default and configured properties are both documented',
      'scan-only defaults, always-safelisted `properties`, and the opt-out that makes them required',
      'README must document the default properties, `properties`, and `defaultProperties: false`'
    ),
    verdict(
      readme.includes('vue-uno-style/no-multiple-v-style'),
      'the shipped ESLint rule is documented',
      'vue-uno-style/no-multiple-v-style',
      'the rule name is missing'
    )
  ]
}

/** Every public options interface, with the source file that declares it. */
const optionInterfaces = [
  ['src/nuxt.ts', 'VUnoStyleNuxtModuleOptions'],
  ['src/preset.ts', 'PresetVUnoStyleOptions'],
  ['src/directive.ts', 'VUnoStyleOptions'],
  ['src/core/breakpoints.ts', 'ResolveBreakpointsOptions'],
  ['src/eslint.ts', 'NoMultipleVStyleOptions'],
  ['src/core/webTypes.ts', 'WebTypesOptions']
] as const

/** Field names declared directly in an interface body, ignoring comments. */
const interfaceFields = (file: string, name: string): string[] | undefined => {
  const source = readFileSync(join(root, file), 'utf8')
  const body = new RegExp(`export interface ${name}\\b[^{]*\\{([\\s\\S]*?)\\n\\}`).exec(source)?.[1]
  if (!body) return undefined
  const code = body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
  return [...code.matchAll(/^\s*(\w+)\??:/gm)].map((match) => match[1])
}

const optionChecks = (): Finding[] => optionInterfaces.map(([file, name]) => {
  const fields = interfaceFields(file, name)
  if (!fields?.length) {
    return verdict(false, `${name} options are documented`, '', `no fields found in ${file}`)
  }
  const missing = fields.filter((field) => !readme.includes(`| \`${field}\` |`))
  return verdict(
    missing.length === 0,
    `${name} options are documented`,
    fields.join(', '),
    `no README table row for: ${missing.join(', ')}`
  )
})

/**
 * The README's custom rules must be the ones `test/customRules.test.ts` runs, and its table of
 * which preset lacks which prefix must be the one that test proves. The rules are compared as
 * text, because the README shows their source.
 */
const customRuleChecks = (): Finding[] => {
  // The `bgi` example is written out in the fixture; the gap rules come from the package, in the
  // text the DevTools tab suggests.
  const fixture = readFileSync(join(root, 'test/fixtures/customRules.ts'), 'utf8')
  const rules = [
    ...[...fixture.matchAll(/\[\/\^.*?\}\)\]/g)].map((match) => match[0]),
    ...(Object.keys(knownRules) as KnownRulePrefix[]).map(knownRuleSource)
  ]
  const expectedRules = Object.keys(builtIn).length + 1
  const unquoted = rules.filter((rule) => !readme.includes(rule))

  // Whole lines, so a row with a column missing or added cannot pass as a prefix of another.
  const cell = (shipped: boolean) => shipped ? 'built in' : 'add the rule'
  const rows = Object.entries(builtIn).map(([prefix, presets]) =>
    `| \`${prefix}\` | ${cell(presets.presetMini)} | ${cell(presets.presetWind3)} | ${cell(presets.presetWind4)} |`)
  const missingRows = rows.filter((row) => !readmeLines.includes(row))

  // The base-preset table states each preset's theme key and default `sm`, which the preset and
  // Nuxt tests use as fixtures; this keeps the README's copy of them in step.
  const presetRows = basePresets.map(({ name, themeKey, defaults }) =>
    `| \`${name}\` | \`theme.${themeKey}\` | \`${defaults.sm}\` |`)
  const missingPresetRows = presetRows.filter((row) => !readmeLines.some((line) => line.startsWith(row)))

  return [
    verdict(
      missingPresetRows.length === 0,
      'the README\'s base-preset table matches the tested presets',
      basePresets.map(({ name }) => name).join(', '),
      `missing or different: ${missingPresetRows.join(' ')}`
    ),
    verdict(
      rules.length === expectedRules && unquoted.length === 0,
      'the README quotes the tested custom rules verbatim',
      `${rules.length} rules from test/fixtures/customRules.ts and src/knownRules.ts`,
      rules.length === expectedRules
        ? `not in the README: ${unquoted.join(' ')}`
        : `found ${rules.length} rules in the fixture, expected ${expectedRules}`
    ),
    verdict(
      missingRows.length === 0,
      'the README\'s preset table matches the tested one',
      `${rows.length} rows`,
      `missing or different: ${missingRows.join(' ')}`
    )
  ]
}

/** The README's list of default properties must be the package's, in the same order. */
const defaultPropertyChecks = (): Finding[] => {
  const line = defaultProperties.map((name) => `\`${name}\``).join(', ')

  return [verdict(
    readmeLines.includes(line),
    'the README lists the default properties',
    `${defaultProperties.length} properties from src/core/properties.ts`,
    `no README line reads: ${line}`
  )]
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
      detail: 'dist/ is missing; run `pnpm build` first'
    }]
  }

  const missing = files.filter((file) => !existsSync(join(root, file)))
  return [verdict(
    missing.length === 0,
    'every package export exists in the build',
    `${files.length} export files, all present`,
    `missing: ${missing.join(', ')}`
  )]
}

const findings = [
  ...packageChecks(),
  ...optionChecks(),
  ...customRuleChecks(),
  ...defaultPropertyChecks(),
  ...buildChecks()
]
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
