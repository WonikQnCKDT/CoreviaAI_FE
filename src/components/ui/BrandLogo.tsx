interface BrandLogoProps {
  /** 크기·색상 유틸리티. 색은 text-* 클래스의 currentColor를 그대로 사용합니다. */
  className?: string;
}

/**
 * 브랜드 마크.
 * currentColor를 사용하므로 감싸는 요소의 text-* 색상(테마 primary 등)에 맞춰 자동으로 바뀝니다.
 */
export default function BrandLogo({ className = "h-5 w-auto" }: BrandLogoProps) {
  return (
    <svg
      viewBox="72.5 46.5 142 185"
      className={className}
      fill="currentColor"
      role="img"
      aria-label="CoreviaAI 로고"
      focusable="false"
    >
      <path d="M160 46.5 209 68.5 187.5 107 160 90.5 111 117.5 111 162 160 189 187.5 172.5 214.5 199.5 160 231.5 72.5 183 72.5 96Z" />
    </svg>
  );
}