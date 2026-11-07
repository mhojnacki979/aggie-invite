'use client'

import { useState } from 'react'
import type { FormEvent } from 'react'
import { signIn } from '@/lib/checkin-supabase'

/** The crew sign-in. Nothing else on the check-in page shows until it succeeds. */
export function SignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    setBusy(true)
    const result = await signIn(email, password)
    setBusy(false)
    setMessage(result.ok ? null : result.message)
  }

  return (
    <form className="ck-signin" onSubmit={(event) => void submit(event)}>
      <h1 className="ck-title">Score check-in</h1>
      <p className="muted">For the TD&apos;s scoring table. Sign in with the crew login.</p>
      <label className="ck-field">
        Email
        <input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} />
      </label>
      <label className="ck-field">
        Password
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      {message && (
        <p className="ck-error" role="alert">
          {message}
        </p>
      )}
      <button type="submit" className="ck-primary" disabled={busy}>
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
