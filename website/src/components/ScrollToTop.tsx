import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";

export default function ScrollToTop() {
  const { pathname, search, hash, key } = useLocation();

  useLayoutEffect(() => {
    if (hash) {
      const frame = window.requestAnimationFrame(() => {
        const target = document.getElementById(decodeURIComponent(hash.slice(1)));
        if (target) {
          target.scrollIntoView({ behavior: "auto", block: "start" });
        } else {
          window.scrollTo({ top: 0, left: 0, behavior: "auto" });
        }
      });
      return () => window.cancelAnimationFrame(frame);
    }

    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname, search, hash, key]);

  return null;
}
