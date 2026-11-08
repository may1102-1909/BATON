import React from "react";
import { ThreeDPaper } from "@designcodeio/threeui";
import "@designcodeio/threeui/style.css";

export function Scene({ variant = "original", className = "", style, onAction }) {
  return (
    <div className={`shader-frame relative w-full h-full ${className}`} style={style}>
      <ThreeDPaper variant={variant} onAction={onAction} />
    </div>
  );
}

export default Scene;
