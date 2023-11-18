import { Facet, EditorState } from "@codemirror/state";
import {
  TextDocumentSyncClientCapabilities,
  InitializeParams,
} from "vscode-languageserver-protocol";
import merge from "lodash.merge";
import { firstAvailable } from "./utils";

/**
 * The extension to declare TextDocumentSyncClientCapabilities.
 *  @type {Facet<TextDocumentSyncClientCapabilities, TextDocumentSyncClientCapabilities>}
 */
export const textDocumentSyncClientCapabilities = Facet.define({
  combine: (values) =>
    values.length
      ? firstAvailable(values, {
          dynamicRegistration: true,
          willSave: true,
          willSaveWaitUntil: true,
          didSave: true,
        })
      : null,
});

/**
 * Merge the TextDocumentSyncClientCapabilities into the provided InitializeParams.
 * @param {EditorState} state
 * @param {InitializeParams} initializeParams
 * @returns {void}
 */
export function mergeTextDocumentSyncClientCapabilities(
  state,
  initializeParams
) {
  const synchronization = state.facet(
    textDocumentSyncClientCapabilities,
    false
  );

  synchronization &&
    merge(initializeParams, {
      capabilities: {
        textDocument: {
          synchronization,
        },
      },
    });
}

export default textDocumentSyncClientCapabilities;
