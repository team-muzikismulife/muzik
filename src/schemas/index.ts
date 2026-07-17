import { z } from 'zod';

/**
 * 검증 스키마 — 클라이언트와 Cloud Functions가 **같은 정의를 공유**한다.
 * (docs/frontend.md § Form & Validation)
 * 에러 메시지는 스키마에 담는다. 화면은 만들지 않고 받아서 보여주기만 한다.
 */

/** 닉네임 — 팀별 속성 (백엔드설계.md §1) */
export const NicknameSchema = z
  .string()
  .trim()
  .min(1, '닉네임을 입력해 주세요')
  .max(8, '닉네임은 8자까지예요');

/** 팀 이름 */
export const RoomNameSchema = z
  .string()
  .trim()
  .min(1, '팀 이름을 입력해 주세요')
  .max(20, '팀 이름은 20자까지예요');

/**
 * 초대 코드 — 6자, 혼동문자(I·O·0·1) 제외 32자셋 (백엔드설계.md §3)
 * 대문자로 정규화한 뒤 검증한다.
 */
export const INVITE_CODE_LENGTH = 6;
export const INVITE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // I, O, 0, 1 제외 → 32자

export const InviteCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .length(INVITE_CODE_LENGTH, '초대 코드는 6자예요')
  .regex(new RegExp(`^[${INVITE_CODE_ALPHABET}]+$`), '초대 코드에 쓸 수 없는 문자가 있어요');

/** 코멘트 — 30자 이하 (구현계획서.md §2) */
export const CommentSchema = z.string().trim().max(30, '코멘트는 30자까지예요');

/**
 * 곡명·가수 — 등록 폼에서 **사용자가 편집 가능**하다(oEmbed/iTunes 초기값을 고칠 수 있음).
 * 편집 가능 = 신뢰할 수 없는 입력 → 길이 검증 대상. (docs/곡등록설계.md)
 */
export const TitleSchema = z.string().trim().min(1, '곡 제목을 입력해 주세요').max(80, '제목은 80자까지예요');
export const ArtistSchema = z.string().trim().min(1, '가수를 입력해 주세요').max(80, '가수는 80자까지예요');

/** 유튜브 videoId — 11자 */
export const VideoIdSchema = z
  .string()
  .regex(/^[\w-]{11}$/, '유튜브 링크가 아닌 것 같아요');

/** dateKey — 'YYYY-MM-DD' (KST, 새벽 4시 컷) */
export const DateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식이 올바르지 않아요');

/** Cloud Functions 입력 계약 */
export const CreateRoomInput = z.object({
  name: RoomNameSchema,
  nickname: NicknameSchema,
});

/** 팀 정원 상한 (백엔드설계.md §3). 서버가 강제하고, 클라는 안내 문구에 쓴다 */
export const MAX_MEMBERS = 30;

export const JoinRoomInput = z.object({
  code: InviteCodeSchema,
  nickname: NicknameSchema,
});

export const RegisterTrackInput = z.object({
  roomId: z.string().min(1),
  videoId: VideoIdSchema,
  comment: CommentSchema,
  // 편집 가능한 메타 — 클라가 다듬어 보내고 서버(정본)·rules가 재검증 대상으로 삼는다.
  title: TitleSchema,
  artist: ArtistSchema,
  nickname: NicknameSchema,
});

export type CreateRoomInput = z.infer<typeof CreateRoomInput>;
export type JoinRoomInput = z.infer<typeof JoinRoomInput>;
export type RegisterTrackInput = z.infer<typeof RegisterTrackInput>;

/**
 * 폼 필드 하나를 검증해 에러 문구를 돌려준다. 통과하면 null.
 * 화면에서 `const err = fieldError(NicknameSchema, nickname)` 식으로 쓴다.
 */
export function fieldError(schema: z.ZodType, value: unknown): string | null {
  const result = schema.safeParse(value);
  return result.success ? null : (result.error.issues[0]?.message ?? '입력을 확인해 주세요');
}
