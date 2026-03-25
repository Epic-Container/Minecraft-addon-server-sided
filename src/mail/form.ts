import { Player } from "@minecraft/server";
import { ActionFormData, ActionFormResponse, MessageFormData } from "@minecraft/server-ui";
import Mail, { MailObj } from "./mail";
import Transaction from "money/transaction";
import Score from "money/score";

export function recieveForm(player: Player) {
  const f = new ActionFormData();
  f.title("Mail");
  f.body("Select the type of mail you want to receive");
  f.button("Money");
  f.button("Item");
  f.button("Tax");
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

  }
  if (result === 3) {
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
  f.body(mail.desc);
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
    if (result < money.length) {
      const mail = money[result];
      moneyRes(mail, player);
      mails.markAsRead(mail.id);
      return;
    }
    if (result === money.length) {
      recieveForm(player)
      return;
    } 
    if (result === money.length + 1) {
      money.forEach(n => {
        moneyClaim(player, n);
        mails.delete(n.id);
        mails.markAsRead(n.id);
      })
      recieveForm(player);
      return;
    };
  })
}

function moneyRes(mail: MailObj, player: Player) {
  const f = new MessageFormData();
  f.title(`${mail.from} [${mail.read ? "Claimed" : "Unclaimed"}]`);
  f.body(mail.desc);
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
  const transaction = new Transaction(n.from, n.to, intParse);
  const score = new Score(player, "money", "Money");

  transaction.record("Transfer Money");
  score.add(intParse);
}

//* ITEM FORM */
function itemForm(player: Player) {
  const mails = new Mail();
  const item = mails.receive(player.name, "item");
}