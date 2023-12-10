// @ts-check

import { ViewPlugin } from "@codemirror/view";

import { initializeParams } from "./client";
import { mixin } from "./utils";
import { providable } from "./providable";
import { hoverProviderMixin } from "./hoverClientCapabilities";

export const TypeDefinitionProvider = mixin(
  providable("textDocument/typeDefinition", (r) => r || null),
  hoverProviderMixin,
);

export const typeDefinitionProvider = ViewPlugin.fromClass(
  TypeDefinitionProvider,
  TypeDefinitionProvider.spec,
);

export default function () {
  return [
    typeDefinitionProvider,
    initializeParams.of({
      capabilities: {
        textDocument: {
          typeDefinition: {},
        },
      },
    }),
  ];
}
