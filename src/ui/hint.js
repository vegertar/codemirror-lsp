// @ts-check

import { Facet } from "@codemirror/state";
import { showTooltip } from "@codemirror/view";

import { Hover, HoverProvider } from "../hoverClientCapabilities";
import { lspRangeToCm } from "../utils";
import { documentLink } from "./link";

/**
 *
 * @param {import("@codemirror/state").StateField<import("./link").DocumentLinkState>} field
 */
function createDocumentLinkHint(field) {
  /**
   * @this {import("@codemirror/view").EditorView}
   * @param {import("vscode-languageserver-protocol").DocumentLink} link
   * @returns {import("@codemirror/view").TooltipView}
   */
  function createView(link) {
    const dom = document.createElement("div");
    dom.textContent = link.target || null;
    return { dom };
  }

  return hint.compute([Hover.state], (state) => {
    const pos = Hover.value(state, "required by document link hint");
    const result = pos != null ? state.field(field).find(pos) : null;

    return (
      result && {
        pos: result.start,
        end: result.end,
        create: (view) => createView.call(view, result.link),
      }
    );
  });
}

/**
 *
 * @param {import("@codemirror/state").StateField<import("../providable").HoverResponse>} field
 */
function createHoverHint(field) {
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

  return hint.compute([HoverProvider.state], (state) => {
    const pos = Hover.value(state, "required by hover hint");
    const response = pos != null && state.field(field);
    if (!response) {
      return null;
    }

    /** @type {import("@codemirror/view").Tooltip} */
    const result = {
      pos,
      create: (view) => createView.call(view, response),
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
  });
}

/** @type {Facet<import("@codemirror/view").Tooltip | null>} */
export const hint = Facet.define();

export default function () {
  return [
    showTooltip.computeN([hint], (state) => state.facet(hint)),
    createDocumentLinkHint(documentLink),
    createHoverHint(HoverProvider.state),
  ];
}
