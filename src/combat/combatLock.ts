import {
  EntityDamageCause,
  EntityDamageSource,
  Player,
  world,
} from "@minecraft/server";

const ENVIRONMENT_DAMAGE = new Set([
  EntityDamageCause.drowning,
  EntityDamageCause.fall,
  EntityDamageCause.suffocation,
  EntityDamageCause.fire,
  EntityDamageCause.lava,
  EntityDamageCause.lightning,
  EntityDamageCause.void,
  EntityDamageCause.starve,
  EntityDamageCause.magma,
  EntityDamageCause.fireTick,
  EntityDamageCause.freezing,
  EntityDamageCause.contact,
  EntityDamageCause.wither,
  EntityDamageCause.soulCampfire,
  EntityDamageCause.campfire,
  EntityDamageCause.flyIntoWall,
  EntityDamageCause.piston,
]);

world.afterEvents.entityHurt.subscribe((event) => {
  const { damageSource: source, hurtEntity: player } = event;
  if (!(player instanceof Player)) return;
  if (exception(source)) return;

  removeOldTag(player);

  player.addTag(`CombatLock-${Date.now()}`);
});

function exception(source: EntityDamageSource) {
  if (isEnvironmentalDamage(source)) {
    return true;
  } else {
    return false;
  }
}

function isEnvironmentalDamage(source: EntityDamageSource) {
  return ENVIRONMENT_DAMAGE.has(source.cause);
}

function removeOldTag(player: Player) {
  const tags = player.getTags();
  for (const tag of tags) {
    if (tag.startsWith("CombatLock-")) {
      player.removeTag(tag);
    }
  }
}

export function isCombatLocked(player: Player) {
  const tags = player.getTags();
  const combatLock = tags.find((tag) => tag.startsWith("CombatLock-"));
  const now = Date.now();
  const then = Number(combatLock?.split("-")[1]);

  const status = now - then < 10000 ? true : false;
  return status;
}
