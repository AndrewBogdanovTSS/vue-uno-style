import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

export type WriteWebTypesResult = 'written' | 'unchanged'

/**
 * Path of the `web-types.json` that the package's `package.json` points WebStorm at. The Nuxt
 * module is bundled into `dist/nuxt.mjs`, next to that file.
 */
export const packageWebTypesPath = (): string =>
  join(dirname(fileURLToPath(import.meta.url)), 'web-types.json')

/**
 * Writes `contents` to `file` unless it already holds exactly that.
 *
 * The file lives inside the installed package. pnpm hard-links package files to its global
 * store by default, so writing into the existing file would change it for every project on the
 * machine. Writing a temporary file and renaming it over the target replaces the directory entry
 * instead, which leaves the store's copy untouched.
 */
export const writeWebTypes = (file: string, contents: string): WriteWebTypesResult => {
  if (existsSync(file) && readFileSync(file, 'utf8') === contents) return 'unchanged'

  const temporary = `${file}.${process.pid}.tmp`

  try {
    writeFileSync(temporary, contents)
    renameSync(temporary, file)
  }
  catch (error) {
    rmSync(temporary, { force: true })
    throw error
  }

  return 'written'
}
