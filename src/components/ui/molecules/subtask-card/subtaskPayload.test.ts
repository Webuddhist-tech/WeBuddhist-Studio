import { describe, expect, it } from "vitest";
import {
  buildSubTaskPayload,
  buildSubTaskUpdatePayload,
} from "./subtaskPayload";
import type { SubTask } from "./SubTaskCard";

const linked = (overrides: Partial<SubTask> = {}) =>
  ({
    id: null,
    content_type: "EVENT",
    content: "",
    reference_id: "event-1",
    reference: { id: "event-1", content_type: "EVENT", title: "Losar" },
    ...overrides,
  }) as SubTask;

describe("buildSubTaskPayload (create)", () => {
  it("sends reference_id for a linked subtask", () => {
    expect(buildSubTaskPayload(linked(), 0)).toEqual({
      content: "",
      content_type: "EVENT",
      display_order: 1,
      reference_id: "event-1",
    });
  });

  it("covers every linked content type", () => {
    for (const type of [
      "GROUP_ACCUMULATION",
      "GROUP_COLLECTION",
      "EVENT",
      "POST",
    ] as const) {
      const payload = buildSubTaskPayload(
        linked({
          content_type: type,
          reference_id: "ref-1",
        } as Partial<SubTask>),
        0,
      );
      expect(payload).toMatchObject({
        content_type: type,
        reference_id: "ref-1",
      });
    }
  });

  it("omits reference_id for inline content types", () => {
    const text = buildSubTaskPayload(
      { id: null, content_type: "TEXT", content: "Hello" } as SubTask,
      2,
    );
    expect(text).not.toHaveProperty("reference_id");
    expect(text).toMatchObject({ content_type: "TEXT", display_order: 3 });
  });

  it("keeps source reference fields for pecha subtasks", () => {
    const payload = buildSubTaskPayload(
      {
        id: null,
        content_type: "SOURCE_REFERENCE",
        content: "verse",
        source_text_id: "t1",
        pecha_segment_id: "s1",
        segment_ids: ["s1"],
        segment_numbers: [1],
      } as SubTask,
      0,
    );
    expect(payload).toMatchObject({
      source_text_id: "t1",
      pecha_segment_id: "s1",
      segment_ids: ["s1"],
      segment_numbers: [1],
    });
    expect(payload).not.toHaveProperty("reference_id");
  });

  it("normalises a missing reference to null rather than dropping it", () => {
    const payload = buildSubTaskPayload(
      linked({ reference_id: undefined } as Partial<SubTask>),
      0,
    );
    expect(payload.reference_id).toBeNull();
  });

  it("carries video duration through", () => {
    expect(
      buildSubTaskPayload(
        {
          id: null,
          content_type: "VIDEO",
          content: "https://y",
          duration: "3:20",
        } as SubTask,
        0,
      ),
    ).toMatchObject({ duration: "3:20" });
  });
});

describe("buildSubTaskUpdatePayload", () => {
  it("sends id alongside reference_id for an existing linked subtask", () => {
    expect(
      buildSubTaskUpdatePayload(linked({ id: "sub-1" } as Partial<SubTask>), 0),
    ).toMatchObject({
      id: "sub-1",
      content_type: "EVENT",
      reference_id: "event-1",
    });
  });

  it("sends a null id for a subtask added during the edit", () => {
    expect(buildSubTaskUpdatePayload(linked(), 0).id).toBeNull();
  });

  it("matches the create payload on every shared field", () => {
    const subTask = linked({ id: "sub-1" } as Partial<SubTask>);
    const { id, ...update } = buildSubTaskUpdatePayload(subTask, 0);

    expect(id).toBe("sub-1");
    expect(update).toEqual(buildSubTaskPayload(subTask, 0));
  });
});
