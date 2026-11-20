/** Validates, versions, tags, and pushes a release for the CI publish workflow. */
import { execFileSync, execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const HELP = `
pnpm release [<bump>] [--dry-run] [--preid <id>] [--skip-checks]

  <bump>         patch (default), minor, major, prepatch, preminor, premajor,
                 prerelease, or an exact version such as 1.2.3
  --preid        prerelease identifier, for example rc
  --dry-run      run checks and print the release plan without changing files
  --skip-checks  skip repository checks for a release already verified
`

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const bumps = new Set(['patch', 'minor', 'major', 'prepatch', 'preminor', 'premajor', 'prerelease'])
const exactVersion = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/
const preidPattern = /^[0-9A-Za-z-]+$/

type Level = 'pass' | 'error' | 'warning' | 'unverifiable'
interface Finding { level: Level, claim: string, detail: string }

const capture = (command: string): string | null => {
  try {
    return execSync(command, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  }
  catch {
    return null
  }
}

const run = (command: string, args: string[]): number => {
  try {
    execFileSync(command, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' })
    return 0
  }
  catch (error) {
    return (error as { status?: number }).status ?? 1
  }
}

const verdict = (ok: boolean, claim: string, passed: string, failed: string): Finding => ({
  level: ok ? 'pass' : 'error',
  claim,
  detail: ok ? passed : failed,
})

const defaultBranch = (): string => {
  const head = capture('git symbolic-ref --short refs/remotes/origin/HEAD')
  return head ? head.replace(/^origin\//, '') : 'main'
}

const versionIsFree = async (name: string, version: string): Promise<Finding> => {
  const claim = `${version} is not already on npm`
  try {
    const response = await fetch(`https://registry.npmjs.org/${name}/${version}`)
    if (response.status === 404) return { level: 'pass', claim, detail: 'the registry has never seen it' }
    if (response.ok) return { level: 'error', claim, detail: 'already published; choose another version' }
    return { level: 'unverifiable', claim, detail: `the registry answered ${response.status}` }
  }
  catch (error) {
    return {
      level: 'unverifiable',
      claim,
      detail: `could not reach npm: ${(error as Error).message}`,
    }
  }
}

const runChecks = (): number => {
  const checks = [
    ['pnpm', ['lint']],
    ['pnpm', ['typecheck']],
    ['pnpm', ['build']],
    ['pnpm', ['test:unit']],
    ['pnpm', ['smoke']],
    ['pnpm', ['check:docs']],
    ['pnpm', ['demo:install']],
    ['pnpm', ['demo:verify']],
  ] as const

  for (const [command, args] of checks) {
    const code = run(command, [...args])
    if (code !== 0) return code
  }
  return 0
}

const preflight = async (
  pkg: { name: string },
  target: string,
  skipChecks: boolean,
): Promise<Finding[]> => {
  const findings: Finding[] = []
  const main = defaultBranch()
  const branch = capture('git rev-parse --abbrev-ref HEAD')
  findings.push(verdict(
    branch === main,
    `the release is cut from ${main}`,
    `on ${main}`,
    `on ${branch ?? '(unknown)'}`,
  ))
  findings.push(verdict(
    capture('git status --porcelain') === '',
    'the working tree is clean',
    'nothing uncommitted',
    'uncommitted changes would not be included in the tag',
  ))

  capture('git fetch origin --quiet')
  const local = capture('git rev-parse HEAD')
  const remote = capture(`git rev-parse origin/${main}`)
  if (!local || !remote) {
    findings.push({
      level: 'unverifiable',
      claim: `HEAD matches origin/${main}`,
      detail: !local ? 'HEAD does not resolve' : `origin/${main} does not resolve`,
    })
  }
  else if (local !== remote) {
    const behind = capture(`git rev-list --count HEAD..origin/${main}`)
    const ahead = capture(`git rev-list --count origin/${main}..HEAD`)
    findings.push({
      level: behind !== '0' ? 'error' : 'warning',
      claim: `HEAD matches origin/${main}`,
      detail: behind !== '0' ? `${behind} commit(s) behind` : `${ahead} commit(s) ahead; release will push them`,
    })
  }
  else findings.push({ level: 'pass', claim: `HEAD matches origin/${main}`, detail: 'in sync' })

  findings.push(verdict(
    capture(`git tag -l v${target}`) === '',
    `tag v${target} is unused`,
    'free',
    'the tag already exists locally',
  ))
  findings.push(await versionIsFree(pkg.name, target))

  if (skipChecks) {
    findings.push({
      level: 'unverifiable',
      claim: 'the repository checks pass',
      detail: 'skipped by --skip-checks',
    })
  }
  else {
    const code = runChecks()
    findings.push(verdict(
      code === 0,
      'lint, types, build, tests, smoke, docs, and demo checks pass',
      'the full sequence exited 0',
      `the sequence exited ${code}`,
    ))
  }

  return findings
}

const report = (title: string, findings: Finding[]) => {
  const symbol: Record<Level, string> = {
    pass: 'PASS ',
    error: 'FAIL ',
    warning: 'WARN ',
    unverifiable: '?????',
  }
  console.log(`\n${title}\n${'-'.repeat(title.length)}`)
  for (const finding of findings) {
    console.log(`${symbol[finding.level]} ${finding.claim}`)
    console.log(`      ${finding.detail}`)
  }
  console.log('')
}

const args = process.argv.slice(2)
if (args.includes('--help') || args.includes('-h')) {
  console.log(HELP)
  process.exit(0)
}

const dryRun = args.includes('--dry-run')
const skipChecks = args.includes('--skip-checks')
const preidIndex = args.indexOf('--preid')
const preid = preidIndex >= 0 ? args[preidIndex + 1] : undefined
const positional = args.filter((arg, index) => !arg.startsWith('--') && index !== preidIndex + 1)
const spec = positional[0] ?? 'patch'

if (
  positional.length > 1
  || (!bumps.has(spec) && !exactVersion.test(spec))
  || (preidIndex >= 0 && (!preid || !preidPattern.test(preid)))
) {
  console.log(HELP)
  process.exit(2)
}

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
  name: string
  version: string
}
const versionArgs = ['version', spec, '--dry-run', '--no-git-checks']
if (preid) versionArgs.push('--preid', preid)

let target: string | undefined
try {
  const output = execFileSync('pnpm', versionArgs, {
    cwd: root,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  })
  target = /→\s*(\S+)\s*$/m.exec(output)?.[1]
}
catch {
  target = undefined
}

if (!target) {
  console.error('Could not determine the target version.')
  process.exit(1)
}

console.log(`\n${pkg.name} ${pkg.version} → ${target}${dryRun ? ' (dry run)' : ''}`)
const findings = await preflight(pkg, target, skipChecks)
report(`Before releasing ${pkg.name}@${target}`, findings)

if (findings.some((finding) => finding.level === 'error')) {
  console.log('Nothing was changed. Fix the failures and run the command again.\n')
  process.exit(1)
}

const actualVersionArgs = ['version', spec, '--message', 'chore(release): v%s']
if (preid) actualVersionArgs.push('--preid', preid)

if (dryRun) {
  console.log(`Would run: pnpm ${actualVersionArgs.join(' ')}`)
  console.log('Would run: git push --follow-tags\n')
  process.exit(0)
}

if (run('pnpm', actualVersionArgs) !== 0) process.exit(1)
if (run('git', ['push', '--follow-tags']) !== 0) {
  console.error('\nThe version is committed and tagged locally, but the push failed.')
  console.error('Fix the remote and run: git push --follow-tags\n')
  process.exit(1)
}

console.log(`\nPushed v${target}. The release workflow will publish it.`)
console.log('Watch it: https://github.com/AndrewBogdanovTSS/vue-uno-style/actions\n')
