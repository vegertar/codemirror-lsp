// @ts-check

import { ViewPlugin } from "@codemirror/view";

import { initializeParams } from "./client";
import { mixin } from "./utils";
import { providable } from "./providable";
import { hoverProviderMixin } from "./hoverClientCapabilities";

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
