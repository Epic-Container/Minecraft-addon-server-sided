import { ItemStack, Enchantment, Player, world, EnchantmentType } from "@minecraft/server";

interface EnchantObj {
  type: string;
  level: number;
}

interface itemObj {
  type: string;
  lore: string[];
  amount: number;
  nameTag: string;
  enchants: EnchantObj[];
  damage: number;
}

export class ItemUtils {
  public fromPlr?: Player;

  constructor(fromPlr?: Player) {
    this.fromPlr = fromPlr;
  }

  public parseItem(item: string) {
    let data: itemObj;
    try {
      data = JSON.parse(item);
    } catch (e) {
      return;
    }

    const itemStack = new ItemStack(data.type, 1);
    itemStack.amount = data.amount ?? 1;

    this.setDurability(itemStack, data.damage);
    this.setEnchants(itemStack, data.enchants);

    itemStack.nameTag = data.nameTag;
    itemStack.setLore(data.lore);

    return itemStack;
  }

  public itemStringfy(item: ItemStack, amount: number) {
    if (!item) return;
    const lore = item.getLore();
    const enchants = this.getEnchants(item);
    const durability = this.damageDurability(item);

    const data: itemObj = {
      type: item.typeId,
      amount: amount,
      nameTag: this.getItemNameTag(item),
      lore: lore,
      enchants: enchants,
      damage: durability,
    };
    return JSON.stringify(data);
  }

  public addItem(item: ItemStack, toPlr: Player | string) {
    let player: Player;

    if (toPlr instanceof Player) {
      player = toPlr;
    } else {
      const getPlayer = world.getPlayers({ name: toPlr });
      if (!getPlayer.length) return;
      player = getPlayer[0];
    }

    const container = player.getComponent("minecraft:inventory")?.container;
    if (!container) return;

    let remaining = item.amount;
    const max = item.maxAmount;

    while (remaining > 0) {
      const giveAmount = Math.min(remaining, max);

      const newItem = item.clone();
      newItem.amount = giveAmount;

      if (container.emptySlotsCount > 0) {
        container.addItem(newItem);
      } else {
        // kalau inventory penuh → drop ke ground
        player.dimension.spawnItem(newItem, player.location);
      }

      remaining -= giveAmount;
    }
  }

  public isValidAmount(item: string, amount: number, toPlr: Player | string): boolean {
    let player: Player;

    if (toPlr instanceof Player) {
      player = toPlr;
    } else {
      const getPlayer = world.getPlayers({ name: toPlr });
      if (!getPlayer.length) return false;
      player = getPlayer[0];
    }

    const container = player.getComponent("minecraft:inventory")?.container;
    if (!container) return false;

    const itemMap: Map<string, number> = new Map();

    for (let i = 0; i < container.size; i++) {
      const item = container.getItem(i);
      if (!item) continue;
      if (itemMap.has(item.typeId)) {
        const oldAmount = itemMap.get(item.typeId) ?? 0;
        const newAmount = item.amount + oldAmount;
        itemMap.set(item.typeId, newAmount);
      } else {
        itemMap.set(item.typeId, item.amount);
      }
    }

    const amountItem = itemMap.get(item) ?? 0;
    return amountItem >= amount;
  }


  public removeItem(itemTypeId: string, amount: number, toPlr: Player | string) {
    let player: Player;

    if (toPlr instanceof Player) {
      player = toPlr;
    } else {
      const getPlayer = world.getPlayers({ name: toPlr });
      if (!getPlayer.length) return;
      player = getPlayer[0];
    }
    if (!this.isValidAmount(itemTypeId, amount, toPlr)) return;
    player.runCommand(`clear @s ${itemTypeId} 0 ${amount}`);
  }

  /**
   * Returns an array of Enchantment objects from the given ItemStack.
   * If the item does not have the "minecraft:enchantable" component, an empty array is returned.
   * @param {ItemStack} item - The ItemStack to retrieve enchantments from.
   * @returns {Enchantment[]} - An array of Enchantment objects or empty array if nothing.
   */
  private getEnchants(item: ItemStack): EnchantObj[] {
    const enchantComp = item.getComponent("minecraft:enchantable");
    if (!enchantComp) return [];
    const enchantments = enchantComp.getEnchantments();
    return enchantments.map((enchant) => {
      return {
        type: enchant.type.id,
        level: enchant.level
      }
    })
  }

  /**
   * Sets the enchantments on the given ItemStack.
   * If the item does not have the "minecraft:enchantable" component, this function does nothing.
   * @param {ItemStack} item - The ItemStack to set enchantments on.
   * @param {Enchantment[]} enchants - An array of Enchantment objects to set.
   */
  private setEnchants(item: ItemStack, enchants: EnchantObj[]) {
    const enchantComp = item.getComponent("minecraft:enchantable");
    if (!enchantComp) return;
    const enchantment: Enchantment[] = [];
    enchants.forEach((enchant) => {
      enchantment.push({
        type: new EnchantmentType(enchant.type),
        level: enchant.level
      });
    })
    enchantComp.addEnchantments(enchantment);
  }

  /**
   * Returns the current durability of the given ItemStack.
   * If the item does not have the "minecraft:durability" component, 0 is returned.
   * @param {ItemStack} item - The ItemStack to retrieve the durability from.
   * @returns {number} - The current durability of the item.
   */
  private damageDurability(item: ItemStack): number {
    const durabilityComp = item.getComponent("minecraft:durability");
    if (!durabilityComp) return 0;
    return durabilityComp.damage
  }

  /**
   * Sets the durability of the given ItemStack.
   * If the item does not have the "minecraft:durability" component, this function does nothing.
   * @param {ItemStack} item - The ItemStack to set the durability on.
   * @param {number} durability - The current durability of the item.
   */
  private setDurability(item: ItemStack, damage: number) {
    const durabilityComp = item.getComponent("minecraft:durability");
    if (!durabilityComp) return;
    durabilityComp.damage = damage
  }

  /**
   * Returns the name tag of the given ItemStack.
   * If the item does not have a name tag, an empty string is returned.
   * @param {ItemStack} item - The ItemStack to retrieve the name tag from.
   * @returns {string} - The name tag of the item.
   */
  private getItemNameTag(item: ItemStack): string {
    const nametag = item.nameTag ? item.nameTag : "";
    return nametag
  }
}