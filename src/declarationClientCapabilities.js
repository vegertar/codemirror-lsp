// @ts-check

import { ViewPlugin } from "@codemirror/view";

import { initializeParams } from "./client";
import { mixin } from "./utils";
import { providable } from "./providable";
import { hoverProviderMixin } from "./hoverClientCapabilities";

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
