/**
 * Completion source for [[wiki links]] and ![[note embeds]].
 *
 * Fires when the cursor is inside [[ or ![[ and offers all note names
 * fetched from /api/tree.  Results are cached for 30 s so the server
 * isn't hit on every keystroke.
 */

const CACHE_TTL = 30_000   // ms

let cachedNames = null
let cacheTime   = 0

async function getNoteNames() {
  if (cachedNames && Date.now() - cacheTime < CACHE_TTL) return cachedNames
  try {
    const res = await fetch('/api/tree')
    if (!res.ok) return cachedNames ?? []
    const names = []
    function walk(node) {
      if (!node) return
      if (node.type === 'file' && node.name.endsWith('.md')) {
        names.push(node.name.replace(/\.md$/, ''))
      }
      if (node.children) node.children.forEach(walk)
    }
    walk(await res.json())
    cachedNames = names
    cacheTime   = Date.now()
    return names
  } catch {
    return cachedNames ?? []
  }
}

/** Invalidate the cache (call after the file tree changes) */
export function invalidateNoteNameCache() {
  cacheTime = 0
}

export function wikiLinkCompletionSource(context) {
  // Match  ![[partial  or  [[partial  immediately before the cursor.
  // The optional leading ! must be directly attached to [[ so we don't
  // accidentally trigger inside ordinary Markdown image syntax.
  const match = context.matchBefore(/!?\[\[[^\]]*/)
  if (!match) return null

  const isEmbed = match.text.startsWith('![[')
  const prefix  = isEmbed ? 3 : 2          // chars before the note name
  const typed   = match.text.slice(prefix) // what the user has typed so far

  // Only auto-trigger once at least one character has been typed; require
  // an explicit Ctrl+Space for an empty [[ or ![[
  if (!context.explicit && typed.length === 0) return null

  const from = match.from + prefix

  return getNoteNames().then(names => ({
    from,
    // Stop reusing these results once the user types ] (they're closing the bracket)
    validFor: /^[^\]]*$/,
    options: names.map(name => ({
      label: name,
      detail: isEmbed ? 'embed' : 'note',
      // Automatically close the [[ / ![[  brackets on acceptance
      apply: name + ']]',
    })),
  }))
}
