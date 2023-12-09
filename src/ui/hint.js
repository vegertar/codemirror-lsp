// @ts-check

import { Facet } from "@codemirror/state";
import { showTooltip } from "@codemirror/view";

import { Hover, HoverProvider } from "../hoverClientCapabilities";
import { lspRangeToCm } from "../utils";

/**
 * @this {import("@codemirror/view").EditorView}
 * @param {import("vscode-languageserver-types").Hover} hover
 * @returns {import("@codemirror/view").TooltipView}
 */
function createHoverHintView(hover) {
  const dom = document.createElement("div");
  dom.textContent = JSON.stringify(hover.contents);
  return { dom };
}

/**
 *
 * @param {import("@codemirror/state").EditorState} state
 */
function createHoverHint(state) {
  /** @type {import("../providable").HoverResponse | undefined} */
  const response = HoverProvider.value(state);
  const pos = Hover.value(state);

  if (response == null || pos == null) {
    return null;
  }

  /** @type {import("@codemirror/view").Tooltip} */
  const result = {
    pos,
    create: (view) => createHoverHintView.call(view, response),
  };

  if (response.range) {
    const [start, end] = lspRangeToCm(response.range, state.doc);
    result.pos = start;
    result.end = end;
  } else {
    const line = state.doc.lineAt(pos);
    result.pos = line.from;
    result.end = line.to;
  }

  return result;
}

/** @type {Facet<import("@codemirror/view").Tooltip | null>} */
export const hint = Facet.define();

export default function () {
  return [
    hint.compute([HoverProvider.state], createHoverHint),
    showTooltip.computeN([hint], (state) => state.facet(hint)),
  ];
}
