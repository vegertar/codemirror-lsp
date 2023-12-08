// @ts-check

import { hoverTooltip as createHoverTooltip } from "@codemirror/view";

import { getConnectionAndInitializeResult, initializeParams } from "./client";
import { textDocument } from "./textDocumentSyncClientCapabilities";
import { cmPositionToLsp, lspRangeToCm } from "./utils";

/**
 * @this {import("@codemirror/view").EditorView}
 * @param {import("vscode-languageserver-types").Hover} hover
 * @returns {import("@codemirror/view").TooltipView}
 */
function createView(hover) {
  const dom = document.createElement("div");
  dom.textContent = JSON.stringify(hover.contents);
  return { dom };
}

export const hoverTooltip = createHoverTooltip(async (view, pos) => {
  const v = getConnectionAndInitializeResult(view.state);
  if (!v?.[1]?.capabilities.hoverProvider) {
    return null;
  }

  const c = v[0];

  /** @type {import("vscode-languageserver-protocol").HoverParams} */
  const request = {
    textDocument: view.state.field(textDocument),
    position: cmPositionToLsp(pos, view.state.doc),
  };

  /** @type {import("vscode-languageserver-types").Hover | null} */
  const response = await c.sendRequest("textDocument/hover", request);
  if (!response) {
    return null;
  }

  /** @type {import("@codemirror/view").Tooltip} */
  const result = {
    pos,
    create: (view) => createView.call(view, response),
  };

  if (response.range) {
    const [start, end] = lspRangeToCm(response.range, view.state.doc);
    result.pos = start;
    result.end = end;
  } else {
    const line = view.state.doc.lineAt(pos);
    result.pos = line.from;
    result.end = line.to;
  }

  return result;
});

export default function () {
  return [
    // hoverTooltip,
    initializeParams.of({
      capabilities: {
        textDocument: {
          hover: {},
        },
      },
    }),
  ];
}
