import { CommandPermissionLevel, CustomCommandParamType, CustomCommandStatus, Player, system, } from "@minecraft/server";
import { recieveForm } from "./form";
import { sendForm } from "./sendForm";
function main(origin, method, playerName) {
    const player = origin.sourceEntity;
    if (!(player instanceof Player))
        return;
    const handler = () => {
        if (method === "receive") {
            recieveForm(player);
        }
        if (method === "send") {
            if (!playerName) {
                player.sendMessage("§cName is required");
                return;
            }
            sendForm(player, playerName);
        }
    };
    system.run(handler);
    return {
        status: CustomCommandStatus.Success
    };
}
system.beforeEvents.startup.subscribe((init) => {
    init.customCommandRegistry.registerEnum("sma:mail", ["send", "receive"]);
    const command = {
        name: "sma:mail",
        description: "sending or read mail",
        permissionLevel: CommandPermissionLevel.Any,
        mandatoryParameters: [
            {
                name: "sma:mail",
                type: CustomCommandParamType.Enum
            }
        ],
        optionalParameters: [
            {
                name: "player name",
                type: CustomCommandParamType.String
            }
        ]
    };
    init.customCommandRegistry.registerCommand(command, main);
});
