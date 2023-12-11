// @ts-check

import { Facet } from "@codemirror/state";
import { showTooltip } from "@codemirror/view";
import * as components from "@components";

import { Hover, HoverProvider } from "../hoverClientCapabilities";
import { documentLink } from "./link";

/**
 * @typedef DocumentLinkHint
 * @type {{
 *   type: "document-link",
 *   value: import("vscode-languageserver-types").DocumentLink,
 * }}
 */

/**
 * @typedef HoverHint
 * @type {{
 *  type: "hover",
 *  value: import("vscode-languageserver-types").Hover,
 * }}
 */

/**
 * @typedef Hint
 * @type {DocumentLinkHint | HoverHint}
 */

/**
 * Facet to which an extension can add a value to display a tooltip at the mouse hover position.
 * @type {Facet<Hint | null>}
 */
export const hint = Facet.define();

export class HintView {
  /**
   *
   * @param {import("@codemirror/view").EditorView} view
   */
  // eslint-disable-next-line no-unused-vars
  constructor(view) {
    this.dom = document.createElement("div");
    this.dom.classList.add("cm-lsp-hint");
  }

  /**
   * Implementation of TooltipView
   * @type {HTMLElement}
   */
  dom;

  /**
   * Implementation of TooltipView
   * @type {{x: number, y: number} | undefined}
   */
  offset;

  /**
   * Implementation of TooltipView
   * @type {((pos: number) => import("@codemirror/view").Rect) | undefined}
   */
  getCoords;

  /**
   * Implementation of TooltipView
   * @type {boolean | undefined}
   */
  overlap;

  /**
   * Implementation of TooltipView
   * @param {import("@codemirror/view").EditorView} view
   */
  // eslint-disable-next-line no-unused-vars
  mount(view) {
    this.hint = new components.Hint({ target: this.dom });
  }

  /**
   * Implementation of TooltipView
   * @param {import("@codemirror/view").ViewUpdate} update
   */
  update(update) {
    this.hint?.$set({
      hints: /** @type {Hint[]} */ (update.state.facet(hint).filter((x) => x)),
    });
  }

  /**
   * Implementation of TooltipView
   */
  destroy() {
    this.hint?.$destroy();
  }

  /**
   * Implementation of TooltipView
   * @type {((space: import("@codemirror/view").Rect) => void) | undefined}
   */
  positioned;

  /**
   * Implementation of TooltipView
   * @type {boolean | undefined}
   */
  resize;
}

function showHint() {
  return showTooltip.compute([Hover.state], (state) => ({
    pos: state.field(Hover.state),
    create: (view) => new HintView(view),
  }));
}

function createDocumentLinkHint() {
  return hint.compute([Hover.state, documentLink], (state) => {
    const pos = Hover.value(state, "required by document link hint");
    const result = pos != null && state.field(documentLink).find(pos);
    return result ? { type: "document-link", value: result.link } : null;
  });
}

function createHoverHint() {
  return hint.compute([Hover.state, HoverProvider.state], (state) => {
    const pos = Hover.value(state, "required by hover hint");
    const response = state.field(HoverProvider.state);
    if (response && response.pos === pos) {
      return { type: "hover", value: response };
    }
    return null;
  });
}

export default function () {
  return [showHint(), createDocumentLinkHint(), createHoverHint()];
}
