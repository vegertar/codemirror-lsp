// @ts-check

import { ViewPlugin } from "@codemirror/view";

import { initializeParams } from "./client";
import { mixin } from "./utils";
import { providable } from "./providable";
import { hoverProviderMixin } from "./hoverClientCapabilities";

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
