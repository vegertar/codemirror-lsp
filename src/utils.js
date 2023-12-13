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
 * Convert given text position from LSP to the CodeMirror Position.
 * @param {import("vscode-languageserver-types").Position} pos
 * @param {import("@codemirror/state").Text} text
 * @returns {number}
 */
export function lspPositionToCm(pos, text) {
  const line = text.line(pos.line + 1);
  return line.from + pos.character;
}

/**
 * Convert given text position from LSP to the CodeMirror Position.
 * @param {import("vscode-languageserver-types").Range} range
 * @param {import("@codemirror/state").Text} text
 * @returns {[number, number]}
 */
export function lspRangeToCm(range, text) {
  return [lspPositionToCm(range.start, text), lspPositionToCm(range.end, text)];
}

/**
 * Convert the diagnostic severity from LSP to CodeMirror.
 * @param {import("vscode-languageserver-types").DiagnosticSeverity | undefined} severity
 * @returns {import("@codemirror/lint").Diagnostic['severity']}
 */
export function lspSeverityToCm(severity) {
  switch (severity) {
    case 1:
      return "error";
    case 2:
      return "warning";
    case 3:
      return "info";
    default:
      return "hint";
  }
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
export function getValueIfNeedsRefresh({ state, startState }, ...args) {
  // @ts-ignore
  const oldValue = startState.field(...args);
  // @ts-ignore
  const newValue = state.field(...args);
  return oldValue !== newValue ? newValue : undefined;
}

/**
 *
 * @param {import("vscode-languageserver-types").Position} a
 * @param {import("vscode-languageserver-types").Position} b
 * @returns {number}
 */
export function comparePosition(a, b) {
  const d = a.line - b.line;
  return d === 0 ? a.character - b.character : d;
}

/**
 *
 * @param {import("vscode-languageserver-types").Range} a
 * @param {import("vscode-languageserver-types").Range} b
 * @returns {number}
 */
export function compareRange(a, b) {
  const d = comparePosition(a.start, b.start);
  return d === 0 ? comparePosition(a.end, b.end) : d;
}

/**
 *
 * @template T
 * @param {T[]} array
 * @param {T} item
 * @param {(item: T, mid: T) => number} f
 * @param {number} [first]
 * @param {number} [last]
 */
export function binarySearch(array, item, f, first, last) {
  let start = first || 0;
  let end = last || array.length;

  while (start < end) {
    const mid = start + Math.floor((end - start) / 2);
    const d = f(item, array[start + mid]);
    if (d === 0) {
      return mid;
    }

    if (d < 0) {
      end = mid;
    } else {
      start = mid;
    }
  }

  return start;
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

/**
 * @typedef LifecycleCallbacks
 * @type {{
 *  connectedCallback?: () => void;
 *  disconnectedCallback?: () => void;
 * }}
 */

class LifecycleGuardElement extends HTMLElement {
  /** @type {LifecycleCallbacks | undefined} */
  lifeCycleCallbacks;

  connectedCallback() {
    this.lifeCycleCallbacks?.connectedCallback?.();
  }

  disconnectedCallback() {
    this.lifeCycleCallbacks?.disconnectedCallback?.();
  }
}

window.customElements.define("lifecycle-guard", LifecycleGuardElement);

/**
 *
 * @param {LifecycleCallbacks} lifecycleCallbacks
 */
export function lifecycleGuard(lifecycleCallbacks) {
  const element = /** @type {LifecycleGuardElement} */ (
    document.createElement("lifecycle-guard")
  );
  element.lifeCycleCallbacks = lifecycleCallbacks;
  return element;
}
