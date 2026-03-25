import { world, Player, ScoreboardObjective } from "@minecraft/server";

class Score {
  public player: Player
  public scoreName: string
  public scoreboard: ScoreboardObjective
  
  constructor(player: Player, scoreName: string, scoreDisplay: string) {
    this.player = player
    this.scoreName = scoreName

    const scoreboard = world.scoreboard

    let obj = scoreboard.getObjective(scoreName)
    if (!obj) {
      obj = scoreboard.addObjective(scoreName, scoreDisplay)
    }

    if (!obj) throw new Error("Objective failed to add")

    this.scoreboard = obj
  }

  public add(amount: number) {
    this.scoreboard.addScore(this.player, amount)
  }
  
  public get() {
    return this.scoreboard.getScore(this.player) ?? 0
  }

  public set(amount: number) {
    this.scoreboard.setScore(this.player, amount)
  }

  public remove(amount: number) {
    const current = this.get()
    if (current < amount) return
    this.scoreboard.setScore(this.player, current - amount)
  }
}

export default Score