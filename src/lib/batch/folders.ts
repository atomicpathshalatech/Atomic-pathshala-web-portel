import "server-only";

/** The folder every batch starts with; staff can nest anything under it. */
export const ROOT_FOLDER_NAME = "Syllabus & Schedule";

/**
 * How deep folders may nest. Postgres does not care, but a tree deeper than
 * this stops being navigable on a phone, which is where students open it.
 */
export const MAX_FOLDER_DEPTH = 5;

export type FolderFileRow = {
  id: string;
  title: string;
  fileName: string;
  sizeBytes: number;
  mimeType: string;
  isPublished: boolean;
  createdAt: Date;
};

export type FolderRow = {
  id: string;
  parentId: string | null;
  name: string;
  order: number;
  isPublished: boolean;
  files: FolderFileRow[];
};

export type FolderNode = {
  id: string;
  name: string;
  isPublished: boolean;
  files: Array<{
    id: string;
    title: string;
    fileName: string;
    sizeBytes: number;
    mimeType: string;
    isPublished: boolean;
    createdAt: string;
  }>;
  children: FolderNode[];
};

/**
 * Turns the flat folder rows into a tree in one pass.
 *
 * `publishedOnly` prunes whole branches rather than individual rows: an
 * unpublished folder takes its children with it, so staff can stage a whole
 * section by unpublishing one folder instead of every file inside it.
 */
export function buildFolderTree(rows: FolderRow[], publishedOnly = false): FolderNode[] {
  const visible = publishedOnly ? rows.filter((r) => r.isPublished) : rows;

  const nodes = new Map<string, FolderNode>();
  for (const row of visible) {
    nodes.set(row.id, {
      id: row.id,
      name: row.name,
      isPublished: row.isPublished,
      files: (publishedOnly ? row.files.filter((f) => f.isPublished) : row.files).map((f) => ({
        id: f.id,
        title: f.title,
        fileName: f.fileName,
        sizeBytes: f.sizeBytes,
        mimeType: f.mimeType,
        isPublished: f.isPublished,
        createdAt: f.createdAt.toISOString(),
      })),
      children: [],
    });
  }

  const roots: FolderNode[] = [];
  for (const row of visible) {
    const node = nodes.get(row.id);
    if (!node) continue;
    // A child whose parent was pruned (unpublished) is dropped rather than
    // promoted to a root — otherwise hiding a section would leak its
    // subfolders to students at the top level.
    if (row.parentId) {
      const parent = nodes.get(row.parentId);
      if (parent) parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

/** Human-readable size for the UI. */
export function formatFileSize(bytes: number): string {
  if (bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
