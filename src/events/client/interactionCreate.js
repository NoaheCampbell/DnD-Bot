module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
      if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
  
        if (!command) return interaction.reply({ content: 'An error has occured!', ephemeral: true });
  
        try {
          await command.execute(interaction, client);
        } catch (error) {
          console.error(error);
          await interaction.reply({ content: 'An error has occured!', ephemeral: true });
        }
      }
    },
}