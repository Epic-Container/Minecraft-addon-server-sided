import { ItemStack, Enchantment, EnchantmentType, Player } from "@minecraft/server";

interface itemObj {
  type: string;
  lore: string[];
  amount: number;
  nameTag: string;
  enchants: Enchantment[];
  durability: number;
}

export class ItemUtils {
  public fromPlr?: Player;

  constructor(fromPlr?: Player) {
    this.fromPlr = fromPlr;
  }

  private parseItem(item: string) {
    const data: itemObj = JSON.parse(item);
    const itemStack = new ItemStack(data.type, data.amount ?? 1);
    this.setDurability(itemStack, data.durability);
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
      durability: durability
    };
    return JSON.stringify(data);
  }

  public addItem(item: ItemStack, amount: number) {
    if (!this.fromPlr) return;
    
  }

  /**
   * Returns an array of Enchantment objects from the given ItemStack.
   * If the item does not have the "minecraft:enchantable" component, an empty array is returned.
   * @param {ItemStack} item - The ItemStack to retrieve enchantments from.
   * @returns {Enchantment[]} - An array of Enchantment objects or empty array if nothing.
   */
  private getEnchants(item: ItemStack): Enchantment[] {
    const enchantComp = item.getComponent("minecraft:enchantable");
    if (!enchantComp) return [];
    return enchantComp.getEnchantments();
  }

  /**
   * Sets the enchantments on the given ItemStack.
   * If the item does not have the "minecraft:enchantable" component, this function does nothing.
   * @param {ItemStack} item - The ItemStack to set enchantments on.
   * @param {Enchantment[]} enchants - An array of Enchantment objects to set.
   */
  private setEnchants(item: ItemStack, enchants: Enchantment[]) {
    const enchantComp = item.getComponent("minecraft:enchantable");
    if (!enchantComp) return;
    enchantComp.addEnchantments(enchants);
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