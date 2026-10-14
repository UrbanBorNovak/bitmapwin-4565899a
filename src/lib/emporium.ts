/** Bitmap Emporium (717328.bitmap): shared constants + residency proof shape. */
export const EMPORIUM_HEIGHT = 717328;
export const EMPORIUM_PARENT = "c1e3330f25adaec23b5361ef1c1412e3fc29d5615f19fe02bf4c017a80c6031bi0";

export type EmporiumResidency = {
  address: string;
  height: number;
  resident: boolean;
  /** Held image children of 717328.bitmap (Resident portraits). */
  portraits: string[];
  /** Held valid parcels of 717328.bitmap. */
  parcels: { index: number; inscriptionId: string }[];
  checkedAt: string;
};
