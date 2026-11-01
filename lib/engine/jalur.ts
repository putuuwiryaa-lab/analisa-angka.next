/** Three exclusive 2D Jalur groups; 00 is mapped like 100. */
export type Jalur = 1 | 2 | 3;

export function jalurFrom2D(value: number): Jalur {
  if (!Number.isInteger(value) || value < 0 || value > 99) {
    throw new RangeError("2D result must be between 00 and 99.");
  }
  const normalized = value === 0 ? 100 : value;
  return (((normalized - 1) % 3) + 1) as Jalur;
}

export function jalurFromSeed(value: number): Jalur {
  if (!Number.isInteger(value)) throw new TypeError("Jalur seed must be an integer.");
  return (((value - 1) % 3 + 3) % 3 + 1) as Jalur;
}

export function buildJalurDeret(start: number): Jalur[] {
  return [jalurFromSeed(start), jalurFromSeed(start + 1), jalurFromSeed(start + 2)];
}

export function twoDigitJalur(draw: string, target: "depan" | "tengah" | "belakang"): Jalur {
  if (!/^\d{4}$/.test(draw)) throw new TypeError("Draw must contain 4 digits.");
  const start = target === "depan" ? 0 : target === "tengah" ? 1 : 2;
  return jalurFrom2D(Number(draw.slice(start, start + 2)));
}
