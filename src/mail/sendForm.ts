import Mail, { MailObj } from "./mail";
import { ItemUtils } from "./item";
import { ModalFormData, ActionFormData } from "@minecraft/server-ui";
import { ItemStack, Player } from "@minecraft/server";
import Transaction from "../money/transaction";
import Score from "../money/score";

export function sendForm(player: Player, to: string) {
  const f = new ActionFormData();
  f.title("Mail");
  f.body("Select the type of mail you want to send");
  f.button("Money");
  f.button("Item");
  f.button("Message");
  f.show(player).then(res => {
    if (res.canceled) return;
    if (res.selection === undefined) return;

    if (res.selection === 0) sendMoney(player, to);
    if (res.selection === 1) sendItem(player, to);
    if (res.selection === 2) sendMessage(player, to);
  });
}

function sendMessage(player: Player, target: string) {
  const f = new ModalFormData();
  f.title("Message");
  f.label("Send Message to other player");
  f.textField("Message", "Write your message here");
  f.submitButton("Send");
  f.show(player).then(e => {
    if (e.canceled) return;
    if (e.formValues === undefined) return;

    const message = e.formValues[1];
    if (typeof message !== "string" || message === "") {
      player.sendMessage("Invalid message");
      return;
    }

    player.sendMessage(`§aMessage sent to ${target} successfully`);
    const mails = new Mail();
    const playerName = player.name;
    const mailObject: MailObj = {
      id: "",
      from: playerName,
      to: target,
      type: "message",
      date: Date.now(),
      read: false,
      desc: message
    }

    mails.send(mailObject, player);
  });
};

function sendMoney(player: Player, target: string) {
  const f = new ModalFormData();
  f.title("Money");
  f.label("Send Money to other player");
  f.textField("Description", "Write your description here");
  f.textField("Money", "Type amount of money here");
  f.submitButton("Send");
  f.show(player).then(e => {
    if (e.canceled) return;
    if (e.formValues === undefined) return;

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
    const mailObject: MailObj = {
      id: "",
      from: playerName,
      to: target,
      type: "money",
      date: Date.now(),
      read: false,
      desc: desc,
      contain: money
    }

    moneyScore.remove(Number(money));
    transaction.record("Money Transfer");
    mails.send(mailObject, player);
    player.sendMessage(`§aMoney sent to ${target} successfully`);
  })
};

function sendItem(player: Player, target: string) {
  const itemUtils = new ItemUtils();

  const invent = player.getComponent("minecraft:inventory");
  if (!invent) return;

  const container = invent.container;

  type StoredItem = {
    item: ItemStack;
    slot: number;
  };

  const items: { [key: string]: StoredItem } = {};

  for (let i = 0; i < container.size; i++) {
    const item = container.getItem(i);
    if (!item) continue;

    // 🔴 NON-stackable
    if (item.maxAmount === 1) {
      const key = `${item.typeId}_${i}`;
      items[key] = {
        item: item.clone(),
        slot: i
      };
      continue;
    }

    // 🟢 stackable
    if (items[item.typeId]) {
      items[item.typeId].item.amount += item.amount;
    } else {
      items[item.typeId] = {
        item: item.clone(),
        slot: i // ini cuma slot pertama (nanti remove pakai clear boleh)
      };
    }
  }

  const keys = Object.keys(items);
  if (keys.length === 0) {
    player.sendMessage("§cYou don't have any item");
    return;
  }
  const keyAndAmount = keys.map((key, index) => {
    const item = items[key];
    return `${index + 1}. ${item.item.typeId.replace("minecraft:", "")} (${item.item.amount})`;
  });

  const f = new ModalFormData();
  f.title("Item Sender");
  f.label("Send Item to other player...");
  f.textField("Description", "Write your description here");
  f.dropdown("Choose item", keyAndAmount);
  f.textField("Amount", "Type amount");

  f.show(player).then(e => {
    if (e.canceled || !e.formValues) return;

    const desc = e.formValues[1];
    const itemIndex = e.formValues[2];
    const amountStr = e.formValues[3];

    if (typeof desc !== "string" || desc === "") {
      player.sendMessage("§cInvalid description");
      return;
    }

    if (typeof itemIndex !== "number") {
      player.sendMessage("§cInvalid item");
      return;
    }

    const amount = parseInt(amountStr as string);
    if (isNaN(amount) || amount <= 0) {
      player.sendMessage("§cInvalid amount");
      return;
    }

    const selectedKey = keys[itemIndex];
    const selectedItem = items[selectedKey];

    if (!itemUtils.isValidAmount(selectedItem.item.typeId, amount, player)) {
      player.sendMessage("§cYou don't have enough item");
      return;
    }

    const selected = items[selectedKey];

    // 🔴 NON-stackable → remove by slot
    if (selected.item.maxAmount === 1) {
      container.setItem(selected.slot, undefined);
    } else {
      // 🟢 stackable → boleh pakai sistem lama
      itemUtils.removeItem(selected.item.typeId, amount, player);
    }


    const serialize = itemUtils.itemStringfy(selectedItem.item, amount);
    if (!serialize) return;

    const mails = new Mail();

    const mailObject: MailObj = {
      date: Date.now(),
      desc: desc,
      from: player.name,
      id: "",
      read: false,
      to: target,
      type: "item",
      contain: serialize
    };

    mails.send(mailObject, player);
    player.sendMessage(`§aItem sent to ${target} successfully`);
  });
}