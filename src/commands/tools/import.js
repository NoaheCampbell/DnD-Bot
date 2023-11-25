const { SlashCommandBuilder } = require("discord.js");
const puppeteer = require("puppeteer");
const cheerio = require("cheerio");

async function scrapeData(url) {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });
    // await page.waitForSelector('ct-main-tablet__ability');

    // Take a screenshot and save it to a file
    await page.screenshot({ path: 'screenshot.png', fullPage: true });

    const html = await page.content();
    await browser.close();
    
    // Create a new characterData object for each scrape to avoid conflicts
    let characterData = {
        name: "",
        stats: {
            STR: null,
            DEX: null,
            CON: null,
            INT: null,
            WIS: null,
            CHA: null
        },
        savingThrows: {
            STR: null,
            DEX: null,
            CON: null,
            INT: null,
            WIS: null,
            CHA: null
        },
        skillChecks: {
            Acrobatics: null,
            AnimalHandling: null,
            Arcana: null,
            Athletics: null,
            Deception: null,
            History: null,
            Insight: null,
            Intimidation: null,
            Investigation: null,
            Medicine: null,
            Nature: null,
            Perception: null,
            Performance: null,
            Persuasion: null,
            Religion: null,
            SleightOfHand: null,
            Stealth: null,
            Survival: null
        },
        skillRerolls: {
            STR: null,
            DEX: null,
            CON: null,
            INT: null,
            WIS: null,
            CHA: null,
            Acrobatics: null,
            AnimalHandling: null,
            Arcana: null,
            Athletics: null,
            Deception: null,
            History: null,
            Insight: null,
            Intimidation: null,
            Investigation: null,
            Medicine: null,
            Nature: null,
            Perception: null,
            Performance: null,
            Persuasion: null,
            Religion: null,
            SleightOfHand: null,
            Stealth: null,
            Survival: null,
            Initiative: null,
        },
    };

    // Pass the characterData to the readData function
    characterData = readDataWithRetry(html, characterData);

    // Return the populated characterData
    return characterData;
}

// Given the html as a string, this function will parse it to get the character data
function readData(html, characterData) {
    const $ = cheerio.load(html);
    characterData.name = $('h1.MuiTypography-root.MuiTypography-h4.ddb-character-app-sn0l9p').text();
    console.log(characterData.name);

    const abilityElements = $('.ct-main-tablet__ability');
    const statKeys = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
    abilityElements.each((index, element) => {
        if (index < statKeys.length) {
            const statValue = $(element).find('.ddbc-ability-summary__secondary--dark-mode').text().trim();
            const statName = statKeys[index];
            characterData.stats[statName] = parseInt(statValue, 10) || null; // Fallback to null if parsing fails
        }
    });

    // Each ability's saving throw is contained within a div that has a class for the specific ability
    const abilityClasses = [
        'str',
        'dex',
        'con',
        'int',
        'wis',
        'cha'
    ];

    abilityClasses.forEach(ability => {
        // Construct the class selector for the ability
        const selector = `.ddbc-saving-throws-summary__ability--${ability} .ddbc-saving-throws-summary__ability-modifier`;
        const modifierElement = $(selector);
        let modifierText = modifierElement.text().trim();

        // If there's no sign, assume '+'
        if (!modifierText.startsWith('+') && !modifierText.startsWith('-')) {
            modifierText = '+' + modifierText;
        }

        // Store the modifier with the sign as a string
        characterData.savingThrows[ability.toUpperCase()] = modifierText;
    });

    const skillElements = $('.ct-skills__item');
    skillElements.each((index, element) => {
        console.log(index);
        const skillName = $(element).find('.ct-skills__col--skill.ct-skills__col--skill--dark-mode').text().trim();
        const skillValue = ($(element).find('.ddbc-signed-number').attr('aria-label').replace(' ', ''));
        const skillKey = convertSkillNameToKey(skillName);
        console.log('Skill Info: ' + skillName, skillValue);
        characterData.skillChecks[skillKey] = skillValue;
    });

    console.log(characterData);
}

function convertSkillNameToKey(skillNameText) {
    // Mapping from the skill names in the HTML to the keys in characterData
    const skillMapping = {
        'Acrobatics': 'Acrobatics',
        'Animal Handling': 'AnimalHandling',
        'Arcana': 'Arcana',
        'Athletics': 'Athletics',
        'Deception': 'Deception',
        'History': 'History',
        'Insight': 'Insight',
        'Intimidation': 'Intimidation',
        'Investigation': 'Investigation',
        'Medicine': 'Medicine',
        'Nature': 'Nature',
        'Perception': 'Perception',
        'Performance': 'Performance',
        'Persuasion': 'Persuasion',
        'Religion': 'Religion',
        'Sleight of Hand': 'SleightOfHand',
        'Stealth': 'Stealth',
        'Survival': 'Survival'
    };

    return skillMapping[skillNameText] || null;  // Return the matching key or null if not found
}

async function readDataWithRetry(html, characterData, maxRetries = 1) {
    let retries = 0;

    while (retries < maxRetries) {
        readData(html, characterData);

        // Check if all values are non-null
        const allDataPresent = Object.values(characterData.stats).every(stat => stat !== null) &&
                               Object.values(characterData.savingThrows).every(st => st !== null) &&
                               Object.values(characterData.skillChecks).every(sc => sc !== null);

        if (allDataPresent) {
            console.log('Character data successfully imported');
            return characterData;
        } 

        console.log('Character data incomplete, retrying... Retries left:'+ (maxRetries - retries));
        retries++;
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait before retrying
    }

    // After maxRetries, if data is still incomplete, return an error saying the import failed
    return {
        error: 'Failed to import character data'
    };
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

        scrapeData(link).then(characterData => {
            console.log(characterData);

            if (characterData.error) {
                interaction.editReply({ content: characterData.error });
            } else {
                interaction.editReply({ content: 
`Successfully got to ${characterData.name}'s character sheet with the following stats:
    STR: ${characterData.stats.STR}
    DEX: ${characterData.stats.DEX}
    CON: ${characterData.stats.CON}
    INT: ${characterData.stats.INT}
    WIS: ${characterData.stats.WIS}
    CHA: ${characterData.stats.CHA}
Saving Throws:
    STR: ${characterData.savingThrows.STR}
    DEX: ${characterData.savingThrows.DEX}
    CON: ${characterData.savingThrows.CON}
    INT: ${characterData.savingThrows.INT}
    WIS: ${characterData.savingThrows.WIS}
    CHA: ${characterData.savingThrows.CHA}
Skill Checks:
    Acrobatics: ${characterData.skillChecks.Acrobatics}
    Animal Handling: ${characterData.skillChecks.AnimalHandling}
    Arcana: ${characterData.skillChecks.Arcana}
    Athletics: ${characterData.skillChecks.Athletics}
    Deception: ${characterData.skillChecks.Deception}
    History: ${characterData.skillChecks.History}
    Insight: ${characterData.skillChecks.Insight}
    Intimidation: ${characterData.skillChecks.Intimidation}
    Investigation: ${characterData.skillChecks.Investigation}
    Medicine: ${characterData.skillChecks.Medicine}
    Nature: ${characterData.skillChecks.Nature}
    Perception: ${characterData.skillChecks.Perception}
    Performance: ${characterData.skillChecks.Performance}
    Persuasion: ${characterData.skillChecks.Persuasion}
    Religion: ${characterData.skillChecks.Religion}
    Sleight of Hand: ${characterData.skillChecks.SleightOfHand}
    Stealth: ${characterData.skillChecks.Stealth}
    Survival: ${characterData.skillChecks.Survival}` });
            }
        }
        ).catch((err) => {
            console.log(err);
            interaction.editReply({ content: 'Failed to import character sheet.' });
        });
        
    }
}