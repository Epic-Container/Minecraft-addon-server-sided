import { system, world } from "@minecraft/server";
import { JaylyDB } from "../jaylydb/index.js";

interface Data {
  from: string;
  to: string;
  amount: number;
  date: number;
  desc: string;
}

// player name -> transactions ID -> data
const transactions: Map<string, Data> = new Map();
const playerIndex: Map<string, Set<string>> = new Map();

let load = false;
system.run(() => {
  const db = new JaylyDB("transactions", false);
  db.forEach((value, key: string) => {
    if (typeof value !== "string") return;
    const data: Data = JSON.parse(value);

    transactions.set(key, data);

    // index from
    if (!playerIndex.has(data.from)) playerIndex.set(data.from, new Set());
    playerIndex.get(data.from)!.add(key);

    // index to
    if (!playerIndex.has(data.to)) playerIndex.set(data.to, new Set());
    playerIndex.get(data.to)!.add(key);
  });

  load = true;
});

export function generateId(length: number, salt: string): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  let id = "";
  let attempts = 0;

  do {
    id = "";
    for (let i = 0; i < length; i++) {
      id += chars[Math.floor(Math.random() * chars.length)];
    }
    id += salt;
    attempts++;
  } while (transactions.has(id) && attempts < 5);

  return id;
}

class Transaction {
  private from: string;
  private to: string;
  private amount: number;

  constructor(from: string, to: string, amount: number) {
    this.from = from;
    this.to = to;
    this.amount = amount;
  }

  public record(desc: string) {
    const db = new JaylyDB("transactions", false);
    const date = Date.now();
    const salt = Date.now().toString(36);
    const id = generateId(10, salt);

    const data: Data = {
      from: this.from,
      to: this.to,
      amount: this.amount,
      date,
      desc
    };

    // save to cache
    transactions.set(id, data);

    // index from
    if (!playerIndex.has(this.from)) playerIndex.set(this.from, new Set());
    playerIndex.get(this.from)!.add(id);

    // index to
    if (!playerIndex.has(this.to)) playerIndex.set(this.to, new Set());
    playerIndex.get(this.to)!.add(id);

    // save to DB (1 table)
    db.set(id, JSON.stringify(data));
  }

  
}

export default Transaction;

export function cleanupOldTransactions(days: number = 10) {
  const db = new JaylyDB("transactions", false);
  const now = Date.now();
  const maxAge = days * 24 * 60 * 60 * 1000;

  for (const [id, data] of transactions) {
    const txTime = data.date;

    if (now - txTime > maxAge) {
      // hapus dari index (from)
      const fromSet = playerIndex.get(data.from);
      fromSet?.delete(id);
      if (fromSet && fromSet.size === 0) playerIndex.delete(data.from);

      // hapus dari index (to)
      const toSet = playerIndex.get(data.to);
      toSet?.delete(id);
      if (toSet && toSet.size === 0) playerIndex.delete(data.to);

      // hapus dari cache
      transactions.delete(id);

      // hapus dari DB
      db.delete(id);
    }
  }
}
export function formatDate(timestamp: number): string {
  const d = new Date(timestamp);

  const pad = (n: number) => n.toString().padStart(2, "0");

  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = d.getFullYear();

  const hour = pad(d.getHours());
  const minute = pad(d.getMinutes());
  const second = pad(d.getSeconds());

  return `${day}/${month}/${year}-${hour}:${minute}:${second}`;
}

export function getPlayerTransactions(player: string): Data[] {
  const ids = playerIndex.get(player);
  if (!ids) return [];

  const result: Data[] = [];

  for (const id of ids) {
    const data = transactions.get(id);
    if (data) result.push(data);
  }

  return result;
}
export function mapWithType(player: string) {
  return getPlayerTransactions(player).map(tx => ({
    ...tx,
    type: tx.from === player ? "credit" : "debit"
  }));
}

world.afterEvents.itemUse.subscribe((event) => {
  const { source: player, itemStack } = event;
  if (itemStack.typeId === "minecraft:paper") {
    mapWithType(player.name).forEach(tx => {
      player.sendMessage(`${tx.type}: ${tx.amount} - ${tx.desc}`);
    })
  }
  if (itemStack.typeId === "minecraft:blaze_rod") {
    transactions.clear();
    playerIndex.clear();
    system.run(() => {
      const db = new JaylyDB("transactions", false);
      db.clear();
    });
  }
});