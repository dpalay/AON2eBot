import * as Discord from "discord.js";
import fetch from "node-fetch";
import { DISCORD } from "./config";
import turndown from "turndown";
import cheerio from "cheerio";

const controlChar = DISCORD.CONTROLCHAR;
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


const getPage = async (search: string): Promise<{result: string, type: string, options?: {}}> => {
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
      res = await fetch(`http://2e.aonprd.com/${link}`);
      body = await res.text();
      $ = cheerio.load(body);
      let html = $("#ctl00_MainContent_DetailedOutput").html() || "error";
      let mkdown = td.turndown(html);
      return {result: mkdown, type: "success"};
    } else if (
        //  more than 1 exact match
        $("#ctl00_MainContent_SearchOutput b")
          .contents()
          .get(0).data == "Exact Matches"
      ) {
        let matches = $("#ctl00_MainContent_SearchOutput b u").nextUntil('h1').find('a').toArray()
          // get the list of matches and return it with a status code "waiting for input" and the list of options
          return {result: "multiple", type:"multipleExact",options: matches.map((node, i) =>{ return {text: node.children[0].data ,links: node.attribs.href}} )}
      }
          else{
      // No exact matches found!
      //get the list of matches and return it with a status code "waiting for input" and the list of options
      return {result: "Nothing found", type:"No Exact Match"};
    }
  } catch (error) {
    return {result: error, type: "error"};
  }
};

client.on("ready", () => {
  console.log(`logged in as ${client.user.tag}!`);
});

client.on("message", async message => {
  //ignore itself
  if (message.author === client.user) return;
  // ignore DMs and ignore other bots
  if (!message.guild || message.author.bot) return;
  // ignore without control character
  if (!message.content.startsWith(`${controlChar}`)) return;
  //Message starts with control character (default "!")
  message.channel
    .send(`Getting ${message.content.slice(1)}`)
    .catch(error => console.error(error));
  let content = message.content.slice(1);
  let results = await getPage(content);
  switch(results.type){
    case "success":
        message.channel
        .send(results,{split:true})
        .catch(error => console.error(error));
      break;
    case "multipleExact":
        message.channel.send("Multiple Extact Matches").catch(error => console.error(error));
        // send list of matches, wait for response.
      break;
    case "error":
        message.channel.send(`Error: error in try/catch from ${content}`).catch(error => console.error(error));
    default:
        message.channel.send(`Error: Nonstandard response type for ${content}`).catch(error => console.error(error));
    
  }

});

client.login(DISCORD.TOKEN);