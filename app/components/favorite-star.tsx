'use client'

import './favorite-star.css'

interface StarProps {
  name: string
  on: boolean
  onToggle: () => void
}

/** A ☆ that turns gold ★ when the archer is a favorite. */
export function FavoriteStar({ name, on, onToggle }: StarProps) {
  return (
    <button
      type="button"
      className={on ? 'fav-star fav-on' : 'fav-star'}
      aria-pressed={on}
      aria-label={`${name} in your archers`}
      onClick={onToggle}
    >
      {on ? '★' : '☆'}
    </button>
  )
}
