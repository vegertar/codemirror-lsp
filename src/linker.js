// @ts-check

import { Facet, StateField } from "@codemirror/state";
import { Decoration, EditorView } from "@codemirror/view";

import { binarySearch, compareRange, lspRangeToCmRange } from "./utils";
import {
  DocumentLinkProvider,
  DocumentLinkResolver,
} from "./documentLinkClientCapabilities";

/**
 * @template {{range: import("vscode-languageserver-types").Range}} T
 * @param {T} param0
 * @param {T} param1
 * @returns {number}
 */
function compareLinkRange({ range: a }, { range: b }) {
  return compareRange(a, b);
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

const documentLinkMark = Decoration.mark({ class: "cm-linkRange" });

/**
 * @typedef DocumentLinkState
 * @type {{ranges: import("@codemirror/view").DecorationSet, links: readonly import("vscode-languageserver-protocol").DocumentLink[]}}
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

  return { links, ranges };
}

export const documentLink = StateField.define({
  /** @returns {DocumentLinkState} */
  create() {
    return { links: [], ranges: Decoration.none };
  },
  update(value, tr) {
    const oldLinks = tr.startState.facet(documentLinkFacet);
    const newLinks = tr.state.facet(documentLinkFacet);
    if (oldLinks !== newLinks) {
      value = createDocumentLinkState(newLinks, tr.newDoc);
    } else if (tr.docChanged) {
      value = { ...value, ranges: value.ranges.map(tr.changes) };
    }

    return value;
  },
  provide(field) {
    return [
      documentLinkFacet.computeN(
        [DocumentLinkProvider.links, DocumentLinkResolver.links],
        computeNDocumentLinks,
      ),
      EditorView.decorations.from(field, (state) => state.ranges),
    ];
  },
});

export const baseTheme = EditorView.baseTheme({
  ".cm-linkRange": {
    textDecoration: "underline 1px",
  },
});

export default function () {
  return [documentLink, baseTheme];
}
