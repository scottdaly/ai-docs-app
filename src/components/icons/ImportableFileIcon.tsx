import { useId } from 'react';

interface ImportableFileIconProps {
  size?: number;
  className?: string;
}

export function ImportableFileIcon({ size = 16, className = '' }: ImportableFileIconProps) {
  // Generate unique IDs for this instance to avoid conflicts when multiple icons are rendered
  const uniqueId = useId();
  const filterId = `filter_imp_${uniqueId}`;
  const gradientId = `gradient_imp_${uniqueId}`;

  // Original viewBox is 162x206, aspect ratio ~0.786 (matches document icons)
  const height = size;
  const width = Math.round(size * (162 / 206));

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 162 206"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Arrow shape */}
      <g filter={`url(#${filterId})`}>
        <path
          d="M155.833 103.5L87.771 161V137.571H1.8335V70.3026H87.771V46L155.833 103.5Z"
          style={{ fill: `url(#${gradientId})` }}
        />
      </g>

      <defs>
        {/* Drop shadow and inner shadows filter */}
        <filter id={filterId} x="0.000162721" y="44.1667" width="161.333" height="122.333" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
          <feOffset dx="1.83333" dy="1.83333" />
          <feGaussianBlur stdDeviation="1.83333" />
          <feComposite in2="hardAlpha" operator="out" />
          <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.1 0" />
          <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow" />
          <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow" result="shape" />
          <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
          <feOffset dx="-0.916667" dy="-0.916667" />
          <feGaussianBlur stdDeviation="1.83333" />
          <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
          <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.1 0" />
          <feBlend mode="normal" in2="shape" result="effect2_innerShadow" />
          <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
          <feOffset dx="0.916667" dy="1.83333" />
          <feGaussianBlur stdDeviation="0.916667" />
          <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
          <feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0" />
          <feBlend mode="normal" in2="effect2_innerShadow" result="effect3_innerShadow" />
        </filter>

        {/* Orange gradient - constant across themes as action indicator */}
        <linearGradient id={gradientId} x1="75.6252" y1="58.5156" x2="75.6252" y2="154.6" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFC465" />
          <stop offset="1" stopColor="#CE6741" />
        </linearGradient>
      </defs>
    </svg>
  );
}
