import {
  world,
  Player,
  system,
  CustomCommandParamType,
  CommandPermissionLevel,
  CustomCommandResult,
  StartupEvent,
  CustomCommand,
  CustomCommandStatus,
  CustomCommandOrigin,
  PlayerPlaceBlockBeforeEvent,
  PlayerBreakBlockBeforeEvent,
  PlayerInteractWithBlockBeforeEvent,
  Vector3,
  BlockPermutation,
  BlockPistonComponent
} from "@minecraft/server";
import { JaylyDB } from "jaylydb/index.js";

interface Data {
  owner: string;
  dimension: string;
  permission: string[];
  x1: number;
  z1: number;
  x2: number;
  z2: number;
}

const identifier = "sma:claim";
type ChunkName = Set<string>;
type chunkKey = string;
type DimensionId = string;

//=====================================================
//******************Cache******************************
//=====================================================

// All indexed data: dimension -> chunkKey -> Set of name
const indexedDatas: Map<DimensionId, Map<chunkKey, ChunkName>> = new Map();
// Claim Cache: name -> Data
const cache: Map<string, Data> = new Map();
// Owner listed
const indexedOwner: Map<string, ChunkName> = new Map();

/**
 * Convert world coordinates to chunk coordinates.
 * The world coordinates are divided by 16 (2^4) to get the chunk coordinates.
 * @param x The x world coordinate.
 * @param z The z world coordinate.
 * @returns An object containing the x and z chunk coordinates.
 */
function chunked(x: number, z: number): { x: number, z: number } {
  return {
    x: x >> 4,
    z: z >> 4
  }
}

/**
 * Returns a set of claim names in the given chunkKey.
 * @param player The player to get the claim names for.
 * @param chunkKey The chunk key to get the claim names for.
 * @returns A set of claim names in the given chunk, or undefined if the chunk does not exist.
 */
function getSetClaimNames(player: Player, chunkKey: string): ChunkName | undefined {
  const indexedClaim: Map<string, ChunkName> = indexedDatas.get(player.dimension.id);
  if (!indexedClaim) return undefined;

  const claimSet: ChunkName = indexedClaim.get(chunkKey);
  if (!claimSet) return undefined;
  return claimSet;
}

/**
 * Format chunk key from x and z
 * @returns string format -> "${x}|${z}"
 */
function formatChunkKey(x: number, z: number): string {
  return `${x}|${z}`;
};

/**
 * Returns an array of Data objects belonging to the given owner.
 * @param {string} owner owner name
 * @returns {Data[]} array of Data objects
 */

/**
 * Indexes data into cache for fast lookup.
 * @param {string} ownerName owner name
 * @param {Data} data data to be indexed
 */
function indexData(ownerName: string, data: Data): void {
  const dimensionMap = indexedDatas.get(data.dimension) || new Map();
  indexedDatas.set(data.dimension, dimensionMap);

  const chunkX1 = data.x1 >> 4;
  const chunkZ1 = data.z1 >> 4;
  const chunkX2 = data.x2 >> 4;
  const chunkZ2 = data.z2 >> 4;

  for (let chunkX = chunkX1; chunkX <= chunkX2; chunkX++) {
    for (let chunkZ = chunkZ1; chunkZ <= chunkZ2; chunkZ++) {
      const chunkKey = formatChunkKey(chunkX, chunkZ);
      const claimSet = dimensionMap.get(chunkKey) || new Set();
      dimensionMap.set(chunkKey, claimSet);
      claimSet.add(ownerName);
    }
  }

  const ownerClaimSet = indexedOwner.get(ownerName) || new Set();
  indexedOwner.set(ownerName, ownerClaimSet);
  ownerClaimSet.add(ownerName);
}

/**
 * Removes an owner from the cache.
 * If the owner is the only one in a chunk, the chunk is removed from the cache.
 * @param {string} name owner name
 * @param {Data} data data to be unindexed
 */
function unindexData(name: string, data: Data) {
  const dimensionMap = indexedDatas.get(data.dimension);
  if (!dimensionMap) return;
  const cx1 = data.x1 >> 4;
  const cz1 = data.z1 >> 4;
  const cx2 = data.x2 >> 4;
  const cz2 = data.z2 >> 4;
  for (let cx = cx1; cx <= cx2; cx++) {
    for (let cz = cz1; cz <= cz2; cz++) {
      const key = formatChunkKey(cx, cz);
      const set = dimensionMap.get(key);
      if (!set) continue;
      set.delete(name);
      if (set.size === 0) {
        dimensionMap.delete(key);
      }
    }
  }
  let ownerSet = indexedOwner.get(name);
  if (!ownerSet) return;
  ownerSet.delete(name);
  if (ownerSet.size === 0) {
    indexedOwner.delete(name);
  }
}

system.run(() => {
  const db = new JaylyDB("claimLand");

  db.forEach((value: string, key: string) => {
    const data: Data = JSON.parse(value);

    // 1. Cache data berdasarkan owner (key)
    cache.set(key, data);

    // 2. Dapatkan atau buat Map untuk dimension tertentu
    if (!indexedDatas.has(data.dimension)) {
      indexedDatas.set(data.dimension, new Map());
    }
    indexData(key, data);
  });
  console.warn("Data loaded successsfully!");
});

//====================================================
//****************Claim Command***********************
//====================================================

system.beforeEvents.startup.subscribe((init: StartupEvent) => {
  init.customCommandRegistry.registerEnum(identifier, ["set", "delete", "list"])
  const claim: CustomCommand = {
    name: identifier,
    description: "claim land to prevent griefing or player go inside restricted area",
    permissionLevel: CommandPermissionLevel.Any,
    mandatoryParameters: [
      {
        name: identifier,
        "type": CustomCommandParamType.Enum
      }
    ],
    optionalParameters: [
      {
        name: "name",
        "type": CustomCommandParamType.String
      },
      {
        name: "x",
        "type": CustomCommandParamType.Integer
      },
      {
        name: "z",
        "type": CustomCommandParamType.Integer
      }
    ]
  }
  init.customCommandRegistry.registerCommand(claim, claimFunc)
})

/***
 * Check if claimed area is overlap
 * @returns true if overlap
 * @param data 
 * @param other
 */
function isOverlap(data: Data, other: Data): boolean {
  if (
    other.dimension === data.dimension &&
    !(
      data.x2 < other.x1 ||
      data.x1 > other.x2 ||
      data.z2 < other.z1 ||
      data.z1 > other.z2
    )
  ) {
    return true;
  }
  return false;
}

function isOverlapFast(name: string, data: Data): boolean {
  const dimensionMap = indexedDatas.get(data.dimension);
  if (!dimensionMap) return false;

  const cx1 = data.x1 >> 4;
  const cz1 = data.z1 >> 4;
  const cx2 = data.x2 >> 4;
  const cz2 = data.z2 >> 4;

  for (let cx = cx1; cx <= cx2; cx++) {
    for (let cz = cz1; cz <= cz2; cz++) {

      const set = dimensionMap.get(`${cx}|${cz}`);
      if (!set) continue;  // Chunk tidak diklaim siapapun

      // Loop melalui semua owner di chunk ini
      for (const otherName of set) {
        if (otherName === name) continue;

        const other = cache.get(otherName);
        if (!other) continue;

        // CEK OVERLAP SECARA SPESIFIK
        // Hanya return true jika area benar-benar tumpang tindih
        if (isOverlap(data, other))
          return true;  // Overlap ditemukan

        // Jika tidak overlap, lanjut cek owner lain
      }
    }
  }
  return false;  // Tidak ada overlap dengan siapapun
}

/***
 * Check if data is valid
 * @returns true if valid
 * @param player 
 * @param name: string
 * @param x1: number
 * @param z1: number
 */
function isValid(player: Player, name: string, x1: number, z1: number): boolean {
  if (!name) {
    player.sendMessage("§cClaim name is required");
    return false;
  }
  if (x1 === undefined || z1 === undefined) {
    player.sendMessage("§cX and Z is required");
    return false;
  }
  if (cache.has(name)) {
    player.sendMessage(`§6Claim "${name}" already exists`);
    return false;
  }
  if (indexedOwner.get(player.name)?.size === 10) {
    player.sendMessage("§cYou have reached the maximum number of claims (10)");
    return false;
  }
  return true;
}

function claimFunc(origin: CustomCommandOrigin, param1: string, name?: string, x1?: number, z1?: number): CustomCommandResult {
  if (!origin.sourceEntity) return;
  if (!(origin.sourceEntity instanceof Player)) return;
  const db = new JaylyDB("claimLand");
  const player = origin.sourceEntity;
  const v3 = {
    x: player.location.x,
    y: player.location.y - 1,
    z: player.location.z
  }
  const location = player.dimension.getBlock(v3).location;
  console.warn(location.x, location.y, location.z);

  system.run(() => {
    if (param1 === "set") {
      if (!isValid(player, name, x1, z1)) return;
      const data = {
        owner: player.name,
        dimension: player.dimension.id,
        permission: [],
        x1: Math.min(x1, Math.round(location.x)),
        z1: Math.min(z1, Math.round(location.z)),
        x2: Math.max(x1, Math.round(location.x)),
        z2: Math.max(z1, Math.round(location.z))
      }

      if (isOverlapFast(name, data)) {
        player.sendMessage(`§cClaim overlap with another claim`);
        return {
          status: CustomCommandStatus.Failure
        };
      };
      player.sendMessage(`§aClaim "${name}" successfully created`);
      cache.set(name, data);
      indexData(name, data);
      db.set(name, JSON.stringify(data));
      return {
        status: CustomCommandStatus.Success
      };
    }

    if (param1 === "delete") {
      if (!name) {
        player.sendMessage("§cClaim name is required");
        return {
          status: CustomCommandStatus.Failure
        };
      }
      if (!cache.has(name)) {
        player.sendMessage(`§cClaim "${name}" does not exist`);
        return {
          status: CustomCommandStatus.Failure
        };
      }
      unindexData(name, cache.get(name));
      cache.delete(name);
      db.delete(name);
      player.sendMessage(`§aClaim "${name}" successfully deleted`);
      return {
        status: CustomCommandStatus.Success
      };
    }
  })

  if (param1 == "list") {
    const getAllClaim = indexedOwner.get(player.name);

    if (!getAllClaim) {
      player.sendMessage("You have no claims");
      return;
    }

    player.sendMessage(`Claim: ${getAllClaim.size}`);
    for (let i of getAllClaim) {
      player.sendMessage(`- ${i}`);
    }
  }
  return {
    status: CustomCommandStatus.Success
  }
}

//====================================================
//*******************Clear Data***********************
//====================================================
function cancelEvent(
  event: PlayerPlaceBlockBeforeEvent |
    PlayerInteractWithBlockBeforeEvent |
    PlayerBreakBlockBeforeEvent
) {
  const { block, player } = event;
  const location = block.location;

  const chunk = chunked(location.x, location.z);
  const chunkKey = formatChunkKey(chunk.x, chunk.z);

  let claimSet = getSetClaimNames(player, chunkKey);
  claimSet = claimSet || new Set();

  for (const name of claimSet) {
    const claim = cache.get(name);

    if (!claim) continue;

    if (claim.owner === player.name) continue;

    if (claim.permission.includes(player.name)) continue;

    if (
      claim.x1 <= location.x &&
      claim.x2 >= location.x &&
      claim.z1 <= location.z &&
      claim.z2 >= location.z
    ) {
      player.sendMessage("§cYou are not allowed to break this claim");
      event.cancel = true;
      return; // stop setelah ketemu
    }
  }
}

world.beforeEvents.playerPlaceBlock.subscribe(cancelEvent);
world.beforeEvents.playerInteractWithBlock.subscribe(cancelEvent);
world.beforeEvents.playerBreakBlock.subscribe(cancelEvent);

world.beforeEvents.explosion.subscribe((event) => {
  const dimensionId = event.dimension.id;
  const indexedClaim = indexedDatas.get(dimensionId);
  if (!indexedClaim) return;

  for (const block of event.getImpactedBlocks()) {
    const location = block.location;

    const chunk = chunked(location.x, location.z);
    const chunkKey = formatChunkKey(chunk.x, chunk.z);

    const claimSet = indexedClaim.get(chunkKey);
    if (!claimSet) continue;

    for (const name of claimSet) {
      const claim = cache.get(name);
      if (!claim) continue;

      if (
        claim.x1 <= location.x &&
        claim.x2 >= location.x &&
        claim.z1 <= location.z &&
        claim.z2 >= location.z
      ) {
        event.cancel = true;
        return; // langsung hentikan explosion
      }
    }
  }
});

function offsetCal(perm: BlockPermutation, block: Vector3): Vector3 {
  const dir = perm.getState("facing_direction");

  switch (dir) {
    case 0: // down
      return { x: block.x, y: block.y - 1, z: block.z };
    case 1: // up
      return { x: block.x, y: block.y + 1, z: block.z };
    case 2: // north
      return { x: block.x, y: block.y, z: block.z + 1 };
    case 3: // south
      return { x: block.x, y: block.y, z: block.z - 1 };
    case 4: // west
      return { x: block.x - 1, y: block.y, z: block.z };
    case 5: // east
      return { x: block.x + 1, y: block.y, z: block.z };
  }

  return block;
}

function claimSet(dimension: DimensionId, chunkKey: string) {
  const claimSet = indexedDatas.get(dimension);
  if (!claimSet) return;
  return claimSet.get(chunkKey);
}

function isInside(pos: Vector3, claim: any): boolean {
  return (
    pos.x >= claim.x1 &&
    pos.x <= claim.x2 &&
    pos.z >= claim.z1 &&
    pos.z <= claim.z2
  );
}

function getVector(dir: number) {
    switch (dir) {
        case 0: return { x: 0, y: -1, z: 0 };
        case 1: return { x: 0, y: 1, z: 0 };
        case 2: return { x: 0, y: 0, z: 1 };
        case 3: return { x: 0, y: 0, z: -1 };
        case 4: return { x: -1, y: 0, z: 0 };
        case 5: return { x: 1, y: 0, z: 0 };
    }
}

function reversedPistonImpacted(piston: BlockPistonComponent, dimensionId:DimensionId, positions:Vector3[]) {
    const dimension = world.getDimension(dimensionId);
    const dir = piston.block.permutation.getState("facing_direction");
    const vec = getVector(dir);

    const lastOld = positions[positions.length - 1];

    const lastNew = {
        x: lastOld.x + vec.x,
        y: lastOld.y + vec.y,
        z: lastOld.z + vec.z,
    };

    for (let i = positions.length - 1; i >= 0; i--) {

        const oldPos = positions[i];
        const newPos = {
            x: oldPos.x + vec.x,
            y: oldPos.y + vec.y,
            z: oldPos.z + vec.z,
        };

        const blockNew = dimension.getBlock(newPos);
        const blockOld = dimension.getBlock(oldPos);

        if (!blockNew || !blockOld) continue;

        blockOld.setType(blockNew.typeId);
        blockOld.setPermutation(blockNew.permutation);
    }

    const endBlock = dimension.getBlock(lastNew);
    if (endBlock) endBlock.setType("minecraft:air");

    piston.block.setType("minecraft:air");
}

world.afterEvents.pistonActivate.subscribe((event) => {
  const { isExpanding, piston, dimension } = event;
  if (!isExpanding) return;

  const attachedBlocks = piston.getAttachedBlocksLocations();

  for (const oldPos of attachedBlocks) {

    const newPos = offsetCal(piston.block.permutation, oldPos);

    const chunk = chunked(oldPos.x, oldPos.z);
    const chunkKey = formatChunkKey(chunk.x, chunk.z);

    const claimNames = claimSet(dimension.id, chunkKey);
    if (!claimNames) continue;

    for (const name of claimNames) {
      const claim = cache.get(name);
      if (!claim) continue;

      const wasInside = isInside(oldPos, claim);
      const willBeInside = isInside(newPos, claim);

      // 🚨 CROSS BORDER DETECTED
      if (wasInside !== willBeInside) {
        piston.block.setType("minecraft:air");
        return;
      }
    }
  }
});