import { useId } from 'react';

interface FolderIconProps {
  size?: number;
  className?: string;
}

export function FolderIcon({ size = 16, className = '' }: FolderIconProps) {
  // Generate unique IDs for this instance to avoid conflicts when multiple icons are rendered
  const uniqueId = useId();
  const backFilterId = `filter_folder_back_${uniqueId}`;
  const frontFilterId = `filter_folder_front_${uniqueId}`;
  const backGradientId = `gradient_folder_back_${uniqueId}`;
  const frontGradientId = `gradient_folder_front_${uniqueId}`;

  // Original viewBox is 218x174, aspect ratio ~1.253
  const height = size;
  const width = Math.round(size * (218 / 174));

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 218 174"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Folder back with tab */}
      <g filter={`url(#${backFilterId})`}>
        <path
          d="M2 157.5V10C2 5.58172 5.58172 2 10 2H72.6863C74.808 2 76.8428 2.84285 78.3431 4.34314L93.6569 19.6569C95.1571 21.1571 97.192 22 99.3137 22H204C208.418 22 212 25.5817 212 30V157.5C212 161.918 208.418 165.5 204 165.5H10C5.58172 165.5 2 161.918 2 157.5Z"
          style={{ fill: `url(#${backGradientId})` }}
        />
      </g>

      {/* Folder front */}
      <g filter={`url(#${frontFilterId})`}>
        <rect
          x="2"
          y="42"
          width="210"
          height="126"
          rx="8"
          style={{ fill: `url(#${frontGradientId})` }}
        />
      </g>

      <defs>
        {/* Back filter - drop shadow and inner shadows */}
        <filter id={backFilterId} x="0" y="0" width="218" height="171.5" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
          <feOffset dx="2" dy="2" />
          <feGaussianBlur stdDeviation="2" />
          <feComposite in2="hardAlpha" operator="out" />
          <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.1 0" />
          <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow" />
          <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow" result="shape" />
          <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
          <feOffset dx="-1" dy="-1" />
          <feGaussianBlur stdDeviation="2" />
          <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
          <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.1 0" />
          <feBlend mode="normal" in2="shape" result="effect2_innerShadow" />
          <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
          <feOffset dx="1" dy="1" />
          <feGaussianBlur stdDeviation="1" />
          <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
          <feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.6 0" />
          <feBlend mode="normal" in2="effect2_innerShadow" result="effect3_innerShadow" />
        </filter>

        {/* Front filter - drop shadow and inner shadows */}
        <filter id={frontFilterId} x="0" y="40" width="218" height="134" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
          <feOffset dx="2" dy="2" />
          <feGaussianBlur stdDeviation="2" />
          <feComposite in2="hardAlpha" operator="out" />
          <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.1 0" />
          <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow" />
          <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow" result="shape" />
          <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
          <feOffset dx="-1" dy="-1" />
          <feGaussianBlur stdDeviation="2" />
          <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
          <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.1 0" />
          <feBlend mode="normal" in2="shape" result="effect2_innerShadow" />
          <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
          <feOffset dx="1" dy="1" />
          <feGaussianBlur stdDeviation="1" />
          <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
          <feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0" />
          <feBlend mode="normal" in2="effect2_innerShadow" result="effect3_innerShadow" />
        </filter>

        {/* Back gradient */}
        <linearGradient id={backGradientId} x1="71" y1="2" x2="120.5" y2="111.5" gradientUnits="userSpaceOnUse">
          <stop style={{ stopColor: 'hsl(var(--folder-icon-back))' }} />
          <stop offset="1" style={{ stopColor: 'hsl(var(--folder-icon-back-dark))' }} />
        </linearGradient>

        {/* Front gradient */}
        <linearGradient id={frontGradientId} x1="56" y1="46.5" x2="107" y2="168" gradientUnits="userSpaceOnUse">
          <stop style={{ stopColor: 'hsl(var(--folder-icon-front))' }} />
          <stop offset="1" style={{ stopColor: 'hsl(var(--folder-icon-front-dark))' }} />
        </linearGradient>
      </defs>
    </svg>
  );
}
