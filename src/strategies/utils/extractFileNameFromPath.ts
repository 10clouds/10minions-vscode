export const extractFileNameFromPath = function (filepath: string) {
  return filepath.substring(filepath.lastIndexOf('/') + 1).split('.')[0];
};
