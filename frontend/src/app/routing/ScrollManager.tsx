import { useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

export function ScrollManager() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const positions = useRef<Map<string, number>>(new Map());
  const previousLocation = useRef(location);
  const previousRestoration = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (typeof window === "undefined" || typeof window.history === "undefined") return;

    try {
      previousRestoration.current = window.history.scrollRestoration;
      if (window.history.scrollRestoration !== "manual") {
        window.history.scrollRestoration = "manual";
      }
    } catch {
      // ignore in environments without scrollRestoration
    }

    return () => {
      try {
        if (previousRestoration.current !== null) {
          window.history.scrollRestoration = previousRestoration.current as ScrollRestoration;
        }
      } catch {
        // ignore
      }
    };
  }, []);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;

    const previous = previousLocation.current;
    const currentKey = location.key;
    const previousKey = previous.key;

    if (previousKey !== currentKey) {
      positions.current.set(previousKey, window.scrollY);
    }

    const isPop = navigationType === "POP";
    const pathnameChanged = previous.pathname !== location.pathname;

    if (isPop) {
      const savedY = positions.current.get(currentKey);
      const top = savedY ?? 0;
      try {
        window.scrollTo({ top, left: 0, behavior: "instant" as ScrollBehavior });
        if (window.scrollY !== top) window.scrollTo(0, top);
      } catch {
        window.scrollTo(0, top);
      }
    } else if (pathnameChanged) {
      try {
        window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
        if (window.scrollY !== 0) window.scrollTo(0, 0);
      } catch {
        window.scrollTo(0, 0);
      }
    }

    previousLocation.current = location;
  }, [location, navigationType]);

  return null;
}
