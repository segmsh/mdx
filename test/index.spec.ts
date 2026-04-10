import { describe, it, expect } from "vitest";

import fs from "fs";
import path from "path";

import MdxProcessor from "../src/index.js";

const processor = new MdxProcessor();

function processAndCompare(filename: string) {
  const inDoc = fs.readFileSync(path.join("test", "fixtures", filename), {
    encoding: "utf-8",
  });

  const doc = processor.parse(inDoc);
  const docStr = JSON.stringify(doc);

  const outDoc = processor.stringify(doc);
  const outDocStructure = processor.parse(outDoc);
  const outDocStructureStr = JSON.stringify(outDocStructure);

  expect(outDocStructureStr).toBe(docStr);
  console.log(filename);
}

function processWithoutThrowing(filename: string) {
  const inDoc = fs.readFileSync(path.join("test", "fixtures", filename), {
    encoding: "utf-8",
  });

  const doc = processor.parse(inDoc);
  const outDoc = processor.stringify(doc);

  expect(typeof outDoc).toBe("string");
  expect(outDoc.length).toBeGreaterThan(0);
  console.log(filename);
}

describe("MdxProcessorTest", () => {
  const roundtripFixtures = [
    "mdx-edge-cases.mdx",
    "exports.mdx",
    "extending-mdx.mdx",
    "index.mdx",
    "mdx-mixed-syntax.mdx",
    "using-mdx.mdx",
  ];

  roundtripFixtures.forEach((filename) => {
    it(`should roundtrip ${filename}`, () => {
      processAndCompare(filename);
    });
  });

  ["getting-started.mdx", "what-is-mdx.mdx"].forEach((filename) => {
    it(`should parse and stringify ${filename} without throwing`, () => {
      processWithoutThrowing(filename);
    });
  });
});
