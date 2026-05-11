import { system, world } from "@minecraft/server";
import { JaylyDB } from "../jaylydb/index.js";
import { generateId } from "../money/transaction";
// id -> MailObj
const cache = new Map();
// player name -> Set of id
const playerIndex = new Map();
// mark player if ever join the game
const setOfPlayerName = new Set();
let isLoaded = false;
system.run(() => {
    const db = new JaylyDB("Mail", false);
    const loadingFunc = (value, key) => {
        if (typeof value !== "string")
            return;
        const data = JSON.parse(value);
        cache.set(key, data);
        // indexing from
        if (!playerIndex.has(data.from))
            playerIndex.set(data.from, new Set());
        playerIndex.get(data.from).add(key);
        // indexing to
        if (!playerIndex.has(data.to))
            playerIndex.set(data.to, new Set());
        playerIndex.get(data.to).add(key);
        // set of player
        if (!setOfPlayerName.has(data.from))
            setOfPlayerName.add(data.from);
        if (!setOfPlayerName.has(data.to))
            setOfPlayerName.add(data.to);
    };
    db.forEach(loadingFunc);
    isLoaded = true;
});
class Mail {
    send(mail, player) {
        const db = new JaylyDB("Mail", false);
        const id = generateId(10, mail.type);
        const toLower = mail.to.toLowerCase();
        const fromLower = mail.from.toLowerCase();
        let fullId = `${mail.type}:${id}`;
        do {
            fullId = `${mail.type}:${generateId(10, mail.type)}`;
        } while (cache.has(fullId));
        if (!setOfPlayerName.has(mail.to)) {
            player.sendMessage("§cCan't send mail to player never connected or exist");
            return;
        }
        mail.from = fromLower;
        mail.to = toLower;
        mail.id = fullId;
        mail.date ??= Date.now();
        mail.read ??= false;
        mail.contain ??= "";
        cache.set(fullId, mail);
        db.set(fullId, JSON.stringify(mail));
        if (!setOfPlayerName.has(mail.from))
            setOfPlayerName.add(mail.from);
        if (!setOfPlayerName.has(mail.to))
            setOfPlayerName.add(mail.to);
        // indexing from
        if (!playerIndex.has(mail.from))
            playerIndex.set(mail.from, new Set());
        playerIndex.get(mail.from).add(fullId);
        // indexing to
        if (!playerIndex.has(mail.to))
            playerIndex.set(mail.to, new Set());
        playerIndex.get(mail.to).add(fullId);
    }
    receive(playerName, type) {
        const mails = playerIndex.get(playerName) ?? new Set();
        return Array.from(mails)
            .map(id => cache.get(id))
            .filter((mail) => {
            if (!mail)
                return false;
            if (mail.to !== playerName)
                return false;
            if (type && mail.type !== type)
                return false;
            return true;
        });
    }
    sended(playerName, type) {
        const mails = playerIndex.get(playerName) ?? new Set();
        return Array.from(mails)
            .map(id => cache.get(id))
            .filter((mail) => {
            if (!mail)
                return false;
            if (mail.from !== playerName)
                return false;
            if (type && mail.type !== type)
                return false;
            return true;
        });
    }
    cleanupExpired() {
        const now = Date.now();
        const TEN_DAYS = 10 * 24 * 60 * 60 * 1000;
        for (const [id, mail] of cache.entries()) {
            if (mail.type === "money" || mail.type === "item")
                continue;
            const mailTime = mail.date;
            if (now - mailTime > TEN_DAYS) {
                this.delete(id);
            }
        }
    }
    markAsRead(id) {
        const db = new JaylyDB("Mail", false);
        const mail = cache.get(id);
        if (!mail)
            return;
        mail.read = true;
        cache.set(id, mail);
        db.set(id, JSON.stringify(mail));
    }
    delete(id) {
        const db = new JaylyDB("Mail", false);
        const mail = cache.get(id);
        if (!mail)
            return;
        db.delete(id);
        cache.delete(id);
        // remove from sender
        const fromSet = playerIndex.get(mail.from);
        fromSet?.delete(id);
        if (fromSet && fromSet.size === 0)
            playerIndex.delete(mail.from);
        // remove from receiver
        const toSet = playerIndex.get(mail.to);
        toSet?.delete(id);
        if (toSet && toSet.size === 0)
            playerIndex.delete(mail.to);
    }
    deleteAll(playerName) {
        const ids = playerIndex.get(playerName);
        if (!ids)
            return;
        for (const id of Array.from(ids)) {
            this.delete(id);
        }
        playerIndex.delete(playerName);
    }
}
export default Mail;
world.afterEvents.playerJoin.subscribe((event) => {
    const playerName = event.playerName;
    setOfPlayerName.add(playerName);
});
world.afterEvents.playerSpawn.subscribe((event) => {
    const isInit = event.initialSpawn;
    const player = event.player;
    if (isInit) {
        const mail = new Mail();
        mail.cleanupExpired();
        const msgMail = mail.receive(player.name, "message");
        const taxMail = mail.receive(player.name, "tax");
        const moneyMail = mail.receive(player.name, "money");
        const itemMail = mail.receive(player.name, "item");
        if (msgMail.length) {
            player.sendMessage(`You have ${msgMail.length} message${msgMail.length > 1 ? "s" : ""}`);
        }
        if (taxMail.length) {
            player.sendMessage(`You have ${taxMail.length} tax${taxMail.length > 1 ? "es" : ""}`);
        }
        if (moneyMail.length) {
            player.sendMessage(`You have ${moneyMail.length} money${moneyMail.length > 1 ? "s" : ""}`);
        }
        if (itemMail.length) {
            player.sendMessage(`You have ${itemMail.length} item${itemMail.length > 1 ? "s" : ""}`);
        }
    }
});
import { ItemStack } from "@minecraft/server";
import { ItemUtils } from "./item"; // sesuaikan path
world.beforeEvents.chatSend.subscribe((event) => {
    const msg = event.message;
    const player = event.sender;
    if (!msg.startsWith(".testitem"))
        return;
    event.cancel = true; // batalkan pesan chat asli
    const args = msg.split(" ");
    const subCmd = args[1];
    const utils = new ItemUtils(player); // fromPlr untuk log
    switch (subCmd) {
        case "fingerprint": {
            // cek fingerprint item di tangan utama
            const handItem = player.getComponent("inventory")?.container?.getItem(player.selectedSlotIndex);
            if (!handItem) {
                player.sendMessage("§cKamu tidak memegang item.");
                break;
            }
            // panggil private method? buat public wrapper
            const fp = utils.getPublicFingerprint(handItem);
            player.sendMessage(`§aFingerprint: §f${fp}`);
            break;
        }
        case "valid": {
            // test isValidAmountExact: .testitem valid <typeId> <amount>
            if (args.length < 4) {
                player.sendMessage("§eUsage: .testitem valid <typeId> <amount>");
                break;
            }
            const spec = {
                type: args[2],
                amount: parseInt(args[3]),
                nameTag: "",
                lore: [],
                enchants: [],
                damage: 0
            };
            const valid = utils.isValidAmountExact(spec, player);
            player.sendMessage(`§aisValidAmountExact: ${valid}`);
            break;
        }
        case "remove": {
            // test removeItemExact: .testitem remove <typeId> <amount>
            if (args.length < 4) {
                player.sendMessage("§eUsage: .testitem remove <typeId> <amount>");
                break;
            }
            const spec = {
                type: args[2],
                amount: parseInt(args[3]),
                nameTag: "",
                lore: [],
                enchants: [],
                damage: 0
            };
            const removed = utils.removeItemExact(spec, player);
            player.sendMessage(`§aremoveItemExact berhasil: ${removed}`);
            break;
        }
        case "add": {
            // test addItem: .testitem add <typeId> <amount>
            if (args.length < 4) {
                player.sendMessage("§eUsage: .testitem add <typeId> <amount>");
                break;
            }
            const template = new ItemStack(args[2], 1);
            const totalAmount = parseInt(args[3]);
            utils.addItem(template, totalAmount, player);
            player.sendMessage(`§aaddItem: mencoba menambah ${totalAmount} x ${args[2]}`);
            break;
        }
        case "serialize": {
            // cek itemStringfy pada item tangan
            const handItem = player.getComponent("inventory")?.container?.getItem(player.selectedSlotIndex);
            if (!handItem) {
                player.sendMessage("§cTidak ada item di tangan.");
                break;
            }
            const json = utils.itemStringfy(handItem, handItem.amount);
            player.sendMessage(`§aSerialized: §f${json}`);
            break;
        }
        default:
            player.sendMessage("§eSub perintah: fingerprint, valid, remove, add, serialize");
    }
});
