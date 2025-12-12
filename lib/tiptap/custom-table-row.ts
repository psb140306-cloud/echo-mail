import { TableRow } from '@tiptap/extension-table-row'
import { mergeAttributes } from '@tiptap/core'

export const CustomTableRow = TableRow.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      height: {
        default: null,
        parseHTML: (element) => {
          const height = element.style.height || element.getAttribute('data-row-height')
          return height ? parseInt(height, 10) : null
        },
        renderHTML: (attributes) => {
          if (!attributes.height) {
            return {}
          }
          return {
            'data-row-height': attributes.height,
            style: `height: ${attributes.height}px; min-height: ${attributes.height}px;`,
          }
        },
      },
    }
  },

  renderHTML({ HTMLAttributes }) {
    return ['tr', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]
  },
})
