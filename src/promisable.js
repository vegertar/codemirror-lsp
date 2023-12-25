// @ts-check

import { StateField } from "@codemirror/state";

import { getLastValueFromTransaction } from "./utils.js";

/**
 * @typedef {(value: T) => void} Resolve<T>
 * @template T
 */

/**
 * @typedef {(reason?: T) => void} Reject<T>
 * @template T
 */

/**
 * @typedef {[Promise<T>, Resolve<T>, Reject<any>]} PromisingState
 * @template T
 */

/**
 * @template T, U
 * @param {import("@codemirror/state").Facet<Promise<T>, Promise<T[]>>} facet
 * @param {import("@codemirror/state").StateEffectType<U>} effect
 */
export function promisable(facet, effect) {
  return class Promising {
    static state = StateField.define({
      /** @returns {PromisingState<T>} */
      create() {
        let resolve, reject;
        const promise = new Promise((r0, r1) => {
          resolve = r0;
          reject = r1;
        });

        // @ts-ignore
        return [promise, resolve, reject];
      },
      update(value, tr) {
        if (getLastValueFromTransaction(tr, effect) !== undefined) {
          value[2](new Error("Legacy Error"));
          value = this.create(tr.state);
        }
        return value;
      },
      provide: (f) => facet.from(f, (value) => value[0]),
    });

    /**
     *
     * @param {import("@codemirror/state").EditorState} state
     */
    static resolver(state) {
      return state.field(Promising.state)[1];
    }

    /**
     *
     * @param {import("@codemirror/state").EditorState} state
     */
    static rejector(state) {
      return state.field(Promising.state)[2];
    }
  };
}
