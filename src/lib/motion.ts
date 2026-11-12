// Motion system — Tindahan POS
// Shared brand-motion tokens + GSAP registration. Follows the
// gsap-core / gsap-react / gsap-performance skills.

import gsap from "gsap";
import { useGSAP } from "@gsap/react";

/** Brand motion tokens: durations (seconds) and the chosen easings.
 *  High-frequency touch feedback stays under ~0.25s; entrances(get) longer. */
export const MOTION = {
  micro: 0.14, // badge pulse, status dot
  quick: 0.22, // quantity change, tab switch, small confirms
  standard: 0.34, // drawer, dialogs, panels
  entrance: 0.46, // screen / modal entrance
  // Eases — warm, organic curves (avoids the default "robotic" ease)
  easeOut: "power3.out",
  easeOutBack: "back.out(1.7)",
  easeIn: "power3.in",
  easeInOut: "power3.inOut",
  easeSmooth: "power2.out",
  easePop: "elastic.out(1.15, 0.3)",
  easeNone: "none",
} as const;

/**
 * Registers GSAP + the React hook once, and sets project-wide defaults.
 * Call this from every component/entry that uses GSAP, or from your root.
 */
export function registerGsap() {
  gsap.registerPlugin(useGSAP);
  gsap.defaults({
    ease: MOTION.easeOut,
    duration: MOTION.standard,
  });
  // Respect the OS reduced-motion preference at the root so the app never
  // forces motion on users who have turned it off.
  if (typeof window !== "undefined") {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      gsap.defaults({ duration: 0, ease: MOTION.easeNone });
    }
  }
  return { gsap, useGSAP, MOTION };
}

export { gsap, useGSAP };
