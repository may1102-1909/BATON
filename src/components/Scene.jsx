import React from "react";
import { ThreeDPaper } from "@designcodeio/threeui";
import "@designcodeio/threeui/style.css";

export function Scene({ className = "", style, variant = "original", onAction }) {
  return (
    <div className={`shader-frame w-full h-full relative ${className}`} style={style}>
      <ThreeDPaper
        variant={variant}
        onAction={onAction}
      />
    </div>
  );
}

export default Scene;
