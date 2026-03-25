import { world } from "@minecraft/server";
class Score {
    constructor(player, scoreName, scoreDisplay) {
        this.player = player;
        this.scoreName = scoreName;
        const scoreboard = world.scoreboard;
        let obj = scoreboard.getObjective(scoreName);
        if (!obj) {
            obj = scoreboard.addObjective(scoreName, scoreDisplay);
        }
        if (!obj)
            throw new Error("Objective failed to add");
        this.scoreboard = obj;
    }
    add(amount) {
        this.scoreboard.addScore(this.player, amount);
    }
    get() {
        return this.scoreboard.getScore(this.player) ?? 0;
    }
    set(amount) {
        this.scoreboard.setScore(this.player, amount);
    }
    remove(amount) {
        const current = this.get();
        if (current < amount)
            return;
        this.scoreboard.setScore(this.player, current - amount);
    }
}
export default Score;
