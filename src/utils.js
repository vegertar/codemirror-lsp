import { Transaction, StateEffectType } from "@codemirror/state";

/**
 * Get the first available element from within the provided array, otherwise return the default value.
 * @template T
 * @param {T[]} values
 * @param {T} [x]
 * @returns {T|null|undefined}
 */
export function firstAvailable(values, x) {
  if (values) {
    for (const v of values) {
      if (v) {
        return v;
      }
    }
  }
  return x;
}

/**
 * @template T
 * @param {Transaction} tr
 * @param {StateEffectType<T>} valueStateEffect
 * @returns T
 */
export function getLastValueFromTransaction(tr, valueStateEffect) {
  let value;
  for (const effect of tr.effects) {
    if (effect.is(valueStateEffect)) {
      value = effect.value;
    }
  }
  return value;
}
