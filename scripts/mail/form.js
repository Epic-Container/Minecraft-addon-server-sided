import { ActionFormData, MessageFormData } from "@minecraft/server-ui";
import Mail from "./mail";
import Transaction from "money/transaction";
import Score from "money/score";
export function recieveForm(player) {
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
function recieveRes(res, player) {
    if (res.canceled)
        return;
    const result = res.selection;
    if (result === 0) {
        moneyForm(player);
    }
    if (result === 1) {
    }
    if (result === 2) {
    }
    if (result === 3) {
        messageForm(player);
    }
}
function messageForm(player) {
    const mails = new Mail();
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
        if (res.canceled)
            return;
        const result = res.selection;
        const mail = message[result];
        if (result === message.indexOf(mail)) {
            mails.markAsRead(mail.id);
            messageRes(mail, player);
        }
        ;
        if (result === message.length)
            recieveForm(player);
        if (result === message.length + 1)
            message.forEach(n => mails.delete(n.id));
    });
}
function messageRes(mail, player) {
    const f = new MessageFormData();
    f.title(`${mail.from} [${mail.read ? "read" : "unread"}]`);
    f.body(mail.desc);
    f.button1("§a§lOK§r");
    f.button2("§l§cDelete§r");
    f.show(player).then(res => {
        const result = res.selection;
        if (res.canceled)
            return;
        if (result === 0) {
            messageForm(player);
        }
        if (result === 1) {
            new Mail().delete(mail.id);
            messageForm(player);
        }
    });
}
function moneyForm(player) {
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
    f.button("claim all and delete");
    f.show(player).then(res => {
        if (res.canceled)
            return;
        const result = res.selection;
        const mail = money[result];
        if (result === money.indexOf(mail)) {
            mails.markAsRead(mail.id);
            moneyRes(mail, player);
        }
        if (result === money.length)
            recieveForm(player);
        if (result === money.length + 1) {
            money.forEach(n => {
                claim(player, n);
                mails.delete(n.id);
            });
            recieveForm(player);
        }
        ;
    });
}
function moneyRes(mail, player) {
    const f = new MessageFormData();
    f.title(`${mail.from} [${mail.read ? "Claimed" : "Unclaimed"}]`);
    f.body(mail.desc);
    f.button1("§a§lClaim§r");
    f.button2("§l§cClaim and Delete§r");
    f.show(player).then(res => {
        const result = res.selection;
        if (res.canceled)
            return;
        if (result === 0) {
            claim(player, mail);
            moneyForm(player);
        }
        if (result === 1) {
            new Mail().delete(mail.id);
            claim(player, mail);
            moneyForm(player);
        }
    });
}
function claim(player, n) {
    const intParse = parseInt(n.contain);
    const transaction = new Transaction(n.from, n.to, intParse);
    const score = new Score(player, "money", "Money");
    transaction.record("Transfer Money");
    score.add(intParse);
}
