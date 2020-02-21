import * as Discord from "discord.js";
import fetch from "node-fetch";
import { DISCORD } from "./config";
import turndown from "turndown";
import cheerio from "cheerio";

const prefix = DISCORD.PREFIX;
const client = new Discord.Client();
let td = new turndown({
  hr: `================================================`
});
td.addRule("img", {
  filter: "img",
  replacement: (content, node): string => {
    //@ts-ignore
    return node.className === "actionlight" ? `*${node.getAttribute("alt")}* `: "";
  }
});
td.addRule("links", {
  filter: "a",
  replacement: (content, node): string => {
    return `${content} `;
  }
});
td.addRule("spans", {
  filter: "span",
  replacement: (content, node): string => {
    return `${content}\n`;
  }
});

const getDirect = async (
  link: string
): Promise<{
  result: string;
  type: string;
  options: { text: string; link: string }[];
}> => {
  let res = await fetch(`http://2e.aonprd.com/${link}`);
  let body = await res.text();
  let $ = cheerio.load(body);
  let html = $("#ctl00_MainContent_DetailedOutput").html() || "error";
  let mkdown = td.turndown(html);
  return { result: mkdown, type: "success", options: [] };
};

const searchFor = async (
  search: string
): Promise<{
  result: string;
  type: string;
  options: { text?: string; link: string }[];
}> => {
  try {
    let res = await fetch(`http://2e.aonprd.com/Search.aspx?query=${search}`);
    let body: string = await res.text();
    let $ = cheerio.load(body);
    if (
      $("#ctl00_MainContent_SearchOutput b")
        .contents()
        .get(0).data == "Exact Match"
    ) {
      console.log("exact match");
      let link = $("#ctl00_MainContent_SearchOutput a").get(0).attribs.href;
      return getDirect(link);
    } else if (
      //  more than 1 exact match
      $("#ctl00_MainContent_SearchOutput b")
        .contents()
        .get(0).data == "Exact Matches"
    ) {
      let matches = $("#ctl00_MainContent_SearchOutput b")
        .nextUntil("h1")
        .find("a")
        .toArray();
      // get the list of matches and return it with a status code "waiting for input" and the list of options
      return {
        result: "multiple",
        type: "multipleExact",
        options: matches.map((node, i): { text: string; link: string } => {
          return {
            text: node.children[0].data || "ERROR",
            link: node.attribs.href
          };
        })
      };
    } else {
      // No exact matches found!
      //get the list of matches and return it with a status code "waiting for input" and the list of options
      return { result: "Nothing found", type: "No Exact Match", options: [] };
    }
  } catch (error) {
    return { result: error, type: "error", options: [] };
  }
};

client.on("ready", () => {
  console.log(`logged in as ${client.user.tag}!`);
});

client.on("message", async (message) => {
  //ignore itself
  if (message.author === client.user) return;
  // ignore DMs and ignore other bots
  if (!message.guild || message.author.bot) return;
  // ignore without control character
  if (!message.content.startsWith(`${prefix}`)) return;
  //Message starts with control character (default "!")
  let content = message.content.slice(prefix.length);
  message.channel
    .send(`Getting ${content}`)
    .catch((error) => console.error(error));
  let results = await searchFor(content);
  switch (results.type) {
    case "success":
      message.channel.startTyping()
      message.channel
        .send(results.result, { split: true })
        .catch((error) => console.error(error));
      message.channel.stopTyping()
      break;
    case "multipleExact":
      
      message.channel.startTyping()
      await message.reply(`Multiple Matches, please select one:`);
      message.channel
        .send(
          results.options
            ?.map((result, i): string => {
              return `${i + 1}: ${result.text}`;
            })
            .join("\n"),
          { split: true }
        )
        .then(() => {
          message.channel.stopTyping()
          message.channel
            .awaitMessages(
              (response: Discord.Message) => {
                return (
                  response.author == message.author &&
                  parseInt(response.content) > 0 &&
                  parseInt(response.content) <= results.options.length
                );
              },
              { maxMatches: 1, errors: ["time"], time: 20000 }
            )
            .then(async (collected) => {
              message.channel.startTyping()
              let { result } = await getDirect(
                results.options[parseInt(collected.first().content) - 1].link
              );
              await message.channel
                .send(result, { split: true })
                .catch((error) => console.error(error));
              message.channel.stopTyping()
            })
            .catch((error) => console.error(error));
        })
        .catch((error) => console.error(error));
      break;
    case "error":
      message.channel
        .send(`Error: error in try/catch from ${content}`)
        .catch((error) => console.error(error));
    default:
      message.channel
        .send(`Error: Nonstandard response type for ${content}`)
        .catch((error) => console.error(error));
  }
});

client.login(DISCORD.TOKEN);
