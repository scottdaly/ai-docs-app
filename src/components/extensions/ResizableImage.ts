import Image from '@tiptap/extension-image';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { ImageNodeView } from '../ImageNodeView';

export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      src: {
        default: null,
        renderHTML: (attributes) => ({
          src: attributes.src,
        }),
        parseHTML: (element) => element.getAttribute('src'),
      },
      width: {
        default: '100%',
        renderHTML: (attributes) => ({
          width: attributes.width,
        }),
      },
      height: {
        default: 'auto',
        renderHTML: (attributes) => ({
          height: attributes.height,
        }),
      },
      align: {
        default: 'center-break',
        renderHTML: (attributes) => ({
          'data-align': attributes.align,
          style: `text-align: ${attributes.align}`,
        }),
      },
      isCropping: {
        default: false,
        renderHTML: () => ({}),
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView);
  },
});
