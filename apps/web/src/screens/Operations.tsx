import { useState } from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, RefreshCw, Check, EyeOff } from "lucide-react";
import { command } from "../backend";
import { useCapabilities, type OperationData } from "../operations";
import { useCommand } from "../hooks";
import { useSession } from "../session";
import { useOnline, useUpdateGuard } from "../lifecycle";
import { State, ErrorText } from "../components/ui";
import s from "../App.module.css";
function Resolution({
  item,
  kind,
  done,
}: {
  item: OperationData["reports"][number] | OperationData["feedback"][number];
  kind: "report" | "feedback";
  done: () => void;
}) {
  const [note, setNote] = useState("");
  const action = useCommand(
    kind === "report" ? "resolveReport" : "resolveFeedback",
  );
  const refresh = useCommand("refreshMeta");
  const online = useOnline();
  useUpdateGuard(`operation-${item.id}`, {
    busy: action.isPending || refresh.isPending,
    unsafe: Boolean(note),
    editing: Boolean(note),
  });
  const resolve = (decision: string) => {
    if (!note.trim() || !online) return;
    void action
      .mutateAsync(
        kind === "report"
          ? { reportId: item.id, decision, note: note.trim() }
          : { feedbackId: item.id, note: note.trim() },
      )
      .then(done)
      .catch(() => {});
  };
  return (
    <article className={s.section}>
      <h3>
        {kind === "report"
          ? (item as OperationData["reports"][number]).original.title
          : "사용자 의견"}
      </h3>
      <p>
        {kind === "report"
          ? (item as OperationData["reports"][number]).reason
          : (item as OperationData["feedback"][number]).message}
      </p>
      {kind === "report" && (
        <p className={s.comment}>
          {(item as OperationData["reports"][number]).original.comment}
        </p>
      )}
      <small>{new Date(item.created_at).toLocaleString("ko-KR")}</small>
      <label>
        처리 메모
        <input
          maxLength={200}
          value={note}
          disabled={action.isPending}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      <div className={s.actions}>
        {kind === "report" && (
          <button
            className={s.secondary}
            disabled={!online || !note.trim() || action.isPending}
            onClick={() => {
              if (
                confirm(
                  "이 추천을 팀에서 숨길까요? 원문은 비공개로 보관합니다.",
                )
              )
                resolve("hide");
            }}
          >
            <EyeOff size={18} />곡 숨기기
          </button>
        )}
        <button
          className={s.secondary}
          disabled={!online || !note.trim() || action.isPending}
          onClick={() => resolve("dismiss")}
        >
          <Check size={18} />
          {kind === "report" ? "숨김 없이 종결" : "검토 완료"}
        </button>
      </div>
      {kind === "report" && (
        <button
          className={s.textAction}
          disabled={!online || refresh.isPending}
          onClick={() =>
            void refresh
              .mutateAsync({
                roomId: item.room_id,
                trackId: (item as OperationData["reports"][number]).track_id,
              })
              .catch(() => {})
          }
        >
          <RefreshCw size={16} />
          현재 곡 정보 갱신
        </button>
      )}
      {refresh.isSuccess && (
        <p role="status">
          현재 곡 정보를 확인했어요. 신고 당시 원문은 그대로 보존합니다.
        </p>
      )}
      <ErrorText error={action.error || refresh.error} />
    </article>
  );
}
export default function Operations() {
  const { session } = useSession();
  const capabilities = useCapabilities();
  const online = useOnline();
  const data = useQuery({
    queryKey: ["operations", session?.user.id],
    enabled: online && capabilities.data?.operator === true,
    retry: false,
    queryFn: () =>
      command<OperationData>("getOperations", {}, crypto.randomUUID()),
  });
  if (!online)
    return <State page title="운영 검토는 온라인에서 이용해 주세요" />;
  if (capabilities.isPending) return <State page title="권한 확인 중" />;
  if (!capabilities.data?.operator)
    return (
      <State page title="운영 권한이 없어요">
        <Link className={s.secondary} to="/">
          홈으로
        </Link>
        <ErrorText error={capabilities.error} />
      </State>
    );
  const ref = (import.meta.env.VITE_SUPABASE_URL || "").match(
    /^https:\/\/([a-z0-9]{20})\.supabase\.co\/?$/,
  )?.[1];
  const labels: Record<string, string> = {
    visit: "일 방문",
    install_open: "설치 안내 진입",
    install_accepted: "설치 요청 수락",
    standalone: "독립 창 실행",
  };
  return (
    <section className={s.stack}>
      <Link className={s.textAction} to="/">
        <ArrowLeft size={18} />
        홈으로
      </Link>
      <h1>운영 검토</h1>
      <button
        className={s.secondary}
        disabled={data.isFetching}
        onClick={() => void data.refetch()}
      >
        <RefreshCw size={18} />
        새로고침
      </button>
      <ErrorText error={data.error} />
      {data.isPending ? (
        <State />
      ) : (
        data.data && (
          <>
            <section>
              <h2>접수된 신고</h2>
              {!data.data.reports.length ? (
                <p>대기 중인 신고가 없어요.</p>
              ) : (
                data.data.reports.map((item) => (
                  <Resolution
                    key={item.id}
                    kind="report"
                    item={item}
                    done={() => void data.refetch()}
                  />
                ))
              )}
              {data.data.reports.length === 50 && (
                <p>먼저 접수된 50건이에요. 처리 후 다음 접수를 불러옵니다.</p>
              )}
            </section>
            <section>
              <h2>사용자 의견</h2>
              {!data.data.feedback.length ? (
                <p>대기 중인 의견이 없어요.</p>
              ) : (
                data.data.feedback.map((item) => (
                  <Resolution
                    key={item.id}
                    kind="feedback"
                    item={item}
                    done={() => void data.refetch()}
                  />
                ))
              )}
              {data.data.feedback.length === 50 && (
                <p>먼저 접수된 50건이에요. 처리 후 다음 접수를 불러옵니다.</p>
              )}
            </section>
            <section>
              <h2>최근 7일 기록</h2>
              <p className={s.notice}>
                한국 날짜 기준 계정별 하루 한 번 집계합니다. 설치 요청 수락은
                설치 완료가 아니며 독립 창 실행은 브라우저 표시 모드 기준입니다.
              </p>
              {data.data.metrics.length ? (
                <ul>
                  {data.data.metrics.map((m) => (
                    <li key={`${m.day_key}:${m.kind}`}>
                      {m.day_key} · {labels[m.kind]}: {m.users}명
                    </li>
                  ))}
                </ul>
              ) : (
                <p>수집된 기록이 없어요.</p>
              )}
            </section>
          </>
        )
      )}
      <section className={s.section}>
        <h2>운영 상태 확인</h2>
        {ref ? (
          <a
            className={s.textAction}
            href={`https://supabase.com/dashboard/project/${ref}/usage`}
            target="_blank"
            rel="noopener noreferrer"
          >
            현재 프로젝트 사용량
          </a>
        ) : (
          <p>실제 프로젝트 사용량 링크는 정식 프로젝트 연결 후 제공됩니다.</p>
        )}
        <p>
          무료 프로젝트는 활동이 적으면 일시정지될 수 있어요. Dashboard에서
          상태를 확인하고 복구한 뒤 로그인·팀 조회·등록을 점검하세요. 한도에
          가까우면 모집과 호출 빈도를 줄이며 자동 유료 전환이나 유지용 호출을
          하지 않습니다.
        </p>
        <a
          className={s.textAction}
          href="https://supabase.com/docs/guides/platform/free-project-pausing"
          target="_blank"
          rel="noopener noreferrer"
        >
          일시정지·복구 공식 안내
        </a>
        <p>
          앱 문제는 같은 고정 주소의 직전 정적 배포로 되돌립니다. DB와
          Firebase로 자동 전환하지 않습니다. 초안 호환성을 확인하고 이전 버전
          업데이트를 사용자 선택으로 적용합니다.
        </p>
      </section>
    </section>
  );
}
