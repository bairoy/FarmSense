export interface CheckinOption {
  value: string;
  label: string;
  label_hi: string;
}

export interface CheckinQuestion {
  key: string;
  question: string;
  question_hi: string;
  options: CheckinOption[];
  corrects: string;
  priority: number;
}

export interface Checkin {
  id: string;
  crop_instance_id: string;
  question_key: string;
  question_text: string;
  asked_at: string;
  responded_at: string | null;
  answer: string | null;
  question?: CheckinQuestion;
}

export interface DueCheckinResponse {
  due: boolean;
  checkin: Checkin | null;
}

export interface AnswerCheckinResponse extends Checkin {
  correction: { note?: string; [key: string]: unknown };
}
