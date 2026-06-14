'use client'

import { useState, useEffect } from 'react'

interface BookmarkButtonProps {
  contentType: 'article' | 'directory'
  contentId: string
  className?: string
}

export default function BookmarkButton({ contentType, contentId, className = '' }: BookmarkButtonProps) {
  const [isSaved, setIsSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkBookmark = async () => {
      try {
        const res = await fetch(`/api/bookmarks?content_type=${contentType}&content_id=${contentId}`)
        if (res.ok) {
          const data = await res.json()
          setIsSaved(data.bookmarks && data.bookmarks.length > 0)
        }
      } catch (err) {
        console.error('Failed to check bookmark status', err)
      } finally {
        setLoading(false)
      }
    }
    checkBookmark()
  }, [contentType, contentId])

  const toggleBookmark = async () => {
    setLoading(true)
    try {
      if (isSaved) {
        await fetch('/api/bookmarks', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content_type: contentType, content_id: contentId }),
        })
        setIsSaved(false)
      } else {
        const res = await fetch('/api/bookmarks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content_type: contentType, content_id: contentId }),
        })
        if (res.ok) {
          setIsSaved(true)
        } else {
          // Might be unauthorized
          const data = await res.json()
          if (data.error === 'Unauthorized') {
            alert('Please log in to save this for later.')
          }
        }
      }
    } catch (err) {
      console.error('Failed to toggle bookmark', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={toggleBookmark}
      disabled={loading}
      className={`flex items-center gap-2 px-4 py-2 rounded-full border transition ${
        isSaved 
          ? 'bg-brand-gold text-black border-brand-gold hover:bg-yellow-400' 
          : 'bg-black/40 text-white border-white/20 hover:bg-white/10'
      } ${className}`}
    >
      <svg 
        className="h-4 w-4" 
        fill={isSaved ? "currentColor" : "none"} 
        stroke="currentColor" 
        viewBox="0 0 24 24" 
        xmlns="http://www.w3.org/2000/svg"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
      </svg>
      <span className="text-xs font-bold uppercase tracking-wider">
        {loading ? '...' : isSaved ? 'Saved' : 'Save for Later'}
      </span>
    </button>
  )
}
