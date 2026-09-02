// Mondrian block packing — ported 1:1 from the bitfeed algorithm
// (https://github.com/bitfeed-project/bitfeed by @mononaut) as used by
// bitmap.trade's bitmap renderer. Transactions are placed in their original
// block order (never sorted) into a square of side ceil(sqrt(sum(size^2))).

export type Position = { x: number; y: number };
export type Slot = { position: Position; size: number };

type RawSlot = { x: number; y: number; r: number };
type Row = { y: number; slots: RawSlot[]; map: Record<number, RawSlot>; max: number };

export default class MondrianLayout {
  /** side of the packing square */
  length: number;
  width: number;
  rowOffset = 0;
  rows: Row[] = [];
  /** placed squares, in transaction order */
  slots: Slot[] = [];
  private squares: RawSlot[] = [];

  constructor(txList: number[] = []) {
    let weight = 0;
    for (const size of txList) weight += size * size;
    this.length = Math.max(1, Math.ceil(Math.sqrt(weight)));
    this.width = this.length;

    for (const size of txList) this.place(Math.max(1, size));
  }

  /** rows actually consumed by placed squares */
  get height(): number {
    let max = 0;
    for (const sq of this.squares) max = Math.max(max, sq.y + sq.r);
    return max;
  }

  getSize() {
    return { width: this.width, height: this.height };
  }

  private getRow(y: number): Row | undefined {
    return this.rows[y - this.rowOffset];
  }

  private getSlot(x: number, y: number): RawSlot | undefined {
    return this.getRow(y)?.map[x];
  }

  private addRow(): Row {
    const y = this.rows.length + this.rowOffset;
    const row: Row = { y, slots: [], map: {}, max: 0 };
    this.rows.push(row);
    return row;
  }

  private addSlot(slot: RawSlot): RawSlot | undefined {
    if (slot.r <= 0) return undefined;
    const existing = this.getSlot(slot.x, slot.y);
    if (existing) {
      if (slot.r > existing.r) existing.r = slot.r;
      return existing;
    }
    const row = this.getRow(slot.y);
    if (!row) return undefined;
    let insertAt: number | null = null;
    for (let i = 0; i < row.slots.length; i++) {
      if (row.slots[i]!.x > slot.x) {
        insertAt = i;
        break;
      }
    }
    if (insertAt === null) row.slots.push(slot);
    else row.slots.splice(insertAt, 0, slot);
    row.map[slot.x] = slot;
    return slot;
  }

  private removeSlot(slot: RawSlot) {
    const row = this.getRow(slot.y);
    if (!row) return;
    delete row.map[slot.x];
    const i = row.slots.indexOf(slot);
    if (i >= 0) row.slots.splice(i, 1);
  }

  private fillSlot(slot: RawSlot, sw: number): RawSlot {
    const sq: RawSlot = { x: slot.x, y: slot.y, r: sw };
    this.removeSlot(slot);

    for (let ri = slot.y; ri < slot.y + sw; ri++) {
      const row = this.getRow(ri);
      if (row) {
        const collisions: RawSlot[] = [];
        let maxExcess = 0;
        for (const ts of [...row.slots]) {
          if (!(ts.x + ts.r <= sq.x || ts.x >= sq.x + sw)) {
            collisions.push(ts);
            maxExcess = Math.max(maxExcess, Math.max(0, ts.x + ts.r - (slot.x + slot.r)));
          }
        }
        if (sq.x + sw < this.width && !row.map[sq.x + sw]) {
          this.addSlot({ x: sq.x + sw, y: ri, r: slot.r - sw + maxExcess });
        }
        for (const col of collisions) {
          col.r = slot.x - col.x;
          if (col.r <= 0) this.removeSlot(col);
        }
      } else {
        this.addRow();
        if (slot.x > 0) this.addSlot({ x: 0, y: ri, r: slot.x });
        if (sq.x + sw < this.width) {
          this.addSlot({ x: sq.x + sw, y: ri, r: this.width - (sq.x + sw) });
        }
      }
    }

    for (let ri = Math.max(0, slot.y - sw); ri < slot.y; ri++) {
      const row = this.getRow(ri);
      if (!row) continue;
      for (const ts of [...row.slots]) {
        if (ts.x < sq.x + sw && ts.x + ts.r > sq.x && ts.y + ts.r >= slot.y) {
          const oldW = ts.r;
          ts.r = slot.y - ts.y;
          if (ts.r <= 0) {
            this.removeSlot(ts);
            continue;
          }
          const rem = { x: ts.x + ts.r, y: ts.y, w: oldW - ts.r, h: ts.r };
          while (rem.w > 0 && rem.h > 0) {
            if (rem.w <= rem.h) {
              this.addSlot({ x: rem.x, y: rem.y, r: rem.w });
              rem.y += rem.w;
              rem.h -= rem.w;
            } else {
              this.addSlot({ x: rem.x, y: rem.y, r: rem.h });
              rem.x += rem.h;
              rem.w -= rem.h;
            }
          }
        }
      }
    }

    return sq;
  }

  place(size: number): Slot {
    let square: RawSlot | null = null;

    outer: for (const row of this.rows) {
      for (const slot of [...row.slots]) {
        if (slot.r >= size) {
          square = this.fillSlot(slot, size);
          break outer;
        }
      }
    }

    if (!square) {
      const newRow = this.addRow();
      const slot: RawSlot = { x: 0, y: newRow.y, r: this.width };
      newRow.slots.push(slot);
      newRow.map[0] = slot;
      square = this.fillSlot(slot, size);
    }

    this.squares.push(square);
    const placed: Slot = { position: { x: square.x, y: square.y }, size: square.r };
    this.slots.push(placed);
    return placed;
  }
}
