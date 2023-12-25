// @ts-check

import { ViewPlugin } from "@codemirror/view";

import { initializeParams } from "./client.js";
import { providable } from "./providable.js";
import { textDocument } from "./textDocumentSyncClientCapabilities.js";

export class DocumentSymbolProvider extends providable(
  "textDocument/documentSymbol",
  (r) => r || null,
) {
  refreshAfterSynchronization = true;

  /**
   *
   * @param {import("@codemirror/view").ViewUpdate} update
   * @returns
   */
  params(update) {
    return {
      textDocument: update.state.field(textDocument),
    };
  }
}

export const documentSymbolProvider = [
  DocumentSymbolProvider.state,
  ViewPlugin.fromClass(DocumentSymbolProvider),
];

export default function () {
  return [
    documentSymbolProvider,
    initializeParams.of({
      capabilities: {
        textDocument: {
          documentSymbol: {},
        },
      },
    }),
  ];
}
