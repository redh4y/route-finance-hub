export type PayerGroup = {
  id: string;
  name: string;
  color: string;
  description: string | null;
  route: string | null;
  monthly_amount_cents: number | null;
  active: boolean;
  created_at: string;
  member_count?: number;
};

export type GroupMember = {
  id: string;
  group_id: string;
  payer_id: string | null;
  wa_display_name: string | null;
  active: boolean;
  created_at: string;
  match_status: "ok" | "unmatched" | "review_ignored";
  best_candidate_name: string | null;
  best_candidate_score: number | null;
  payer?: { id: string; name: string; document_digits: string | null } | null;
};

export type PayerLite = {
  id: string;
  name: string;
  document_digits: string | null;
  status: string | null;
};

export type MatchResult = {
  waName: string;
  topCandidates: { payer: PayerLite; score: number }[];
  selected: PayerLite | null;
  status: "match" | "review" | "none";
};

export type JsonGroupData = {
  grupo: string;
  membros: string[];
};

export type RouteConfig = {
  route: string;
  monthly_amount_cents: number | null;
  updated_at: string;
};

export type ImportLogEntry = {
  id: string;
  group_id: string;
  batch_id: string;
  imported_at: string;
  wa_display_name: string;
  status: "unmatched" | "review_ignored";
  best_candidate_name: string | null;
  best_candidate_score: number | null;
};

export type ImportQueueItem = {
  id: string;
  fileName: string;
  parsed: JsonGroupData;
  parseError: string | null;
  routeConfig: string;
  matchResults: MatchResult[];
  analyzed: boolean;
  isAnalyzing: boolean;
  existingMembers: GroupMember[];
  saving: boolean;
  saved: boolean;
};
