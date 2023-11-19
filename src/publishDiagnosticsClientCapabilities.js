// @ts-check

import { ViewPlugin } from "@codemirror/view";

import { getConnectionAndInitializeResult, initializeParams } from "./client";

export const publishDiagnosticsNotification = ViewPlugin.define(() => {
  return {
    update(update) {
      const v = getConnectionAndInitializeResult(update.state);
      if (v && !v[1]) {
        v[0].onNotification("textDocument/publishDiagnostics", console.log);
      }
    },
  };
});

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

export default function (value = defaultValue) {
  return [
    publishDiagnosticsNotification,
    initializeParams.of({
      capabilities: {
        textDocument: {
          publishDiagnostics: value,
        },
      },
    }),
  ];
}
