/** Marks each element inert (not focusable, hidden from assistive tech) and returns what undoes only that. */
export function makeInert(elements: Element[]): () => void {
  const changed = elements.filter((element) => !element.hasAttribute('inert'))
  for (const element of changed) element.setAttribute('inert', '')
  return () => {
    for (const element of changed) element.removeAttribute('inert')
  }
}
