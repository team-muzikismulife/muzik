import { useEffect, useLayoutEffect } from "react";
import { useLocation, useNavigationType } from "react-router";
export function useScrollMemory(uid: string, ready: boolean) {
  const location = useLocation();
  const navigation = useNavigationType();
  const key = `muzik:${uid}:scroll:${location.pathname}${location.search}`;
  useEffect(() => {
    history.scrollRestoration = "manual";
    let value = window.scrollY;
    const remember = () => {
      value = window.scrollY;
    };
    window.addEventListener("scroll", remember, { passive: true });
    return () => {
      window.removeEventListener("scroll", remember);
      try {
        sessionStorage.setItem(key, String(value));
      } catch {
        /* Memory is optional. */
      }
    };
  }, [key]);
  useLayoutEffect(() => {
    if (!ready) return;
    let value = 0;
    try {
      if (navigation === "POP")
        value = Number(sessionStorage.getItem(key)) || 0;
    } catch {
      /* Memory is optional. */
    }
    const frame = requestAnimationFrame(() => window.scrollTo(0, value));
    return () => cancelAnimationFrame(frame);
  }, [key, ready, navigation]);
}
