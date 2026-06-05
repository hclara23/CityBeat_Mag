'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from '@/components/TranslationProvider'
import { Navigation, Button, Input } from '@citybeat/ui'
import { getUser, getUserProfile, updateProfile, signOut } from '@citybeat/lib/supabase/auth'
import { AuthError } from '@citybeat/ui/auth'

interface UserProfile {
  id: string
  email: string
  full_name: string
  company_name?: string
  phone_number?: string
  is_advertiser: boolean
  is_developer?: boolean
  is_editor?: boolean
  is_writer?: boolean
  is_sales?: boolean
  sales_dashboard_enabled?: boolean
  stripe_connect_onboarding_complete?: boolean
  email_notifications_enabled: boolean
  sms_notifications_enabled: boolean
  review_points: number
  created_at: string
}

interface ConnectedAccount {
  stripe_account_id: string
  onboarding_complete: boolean
  charges_enabled: boolean
  payouts_enabled: boolean
  details_submitted: boolean
}

export default function AccountPage() {
  const router = useRouter()
  const locale = useLocale()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isConnectingStripe, setIsConnectingStripe] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [connectedAccount, setConnectedAccount] = useState<ConnectedAccount | null>(null)
  const [formData, setFormData] = useState({
    fullName: '',
    company: '',
    phone: '',
    emailNotificationsEnabled: true,
    smsNotificationsEnabled: true,
  })

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setIsLoading(true)
        const userResult = await getUser()
        if (userResult.error || !userResult.user) {
          router.push(`/${locale}/login`)
          return
        }

        const profileResult = await getUserProfile(userResult.user.id)
        if (profileResult.profile) {
          setProfile(profileResult.profile)
          setFormData({
            fullName: profileResult.profile.full_name || '',
            company: profileResult.profile.company_name || '',
            phone: profileResult.profile.phone_number || '',
            emailNotificationsEnabled: profileResult.profile.email_notifications_enabled ?? true,
            smsNotificationsEnabled: profileResult.profile.sms_notifications_enabled ?? true,
          })
        }

        const accountResponse = await fetch('/api/platform/connect/account', { cache: 'no-store' })
        if (accountResponse.ok) {
          const accountData = await accountResponse.json()
          setConnectedAccount(accountData.account)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load profile')
      } finally {
        setIsLoading(false)
      }
    }

    loadProfile()
  }, [locale, router])

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setIsSaving(true)

    try {
      const result = await updateProfile({
        fullName: formData.fullName,
        companyName: formData.company,
        phoneNumber: formData.phone,
        emailNotificationsEnabled: formData.emailNotificationsEnabled,
        smsNotificationsEnabled: formData.smsNotificationsEnabled,
      })

      if (result.error) {
        setError(result.error)
      } else {
        setSuccess('Profile updated successfully')
        if (result.user && profile) {
          setProfile({
            ...profile,
            full_name: formData.fullName,
            company_name: formData.company,
            phone_number: formData.phone,
            email_notifications_enabled: formData.emailNotificationsEnabled,
            sms_notifications_enabled: formData.smsNotificationsEnabled,
          })
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile')
    } finally {
      setIsSaving(false)
    }
  }

  const handleConnectStripe = async () => {
    setError('')
    setSuccess('')
    setIsConnectingStripe(true)

    try {
      const response = await fetch('/api/platform/connect/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          returnUrl: `/${locale}/account`,
          refreshUrl: `/${locale}/account`,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to start Stripe onboarding')
      window.location.href = data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start Stripe onboarding')
      setIsConnectingStripe(false)
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut()
      router.push(`/${locale}/login`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign out')
    }
  }

  const points = profile?.review_points ?? 0
  let levelBadge = '🥉 Bronze Reviewer'
  let nextLevelPoints = 50
  let currentLevelPoints = 0
  let levelName = 'Level 1'

  if (points >= 200) {
    levelBadge = '👑 Elite Reviewer'
    levelName = 'Level 4 (Max)'
    nextLevelPoints = points
  } else if (points >= 100) {
    levelBadge = '🥇 Gold Reviewer'
    levelName = 'Level 3'
    currentLevelPoints = 100
    nextLevelPoints = 200
  } else if (points >= 50) {
    levelBadge = '🥈 Silver Reviewer'
    levelName = 'Level 2'
    currentLevelPoints = 50
    nextLevelPoints = 100
  } else {
    levelBadge = '🥉 Bronze Reviewer'
    levelName = 'Level 1'
    currentLevelPoints = 0
    nextLevelPoints = 50
  }

  const progressPercent = nextLevelPoints === currentLevelPoints
    ? 100
    : Math.min(100, Math.max(0, ((points - currentLevelPoints) / (nextLevelPoints - currentLevelPoints)) * 100))

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white">
        <Navigation />
        <div className="max-w-3xl mx-auto px-4 py-12">
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <Navigation />

      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold mb-8">Account Settings</h1>

        {error && <AuthError message={error} />}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm font-medium text-green-800">{success}</p>
          </div>
        )}

        {/* Profile Section */}
        <div className="bg-gray-50 rounded-lg p-6 border border-gray-200 mb-8">
          <h2 className="text-2xl font-bold mb-6">Profile Information</h2>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                disabled
                value={profile?.email || ''}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Full Name
              </label>
              <input
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                placeholder="Your Name"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Company
              </label>
              <input
                type="text"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                placeholder="Your Company"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+1 (555) 000-0000"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="space-y-4 pt-6 mt-6 border-t border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Notification Preferences</h3>
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="emailNotificationsEnabled"
                  checked={formData.emailNotificationsEnabled}
                  onChange={(e) => setFormData({ ...formData, emailNotificationsEnabled: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 mt-1"
                />
                <label htmlFor="emailNotificationsEnabled" className="text-sm font-medium text-gray-700">
                  Enable Email Notifications when my claimed business listings receive new reviews
                </label>
              </div>

              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="smsNotificationsEnabled"
                  checked={formData.smsNotificationsEnabled}
                  onChange={(e) => setFormData({ ...formData, smsNotificationsEnabled: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 mt-1"
                />
                <label htmlFor="smsNotificationsEnabled" className="text-sm font-medium text-gray-700">
                  Enable Text/SMS Notifications for new reviews (requires a valid phone number)
                </label>
              </div>
            </div>

            <Button type="submit" className="w-full mt-6" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </form>
        </div>

        {/* Payout Account Section */}
        <div className="bg-gray-50 rounded-lg p-6 border border-gray-200 mb-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-2">Earnings Payout Account</h2>
              <p className="text-sm text-gray-600">
                Connect a bank account through Stripe to receive approved earnings, commissions, or revenue shares.
              </p>
              <p className="mt-3 text-sm font-medium text-gray-900">
                Status:{' '}
                {connectedAccount?.onboarding_complete || profile?.stripe_connect_onboarding_complete
                  ? 'Ready for payouts'
                  : connectedAccount
                    ? 'Onboarding incomplete'
                    : 'Not connected'}
              </p>
              {connectedAccount?.stripe_account_id && (
                <p className="mt-1 font-mono text-xs text-gray-500">
                  Stripe account: {connectedAccount.stripe_account_id}
                </p>
              )}
            </div>
            <Button
              type="button"
              onClick={handleConnectStripe}
              disabled={isConnectingStripe}
              className="shrink-0"
            >
              {isConnectingStripe
                ? 'Opening Stripe...'
                : connectedAccount
                  ? 'Continue Stripe Setup'
                  : 'Add Bank Account'}
            </Button>
          </div>
        </div>

        {/* Reviewer Dashboard Section (Gamified Points & Levels) */}
        {!profile?.is_advertiser && (
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-lg p-6 border border-gray-200 mb-8 text-white shadow-md">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-black uppercase text-amber-400 tracking-wide">Reviewer Dashboard</h2>
                <p className="text-xs text-white/60 mt-1 uppercase font-bold tracking-wider">{levelName} Tally</p>
              </div>
              <span className="text-3xl filter drop-shadow">{levelBadge.split(' ')[0]}</span>
            </div>

            <div className="flex items-baseline gap-2 mb-6">
              <span className="text-4xl font-extrabold text-white">{points}</span>
              <span className="text-sm font-bold text-white/50">points earned</span>
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold text-white/70 mb-2">
                <span>{levelBadge} Progress</span>
                <span>{points} / {nextLevelPoints} pts</span>
              </div>
              <div className="w-full h-3 rounded-full bg-white/10 overflow-hidden border border-white/5">
                <div
                  className="h-full bg-amber-400 rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="text-[10px] text-white/40 mt-2 italic">
                {points >= 200 ? 'You have unlocked the highest Level! Thank you for reviewing.' : `Earn ${nextLevelPoints - points} more points to reach the next Level.`}
              </p>
            </div>
          </div>
        )}

        {/* Security Section */}
        <div className="bg-gray-50 rounded-lg p-6 border border-gray-200 mb-8">
          <h2 className="text-2xl font-bold mb-6">Security</h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-gray-200">
              <div>
                <p className="font-medium text-gray-900">Password</p>
                <p className="text-sm text-gray-500 mt-1">Change your password</p>
              </div>
              <a href="/reset-password" className="text-blue-600 hover:text-blue-700 font-medium">
                Update
              </a>
            </div>

            <div className="flex items-center justify-between pt-4">
              <div>
                <p className="font-medium text-gray-900">Sign Out</p>
                <p className="text-sm text-gray-500 mt-1">Sign out from all sessions</p>
              </div>
              <Button variant="secondary" onClick={handleSignOut}>
                Sign Out
              </Button>
            </div>
          </div>
        </div>

        {/* Account Info */}
        <div className="bg-gray-50 rounded-lg p-6 border border-gray-200 mb-8">
          <h2 className="text-2xl font-bold mb-6">Account Information</h2>

          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600">User ID</p>
              <p className="font-mono text-sm text-gray-900">{profile?.id}</p>
            </div>

            <div>
              <p className="text-sm text-gray-600">Account Type</p>
              <p className="text-gray-900">
                {profile?.is_advertiser ? 'Advertiser' : 'Regular User'}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-600">Member Since</p>
              <p className="text-gray-900">
                {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : '-'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
