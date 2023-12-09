// @ts-check

import { ViewPlugin } from "@codemirror/view";

import { initializeParams } from "./client";
import { textDocument } from "./textDocumentSyncClientCapabilities";
import {
  cmPositionToLsp,
  getValueIfNeedsRefresh,
  logMissingField,
} from "./utils";
import { hoverable } from "./hoverable";
import { providable } from "./providable";

export class Hover extends hoverable() {
  /**
   *
   * @param {import("@codemirror/state").EditorState} state
   */
  static value(state) {
    const pos = state.field(Hover.state, false);
    if (pos === undefined) {
      logMissingField("Hover.state");
    } else if (isNaN(pos)) {
      return null;
    }
    return pos;
  }
}

export class HoverProvider extends providable(
  "textDocument/hover",
  (r) => r || null,
) {
  /**
   *
   * @param {import("@codemirror/state").EditorState} state
   * @returns
   */
  static value(state) {
    const response = state.field(HoverProvider.state, false);
    if (response === undefined) {
      logMissingField("HoverProvider.state");
    }
    return response;
  }

  pos = NaN;

  /**
   *
   * @param {import("@codemirror/view").ViewUpdate} update
   * @returns
   */
  params(update) {
    if (isNaN(this.pos)) {
      throw new Error("Invalid pos");
    }
    return {
      textDocument: update.state.field(textDocument),
      position: cmPositionToLsp(this.pos, update.view.state.doc),
    };
  }

  /**
   *
   * @param {import("@codemirror/view").ViewUpdate} update
   * @returns
   */
  needsRefresh(update) {
    const pos = getValueIfNeedsRefresh(update, Hover.state, false);
    if (pos === undefined || isNaN(pos)) {
      return false;
    }

    this.pos = pos;
    return true;
  }
}

export const hover = ViewPlugin.fromClass(Hover, Hover.spec);

export const hoverProvider = ViewPlugin.fromClass(
  HoverProvider,
  HoverProvider.spec,
);

export default function () {
  return [
    hover,
    hoverProvider,
    initializeParams.of({
      capabilities: {
        textDocument: {
          hover: {},
        },
      },
    }),
  ];
}
