import core from "@actions/core";
import github from "@actions/github";
import fetch from "node-fetch";
import {
  createCommit,
  loadTemplate,
  parseTemplate,
  stringOrFalse,
  stringToBoolean,
} from "./api.js";

const templateName = core.getInput("template") || "plain";
const template = await loadTemplate(templateName);
const message = core.getInput("message") || template.message;
const webhook = core.getInput("webhook");
const lastCommitOnly = stringToBoolean(core.getInput("last-commit-only"));
const includeExtras = stringToBoolean(core.getInput("include-extras"));
const extraEmbeds = includeExtras ? template.extras || [] : [];
const embedStr = stringOrFalse(core.getInput("embed")) || JSON.stringify(template.embed);

const DATA = {
  env: { ...process.env },
  github: { ...github },
};

let commits = github.context.payload.commits || [];

if (lastCommitOnly) {
  commits = commits.slice(-1);
}

const commitObjs = commits.map(createCommit);

const descriptionText = commitObjs
  .map(c => `- \`${c.id.substring(0,7)}\` ${c.title.split("\n")[0]}`)
  .join("\n");

const baseEmbed = JSON.parse(embedStr);
baseEmbed.description = descriptionText;


let embeds = [parseTemplate(DATA, baseEmbed)];

if (includeExtras) {
  embeds = embeds.concat(extraEmbeds.map(e => parseTemplate(DATA, e)));
}

const payload = {
  content: parseTemplate(DATA, message),
  embeds: embeds.filter(x => x),
};

try {
  const webhookURL = new URL(webhook);
  webhookURL.searchParams.set("wait", "true");
  await fetch(webhookURL.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-GitHub-Event": "push",
    },
    body: JSON.stringify(payload),
  });
} catch (err) {
  console.error(err);
  core.error(err);
  core.setFailed("Message :", err.response ? err.response.data : err.message);
}
