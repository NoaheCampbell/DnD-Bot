const { SlashCommandBuilder } = require("discord.js");
const puppeteer = require("puppeteer");
const cheerio = require("cheerio");

let characterName = "";

async function scrapeData(url) {
    console.log(url);
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });

    // Take a screenshot and save it to a file
    await page.screenshot({ path: 'screenshot.png', fullPage: true });

    const data = await page.evaluate(() => {
      // Extract data from the page
      return document.body.innerHTML; // or specific data based on your needs
    });
    await browser.close();
    return data;
  }

  // Given the html as a string, this function will parse it to get the character name
async function readData(html) {
    const $ = cheerio.load(html);
    characterName = $('h1.MuiTypography-root.MuiTypography-h4.ddb-character-app-sn0l9p').text();
}

// This command will take a link from the user, parse it to see if it is a dndbeyond link, and if so then get all relevant character data from the character sheet
module.exports = {
    data: new SlashCommandBuilder()
    .setName("import")
    .setDescription("Import a character from a dndbeyond link")
    .addStringOption(option => option.setName("link").setDescription("The link to the character sheet").setRequired(true)),

    async execute(interaction, client) {

        // Gets link from the interaction and sends an HTTP GET request to get the HTML of the page, and on a success it returns a snippet of the html
        const link = interaction.options.get("link").value;

        await interaction.deferReply({ ephemeral: false });

        scrapeData(link).then(async (data) => {
            await readData(data);

            await interaction.editReply({ content: `Successfully got to ${characterName}'s character sheet!` });
        }
        ).catch((err) => {
            console.log(err);
        });
        
    }
}