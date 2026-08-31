// Adapted from https://github.com/bitfeed-project/bitfeed/blob/master/client/src/models/TxMondrianPoolScene.js by @mononaut

export type Position = { x: number; y: number };
export type Slot = { position: Position; size: number };
type Row = { y: number; slots: Slot[]; map: Map<number, Slot>; max: number };

export default class MondrianLayout {
  width = 0;
  height = 0;
  rowOffset = 0;
  rows: Row[] = [];
  slots: Slot[] = [];
  length: number;

  constructor(txList: number[] = []) {
    let blockWeight = 0;
    for (const size of txList) {
      blockWeight += size * size;
    }

    this.length = Math.ceil(Math.sqrt(blockWeight));

    for (const size of txList) {
      this.place(size);
    }
  }

  getSize() {
    return { width: this.width, height: this.height };
  }

  getRow(position: Position): Row | null {
    if (position.y - this.rowOffset < this.rows.length) {
      return this.rows[position.y - this.rowOffset] ?? null;
    }
    return null;
  }

  getSlot(position: Position): Slot | null {
    const row = this.getRow(position);
    if (row !== null && row.map.has(position.x)) {
      return row.map.get(position.x)!;
    }
    return null;
  }

  addRow(): Row {
    const newRow: Row = {
      y: this.rows.length + this.rowOffset,
      slots: [],
      map: new Map(),
      max: 0,
    };
    this.rows.push(newRow);
    return newRow;
  }

  addSlot(slot: Slot): Slot | null {
    if (slot.size <= 0) return null;

    const existingSlot = this.getSlot(slot.position);
    if (existingSlot !== null) {
      existingSlot.size = Math.max(existingSlot.size, slot.size);
      return existingSlot;
    }

    const row = this.getRow(slot.position);
    if (row === null) return null;

    const insertAt = row.slots.findIndex((s) => s.position.x > slot.position.x);
    if (insertAt === -1) {
      row.slots.push(slot);
    } else {
      row.slots.splice(insertAt, 0, slot);
    }

    row.map.set(slot.position.x, slot);
    return slot;
  }

  removeSlot(slot: Slot) {
    const row = this.getRow(slot.position);
    if (row !== null) {
      row.map.delete(slot.position.x);
      const index = row.slots.findIndex((s) => s.position.x === slot.position.x);
      if (index !== -1) row.slots.splice(index, 1);
    }
  }

  fillSlot(slot: Slot, squareWidth: number): Slot {
    const square = {
      left: slot.position.x,
      right: slot.position.x + squareWidth,
      bottom: slot.position.y,
      top: slot.position.y + squareWidth,
    };

    this.removeSlot(slot);

    for (let rowIndex = slot.position.y; rowIndex < square.top; rowIndex++) {
      const row = this.getRow({ x: slot.position.x, y: rowIndex });
      if (row !== null) {
        const collisions: Slot[] = [];
        let maxExcess = 0;
        for (const testSlot of row.slots) {
          if (
            !(
              testSlot.position.x + testSlot.size < square.left ||
              testSlot.position.x >= square.right
            )
          ) {
            collisions.push(testSlot);
            const excess = Math.max(
              0,
              testSlot.position.x + testSlot.size - (slot.position.x + slot.size),
            );
            maxExcess = Math.max(maxExcess, excess);
          }
        }

        if (square.right < this.length && !row.map.has(square.right)) {
          this.addSlot({
            position: { x: square.right, y: rowIndex },
            size: slot.size - squareWidth + maxExcess,
          });
        }

        for (let i = 0; i < collisions.length; i++) {
          collisions[i]!.size = slot.position.x - collisions[i]!.position.x;
          if (collisions[i]!.size === 0) this.removeSlot(collisions[i]!);
        }
      } else {
        this.addRow();
        if (slot.position.x > 0) {
          this.addSlot({ position: { x: 0, y: rowIndex }, size: slot.position.x });
        }
        if (square.right < this.length) {
          this.addSlot({
            position: { x: square.right, y: rowIndex },
            size: this.length - square.right,
          });
        }
      }
    }

    for (
      let rowIndex = Math.max(0, slot.position.y - squareWidth);
      rowIndex < slot.position.y;
      rowIndex++
    ) {
      const row = this.getRow({ x: slot.position.x, y: rowIndex });
      if (row === null || row === undefined) continue;

      for (let i = 0; i < row.slots.length; i++) {
        const testSlot = row.slots[i]!;

        if (
          testSlot.position.x < slot.position.x + squareWidth &&
          testSlot.position.x + testSlot.size > slot.position.x &&
          testSlot.position.y + testSlot.size >= slot.position.y
        ) {
          const oldSlotWidth = testSlot.size;
          testSlot.size = slot.position.y - testSlot.position.y;

          const remaining = {
            x: testSlot.position.x + testSlot.size,
            y: testSlot.position.y,
            width: oldSlotWidth - testSlot.size,
            height: testSlot.size,
          };

          while (remaining.width > 0 && remaining.height > 0) {
            if (remaining.width <= remaining.height) {
              this.addSlot({
                position: { x: remaining.x, y: remaining.y },
                size: remaining.width,
              });
              remaining.y += remaining.width;
              remaining.height -= remaining.width;
            } else {
              this.addSlot({
                position: { x: remaining.x, y: remaining.y },
                size: remaining.height,
              });
              remaining.x += remaining.height;
              remaining.width -= remaining.height;
            }
          }
        }
      }
    }

    return { position: slot.position, size: squareWidth };
  }

  place(size: number): Slot {
    let found = false;
    let squareSlot: Slot | null = null;

    for (const row of this.rows) {
      for (const slot of row.slots) {
        if (slot.size >= size) {
          found = true;
          squareSlot = this.fillSlot(slot, size);
          break;
        }
      }
      if (found) break;
    }

    if (!found) {
      const row = this.addRow();
      const slot = this.addSlot({ position: { x: 0, y: row.y }, size: this.length })!;
      squareSlot = this.fillSlot(slot, size);
    }

    const placed = squareSlot!;

    if (placed.position.x + placed.size > this.width) {
      this.width = placed.position.x + placed.size;
    }
    if (placed.position.y + placed.size > this.height) {
      this.height = placed.position.y + placed.size;
    }

    this.slots.push(placed);
    return placed;
  }

  /** set bestSize false to fill with only 1x1 squares */
  fillEmptySpaces(bestSize = true): Slot[] {
    const filledSlots: Slot[] = [];
    const occupied: boolean[][] = Array.from({ length: this.height }, () =>
      Array(this.width).fill(false),
    );

    for (const square of this.slots) {
      for (let i = 0; i < square.size; i++) {
        for (let j = 0; j < square.size; j++) {
          occupied[square.position.y + i]![square.position.x + j] = true;
        }
      }
    }

    if (bestSize) {
      const canPlaceSquare = (x: number, y: number, size: number) => {
        if (x + size > this.width || y + size > this.height) return false;
        for (let i = 0; i < size; i++) {
          for (let j = 0; j < size; j++) {
            if (occupied[y + i]![x + j]) return false;
          }
        }
        return true;
      };

      for (let size = Math.min(this.width, this.height); size > 1; size--) {
        for (let y = 0; y <= this.height - size; y++) {
          for (let x = 0; x <= this.width - size; x++) {
            if (canPlaceSquare(x, y, size)) {
              filledSlots.push({ position: { x, y }, size });
              for (let i = 0; i < size; i++) {
                for (let j = 0; j < size; j++) {
                  occupied[y + i]![x + j] = true;
                }
              }
            }
          }
        }
      }
    }

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (!occupied[y]![x]) {
          filledSlots.push({ position: { x, y }, size: 1 });
          occupied[y]![x] = true;
        }
      }
    }

    return filledSlots;
  }
}
