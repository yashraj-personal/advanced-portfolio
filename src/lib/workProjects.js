import { asset } from "./asset";

const LEGACY_WORK_FOLDER_NAME = "[FOLDER]";
export const WORK_FOLDER_NAME = "WORK";

/**
 * Rename the old [FOLDER] desktop folder to WORK.
 * Also makes the function safe if WORK already exists.
 */
export const migrateWorkFolder = (folders = []) => {
  return folders.map((folder) => {
    if (folder.name === LEGACY_WORK_FOLDER_NAME) {
      return {
        ...folder,
        name: WORK_FOLDER_NAME,
      };
    }

    return folder;
  });
};

/**
 * Load all PDF projects from public/WORK/index.json
 */
export const loadWorkProjects = async () => {
  try {
    const response = await fetch(asset("/WORK/index.json"));

    if (!response.ok) {
      throw new Error("Unable to load WORK project index.");
    }

    const data = await response.json();

    const projects = Array.isArray(data.projects)
      ? data.projects
      : [];

    return projects.filter(
      (project) =>
        project &&
        project.file &&
        project.file.toLowerCase().endsWith(".pdf")
    );
  } catch (error) {
    console.error("WORK projects could not be loaded:", error);
    return [];
  }
};

/**
 * Add the WORK PDFs to the desktop file list.
 */
export const mergeWorkProjects = (
  files = [],
  folders = [],
  projects = []
) => {
  /*
   * Accept both the new WORK name and the old [FOLDER] name.
   * This prevents old localStorage data from breaking the PDFs.
   */
  let workFolder = folders.find(
    (folder) =>
      folder.name === WORK_FOLDER_NAME ||
      folder.name === LEGACY_WORK_FOLDER_NAME
  );

  /*
   * If an old [FOLDER] exists, use it and rename it.
   */
  if (workFolder && workFolder.name === LEGACY_WORK_FOLDER_NAME) {
    workFolder = {
      ...workFolder,
      name: WORK_FOLDER_NAME,
    };
  }

  /*
   * If WORK still doesn't exist, don't crash the website.
   */
  if (!workFolder) {
    console.warn("WORK folder was not found.");
    return files;
  }

  /*
   * IDs of the PDFs that currently exist in index.json
   */
  const projectIds = new Set(
    projects.map(
      (project) => `work-project:${project.file}`
    )
  );

  /*
   * Keep normal desktop files.
   * Remove old WORK PDF entries that are no longer in index.json.
   */
  const retainedFiles = files.filter(
    (file) =>
      file.source !== "work-project" ||
      projectIds.has(file.id)
  );

  const retainedIds = new Set(
    retainedFiles.map((file) => file.id)
  );

  /*
   * Create a desktop file for every PDF in index.json.
   */
  const addedFiles = projects
    .filter(
      (project) =>
        !retainedIds.has(`work-project:${project.file}`)
    )
    .map((project) => ({
      id: `work-project:${project.file}`,
      name: project.name || project.file,
      type: "pdf",
      size: 0,
      date:
        project.date ||
        new Date().toISOString(),
      parentFolderId: workFolder.id,
      source: "work-project",
      url: asset(
        `/WORK/${encodeURIComponent(project.file)}`
      ),
    }));

  return [
    ...retainedFiles,
    ...addedFiles,
  ];
};
