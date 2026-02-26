const STORAGE_KEY = 'mtup-proposal-thumbnails-v1';

export type ProposalThumbnailRecord = {
  proposalId: string;
  imageUrl: string;
  updatedAt: string;
  source: 'gemini';
};

type ThumbnailMap = Record<string, ProposalThumbnailRecord>;

function readMap(): ThumbnailMap {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as ThumbnailMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeMap(map: ThumbnailMap): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

function isQuotaExceededError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.name === 'QuotaExceededError' ||
    error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    /quota/i.test(error.message)
  );
}

export const proposalThumbnailStore = {
  get(proposalId: string): ProposalThumbnailRecord | null {
    return readMap()[proposalId] || null;
  },

  getMany(proposalIds: string[]): ThumbnailMap {
    const map = readMap();
    const out: ThumbnailMap = {};
    for (const id of proposalIds) {
      if (map[id]) out[id] = map[id];
    }
    return out;
  },

  set(proposalId: string, imageUrl: string): ProposalThumbnailRecord {
    const map = readMap();
    const record: ProposalThumbnailRecord = {
      proposalId,
      imageUrl,
      updatedAt: new Date().toISOString(),
      source: 'gemini',
    };
    map[proposalId] = record;
    try {
      writeMap(map);
    } catch (error) {
      if (!isQuotaExceededError(error)) throw error;
      // Evict oldest thumbnails until the write succeeds. Base64 images exhaust localStorage quickly.
      const keysByOldest = Object.values(map)
        .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
        .map((entry) => entry.proposalId)
        .filter((id) => id !== proposalId);
      let wrote = false;
      for (const victimId of keysByOldest) {
        delete map[victimId];
        try {
          writeMap(map);
          wrote = true;
          break;
        } catch (retryError) {
          if (!isQuotaExceededError(retryError)) throw retryError;
        }
      }
      if (!wrote) {
        // Keep app functional even if persistence fails: caller still has the image in memory state.
        throw new Error(
          'Browser storage quota reached while saving thumbnails. Thumbnail generated, but it may not persist after refresh.'
        );
      }
    }
    return record;
  },
};
