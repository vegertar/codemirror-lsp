// @ts-check

import { StateField, StateEffect, Annotation } from "@codemirror/state";
import { ViewPlugin } from "@codemirror/view";
import { produce } from "immer";

import { followLinkEvent } from "./link";

/**
 * @typedef FileInfo
 * @type {{
 *   uri: import("vscode-languageserver-types").URI,
 *   languageId: string,
 *   type: "textDocument",
 * }}
 */

/** @type {import("@codemirror/state").StateEffectType<FileInfo['uri']>} */
export const fileLoadEffect = StateEffect.define();

/** @type {import("@codemirror/state").AnnotationType<"load">} */
export const fileEvent = Annotation.define();

/** @type {import("@codemirror/state").StateField<FileInfo>} */
export const fileInfo = StateField.define({
  create() {
    return {
      uri: "untitled:Untitled",
      languageId: "plaintext",
      type: "textDocument",
    };
  },
  update(value, tr) {
    return produce(value, (draft) => {
      for (const effect of tr.effects) {
        if (effect.is(fileLoadEffect)) {
          draft.uri = effect.value;
        }
      }
    });
  },
});

/**
 *
 * @param {string} uri
 */
async function openFile(uri) {
  let url = new URL(uri);
  if (url.protocol === "file:") {
    url = new URL(url.pathname, location.toString());
  }

  const response = await fetch(url);
  return await response.text();
}

export const fileLoader = ViewPlugin.define(() => {
  return {
    update(update) {
      update.transactions.forEach((tr) => {
        const uri = tr.annotation(followLinkEvent)?.link.target;
        if (uri) {
          openFile(uri).then((text) => {
            update.view.dispatch({
              annotations: fileEvent.of("load"),
              effects: fileLoadEffect.of(uri),
              changes: {
                from: 0,
                to: update.state.doc.length,
                insert: text,
              },
            });
          });
        }
      });
    },
  };
});

export default function () {
  return [fileInfo, fileLoader];
}
