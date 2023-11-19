// @ts-check

import { initializeParams } from "./client";

/** @type {import("vscode-languageserver-protocol").TextDocumentSyncClientCapabilities} */
const defaultValue = {
  dynamicRegistration: true,
  willSave: true,
  willSaveWaitUntil: true,
  didSave: true,
};

export default function (synchronization = defaultValue) {
  return initializeParams.of({
    capabilities: {
      textDocument: {
        synchronization,
      },
    },
  });
}
