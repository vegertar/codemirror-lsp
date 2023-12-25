// @ts-check

import { Annotation, StateField, StateEffect } from "@codemirror/state";

import { getLastValueFromTransaction } from "./utils.js";

/** @type {import("@codemirror/state").AnnotationType<MouseEvent>} */
export const hoveringEvent = Annotation.define();

/** @type {import("@codemirror/state").StateEffectType<number>} */
export const hoveringEffect = StateEffect.define();

/**
 *
 * @param {(pos: number, tr: import("@codemirror/state").Transaction) => boolean} [examine] Function to examine the new position. If true, update the hover state.
 * @returns
 */
export function hoverable(examine) {
  return class Hovering {
    static state = StateField.define({
      create() {
        return NaN;
      },
      update(value, tr) {
        const v = getLastValueFromTransaction(tr, hoveringEffect);
        return v === undefined ? value : examine?.(v, tr) !== false ? v : value;
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

    /**
     * Implementation of the ViewPlugin destroy.
     * @returns {void}
     */
    destroy() {
      this.cancelTimer();
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
          annotations: hoveringEvent.of(this.lastMove.event),
          effects: hoveringEffect.of(this.getPosition(this.lastMove.event)),
        });
      }
    };

    cancelTimer() {
      if (this.hoverTimeoutId !== null) {
        window.clearTimeout(this.hoverTimeoutId);
        this.hoverTimeoutId = null;
      }
    }

    /**
     *
     * @param {MouseEvent} event
     */
    getPosition({ clientX: x, clientY: y }) {
      const pos = this.view.posAtCoords({ x, y });
      if (pos === null) {
        return NaN;
      }

      const coords = this.view.coordsAtPos(pos);
      if (
        !coords ||
        y < coords.top ||
        y > coords.bottom ||
        x < coords.left - this.view.defaultCharacterWidth ||
        x > coords.right + this.view.defaultCharacterWidth
      ) {
        return NaN;
      }

      return pos;
    }
  };
}
