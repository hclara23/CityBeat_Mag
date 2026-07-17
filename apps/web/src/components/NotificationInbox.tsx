'use client'

import dynamic from 'next/dynamic'

// Novu in-app notification inbox (bell + unread badge + popover). Lazy-loaded so
// the @novu/react bundle only ships when it's actually configured + a user is
// signed in. Fully dormant (renders nothing) until NEXT_PUBLIC_NOVU_APP_ID is set.
const Inbox = dynamic(() => import('@novu/react').then((m) => m.Inbox), { ssr: false })

export function NotificationInbox({ subscriberId }: { subscriberId?: string | null }) {
  const appId = process.env.NEXT_PUBLIC_NOVU_APP_ID
  if (!appId || !subscriberId) return null
  return <Inbox applicationIdentifier={appId} subscriberId={subscriberId} />
}
