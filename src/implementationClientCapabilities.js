// @ts-check

import { ViewPlugin } from "@codemirror/view";

import { initializeParams } from "./client.js";
import { mixin } from "./utils.js";
import { providable } from "./providable.js";
import { hoverProviderMixin } from "./hoverClientCapabilities.js";

export const ImplementationProvider = mixin(
  providable("textDocument/implementation", (r) => r || null),
  hoverProviderMixin,
);

export const implementationProvider = ViewPlugin.fromClass(
  ImplementationProvider,
  ImplementationProvider.spec,
);

export default function () {
  return [
    implementationProvider,
    initializeParams.of({
      capabilities: {
        textDocument: {
          implementation: {},
        },
      },
    }),
  ];
}
