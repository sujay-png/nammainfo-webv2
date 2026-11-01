"use client";

import { useEffect, useRef } from "react";
import s from "./manual.module.css";

/**
 * Renders one section of generated documentation HTML (our own content,
 * built at development time from the Developer Guide, never user input)
 * and adds a Copy button to every code block.
 */
export default function HtmlSection({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const blocks = Array.from(root.querySelectorAll<HTMLElement>(".hl"));
    const added: HTMLButtonElement[] = [];
    for (const block of blocks) {
      if (block.querySelector("button")) continue;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = s.copyButton;
      btn.textContent = "Copy";
      btn.addEventListener("click", async () => {
        const code = block.querySelector("pre")?.innerText ?? "";
        try {
          await navigator.clipboard.writeText(code);
          btn.textContent = "Copied";
        } catch {
          btn.textContent = "Press Ctrl+C";
        }
        setTimeout(() => (btn.textContent = "Copy"), 1600);
      });
      block.appendChild(btn);
      added.push(btn);
    }
    return () => added.forEach((b) => b.remove());
  }, [html]);

  return <div ref={ref} dangerouslySetInnerHTML={{ __html: html }} />;
}
