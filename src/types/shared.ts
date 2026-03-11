/**
 * Shared primitive types and utility type helpers used across ts-utils.
 *
 * Why a shared types file?
 * As a library grows, types get re-used across modules. Defining them once
 * prevents drift (e.g. two modules defining `LogLevel` differently) and
 * makes the public API surface easier to reason about.
 */

// ---------------------------------------------------------------------------
// Utility types
// ---------------------------------------------------------------------------

/**
 * Makes specific keys of T required, leaving the rest untouched.
 *
 * Example:
 *   type Config = { host?: string; port?: number; timeout?: number }
 *   type WithHost = RequireKeys<Config, 'host'>
 *   // => { host: string; port?: number; timeout?: number }
 */
export type RequireKeys<T, K extends keyof T> = T & { [P in K]-?: T[P] }

/**
 * Recursively makes all properties of T readonly.
 * Useful for config objects that should never be mutated after creation.
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P]
}

/**
 * Extracts the resolved value type from a Promise.
 *
 * Example:
 *   type R = Awaited<Promise<string>>  // => string
 *
 * Note: TypeScript 4.5+ ships this built-in. We include it here for
 * explicitness and in case of older compiler targets in consuming projects.
 */
export type Awaited<T> = T extends Promise<infer U> ? U : T

/**
 * A function that accepts no arguments and returns nothing.
 * Commonly used as a cleanup / unsubscribe callback.
 */
export type Unsubscribe = () => void

// ---------------------------------------------------------------------------
// Result type — explicit error handling without exceptions
// ---------------------------------------------------------------------------

/**
 * A discriminated union representing either success or failure.
 *
 * Why use this instead of try/catch?
 * Functions that can fail in expected ways (network errors, validation)
 * should communicate that in their return type. This forces callers to
 * handle both cases at the type level rather than at runtime.
 *
 * Example:
 *   function parseJson(raw: string): Result<object, SyntaxError> { ... }
 *
 *   const result = parseJson(input)
 *   if (result.ok) {
 *     console.log(result.value)  // TypeScript knows this is object
 *   } else {
 *     console.error(result.error) // TypeScript knows this is SyntaxError
 *   }
 */
export type Result<T, E extends Error = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E }

/** Convenience constructors for Result */
export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value })
export const err = <E extends Error>(error: E): Result<never, E> => ({ ok: false, error })
