// @ts-check

import { Facet, StateField } from "@codemirror/state";
import { Decoration, EditorView } from "@codemirror/view";

import { binarySearch, compareRange, lspRangeToCmRange } from "./utils";
import {
  DocumentLinkProvider,
  DocumentLinkResolver,
} from "./documentLinkClientCapabilities";

/**
 *
 * @param {import("vscode-languageserver-protocol").DocumentLink} a
 * @param {import("vscode-languageserver-protocol").DocumentLink} b
 * @returns {number}
 */
function compareLinkRange(a, b) {
  return compareRange(a.range, b.range);
}

/**
 *
 * @param {import("@codemirror/state").EditorState} state
 * @returns {import("vscode-languageserver-protocol").DocumentLink[]}
 */
function computeNDocumentLinks(state) {
  const links = state.field(DocumentLinkProvider.links);
  if (!links) {
    return [];
  }

  const result = [...links];
  result.sort(compareLinkRange);

  for (const resolved of state.field(DocumentLinkResolver.links)) {
    const i = binarySearch(result, resolved, compareLinkRange);
    const provided = result[i];
    if (!provided || compareLinkRange(resolved, provided) !== 0) {
      const { start, end } = resolved.range;
      throw new Error(
        `The resolved link is unknown: .range(${start.line}:${start.character}, ${end.line}:${end.character} .target(${resolved.target})`,
      );
    }
    result[i] = resolved;
  }

  return result;
}

/** @type {import("@codemirror/state").Facet<import("vscode-languageserver-protocol").DocumentLink>} */
const documentLinkFacet = Facet.define({
  compareInput(a, b) {
    return a.target === b.target && compareLinkRange(a, b) === 0;
  },
});

const documentLinkMark = Decoration.mark({});

/**
 * @typedef DocumentLinkState
 * @type {{links: import("@codemirror/view").DecorationSet}}
 */

/**
 *
 * @param {readonly import("vscode-languageserver-protocol").DocumentLink[]} links
 * @param {import("@codemirror/state").Text} doc
 * @returns {DocumentLinkState}
 */
function createDocumentLinkState(links, doc) {
  const ranges = Decoration.set(
    links.map((link) =>
      documentLinkMark.range(...lspRangeToCmRange(link.range, doc)),
    ),
  );

  return {
    links: ranges,
  };
}

export const documentLink = StateField.define({
  /** @returns {DocumentLinkState} */
  create() {
    return { links: Decoration.none };
  },
  update(value, tr) {
    const oldLinks = tr.startState.facet(documentLinkFacet);
    const newLinks = tr.state.facet(documentLinkFacet);
    if (oldLinks !== newLinks) {
      value = createDocumentLinkState(newLinks, tr.newDoc);
    } else if (tr.docChanged) {
      value = { links: value.links.map(tr.changes) };
    }

    return value;
  },
  provide() {
    return documentLinkFacet.computeN(
      [DocumentLinkProvider.links, DocumentLinkResolver.links],
      computeNDocumentLinks,
    );
  },
});

export default function () {
  return [
    EditorView.decorations.compute([documentLink], (state) => {
      console.log(state.field(documentLink));
      return Decoration.none;
    }),
  ];
}
