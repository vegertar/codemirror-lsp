// @ts-check

import { StateField, StateEffect } from "@codemirror/state";

import { getLastValueFromTransaction } from "./utils";

export function hoverable() {
  return class Hovering {
    /** @type {import("@codemirror/state").StateEffectType<MouseEvent>} */
    static effect = StateEffect.define();

    static state = StateField.define({
      /** @returns {MouseEvent | null} */
      create() {
        return null;
      },
      update(value, tr) {
        return getLastValueFromTransaction(tr, Hovering.effect) || value;
      },
    });

    /** @type {import("@codemirror/view").PluginSpec<Hovering>} */
    static spec = {
      provide: () => [Hovering.state],
      eventHandlers: {
        mousemove(event) {
          this.lastMove = { event, time: Date.now() };
          this.cancelTimer();
          this.updateHover();
        },
      },
    };

    /**
     * @private
     * @type {{event: MouseEvent | null, time: number}}
     */
    lastMove = { event: null, time: 0 };

    /** @private */
    /** @type {number | null} */
    hoverTimeoutId = null;

    /**
     * The timeout to determine if a hover takes an effect.
     */
    hoverTimeout = 300;

    /**
     *
     * @param {import("@codemirror/view").EditorView} view
     */
    constructor(view) {
      this.view = view;
    }

    updateHover = () => {
      this.hoverTimeoutId = null;
      const hovered = Date.now() - this.lastMove.time;
      if (hovered < this.hoverTimeout) {
        this.hoverTimeoutId = window.setTimeout(
          this.updateHover,
          this.hoverTimeout - hovered,
        );
      } else if (this.lastMove.event) {
        this.view.dispatch({
          effects: Hovering.effect.of(this.lastMove.event),
        });
      }
    };

    cancelTimer() {
      if (this.hoverTimeoutId !== null) {
        window.clearTimeout(this.hoverTimeoutId);
        this.hoverTimeoutId = null;
      }
    }
  };
}

// /**
//  *
//  * @param {import("@codemirror/state").StateField<DocumentLinkState>} field
//  */
// function createDocumentLinkTooltip(field) {
//   /**
//    * @this {import("@codemirror/view").EditorView}
//    * @param {DocumentLink} link
//    * @returns {import("@codemirror/view").TooltipView}
//    */
//   function createView(link) {
//     const dom = document.createElement("div");
//     dom.textContent = link.target || null;
//     return { dom };
//   }

//   return hoverTooltip((view, pos) => {
//     const result = view.state.field(field).find(pos);
//     return result
//       ? {
//           pos: result.start,
//           end: result.end,
//           create: (view) => createView.call(view, result.link),
//         }
//       : null;
//   });
// }
