// Path-segment id guard shared by the `[id]` routes: letters, digits, underscore, hyphen, 1-128 chars.
export const ID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;
export function isValidId(id: unknown): id is string {
  return typeof id === "string" && ID_PATTERN.test(id);
}
