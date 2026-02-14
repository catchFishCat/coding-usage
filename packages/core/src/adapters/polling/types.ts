export type PollMode = "official" | "experimental";

export interface PollResult {
  provider: string;
  mode: PollMode;
  ok: boolean;
  message: string;
}

export type ProviderPoller = (db: unknown) => Promise<PollResult>;
export type ProviderProbe = () => Promise<PollResult>;
