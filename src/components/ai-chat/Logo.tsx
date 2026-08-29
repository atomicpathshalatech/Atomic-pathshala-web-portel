import Image from "next/image";

interface LogoProps {
  compact?: boolean;
}

export function Logo({ compact = false }: LogoProps) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl shadow-md">
        <Image
          src="/atomic-logo.png"
          alt="Atomic Pathshala"
          width={40}
          height={40}
          className="object-contain"
          priority
        />
      </div>

      {!compact && (
        <div className="min-w-0">
          <p className="truncate text-sm font-bold leading-tight text-slate-900 dark:text-white">
            Atomic Guru
          </p>
          <p className="truncate text-xs text-orange-500">
            by Atomic Pathshala
          </p>
        </div>
      )}
    </div>
  );
}
