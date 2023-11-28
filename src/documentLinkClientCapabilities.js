// @ts-check

import { ViewPlugin } from "@codemirror/view";
import { produce } from "immer";

import { initializeParams } from "./client";
import { getValueIfNeedsRefresh } from "./utils";
import { textDocument } from "./textDocumentSyncClientCapabilities";
import { providable } from "./providable";

class BaseDocumentLinkProvider extends providable(
  "textDocument/documentLink",
  (response) => response || null,
) {}

/**
 * @typedef Link
 * @type {import("vscode-languageserver-types").DocumentLink}
 */

class BaseDocumentLinkResolver extends providable(
  "documentLink/resolve",
  () => /** @type {Link[]} */ ([]),
  (value, tr) =>
    produce(value, (draft) => {
      for (const effect of tr.effects) {
        if (effect.is(BaseDocumentLinkProvider.effect)) {
          draft.length = 0;
        } else if (effect.is(BaseDocumentLinkResolver.effect)) {
          draft.push(effect.value);
        }
      }
    }),
) {}

export class DocumentLinkProvider extends BaseDocumentLinkProvider {
  /** @type {BaseDocumentLinkProvider['params']} */
  params(update) {
    return {
      textDocument: update.state.field(textDocument),
    };
  }
}

export class DocumentLinkResolver extends BaseDocumentLinkResolver {
  /** @type {Link[] | undefined} */
  links;

  /** @type {BaseDocumentLinkResolver['isCapable']} */
  isCapable(capability) {
    return !!capability?.resolveProvider;
  }

  /** @type {BaseDocumentLinkResolver['needsRefresh']} */
  needsRefresh(update) {
    const links = getValueIfNeedsRefresh(
      update,
      BaseDocumentLinkResolver.state,
    );
    this.links = links;
    return !!links;
  }

  /** @type {BaseDocumentLinkResolver['refresh']} */
  refresh(update, c) {
    this.links?.forEach((link) => {
      if (!link.target) {
        this.sendRequest(c, link)
          .then((link) => link.target && this.dispatch(update, link))
          .catch(console.error);
      }
    });
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
