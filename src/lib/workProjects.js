import { asset } from "./asset";

const LEGACY_WORK_FOLDER_NAME = "[FOLDER]";
export const WORK_FOLDER_NAME = "WORK";

export const migrateWorkFolder = (folders) =>
  folders.map((folder) =>
    folder.name === LEGACY_WORK_FOLDER_NAME
      ? { ...folder, name: WORK_FOLDER_NAME }
      : folder,
  );

export const loadWorkProjects = async () => {
  const response = await fetch(asset("/WORK/index.json"));
  if (!response.ok) throw new Error("Unable to load the WORK project index.");

  const { projects = [] } = await response.json();
  return projects.filter((project) => project?.file && project.file.toLowerCase().endsWith(".pdf"));
};

export const mergeWorkProjects = (files, folders, projects) => {
  const workFolder = folders.find((folder) => folder.name === WORK_FOLDER_NAME);
  if (!workFolder) return files;

  const projectIds = new Set(projects.map((project) => `work-project:${project.file}`));
  const retainedFiles = files.filter(
    (file) => file.source !== "work-project" || projectIds.has(file.id),
  );
  const retainedIds = new Set(retainedFiles.map((file) => file.id));
  const addedFiles = projects
    .filter((project) => !retainedIds.has(`work-project:${project.file}`))
    .map((project) => ({
      id: `work-project:${project.file}`,
      name: project.name || project.file,
      type: "pdf",
      size: 0,
      date: project.date || new Date().toISOString(),
      parentFolderId: workFolder.id,
      source: "work-project",
      url: asset(`/WORK/${encodeURIComponent(project.file)}`),
    }));

  return [...retainedFiles, ...addedFiles];
};
