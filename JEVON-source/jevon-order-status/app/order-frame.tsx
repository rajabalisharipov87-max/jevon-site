"use client";

import { useEffect, useRef } from "react";

export default function OrderFrame() {
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const viewport = window.visualViewport;
    const fit = () => {
      if (!frame.current) return;
      frame.current.style.height = `${viewport?.height ?? window.innerHeight}px`;
      frame.current.style.top = `${viewport?.offsetTop ?? 0}px`;
    };
    fit();
    window.addEventListener("resize", fit);
    window.addEventListener("pageshow", fit);
    viewport?.addEventListener("resize", fit);
    viewport?.addEventListener("scroll", fit);
    return () => {
      window.removeEventListener("resize", fit);
      window.removeEventListener("pageshow", fit);
      viewport?.removeEventListener("resize", fit);
      viewport?.removeEventListener("scroll", fit);
    };
  }, []);
  return <iframe ref={frame} title="JEVON | Статус заказов" src="/legacy.html" allow="camera" style={{ display: "block", position: "fixed", top: 0, left: 0, border: 0, width: "100%", height: "100dvh" }} />;
}
