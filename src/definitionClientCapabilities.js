// @ts-check

import { ViewPlugin } from "@codemirror/view";

import { initializeParams } from "./client.js";
import { mixin } from "./utils.js";
import { providable } from "./providable.js";
import { hoverProviderMixin } from "./hoverClientCapabilities.js";

export const DefinitionProvider = mixin(
  providable("textDocument/definition", (r) => r || null),
  hoverProviderMixin,
);

export const definitionProvider = ViewPlugin.fromClass(
  DefinitionProvider,
  DefinitionProvider.spec,
);

export default function () {
  return [
    definitionProvider,
    initializeParams.of({
      capabilities: {
        textDocument: {
          definition: {},
        },
      },
    }),
  ];
}
