import { useState } from "react";
import { Link } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Play, Pencil, Trash2, EyeOff, Flag } from "lucide-react";
import type { Track } from "../backend";
import { useCommand } from "../hooks";
import { ErrorText, Menu } from "./ui";
import s from "../App.module.css";

export function TrackCard({
  roomId,
  track,
  nickname,
  mine,
  editable,
  onHide,
}: {
  roomId: string;
  track: Track;
  nickname: string;
  mine: boolean;
  editable: boolean;
  onHide: (id: string) => void;
}) {
  const remove = useCommand("deleteTrack");
  const report = useCommand("reportTrack");
  const cache = useQueryClient();
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState("부적절한 내용");
  const [reported, setReported] = useState(false);
  const deleteTrack = async () => {
    if (!confirm("오늘의 곡을 삭제할까요?")) return;
    try {
      await remove.mutateAsync({
        roomId,
        trackId: track.id,
        dateKey: track.date_key,
      });
      await cache.invalidateQueries({ queryKey: ["room"] });
      await cache.invalidateQueries({ queryKey: ["teams"] });
      await cache.invalidateQueries({ queryKey: ["history"] });
    } catch {
      /* Display server error. */
    }
  };
  return (
    <article
      className={s.track}
      data-track-id={track.id}
      aria-label={`${nickname}님의 추천`}
    >
      <div className={s.trackInfo}>
        <div className={s.between}>
          <div className={s.row}>
            <span className={s.avatar}>{nickname.slice(0, 1)}</span>
            <span>{nickname}</span>
          </div>
          <Menu label="더보기">
            {(close) => (
              <>
                {mine && editable && (
                  <>
                    <Link
                      to={`/room/${roomId}/track/edit?date=${track.date_key}&track=${track.id}`}
                      onClick={close}
                    >
                      <Pencil size={16} />내 곡 수정
                    </Link>
                    <button
                      disabled={remove.isPending}
                      onClick={() => {
                        close();
                        void deleteTrack();
                      }}
                    >
                      <Trash2 size={16} />내 곡 삭제
                    </button>
                  </>
                )}
                {!mine && (
                  <>
                    <button
                      onClick={() => {
                        close();
                        onHide(track.id);
                      }}
                    >
                      <EyeOff size={16} />
                      나에게 숨기기
                    </button>
                    <button
                      onClick={() => {
                        close();
                        setReportOpen(true);
                      }}
                    >
                      <Flag size={16} />
                      {reported ? "신고 접수됨" : "신고하기"}
                    </button>
                  </>
                )}
              </>
            )}
          </Menu>
        </div>
        <div className={s.trackSummary}>
          <img
            src={`https://i.ytimg.com/vi/${track.video_id}/hqdefault.jpg`}
            alt=""
            loading="lazy"
          />
          <div>
            <h3>{track.title}</h3>
            <small>{track.artist}</small>
          </div>
        </div>
        {track.comment && <p className={s.comment}>{track.comment}</p>}
        <Link
          className={s.secondary}
          to={`/room/${roomId}/playlist/${track.date_key}?track=${track.id}`}
        >
          <Play size={18} />
          듣기
        </Link>
        <ErrorText error={remove.error} />
        {reportOpen && (
          <form
            className={s.reportForm}
            onSubmit={(e) => {
              e.preventDefault();
              void report
                .mutateAsync({
                  roomId,
                  trackId: track.id,
                  reason: reason.trim(),
                })
                .then(() => {
                  setReported(true);
                  setReportOpen(false);
                })
                .catch(() => {});
            }}
          >
            <label>
              신고 이유
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={200}
                rows={3}
                autoFocus
              />
            </label>
            <ErrorText error={report.error} />
            <div className={s.actions}>
              <button
                className={s.primary}
                disabled={report.isPending || !reason.trim()}
              >
                {report.isPending ? "접수 중" : "신고 접수"}
              </button>
              <button
                className={s.secondary}
                type="button"
                onClick={() => setReportOpen(false)}
              >
                취소
              </button>
            </div>
          </form>
        )}
        {reported && <p role="status">신고가 접수됐어요.</p>}
      </div>
    </article>
  );
}
