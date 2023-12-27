// @ts-check

import { ViewPlugin } from "@codemirror/view";
import { produce } from "immer";

import { initializeParams } from "./client.js";
import { getStateIfNeedsRefresh } from "./utils.js";
import { textDocument } from "./textDocumentSyncClientCapabilities.js";
import { providable } from "./providable.js";

/**
 * @typedef Link
 * @type {import("vscode-languageserver-types").DocumentLink}
 */

const BaseDocumentLinkProvider = providable(
  "textDocument/documentLink",
  (r) => r || null,
);

const BaseDocumentLinkResolver = providable(
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
);

export class DocumentLinkProvider extends BaseDocumentLinkProvider {
  refreshAfterSynchronization = true;

  /** @type {InstanceType<BaseDocumentLinkProvider>['params']} */
  params(update) {
    return {
      textDocument: update.state.field(textDocument),
    };
  }
}

export class DocumentLinkResolver extends BaseDocumentLinkResolver {
  /** @type {Link[] | null | undefined} */
  links;

  /** @type {InstanceType<BaseDocumentLinkResolver>['isCapable']} */
  isCapable(r, provider) {
    return !!r[provider]?.resolveProvider;
  }

  /** @type {InstanceType<BaseDocumentLinkResolver>['needsRefresh']} */
  needsRefresh(update) {
    const links = getStateIfNeedsRefresh(
      update,
      BaseDocumentLinkProvider.state,
    );
    this.links = links;
    return !!links;
  }

  /** @type {InstanceType<BaseDocumentLinkResolver>['refresh']} */
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

export const documentLinkProvider = ViewPlugin.fromClass(
  DocumentLinkProvider,
  DocumentLinkProvider.spec,
);

export const documentLinkResolver = ViewPlugin.fromClass(
  DocumentLinkResolver,
  DocumentLinkResolver.spec,
);

export default function () {
  return [
    documentLinkProvider,
    documentLinkResolver,
    initializeParams.of({
      capabilities: { textDocument: { documentLink: {} } },
    }),
  ];
}
