export type TopicStatus = "pending" | "selected" | "done";
export type RoomMode = "online" | "offline";
export type MeetingStatus = "voting" | "confirmed";

export interface Profile {
  id: string;
  nickname: string | null;
  avatar_url: string | null;
}

export interface Topic {
  id: number;
  author: string;
  content: string;
  source_date: string | null;
  status: TopicStatus;
  created_at: string;
}

export interface Meeting {
  id: number;
  title: string;
  description: string | null;
  mode: RoomMode;
  vote_deadline: string;
  status: MeetingStatus;
  confirmed_date: string | null;
  room_id: number | null;
  created_at: string;
}

export interface MeetingDate {
  id: number;
  meeting_id: number;
  d: string;
}

export interface Room {
  id: number;
  title: string;
  date: string;
  mode: RoomMode;
  meeting_id: number | null;
  created_at: string;
}

export interface RoomMessage {
  id: number;
  room_id: number;
  user_id: string | null;
  name: string;
  content: string;
  created_at: string;
}

export interface RoomTopic {
  id: number;
  room_id: number;
  topic_id: number | null;
  content: string;
  author: string;
  position: number;
  done: boolean;
}

export interface Stroke {
  id: number;
  room_id: number;
  payload: StrokePayload;
  created_at: string;
}

// 화이트보드 한 획: 점 배열 + 색/굵기 (eraser 는 color="eraser")
export interface StrokePayload {
  points: { x: number; y: number }[];
  color: string;
  size: number;
  erase?: boolean;
}

export const MAX_TOPICS_PER_ROOM = 20;
