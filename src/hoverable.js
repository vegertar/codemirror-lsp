// @ts-check

import { Annotation, StateField, StateEffect } from "@codemirror/state";

import { getLastValueFromTransaction } from "./utils.js";

export function hoverable() {
  return class Hovering {
    /** @type {import("@codemirror/state").AnnotationType<MouseEvent>} */
    static event = Annotation.define();

    /** @type {import("@codemirror/state").StateEffectType<number | null>} */
    static effect = StateEffect.define();

    static state = StateField.define({
      /** @returns {null | number} */
      create() {
        return null;
      },
      update(value, tr) {
        if (value !== null && tr.docChanged) {
          value = tr.changes.mapPos(value);
        }
        const v = getLastValueFromTransaction(tr, Hovering.effect);
        return v === undefined ? value : v;
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
          annotations: Hovering.event.of(this.lastMove.event),
          effects: Hovering.effect.of(this.getPosition(this.lastMove.event)),
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
      if (pos !== null) {
        const coords = this.view.coordsAtPos(pos);
        if (
          !coords ||
          y < coords.top ||
          y > coords.bottom ||
          x < coords.left - this.view.defaultCharacterWidth ||
          x > coords.right + this.view.defaultCharacterWidth
        ) {
          return null;
        }
      }

      return pos;
    }
  };
}
