import { Facet, EditorState } from "@codemirror/state";
import {
  PublishDiagnosticsClientCapabilities,
  InitializeParams,
} from "vscode-languageserver-protocol";
import merge from "lodash.merge";
import { firstAvailable } from "./utils";

/**
 * The extension to declare PublishDiagnosticsClientCapabilities.
 *  @type {Facet<PublishDiagnosticsClientCapabilities, PublishDiagnosticsClientCapabilities>}
 */
export const publishDiagnosticsClientCapabilities = Facet.define({
  combine: (values) =>
    values.length
      ? firstAvailable(values, {
          relatedInformation: true,
          versionSupport: false,
          tagSupport: {
            valueSet: [1, 2],
          },
          codeDescriptionSupport: true,
          dataSupport: true,
        })
      : null,
});

/**
 * Merge the PublishDiagnosticsClientCapabilities into the provided InitializeParams.
 * @param {EditorState} state
 * @param {InitializeParams} initializeParams
 * @returns {InitializeParams}
 */
export function mergePublishDiagnosticsClientCapabilities(
  state,
  initializeParams
) {
  const publishDiagnostics = state.facet(
    publishDiagnosticsClientCapabilities,
    false
  );

  return merge(initializeParams, {
    capabilities: {
      textDocument: {
        publishDiagnostics,
      },
    },
  });
}

export default publishDiagnosticsClientCapabilities;
