import { useState } from "react";
import { MuscleThumbnail } from "@/components/MuscleThumbnail";
import { ImageOff } from "lucide-react";
export function ExerciseMedia({
  url,
  name,
  muscle,
  className = "",
}: {
  url: string | null;
  name: string;
  muscle: string;
  className?: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const valid = url && /^https:\/\//i.test(url) && failedUrl !== url;
  return (
    <div className={`overflow-hidden rounded-2xl bg-surface-2 ${className}`}>
      {valid ? (
        <img
          src={url}
          alt={`Demonstração de ${name}`}
          loading="lazy"
          className="h-full w-full object-contain"
          onError={() => setFailedUrl(url)}
        />
      ) : (
        <div
          className="grid h-full w-full place-items-center"
          aria-label="Demonstração indisponível"
        >
          {muscle ? (
            <MuscleThumbnail muscle={muscle} />
          ) : (
            <ImageOff className="size-8 text-muted-foreground" aria-hidden="true" />
          )}
        </div>
      )}
    </div>
  );
}
