// @ts-check

import { StateField, StateEffect } from "@codemirror/state";
import { ViewPlugin } from "@codemirror/view";
import { produce } from "immer";

/**
 * @typedef FileInfo
 * @type {{
 *   uri: import("vscode-languageserver-types").URI,
 *   languageId: string,
 *   type: "textDocument",
 * }}
 */

/** @type {import("@codemirror/state").StateEffectType<FileInfo['uri']>} */
export const fileOpenEffect = StateEffect.define();

/** @type {import("@codemirror/state").StateEffectType<FileInfo['languageId']>} */
export const fileChangeLanguageEffect = StateEffect.define();

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
        if (effect.is(fileOpenEffect)) {
          draft.uri = effect.value;
        } else if (effect.is(fileChangeLanguageEffect)) {
          draft.languageId = effect.value;
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
      const oldFileInfo = update.startState.field(fileInfo);
      const newFileInfo = update.state.field(fileInfo);
      if (oldFileInfo.uri !== newFileInfo.uri) {
        openFile(newFileInfo.uri).then((text) => {
          update.view.dispatch({
            changes: {
              from: 0,
              to: update.state.doc.length,
              insert: text,
            },
          });
        });
      }
    },
  };
});

export default function () {
  return [fileInfo, fileLoader];
}
