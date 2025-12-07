import { useId } from 'react';

interface MidlightFileIconProps {
  size?: number;
  className?: string;
}

export function MidlightFileIcon({ size = 16, className = '' }: MidlightFileIconProps) {
  // Generate unique IDs for this instance to avoid conflicts when multiple icons are rendered
  const uniqueId = useId();
  const filter0Id = `filter0_mlf_${uniqueId}`;
  const filter1Id = `filter1_mlf_${uniqueId}`;
  const filter2Id = `filter2_mlf_${uniqueId}`;
  const gradient0Id = `gradient0_mlf_${uniqueId}`;
  const gradient1Id = `gradient1_mlf_${uniqueId}`;
  const gradient2Id = `gradient2_mlf_${uniqueId}`;
  const gradient3Id = `gradient3_mlf_${uniqueId}`;
  const gradient4Id = `gradient4_mlf_${uniqueId}`;
  const mask0Id = `mask0_mlf_${uniqueId}`;
  const mask1Id = `mask1_mlf_${uniqueId}`;

  // Original viewBox is 162x214, aspect ratio ~0.757
  const height = size;
  const width = Math.round(size * (162 / 214));

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 162 214"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Document body layer 1 */}
      <g filter={`url(#${filter0Id})`}>
        <path
          d="M156 73V200C156 204.418 152.418 208 148 208H10C5.58172 208 2 204.418 2 200V10C2 5.58172 5.58172 2 10 2H84L156 73Z"
          style={{ fill: `url(#${gradient0Id})` }}
        />
      </g>

      {/* Document body layer 2 */}
      <g filter={`url(#${filter1Id})`}>
        <path
          d="M156 73V200C156 204.418 152.418 208 148 208H10C5.58172 208 2 204.418 2 200V10C2 5.58172 5.58172 2 10 2H84L156 73Z"
          style={{ fill: `url(#${gradient1Id})` }}
        />
      </g>

      {/* Mask 0 */}
      <mask id={mask0Id} style={{ maskType: 'alpha' }} maskUnits="userSpaceOnUse" x="2" y="2" width="154" height="206">
        <path
          d="M156 73V200C156 204.418 152.418 208 148 208H10C5.58172 208 2 204.418 2 200V10C2 5.58172 5.58172 2 10 2H84L156 73Z"
          style={{ fill: `url(#${gradient2Id})` }}
        />
      </mask>
      <g mask={`url(#${mask0Id})`}>
      </g>

      {/* Mask 1 with fold */}
      <mask id={mask1Id} style={{ maskType: 'alpha' }} maskUnits="userSpaceOnUse" x="2" y="2" width="154" height="206">
        <path
          d="M156 73V200C156 204.418 152.418 208 148 208H10C5.58172 208 2 204.418 2 200V10C2 5.58172 5.58172 2 10 2H84L156 73Z"
          style={{ fill: `url(#${gradient3Id})` }}
        />
      </mask>
      <g mask={`url(#${mask1Id})`}>
        {/* Outer fold with shadow */}
        <g filter={`url(#${filter2Id})`}>
          <path
            d="M158.683 67.0952H107.426C98.9064 67.0952 92 60.2858 92 51.8859V2L158.683 67.0952Z"
            fill="white"
            fillOpacity="0.3"
            shapeRendering="crispEdges"
          />
        </g>
        {/* Inner fold */}
        <path
          d="M155.507 65.5076H108.027C100.135 65.5076 93.7378 59.1101 93.7378 51.2184V4.35059L155.507 65.5076Z"
          style={{ fill: `url(#${gradient4Id})` }}
          fillOpacity="0.6"
        />
      </g>

      <defs>
        {/* Filter 0 - drop shadow and inner shadows */}
        <filter id={filter0Id} x="0" y="0" width="162" height="214" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
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
          <feOffset dx="1" dy="2" />
          <feGaussianBlur stdDeviation="1" />
          <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
          <feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0" />
          <feBlend mode="normal" in2="effect2_innerShadow" result="effect3_innerShadow" />
        </filter>

        {/* Filter 1 - same as filter 0 */}
        <filter id={filter1Id} x="0" y="0" width="162" height="214" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
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
          <feOffset dx="1" dy="2" />
          <feGaussianBlur stdDeviation="1" />
          <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
          <feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0" />
          <feBlend mode="normal" in2="effect2_innerShadow" result="effect3_innerShadow" />
        </filter>

        {/* Filter 2 - fold shadow */}
        <filter id={filter2Id} x="77.5877" y="-15.5877" width="98.6831" height="97.0952" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
          <feOffset dx="1.58769" dy="-1.58769" />
          <feGaussianBlur stdDeviation="8" />
          <feComposite in2="hardAlpha" operator="out" />
          <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" />
          <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow" />
          <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow" result="shape" />
        </filter>

        {/* Gradient 0 - main document */}
        <linearGradient id={gradient0Id} x1="6" y1="6.5" x2="151.5" y2="208" gradientUnits="userSpaceOnUse">
          <stop style={{ stopColor: 'hsl(var(--file-icon-bg))' }} />
          <stop offset="1" style={{ stopColor: 'hsl(var(--file-icon-bg-dark))' }} />
        </linearGradient>

        {/* Gradient 1 - same as gradient 0 */}
        <linearGradient id={gradient1Id} x1="6" y1="6.5" x2="151.5" y2="208" gradientUnits="userSpaceOnUse">
          <stop style={{ stopColor: 'hsl(var(--file-icon-bg))' }} />
          <stop offset="1" style={{ stopColor: 'hsl(var(--file-icon-bg-dark))' }} />
        </linearGradient>

        {/* Gradient 2 - mask gradient */}
        <linearGradient id={gradient2Id} x1="6" y1="6.5" x2="151.5" y2="208" gradientUnits="userSpaceOnUse">
          <stop style={{ stopColor: 'hsl(var(--file-icon-bg))' }} />
          <stop offset="1" style={{ stopColor: 'hsl(var(--file-icon-bg-dark))' }} />
        </linearGradient>

        {/* Gradient 3 - mask gradient */}
        <linearGradient id={gradient3Id} x1="6" y1="6.5" x2="151.5" y2="208" gradientUnits="userSpaceOnUse">
          <stop style={{ stopColor: 'hsl(var(--file-icon-bg))' }} />
          <stop offset="1" stopColor="white" />
        </linearGradient>

        {/* Gradient 4 - fold */}
        <linearGradient id={gradient4Id} x1="102.849" y1="54.3593" x2="122.5" y2="33.0002" gradientUnits="userSpaceOnUse">
          <stop style={{ stopColor: 'hsl(var(--file-icon-fold))' }} />
          <stop offset="1" style={{ stopColor: 'hsl(var(--file-icon-fold-dark))' }} />
        </linearGradient>
      </defs>
    </svg>
  );
}
