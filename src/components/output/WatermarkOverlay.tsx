"use client";

import * as React from "react";

export interface WatermarkOverlayProps {
  clientAddress: string;
  timestamp: string;
}

/**
 * Truncates an address to first 6 + "..." + last 4 characters.
 * e.g. "ABCDEFGHIJ...7890"
 */
export function truncateAddress(address: string): string {
  if (address.length <= 13) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Builds an SVG data URI for the tiled watermark pattern.
 * The text is rotated 45° and contains the truncated address + timestamp.
 */
function buildWatermarkSvg(text: string): string {
  const encodedText = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200">
    <text
      x="150"
      y="100"
      text-anchor="middle"
      dominant-baseline="middle"
      transform="rotate(45, 150, 100)"
      font-family="monospace"
      font-size="12"
      fill="currentColor"
      opacity="1"
    >${encodedText}</text>
  </svg>`;

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * WatermarkOverlay renders a full-coverage tiled SVG watermark pattern
 * over protected content. It displays the truncated client address and timestamp
 * at 15-25% opacity with text rotated at 45°. The overlay does not intercept
 * pointer events, allowing interaction with content below.
 */
export function WatermarkOverlay({ clientAddress, timestamp }: WatermarkOverlayProps) {
  const displayAddress = truncateAddress(clientAddress);
  const watermarkText = `${displayAddress} ${timestamp}`;
  const svgDataUri = buildWatermarkSvg(watermarkText);

  return (
    <div
      data-testid="watermark-overlay"
      className="absolute inset-0 z-10"
      style={{
        pointerEvents: "none",
        opacity: 0.2,
        backgroundImage: `url("${svgDataUri}")`,
        backgroundRepeat: "repeat",
        backgroundSize: "300px 200px",
      }}
      aria-hidden="true"
    />
  );
}
