import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { command, loadRoom, supabase } from "./backend";
import { todayKey, type Action } from "../../../packages/domain/index";
export function useToday() {
  const [day, setDay] = useState(todayKey);
  useEffect(() => {
    const refresh = () => setDay(todayKey());
    const timer = setInterval(refresh, 10000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  return day;
}
export function useCommand<
  T = { roomId: string; dateKey?: string; code?: string },
>(action: Action) {
  const pending = useRef<{ key: string; id: string } | null>(null);
  return useMutation({
    mutationFn: (payload: Record<string, string>) => {
      const key = JSON.stringify(payload);
      if (pending.current?.key !== key)
        pending.current = { key, id: crypto.randomUUID() };
      return command<T>(action, payload, pending.current.id);
    },
    onSuccess: () => {
      pending.current = null;
    },
    retry: false,
  });
}
export function useRoom(id: string, date: string, uid: string) {
  const cache = useQueryClient();
  const [live, setLive] = useState(false);
  const result = useQuery({
    queryKey: ["room", uid, id, date],
    queryFn: () => loadRoom(id, date),
  });
  const refresh = useCallback(() => {
    void cache.invalidateQueries({ queryKey: ["room", uid, id] });
    void cache.invalidateQueries({ queryKey: ["teams", uid] });
  }, [cache, id, uid]);
  useEffect(() => {
    if (!supabase) return;
    let channel: ReturnType<typeof supabase.channel> | undefined;
    const stop = () => {
      if (channel) {
        void supabase!.removeChannel(channel);
        channel = undefined;
      }
      setLive(false);
    };
    const start = () => {
      stop();
      if (document.visibilityState !== "visible") return;
      refresh();
      channel = supabase!
        .channel(`room:${id}:${crypto.randomUUID()}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "rooms",
            filter: `id=eq.${id}`,
          },
          refresh,
        )
        .subscribe((status) => setLive(status === "SUBSCRIBED"));
    };
    document.addEventListener("visibilitychange", start);
    start();
    return () => {
      document.removeEventListener("visibilitychange", start);
      stop();
    };
  }, [id, refresh]);
  return { ...result, live };
}
