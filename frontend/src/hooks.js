import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "./api";

export function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// Loads a GET endpoint and reloads when the path changes or reload() is called.
export function useApi(path) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!path) return undefined;
    let live = true;
    setLoading(true);
    api(path)
      .then((d) => {
        if (live) {
          setData(d);
          setError("");
        }
      })
      .catch((e) => live && setError(errorMessage(e)))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [path, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, reload };
}

export function formatDate(iso) {
  if (!iso) return "";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const SPINES = ["#24544A", "#8A3B34", "#34507A", "#8A6A2A", "#5B3F73", "#2D6A72", "#6B6B2A", "#7A4B2F"];

// Same category always gets the same spine colour.
export function spineColor(category) {
  if (!category) return "#9AA5A0";
  let h = 0;
  for (const ch of category) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return SPINES[h % SPINES.length];
}
