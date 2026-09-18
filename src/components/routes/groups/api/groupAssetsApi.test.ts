import { describe, expect, it } from "vitest";
import {
  AUDIO_TOO_LARGE_MESSAGE,
  INVALID_AUDIO_FORMAT_MESSAGE,
  formatDuration,
  formatFileSize,
  getAssetDeleteConflict,
  isSupportedAudioFile,
  validateAudioFile,
} from "./groupAssetsApi";

const makeFile = (name: string, size = 1024) => {
  const file = new File(["x"], name, { type: "audio/mpeg" });
  Object.defineProperty(file, "size", { value: size });
  return file;
};

describe("getAssetDeleteConflict", () => {
  // The server raises HTTPException(detail={"detail", "usages"}), and FastAPI
  // wraps that under its own `detail` key — so usages are nested two deep.
  it("reads usages out of the nested FastAPI detail envelope", () => {
    const error = {
      response: {
        status: 409,
        data: {
          detail: {
            detail: "Asset is used by 2 recitation item(s)",
            usages: [
              {
                collection_id: "c1",
                collection_name: "TCV Morning Prayers",
                item_id: "i1",
                text_title: "Heart Sutra",
              },
              {
                collection_id: "c2",
                collection_name: "Evening",
                item_id: "i2",
                text_title: null,
              },
            ],
          },
        },
      },
    };

    const conflict = getAssetDeleteConflict(error);

    expect(conflict).not.toBeNull();
    expect(conflict?.message).toBe("Asset is used by 2 recitation item(s)");
    expect(conflict?.usages).toHaveLength(2);
    expect(conflict?.usages[0].collection_name).toBe("TCV Morning Prayers");
    // Titles are best-effort server-side and may be null.
    expect(conflict?.usages[1].text_title).toBeNull();
  });

  it("returns null for statuses other than 409", () => {
    expect(
      getAssetDeleteConflict({
        response: { status: 502, data: { detail: "Storage failed" } },
      }),
    ).toBeNull();
    expect(getAssetDeleteConflict(new Error("network"))).toBeNull();
    expect(getAssetDeleteConflict(null)).toBeNull();
  });

  it("degrades to an empty usage list when the body is a bare string", () => {
    const conflict = getAssetDeleteConflict({
      response: { status: 409, data: { detail: "Conflict" } },
    });

    expect(conflict?.usages).toEqual([]);
    expect(conflict?.message).toBeTruthy();
  });

  it("degrades when usages is missing or not an array", () => {
    const conflict = getAssetDeleteConflict({
      response: {
        status: 409,
        data: { detail: { detail: "In use", usages: "nope" } },
      },
    });

    expect(conflict?.message).toBe("In use");
    expect(conflict?.usages).toEqual([]);
  });
});

describe("validateAudioFile", () => {
  it("accepts every supported extension, case-insensitively", () => {
    for (const name of ["a.mp3", "b.m4a", "c.wav", "d.aac", "e.ogg", "F.MP3"]) {
      expect(isSupportedAudioFile(makeFile(name))).toBe(true);
      expect(validateAudioFile(makeFile(name))).toBeNull();
    }
  });

  it("rejects a non-audio file with the format message", () => {
    expect(validateAudioFile(makeFile("notes.pdf"))).toBe(
      INVALID_AUDIO_FORMAT_MESSAGE,
    );
  });

  it("rejects a file with no extension", () => {
    expect(validateAudioFile(makeFile("recording"))).toBe(
      INVALID_AUDIO_FORMAT_MESSAGE,
    );
  });

  it("rejects a file over 50 MB with the size message", () => {
    const sixtyMb = 60 * 1024 * 1024;
    expect(validateAudioFile(makeFile("long.mp3", sixtyMb))).toBe(
      AUDIO_TOO_LARGE_MESSAGE,
    );
  });

  it("accepts a file exactly at the 50 MB ceiling", () => {
    const fiftyMb = 50 * 1024 * 1024;
    expect(validateAudioFile(makeFile("edge.mp3", fiftyMb))).toBeNull();
  });
});

describe("formatters tolerate the DTO's nullable fields", () => {
  it("formats durations as m:ss", () => {
    expect(formatDuration(184000)).toBe("3:04");
    expect(formatDuration(59000)).toBe("0:59");
  });

  it("falls back to a dash for missing durations", () => {
    expect(formatDuration(null)).toBe("—");
    expect(formatDuration(undefined)).toBe("—");
    expect(formatDuration(0)).toBe("—");
  });

  it("formats sizes and falls back for missing ones", () => {
    expect(formatFileSize(2947188)).toBe("2.8 MB");
    expect(formatFileSize(5120)).toBe("5 KB");
    expect(formatFileSize(null)).toBe("—");
    expect(formatFileSize(undefined)).toBe("—");
  });
});
