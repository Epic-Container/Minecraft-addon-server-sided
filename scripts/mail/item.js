import { ItemStack, Player, world, EnchantmentType } from "@minecraft/server";
export class ItemUtils {
    constructor(fromPlr) {
        this.fromPlr = fromPlr;
    }
    parseItem(item) {
        let data;
        try {
            data = JSON.parse(item);
        }
        catch (e) {
            return;
        }
        const itemStack = new ItemStack(data.type, data.amount ?? 1);
        this.setDurability(itemStack, data.damage);
        this.setEnchants(itemStack, data.enchants);
        itemStack.nameTag = data.nameTag;
        itemStack.setLore(data.lore);
        return itemStack;
    }
    itemStringfy(item, amount) {
        if (!item)
            return;
        const lore = item.getLore();
        const enchants = this.getEnchants(item);
        const durability = this.damageDurability(item);
        const data = {
            type: item.typeId,
            amount: amount,
            nameTag: this.getItemNameTag(item),
            lore: lore,
            enchants: enchants,
            damage: durability,
        };
        return JSON.stringify(data);
    }
    addItem(item, toPlr) {
        let player;
        if (toPlr instanceof Player) {
            player = toPlr;
        }
        else {
            const getPlayer = world.getPlayers({ name: toPlr });
            if (!getPlayer.length)
                return;
            player = getPlayer[0];
        }
        const container = player.getComponent("minecraft:inventory")?.container;
        if (!container)
            return;
        if (container.emptySlotsCount > 0) {
            container.addItem(item);
        }
        else {
            player.dimension.spawnItem(item, player.location);
        }
    }
    isValidAmount(item, amount, toPlr) {
        let player;
        if (toPlr instanceof Player) {
            player = toPlr;
        }
        else {
            const getPlayer = world.getPlayers({ name: toPlr });
            if (!getPlayer.length)
                return false;
            player = getPlayer[0];
        }
        const container = player.getComponent("minecraft:inventory")?.container;
        if (!container)
            return false;
        const itemMap = new Map();
        for (let i = 0; i < container.size; i++) {
            const item = container.getItem(i);
            if (!item)
                continue;
            if (itemMap.has(item.typeId)) {
                const oldAmount = itemMap.get(item.typeId) ?? 0;
                const newAmount = item.amount + oldAmount;
                itemMap.set(item.typeId, newAmount);
            }
            else {
                itemMap.set(item.typeId, item.amount);
            }
        }
        const amountItem = itemMap.get(item) ?? 0;
        return amountItem >= amount;
    }
    removeItem(itemTypeId, amount, toPlr) {
        let player;
        if (toPlr instanceof Player) {
            player = toPlr;
        }
        else {
            const getPlayer = world.getPlayers({ name: toPlr });
            if (!getPlayer.length)
                return;
            player = getPlayer[0];
        }
        if (!this.isValidAmount(itemTypeId, amount, toPlr))
            return;
        player.runCommand(`clear @s ${itemTypeId} 0 ${amount}`);
    }
    /**
     * Returns an array of Enchantment objects from the given ItemStack.
     * If the item does not have the "minecraft:enchantable" component, an empty array is returned.
     * @param {ItemStack} item - The ItemStack to retrieve enchantments from.
     * @returns {Enchantment[]} - An array of Enchantment objects or empty array if nothing.
     */
    getEnchants(item) {
        const enchantComp = item.getComponent("minecraft:enchantable");
        if (!enchantComp)
            return [];
        const enchantments = enchantComp.getEnchantments();
        return enchantments.map((enchant) => {
            return {
                type: enchant.type.id,
                level: enchant.level
            };
        });
    }
    /**
     * Sets the enchantments on the given ItemStack.
     * If the item does not have the "minecraft:enchantable" component, this function does nothing.
     * @param {ItemStack} item - The ItemStack to set enchantments on.
     * @param {Enchantment[]} enchants - An array of Enchantment objects to set.
     */
    setEnchants(item, enchants) {
        const enchantComp = item.getComponent("minecraft:enchantable");
        if (!enchantComp)
            return;
        const enchantment = [];
        enchants.forEach((enchant) => {
            enchantment.push({
                type: new EnchantmentType(enchant.type),
                level: enchant.level
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
    damageDurability(item) {
        const durabilityComp = item.getComponent("minecraft:durability");
        if (!durabilityComp)
            return 0;
        return durabilityComp.damage;
    }
    /**
     * Sets the durability of the given ItemStack.
     * If the item does not have the "minecraft:durability" component, this function does nothing.
     * @param {ItemStack} item - The ItemStack to set the durability on.
     * @param {number} durability - The current durability of the item.
     */
    setDurability(item, damage) {
        const durabilityComp = item.getComponent("minecraft:durability");
        if (!durabilityComp)
            return;
        durabilityComp.damage = damage;
    }
    /**
     * Returns the name tag of the given ItemStack.
     * If the item does not have a name tag, an empty string is returned.
     * @param {ItemStack} item - The ItemStack to retrieve the name tag from.
     * @returns {string} - The name tag of the item.
     */
    getItemNameTag(item) {
        const nametag = item.nameTag ? item.nameTag : "";
        return nametag;
    }
}
