import { world, ItemStack } from "@minecraft/server";
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
