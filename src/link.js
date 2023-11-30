// @ts-check

import { Facet, StateField } from "@codemirror/state";
import { hoverTooltip, Decoration, EditorView } from "@codemirror/view";

import {
  DocumentLinkProvider,
  DocumentLinkResolver,
} from "./documentLinkClientCapabilities";
import { binarySearch, compareRange, lspRangeToCmRange } from "./utils";

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
  const links = state.field(DocumentLinkProvider.state);
  if (!links) {
    return [];
  }

  const result = [...links];
  result.sort(compareLinkRange);

  for (const resolved of state.field(DocumentLinkResolver.state)) {
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

/**
 * @typedef DocumentLinkState
 * @type {{decorations: import("@codemirror/view").DecorationSet, links: readonly import("vscode-languageserver-protocol").DocumentLink[]}}
 */

/**
 *
 * @param {readonly import("vscode-languageserver-protocol").DocumentLink[]} links
 * @param {import("@codemirror/state").Text} doc
 * @returns {DocumentLinkState}
 */
function createDocumentLinkState(links, doc) {
  const decorations = Decoration.set(
    links.map((link, i) =>
      Decoration.mark({ class: "cm-linkRange", i }).range(
        ...lspRangeToCmRange(link.range, doc),
      ),
    ),
  );

  return { links, decorations };
}

/**
 * @this {import("@codemirror/view").EditorView}
 * @param {import("vscode-languageserver-protocol").DocumentLink} link
 * @returns {import("@codemirror/view").TooltipView}
 */
function createDocumentLinkTooltipView(link) {
  const dom = document.createElement("div");
  dom.textContent = link.target || null;
  return { dom };
}

/**
 *
 * @param {import("@codemirror/state").StateField<DocumentLinkState>} field
 */
function createDocumentLinkTooltip(field) {
  return hoverTooltip((view, pos) => {
    const { links, decorations } = view.state.field(field);
    let start = 0,
      end = 0,
      i = -1;
    decorations.between(pos, pos, (from, to, { spec }) => {
      start = from;
      end = to;
      i = spec.i;
      return false;
    });

    if (i === -1) {
      return null;
    }

    return {
      pos: start,
      end,
      above: true,
      create: (view) => createDocumentLinkTooltipView.call(view, links[i]),
    };
  });
}

export const documentLink = StateField.define({
  /** @returns {DocumentLinkState} */
  create() {
    return { links: [], decorations: Decoration.none };
  },
  update(value, tr) {
    const oldLinks = tr.startState.facet(documentLinkFacet);
    const newLinks = tr.state.facet(documentLinkFacet);
    if (oldLinks !== newLinks) {
      value = createDocumentLinkState(newLinks, tr.newDoc);
    } else if (tr.docChanged) {
      value = { ...value, decorations: value.decorations.map(tr.changes) };
    }

    return value;
  },
  provide(field) {
    return [
      documentLinkFacet.computeN(
        [DocumentLinkProvider.state, DocumentLinkResolver.state],
        computeNDocumentLinks,
      ),
      EditorView.decorations.from(field, (state) => state.decorations),
      createDocumentLinkTooltip(field),
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
