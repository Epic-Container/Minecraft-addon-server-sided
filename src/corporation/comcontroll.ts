import { 
  StartupEvent,
  system,
  CustomCommand,
  CustomCommandStatus,
  CommandPermissionLevel,
  CustomCommandParamType,
  CustomCommandOrigin,
  Player
} from "@minecraft/server";


function commandCall (origin: CustomCommandOrigin, method: string, name?: string) {
  const player = origin.sourceEntity;
  if (!(player instanceof Player)) return;

  if (method === "list") {
    
  }
  if (!name) {
    player.sendMessage("§cName is required");
    return;
  }
  if (method === "join") {
  }
  if (method === "make") {
    
  }

  return {
    status: CustomCommandStatus.Success
  }
}

system.beforeEvents.startup.subscribe((init: StartupEvent) => {
  init.customCommandRegistry.registerEnum("smp:corp", ["join", "make", "list"]);
  const command: CustomCommand = {
    name: "corp",
    description: "Join or corporation",
    permissionLevel: CommandPermissionLevel.Any,
    mandatoryParameters: [
      {
        name: "method",
        type: CustomCommandParamType.Enum
      }
    ],
    optionalParameters: [
      {
        name: "name",
        type: CustomCommandParamType.String
      }
    ]
  }
  init.customCommandRegistry.registerCommand(command, commandCall);
})