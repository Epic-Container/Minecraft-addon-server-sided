import {
  CommandPermissionLevel,
  CustomCommand,
  CustomCommandOrigin,
  CustomCommandParamType,
  CustomCommandStatus,
  Player,
  system,
  world,
} from "@minecraft/server"
import Score from "./score";
import Transaction from "./transaction";

function main(origin: CustomCommandOrigin, method: string, targetName?: string, amount?: number) {
  const player = origin.sourceEntity;
  if (!(player instanceof Player)) return;
  const from = new Score(player, "money", "Money");
  
  if (method === "bc") {
    player.sendMessage(`Your balance is ${from.get()}`);
  }

  
  system.run(()=>{
    
    if (method === "tf") {
      if (!targetName) {
        player.sendMessage("§cPlayer name is required");
        return;
      }
      if (!amount) {
        player.sendMessage("§cAmount is required");
        return;
      }
      const targetPlayer = world.getAllPlayers().find((p) => p.name === targetName);
      
      if (!targetPlayer) {
        player.sendMessage("§cPlayer not found");
        return;
      }
      
      const to = new Score(targetPlayer, "money", "Money");
      const transaction = new Transaction(player.name, targetName, amount);
      
      if (from.get() < amount) {
        player.sendMessage("§cYou don't have enough money");
        return;
      }
      transaction.record("Transfer Money");
      from.remove(amount);
      to.add(amount);
    }
  })

  return {
    status: CustomCommandStatus.Success
  }
}

system.beforeEvents.startup.subscribe((init) => {
  
  init.customCommandRegistry.registerEnum("sma:money", ["tf", "bc"]);

  const command: CustomCommand = {
    name: "sma:money",
    description: "Money Transfer function like wallet",
    permissionLevel: CommandPermissionLevel.Any,
    mandatoryParameters: [
      {
        name: "sma:money",
        type: CustomCommandParamType.Enum
      }
    ],
    optionalParameters: [
      {
        name: "player name",
        type: CustomCommandParamType.String
      },
      {
        name: "amount",
        type: CustomCommandParamType.Integer
      }
    ]
  }
  init.customCommandRegistry.registerCommand(command, main);
});