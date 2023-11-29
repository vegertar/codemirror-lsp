// @ts-check

import { ViewPlugin } from "@codemirror/view";

import { initializeParams } from "./client";
import { providable } from "./providable";
import { textDocument } from "./textDocumentSyncClientCapabilities";

export class DocumentSymbolProvider extends providable(
  "textDocument/documentSymbol",
  (r) => r || null,
) {
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
