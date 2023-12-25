// @ts-check

import merge from "lodash.merge";

/**
 * @template T
 * @overload
 * @param {readonly T[]} values
 * @returns {T | undefined}
 */

/**
 * @template T
 * @overload
 * @param {readonly T[]} values
 * @param {T} defaultValue
 * @returns {T}
 */

/**
 * Get the first available element from within the provided array or the default value.
 * @template T
 * @param {readonly T[]} values
 * @param {T} [defaultValue]
 * @returns {T | undefined}
 */
export function firstAvailable(values, defaultValue) {
  if (values) {
    for (const v of values) {
      if (v) {
        return v;
      }
    }
  }
  return defaultValue;
}

/**
 * Merge all available values from provided candidates.
 * @template {object} T
 * @param {readonly T[]} values
 * @returns {T}
 */
export function mergeAll(values) {
  const result = {};
  for (const item of values) {
    merge(result, item);
  }
  // @ts-ignore
  return result;
}

/**
 * Retrieve the last value corresponding the given StateEffect.
 * @template T
 * @param {import("@codemirror/state").Transaction} tr
 * @param {import("@codemirror/state").StateEffectType<T>} valueEffect
 * @returns {T | undefined}
 */
export function getLastValueFromTransaction(tr, valueEffect) {
  let value;
  for (const effect of tr.effects) {
    if (effect.is(valueEffect)) {
      value = effect.value;
    }
  }
  return value;
}

/**
 * Convert given text position from CodeMirror to the LSP Position.
 * @param {number} pos
 * @param {import("@codemirror/state").Text} text
 * @returns {import("vscode-languageserver-types").Position}
 */
export function cmPositionToLsp(pos, text) {
  const line = text.lineAt(pos);

  return {
    line: line.number - 1,
    character: pos - line.from,
  };
}

/**
 * @typedef {import("@codemirror/state").StateField<T extends undefined ? never : T>} NonUndefinedStateField<T>
 * @template T
 */

/**
 * Examine if a refresh is needed by comparing the provided state field's old and new values.
 * The new value is returned if true.
 * @template T
 * @param {{state: import("@codemirror/state").EditorState, startState: import("@codemirror/state").EditorState}} param0
 * @param {[NonUndefinedStateField<T>] | [NonUndefinedStateField<T>, false]} args
 * @returns {T | undefined}
 */
export function getStateIfNeedsRefresh({ state, startState }, ...args) {
  // @ts-ignore
  const oldValue = startState.field(...args);
  // @ts-ignore
  const newValue = state.field(...args);

  if (
    typeof oldValue === "number" &&
    typeof newValue === "number" &&
    isNaN(oldValue) &&
    isNaN(newValue)
  ) {
    return undefined;
  }

  return oldValue !== newValue ? newValue : undefined;
}

/**
 * @template T
 * @overload
 * @param {{state: import("@codemirror/state").EditorState, startState: import("@codemirror/state").EditorState}} param0
 * @param {import("@codemirror/state").StateField<T>} param1
 * @returns {[T, T]}
 */

/**
 * @template T
 * @overload
 * @param {{state: import("@codemirror/state").EditorState, startState: import("@codemirror/state").EditorState}} param0
 * @param {import("@codemirror/state").StateField<T>} param1
 * @param {false} param2
 * @returns {[(T | undefined), (T | undefined)]}
 */

/**
 *
 * @template T
 * @param {{state: import("@codemirror/state").EditorState, startState: import("@codemirror/state").EditorState}} param0
 * @param {[import("@codemirror/state").StateField<T>] | [import("@codemirror/state").StateField<T>, false]} args
 * @returns {[(T | undefined), (T | undefined)]}
 */
export function getStatePairs({ state, startState }, ...args) {
  // @ts-ignore
  const oldValue = startState.field(...args);
  // @ts-ignore
  const newValue = state.field(...args);
  return [oldValue, newValue];
}

/**
 * @typedef {import("@codemirror/state").Facet<T, U extends undefined ? never : U>} NonUndefinedFacet<T, U>
 * @template T, U
 */

/**
 * Examine if a refresh is needed by comparing the provided facet's old and new values.
 * The new value is returned if true.
 * @template T, U
 * @param {{state: import("@codemirror/state").EditorState, startState: import("@codemirror/state").EditorState}} param0
 * @param {NonUndefinedFacet<T, U>} facet
 * @returns {U | undefined}
 */
export function getFacetIfNeedsRefresh({ state, startState }, facet) {
  // @ts-ignore
  const oldValue = startState.facet(facet);
  // @ts-ignore
  const newValue = state.facet(facet);
  return oldValue !== newValue ? newValue : undefined;
}

/**
 *
 * @template T, U
 * @param {{state: import("@codemirror/state").EditorState, startState: import("@codemirror/state").EditorState}} param0
 * @param {import("@codemirror/state").Facet<T, U>} facet
 * @returns {[U, U]}
 */
export function getFacetPairs({ state, startState }, facet) {
  // @ts-ignore
  const oldValue = startState.facet(facet);
  // @ts-ignore
  const newValue = state.facet(facet);
  return [oldValue, newValue];
}

/**
 *
 * @param {string} name
 * @param {string} [hint]
 */
export function logMissingField(name, hint) {
  console.warn("The extension %s is missing:", name, hint);
}

/**
 * @typedef {Omit<A, keyof B>} Diff<A, B>
 * @template A, B
 */

/**
 * @typedef {Diff<A, Diff<A, B>>} Intersect<A, B>
 * @template A, B
 */

/**
 * @typedef {X extends Y ? Y extends X ? Z : never : never} EqualThen<X, Y, Z>
 * @template X, Y, Z
 */

/**
 * @typedef {EqualThen<Intersect<InstanceType<T>, U>, Intersect<U, InstanceType<T>>,
 *  {new(...args: any[]): Diff<InstanceType<T>, U> & U} & T>}
 *  MixinType<T extends ClassType, U>
 * @template {new (...args: any[]) => {}} T
 * @template U
 */

/**
 * @template {new (...args: any[]) => {}} T
 * @template U
 * @param {T} t
 * @param {U} v
 * @returns {MixinType<T, U>}
 */
export function mixin(t, v) {
  Object.assign(t.prototype, v);
  // @ts-ignore
  return t;
}
