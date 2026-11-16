import { avatarClass } from "@/utils/ui";

interface AvatarProps {
  name: string;
  seed?: string;
  size?: "xs" | "sm" | "md";
  className?: string;
}

const SIZE_CLASS = {
  xs: "w-5 h-5 text-[10px]",
  sm: "w-7 h-7 text-[11px]",
  md: "w-9 h-9 text-[13px]",
};

export default function Avatar({ name, seed, size = "sm", className = "" }: AvatarProps) {
  const initial = name ? name.slice(0, 1) : "?";
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-semibold ${SIZE_CLASS[size]} ${avatarClass(seed || name)} ${className}`}
      title={name}
    >
      {initial}
    </span>
  );
}