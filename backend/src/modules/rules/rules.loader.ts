// src/modules/rules/rules.loader.ts

import fs from "fs";

export function loadAgronomicRules() {
  const filePath = new URL("./agronomic.rules.json", import.meta.url);

  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}