// @ts-check

import { ViewPlugin } from "@codemirror/view";

import { hoverable } from "../hoverable";

class LinkHint extends hoverable() {}

export const linkHint = ViewPlugin.fromClass(LinkHint, LinkHint.spec);

export default function () {
  return [linkHint];
}
