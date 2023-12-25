// @ts-check

import { ViewPlugin } from "@codemirror/view";

import { initializeParams } from "./client.js";
import { mixin } from "./utils.js";
import { providable } from "./providable.js";
import { hoverProviderMixin } from "./hoverClientCapabilities.js";

export const DeclarationProvider = mixin(
  providable("textDocument/declaration", (r) => r || null),
  hoverProviderMixin,
);

export const declarationProvider = ViewPlugin.fromClass(
  DeclarationProvider,
  DeclarationProvider.spec,
);

export default function () {
  return [
    declarationProvider,
    initializeParams.of({
      capabilities: {
        textDocument: {
          declaration: {},
        },
      },
    }),
  ];
}
