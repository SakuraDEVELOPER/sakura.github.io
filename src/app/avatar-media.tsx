/* eslint-disable @next/next/no-img-element */

"use client";

import { useEffect, useState, type CSSProperties } from "react";

export const AVATAR_FILE_ACCEPT =
  "image/png,image/jpeg,.png,.jpg,.jpeg";

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

export const MAX_PASSTHROUGH_AVATAR_BYTES = 512 * 1024;

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
const ANIMATED_IMAGE_DATA_URL_PATTERN = /^data:(image\/gif|image\/webp)/i;

const isAnimatedAvatarSource = (value: string | null | undefined) =>
  typeof value === "string" &&
  (
    ANIMATED_DATA_URL_PATTERN.test(value.trim()) ||
    /\.((gif)|(webp))(?:$|[?#])/i.test(value.trim())
  );

const isAnimatedImageAvatarSource = (value: string | null | undefined) =>
  typeof value === "string" &&
  (
    ANIMATED_IMAGE_DATA_URL_PATTERN.test(value.trim()) ||
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

export function AvatarMedia({
  alt,
  className,
  src,
  style,
  loading,
  decoding,
}: AvatarMediaProps) {
  const [resolvedSrc, setResolvedSrc] = useState(src);
  const [renderKey, setRenderKey] = useState(0);

  useEffect(() => {
    let objectUrl: string | null = null;
    let animationFrameId = 0;

    if (!isAnimatedAvatarSource(src)) {
      setResolvedSrc(src);
      setRenderKey((currentKey) => currentKey + 1);
      return;
    }

    setResolvedSrc("");

    try {
      objectUrl = ANIMATED_DATA_URL_PATTERN.test(src.trim())
        ? URL.createObjectURL(dataUrlToBlob(src))
        : src;
    } catch {
      objectUrl = src;
    }

    animationFrameId = window.requestAnimationFrame(() => {
      setResolvedSrc(objectUrl ?? src);
      setRenderKey((currentKey) => currentKey + 1);
    });

    return () => {
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
      }

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [src]);

  if (isVideoAvatarSource(resolvedSrc)) {
    return (
      <video
        key={`${renderKey}:${resolvedSrc}`}
        src={resolvedSrc}
        aria-label={alt}
        title={alt}
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        disablePictureInPicture
        className={className}
        style={style}
      />
    );
  }

  if (isAnimatedImageAvatarSource(resolvedSrc)) {
    return (
      <span
        key={`${renderKey}:${resolvedSrc}`}
        role="img"
        aria-label={alt}
        title={alt}
        className={className}
        style={{
          ...style,
          display: "block",
          backgroundImage: `url("${resolvedSrc}")`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      />
    );
  }

  return (
    <img
      key={`${renderKey}:${resolvedSrc}`}
      src={resolvedSrc}
      alt={alt}
      loading={loading}
      decoding={isAnimatedAvatarSource(resolvedSrc) ? undefined : decoding}
      className={className}
      style={style}
    />
  );
}
