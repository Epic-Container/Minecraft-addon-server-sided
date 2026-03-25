import { CommandPermissionLevel, CustomCommandParamType, CustomCommandStatus, Player, system } from "@minecraft/server";
import { recieveForm } from "./form";
import Mail from "./mail";
function main(origin, method, playerName) {
    const player = origin.sourceEntity;
    if (!(player instanceof Player))
        return;
    const handler = () => {
        if (method === "receive") {
            recieveForm(player);
        }
        if (method === "send") {
            const msgMail = {
                from: player.name,
                to: playerName,
                type: "money",
                desc: "i got u bro",
                read: false,
                date: Date.now()
            };
            const mail = new Mail();
            mail.send(msgMail, player);
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
