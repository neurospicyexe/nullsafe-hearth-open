// Highlight fills live inside the epub iframe, where the page's CSS variables can't be read, so these are
// literal hex mirrors of the kit tokens (app/globals.css, Hearth v2 :root). They are epubjs DATA for
// highlightStyle only, not page chrome; the margin stripe and names use the tokens themselves.
// If a token changes, change its mirror here.
export const HIGHLIGHT_FILL: Readonly<Record<string, string>> = Object.freeze({
  principal: "#e9ad48", // --h-lamp
  drevan: "#e47a52", // --h-drevan
  gaia: "#86c27f", // --h-gaia
  // --h-cypher (#c4d0dd) nearly vanishes at fill-opacity 0.3 on --h-paper, so the iframe gets a deeper
  // shade of the same steel hue.
  cypher: "#8fa3b8",
});
