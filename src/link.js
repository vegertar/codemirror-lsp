// @ts-check

import { EditorState, Facet, StateField, StateEffect } from "@codemirror/state";
import { hoverTooltip, Decoration, EditorView } from "@codemirror/view";

import {
  DocumentLinkProvider,
  DocumentLinkResolver,
} from "./documentLinkClientCapabilities";
import { binarySearch, compareRange, lspRangeToCmRange } from "./utils";
import { fileOpenEffect } from "./file";

/**
 * @typedef {import("vscode-languageserver-protocol").DocumentLink} DocumentLink
 */

/**
 * @typedef DocumentLinkStateDetail
 * @type {{
 *   start: number,
 *   end: number,
 *   link: DocumentLink,
 *   pos: number,
 * }}
 */

/**
 * @typedef DocumentLinkState
 * @type {{
 *   decorations: import("@codemirror/view").DecorationSet,
 *   links: readonly DocumentLink[],
 *   find: (pos: number, side?: -1 | 1) => null | DocumentLinkStateDetail,
 * }}
 */

/**
 *
 * @param {readonly DocumentLink[]} links
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

  return {
    links,
    decorations,
    find(pos) {
      let start = 0,
        end = 0,
        i = -1;

      this.decorations.between(pos, pos, (from, to, { spec }) => {
        start = from;
        end = to;
        i = spec.i;
        return false;
      });

      return i === -1 ? null : { link: this.links[i], start, end, pos };
    },
  };
}

/**
 * @template {{range: import("vscode-languageserver-types").Range}} T
 * @param {T} param0
 * @param {T} param1
 * @returns {number}
 */
function compareLinkRange({ range: a }, { range: b }) {
  return compareRange(a, b);
}

/** @type {import("@codemirror/state").Facet<DocumentLink>} */
const documentLinkFacet = Facet.define({
  compareInput(a, b) {
    return a.target === b.target && compareLinkRange(a, b) === 0;
  },
});

/** @type {import("@codemirror/state").StateEffectType<DocumentLinkStateDetail>} */
const documentLinkFollowEffect = StateEffect.define();

function createDocumentLinkCollection() {
  return documentLinkFacet.computeN(
    [DocumentLinkProvider.state, DocumentLinkResolver.state],
    (state) => {
      /** @type {DocumentLink[] | null} */
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
    },
  );
}

/**
 *
 * @param {import("@codemirror/state").StateField<DocumentLinkState>} field
 */
function createDocumentLinkDecorations(field) {
  return EditorView.decorations.from(
    field,
    (state) => state?.decorations || Decoration.none,
  );
}

/**
 *
 * @param {import("@codemirror/state").StateField<DocumentLinkState>} field
 */
function createDocumentLinkTooltip(field) {
  /**
   * @this {import("@codemirror/view").EditorView}
   * @param {DocumentLink} link
   * @returns {import("@codemirror/view").TooltipView}
   */
  function createView(link) {
    const dom = document.createElement("div");
    dom.textContent = link.target || null;
    return { dom };
  }

  return hoverTooltip((view, pos) => {
    const result = view.state.field(field).find(pos);
    return result
      ? {
          pos: result.start,
          end: result.end,
          above: true,
          create: (view) => createView.call(view, result.link),
        }
      : null;
  });
}

/**
 *
 * @param {import("@codemirror/state").StateField<DocumentLinkState>} field
 */
function createDocumentLinkEventHandler(field) {
  return EditorView.domEventHandlers({
    click({ ctrlKey, clientX: x, clientY: y }, view) {
      if (!ctrlKey) {
        return;
      }
      const pos = view.posAtCoords({ x, y });
      if (!pos) {
        return;
      }

      const result = view.state.field(field)?.find(pos);
      if (result) {
        view.dispatch({ effects: documentLinkFollowEffect.of(result) });
        return true;
      }
    },
  });
}

export const documentLink = StateField.define({
  /** @returns {DocumentLinkState} */
  create(state) {
    return createDocumentLinkState([], state.doc);
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
      createDocumentLinkCollection(),
      createDocumentLinkDecorations(field),
      createDocumentLinkTooltip(field),
      createDocumentLinkEventHandler(field),
    ];
  },
});

export const followLink = EditorState.transactionFilter.of((tr) => {
  /** @type {import("@codemirror/state").TransactionSpec[]} */
  const transactions = [tr];

  for (const effect of tr.effects) {
    if (effect.is(documentLinkFollowEffect) && effect.value.link.target) {
      transactions.push({
        effects: fileOpenEffect.of(effect.value.link.target),
      });
    }
  }

  return transactions;
});

export const baseTheme = EditorView.baseTheme({
  ".cm-linkRange": {
    textDecoration: "underline 1px",
  },
});

export default function () {
  return [documentLink, followLink, baseTheme];
}
