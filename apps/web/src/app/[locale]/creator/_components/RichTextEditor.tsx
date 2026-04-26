'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'

interface RichTextEditorProps {
  content: any
  onChange: (content: any) => void
  placeholder?: string
}

export function RichTextEditor({ content, onChange, placeholder }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
      }),
      Image.configure({
        allowBase64: true,
      }),
      Placeholder.configure({
        placeholder: placeholder || 'Start writing...',
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON())
    },
    editorProps: {
      attributes: {
        class: 'prose prose-invert max-w-none focus:outline-none min-h-[400px] px-4 py-6',
      },
    },
  })

  if (!editor) {
    return null
  }

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 border-b border-white/10 bg-white/5 p-2">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          label="B"
          title="Bold"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          label="I"
          title="Italic"
        />
        <div className="w-px h-4 bg-white/10 mx-1" />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive('heading', { level: 2 })}
          label="H2"
          title="Heading 2"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive('heading', { level: 3 })}
          label="H3"
          title="Heading 3"
        />
        <div className="w-px h-4 bg-white/10 mx-1" />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          label="• List"
          title="Bullet List"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          label="1. List"
          title="Ordered List"
        />
        <div className="w-px h-4 bg-white/10 mx-1" />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive('blockquote')}
          label="“"
          title="Blockquote"
        />
      </div>

      <EditorContent editor={editor} />
    </div>
  )
}

function ToolbarButton({ onClick, active, label, title }: { onClick: () => void, active: boolean, label: string, title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`flex h-8 min-w-[32px] items-center justify-center rounded px-2 text-xs font-bold transition ${
        active 
          ? 'bg-brand-neon text-black' 
          : 'text-white/60 hover:bg-white/10 hover:text-white'
      }`}
    >
      {label}
    </button>
  )
}
