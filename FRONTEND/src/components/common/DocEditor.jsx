import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold, Italic, Underline as UnderlineIcon, List, ListOrdered,
  Quote, Undo, Redo, Heading1, Heading2,
} from 'lucide-react';
import './DocEditor.css';

/* ── Word-style rich text editor: toolbar + a page-styled canvas ── */
export default function DocEditor({ content, onChange, placeholder = 'Type your answer here...', editable = true }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Placeholder.configure({ placeholder }),
    ],
    content: content || '',
    editable,
    onUpdate: ({ editor }) => onChange?.(editor.getHTML()),
  });

  if (!editor) return null;

  const ToolBtn = ({ onClick, active, disabled, title, children }) => (
    <button
      type="button"
      className={`doc-toolbar-btn ${active ? 'active' : ''}`}
      onMouseDown={e => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  );

  return (
    <div className={`doc-editor ${editable ? '' : 'doc-readonly'}`}>
      {editable && (
        <div className="doc-toolbar">
          <ToolBtn title="Bold" active={editor.isActive('bold')}
            onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={15} /></ToolBtn>
          <ToolBtn title="Italic" active={editor.isActive('italic')}
            onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={15} /></ToolBtn>
          <ToolBtn title="Underline" active={editor.isActive('underline')}
            onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon size={15} /></ToolBtn>

          <span className="doc-toolbar-divider" />

          <ToolBtn title="Heading 1" active={editor.isActive('heading', { level: 1 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 size={15} /></ToolBtn>
          <ToolBtn title="Heading 2" active={editor.isActive('heading', { level: 2 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 size={15} /></ToolBtn>

          <span className="doc-toolbar-divider" />

          <ToolBtn title="Bullet List" active={editor.isActive('bulletList')}
            onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={15} /></ToolBtn>
          <ToolBtn title="Numbered List" active={editor.isActive('orderedList')}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={15} /></ToolBtn>
          <ToolBtn title="Quote" active={editor.isActive('blockquote')}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote size={15} /></ToolBtn>

          <span className="doc-toolbar-divider" />

          <ToolBtn title="Undo" disabled={!editor.can().undo()}
            onClick={() => editor.chain().focus().undo().run()}><Undo size={15} /></ToolBtn>
          <ToolBtn title="Redo" disabled={!editor.can().redo()}
            onClick={() => editor.chain().focus().redo().run()}><Redo size={15} /></ToolBtn>
        </div>
      )}

      <div className="doc-page-wrap">
        <div className="doc-page">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}
