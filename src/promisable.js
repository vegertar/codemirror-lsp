// @ts-check

import { StateField } from "@codemirror/state";

import { getLastValueFromTransaction } from "./utils";

/**
 * @typedef PromisingState
 * @type {StateField<null | [Promise<void>, () => void, (reason?: any) => void]>}
 */

/**
 * @template U
 * @param {import("@codemirror/state").Facet<Promise<void>, Promise<void | void[]>>} facet
 * @param {import("@codemirror/state").StateEffectType<U>} effect
 */
export function promisable(facet, effect) {
  return class Promising {
    /** @type {PromisingState} */
    static state = StateField.define({
      create() {
        return null;
      },

      // @ts-ignore
      update(value, tr) {
        if (getLastValueFromTransaction(tr, effect) !== undefined) {
          let resolve, reject;

          const promise = new Promise((r0, r1) => {
            resolve = r0;
            reject = r1;
          });

          return [promise, resolve, reject];
        }
        return value;
      },

      provide: (f) => facet.from(f, (value) => value?.[0] || Promise.resolve()),
    });

    /**
     *
     * @param {import("@codemirror/state").EditorState} state
     */
    static resolver(state) {
      return state.field(Promising.state)?.[1];
    }

    /**
     *
     * @param {import("@codemirror/state").EditorState} state
     */
    static rejector(state) {
      return state.field(Promising.state)?.[2];
    }
  };
}
