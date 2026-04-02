/* eslint-disable @next/next/no-img-element */

"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";

export const AVATAR_FILE_ACCEPT =
  ".png,.jpg,.jpeg,.gif,.webp,.mp4,.webm";

export const AVATAR_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
]);

export const PASSTHROUGH_AVATAR_CONTENT_TYPES = new Set([
  "image/gif",
  "image/webp",
  "video/mp4",
  "video/webm",
]);

export const MAX_PASSTHROUGH_AVATAR_BYTES = 700 * 1024;

export const isVideoAvatarSource = (value: string | null | undefined) => {
  if (typeof value !== "string") {
    return false;
  }

  const normalized = value.trim().toLowerCase();

  return (
    normalized.startsWith("data:video/") ||
    /\.((mp4)|(webm))(?:$|[?#])/i.test(normalized)
  );
};

const ANIMATED_DATA_URL_PATTERN = /^data:(image\/gif|image\/webp|video\/(?:mp4|webm))/i;
const isAnimatedAvatarSource = (value: string | null | undefined) =>
  typeof value === "string" &&
  (
    ANIMATED_DATA_URL_PATTERN.test(value.trim()) ||
    /\.((gif)|(webp))(?:$|[?#])/i.test(value.trim())
  );

const dataUrlToBlob = (dataUrl: string) => {
  const separatorIndex = dataUrl.indexOf(",");

  if (separatorIndex === -1) {
    throw new Error("Invalid data URL.");
  }

  const metadata = dataUrl.slice(0, separatorIndex);
  const payload = dataUrl.slice(separatorIndex + 1);
  const mimeMatch = metadata.match(/^data:([^;,]+)/i);
  const mimeType = mimeMatch?.[1] ?? "application/octet-stream";

  if (/;base64/i.test(metadata)) {
    const binary = window.atob(payload);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return new Blob([bytes], { type: mimeType });
  }

  return new Blob([decodeURIComponent(payload)], { type: mimeType });
};

type AvatarMediaProps = {
  alt: string;
  className: string;
  src: string;
  style?: CSSProperties;
  loading?: "eager" | "lazy";
  decoding?: "auto" | "async" | "sync";
};

const initialsFromLabel = (value: string) => {
  const parts = value
    .split(/[\s@._-]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (!parts.length) {
    return "U";
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);
};

export function AvatarMedia({
  alt,
  className,
  src,
  style,
  loading,
  decoding,
}: AvatarMediaProps) {
  const [{ source, hasLoadError, isLoaded }, setLoadState] = useState(() => ({
    source: src,
    hasLoadError: false,
    isLoaded: false,
  }));

  const { resolvedSrc, revokeOnCleanup } = useMemo(() => {
    if (!isAnimatedAvatarSource(src)) {
      return {
        resolvedSrc: src,
        revokeOnCleanup: false,
      };
    }

    try {
      return ANIMATED_DATA_URL_PATTERN.test(src.trim())
        ? {
            resolvedSrc: URL.createObjectURL(dataUrlToBlob(src)),
            revokeOnCleanup: true,
          }
        : {
            resolvedSrc: src,
            revokeOnCleanup: false,
          };
    } catch {
      return {
        resolvedSrc: src,
        revokeOnCleanup: false,
      };
    }
  }, [src]);

  const renderKey = `${source === src ? source : src}:${resolvedSrc}`;
  const resolvedHasLoadError = source === src ? hasLoadError : false;
  const resolvedIsLoaded = source === src ? isLoaded : false;

  useEffect(() => {
    return () => {
      if (revokeOnCleanup) {
        URL.revokeObjectURL(resolvedSrc);
      }
    };
  }, [resolvedSrc, revokeOnCleanup]);

  const markLoaded = () => {
    setLoadState((currentState) =>
      currentState.source === src && currentState.isLoaded
        ? currentState
        : {
            source: src,
            hasLoadError: false,
            isLoaded: true,
          }
    );
  };

  const markLoadError = () => {
    setLoadState({
      source: src,
      hasLoadError: true,
      isLoaded: false,
    });
  };

  if (!resolvedSrc || resolvedHasLoadError) {
    return (
      <span
        role="img"
        aria-label={alt}
        title={alt}
        className={`${className} flex items-center justify-center bg-[#171012] text-[11px] font-black uppercase text-[#ffb7c5]`}
        style={style}
      >
        {initialsFromLabel(alt)}
      </span>
    );
  }

  if (isVideoAvatarSource(resolvedSrc)) {
    return (
      <span
        role="img"
        aria-label={alt}
        title={alt}
        className={`${className} relative isolate overflow-hidden bg-[#171012]`}
        style={style}
      >
        <span className="absolute inset-0 flex items-center justify-center text-[11px] font-black uppercase text-[#ffb7c5]">
          {initialsFromLabel(alt)}
        </span>
        <video
          key={renderKey}
          src={resolvedSrc}
          aria-label={alt}
          title={alt}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
          className={`absolute inset-0 h-full w-full object-cover transition duration-200 ${
            resolvedIsLoaded ? "opacity-100" : "opacity-0"
          }`}
          onLoadedData={markLoaded}
          onCanPlay={markLoaded}
          onError={markLoadError}
        />
      </span>
    );
  }

  return (
    <span
      role="img"
      aria-label={alt}
      title={alt}
      className={`${className} relative isolate overflow-hidden bg-[#171012]`}
      style={style}
    >
      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-black uppercase text-[#ffb7c5]">
        {initialsFromLabel(alt)}
      </span>
      <img
        key={renderKey}
        src={resolvedSrc}
        alt=""
        aria-label={alt}
        title={alt}
        loading={loading}
        decoding={isAnimatedAvatarSource(resolvedSrc) ? undefined : decoding}
        className={`absolute inset-0 h-full w-full object-cover transition duration-200 ${
          resolvedIsLoaded ? "opacity-100" : "opacity-0"
        }`}
        onLoad={markLoaded}
        onError={markLoadError}
      />
    </span>
  );
}
