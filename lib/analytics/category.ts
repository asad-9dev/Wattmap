/**
 * Operation categories used for peer grouping. The source's operation-type labels changed
 * between layouts ("School", "École", "K-12 School"), so they are collapsed into categories.
 */

export type OperationCategory = "school" | "administrative" | "other";

export function foldText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const SCHOOL_LABELS = new Set(["school", "schools", "ecole", "k-12 school"]);
const ADMIN_MARKERS = ["admin", "office", "bureau"];

export function operationCategory(operationType: string | null | undefined): OperationCategory {
  const label = foldText(operationType);
  if (SCHOOL_LABELS.has(label)) return "school";
  if (ADMIN_MARKERS.some((marker) => label.includes(marker))) return "administrative";
  // Adult education, daycare, multi-use and similar buildings are too varied to benchmark as schools.
  return "other";
}

export const OPERATION_CATEGORY_LABELS: Record<OperationCategory, string> = {
  school: "School building",
  administrative: "Administrative building",
  other: "Other facility",
};
