// @ts-check

import { StateField, StateEffect } from "@codemirror/state";
import { ViewPlugin } from "@codemirror/view";
import { produce } from "immer";

import { getConnectionAndInitializeResult, initializeParams } from "./client";
import { getLastValueFromTransaction, getValueIfNeedsRefresh } from "./utils";
import {
  TextDocumentSynchronization,
  textDocument,
} from "./textDocumentSyncClientCapabilities";

export class DocumentLinkProvider {
  /** @type {import("@codemirror/state").StateEffectType<import("vscode-languageserver-types").DocumentLink[] | null>} */
  static effect = StateEffect.define();

  static links = StateField.define({
    /** @returns {import("vscode-languageserver-types").DocumentLink[] | null} */
    create() {
      return null;
    },
    update(value, tr) {
      return (
        getLastValueFromTransaction(tr, DocumentLinkProvider.effect) ||
        (tr.docChanged ? null : value)
      );
    },
  });

  /**
   *
   * @param {import("vscode-jsonrpc").MessageConnection} c
   * @param {import("vscode-languageserver-protocol").DocumentLinkParams} params
   * @returns {Promise<import("vscode-languageserver-types").DocumentLink[] | null>}
   */
  async requestDocumentLinks(c, params) {
    return await c.sendRequest("textDocument/documentLink", params);
  }

  /**
   * Implementation of the ViewPlugin update.
   * @param {import("@codemirror/view").ViewUpdate} update
   * @returns {void}
   */
  update(update) {
    const v = getConnectionAndInitializeResult(update.state);
    const option = v?.[1]?.capabilities.documentLinkProvider;
    if (!option) {
      return;
    }

    const newVersion = getValueIfNeedsRefresh(
      update,
      TextDocumentSynchronization.didVersion,
    );

    if (newVersion) {
      this.requestDocumentLinks(v[0], {
        textDocument: update.state.field(textDocument),
      })
        .then((links) =>
          update.view.dispatch({
            effects: DocumentLinkProvider.effect.of(links),
          }),
        )
        .catch(console.error);
    }
  }
}

export class DocumentLinkResolver {
  /** @type {import("@codemirror/state").StateEffectType<import("vscode-languageserver-types").DocumentLink>} */
  static effect = StateEffect.define();

  static links = StateField.define({
    /** @returns {import("vscode-languageserver-types").DocumentLink[]} */
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

    const newLinks = getValueIfNeedsRefresh(update, DocumentLinkProvider.links);
    if (newLinks !== undefined) {
      newLinks?.forEach((link) =>
        this.resolveDocumentLink(v[0], link)
          .then((link) =>
            update.view.dispatch({
              effects: DocumentLinkResolver.effect.of(link),
            }),
          )
          .catch(console.error),
      );
    }
  }
}

export const documentLinkProvider = [
  DocumentLinkProvider.links,
  ViewPlugin.fromClass(DocumentLinkProvider),
];

export const documentLinkResolver = [
  DocumentLinkResolver.links,
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
