import fs from 'fs';
import path from 'path';

type Rect = { x1: number; z1: number; x2: number; z2: number };
type Room = { x: number; z: number; w: number; d: number };
type Opening = { at: number; len: number; kind: string };
type Wall = { x1: number; z1: number; x2: number; z2: number; openings?: Opening[] };
type Plan = { rooms: Room[]; walls: Wall[] };

type Placement = {
  boxOf: (cx: number, cz: number, w: number, d: number) => Rect;
  rectsOverlap: (a: Rect, b: Rect) => boolean;
  smallestRoomAt: (rooms: Room[], x: number, z: number) => Room | null;
  doorSwingZone: (op: Opening, horiz: boolean, fixed: number, px: number, pz: number) => Rect;
  clampNumber: (value: number, lo: number, hi: number) => number;
  settleSanitaryPlacement: (
    plan: Plan,
    centerX: number,
    centerZ: number,
    extentW: number,
    extentD: number,
  ) => { x: number; z: number };
};

const ASSET = path.join(__dirname, '../../../public/assets/vendor/satchida/cad-studio.js');

/** Loads the real helper block from the shipped vendor asset, not a copy. */
function loadPlacementHelpers(): Placement {
  const source = fs.readFileSync(ASSET, 'utf8');
  const start = source.indexOf('// ---- Plan geometry helpers');
  const end = source.indexOf('function createFurniture3D');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('cad-studio placement helpers could not be located');
  }
  const body = `${source.slice(start, end)}
return { boxOf, rectsOverlap, smallestRoomAt, doorSwingZone, clampNumber, settleSanitaryPlacement };`;

  return new Function(body)() as Placement;
}

const helpers = loadPlacementHelpers();

// Mirrors the default 3BHK template: the common bath sits above the hallway and is
// entered from a door on its west wall.
const COMMON_BATH: Plan = {
  rooms: [
    { x: 22, z: 13, w: 12, d: 6 },
    { x: 34, z: 13, w: 6, d: 6 },
    { x: 22, z: 19, w: 9, d: 16 },
    { x: 31, z: 19, w: 9, d: 16 },
  ],
  walls: [
    { x1: 34, z1: 13, x2: 34, z2: 19, openings: [{ at: 14, len: 2.6, kind: 'door' }] },
    { x1: 34, z1: 19, x2: 40, z2: 19, openings: [] },
  ],
};

describe('cad-studio sanitary placement', () => {
  test('doorSwingZone covers the opening and 3 ft into the room', () => {
    const zone = helpers.doorSwingZone({ at: 14, len: 2.6, kind: 'door' }, false, 34, 35.4, 18);

    expect(zone.x1).toBeCloseTo(34);
    expect(zone.x2).toBeCloseTo(37.2);
    expect(zone.z1).toBeCloseTo(14);
    expect(zone.z2).toBeCloseTo(16.6);
  });

  test('leaves the common bath vanity in place (regression: it used to be pushed into bedroom 3)', () => {
    const centerX = 34.2 + 2.4 / 2;
    const centerZ = 17.2 + 1.6 / 2;

    const settled = helpers.settleSanitaryPlacement(COMMON_BATH, centerX, centerZ, 2.4, 1.6);

    expect(settled.x).toBeCloseTo(centerX);
    expect(settled.z).toBeCloseTo(centerZ);
  });

  test('leaves the common bath shower and wc in place', () => {
    const shower = helpers.settleSanitaryPlacement(COMMON_BATH, 37 + 1.5, 15.9 + 1.5, 3, 3);
    const wc = helpers.settleSanitaryPlacement(COMMON_BATH, 37.8 + 0.8, 13.4 + 1.175, 1.175, 0.8);

    expect(shower.x).toBeCloseTo(38.5);
    expect(shower.z).toBeCloseTo(17.4);
    expect(wc.x).toBeCloseTo(38.6);
    expect(wc.z).toBeCloseTo(14.575);
  });

  test('pushes a fixture out of the swing envelope while keeping it inside the room', () => {
    const centerX = 35.5;
    const centerZ = 15.0;

    const settled = helpers.settleSanitaryPlacement(COMMON_BATH, centerX, centerZ, 2.4, 1.6);
    const box = helpers.boxOf(settled.x, settled.z, 2.4, 1.6);
    const room = COMMON_BATH.rooms[1];
    const zone = helpers.doorSwingZone(
      { at: 14, len: 2.6, kind: 'door' },
      false,
      34,
      centerX,
      centerZ,
    );

    expect(helpers.rectsOverlap(box, zone)).toBe(false);
    expect(box.x1).toBeGreaterThanOrEqual(room.x);
    expect(box.x2).toBeLessThanOrEqual(room.x + room.w);
    expect(box.z1).toBeGreaterThanOrEqual(room.z);
    expect(box.z2).toBeLessThanOrEqual(room.z + room.d);
  });

  test('never moves a fixture through a wall when the room cannot give back clearance', () => {
    const tiny: Plan = {
      rooms: [{ x: 33, z: 13, w: 1.4, d: 4 }],
      walls: [{ x1: 33, z1: 13, x2: 33, z2: 17, openings: [{ at: 14, len: 2.4, kind: 'door' }] }],
    };

    const settled = helpers.settleSanitaryPlacement(tiny, 33.7, 15, 1.2, 0.9);
    const box = helpers.boxOf(settled.x, settled.z, 1.2, 0.9);

    expect(box.x1).toBeGreaterThanOrEqual(33);
    expect(box.x2).toBeLessThanOrEqual(34.4);
  });

  test('smallestRoomAt prefers the nested en-suite over the master suite', () => {
    const rooms = [
      { x: 22, z: 0, w: 18, d: 13 },
      { x: 33, z: 0, w: 7, d: 7 },
    ];

    expect(helpers.smallestRoomAt(rooms, 36, 3)).toEqual({ x: 33, z: 0, w: 7, d: 7 });
    expect(helpers.smallestRoomAt(rooms, 26, 3)).toEqual({ x: 22, z: 0, w: 18, d: 13 });
    expect(helpers.smallestRoomAt(rooms, 0, 0)).toBeNull();
  });

  test('clampNumber leaves a value alone when the range is inverted', () => {
    expect(helpers.clampNumber(5, 10, 1)).toBe(5);
    expect(helpers.clampNumber(5, 1, 10)).toBe(5);
    expect(helpers.clampNumber(-5, 1, 10)).toBe(1);
  });
});
