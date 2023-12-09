// @ts-check

import { Annotation, StateField, StateEffect } from "@codemirror/state";

import { getLastValueFromTransaction } from "./utils";

export function hoverable() {
  return class Hovering {
    /** @type {import("@codemirror/state").AnnotationType<MouseEvent>} */
    static event = Annotation.define();

    /** @type {import("@codemirror/state").StateEffectType<number>} */
    static effect = StateEffect.define();

    static state = StateField.define({
      create() {
        return NaN;
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
      return this.view.posAtCoords({ x, y }) || NaN;
    }
  };
}
