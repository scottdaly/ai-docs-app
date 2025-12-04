import { type PixelCrop } from 'react-image-crop';

export function getCroppedImg(
  image: HTMLImageElement,
  crop: PixelCrop
): string {
  const canvas = document.createElement('canvas');
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  
  // Calculate source coordinates and dimensions, enforcing strict bounds
  const sourceX = Math.max(0, crop.x * scaleX);
  const sourceY = Math.max(0, crop.y * scaleY);
  
  const sourceWidth = Math.min(
    image.naturalWidth - sourceX, 
    crop.width * scaleX
  );
  const sourceHeight = Math.min(
    image.naturalHeight - sourceY, 
    crop.height * scaleY
  );

  // Set canvas size to the clamped crop size (floored to avoid subpixel gaps)
  canvas.width = Math.floor(sourceWidth);
  canvas.height = Math.floor(sourceHeight);
  
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return '';
  }

  // Draw the cropped portion of the image onto the canvas
  ctx.drawImage(
    image,
    sourceX,
    sourceY,
    canvas.width, // Use floored width for source to match dest
    canvas.height, // Use floored height for source to match dest
    0,
    0,
    canvas.width,
    canvas.height
  );

  return canvas.toDataURL('image/png');
}