'use client'

import { useCallback, useEffect, useState } from 'react'

// The kill switch, on a page an operator already has open.
//
// The API alone was not enough: the moment you need this is the moment a laptop
// went missing or an account was compromised, and hunting for a curl command
// with the right bearer token is exactly the wrong thing to be doing then. This
// is two buttons and a confirmation.

type Revocations = { all: string | null; users: Record<string, string> }

export function SessionRevocation({ isEs }: { isEs: boolean }) {
  const [state, setState] = useState<Revocations | null>(null)
  const [visible, setVisible] = useState(false)
  const [userId, setUserId] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/security/revoke', { cache: 'no-store' })
    // Godmode only — a non-developer admin simply doesn't see this panel.
    if (!res.ok) return
    setVisible(true)
    setState(await res.json().catch(() => null))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (!visible) return null

  const revoke = async (body: Record<string, unknown>, confirmText: string) => {
    if (!window.confirm(confirmText)) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const res = await fetch('/api/admin/security/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, reason: reason || undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not revoke')
      setNotice(
        isEs
          ? `Sesiones revocadas. Surte efecto en todas las instancias en ~${data.effective_within_seconds}s.`
          : `Sessions revoked. Effective across all instances within ~${data.effective_within_seconds}s.`
      )
      setUserId('')
      await load()
    } catch (e: any) {
      setError(e.message || 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  const revokedUsers = Object.entries(state?.users || {}).sort((a, b) => String(b[1]).localeCompare(String(a[1])))

  return (
    <div className="citybeat-panel mt-10 rounded-2xl border border-red-500/20 p-6">
      <h2 className="font-display text-xl font-black uppercase tracking-tight text-white">
        {isEs ? 'Revocar sesiones' : 'Revoke sessions'}
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-white/50">
        {isEs
          ? 'Una cookie de sesión es válida cinco días. Esto la termina antes: una laptop perdida, una cuenta comprometida, alguien que ya no trabaja aquí.'
          : 'A session cookie is valid for five days. This ends one sooner — a lost laptop, a compromised account, someone who no longer works here.'}
      </p>

      {notice && <p className="mt-4 rounded border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">{notice}</p>}
      {error && <p className="mt-4 rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}

      <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
        <input
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder={isEs ? 'ID de usuario' : 'User ID'}
          aria-label={isEs ? 'ID de usuario' : 'User ID'}
          className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 font-mono text-sm text-white outline-none focus:border-brand-neon"
        />
        <button
          onClick={() =>
            revoke(
              { userId: userId.trim() },
              isEs ? `¿Terminar todas las sesiones de ${userId.trim()}?` : `End every session for ${userId.trim()}?`
            )
          }
          disabled={busy || !userId.trim()}
          className="rounded-md border border-amber-500/40 px-4 py-2 text-xs font-black uppercase tracking-wider text-amber-300 transition hover:bg-amber-500/15 disabled:opacity-40"
        >
          {isEs ? 'Revocar usuario' : 'Revoke user'}
        </button>
      </div>

      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={isEs ? 'Motivo (queda en el registro de auditoría)' : 'Reason (recorded in the audit log)'}
        aria-label={isEs ? 'Motivo' : 'Reason'}
        className="mt-3 w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-brand-neon"
      />

      <button
        onClick={() =>
          revoke(
            { all: true },
            isEs
              ? 'Esto cierra la sesión de TODOS, incluida la tuya. ¿Continuar?'
              : 'This signs out EVERYONE, including you. Continue?'
          )
        }
        disabled={busy}
        className="mt-4 w-full rounded-md border border-red-500/40 px-4 py-3 text-xs font-black uppercase tracking-wider text-red-300 transition hover:bg-red-500/15 disabled:opacity-40"
      >
        {isEs ? 'Cerrar sesión de todos' : 'Sign out everyone'}
      </button>

      {(state?.all || revokedUsers.length > 0) && (
        <div className="mt-5 border-t border-white/10 pt-4 text-xs text-white/50">
          <p className="font-black uppercase tracking-wider text-white/40">{isEs ? 'En efecto' : 'In effect'}</p>
          {state?.all && (
            <p className="mt-1">
              {isEs ? 'Todos, desde' : 'Everyone, since'} {new Date(state.all).toLocaleString()}
            </p>
          )}
          {revokedUsers.slice(0, 10).map(([uid, at]) => (
            <p key={uid} className="mt-1 font-mono">
              {uid} · {new Date(String(at)).toLocaleString()}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
