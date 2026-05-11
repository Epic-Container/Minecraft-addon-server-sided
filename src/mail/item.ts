import {
  ItemStack,
  Enchantment,
  Player,
  world,
  EnchantmentType,
} from "@minecraft/server";

interface EnchantObj {
  type: string;
  level: number;
}

export interface itemObj {
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

  public parseItem(
    item: string,
  ): { itemStack: ItemStack; totalAmount: number } | undefined {
    let data: itemObj;
    try {
      data = JSON.parse(item);
    } catch (e) {
      return;
    }

    const itemStack = new ItemStack(data.type, 1); // template, amount selalu 1
    // ⚠️ JANGAN set amount ke data.amount di sini
    // itemStack.amount = data.amount ?? 1;

    this.setDurability(itemStack, data.damage);
    this.setEnchants(itemStack, data.enchants);

    itemStack.nameTag = data.nameTag;
    itemStack.setLore(data.lore);

    return {
      itemStack,
      totalAmount: data.amount ?? 1, // total amount asli dari frontend
    };
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

  public addItem(
    itemTemplate: ItemStack,
    totalAmount: number,
    toPlr: Player | string,
  ) {
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

    let remaining = totalAmount; // gunakan total amount asli
    const max = itemTemplate.maxAmount;

    while (remaining > 0) {
      const giveAmount = Math.min(remaining, max);

      const newItem = itemTemplate.clone();
      newItem.amount = giveAmount; // baru sekarang set amount per stack

      if (container.emptySlotsCount > 0) {
        const leftover = container.addItem(newItem);

        if (leftover) {
          player.dimension.spawnItem(leftover, player.location);
        }
      } else {
        player.dimension.spawnItem(newItem, player.location);
      }

      remaining -= giveAmount;
    }
  }

  public isValidAmountExact(
    itemSpec: itemObj,
    toPlr: Player | string,
  ): boolean {
    // ambil player
    let player: Player;
    if (toPlr instanceof Player) {
      player = toPlr;
    } else {
      const result = world.getPlayers({ name: toPlr });
      if (!result.length) return false;
      player = result[0];
    }

    const container = player.getComponent("minecraft:inventory")?.container;
    if (!container) return false;

    // generate fingerprint dari spesifikasi
    const targetFingerprint = JSON.stringify({
      type: itemSpec.type,
      nameTag: itemSpec.nameTag,
      lore: itemSpec.lore,
      enchants: itemSpec.enchants
        .slice() // jangan mutate array asli
        .sort((a, b) => a.type.localeCompare(b.type)),
      damage: itemSpec.damage,
    });

    let totalAmount = 0;

    for (let i = 0; i < container.size; i++) {
      const slotItem = container.getItem(i);
      if (!slotItem) continue;

      const slotFingerprint = this.getItemFingerprint(slotItem);
      if (slotFingerprint === targetFingerprint) {
        totalAmount += slotItem.amount;
      }
    }

    return totalAmount >= itemSpec.amount;
  }

  public removeItemExact(itemSpec: itemObj, toPlr: Player | string): boolean {
    // ambil player
    let player: Player;
    if (toPlr instanceof Player) {
      player = toPlr;
    } else {
      const result = world.getPlayers({ name: toPlr });
      if (!result.length) return false;
      player = result[0];
    }

    if (!this.isValidAmountExact(itemSpec, toPlr)) return false;

    const container = player.getComponent("minecraft:inventory")?.container;
    if (!container) return false;

    const targetFingerprint = JSON.stringify({
      type: itemSpec.type,
      nameTag: itemSpec.nameTag,
      lore: itemSpec.lore,
      enchants: itemSpec.enchants
        .slice()
        .sort((a, b) => a.type.localeCompare(b.type)),
      damage: itemSpec.damage,
    });

    let remaining = itemSpec.amount;

    for (let i = container.size - 1; i >= 0 && remaining > 0; i--) {
      const slotItem = container.getItem(i);
      if (!slotItem) continue;

      const slotFingerprint = this.getItemFingerprint(slotItem);
      if (slotFingerprint !== targetFingerprint) continue;

      const amountInSlot = slotItem.amount;
      if (amountInSlot <= remaining) {
        // buang seluruh stack di slot ini
        container.setItem(i, undefined);
        remaining -= amountInSlot;
      } else {
        // kurangi sebagian
        slotItem.amount = amountInSlot - remaining;
        container.setItem(i, slotItem);
        remaining = 0;
      }
    }

    return remaining === 0; // true jika semua jumlah berhasil dihapus
  }

  /**
   * Returns an array of Enchantment objects from the given ItemStack.
   * If the item does not have the "minecraft:enchantable" component, an empty array is returned.
   * @param {ItemStack} item - The ItemStack to retrieve enchantments from.
   * @returns {Enchantment[]} - An array of Enchantment objects or empty array if nothing.
   */
  public getEnchants(item: ItemStack): EnchantObj[] {
    const enchantComp = item.getComponent("minecraft:enchantable");
    if (!enchantComp) return [];
    const enchantments = enchantComp.getEnchantments();
    return enchantments.map((enchant) => {
      return {
        type: enchant.type.id,
        level: enchant.level,
      };
    });
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
        level: enchant.level,
      });
    });
    enchantComp.addEnchantments(enchantment);
  }

  /**
   * Returns the current durability of the given ItemStack.
   * If the item does not have the "minecraft:durability" component, 0 is returned.
   * @param {ItemStack} item - The ItemStack to retrieve the durability from.
   * @returns {number} - The current durability of the item.
   */
  public damageDurability(item: ItemStack): number {
    const durabilityComp = item.getComponent("minecraft:durability");
    if (!durabilityComp) return 0;
    return durabilityComp.damage;
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
    durabilityComp.damage = damage;
  }

  /**
   * Returns the name tag of the given ItemStack.
   * If the item does not have a name tag, an empty string is returned.
   * @param {ItemStack} item - The ItemStack to retrieve the name tag from.
   * @returns {string} - The name tag of the item.
   */
  private getItemNameTag(item: ItemStack): string {
    const nametag = item.nameTag ? item.nameTag : "";
    return nametag;
  }

  private getItemFingerprint(item: ItemStack): string {
    const enchants = this.getEnchants(item)
      // urutkan agar urutan enchant tidak mempengaruhi
      .sort((a, b) => a.type.localeCompare(b.type));
    const data = {
      type: item.typeId,
      nameTag: this.getItemNameTag(item),
      lore: item.getLore(),
      enchants: enchants,
      damage: this.damageDurability(item),
    };
    return JSON.stringify(data);
  }
  public getPublicFingerprint(item: ItemStack): string {
    return this.getItemFingerprint(item);
  }
}
