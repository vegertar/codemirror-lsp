import { Facet, EditorState } from "@codemirror/state";
import { InitializeParams, TraceValues } from "vscode-languageserver-protocol";
import merge from "lodash.merge";
import { firstAvailable } from "./utils";

/**
 * The extension to declare Trace.
 *  @type {Facet<TraceValues, TraceValues>}
 */
export const trace = Facet.define({
  combine: (values) => firstAvailable(values),
});

/**
 * Merge the Trace into the provided InitializeParams.
 * @param {EditorState} state
 * @param {InitializeParams} initializeParams
 * @returns {InitializeParams}
 */
export function mergeTrace(state, initializeParams) {
  const value = state.facet(trace, false);

  value && merge(initializeParams, { trace: value });
}

export default trace;
