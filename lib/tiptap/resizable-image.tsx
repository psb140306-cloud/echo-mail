'use client'

import { Node, mergeAttributes } from '@tiptap/core'
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import { useState, useCallback, useRef, useEffect } from 'react'

export interface ResizableImageOptions {
  HTMLAttributes: Record<string, any>
  minWidth: number
  maxWidth: number
}

// 이미지 NodeView 컴포넌트
function ResizableImageComponent({
  node,
  updateAttributes,
  selected,
}: {
  node: any
  updateAttributes: (attrs: any) => void
  selected: boolean
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isResizing, setIsResizing] = useState(false)
  const [resizeDirection, setResizeDirection] = useState<string | null>(null)
  const startPos = useRef({ x: 0, y: 0, width: 0, height: 0 })

  const { src, alt, title, width, height } = node.attrs

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, direction: string) => {
      e.preventDefault()
      e.stopPropagation()

      setIsResizing(true)
      setResizeDirection(direction)

      const imgElement = containerRef.current?.querySelector('img')
      if (!imgElement) return

      startPos.current = {
        x: e.clientX,
        y: e.clientY,
        width: imgElement.offsetWidth,
        height: imgElement.offsetHeight,
      }

      const handleMouseMove = (e: MouseEvent) => {
        if (!containerRef.current) return

        const deltaX = e.clientX - startPos.current.x
        const deltaY = e.clientY - startPos.current.y

        let newWidth = startPos.current.width
        let newHeight = startPos.current.height

        // 방향에 따른 크기 조정
        if (direction.includes('e')) {
          newWidth = Math.max(50, startPos.current.width + deltaX)
        }
        if (direction.includes('w')) {
          newWidth = Math.max(50, startPos.current.width - deltaX)
        }
        if (direction.includes('s')) {
          newHeight = Math.max(50, startPos.current.height + deltaY)
        }
        if (direction.includes('n')) {
          newHeight = Math.max(50, startPos.current.height - deltaY)
        }

        // 모서리 핸들인 경우 비율 유지
        if (direction.length === 2) {
          const aspectRatio = startPos.current.width / startPos.current.height
          if (Math.abs(deltaX) > Math.abs(deltaY)) {
            newHeight = newWidth / aspectRatio
          } else {
            newWidth = newHeight * aspectRatio
          }
        }

        // 최대/최소 크기 제한
        newWidth = Math.max(50, Math.min(800, newWidth))
        newHeight = Math.max(50, Math.min(800, newHeight))

        updateAttributes({
          width: Math.round(newWidth),
          height: Math.round(newHeight),
        })
      }

      const handleMouseUp = () => {
        setIsResizing(false)
        setResizeDirection(null)
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }

      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    },
    [updateAttributes]
  )

  // 리사이즈 중 커서 스타일 설정
  useEffect(() => {
    if (isResizing) {
      document.body.style.cursor = getCursorStyle(resizeDirection)
      document.body.style.userSelect = 'none'
    } else {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    return () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing, resizeDirection])

  const getCursorStyle = (direction: string | null): string => {
    switch (direction) {
      case 'nw':
      case 'se':
        return 'nwse-resize'
      case 'ne':
      case 'sw':
        return 'nesw-resize'
      case 'n':
      case 's':
        return 'ns-resize'
      case 'e':
      case 'w':
        return 'ew-resize'
      default:
        return 'default'
    }
  }

  return (
    <NodeViewWrapper className="resizable-image-wrapper" style={{ display: 'inline-block' }}>
      <div
        ref={containerRef}
        className={`resizable-image-container ${selected ? 'selected' : ''}`}
        style={{
          position: 'relative',
          display: 'inline-block',
          lineHeight: 0,
        }}
      >
        <img
          src={src}
          alt={alt || ''}
          title={title || ''}
          style={{
            width: width ? `${width}px` : 'auto',
            height: height ? `${height}px` : 'auto',
            maxWidth: '100%',
            display: 'block',
            borderRadius: '4px',
          }}
          draggable={false}
        />

        {/* 선택시 리사이즈 핸들 표시 */}
        {selected && (
          <>
            {/* 모서리 핸들 */}
            <div
              className="resize-handle resize-handle-nw"
              onMouseDown={(e) => handleMouseDown(e, 'nw')}
              style={{
                position: 'absolute',
                top: -4,
                left: -4,
                width: 8,
                height: 8,
                backgroundColor: '#3b82f6',
                border: '1px solid white',
                borderRadius: '2px',
                cursor: 'nwse-resize',
                zIndex: 10,
              }}
            />
            <div
              className="resize-handle resize-handle-ne"
              onMouseDown={(e) => handleMouseDown(e, 'ne')}
              style={{
                position: 'absolute',
                top: -4,
                right: -4,
                width: 8,
                height: 8,
                backgroundColor: '#3b82f6',
                border: '1px solid white',
                borderRadius: '2px',
                cursor: 'nesw-resize',
                zIndex: 10,
              }}
            />
            <div
              className="resize-handle resize-handle-sw"
              onMouseDown={(e) => handleMouseDown(e, 'sw')}
              style={{
                position: 'absolute',
                bottom: -4,
                left: -4,
                width: 8,
                height: 8,
                backgroundColor: '#3b82f6',
                border: '1px solid white',
                borderRadius: '2px',
                cursor: 'nesw-resize',
                zIndex: 10,
              }}
            />
            <div
              className="resize-handle resize-handle-se"
              onMouseDown={(e) => handleMouseDown(e, 'se')}
              style={{
                position: 'absolute',
                bottom: -4,
                right: -4,
                width: 8,
                height: 8,
                backgroundColor: '#3b82f6',
                border: '1px solid white',
                borderRadius: '2px',
                cursor: 'nwse-resize',
                zIndex: 10,
              }}
            />

            {/* 선택 테두리 */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                border: '2px solid #3b82f6',
                borderRadius: '4px',
                pointerEvents: 'none',
              }}
            />
          </>
        )}
      </div>
    </NodeViewWrapper>
  )
}

// ResizableImage Node Extension
export const ResizableImage = Node.create<ResizableImageOptions>({
  name: 'image',

  addOptions() {
    return {
      HTMLAttributes: {},
      minWidth: 50,
      maxWidth: 800,
    }
  },

  group: 'inline',
  inline: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      src: {
        default: null,
      },
      alt: {
        default: null,
      },
      title: {
        default: null,
      },
      width: {
        default: null,
        parseHTML: (element) => {
          const width = element.getAttribute('width')
          return width ? parseInt(width, 10) : null
        },
        renderHTML: (attributes) => {
          if (!attributes.width) {
            return {}
          }
          return { width: attributes.width }
        },
      },
      height: {
        default: null,
        parseHTML: (element) => {
          const height = element.getAttribute('height')
          return height ? parseInt(height, 10) : null
        },
        renderHTML: (attributes) => {
          if (!attributes.height) {
            return {}
          }
          return { height: attributes.height }
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'img[src]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageComponent)
  },

  addCommands() {
    return {
      setImage:
        (options: { src: string; alt?: string; title?: string; width?: number; height?: number }) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
          })
        },
    }
  },
})
