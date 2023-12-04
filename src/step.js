// @ts-check

import { StateField } from "@codemirror/state";

class Tree {
  static count = 0;

  /** @type {Map<number, [node: import("@codemirror/state").EditorState, parent: number, ...children: number[]]>} */
  nodes = new Map();

  /**
   *
   * @param {import("@codemirror/state").EditorState} currState
   * @param {number} currNumber
   * @param {number} prevNumber
   */
  insert(currState, currNumber, prevNumber) {
    this.nodes.set(currNumber, [currState, prevNumber]);
    const parent = this.nodes.get(prevNumber);
    if (parent) {
      parent.push(currNumber);
    }

    return this;
  }
}

const tree = new Tree();

export const stepNumber = StateField.define({
  create() {
    return ++Tree.count;
  },
  update() {
    return ++Tree.count;
  },
});

export const stepTree = StateField.define({
  create() {
    return tree;
  },
  update(value, tr) {
    const prevNumber = tr.startState.field(stepNumber);
    const currNumber = tr.state.field(stepNumber);
    return value.insert(tr.state, currNumber, prevNumber);
  },
});

export default function () {
  return [stepNumber, stepTree];
}
