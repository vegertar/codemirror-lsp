// @ts-check

import { StateField, StateEffect } from "@codemirror/state";
import { produce } from "immer";
import { ViewPlugin } from "@codemirror/view";

import { getConnectionAndInitializeResult, initializeParams } from "./client";
import { getValueIfNeedsRefresh } from "./utils";
import { textDocument } from "./textDocumentSyncClientCapabilities";
import { providable } from "./providable";

export class DocumentLinkProvider extends providable(
  "textDocument/documentLink",
) {
  /**
   *
   * @param {import("@codemirror/view").ViewUpdate} update
   * @returns
   */
  params(update) {
    return {
      textDocument: update.state.field(textDocument),
    };
  }
}

/**
 * @typedef ResolvedDocumentLink
 * @type {Omit<import("vscode-languageserver-types").DocumentLink, "target"> & {target: import("vscode-languageserver-types").URI}}
 */

export class DocumentLinkResolver {
  /** @type {import("@codemirror/state").StateEffectType<ResolvedDocumentLink>} */
  static effect = StateEffect.define();

  static state = StateField.define({
    /** @returns {ResolvedDocumentLink[]} */
    create() {
      return [];
    },
    update(value, tr) {
      return produce(value, (draft) => {
        for (const effect of tr.effects) {
          if (effect.is(DocumentLinkProvider.effect)) {
            draft.length = 0;
          } else if (effect.is(DocumentLinkResolver.effect)) {
            draft.push(effect.value);
          }
        }
      });
    },
  });

  /**
   *
   * @param {import("vscode-jsonrpc").MessageConnection} c
   * @param {import("vscode-languageserver-protocol").DocumentLink} params
   * @returns {Promise<import("vscode-languageserver-types").DocumentLink>}
   */
  async resolveDocumentLink(c, params) {
    return await c.sendRequest("documentLink/resolve", params);
  }

  /**
   * Implementation of the ViewPlugin update.
   * @param {import("@codemirror/view").ViewUpdate} update
   * @returns {void}
   */
  update(update) {
    const v = getConnectionAndInitializeResult(update.state);
    if (!v || !v[1]) {
      return;
    }

    const option = v[1].capabilities.documentLinkProvider;
    if (!option?.resolveProvider) {
      return;
    }

    const newLinks = getValueIfNeedsRefresh(update, DocumentLinkProvider.state);
    if (newLinks !== undefined) {
      newLinks?.forEach((link) => {
        if (!link.target) {
          this.resolveDocumentLink(v[0], link)
            .then(
              (link) =>
                link.target &&
                update.view.dispatch({
                  // @ts-ignore
                  effects: DocumentLinkResolver.effect.of(link),
                }),
            )
            .catch(console.error);
        }
      });
    }
  }
}

export const documentLinkProvider = [
  DocumentLinkProvider.state,
  ViewPlugin.fromClass(DocumentLinkProvider),
];

export const documentLinkResolver = [
  DocumentLinkResolver.state,
  ViewPlugin.fromClass(DocumentLinkResolver),
];

export default function () {
  return [
    documentLinkProvider,
    documentLinkResolver,
    initializeParams.of({
      capabilities: { textDocument: { documentLink: {} } },
    }),
  ];
}
