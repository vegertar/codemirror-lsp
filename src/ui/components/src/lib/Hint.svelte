<script>
  import DocumentLink from "./DocumentLink.svelte";
  import Hover from "./Hover.svelte";

  /**
   * @typedef DocumentLinkHint
   * @type {{
   *   type: "document-link",
   *   value: import("vscode-languageserver-types").DocumentLink,
   * }}
   */

  /**
   * @typedef HoverHint
   * @type {{
   *  type: "hover",
   *  value: import("vscode-languageserver-types").Hover,
   * }}
   */

  /**
   * @typedef Hint
   * @type {DocumentLinkHint | HoverHint}
   */

  /** @type {Hint[]} */
  export let hints = [];

  const maps = {
    "document-link": DocumentLink,
    hover: Hover,
  };
</script>

<div>
  {#each hints as { type, value }}
    <svelte:component this={maps[type]} {value} />
  {/each}
</div>
