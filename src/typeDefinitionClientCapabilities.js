// @ts-check

import { ViewPlugin } from "@codemirror/view";

import { initializeParams } from "./client.js";
import { mixin } from "./utils.js";
import { providable } from "./providable.js";
import { hoverProviderMixin } from "./hoverClientCapabilities.js";

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
