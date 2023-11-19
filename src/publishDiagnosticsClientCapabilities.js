// @ts-check

import { initializeParams } from "./client";

/** @type {import("vscode-languageserver-protocol").PublishDiagnosticsClientCapabilities} */
const defaultValue = {
  relatedInformation: true,
  versionSupport: false,
  tagSupport: {
    valueSet: [1, 2],
  },
  codeDescriptionSupport: true,
  dataSupport: true,
};

export default function (publishDiagnostics = defaultValue) {
  return initializeParams.of({
    capabilities: {
      textDocument: {
        publishDiagnostics,
      },
    },
  });
}
