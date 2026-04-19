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
  created_at: string
}

export default function AccountPage() {
  const router = useRouter()
  const locale = useLocale()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [formData, setFormData] = useState({
    fullName: '',
    company: '',
    phone: '',
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
          })
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
          })
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile')
    } finally {
      setIsSaving(false)
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

            <Button type="submit" className="w-full mt-6" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </form>
        </div>

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
