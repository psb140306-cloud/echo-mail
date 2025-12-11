import { TableHeader } from '@tiptap/extension-table-header'

/**
 * 커스텀 TableHeader 확장
 * - backgroundColor 속성 지원 추가
 */
export const CustomTableHeader = TableHeader.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: {
        default: null,
        parseHTML: (element) => element.style.backgroundColor || null,
        renderHTML: (attributes) => {
          if (!attributes.backgroundColor) {
            return {}
          }
          return {
            style: `background-color: ${attributes.backgroundColor}`,
          }
        },
      },
    }
  },
})
