import { Enchantment, EnchantmentType, ItemStack, ItemTypes, Player } from "@minecraft/server";
import { ActionFormData, ActionFormResponse, MessageFormData } from "@minecraft/server-ui";
import Mail, { MailObj } from "./mail";
import Transaction from "../money/transaction";
import Score from "../money/score";
import { ItemUtils } from "./item";

export function recieveForm(player: Player) {
  const f = new ActionFormData();
  f.title("Mail");
  f.body("Select the type of mail you want to receive");
  f.button("Money");
  f.button("Item");
  f.button("Message");
  f.show(player).then(res => {
    recieveRes(res, player);
  });
}

function recieveRes(res: ActionFormResponse, player: Player) {
  if (res.canceled) return;
  const result = res.selection;
  if (result === 0) {
    moneyForm(player);
  }
  if (result === 1) {
    itemForm(player);
  }
  if (result === 2) {
    messageForm(player);
  }
}

/** MESSAGE FORM */
function messageForm(player: Player) {
  const mails = new Mail()
  const message = mails.receive(player.name, "message");

  const f = new ActionFormData();
  f.title("Message");
  f.body("click your message");
  for (const mail of message) {
    const isRead = mail.read ? "§aread§r" : "§cunread§r";
    f.button(`${mail.from} [${isRead}]`);
  }
  f.button("back");
  f.button("delete all");
  f.show(player)

    .then(res => {
      if (res.canceled) return;
      const result = res.selection;
      if (result === undefined) return;
      if (result < message.length) {
        const mail = message[result]
        mails.markAsRead(mail.id);
        messageRes(mail, player);
      };
      if (result === message.length) recieveForm(player);
      if (result === message.length + 1) message.forEach(n => mails.delete(n.id));
    });
}

function messageRes(mail: MailObj, player: Player) {
  const f = new MessageFormData();
  f.title(`${mail.from} [${mail.read ? "read" : "unread"}]`);
  f.body(`from: ${mail.from}\nto: ${mail.to}\ndesc: ${mail.desc}`);
  f.button1("§a§lOK§r");
  f.button2("§l§cDelete§r")
  f.show(player).then(res => {
    const result = res.selection;
    if (res.canceled) return;
    if (result === 0) {
      messageForm(player);
    }
    if (result === 1) {
      new Mail().delete(mail.id);
      messageForm(player);
    }
  })
}

//* MONEY FORM */
function moneyForm(player: Player) {
  const mails = new Mail();
  const money = mails.receive(player.name, "money");

  const f = new ActionFormData();
  f.title("Money");
  f.body("click your money trans");
  for (const mail of money) {
    const isRead = mail.read ? "§aClaimed§r" : "§cUnclaimed§r";
    f.button(`${mail.from} [${isRead}]`);
  }
  f.button("back");
  f.button("claim all and delete")
  f.show(player).then(res => {
    if (res.canceled) return;
    const result = res.selection;

    if (result === undefined) return;

    if (result < money.length) {
      const mail = money[result];
      moneyRes(mail, player);
      return;
    }
    if (result === money.length) {
      recieveForm(player)
      return;
    }
    if (result === money.length + 1) {
      money.forEach(n => {
        if (!n.read) {
          moneyClaim(player, n);
        }
        mails.markAsRead(n.id);
        mails.delete(n.id);
      })
    };
  })
}

function moneyRes(mail: MailObj, player: Player) {
  const f = new MessageFormData();
  f.title(`${mail.from} [${mail.read ? "Claimed" : "Unclaimed"}]`);
  f.body(`from: ${mail.from}\nto: ${mail.to}\namount: ${mail.contain}\nmessage: ${mail.desc}`);
  f.button1("§a§lClaim§r");
  f.button2("§l§cClaim and Delete§r")
  f.show(player).then(res => {
    const result = res.selection;
    if (res.canceled) return;

    if (result === 0) {
      moneyClaim(player, mail);
      moneyForm(player);
    }
    if (result === 1) {
      moneyClaim(player, mail);
      moneyForm(player);
      new Mail().delete(mail.id);
    }
  })
}

function moneyClaim(player: Player, n: MailObj) {
  if (n.read) return;
  const intParse = Number(n.contain);
  if (isNaN(intParse) || intParse <= 0) return;
  if (player.name !== n.to) return;

  const mails = new Mail();
  const score = new Score(player, "money", "Money");

  mails.markAsRead(n.id);
  score.add(intParse);
}

//* ITEM FORM */ 
function itemForm(player: Player) {
  const mails = new Mail();
  const item = mails.receive(player.name, "item");

  const f = new ActionFormData();
  f.title("Item");
  f.body("click your item");
  for (const mail of item) {
    const isRead = mail.read ? "§aread§r" : "§cunread§r";
    f.button(`${mail.from} [${isRead}]`);
  }
  f.button("back");
  f.button("delete all");
  f.show(player).then(res => {
    if (res.canceled) return;
    const result = res.selection;

    if (result === undefined) return;

    if (result < item.length) {
      const mail = item[result];
      itemRes(mail, player);
      return;
    }

    if (result === item.length) recieveForm(player); //Back
    if (result === item.length + 1) {
      const itemUtils = new ItemUtils();

      item.forEach(n => {
        if (n.read || !n.contain) return;

        const itemStack = itemUtils.parseItem(n.contain);
        if (!itemStack || itemStack.totalAmount <= 0) return;

        itemUtils.addItem(itemStack.itemStack, itemStack.totalAmount, player);
      });

      item.forEach(n => {
        mails.delete(n.id);
      });

      player.sendMessage("§aAll items claimed & deleted");
    }
  })
}

function itemRes(mail: MailObj, player: Player) {
  if (!mail.contain) return;

  const itemUtils = new ItemUtils();
  const itemStack = itemUtils.parseItem(mail.contain);
  if (!itemStack || itemStack.totalAmount <= 0) return;

  const mails = new Mail();

  const name = itemStack.itemStack.typeId.replace("minecraft:", "");

  const f = new MessageFormData();
  f.title(`${mail.from} [${mail.read ? "read" : "unread"}]`);
  f.body(`${mail.desc}\n§e${name} x${itemStack.totalAmount}`);
  f.button1("§a§lClaim§r");
  f.button2("§l§cClaim and Delete§r");

  f.show(player).then(res => {
    if (res.canceled) return;

    const result = res.selection;


    if (result === 0) {
      // Anti dupe
      if (mail.read) {
        player.sendMessage("§cAlready claimed");
        itemForm(player);
        return;
      }
      itemUtils.addItem(itemStack.itemStack, itemStack.totalAmount, player);
      mails.markAsRead(mail.id);
    }

    if (result === 1) {
      mails.delete(mail.id);
      // Anti dupe
      if (mail.read) {
        player.sendMessage("§cAlready claimed");
        itemForm(player);
        return;
      }
      itemUtils.addItem(itemStack.itemStack, itemStack.totalAmount, player);
    }

    itemForm(player);
  });
}