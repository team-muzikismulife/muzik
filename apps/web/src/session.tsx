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
const Context = createContext<{
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}>({ session: null, loading: true, signOut: async () => {} });
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const query = useQueryClient();
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, next) => {
        if (active) {
          setSession((previous) => {
            if (previous?.user.id !== next?.user.id) query.clear();
            return next;
          });
          setLoading(false);
        }
      },
    );
    void supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setSession(data.session);
        setLoading(false);
      }
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [query]);
  const signOut = async () => {
    const uid = session?.user.id;
    const { error } = await supabase!.auth.signOut({ scope: "local" });
    if (error) throw new Error("로그아웃하지 못했어요. 다시 시도해 주세요.");
    query.clear();
    for (const key of Object.keys(localStorage))
      if (uid && key.startsWith(`muzik:${uid}:`)) localStorage.removeItem(key);
    setSession(null);
  };
  return (
    <Context.Provider value={{ session, loading, signOut }}>
      {children}
    </Context.Provider>
  );
}
export const useSession = () => useContext(Context);
