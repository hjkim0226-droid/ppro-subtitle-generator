/**
 * Premiere Pro Subtitle Generator - ExtendScript
 * Handles file import and clip position operations
 */

export { dispatchTS } from "../utils/utils";

// ===== Types =====
interface ClipPosition {
  x: number;
  y: number;
}

// ===== Helper Functions =====

/**
 * Validate project is open
 */
const validateProject = (): { valid: boolean; error?: string } => {
  if (!app.project) {
    return { valid: false, error: "No project open" };
  }
  return { valid: true };
};

/**
 * Get currently selected clip in timeline
 */
const getSelectedClip = (): any | null => {
  const seq = app.project.activeSequence;
  if (!seq) return null;

  // Check video tracks for selected clips
  for (let t = 0; t < seq.videoTracks.numTracks; t++) {
    const track = seq.videoTracks[t];
    for (let c = 0; c < track.clips.numItems; c++) {
      const clip = track.clips[c];
      if (clip.isSelected()) {
        return clip;
      }
    }
  }

  return null;
};

// ===== Export Functions =====

/**
 * Import a file into the project
 */
export const importFile = (filePath: string): boolean => {
  const validation = validateProject();
  if (!validation.valid) {
    return false;
  }

  try {
    // Import file to project root
    const result = app.project.importFiles(
      [filePath],
      true,  // suppressUI
      app.project.getInsertionBin(),
      false  // importAsNumberedStills
    );

    return result !== 0;
  } catch (e) {
    return false;
  }
};

/**
 * Import file and add to active sequence at playhead
 */
export const importAndInsert = (filePath: string): boolean => {
  const validation = validateProject();
  if (!validation.valid) {
    return false;
  }

  try {
    // Import file
    const importResult = app.project.importFiles(
      [filePath],
      true,
      app.project.getInsertionBin(),
      false
    );

    if (!importResult) return false;

    // Find the imported item (should be most recent)
    const rootItem = app.project.rootItem;
    const lastItem = rootItem.children[rootItem.children.numItems - 1];

    if (lastItem && app.project.activeSequence) {
      const seq = app.project.activeSequence;
      const time = seq.getPlayerPosition();

      // Insert to first available video track
      for (let t = 0; t < seq.videoTracks.numTracks; t++) {
        const track = seq.videoTracks[t];
        if (!track.isLocked()) {
          track.insertClip(lastItem, time);
          return true;
        }
      }
    }

    return true;
  } catch (e) {
    return false;
  }
};

/**
 * Get position of currently selected clip
 * Position is in normalized coordinates (0-1)
 */
export const getSelectedClipPosition = (): ClipPosition | null => {
  const validation = validateProject();
  if (!validation.valid) return null;

  const clip = getSelectedClip();
  if (!clip) return null;

  try {
    // Motion component is typically at index 1
    // Position property is at index 0
    const motionComponent = clip.components[1];
    if (!motionComponent) return null;

    const positionProp = motionComponent.properties[0];
    if (!positionProp) return null;

    const value = positionProp.getValue();

    // Value is array [x, y] in normalized coordinates
    if (value && value.length >= 2) {
      return {
        x: value[0],
        y: value[1]
      };
    }

    return null;
  } catch (e) {
    return null;
  }
};

/**
 * Set position of currently selected clip
 * Position should be in normalized coordinates (0-1)
 */
export const setSelectedClipPosition = (x: number, y: number): boolean => {
  const validation = validateProject();
  if (!validation.valid) return false;

  const clip = getSelectedClip();
  if (!clip) return false;

  try {
    // Motion component is typically at index 1
    // Position property is at index 0
    const motionComponent = clip.components[1];
    if (!motionComponent) return false;

    const positionProp = motionComponent.properties[0];
    if (!positionProp) return false;

    // Set position value
    positionProp.setValue([x, y], true);

    return true;
  } catch (e) {
    return false;
  }
};

/**
 * Get all clip position properties (for debugging)
 */
export const getClipMotionInfo = (): any => {
  const validation = validateProject();
  if (!validation.valid) return null;

  const clip = getSelectedClip();
  if (!clip) return { error: "No clip selected" };

  try {
    const info: any = {
      name: clip.name,
      components: []
    };

    for (let c = 0; c < clip.components.numItems; c++) {
      const comp = clip.components[c];
      const compInfo: any = {
        displayName: comp.displayName,
        properties: []
      };

      for (let p = 0; p < comp.properties.numItems; p++) {
        const prop = comp.properties[p];
        compInfo.properties.push({
          displayName: prop.displayName,
          value: prop.getValue ? prop.getValue() : "N/A"
        });
      }

      info.components.push(compInfo);
    }

    return info;
  } catch (e: any) {
    return { error: e.toString() };
  }
};
