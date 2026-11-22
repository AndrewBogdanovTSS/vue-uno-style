export type BreakpointValue = number | string
export type BreakpointConfig = Readonly<Record<string, BreakpointValue>>

export interface ResolveBreakpointsOptions {
  breakpoints: BreakpointConfig
  baseBreakpoint?: string
}

export interface ResolvedBreakpoints {
  base: string
  prefixed: string[]
}

const isBaseValue = (value: BreakpointValue) => {
  if (value === 0) return true
  if (typeof value !== 'string') return false

  return ['', '0', '0px'].includes(value.trim().toLowerCase())
}

/**
 * Resolves the unprefixed base breakpoint and the ordered prefixed breakpoints.
 * An explicit base wins; otherwise a zero-valued breakpoint is required.
 */
export const resolveBreakpoints = ({
  breakpoints,
  baseBreakpoint
}: ResolveBreakpointsOptions): ResolvedBreakpoints => {
  const names = Object.keys(breakpoints)

  if (baseBreakpoint && !names.includes(baseBreakpoint)) {
    throw new Error(
      `[vue-uno-style] Base breakpoint "${baseBreakpoint}" does not exist in the configured breakpoints.`
    )
  }

  const base = baseBreakpoint ?? names.find((name) => isBaseValue(breakpoints[name]))
  if (!base) {
    throw new Error(
      '[vue-uno-style] Unable to resolve a base breakpoint. '
      + 'Set baseBreakpoint or configure a breakpoint with the value 0, "0", "0px", or an empty string.'
    )
  }

  return {
    base,
    prefixed: names.filter((name) => name !== base)
  }
}
