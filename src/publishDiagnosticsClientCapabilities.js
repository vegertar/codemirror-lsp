import { Facet } from "@codemirror/state";
import merge from "lodash.merge";
import { firstAvailable } from "./utils";

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

export function mergePublishDiagnosticsClientCapabilities(state, config) {
  const publishDiagnostics = state.facet(
    publishDiagnosticsClientCapabilities,
    false
  );

  return merge(config, {
    capabilities: {
      textDocument: {
        publishDiagnostics,
      },
    },
  });
}

export default publishDiagnosticsClientCapabilities;
