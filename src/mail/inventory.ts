import { ItemStack, Player, world, Enchantment } from "@minecraft/server";

interface Metadata {
  amount: number,
  lore: string[],
  enchants: Enchantment[],
  nameTag: string,
  durDamage: number,
  maxDur: number
}
export class flexItem {
  readonly player: Player;
  
  constructor (player: Player | string) {
    this.player = player instanceof Player ? player : world.getPlayers({ name: player })[0];
  } 
  private getContainer () {
    return this.player.getComponent("minecraft:inventory")?.container;
  }

  public inventoryItem() {
    const container = this.getContainer();
    if (!container) return;
    const items: {item: ItemStack, slot: number}[] = [];

    for (let i = 0; i < container.size; i++) {
      const item = container.getItem(i);
      if (!item) continue;
      items.push({
        item: item.clone(),
        slot: i
      });
    }
    return items;
  }
  
  public stackSameItem() {
    const items = this.inventoryItem();
    const itemMap: {[key: string]: {item: ItemStack, amount: number}} = {};

    if (!items) return;

    for (const item of items) {
      if (item.item.maxAmount !== 1) {
        itemMap[item.item.typeId + "|" + item.slot] = {
          item: item.item.clone(),
          amount: item.item.amount
        }
        continue;
      };

      if (itemMap[item.item.typeId]) {
        itemMap[item.item.typeId].amount += item.item.amount;
      } else {
        itemMap[item.item.typeId] = {
          item: item.item.clone(),
          amount: item.item.amount
        }
      }
    }
    return itemMap;
  }

}