import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "./backend";
import { clearUserLocal } from "./local";
import { UUID } from "../../../packages/domain/index";
const ownerKey = "muzik:local-owner";
function storedOwner() {
  try {
    const uid = localStorage.getItem(ownerKey);
    return uid && UUID.test(uid) ? uid : null;
  } catch {
    return null;
  }
}
const Context = createContext<{
  session: Session | null;
  loading: boolean;
  localUid: string | null;
  signOut: () => Promise<void>;
}>({ session: null, loading: true, localUid: null, signOut: async () => {} });
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase) && navigator.onLine);
  const [localUid, setLocalUid] = useState(storedOwner);
  const query = useQueryClient();
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    let authEventReceived = false;
    let currentUid: string | undefined = storedOwner() ?? undefined;
    const applySession = (next: Session | null) => {
      if (!active) return;
      if (currentUid !== next?.user.id) {
        query.clear();
        if (currentUid && next) clearUserLocal(currentUid);
      }
      currentUid = next?.user.id ?? currentUid;
      if (next) {
        setLocalUid(next.user.id);
        try {
          localStorage.setItem(ownerKey, next.user.id);
        } catch {}
      }
      setSession(next);
      setLoading(false);
    };
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, next) => {
        authEventReceived = true;
        applySession(next);
      },
    );
    void supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!authEventReceived) applySession(data.session);
      })
      .catch(() => {
        if (!authEventReceived) applySession(null);
      });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [query]);
  const signOut = async () => {
    const uid = session?.user.id ?? localUid;
    const { error } = await supabase!.auth.signOut({ scope: "local" });
    if (error) throw new Error("로그아웃하지 못했어요. 다시 시도해 주세요.");
    query.clear();
    if (uid) clearUserLocal(uid);
    localStorage.removeItem(ownerKey);
    setLocalUid(null);
    setSession(null);
  };
  return (
    <Context.Provider value={{ session, loading, localUid, signOut }}>
      {children}
    </Context.Provider>
  );
}
export const useSession = () => useContext(Context);
