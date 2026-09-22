import { useQuery } from "@tanstack/react-query";
import { command } from "./backend";
import { useSession } from "./session";
import { useOnline } from "./lifecycle";
export function useCapabilities() {
  const { session } = useSession();
  const online = useOnline();
  return useQuery({
    queryKey: ["capabilities", session?.user.id],
    enabled: Boolean(session) && online,
    staleTime: 300000,
    retry: false,
    queryFn: () =>
      command<{ operator: boolean }>(
        "getCapabilities",
        {},
        crypto.randomUUID(),
      ),
  });
}
export type OperationData = {
  reports: {
    id: string;
    room_id: string;
    track_id: string;
    reason: string;
    original: { title: string; comment: string; video_id: string };
    created_at: string;
  }[];
  feedback: {
    id: string;
    room_id: string;
    message: string;
    created_at: string;
  }[];
  metrics: { day_key: string; kind: string; users: number }[];
};
