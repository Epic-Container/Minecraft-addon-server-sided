import Mail from "./mail";
import { ItemUtils } from "./item";
import { ModalFormData, ActionFormData } from "@minecraft/server-ui";
import Transaction from "../money/transaction";
import Score from "../money/score";
export function sendForm(player, to) {
    const f = new ActionFormData();
    f.title("Mail");
    f.body("Select the type of mail you want to send");
    f.button("Money");
    f.button("Item");
    f.button("Message");
    f.show(player).then(res => {
        if (res.canceled)
            return;
        if (res.selection === undefined)
            return;
        if (res.selection === 0)
            sendMoney(player, to);
        if (res.selection === 1)
            sendItem(player, to);
        if (res.selection === 2)
            sendMessage(player, to);
    });
}
function sendMessage(player, target) {
    const f = new ModalFormData();
    f.title("Message");
    f.label("Send Message to other player");
    f.textField("Message", "Write your message here");
    f.submitButton("Send");
    f.show(player).then(e => {
        if (e.canceled)
            return;
        if (e.formValues === undefined)
            return;
        const message = e.formValues[1];
        if (typeof message !== "string" || message === "") {
            player.sendMessage("Invalid message");
            return;
        }
        player.sendMessage(`§aMessage sent to ${target} successfully`);
        const mails = new Mail();
        const playerName = player.name;
        const mailObject = {
            id: "",
            from: playerName,
            to: target,
            type: "message",
            date: Date.now(),
            read: false,
            desc: message
        };
        mails.send(mailObject, player);
    });
}
;
function sendMoney(player, target) {
    const f = new ModalFormData();
    f.title("Money");
    f.label("Send Money to other player");
    f.textField("Description", "Write your description here");
    f.textField("Money", "Type amount of money here");
    f.submitButton("Send");
    f.show(player).then(e => {
        if (e.canceled)
            return;
        if (e.formValues === undefined)
            return;
        const desc = e.formValues[1];
        if (typeof desc !== "string" || desc === "") {
            player.sendMessage("§cInvalid description");
            return;
        }
        const money = e.formValues[2];
        if (typeof money !== "string" || money === "") {
            player.sendMessage("§cInvalid amount");
            return;
        }
        const moneyScore = new Score(player, "money", "Money");
        if (moneyScore.get() < Number(money)) {
            player.sendMessage("§cYou don't have enough money");
            return;
        }
        const mails = new Mail();
        const playerName = player.name;
        const transaction = new Transaction(playerName, target, Number(money));
        const mailObject = {
            id: "",
            from: playerName,
            to: target,
            type: "money",
            date: Date.now(),
            read: false,
            desc: desc,
            contain: money
        };
        moneyScore.remove(Number(money));
        transaction.record("Money Transfer");
        mails.send(mailObject, player);
        player.sendMessage(`§aMoney sent to ${target} successfully`);
    });
}
;
function sendItem(player, target) {
    const itemUtils = new ItemUtils();
    const invent = player.getComponent("minecraft:inventory");
    if (!invent)
        return;
    const container = invent.container;
    const groups = {};
    // Bangun grup berdasarkan fingerprint
    for (let i = 0; i < container.size; i++) {
        const item = container.getItem(i);
        if (!item)
            continue;
        if (item.maxAmount === 1) {
            // Non-stackable → tiap slot dianggap unik
            const key = `${item.typeId}_${i}`;
            const fp = itemUtils.getPublicFingerprint(item);
            groups[key] = {
                item: item.clone(),
                fingerprint: fp,
                slots: [i],
                totalAmount: 1,
            };
            continue;
        }
        // Stackable → gabungkan berdasarkan fingerprint
        const fp = itemUtils.getPublicFingerprint(item);
        if (groups[fp]) {
            groups[fp].item.amount += item.amount;
            groups[fp].slots.push(i);
            groups[fp].totalAmount += item.amount;
        }
        else {
            groups[fp] = {
                item: item.clone(),
                fingerprint: fp,
                slots: [i],
                totalAmount: item.amount,
            };
        }
    }
    const groupKeys = Object.keys(groups);
    if (groupKeys.length === 0) {
        player.sendMessage("§cYou don't have any item");
        return;
    }
    // Siapkan label dropdown dengan detail
    const keyAndAmount = groupKeys.map((key, index) => {
        const g = groups[key];
        const typeName = g.item.typeId.replace("minecraft:", "");
        let details = "";
        if (g.item.nameTag)
            details += ` "${g.item.nameTag}"`;
        const enchants = itemUtils.getEnchants(g.item);
        if (enchants.length > 0) {
            details += ` [${enchants.map(e => `${e.type}:${e.level}`).join(", ")}]`;
        }
        return `${index + 1}. ${typeName}${details} (${g.totalAmount})`;
    });
    const f = new ModalFormData();
    f.title("Item Sender");
    f.label("Send Item to other player...");
    f.textField("Description", "Write your description here");
    f.dropdown("Choose item", keyAndAmount);
    f.textField("Amount", "Type amount");
    f.show(player).then((e) => {
        if (e.canceled || !e.formValues)
            return;
        const desc = e.formValues[1];
        const itemIndex = e.formValues[2];
        const amountStr = e.formValues[3];
        if (typeof desc !== "string" || desc.trim() === "") {
            player.sendMessage("§cInvalid description");
            return;
        }
        if (typeof itemIndex !== "number") {
            player.sendMessage("§cInvalid item");
            return;
        }
        const amount = parseInt(amountStr);
        if (isNaN(amount) || amount <= 0) {
            player.sendMessage("§cInvalid amount");
            return;
        }
        const selectedKey = groupKeys[itemIndex];
        const selectedGroup = groups[selectedKey];
        // Non-stackable hanya boleh jumlah 1
        if (selectedGroup.item.maxAmount === 1 && amount !== 1) {
            player.sendMessage("§cNon-stackable items can only be sent as 1.");
            return;
        }
        // Penghapusan item
        if (selectedGroup.item.maxAmount === 1) {
            // Hapus langsung dari slot
            const slot = selectedGroup.slots[0];
            const currentItem = container.getItem(slot);
            if (!currentItem || itemUtils.getPublicFingerprint(currentItem) !== selectedGroup.fingerprint) {
                player.sendMessage("§cItem has changed or moved.");
                return;
            }
            container.setItem(slot, undefined);
        }
        else {
            // Stackable: validasi & hapus eksak
            const itemSpec = {
                type: selectedGroup.item.typeId,
                amount: amount,
                nameTag: selectedGroup.item.nameTag ?? "",
                lore: selectedGroup.item.getLore(),
                enchants: itemUtils.getEnchants(selectedGroup.item),
                damage: itemUtils.damageDurability(selectedGroup.item),
            };
            if (!itemUtils.isValidAmountExact(itemSpec, player)) {
                player.sendMessage("§cYou don't have enough of that exact item.");
                return;
            }
            const removeSuccess = itemUtils.removeItemExact(itemSpec, player);
            if (!removeSuccess) {
                player.sendMessage("§cFailed to remove item (inventory changed?).");
                return;
            }
        }
        // Serialisasi & kirim mail
        const sendAmount = selectedGroup.item.maxAmount === 1 ? 1 : amount;
        const serialized = itemUtils.itemStringfy(selectedGroup.item, sendAmount);
        if (!serialized) {
            player.sendMessage("§cSerialization error.");
            return;
        }
        const mailObj = {
            date: Date.now(),
            desc: desc,
            from: player.name,
            id: "",
            read: false,
            to: target,
            type: "item",
            contain: serialized,
        };
        new Mail().send(mailObj, player);
        player.sendMessage(`§aItem sent to ${target} successfully`);
    });
}
